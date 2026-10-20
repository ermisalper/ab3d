import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeHarness, deferred, json, MemoryStorage, mount, until } from "./helpers/component-dom.mjs";

const { default: TokenShop } = await import("../app/konto/token-shop.tsx");
const { TOKEN_PACKS } = await import("../app/token-packs.ts");
const { default: Operations } = await import("../app/betrieb/operations.tsx");
const { reviewDraft, serializeReviewDrafts } = await import("../app/betrieb/draft-storage.ts");
const { default: CappatexDesigner } = await import("../app/cappatex/cappatex-designer.tsx");
const { CAPPATEX_DESIGN_PROFILES } = await import("../app/cappatex-design-profiles.ts");
const { default: PreparationPreview } = await import("../app/cappatex-preparation-preview.tsx");
const { emptyProductionOffer, calculateProductionOffer, productionOfferSheet } = await import("../app/production-offer.ts");
const { default: CappatexOperations } = await import("../app/cappatex/betrieb/operations.tsx");
const owner = "operator@example.test";
const packId = "tokens-5";
const enabledCatalog = () => ({ enabled: true, message: "Synthetic catalogue", packs: [{ ...TOKEN_PACKS[0], available: true }], purchases: [] });
const pendingSelection = { packId, country: "CH", requestId: "c6560f12-47b3-46d9-bb96-e1f0493570aa" };
async function checkoutKey(email = owner) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.trim().toLowerCase()));
  return `ab3d-token-checkout-v1:${Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("")}`;
}
async function choosePack(ui) {
  await until(() => assert.ok(ui.button("Paket auswählen")));
  await ui.click(ui.button("Paket auswählen"));
  await ui.check(ui.container.querySelector('input[type="checkbox"]'));
  assert.equal(ui.button(/Weiter zur Zahlung/).disabled, false);
}
after(closeHarness);

test("actual token shop retries a failed catalogue GET without starting a checkout", async () => {
  const calls = []; let reads = 0, balances = 0;
  const ui = await mount(TokenShop, { email: owner, onRefreshBalance: async () => { balances++; } }, { fetch: async (url, init) => {
    calls.push([url, init?.method || "GET"]);
    assert.equal(url, "/api/token-purchases");
    return ++reads === 1 ? json({ error: "offline" }, 503) : json(enabledCatalog());
  } });
  try {
    await until(() => assert.match(ui.text(), /Tokenpakete können gerade nicht geladen werden/));
    await ui.click(ui.button("Kaufstatus & Guthaben aktualisieren"));
    assert.equal(balances, 1);
    assert.equal(ui.button("Paket auswählen").disabled, false);
    assert.deepEqual(calls, [["/api/token-purchases", "GET"], ["/api/token-purchases", "GET"]]);
    assert.equal(ui.storage.values.size, 0);
  } finally { await ui.close(); }
});

// Reuse registered/calibrated photo geometry without loading any image or
// contacting Printify. Motifs, account responses and all provider reads are fake.
function designProducts() {
  return CAPPATEX_DESIGN_PROFILES.filter(profile => ["gildan-64000-opt-front", "bc-king-hoodie-opt-front"].includes(profile.id)).map(profile => ({
    id: profile.id, name: profile.name, kind: profile.kind, profileVersion: profile.version, purchaseReady: false, blockedReason: "Offline test; no sales approval",
    variants: profile.variants.map(variant => {
      const back = profile.backVariants?.find(item => item.shopifyVariantId === variant.shopifyVariantId);
      return { ...structuredClone(variant), available: true, price: null, title: `${variant.color} / ${variant.size}`,
        ...(back ? { back: { area: structuredClone(back.area), mockup: structuredClone(back.mockup) } } : {}) };
    }),
  }));
}
const motifId = "CPX-AAAAAAAAAAAA";
const motif = { designId: motifId, width: 2048, height: 3072, previewWidth: 512, previewHeight: 768,
  previewUrl: `/api/cappatex/artwork/${motifId}`, source: "upload", canDownloadOriginal: false };
