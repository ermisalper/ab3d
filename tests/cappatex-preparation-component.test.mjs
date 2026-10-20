import assert from "node:assert/strict";
import { after, test } from "node:test";
import React, { useEffect, useState } from "react";
import { closeHarness, deferred, json, mount, until } from "./helpers/component-dom.mjs";

const { default: PreparationPanel } = await import("../app/cappatex/cappatex-preparation-panel.tsx");
const { default: PreparedReview } = await import("../app/cappatex/vorbereitung/[id]/review.tsx");
const { CAPPATEX_DESIGN_PROFILES } = await import("../app/cappatex-design-profiles.ts");
const { preparationSummary } = await import("../app/cappatex-preparation.ts");
const { printRaster } = await import("../app/cappatex-print-raster.ts");
const CPP = "CPP-" + "a".repeat(32), OTHER = "CPP-" + "b".repeat(32), FRONT = "CPX-AAAAAAAAAAAA", BACK = "CPX-BBBBBBBBBBBB";
after(closeHarness);

function fixture({ id = CPP, sides = ["front"], checkout = false } = {}) {
  const profile = CAPPATEX_DESIGN_PROFILES.find(item => item.id === "bc-king-hoodie-opt-front"), base = structuredClone(profile.variants[0]);
  const back = structuredClone(profile.backVariants.find(item => item.shopifyVariantId === base.shopifyVariantId));
  const variant = { ...base, available: true, title: "Synthetic blank", price: null, back: { area: back.area, mockup: back.mockup } };
  const artwork = { width: 2048, height: 1536 }, placement = { x: .45, y: .5, scale: .2 };
  const saved = { schemaVersion: 2, rendererVersion: "rgba-area-v1", id, createdAt: Date.parse("2026-10-20T12:00:00Z"),
    profileId: profile.id, profileVersion: profile.version, name: profile.name, shopId: profile.shopId,
    printifyProductId: profile.printifyProductId, blueprintId: profile.blueprintId, providerId: profile.providerId,
    variant: Object.fromEntries(["shopifyVariantId", "printifyVariantId", "sku", "color", "size"].map(key => [key, variant[key]])), quantity: 2, country: "CH",
    sides: sides.map(position => {
      const current = position === "front" ? variant : back, raster = printRaster(current.area, artwork, placement);
      return { position, designId: position === "front" ? FRONT : BACK, source: "upload", artwork: { ...artwork, key: "offline/original.png", sha256: "a".repeat(64) },
        area: current.area, mockup: current.mockup, placement: { ...placement }, raster: { left: raster.left, top: raster.top, width: raster.width, height: raster.height },
        dpi: raster.dpi, file: { key: `offline/${position}.png`, width: current.area.widthPx, height: current.area.heightPx, sha256: "c".repeat(64) } };
    }) };
  const receipt = preparationSummary(saved, false, checkout ? { enabled: true, reason: "Synthetic offline release", unitPriceCents: 1234, currency: "CHF" }
    : { enabled: false, reason: "Offline: no sale, checkout or production release" });
  const selections = receipt.sides.map(side => ({ position: side.position, designId: side.designId, placement: side.placement,
    artwork: side.artwork, area: side.area, mockup: side.mockup }));
  const draft = { selections, working: Object.fromEntries(selections.map(selection => [selection.position, { designId: selection.designId, placement: selection.placement }])),
    requestId: "", pendingSignature: null, savedSignature: null };
  const product = { id: profile.id, profileVersion: profile.version, name: profile.name, kind: profile.kind, purchaseReady: false, blockedReason: "Offline", variants: [variant] };
  return { receipt, props: { product, variant, side: "front", designId: FRONT, artwork, placement, ready: true, quantity: 2, country: "CH" }, draft,
    drafts: [], persisted: [], saving: [] };
}
function PanelHarness({ state }) {
  const [draft, setDraft] = useState(state.draft);
  useEffect(() => { state.drafts.push(draft); }, [draft, state]);
  return React.createElement(PreparationPanel, { ...state.props, draft, onDraftChange: setDraft,
    onPersist: value => state.persisted.push(structuredClone(value)), onSaving: value => state.saving.push(value) });
}
const latest = state => state.drafts.at(-1);
async function save(ui) { await ui.click(ui.button("Druckseiten & Dateien speichern")); }
async function proof(ui, receipt) {
  for (const side of receipt.sides) {
    const name = side.position === "front" ? "Vorderseite" : "Rückseite";
    await ui.image(ui.container.querySelector(`[alt="Blanko-Produkt – ${name}"]`), side.mockup.width, side.mockup.height);
    await ui.image(ui.container.querySelector(`[alt="Gespeicherte Druckdatei für die ${name}"]`), side.printPreview.width, side.printPreview.height);
  }
}

