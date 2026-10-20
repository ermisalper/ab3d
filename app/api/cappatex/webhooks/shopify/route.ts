import { env } from "cloudflare:workers";
import { recordPaidShopifyOrder, type ShopifyOrderPayload } from "../../../../../db/commerce";
import { CLAIM_FULFILLMENT, BEGIN_CREATE, FINISH_CREATE, createDraftOnce } from "../../../../../db/cappatex-fulfillment";
import { CAPPATEX_PRINT_PROFILES } from "../../../../cappatex-profiles";
import { profileIsVerified, placementGeometry } from "../../../../cappatex-print-profile";
import { verifiedCatalog } from "../../../../cappatex-verified-catalog";
import { sha256, encodeBase64 } from "../../../../cappatex-artwork";
import { boundedBody } from "../../../../cappatex-upload";
import { draftProductPayload, draftMatchesSnapshot } from "../../../../cappatex-printify-draft";
import { preparedDraftPayload, preparedDraftMatches } from "../../../../cappatex-prepared-draft";
import { preparedPrintFiles, validatePreparedSnapshot, type PreparedCheckoutContext } from "../../../../cappatex-prepared-checkout";
import type { PrintSide } from "../../../../cappatex-preparation";
import { snapshotId, validatePaidLine, verifyShopifyHmac, type CheckoutSnapshot, type PaidLine } from "../../../../cappatex-snapshot";
import { paidShippingMatchesRelease, shippingReleaseForBasket, snapshotShippingBasket, snapshotShippingReleaseIsCurrent,
  type ShippingPaidOrder } from "../../../../cappatex-shipping";
import { hasTokenPurchaseMarker } from "../../../../token-purchase-receipt";