const studioAccount = () => ({ account: { email: owner, cappatexGeneration: { enabled: true, pilotOwner: true }, cappatexUpload: { enabled: true }, capabilities: { canDownloadHd: false } } });
function studioFixture(products = designProducts()) {
  const calls = [];
  const product = products[0], variant = product.variants[0];
  return { products, product, variant, calls,
    url: `https://ab3d.example.test/cappatex?designId=${motifId}&profileId=${product.id}&variantId=${encodeURIComponent(variant.shopifyVariantId)}#studio`,
    fetch: async (url, init) => {
      calls.push([url, init?.method || "GET"]); assert.equal(init?.method || "GET", "GET", "mount/navigation must never generate or order");
      if (url === "/api/cappatex/catalog") return json({ products, message: "Offline verified geometry" });
      if (url === "/api/account") return json(studioAccount());
      assert.equal(url, `/api/cappatex/designs/${motifId}`); return json(motif);
    },
  };
}

test("actual CAPPATEX guided component keeps front/back selections through stage and product navigation", async () => {
  const fixture = studioFixture(), ui = await mount(CappatexDesigner, {}, fixture);
  try {
    await until(() => assert.equal(ui.container.querySelector("#studio").getAttribute("data-stage"), "2"));
    await until(() => assert.ok(ui.container.querySelector(".cappatex-blank-image")));
    await ui.image(ui.container.querySelector(".cappatex-blank-image"), fixture.variant.mockup.width, fixture.variant.mockup.height);
    await ui.image(ui.container.querySelector('[alt="Dein unverändertes Motiv in der Druckfläche"]'), 512, 768);
    assert.equal(ui.button("Vorderseite übernehmen").disabled, false);
    await ui.click(ui.button("Vorderseite übernehmen"));
    assert.equal(ui.container.querySelector('.cappatex-side-status li[data-state="captured"] b').textContent, "Vorderseite");
    await ui.click(ui.button("Rückseite"));
    assert.equal(ui.button("Rückseite").getAttribute("aria-pressed"), "true");
    await ui.image(ui.container.querySelector(".cappatex-blank-image"), fixture.variant.back.mockup.width, fixture.variant.back.mockup.height);
    await ui.image(ui.container.querySelector('[alt="Dein unverändertes Motiv in der Druckfläche"]'), 512, 768);
    await ui.click(ui.button("Rückseite übernehmen"));
    assert.equal(ui.container.querySelectorAll('.cappatex-side-status li[data-state="captured"]').length, 2);
    await ui.click(ui.button("Druckseiten prüfen →"));
    assert.equal(ui.container.querySelector("#studio").getAttribute("data-stage"), "3");
    assert.equal(ui.container.querySelector("#cappatex-save").hidden, false);
    await ui.click(ui.button("Produkt ändern"));
    assert.equal(ui.container.querySelector("#studio").getAttribute("data-stage"), "2");
    await ui.click(ui.container.querySelectorAll(".cappatex-product-card")[1]);
    assert.equal(ui.container.querySelectorAll('.cappatex-side-status li[data-state="captured"]').length, 0, "a different product requires fresh captures");
    await ui.click(ui.container.querySelectorAll(".cappatex-product-card")[0]);
    assert.equal(ui.container.querySelectorAll('.cappatex-side-status li[data-state="captured"]').length, 2, "returning restores this product's two independent captures");
    assert.equal(ui.button("Vorderseite").getAttribute("aria-pressed"), "true");
    assert.equal(fixture.calls.every(([, method]) => method === "GET"), true);
  } finally { await ui.close(); }
});

test("actual CAPPATEX component blocks side capture when motif image dimensions are corrupt", async () => {
  const fixture = studioFixture(), ui = await mount(CappatexDesigner, {}, fixture);
  try {
    await until(() => assert.ok(ui.container.querySelector(".cappatex-blank-image")));
    await ui.image(ui.container.querySelector(".cappatex-blank-image"), fixture.variant.mockup.width, fixture.variant.mockup.height);
    await ui.image(ui.container.querySelector('[alt="Dein unverändertes Motiv in der Druckfläche"]'), 511, 768);
    assert.match(ui.text(), /Die Motivdatei stimmt nicht mit der Druckdatei überein/);
    assert.equal(ui.button("Vorderseite übernehmen").disabled, true);
    assert.equal(ui.container.querySelectorAll('.cappatex-side-status li[data-state="captured"]').length, 0);
    await ui.image(ui.container.querySelector('[alt="Dein unverändertes Motiv in der Druckfläche"]'), 512, 768);
    assert.equal(ui.button("Vorderseite übernehmen").disabled, false);
    assert.doesNotMatch(ui.text(), /Die Motivdatei stimmt nicht mit der Druckdatei überein/, "a confirmed reload must clear only its obsolete image error");
    assert.equal(fixture.calls.length, 3);
  } finally { await ui.close(); }
});

