import { env } from "cloudflare:workers";
import { recordPaidShopifyOrder, type ShopifyOrderPayload } from "../../../../../db/commerce";

type DesignRow = {
  id: string;
  production_prompt: string;
  preview_base64: string;
  preview_format: string;
  printify_variant_id: number;
  printify_blueprint_id: number;
  printify_provider_id: number;
  placement_json: string | null;
  status: string;
};

const encoder = new TextEncoder();

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function verifyShopifyHmac(rawBody: ArrayBuffer, received: string, secret: string) {
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return crypto.subtle.verify("HMAC", key, decodeBase64(received), rawBody);
  } catch {
    return false;
  }
}

async function generatePrintFile(apiKey: string, design: DesignRow) {
  const previewBytes = decodeBase64(design.preview_base64);
  const form = new FormData();
  form.set("model", "gpt-image-2");
  form.set("image", new File([previewBytes], `preview.${design.preview_format}`, { type: `image/${design.preview_format}` }));
  form.set("prompt", `${design.production_prompt} Preserve the approved preview's subject, composition, palette, and identity as closely as possible. Refine edges and details for the final print file. Return isolated artwork only.`);
  form.set("size", "1024x1024");
  form.set("quality", "high");
  form.set("output_format", "png");
  form.set("moderation", "low");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(150_000),
  });
  const requestId = response.headers.get("x-request-id") || undefined;
  const payload = await response.json().catch(() => null) as {
    data?: Array<{ b64_json?: string }>;
    error?: { code?: string; moderation_details?: { moderation_stage?: string } };
  } | null;
  if (!response.ok || !payload?.data?.[0]?.b64_json) {
    console.error("CAPPATEX final image generation failed", {
      requestId,
      status: response.status,
      code: payload?.error?.code,
      moderationStage: payload?.error?.moderation_details?.moderation_stage,
    });
    throw new Error("final_image_failed");
  }
  return payload.data[0].b64_json;
}

async function uploadToPrintify(token: string, designId: string, base64: string) {
  const response = await fetch("https://api.printify.com/v1/uploads/images.json", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ file_name: `${designId}.png`, contents: base64 }),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => null) as { id?: string; preview_url?: string } | null;
  if (!response.ok || !payload?.id || !payload.preview_url) {
    console.error("CAPPATEX Printify upload failed", { status: response.status, designId });
    throw new Error("printify_upload_failed");
  }
  return payload;
}