type PaidOrder = Omit<ShopifyOrderPayload, "line_items"> & ShippingPaidOrder & { test?: boolean; cancelled_at?: string | null; line_items: PaidLine[] };
const reply = (status: string) => Response.json({ ok: true, status }, { headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.trim().toLowerCase();
  const topic = request.headers.get("x-shopify-topic");
  const eventId = request.headers.get("x-shopify-webhook-id") || "";
  if (!secret || !domain || request.headers.get("x-shopify-shop-domain")?.toLowerCase() !== domain
    || topic !== "orders/paid" || !/^[a-zA-Z0-9-]{8,100}$/.test(eventId)) return new Response("Invalid webhook", { status: 401 });
  let raw: ArrayBuffer;
  try { raw = (await boundedBody(request, 1_000_000)).buffer as ArrayBuffer; }
  catch (caught) {
    return new Response(caught instanceof Error && caught.message === "upload_too_large" ? "Payload too large" : "Invalid payload",
      { status: caught instanceof Error && caught.message === "upload_too_large" ? 413 : 400 });
  }
  if (!await verifyShopifyHmac(raw, request.headers.get("x-shopify-hmac-sha256") || "", secret)) return new Response("Invalid signature", { status: 401 });
  let order: PaidOrder;
  try { order = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!order || typeof order !== "object" || !order.id || order.financial_status !== "paid" || !Array.isArray(order.line_items)
    || order.cancelled_at || order.test) return new Response("Order not eligible", { status: 400 });
  // The separate token receipt handler owns digital credits. A pure nonshipping token
  // envelope has no shipping address and must never enter physical storage or Printify.
  // CAPPATEX markers and known POD variants always keep their existing validation path.
  if (order.line_items.length > 0 && hasTokenPurchaseMarker(order)
    && order.line_items.every(line => line && (line as PaidLine & { requires_shipping?: unknown }).requires_shipping === false
      && Array.isArray(line.properties) && line.properties.every(property => property && typeof property.name === "string" && typeof property.value === "string")
      && !line.properties.some(property => /^_?CAPPATEX_/i.test(property.name))
      && !CAPPATEX_PRINT_PROFILES.some(profile => profile.variants.some(variant => variant.shopifyVariantId === `gid://shopify/ProductVariant/${line.variant_id}`))))
    return reply("ignored_digital_token_order");
  if (!order.shipping_address) return new Response("Order not eligible", { status: 400 });
  try {
    await recordPaidShopifyOrder(order);
    const customLines = order.line_items.filter(line => line.properties?.some(p => /^(CAPPATEX_|_CAPPATEX_)/.test(p.name))
      || CAPPATEX_PRINT_PROFILES.some(p => p.variants.some(v => v.shopifyVariantId === `gid://shopify/ProductVariant/${line.variant_id}`)));
    if (!customLines.length) return reply("order_recorded");
    const id = `${domain}:${order.id}`;
    const inputHash = await sha256(JSON.stringify({ id, lines: order.line_items, address: order.shipping_address,
      email: order.email, currency: order.currency, presentmentCurrency: order.presentment_currency,
      shippingLines: order.shipping_lines, totalShipping: order.total_shipping_price_set, currentShipping: order.current_shipping_price_set }));
    const existing = await env.DB.prepare("SELECT input_sha256,state FROM cappatex_fulfillments WHERE id = ?").bind(id)
      .first<{ input_sha256: string; state: string }>();
    if (existing && (existing.input_sha256 !== inputHash || existing.state !== "pending")) {
      if (existing.input_sha256 !== inputHash) {
        // Classify a changed shipping envelope without replaying provider calls or touching an existing remote order.
        const prior = [];
        for (const line of customLines) {
          const sid = snapshotId(line);
          const stored = sid ? await env.DB.prepare("SELECT payload_json,payload_sha256 FROM cappatex_snapshots WHERE id = ?")
            .bind(sid).first<{ payload_json: string; payload_sha256: string }>() : null;
          if (!stored || await sha256(stored.payload_json) !== stored.payload_sha256) break;
          prior.push(JSON.parse(stored.payload_json) as CheckoutSnapshot);
        }
        const shipping = prior.length === customLines.length && customLines.length === order.line_items.length
          ? shippingReleaseForBasket(prior.map(snapshotShippingBasket), order.shipping_address.country_code) : null;
        const code = shipping && paidShippingMatchesRelease(order, shipping) ? "order_changed" : "shipping_unapproved";
        await env.DB.prepare(
          "UPDATE cappatex_fulfillments SET state = CASE WHEN state IN ('pending','preparing') THEN 'manual_review' ELSE state END, error_code = ?, updated_at = ? WHERE id = ?",
        ).bind(code, Date.now(), id).run();
      }
      return reply(existing.input_sha256 === inputHash ? existing.state : "order_changed_manual_review");
    }
    const shopId = process.env.PRINTIFY_SHOP_ID?.trim() || "";
    const snapshots: CheckoutSnapshot[] = [];
    const preparedContext: PreparedCheckoutContext = {};
    let shippingUnapproved = customLines.length !== order.line_items.length;
    let valid = customLines.length <= 5 && !shippingUnapproved;
    for (const line of valid ? customLines : []) {
      const sid = snapshotId(line);
      const row = sid ? await env.DB.prepare("SELECT payload_json,payload_sha256,state FROM cappatex_snapshots WHERE id = ?")
        .bind(sid).first<{ payload_json: string; payload_sha256: string; state: string }>() : null;
      if (!row || row.state !== "checkout_created" || await sha256(row.payload_json) !== row.payload_sha256) { valid = false; break; }
      const snapshot = JSON.parse(row.payload_json) as CheckoutSnapshot;
      if (snapshot.schemaVersion !== undefined && snapshot.schemaVersion !== 1 && snapshot.schemaVersion !== 2) { valid = false; break; }
      const current = CAPPATEX_PRINT_PROFILES.find(p => p.id === snapshot.profile.id && p.version === snapshot.profile.version);
      if (!current || JSON.stringify(current) !== JSON.stringify(snapshot.profile) || !profileIsVerified(current, shopId)
        || !validatePaidLine(snapshot, line, { currency: order.currency, email: order.email, country: order.shipping_address.country_code })) { valid = false; break; }
      if (!await snapshotShippingReleaseIsCurrent(snapshot)) { valid = false; shippingUnapproved = true; break; }
      if (snapshot.schemaVersion === 2 ? !(await validatePreparedSnapshot(snapshot, preparedContext)).ok
        : !placementGeometry(snapshot.variant.area, snapshot.artwork, snapshot.placement).ok) { valid = false; break; }
      snapshots.push(snapshot);
    }
    if (valid) {
      const shipping = shippingReleaseForBasket(snapshots.map(snapshotShippingBasket), order.shipping_address.country_code);
      if (!shipping || !paidShippingMatchesRelease(order, shipping)) { valid = false; shippingUnapproved = true; }
    }
    const now = Date.now();
    const enabled = process.env.CAPPATEX_FULFILLMENT_ENABLED === "true"
      && process.env.CAPPATEX_AUTO_PRODUCTION_ENABLED !== "true";
    const state = valid && enabled ? "pending" : "manual_review";
    try {
      if (!existing) await env.DB.batch([
        env.DB.prepare("INSERT INTO cappatex_fulfillments (id,external_id,input_sha256,state,error_code,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
          .bind(id, `ab3d-${order.id}`, inputHash, state, shippingUnapproved ? "shipping_unapproved" : null, now, now),
        ...(valid ? snapshots.map((snapshot, index) => env.DB.prepare(
          "INSERT INTO cappatex_fulfillment_lines (snapshot_id,fulfillment_id,shopify_line_id) VALUES (?,?,?)",
        ).bind(snapshot.id, id, String(customLines[index].id))) : []),
      ]);
    } catch {
      const duplicate = await env.DB.prepare("SELECT input_sha256,state FROM cappatex_fulfillments WHERE id = ?").bind(id).first<{ input_sha256: string; state: string }>();
      if (duplicate && duplicate.input_sha256 !== inputHash) {
        await env.DB.prepare("UPDATE cappatex_fulfillments SET state = CASE WHEN state IN ('pending','preparing') THEN 'manual_review' ELSE state END, error_code = ?, updated_at = ? WHERE id = ?")
          .bind(shippingUnapproved ? "shipping_unapproved" : "order_changed", Date.now(), id).run();
        return reply("order_changed_manual_review");
      }
      if (duplicate && duplicate.state !== "pending") return reply(duplicate.state);
      if (!duplicate) {
      // Persist an actual review case only for a proven consumed snapshot.
      let consumed = false;
      for (const snapshot of snapshots) {
        consumed ||= Boolean(await env.DB.prepare("SELECT snapshot_id FROM cappatex_fulfillment_lines WHERE snapshot_id = ?").bind(snapshot.id).first());
      }
      if (!consumed) throw new Error("fulfillment_storage_failed");
      await env.DB.prepare("INSERT INTO cappatex_fulfillments (id,external_id,input_sha256,state,error_code,created_at,updated_at) VALUES (?,?,?,'manual_review','snapshot_already_consumed',?,?)")
        .bind(id, `ab3d-${order.id}`, inputHash, now, now).run();
      return reply("snapshot_already_consumed_manual_review");
      }
    }
    await env.DB.prepare("INSERT OR IGNORE INTO cappatex_webhook_events (id,topic,received_at) VALUES (?,?,?)")
      .bind(eventId, topic, now).run();
    if (state !== "pending") {
      await env.DB.prepare("UPDATE cappatex_fulfillments SET state = 'manual_review', error_code = COALESCE(?,error_code), updated_at = ? WHERE id = ? AND state = 'pending'")
        .bind(shippingUnapproved ? "shipping_unapproved" : null, now, id).run();
      return reply("manual_review");
    }
    const token = process.env.PRINTIFY_API_TOKEN?.trim();
    let preparationErrorCode = "preparation_failed";
    const result = await createDraftOnce({
      claim: async () => Boolean(await env.DB.prepare(CLAIM_FULFILLMENT).bind(Date.now(), id).first()),
      prepare: async () => {
        if (!token) throw new Error("printify_unconfigured");
        const shipping = shippingReleaseForBasket(snapshots.map(snapshotShippingBasket), order.shipping_address?.country_code);
        if (!shipping || !paidShippingMatchesRelease(order, shipping)) { preparationErrorCode = "shipping_unapproved"; throw new Error("shipping_unapproved"); }
        const live = await verifiedCatalog();
        const lines = [];
        for (const snapshot of snapshots) {
          if (!await snapshotShippingReleaseIsCurrent(snapshot)) { preparationErrorCode = "shipping_unapproved"; throw new Error("shipping_unapproved"); }
          if (!live.some(p => p.id === snapshot.profile.id && p.variants.some(v => v.shopifyVariantId === snapshot.variant.shopifyVariantId)))
            throw new Error("availability_changed");
          const images: Partial<Record<PrintSide, { id: string; width: number; height: number }>> = {};
          let files;
          if (snapshot.schemaVersion === 2) {
            if (!(await validatePreparedSnapshot(snapshot, preparedContext)).ok) throw new Error("prepared_approval_changed");
            files = preparedPrintFiles(snapshot.preparation);
          } else {
            const object = await env.BUCKET.get(snapshot.artwork.key);
            if (!object) throw new Error("artwork_missing");
            const bytes = new Uint8Array(await object.arrayBuffer());
            if (await sha256(bytes) !== snapshot.artwork.sha256) throw new Error("artwork_changed");
            files = [{ position: "front" as const, bytes, width: snapshot.artwork.width, height: snapshot.artwork.height }];
          }
          for await (const file of files) {
            const upload = await fetch("https://api.printify.com/v1/uploads/images.json", {
              method: "POST", headers: { Authorization: `Bearer ${token}`, "User-Agent": "AB3D-CAPPATEX/1.0", "Content-Type": "application/json" },
              body: JSON.stringify({ file_name: snapshot.schemaVersion === 2 ? `${snapshot.preparation.id}-${file.position}.png` : `${snapshot.designId}.png`,
                contents: encodeBase64(file.bytes) }), signal: AbortSignal.timeout(60_000),
            });
            const image = await upload.json() as { id?: string; width?: number; height?: number };
            if (!upload.ok || !image.id || image.width !== file.width || image.height !== file.height) throw new Error("upload_failed");
            images[file.position] = { id: image.id, width: file.width, height: file.height };
            if (snapshot.schemaVersion === 2) await env.DB.prepare("UPDATE cappatex_fulfillment_lines SET printify_image_id = ? WHERE snapshot_id = ? AND fulfillment_id = ?")
              .bind(JSON.stringify({ schemaVersion: 2, images: Object.fromEntries(Object.entries(images).map(([side, value]) => [side, value.id])) }), snapshot.id, id).run();
          }
          const image = images.front;
          const productRoot = `https://api.printify.com/v1/shops/${encodeURIComponent(shopId)}/products`;
          const templateResponse = await fetch(`${productRoot}/${encodeURIComponent(snapshot.profile.printifyProductId)}.json`, {
            headers: { Authorization: `Bearer ${token}`, "User-Agent": "AB3D-CAPPATEX/1.0", Accept: "application/json" }, signal: AbortSignal.timeout(20_000),
          });
          const template = await templateResponse.json() as { id?: string; blueprint_id?: number; print_provider_id?: number; variants?: Array<{ id: number; price: number }> };
          const price = template.variants?.find(variant => variant.id === snapshot.variant.printifyVariantId)?.price;
          if (!templateResponse.ok || template.id !== snapshot.profile.printifyProductId || template.blueprint_id !== snapshot.profile.blueprintId
            || template.print_provider_id !== snapshot.profile.providerId || price === undefined) throw new Error("template_changed");
          // Use the uploaded original's ID, never Printify's preview URL. Each snapshot owns its own unpublished draft.
          const draftResponse = await fetch(`${productRoot}.json`, {
            method: "POST", headers: { Authorization: `Bearer ${token}`, "User-Agent": "AB3D-CAPPATEX/1.0", "Content-Type": "application/json" },
            body: JSON.stringify(snapshot.schemaVersion === 2 ? preparedDraftPayload(snapshot.preparation, images, price)
              : draftProductPayload(snapshot, image!.id, price)), signal: AbortSignal.timeout(60_000),
          });
          const draft = await draftResponse.json();
          if (!draftResponse.ok || !(snapshot.schemaVersion === 2 ? preparedDraftMatches(draft, snapshot.preparation, images)
            : draftMatchesSnapshot(draft, snapshot, image!.id))) throw new Error("draft_mismatch");
          await env.DB.prepare("UPDATE cappatex_fulfillment_lines SET printify_product_id = ?, printify_image_id = ? WHERE snapshot_id = ? AND fulfillment_id = ?")
            .bind(draft.id, snapshot.schemaVersion === 2
              ? JSON.stringify({ schemaVersion: 2, images: Object.fromEntries(Object.entries(images).map(([side, value]) => [side, value.id])) })
              : image!.id, snapshot.id, id).run();
          lines.push({ product_id: draft.id, variant_id: snapshot.variant.printifyVariantId,
            quantity: snapshot.quantity, external_id: snapshot.id });
        }
        const a = order.shipping_address!;
        if (!a.first_name || !a.last_name || !a.address1 || !a.city || !a.zip || !["CH","LI"].includes(a.country_code || "")) throw new Error("invalid_address");
        return { external_id: `ab3d-${order.id}`, label: order.name || `Shopify ${order.id}`, line_items: lines,
          shipping_method: shipping.printifyMethod, send_shipping_notification: false,
          address_to: { first_name: a.first_name, last_name: a.last_name, email: order.email || "",
            phone: a.phone || order.phone || "", country: a.country_code, region: a.province_code || "",
            ...(typeof a.company === "string" && a.company.trim() ? { company: a.company } : {}),
            address1: a.address1, address2: a.address2 || "", city: a.city, zip: a.zip } };
      },
      beginCreate: async payload => Boolean(await env.DB.prepare(BEGIN_CREATE).bind(await sha256(JSON.stringify(payload)), Date.now(), id).first()),
      create: async payload => {
        const response = await fetch(`https://api.printify.com/v1/shops/${encodeURIComponent(shopId)}/orders.json`, {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "User-Agent": "AB3D-CAPPATEX/1.0", "Content-Type": "application/json" },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(60_000),
        });
        const created = await response.json() as { id?: string };
        if (!response.ok || !created.id) throw new Error("order_creation_uncertain");
        return created.id;
      },
      finish: async printifyId => { await env.DB.prepare(FINISH_CREATE).bind(printifyId, Date.now(), id).run(); },
      hold: async () => { await env.DB.prepare("UPDATE cappatex_fulfillments SET state = 'manual_review', error_code = ?, updated_at = ? WHERE id = ? AND state = 'preparing'")
        .bind(preparationErrorCode, Date.now(), id).run(); },
    });
    // Production always requires manual approval. This route has no production-submit action.
    return reply(result);
  } catch {
    return Response.json({ error: "Bestellung konnte noch nicht sicher verarbeitet werden." }, { status: 503 });
  }
}