test("actual CAPPATEX preview clears a recovered photo error without clearing a separate motif error", async () => {
  const fixture = studioFixture(), ui = await mount(CappatexDesigner, {}, fixture);
  try {
    await until(() => assert.ok(ui.container.querySelector(".cappatex-blank-image")));
    const image = ui.container.querySelector('[alt="Dein unverändertes Motiv in der Druckfläche"]');
    await ui.image(ui.container.querySelector(".cappatex-blank-image"), 1, 1);
    await ui.image(image, 512, 768);
    assert.match(ui.text(), /Produktansicht stimmt nicht mit der geprüften Vorlage überein/);
    assert.equal(ui.button("Vorderseite übernehmen").disabled, true);
    await ui.image(ui.container.querySelector(".cappatex-blank-image"), fixture.variant.mockup.width, fixture.variant.mockup.height);
    assert.doesNotMatch(ui.text(), /Produktansicht stimmt nicht mit der geprüften Vorlage überein/);
    await ui.image(image, 0, 0, "error");
    await ui.image(ui.container.querySelector(".cappatex-blank-image"), fixture.variant.mockup.width, fixture.variant.mockup.height);
    assert.match(ui.text(), /Das Motiv konnte nicht geladen werden/);
    assert.equal(ui.button("Vorderseite übernehmen").disabled, true);
  } finally { await ui.close(); }
});

test("actual CAPPATEX preparation retries an uncertain save with one UUID after remount and ignores a double click", async () => {
  const fixture = studioFixture(), posts = [], outstanding = deferred(), storage = new MemoryStorage();
  const fetch = async (url, init) => {
    if (url !== "/api/cappatex/preparations") return fixture.fetch(url, init);
    assert.equal(init?.method, "POST"); posts.push(JSON.parse(init.body));
    return posts.length === 1 ? outstanding.promise : json({ error: "Prüfung noch offen" }, 202);
  };
  let ui = await mount(CappatexDesigner, {}, { ...fixture, storage, fetch });
  try {
    await until(() => assert.ok(ui.container.querySelector(".cappatex-blank-image")));
    await ui.image(ui.container.querySelector(".cappatex-blank-image"), fixture.variant.mockup.width, fixture.variant.mockup.height);
    await ui.image(ui.container.querySelector('[alt="Dein unverändertes Motiv in der Druckfläche"]'), 512, 768);
    await ui.click(ui.button("Vorderseite übernehmen"));
    await ui.click(ui.button("Druckseiten prüfen →"));
    await ui.click(ui.button("Druckseiten & Dateien speichern"));
    assert.equal(posts.length, 1);
    const pendingButton = ui.button("Dateien werden vorbereitet …");
    assert.equal(pendingButton.disabled, true); await ui.click(pendingButton);
    assert.equal(posts.length, 1);
    await import("react").then(({ act }) => act(async () => outstanding.resolve(json({ error: "Prüfung noch offen" }, 202))));
    await until(() => assert.match(ui.text(), /Prüfung noch offen/));
    const requestId = posts[0].requestId;
    assert.match(requestId, /^[a-f0-9-]{36}$/);
    assert.ok([...storage.values.values()].some(value => value.includes(requestId)));
    await ui.close();
    ui = await mount(CappatexDesigner, {}, { ...fixture, storage, fetch });
    await until(() => assert.match(ui.text(), /Tab-Entwurf wurde nach erneuter Konto- und Profilprüfung wiederhergestellt/));
    await ui.click(ui.button("Druckseiten prüfen →"));
    await ui.click(ui.button("Druckseiten & Dateien speichern"));
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[1], posts[0]);
    assert.deepEqual(posts[0].sides.map(side => side.position), ["front"]);
    assert.equal(fixture.calls.every(([, method]) => method === "GET"), true);
  } finally { outstanding.resolve(json({ error: "Prüfung noch offen" }, 202)); await ui.close(); }
});

