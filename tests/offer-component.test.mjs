import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeHarness, deferred, json, MemoryStorage, mount, until } from "./helpers/component-dom.mjs";

const { default: OfferPanel } = await import("../app/betrieb/offer-panel.tsx");
const { emptyProductionOffer, calculateProductionOffer, productionOfferSheet } = await import("../app/production-offer.ts");
const ownerEmail = "operator@example.test", orderId = "PRINT-ABCDE00001", otherId = "PRINT-ABCDE00002";
const props = { ownerEmail, orderId };
after(closeHarness);
const offer = (payload = emptyProductionOffer(), version = 0, id = orderId) => ({
  orderId: id, version, payload, calculation: calculateProductionOffer(payload), sheet: productionOfferSheet(id, payload),
  updatedAt: version ? version : null, updatedBy: version ? ownerEmail : null, events: [],
});
const input = (ui, name) => [...ui.container.querySelectorAll("label")].find(label => label.firstChild?.textContent === name)?.querySelector("input,textarea,select");
const ready = ui => until(() => assert.ok(input(ui, "Material")));

test("actual offer component sends unknown amounts as null and preserves explicit integer-cent zero", async () => {
  const puts = [];
  const ui = await mount(OfferPanel, props, { fetch: async (url, init) => {
    assert.equal(url, `/api/ab3d/operations/${orderId}/offer`);
    if (init.method !== "PUT") return json(offer());
    const body = JSON.parse(init.body); puts.push(body); return json(offer(body.payload, 1));
  } });
  try {
    await ready(ui);
    assert.equal(input(ui, "Menge (Stück)").value, "");
    assert.equal(ui.button("Internen Entwurf speichern").disabled, true);
    assert.match(ui.text(), /Vollständige GesamtkostenOffen/);
    await ui.change(input(ui, "Material"), "PLA");
    await ui.change(ui.container.querySelector('[aria-label="Materialkosten – Erfassung"]'), "included");
    await ui.change(ui.container.querySelector('[aria-label="Materialkosten einmalig in CHF"]'), "0");
    await ui.click(ui.button("Internen Entwurf speichern"));
    assert.equal(puts.length, 1);
    assert.equal(puts[0].version, 0);
    assert.equal(puts[0].payload.costs.material.oneOffCents, 0);
    assert.equal(puts[0].payload.costs.material.perUnitCents, null);
    assert.equal(puts[0].payload.plannedSaleTotalCents, null);
    assert.equal(puts[0].payload.quantity, null);
    assert.equal(puts[0].payload.costs.external.state, "open");
    assert.match(ui.text(), /Keine Zahlung und keine Produktion freigegeben/i);
    assert.match(ui.text(), /Vollständige GesamtkostenOffen/);
  } finally { await ui.close(); }
});

test("actual offer component prevents duplicate PUTs while a save confirmation is pending", async () => {
  const pending = deferred(), puts = [];
  const ui = await mount(OfferPanel, props, { fetch: async (_url, init) => {
    if (init.method !== "PUT") return json(offer());
    puts.push(JSON.parse(init.body)); return pending.promise;
  } });
  try {
    await ready(ui); await ui.change(input(ui, "Material"), "PLA");
    await ui.click(ui.button("Internen Entwurf speichern"));
    assert.equal(ui.button("Wird gespeichert …").disabled, true);
    await ui.click(ui.button("Wird gespeichert …"));
    assert.equal(puts.length, 1);
    await import("react").then(({ act }) => act(async () => pending.resolve(json(offer(puts[0].payload, 1)))));
    await until(() => assert.match(ui.text(), /Interner Entwurf gespeichert/));
    assert.equal(ui.button("Internen Entwurf speichern").disabled, true);
  } finally { pending.resolve(json(offer())); await ui.close(); }
});