function property(line: NonNullable<ShopifyOrderPayload["line_items"]>[number], name: string) {
  return line.properties?.find((entry) => entry.name === name)?.value || "";
}

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("x-shopify-hmac-sha256") || "";
  const topic = request.headers.get("x-shopify-topic") || "";
  const webhookId = request.headers.get("x-shopify-webhook-id") || "";
  if (!secret || !signature || topic !== "orders/paid" || !/^[a-zA-Z0-9-]{8,100}$/.test(webhookId)) {
    return Response.json({ error: "Ungültiger Webhook." }, { status: 401 });
  }
  if (Number(request.headers.get("content-length") || 0) > 1_000_000) {
    return Response.json({ error: "Webhook zu gross." }, { status: 413 });
  }
  const rawBody = await request.arrayBuffer();
  if (!(await verifyShopifyHmac(rawBody, signature, secret))) {
    return Response.json({ error: "Ungültige Webhook-Signatur." }, { status: 401 });
  }
  const existing = await env.DB.prepare("SELECT id FROM cappatex_webhook_events WHERE id = ? LIMIT 1").bind(webhookId).first();
  if (existing) return Response.json({ ok: true, duplicate: true });

  let order: ShopifyOrderPayload;
  try {
    order = JSON.parse(new TextDecoder().decode(rawBody)) as ShopifyOrderPayload;
  } catch {
    return Response.json({ error: "Ungültiger Webhook-Inhalt." }, { status: 400 });
  }
  if (!order.id || order.financial_status !== "paid" || !order.shipping_address || !Array.isArray(order.line_items)) {
    return Response.json({ error: "Unvollständige bezahlte Bestellung." }, { status: 400 });
  }

  try {
    await recordPaidShopifyOrder(order);
  } catch (caught) {
    console.error("Shopify order persistence failed", { type: caught instanceof Error ? caught.message : "unknown", shopifyOrderId: order.id });
    return Response.json({ error: "Die bezahlte Bestellung konnte nicht sicher gespeichert werden." }, { status: 500 });
  }

  const designLines = order.line_items.map((line) => ({ line, designId: property(line, "CAPPATEX_DESIGN_ID") }))
    .filter((entry) => /^CPX-[A-Z0-9]{12}$/.test(entry.designId));
  if (designLines.length === 0) {
    await env.DB.prepare("INSERT INTO cappatex_webhook_events (id, topic, received_at) VALUES (?, ?, ?)").bind(webhookId, topic, Date.now()).run();
    return Response.json({ ok: true, status: "order_recorded" });
  }
  if (designLines.length > 5) return Response.json({ error: "Zu viele CAPPATEX Designs in einer Bestellung." }, { status: 400 });

  if (process.env.CAPPATEX_FULFILLMENT_ENABLED !== "true") {
    return Response.json({ error: "CAPPATEX Fulfillment wartet auf Betreiberfreigabe." }, { status: 503 });
  }
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const printifyToken = process.env.PRINTIFY_API_TOKEN?.trim();
  const printifyShopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!openaiKey || !printifyToken || !printifyShopId) {
    return Response.json({ error: "Fulfillment ist nicht vollständig konfiguriert." }, { status: 503 });
  }

  try {
    const printifyLines = [];
    const designIds: string[] = [];
    for (const { line, designId } of designLines) {
      const design = await env.DB.prepare(
        `SELECT id, production_prompt, preview_base64, preview_format, printify_variant_id,
                printify_blueprint_id, printify_provider_id, placement_json, status
         FROM cappatex_designs WHERE id = ? LIMIT 1`,
      ).bind(designId).first<DesignRow>();
      if (!design || !design.printify_variant_id || !design.printify_blueprint_id || !design.printify_provider_id) throw new Error("design_not_ready");

      const finalBase64 = await generatePrintFile(openaiKey, design);
      const uploaded = await uploadToPrintify(printifyToken, design.id, finalBase64);
      const placement = JSON.parse(design.placement_json || "{}") as { scale?: number; y?: number };
      printifyLines.push({
        print_provider_id: design.printify_provider_id,
        blueprint_id: design.printify_blueprint_id,
        variant_id: design.printify_variant_id,
        quantity: Math.min(Math.max(Number(line.quantity) || 1, 1), 5),
        external_id: design.id,
        print_areas: {
          front: [{
            src: uploaded.preview_url,
            scale: Math.min(Math.max((Number(placement.scale) || 72) / 100, 0.35), 1),
            x: 0.5,
            y: Math.min(Math.max((Number(placement.y) || 50) / 100, 0.28), 0.72),
            angle: 0,
          }],
        },
      });
      designIds.push(design.id);
    }

    const address = order.shipping_address;
    const printifyResponse = await fetch(`https://api.printify.com/v1/shops/${encodeURIComponent(printifyShopId)}/orders.json`, {
      method: "POST",
      headers: { Authorization: `Bearer ${printifyToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        external_id: `shopify-${order.id}`,
        label: order.name || `Shopify ${order.id}`,
        line_items: printifyLines,
        shipping_method: 1,
        send_shipping_notification: true,
        address_to: {
          first_name: address.first_name || "Kunde",
          last_name: address.last_name || "CAPPATEX",
          company: address.company || undefined,
          email: order.email || "",
          phone: address.phone || order.phone || "",
          country: address.country_code || "CH",
          region: address.province_code || "",
          address1: address.address1 || "",
          address2: address.address2 || "",
          city: address.city || "",
          zip: address.zip || "",
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const printifyOrder = await printifyResponse.json().catch(() => null) as { id?: string } | null;
    if (!printifyResponse.ok || !printifyOrder?.id) {
      console.error("CAPPATEX Printify order creation failed", { status: printifyResponse.status, shopifyOrderId: order.id });
      throw new Error("printify_order_failed");
    }

    let status = "printify_draft_ready";
    if (process.env.CAPPATEX_AUTO_PRODUCTION_ENABLED === "true") {
      const productionResponse = await fetch(`https://api.printify.com/v1/shops/${encodeURIComponent(printifyShopId)}/orders/${encodeURIComponent(printifyOrder.id)}/send_to_production.json`, {
        method: "POST",
        headers: { Authorization: `Bearer ${printifyToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!productionResponse.ok) {
        console.error("CAPPATEX send to production failed", { status: productionResponse.status, printifyOrderId: printifyOrder.id });
        throw new Error("send_to_production_failed");
      }
      status = "production_submitted";
    }

    const now = Date.now();
    await env.DB.batch([
      ...designIds.map((designId) => env.DB.prepare(
        "UPDATE cappatex_designs SET shopify_order_id = ?, printify_order_id = ?, status = ?, updated_at = ? WHERE id = ?",
      ).bind(String(order.id), printifyOrder.id, status, now, designId)),
      env.DB.prepare("INSERT INTO cappatex_webhook_events (id, topic, received_at) VALUES (?, ?, ?)").bind(webhookId, topic, now),
    ]);
    return Response.json({ ok: true, status });
  } catch (caught) {
    console.error("CAPPATEX fulfillment failed", { type: caught instanceof Error ? caught.message : "unknown", shopifyOrderId: order.id });
    return Response.json({ error: "Fulfillment konnte noch nicht abgeschlossen werden." }, { status: 500 });
  }
}