test("actual saved print-file preview requires confirmed image dimensions, revokes readiness on error and retries safely", async () => {
  const { variant } = studioFixture(), states = [];
  const selection = { position: "front", designId: motifId, placement: { x: .5, y: .5, scale: .5 }, artwork: { width: 2048, height: 3072 }, area: variant.area, mockup: variant.mockup };
  const printPreview = { url: `/api/cappatex/preparations/CPP-${"a".repeat(32)}?preview=front`, width: 448, height: 512, sha256: "a".repeat(64) };
  const ui = await mount(PreparationPreview, { selection, printPreview, onReadyChange: (_identity, ready) => states.push(ready) });
  try {
    const photo = () => ui.container.querySelector('[alt="Blanko-Produkt – Vorderseite"]');
    const proof = () => ui.container.querySelector('[alt="Gespeicherte Druckdatei für die Vorderseite"]');
    assert.equal(states.at(-1), false);
    await ui.image(photo(), variant.mockup.width, variant.mockup.height);
    await ui.image(proof(), 448, 511);
    assert.equal(states.at(-1), false); assert.match(ui.text(), /Bildmasse/);
    await ui.click(ui.button("Vorderseite erneut laden"));
    await ui.image(photo(), variant.mockup.width, variant.mockup.height);
    await ui.image(proof(), 448, 512);
    assert.equal(states.at(-1), true);
    await ui.image(proof(), 0, 0, "error");
    assert.equal(states.at(-1), false);
    assert.match(ui.text(), /Produktfoto oder Motiv ist gerade nicht verfügbar/);
    await ui.render({ selection, printPreview: { ...printPreview, url: printPreview.url.replace("front", "back") }, onReadyChange: (_identity, ready) => states.push(ready) });
    assert.equal(states.at(-1), false);
    assert.match(ui.text(), /Ansicht der gespeicherten Druckdatei konnte nicht bestätigt werden/);
    assert.equal(ui.container.querySelectorAll(`img[src="/api/cappatex/artwork/${motifId}"]`).length, 0, "a corrupt proof cannot fall back to a different print source");
  } finally { await ui.close(); }
});

test("actual CAPPATEX catalogue outage leaves permitted motif tools readable and causes no automatic writes", async () => {
  const calls = [], ui = await mount(CappatexDesigner, {}, { fetch: async (url, init) => {
    calls.push([url, init?.method || "GET"]);
    if (url === "/api/account") return json(studioAccount());
    assert.equal(url, "/api/cappatex/catalog"); throw new TypeError("Synthetic offline catalogue");
  } });
  try {
    await until(() => assert.match(ui.text(), /Produktkatalog konnte nicht bestätigt werden/));
    assert.equal(ui.button("Mit KI gestalten").disabled, false);
    assert.equal(ui.button("Eigenes Bild verwenden").disabled, false);
    assert.equal(ui.container.querySelector(".cappatex-generate").disabled, true, "no implicit cost confirmation");
    assert.equal(ui.button(/Prüfen/).disabled, true);
    assert.equal(ui.container.querySelectorAll(".cappatex-product-card").length, 0);
    assert.deepEqual(calls.map(([, method]) => method), ["GET", "GET"]);
  } finally { await ui.close(); }
});

