import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeHarness, deferred, flush, json, mount, until } from "./helpers/component-dom.mjs";

const { default: AIDesignStudio } = await import("../app/ai-design-studio.tsx");
after(closeHarness);

const plan = {
  planVersion: "ab3d-print-plan-v2", templateId: "free-design", productName: "Synthetic holder", customerIdea: "Ein runder Stiftehalter", intro: "Synthetic planner response",
  questions: [], answers: {}, summary: "Synthetic test geometry", parts: ["Holder"], specifications: ["Stable base"], safetyNotes: [],
  manufacturing: { strategy: "single-part", printedParts: ["Holder"], sourcedComponents: [], interfaces: [], assemblySteps: ["Inspect before printing"], excludedGeometry: [], meshDirective: "Synthetic closed geometry" },
  technicalBrief: "Synthetic closed holder for offline component test", complete: true, requiresProductionReview: true,
};
const printability = { status: "healthy", issue_count: 0, error_count: 0, warning_count: 0,
  metrics: { is_watertight: true, volume: 10, non_manifold_edges: 0, degenerate_faces: 0, holes: 0 },
  intended_print: { printer_type: "fdm", height_mm: 200, wall_thickness_mm: 1.2 }, thin_walls: { status: "healthy", has_thin_walls: false } };
const taskIds = { create: "synthetic-created", resize: "synthetic-resized", analyze: "synthetic-analyzed", convert: "synthetic-converted" };
const inquiryId = "PRINT-ABCDE00001";
const receipt = (id = inquiryId, message = "Unverbindliche Anfrage gespeichert; keine Zahlung oder Produktion") => ({ ok: true,
  order: { id, status: "inquiry", estimatedTotalCents: 4500, currency: "CHF" }, message });

function fixture({ inquiry = async () => json(receipt()), report = printability } = {}) {
  const calls = [], inquiries = [], tasks = new Map(); let generation = 0;
  return { calls, inquiries, fetch: async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", ...(init.body ? { body: JSON.parse(init.body) } : {}) });
    if (url === "/api/account") return json({ account: { email: "customer@example.test", tokenBalance: 100, unlimited: false, capabilities: { canDownload3d: false } } });
    if (url === "/api/design-agent") { assert.equal(init.method, "POST"); return json({ plan }); }
    if (url === "/api/meshy?health=1") return json({ configured: true });
    if (url === "/api/production-orders") {
      assert.equal(init.method, "POST"); const body = JSON.parse(init.body); inquiries.push(body); return inquiry(body, inquiries.length);
    }
    if (url === "/api/meshy") {
      assert.equal(init.method, "POST"); const body = JSON.parse(init.body);
      assert.ok(Object.hasOwn(taskIds, body.action), `Unexpected simulated Meshy action: ${body.action}`);
      if (body.action === "create") generation++;
      const taskId = `${taskIds[body.action]}${generation > 1 ? `-${generation}` : ""}`;
      tasks.set(taskId, body.action);
      return json({ taskId, type: body.action === "create" ? "text" : body.action, tokenBalance: 99 });
    }
    assert.ok(typeof url === "string" && url.startsWith("/api/meshy?taskId="), `Unexpected offline fetch: ${url}`);
    const query = new URL(url, "https://ab3d.example.test").searchParams, id = query.get("taskId");
    assert.ok(tasks.has(id));
    return json({ id, status: "SUCCEEDED", progress: 100,
      model_urls: { glb: "https://assets.meshy.ai/synthetic/model.glb", ...(tasks.get(id) === "convert" ? { stl: "https://assets.meshy.ai/synthetic/model.stl", "3mf": "https://assets.meshy.ai/synthetic/model.3mf" } : {}) },
      ...(tasks.get(id) === "analyze" ? { printability: report } : {}), collectionSaved: true });
  } };
}

// Drive public controls of the actual studio, not a state-injected request form.
// Every planner/engine response is local; the fetch stub has no network fallback.
async function prepareInquiry(ui) {
  await ui.change(ui.container.querySelector("#customer-idea"), "Ein runder Stiftehalter");
  await ui.click(ui.button(/Idee mit KI planen/));
  await until(() => assert.ok(ui.button("Diesen Aufbau verwenden")));
  await ui.click(ui.button("Diesen Aufbau verwenden"));
  await ui.click(ui.button(/Schnelle Vorschau/));
  await ui.check(ui.container.querySelector('input[name="gallery-ab3d"]'));
  const generate = ui.container.querySelector(".generate-button"); assert.equal(generate.disabled, false);
  await ui.click(generate);
  await until(() => assert.ok(ui.button(/Druckpaket für 20 cm vorbereiten/)));
  await ui.click(ui.button(/Druckpaket für 20 cm vorbereiten/));
  await until(() => assert.ok(ui.container.querySelector('[name="inquiry-name"]')));
}