test("actual offer component retains edits on 409 and only rebases after an explicit comparison", async () => {
  let server = offer(); const puts = [];
  const ui = await mount(OfferPanel, props, { fetch: async (_url, init) => {
    if (init.method !== "PUT") return json(server);
    const body = JSON.parse(init.body); puts.push(body);
    if (puts.length === 1) { server = offer({ ...emptyProductionOffer(), material: "PETG" }, 1); return json({ code: "offer_conflict" }, 409); }
    server = offer(body.payload, 2); return json(server);
  } });
  try {
    await ready(ui); await ui.change(input(ui, "Material"), "PLA");
    await ui.click(ui.button("Internen Entwurf speichern"));
    await until(() => assert.match(ui.text(), /Abweichender Serverstand: Version 1/));
    assert.equal(input(ui, "Material").value, "PLA");
    assert.equal(ui.button("Internen Entwurf speichern").disabled, true);
    assert.match(ui.text(), /PETG/);
    await ui.click(ui.button("Nach Vergleich meine Eingabe weiterverwenden"));
    assert.equal(input(ui, "Material").value, "PLA");
    assert.equal(ui.button("Internen Entwurf speichern").disabled, false);
    await ui.click(ui.button("Internen Entwurf speichern"));
    assert.deepEqual(puts.map(body => body.version), [0, 1]);
    assert.equal(puts[1].payload.material, "PLA");
    assert.match(ui.text(), /Interner Entwurf gespeichert/);
  } finally { await ui.close(); }
});

test("actual offer component cannot adopt or rebase a cached server version after 409 and a failed refresh", async () => {
  let reads = 0; const puts = [];
  const newer = offer({ ...emptyProductionOffer(), material: "PETG newer server revision" }, 1);
  const ui = await mount(OfferPanel, props, { fetch: async (_url, init) => {
    if (init.method === "PUT") {
      const body = JSON.parse(init.body); puts.push(body);
      return puts.length === 1 ? json({ code: "offer_conflict" }, 409) : json(offer(body.payload, 2));
    }
    reads++;
    if (reads === 2) return json({ error: "Synthetic failed conflict refresh" }, 503);
    // A valid but old replica response must not make version zero current again.
    return json(reads < 4 ? offer() : newer);
  } });
  try {
    await ready(ui); await ui.change(input(ui, "Material"), "PLA retained local revision");
    await ui.click(ui.button("Internen Entwurf speichern"));
    await until(() => assert.match(ui.text(), /Angebotsentwurf konnte nicht geladen werden/));
    assert.equal(reads, 2);
    assert.equal(input(ui, "Material").value, "PLA retained local revision");
    assert.equal(ui.button("Internen Entwurf speichern").disabled, true);
    assert.equal(ui.button("Serverstand übernehmen, eigene Änderungen verwerfen").disabled, true);
    assert.equal(ui.button("Nach Vergleich meine Eingabe weiterverwenden").disabled, true);
    await ui.click(ui.button("Serverstand übernehmen, eigene Änderungen verwerfen"));
    await ui.click(ui.button("Nach Vergleich meine Eingabe weiterverwenden"));
    assert.equal(input(ui, "Material").value, "PLA retained local revision");
    assert.equal(puts.length, 1);
    await ui.click(ui.button("Serverstand neu laden"));
    await until(() => assert.equal(reads, 3));
    assert.equal(ui.button("Serverstand übernehmen, eigene Änderungen verwerfen").disabled, true);
    assert.equal(ui.button("Nach Vergleich meine Eingabe weiterverwenden").disabled, true);
    assert.equal(input(ui, "Material").value, "PLA retained local revision");
    await ui.click(ui.button("Serverstand neu laden"));
    await until(() => assert.match(ui.text(), /PETG newer server revision/));
    assert.equal(reads, 4);
    assert.equal(ui.button("Serverstand übernehmen, eigene Änderungen verwerfen").disabled, false);
    assert.equal(ui.button("Nach Vergleich meine Eingabe weiterverwenden").disabled, false);
    await ui.click(ui.button("Nach Vergleich meine Eingabe weiterverwenden"));
    assert.equal(input(ui, "Material").value, "PLA retained local revision");
    assert.equal(ui.button("Internen Entwurf speichern").disabled, false);
    assert.equal(puts.length, 1, "successful GET and explicit rebase are not a save");
    await ui.click(ui.button("Internen Entwurf speichern"));
    assert.deepEqual(puts.map(body => body.version), [0, 1]);
  } finally { await ui.close(); }
});