test("actual CAPPATEX component does not silently substitute an unavailable size on a colour change", async () => {
  const products = designProducts().filter(product => product.id === "bc-king-hoodie-opt-front");
  const fixture = studioFixture(products), navy = fixture.product.variants.find(variant => variant.color === "Navy" && variant.size === "4XL");
  fixture.url = fixture.url.replace(encodeURIComponent(fixture.variant.shopifyVariantId), encodeURIComponent(navy.shopifyVariantId));
  const ui = await mount(CappatexDesigner, {}, fixture);
  try {
    await until(() => assert.equal(ui.container.querySelectorAll(".cappatex-variant-fields select")[0]?.value, "Navy"));
    await ui.change(ui.container.querySelectorAll(".cappatex-variant-fields select")[0], "White");
    assert.equal(ui.container.querySelectorAll(".cappatex-variant-fields select")[0].value, "Navy");
    assert.equal(ui.container.querySelectorAll(".cappatex-variant-fields select")[1].value, navy.shopifyVariantId);
    assert.match(ui.text(), /White ist in 4XL nicht verfügbar/);
    await ui.click(ui.button("White · 2XL"));
    assert.equal(ui.container.querySelectorAll(".cappatex-variant-fields select")[0].value, "White");
    assert.equal(ui.container.querySelectorAll(".cappatex-variant-fields select")[1].selectedOptions?.[0]?.textContent
      || ui.container.querySelectorAll(".cappatex-variant-fields select")[1].querySelector("option[selected]").textContent, "2XL");
    assert.equal(fixture.calls.length, 3);
  } finally { await ui.close(); }
});

test("actual CAPPATEX component preserves a corrupt local draft until explicit confirmed discard", async () => {
  const fixture = studioFixture(), storage = new MemoryStorage();
  const { accountDraftKey } = await import("../app/cappatex-recovery.ts");
  const key = await accountDraftKey(owner), corrupt = '{"private-draft":"synthetic-invalid"}';
  storage.setItem(key, corrupt);
  const ui = await mount(CappatexDesigner, {}, { ...fixture, storage });
  try {
    await until(() => assert.match(ui.text(), /lokale Tab-Entwurf ist beschädigt/));
    assert.equal(storage.getItem(key), corrupt);
    assert.equal(ui.button(/Prüfen/).disabled, true);
    await ui.click(ui.button("Nur lokalen Tab-Entwurf verwerfen"));
    assert.equal(storage.getItem(key), corrupt);
    await ui.click(ui.button("Abbrechen und Entwurf behalten"));
    assert.equal(storage.getItem(key), corrupt);
    await ui.click(ui.button("Nur lokalen Tab-Entwurf verwerfen"));
    await ui.click(ui.button("Ja, nur lokalen Tab-Entwurf verwerfen"));
    await until(() => assert.equal(storage.getItem(key), null));
    assert.equal(ui.history.at(-1), "reload");
    assert.equal(fixture.calls.every(([, method]) => method === "GET"), true);
  } finally { await ui.close(); }
});

test("actual CAPPATEX component keeps a missing URL variant blocked until a fresh explicit selection", async () => {
  const fixture = studioFixture(); fixture.url = fixture.url.replace(encodeURIComponent(fixture.variant.shopifyVariantId), "gid%3A%2F%2Fshopify%2FProductVariant%2F999999999");
  const ui = await mount(CappatexDesigner, {}, fixture);
  try {
    await until(() => assert.match(ui.text(), /gespeicherte Produktvariante ist nicht mehr verfügbar/));
    assert.equal(ui.container.querySelectorAll(".cappatex-variant-fields").length, 0);
    assert.equal(ui.button(/Prüfen/).disabled, true);
    await ui.click(ui.container.querySelector(".cappatex-product-card"));
    assert.equal(ui.container.querySelectorAll(".cappatex-variant-fields").length, 1);
    assert.equal(ui.button(/Prüfen/).disabled, false);
  } finally { await ui.close(); }
});

const inquiryId = "PRINT-ABCDE00001";
const inquiry = () => ({ id: inquiryId, email: "customer@example.test", status: "inquiry", sourceTaskId: "synthetic-task",
  sourceTaskType: "text-to-3d", sourceTaskStatus: "SUCCEEDED", templateName: "Synthetic model", heightMm: 120, material: "PLA", finish: "Natur", quantity: 2,
  estimatedTotalCents: 8000, currency: "CHF", createdAt: 1, updatedAt: 1, review: { state: "new", version: 0, updatedAt: null, notes: "", updatedBy: null } });