test("actual AB3D studio validates contact fields before an explicit inquiry and never sends payment data", async () => {
  const mock = fixture(), ui = await mount(AIDesignStudio, { signedIn: true }, mock);
  try {
    await prepareInquiry(ui);
    await until(() => assert.equal(ui.button("Unverbindlich bei AB3D anfragen")?.disabled, false));
    assert.equal(mock.inquiries.length, 0, "generation and file preparation cannot submit an inquiry automatically");
    await ui.change(ui.container.querySelector('[name="inquiry-name"]'), "  Synthetic Customer  ");
    await ui.change(ui.container.querySelector('[name="inquiry-postal-code"]'), "8000");
    await ui.change(ui.container.querySelector('[name="inquiry-city"]'), "Zürich");
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(mock.inquiries.length, 0);
    assert.match(ui.text(), /Für Ort oder Postleitzahl bitte das Land wählen/);
    assert.equal(ui.container.querySelector('[name="inquiry-postal-code"]').value, "8000");
    await ui.change(ui.container.querySelector('[name="inquiry-country"]'), "CH");
    await ui.change(ui.container.querySelector('[name="inquiry-postal-code"]'), "800");
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(mock.inquiries.length, 0);
    await ui.change(ui.container.querySelector('[name="inquiry-postal-code"]'), "8000");
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(mock.inquiries.length, 1);
    const { requestId, ...inquiry } = mock.inquiries[0];
    assert.match(requestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.deepEqual(inquiry, { sourceTaskId: taskIds.convert, templateId: "free-design", heightCm: 20, material: "PLA", finish: "Roh", quantity: 1,
      requestDetails: { name: "Synthetic Customer", country: "CH", postalCode: "8000", city: "Zürich" } });
    assert.match(ui.text(), /Unverbindliche Anfrage gespeichert; keine Zahlung oder Produktion/);
    assert.equal(ui.button(`Anfrage gespeichert · ${inquiryId}`).disabled, true);
    await ui.click(ui.button(`Anfrage gespeichert · ${inquiryId}`));
    assert.equal(mock.inquiries.length, 1);
    assert.equal(mock.calls.every(call => call.url.startsWith("/api/")), true);
  } finally { await ui.close(); }
});

test("actual AB3D studio preserves each inquiry UUID across failures, explicit retries and reverting edits", async () => {
  const pending = deferred();
  const mock = fixture({ inquiry: async (_body, attempt) => attempt === 1 ? pending.promise : attempt <= 4
    ? json({ error: "Speicherstatus derzeit ungeklärt. Bitte dieselbe Anfrage erneut prüfen." }, 503)
    : json(receipt(inquiryId, "Anfrage unverbindlich gespeichert")) });
  const ui = await mount(AIDesignStudio, { signedIn: true }, mock);
  try {
    await prepareInquiry(ui);
    await until(() => assert.equal(ui.button("Unverbindlich bei AB3D anfragen")?.disabled, false));
    await ui.change(ui.container.querySelector('[name="inquiry-name"]'), "Synthetic Customer");
    await ui.change(ui.container.querySelector('[name="inquiry-phone"]'), "+41 00 000 00 00");
    await ui.change(ui.container.querySelector('[name="inquiry-note"]'), "Bitte vor Fertigung die Wandstärke prüfen.");
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(ui.button("Anfrage wird gespeichert …").disabled, true);
    await ui.click(ui.button("Anfrage wird gespeichert …")); assert.equal(mock.inquiries.length, 1);
    await import("react").then(({ act }) => act(async () => pending.reject(new TypeError("Failed to fetch"))));
    await until(() => assert.match(ui.text(), /Anfrage konnte nicht bestätigt werden/));
    assert.doesNotMatch(ui.text(), /Failed to fetch/);
    assert.match(ui.text(), /Status im Konto/);
    assert.equal(ui.container.querySelector('[name="inquiry-name"]').value, "Synthetic Customer");
    assert.equal(ui.container.querySelector('[name="inquiry-phone"]').value, "+41 00 000 00 00");
    assert.equal(ui.container.querySelector('[name="inquiry-note"]').value, "Bitte vor Fertigung die Wandstärke prüfen.");
    await flush(); assert.equal(mock.inquiries.length, 1, "no automatic retry after a failure");
    await ui.change(ui.container.querySelector('[name="inquiry-name"]'), "  Synthetic Customer  ");
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(mock.inquiries.length, 2); assert.deepEqual(mock.inquiries[1], mock.inquiries[0]);
    assert.match(mock.inquiries[0].requestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.match(ui.text(), /Speicherstatus derzeit ungeklärt/);
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(mock.inquiries.length, 3); assert.deepEqual(mock.inquiries[2], mock.inquiries[0], "503 cannot discard the request identity");
    await ui.change(ui.container.querySelector('[name="inquiry-note"]'), "Bitte ausserdem die Wunschfarbe prüfen.");
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(mock.inquiries.length, 4);
    assert.notEqual(mock.inquiries[3].requestId, mock.inquiries[2].requestId);
    assert.deepEqual({ ...mock.inquiries[3], requestId: mock.inquiries[1].requestId,
      requestDetails: { ...mock.inquiries[3].requestDetails, customerNote: mock.inquiries[1].requestDetails.customerNote } }, mock.inquiries[1]);
    assert.match(ui.text(), /Speicherstatus derzeit ungeklärt/);
    await ui.change(ui.container.querySelector('[name="inquiry-note"]'), "Bitte vor Fertigung die Wandstärke prüfen.");
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(mock.inquiries.length, 5);
    assert.deepEqual(mock.inquiries[4], mock.inquiries[0], "A → uncertain B → A must reuse the first A UUID, not create a second inquiry");
    assert.match(ui.text(), /Anfrage unverbindlich gespeichert/);
  } finally { pending.resolve(json({}, 503)); await ui.close(); }
});

test("actual AB3D studio cannot submit an inquiry when its print package is not confirmed", async () => {
  const mock = fixture({ report: { ...printability, status: "unknown", thin_walls: { status: "unknown", has_thin_walls: null } } });
  const ui = await mount(AIDesignStudio, { signedIn: true }, mock);
  try {
    await prepareInquiry(ui);
    await until(() => assert.match(ui.text(), /Wandstärkenprüfung ist unvollständig/));
    const request = ui.button("Zuerst Druckpaket vorbereiten"); assert.equal(request.disabled, true);
    await ui.click(request); assert.equal(mock.inquiries.length, 0);
    assert.equal(mock.calls.some(call => call.body?.action === "convert"), false);
    assert.match(ui.text(), /unverbindlich und löst keine Zahlung oder Produktion aus/);
  } finally { await ui.close(); }
});

test("actual AB3D studio treats malformed successful inquiry replies as unconfirmed and retains the same request", async () => {
  const valid = receipt(), replies = [
    () => json({ ...valid, order: { ...valid.order, id: "unverified-id" } }),
    () => json({ ...valid, ok: false }),
    () => json({ ...valid, order: { ...valid.order, status: "paid" } }),
    () => json({ ...valid, order: { ...valid.order, estimatedTotalCents: 45.001 } }),
    () => json({ ...valid, order: { ...valid.order, currency: "EUR" } }),
    () => json(valid, 202),
    () => new Response("<html>Upstream unavailable</html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    () => json(valid),
  ];
  const mock = fixture({ inquiry: async (_body, attempt) => replies[attempt - 1]() });
  const ui = await mount(AIDesignStudio, { signedIn: true }, mock);
  try {
    await prepareInquiry(ui);
    await until(() => assert.equal(ui.button("Unverbindlich bei AB3D anfragen")?.disabled, false));
    await ui.change(ui.container.querySelector('[name="inquiry-name"]'), "Synthetic retained input");
    for (let index = 0; index < replies.length - 1; index++) {
      await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
      assert.equal(ui.button("Unverbindlich bei AB3D anfragen")?.disabled, false, "an unverified response cannot mark the inquiry as saved");
      assert.match(ui.text(), /Anfrage konnte nicht bestätigt werden/);
      assert.doesNotMatch(ui.text(), /Anfrage gespeichert ·|Unexpected token|Upstream unavailable/);
      assert.equal(ui.container.querySelector('[name="inquiry-name"]').value, "Synthetic retained input");
      assert.deepEqual(mock.inquiries[index], mock.inquiries[0]);
    }
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(ui.button(`Anfrage gespeichert · ${inquiryId}`).disabled, true);
    assert.equal(mock.inquiries.length, replies.length);
    assert.deepEqual(mock.inquiries.at(-1), mock.inquiries[0]);
  } finally { await ui.close(); }
});

for (const changeContext of ["template", "mode"]) test(`actual AB3D studio ignores a late inquiry ${changeContext === "mode" ? "network failure" : "receipt"} after ${changeContext} changes and a new model`, async () => {
  const pending = deferred(), nextId = "PRINT-ABCDE00002";
  const mock = fixture({ inquiry: async (_body, attempt) => attempt === 1 ? pending.promise : json(receipt(nextId)) });
  const ui = await mount(AIDesignStudio, { signedIn: true }, mock);
  try {
    await prepareInquiry(ui);
    await until(() => assert.equal(ui.button("Unverbindlich bei AB3D anfragen")?.disabled, false));
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    if (changeContext === "template") {
      await ui.click(ui.button(/BlumentopfIndividuelles Pflanzgefäss/));
      await ui.click(ui.button(/Eigene Idee beschreiben/));
    } else {
      await ui.click(ui.button(/Foto verwenden$/));
      await ui.click(ui.button(/Idee eingeben$/));
    }
    await prepareInquiry(ui);
    await until(() => assert.ok(ui.container.querySelector('model-viewer[src*="synthetic-resized-2"]')));
    await import("react").then(({ act }) => act(async () => {
      if (changeContext === "mode") pending.reject(new TypeError("Failed to fetch"));
      else pending.resolve(json(receipt()));
    }));
    await until(() => assert.equal(ui.button("Unverbindlich bei AB3D anfragen")?.disabled, false));
    assert.doesNotMatch(ui.text(), new RegExp(inquiryId));
    assert.doesNotMatch(ui.text(), /Unverbindliche Anfrage gespeichert; keine Zahlung oder Produktion/);
    assert.doesNotMatch(ui.text(), /Anfrage konnte nicht bestätigt werden|Failed to fetch/);
    assert.equal(mock.inquiries.length, 1);
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    assert.equal(mock.inquiries.length, 2);
    assert.equal(mock.inquiries[1].sourceTaskId, `${taskIds.convert}-2`);
    assert.notEqual(mock.inquiries[1].requestId, mock.inquiries[0].requestId);
    assert.equal(ui.button(`Anfrage gespeichert · ${nextId}`).disabled, true);
  } finally { pending.resolve(json(receipt())); await ui.close(); }
});

test("actual AB3D studio blocks queued size and production-option changes while its inquiry is being saved", async () => {
  const pending = deferred(), mock = fixture({ inquiry: async () => pending.promise });
  const ui = await mount(AIDesignStudio, { signedIn: true }, mock);
  try {
    await prepareInquiry(ui);
    await until(() => assert.equal(ui.button("Unverbindlich bei AB3D anfragen")?.disabled, false));
    await ui.click(ui.button("Unverbindlich bei AB3D anfragen"));
    const height = ui.container.querySelector('.size-config input[type="range"]');
    assert.equal(height.disabled, true);
    // Simulate an already queued change; the synchronous pending guard must
    // protect the submitted context in addition to the disabled control.
    await ui.change(height, "21");
    assert.match(ui.text(), /Zielhöhe 20 cm/);
    const [material, finish] = ui.container.querySelectorAll(".price-config select"), quantity = ui.container.querySelector('.price-config input[type="number"]');
    assert.equal(material.disabled && finish.disabled && quantity.disabled, true);
    await ui.change(material, "PETG");
    await ui.change(finish, "Premium");
    await ui.change(quantity, "2");
    assert.equal(material.value, "PLA"); assert.equal(finish.value, "Roh"); assert.equal(quantity.value, "1");
    assert.equal(mock.inquiries[0].heightCm, 20);
    await import("react").then(({ act }) => act(async () => pending.resolve(json(receipt()))));
    assert.equal(ui.button(`Anfrage gespeichert · ${inquiryId}`).disabled, true);
    assert.match(ui.text(), /Zielhöhe 20 cm/);
  } finally { pending.resolve(json(receipt())); await ui.close(); }
});