test("actual offer component rejects a mismatched save confirmation without losing local amounts", async () => {
  const ui = await mount(OfferPanel, props, { fetch: async (_url, init) => {
    if (init.method !== "PUT") return json(offer());
    return json(offer({ ...JSON.parse(init.body).payload, material: "Wrong confirmation" }, 1));
  } });
  try {
    await ready(ui); await ui.change(input(ui, "Material"), "PLA");
    await ui.change(ui.container.querySelector('[aria-label="Materialkosten – Erfassung"]'), "included");
    await ui.change(ui.container.querySelector('[aria-label="Materialkosten einmalig in CHF"]'), "12,34");
    await ui.click(ui.button("Internen Entwurf speichern"));
    assert.match(ui.text(), /Speicherbestätigung passt nicht zu diesem Entwurf/);
    assert.equal(input(ui, "Material").value, "PLA");
    assert.equal(ui.container.querySelector('[aria-label="Materialkosten einmalig in CHF"]').value, "12,34");
    assert.doesNotMatch(ui.text(), /Interner Entwurf gespeichert/);
    assert.equal(ui.storage.values.size, 1);
  } finally { await ui.close(); }
});

test("actual offer component keeps different unsaved inquiries through a selection switch even with blocked storage", async () => {
  const storage = new MemoryStorage(); storage.blocked = true; const puts = [];
  const ui = await mount(OfferPanel, props, { storage, fetch: async (url, init) => {
    const id = url.split("/").at(-2);
    if (init.method !== "PUT") return json(offer(emptyProductionOffer(), 0, id));
    const body = JSON.parse(init.body); puts.push({ id, body }); return json(offer(body.payload, 1, id));
  } });
  try {
    await ready(ui); assert.match(ui.text(), /Sitzungsspeicher ist blockiert/);
    await ui.change(input(ui, "Material"), "PLA first inquiry");
    await ui.render({ ownerEmail, orderId: otherId }); await ready(ui);
    assert.equal(input(ui, "Material").value, "");
    await ui.change(input(ui, "Material"), "PETG second inquiry");
    await ui.render(props); await ready(ui);
    assert.equal(input(ui, "Material").value, "PLA first inquiry");
    assert.match(ui.text(), new RegExp(otherId));
    await ui.click(ui.button("Internen Entwurf speichern"));
    assert.equal(puts.length, 1); assert.equal(puts[0].id, orderId);
    assert.equal(puts[0].body.payload.material, "PLA first inquiry");
    await ui.render({ ownerEmail, orderId: otherId }); await ready(ui);
    assert.equal(input(ui, "Material").value, "PETG second inquiry");
  } finally { await ui.close(); }
});

test("actual offer component restores uncertain edits on reload and a GET never auto-repeats a save", async () => {
  const storage = new MemoryStorage(), methods = [];
  const fetch = async (_url, init) => {
    methods.push(init.method || "GET");
    if (init.method === "PUT") throw new TypeError("Failed to fetch");
    return json(offer());
  };
  let ui = await mount(OfferPanel, props, { storage, fetch });
  try {
    await ready(ui); await ui.change(input(ui, "Material"), "PLA retained");
    await ui.click(ui.button("Internen Entwurf speichern"));
    assert.match(ui.text(), /Speichern konnte nicht bestätigt werden/);
    assert.doesNotMatch(ui.text(), /Failed to fetch/);
    await ui.close(); ui = await mount(OfferPanel, props, { storage, fetch });
    await until(() => assert.equal(input(ui, "Material")?.value, "PLA retained"));
    assert.deepEqual(methods, ["GET", "PUT", "GET"]);
    assert.match(ui.text(), /Ungespeicherten Angebotsentwurf aus diesem Tab wiederhergestellt/);
  } finally { await ui.close(); }
});