const detail = order => ({ order: { ...order, requestDetails: null, events: [] }, files: { glb: null, stl: null, threeMf: null }, inspectionNotice: "Interne Prüfung" });
const blankOffer = () => {
  const payload = emptyProductionOffer();
  return { orderId: inquiryId, version: 0, payload, calculation: calculateProductionOffer(payload), sheet: productionOfferSheet(inquiryId, payload), updatedAt: null, updatedBy: null, events: [] };
};
async function reviewKey() { return (await checkoutKey()).replace("ab3d-token-checkout-v1:", "ab3d-review-drafts-v1:"); }
async function selectInquiry(ui) {
  await until(() => assert.ok(ui.button(new RegExp(inquiryId))));
  await ui.click(ui.button(new RegExp(inquiryId)));
  await until(() => assert.ok(ui.container.querySelector("#ab3d-review-notes")));
}

test("actual AB3D operations restores unsaved notes on remount without a PATCH", async () => {
  const storage = new MemoryStorage(), order = inquiry(), key = await reviewKey(), methods = [];
  storage.setItem(key, serializeReviewDrafts({ [inquiryId]: { ...reviewDraft(order.review), notes: "Wandstärke nachprüfen" } }));
  const fetch = async (url, init) => {
    methods.push(init?.method || "GET");
    if (url.startsWith("/api/ab3d/operations?")) return json({ orders: [order], nextCursor: null });
    if (url.endsWith("/offer")) return json(blankOffer());
    assert.equal(url, `/api/ab3d/operations/${inquiryId}`); return json(detail(order));
  };
  let ui = await mount(Operations, { ownerEmail: owner }, { storage, fetch });
  try {
    await until(() => assert.match(ui.text(), /Ungespeicherte Prüfnotizen aus diesem Tab wiederhergestellt/));
    // The recovery shortcut is a real button in addition to the list item.
    await ui.click(ui.button(`${inquiryId} öffnen`));
    await until(() => assert.ok(ui.container.querySelector("#ab3d-review-notes")));
    assert.equal(ui.container.querySelector("#ab3d-review-notes")?.value, "Wandstärke nachprüfen");
    await ui.change(ui.container.querySelector("#ab3d-review-notes"), "Neu ergänzte Prüfnotiz");
    assert.match(storage.getItem(key), /Neu ergänzte Prüfnotiz/);
    await ui.close();
    ui = await mount(Operations, { ownerEmail: owner }, { storage, fetch });
    await until(() => assert.ok(ui.button(`${inquiryId} öffnen`)));
    await ui.click(ui.button(`${inquiryId} öffnen`));
    await until(() => assert.equal(ui.container.querySelector("#ab3d-review-notes")?.value, "Neu ergänzte Prüfnotiz"));
    assert.equal(methods.every(method => method === "GET"), true);
  } finally { await ui.close(); }
});

test("actual AB3D operations blocks note editing when storage is denied but keeps inquiry data readable", async () => {
  const order = inquiry(), storage = new MemoryStorage(); storage.blocked = true;
  const ui = await mount(Operations, { ownerEmail: owner }, { storage, fetch: async (url, init) => {
    assert.equal(init?.method || "GET", "GET");
    return json(url.includes("?") ? { orders: [order], nextCursor: null } : url.endsWith("/offer") ? blankOffer() : detail(order));
  } });
  try {
    await selectInquiry(ui);
    await until(() => assert.match(ui.text(), /Die Bearbeitung bleibt gesperrt/));
    assert.equal(ui.container.querySelector("#ab3d-review-notes").disabled, true);
    assert.equal(ui.container.querySelector("#ab3d-review-state").disabled, true);
    assert.match(ui.text(), /customer@example\.test/);
  } finally { await ui.close(); }
});