test("actual preparation panel treats an unreadable 200 as uncertain, keeps every captured side and retries the same ID", async () => {
  const state = fixture({ sides: ["front", "back"] }), calls = [];
  const ui = await mount(PanelHarness, { state }, { fetch: async (url, init) => {
    assert.equal(url, "/api/cappatex/preparations"); assert.equal(init.method, "POST"); calls.push(JSON.parse(init.body));
    return calls.length === 1 ? new Response("<html>private provider trace</html>", { status: 200 }) : json(state.receipt, 201);
  } });
  try {
    await save(ui); assert.match(ui.text(), /Speicherantwort ist nicht lesbar.*Speicherstatus bleibt unklar/);
    assert.doesNotMatch(ui.text(), /private provider|Unexpected token|unveränderlich gespeichert/);
    assert.equal(latest(state).receipt, undefined); assert.equal(latest(state).savedSignature, null); assert.equal(latest(state).selections.length, 2);
    await save(ui); assert.equal(calls.length, 2); assert.deepEqual(calls[1], calls[0]);
    assert.deepEqual(calls[0].sides.map(side => side.position), ["front", "back"]);
    assert.equal(latest(state).receipt.id, CPP); assert.match(ui.text(), /Alle ausgewählten Druckseiten sind unveränderlich gespeichert/);
    assert.equal(ui.button("Druckseiten & Dateien speichern").disabled, true); assert.equal(ui.redirects.length, 0);
  } finally { await ui.close(); }
});

test("actual preparation panel rejects a valid-shaped confirmation for a different composition without retiring its request", async () => {
  const state = fixture(), requests = [], different = structuredClone(state.receipt); different.quantity = 3;
  const ui = await mount(PanelHarness, { state }, { fetch: async (_url, init) => { requests.push(JSON.parse(init.body)); return json(requests.length === 1 ? different : state.receipt); } });
  try {
    await save(ui); assert.match(ui.text(), /Speicherbestätigung passt nicht zu deiner Auswahl/);
    assert.equal(latest(state).receipt, undefined); assert.equal(latest(state).selections.length, 1); assert.equal(latest(state).savedSignature, null);
    await save(ui); assert.deepEqual(requests[0], requests[1]); assert.equal(latest(state).receipt.quantity, 2);
  } finally { await ui.close(); }
});

test("actual preparation panel never promotes 202 or an unexpected success status and only retires explicitly failed reservations", async () => {
  const state = fixture(), requests = [];
  const answers = [json(state.receipt, 202), json({ code: "failed", error: "Ambiguous upstream failure" }, 503), json(state.receipt, 206),
    json({ code: "failed", error: "Confirmed failed reservation" }, 409), json(state.receipt)];
  const ui = await mount(PanelHarness, { state }, { fetch: async (_url, init) => { requests.push(JSON.parse(init.body)); return answers.shift(); } });
  try {
    for (let attempt = 0; attempt < 4; attempt++) { await save(ui); assert.equal(latest(state).receipt, undefined); assert.equal(latest(state).savedSignature, null); }
    assert.equal(new Set(requests.map(request => request.requestId)).size, 1, "202/503/unexpected2xx cannot retire an uncertain request");
    assert.equal(latest(state).requestId, ""); await save(ui);
    assert.notEqual(requests[4].requestId, requests[0].requestId); assert.equal(latest(state).receipt.id, CPP);
  } finally { await ui.close(); }
});

test("actual preparation panel explains a lost connection in German without leaking raw errors or losing the captured composition", async () => {
  const state = fixture(), requests = [];
  const ui = await mount(PanelHarness, { state }, { fetch: async (_url, init) => {
    requests.push(JSON.parse(init.body)); if (requests.length === 1) throw new TypeError("fetch failed: hidden private/model.png"); return json(state.receipt);
  } });
  try {
    await save(ui); assert.match(ui.text(), /Verbindung ist unterbrochen.*Speicherstatus bleibt unklar/);
    assert.doesNotMatch(ui.text(), /private\/model|fetch failed/); assert.equal(latest(state).selections.length, 1);
    await save(ui); assert.deepEqual(requests[0], requests[1]); assert.equal(latest(state).receipt.id, CPP);
  } finally { await ui.close(); }
});

test("actual saved review does not display a valid-looking 202 receipt as ready and retries through GET only", async () => {
  const state = fixture({ checkout: true }), calls = [];
  const ui = await mount(PreparedReview, { id: CPP }, { fetch: async (url, init) => {
    calls.push([url, init?.method || "GET"]); assert.equal(url, `/api/cappatex/preparations/${CPP}`);
    return json(state.receipt, calls.length === 1 ? 202 : 200);
  } });
  try {
    await until(() => assert.match(ui.text(), /gespeicherte Stand ist noch nicht bestätigt/));
    assert.equal(ui.button("Weiter zu Shopify"), undefined); assert.doesNotMatch(ui.text(), /Bestellung vorbereiten/);
    await ui.click(ui.button("Stand erneut prüfen")); await until(() => assert.ok(ui.button("Weiter zu Shopify")));
    assert.equal(ui.button("Weiter zu Shopify").disabled, true, "A successful GET alone never confirms preview or terms");
    assert.ok(calls.every(([, method]) => method === "GET")); assert.equal(ui.redirects.length, 0);
  } finally { await ui.close(); }
});