test("actual AB3D operations retains notes after a concurrent review change and requires explicit adoption", async () => {
  let order = inquiry(); const patches = [];
  const ui = await mount(Operations, { ownerEmail: owner }, { fetch: async (url, init) => {
    if (init?.method === "PATCH") {
      patches.push(JSON.parse(init.body));
      order = { ...order, review: { state: "reviewing", version: 1, notes: "Anderer gespeicherter Stand", updatedAt: 2, updatedBy: owner } };
      return json({ code: "review_conflict" }, 409);
    }
    return json(url.includes("?") ? { orders: [order], nextCursor: null } : url.endsWith("/offer") ? blankOffer() : detail(order));
  } });
  try {
    await selectInquiry(ui);
    await until(() => assert.equal(ui.container.querySelector("#ab3d-review-notes").disabled, false));
    await ui.change(ui.container.querySelector("#ab3d-review-notes"), "Meine ungespeicherte Eingabe");
    const form = ui.container.querySelector(".ab3d-ops-review");
    await import("react").then(({ act }) => act(async () => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))));
    await until(() => assert.match(ui.text(), /Ein anderer Stand wurde gespeichert/));
    assert.equal(ui.container.querySelector("#ab3d-review-notes").value, "Meine ungespeicherte Eingabe");
    assert.equal(ui.button("Prüfung speichern").disabled, true);
    assert.deepEqual(patches, [{ state: "new", notes: "Meine ungespeicherte Eingabe", version: 0 }]);
    await ui.click(ui.button("Meine Eingabe verwerfen und Stand übernehmen"));
    assert.equal(ui.container.querySelector("#ab3d-review-notes").value, "Anderer gespeicherter Stand");
    assert.equal(ui.button("Prüfung speichern").disabled, true);
  } finally { await ui.close(); }
});

test("actual token shop keeps one saved request after not_ready and a remount; only matching credit clears it", async () => {
  const storage = new MemoryStorage(), key = await checkoutKey(); storage.setItem(key, JSON.stringify(pendingSelection));
  let catalog = enabledCatalog(); const posts = [];
  const fetch = async (url, init) => {
    if (url === "/api/token-purchases") return json(catalog);
    assert.equal(url, "/api/token-purchases/checkout"); posts.push(JSON.parse(init.body));
    return json({ code: "not_ready", error: "Freigabe gerade geschlossen" }, 503);
  };
  let ui = await mount(TokenShop, { email: owner, onRefreshBalance: async () => {} }, { storage, fetch });
  try {
    await until(() => assert.ok(ui.button(/Denselben Checkout öffnen/)));
    await ui.check(ui.container.querySelector('input[type="checkbox"]'));
    await ui.click(ui.button(/Denselben Checkout öffnen/));
    assert.match(ui.text(), /Freigabe gerade geschlossen/);
    assert.equal(JSON.parse(storage.getItem(key)).requestId, pendingSelection.requestId);
    await ui.close();
    ui = await mount(TokenShop, { email: owner, onRefreshBalance: async () => {} }, { storage, fetch });
    await until(() => assert.ok(ui.button(/Denselben Checkout öffnen/)));
    assert.equal(ui.container.querySelector('input[type="checkbox"]').checked, false, "reload cannot preserve legal acceptance");
    catalog = { ...enabledCatalog(), purchases: [{ ...pendingSelection, requestId: crypto.randomUUID(), id: `TP-${"b".repeat(32)}`, tokens: 5, priceCents: 500, currency: "CHF", createdAt: 1, status: "credited" }] };
    await ui.click(ui.button("Kaufstatus & Guthaben aktualisieren"));
    assert.ok(storage.getItem(key), "an unrelated credit cannot clear the outstanding request");
    catalog.purchases[0].requestId = pendingSelection.requestId;
    await ui.click(ui.button("Kaufstatus & Guthaben aktualisieren"));
    assert.equal(storage.getItem(key), null);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].requestId, pendingSelection.requestId);
    assert.equal(ui.redirects.length, 0);
  } finally { await ui.close(); }
});

test("actual token shop never sends checkout when session storage is blocked", async () => {
  const storage = new MemoryStorage(); storage.blocked = true; const methods = [];
  const ui = await mount(TokenShop, { email: owner, onRefreshBalance: async () => {} }, { storage, fetch: async (_url, init) => { methods.push(init?.method || "GET"); return json(enabledCatalog()); } });
  try {
    await choosePack(ui);
    await ui.click(ui.button(/Weiter zur Zahlung/));
    assert.match(ui.text(), /Für einen sicheren Kauf muss die Checkout-Anfrage/);
    assert.deepEqual(methods, ["GET"]);
    assert.equal(storage.values.size, 0);
  } finally { await ui.close(); }
});

test("actual token shop retains the same UUID across ambiguous provider errors and explicit retries", async () => {
  const posts = [], storage = new MemoryStorage();
  const ui = await mount(TokenShop, { email: owner, onRefreshBalance: async () => {} }, { storage, fetch: async (url, init) => {
    if (url === "/api/token-purchases") return json(enabledCatalog());
    posts.push(JSON.parse(init.body));
    if (posts.length === 1) throw new TypeError("Synthetic connection lost");
    return json({ purchaseId: `TP-${"a".repeat(32)}`, checkoutUrl: "https://1hagfh-b0.myshopify.com/cart/c/synthetic" });
  } });
  try {
    await choosePack(ui); await ui.click(ui.button(/Weiter zur Zahlung/));
    assert.match(ui.text(), /Checkout konnte nicht bestätigt werden/);
    assert.doesNotMatch(ui.text(), /Synthetic connection lost/);
    assert.equal(storage.values.size, 1);
    await ui.click(ui.button(/Denselben Checkout öffnen/));
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[0], posts[1]);
    assert.equal(posts[0].termsAccepted, true);
    assert.deepEqual(Object.keys(posts[0]).sort(), ["country", "packId", "requestId", "termsAccepted"]);
    assert.deepEqual(ui.redirects, ["https://1hagfh-b0.myshopify.com/cart/c/synthetic"]);
  } finally { await ui.close(); }
});

test("actual token shop does not claim a balance refresh when the account read failed", async () => {
  const ui = await mount(TokenShop, { email: owner, onRefreshBalance: async () => false }, { fetch: async () => json({ ...enabledCatalog(), enabled: false, message: "Kauf blockiert" }) });
  try {
    await until(() => assert.match(ui.text(), /Kauf blockiert/));
    await ui.click(ui.button("Kaufstatus & Guthaben aktualisieren"));
    assert.match(ui.text(), /Guthaben konnte gerade nicht aktualisiert werden/);
    assert.doesNotMatch(ui.text(), /Kaufstatus und Guthaben wurden neu geladen/);
    assert.equal([...ui.container.querySelectorAll(".token-pack button")].every(button => button.disabled), true);
  } finally { await ui.close(); }
});

test("actual CAPPATEX operations separates historical evidence from refresh time and reads only", async () => {
  const calls = [], recordedAt = "2026-10-01T00:00:00.000Z", validUntil = "2026-10-12T00:00:00.000Z";
  const data = {
    checkedAt: Date.parse("2026-10-20T12:00:00Z"),
    configuration: { checkoutEnabled: false, fulfillmentEnabled: false, automaticProductionRequested: false, registeredProfiles: 0,
      registeredShippingReleases: 0, webhookConfigured: true, productionWritePermissions: "unverified", tokenPurchasesRequested: false, registeredTokenPackReleases: 0 },
    readiness: { checkedAt: Date.parse("2026-10-20T12:00:00Z"), externalChecksPerformed: false, rows: [{ id: "synthetic-evidence", area: "CAPPATEX", title: "Synthetic mapping evidence", status: "veraltet",
      scope: "Nur Dokumentation", detail: "Historischer Beleg; keine Live-Abnahme", basis: [{ reference: "Offline fixture", recordedAt, validUntil }], next: "Aktuelle Zuordnung separat prüfen" }] },
    counts: [], orders: [], limit: 20,
  };
  const ui = await mount(CappatexOperations, {}, { fetch: async (url, init) => {
    calls.push([url, init?.method || "GET"]); assert.equal(url, "/api/cappatex/operations"); return json(data);
  } });
  try {
    await until(() => assert.match(ui.text(), /Synthetic mapping evidence/));
    assert.match(ui.text(), /Nur Dokumentation/); assert.match(ui.text(), /Veraltet/);
    assert.match(ui.text(), new RegExp(`Belegstand: ${new Date(recordedAt).toLocaleDateString("de-CH").replaceAll(".", "\\.")}`));
    assert.match(ui.text(), /hinterlegt; erfolgreiche Zustellung separat nachweisen/);
    assert.match(ui.text(), /Neue Tokenkäufe: gesperrt/);
    assert.match(ui.text(), /keine erfolgreiche Live-Abnahme|ersetzt eine erfolgreiche Live-Abnahme/);
    await ui.click(ui.button("Status aktualisieren"));
    await until(() => assert.equal(calls.length, 2));
    assert.deepEqual(calls, [["/api/cappatex/operations", "GET"], ["/api/cappatex/operations", "GET"]]);
  } finally { await ui.close(); }
});