test("actual review ignores a late receipt from the previous ID and never accepts a malformed current GET", async () => {
  const old = deferred(), calls = []; let currentReads = 0;
  const ui = await mount(PreparedReview, { id: CPP }, { fetch: async (url, init) => {
    calls.push([url, init?.method || "GET"]); return url.endsWith(CPP) ? old.promise : ++currentReads === 1
      ? json({ id: OTHER, checkout: { enabled: true } }) : new Response("<html>private trace</html>", { status: 200 });
  } });
  try {
    await ui.render({ id: OTHER }); await until(() => assert.match(ui.text(), /Gestaltungsstand konnte nicht sicher geladen werden/));
    await import("react").then(({ act }) => act(async () => old.resolve(json(fixture({ checkout: true }).receipt))));
    assert.equal(ui.button("Weiter zu Shopify"), undefined); assert.doesNotMatch(ui.text(), /Gespeicherter Stand/);
    await ui.click(ui.button("Stand erneut prüfen")); await until(() => assert.match(ui.text(), /Antwort konnte nicht sicher gelesen werden/));
    assert.doesNotMatch(ui.text(), /Unexpected token|private trace/); assert.equal(ui.button("Weiter zu Shopify"), undefined);
    assert.ok(calls.every(([, method]) => method === "GET")); assert.equal(ui.redirects.length, 0);
  } finally { old.resolve(json(fixture().receipt)); await ui.close(); }
});

test("actual saved review requires both print previews and never redirects on an unconfirmed 202 checkout response", async () => {
  const state = fixture({ checkout: true, sides: ["front", "back"] }), calls = [];
  const ui = await mount(PreparedReview, { id: CPP }, { fetch: async (url, init) => {
    calls.push([url, init?.method || "GET"]);
    if (url === `/api/cappatex/preparations/${CPP}`) return json(state.receipt);
    assert.equal(url, "/api/cappatex/checkout"); assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), { preparationId: CPP, termsAccepted: true });
    return json({ checkoutUrl: "https://fixture-shop.myshopify.com/checkouts/unconfirmed" }, 202);
  } });
  try {
    await until(() => assert.ok(ui.button("Weiter zu Shopify")));
    await proof(ui, { sides: state.receipt.sides.slice(0, 1) });
    assert.equal(ui.container.querySelector('input[type="checkbox"]').disabled, true, "The back print preview must also load before confirmation");
    await proof(ui, { sides: state.receipt.sides.slice(1) });
    await ui.check(ui.container.querySelector('input[type="checkbox"]')); await ui.click(ui.button("Weiter zu Shopify"));
    assert.match(ui.text(), /Shopify-Checkout ist noch nicht bestätigt/); assert.equal(ui.redirects.length, 0);
    assert.equal(calls.filter(([, method]) => method === "POST").length, 1);
  } finally { await ui.close(); }
});

test("actual saved review ignores an old checkout response after switching to a different saved design", async () => {
  const old = fixture({ checkout: true }), current = fixture({ id: OTHER, checkout: true }), pending = deferred(), calls = [];
  const ui = await mount(PreparedReview, { id: CPP }, { fetch: async (url, init) => {
    calls.push([url, init?.method || "GET"]);
    if (url === `/api/cappatex/preparations/${CPP}`) return json(old.receipt);
    if (url === `/api/cappatex/preparations/${OTHER}`) return json(current.receipt);
    assert.equal(url, "/api/cappatex/checkout"); assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), { preparationId: CPP, termsAccepted: true });
    // A provider can still settle after cancellation; the component must also
    // verify that its submitted context remains active before using the reply.
    return pending.promise;
  } });
  try {
    await until(() => assert.ok(ui.button("Weiter zu Shopify")));
    await proof(ui, old.receipt);
    await ui.check(ui.container.querySelector('input[type="checkbox"]'));
    await ui.click(ui.button("Weiter zu Shopify"));
    assert.equal(ui.button("Weiter zu Shopify").disabled, true);
    await ui.render({ id: OTHER });
    await until(() => assert.ok(ui.container.querySelector(`a[href="/cappatex/vorbereitung/${OTHER}"]`)));
    await import("react").then(({ act }) => act(async () => pending.resolve(json({ checkoutUrl: "https://fixture-shop.myshopify.com/checkouts/old" }))));
    assert.equal(ui.redirects.length, 0, "the previous saved design must never redirect the new view");
    assert.equal(ui.container.querySelector('[role="alert"]'), null, "an aborted old checkout must not attach an error to the new saved design");
    assert.equal(ui.container.querySelector('input[type="checkbox"]').checked, false);
    assert.equal(ui.button("Weiter zu Shopify").disabled, true, "the new saved design needs its own loaded proof and fresh acceptance");
    assert.equal(calls.filter(([, method]) => method === "POST").length, 1);
  } finally { pending.resolve(json({ checkoutUrl: "https://fixture-shop.myshopify.com/checkouts/old" })); await ui.close(); }
});
