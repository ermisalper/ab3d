import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeHarness, json, mount, until } from "./helpers/component-dom.mjs";

const { default: Operations } = await import("../app/cappatex/betrieb/operations.tsx");
const { fulfillmentSummary } = await import("../app/cappatex-operations.ts");
const { cappatexReadiness } = await import("../app/cappatex-readiness.ts");
after(closeHarness);

const checkedAt = Date.parse("2026-11-02T15:00:00Z");
const overview = () => ({
  checkedAt,
  configuration: { checkoutEnabled: false, fulfillmentEnabled: false, automaticProductionRequested: false,
    registeredProfiles: 0, registeredShippingReleases: 0, webhookConfigured: false,
    productionWritePermissions: "unverified", tokenPurchasesRequested: false, registeredTokenPackReleases: 0 },
  readiness: { checkedAt, externalChecksPerformed: false, rows: [] }, counts: [], orders: [], limit: 50,
});
const unavailable = /Betreiberübersicht konnte nicht bestätigt werden/;

test("CAPPATEX operations never presents an HTTP202 overview as a confirmed check", async () => {
  const calls = [];
  const ui = await mount(Operations, {}, { fetch: async (url, init) => {
    calls.push([url, init?.method || "GET"]); return json(overview(), 202);
  } });
  try {
    await until(() => assert.match(ui.text(), unavailable));
    assert.doesNotMatch(ui.text(), /Übersicht geladen|Shopify-Checkout:/);
    assert.deepEqual(calls, [["/api/cappatex/operations", "GET"]]);
  } finally { await ui.close(); }
});

test("CAPPATEX operations rejects malformed configuration and nested collections without rendering them", async () => {
  const malformed = [
    () => ({ ...overview(), configuration: { ...overview().configuration, checkoutEnabled: "false" } }),
    () => ({ ...overview(), readiness: { ...overview().readiness, rows: [null] } }),
    () => ({ ...overview(), counts: {} }),
    () => ({ ...overview(), orders: [null] }),
    () => ({ ...overview(), counts: [{ state: "creating", total: -1 }] }),
    () => ({ ...overview(), readiness: { ...overview().readiness, rows: [{ id: "invalid", status: "approved" }] } }),
    () => ({ ...overview(), checkedAt: "2026-11-02" }),
    () => ({ ...overview(), readiness: { ...overview().readiness, externalChecksPerformed: true } }),
  ];
  for (const value of malformed) {
    const ui = await mount(Operations, {}, { fetch: async () => json(value()) });
    try {
      await until(() => assert.match(ui.text(), unavailable));
      assert.doesNotMatch(ui.text(), /Übersicht geladen|Konfigurationsschalter aktiv/);
      assert.equal(ui.button("Status aktualisieren").disabled, false);
    } finally { await ui.close(); }
  }
});

test("CAPPATEX operations renders the actual server summaries without claiming live verification", async () => {
  const data = { ...overview(), counts: [{ state: "creating", total: 1 }],
    readiness: cappatexReadiness({ designProfiles: [], salesProfiles: [], shippingReleases: [], tokenReleases: [] }, checkedAt),
    orders: [fulfillmentSummary({ id: "local-fulfillment", external_id: "LOCAL-ORDER", state: "creating", printify_order_id: null,
      error_code: null, created_at: checkedAt - 30 * 60_000, updated_at: checkedAt - 20 * 60_000 }, checkedAt)] };
  const ui = await mount(Operations, {}, { fetch: async () => json(data) });
  try {
    await until(() => assert.match(ui.text(), /LOCAL-ORDER/));
    assert.match(ui.text(), /Auftragsanlage unbestätigt/);
    assert.match(ui.text(), /Seit mindestens 15 Minuten/);
    assert.match(ui.text(), /keinen zweiten Auftrag anlegen/);
    assert.equal(ui.container.querySelectorAll("details").length, data.readiness.rows.length);
    assert.doesNotMatch(ui.text(), unavailable);
  } finally { await ui.close(); }
});

test("CAPPATEX operations discards the prior overview after a failed refresh and recovers on explicit GET", async () => {
  const calls = [];
  const ui = await mount(Operations, {}, { fetch: async (url, init) => {
    calls.push([url, init?.method || "GET"]);
    return calls.length === 2 ? json({ ...overview(), counts: null }) : json(overview());
  } });
  try {
    await until(() => assert.match(ui.text(), /Übersicht geladen/));
    await ui.click(ui.button("Status aktualisieren"));
    await until(() => assert.match(ui.text(), unavailable));
    assert.doesNotMatch(ui.text(), /Übersicht geladen|Shopify-Checkout:/);
    await ui.click(ui.button("Status aktualisieren"));
    await until(() => assert.match(ui.text(), /Übersicht geladen/));
    assert.deepEqual(calls, Array.from({ length: 3 }, () => ["/api/cappatex/operations", "GET"]));
  } finally { await ui.close(); }
});

test("CAPPATEX operations uses understandable errors without reflecting transport or server internals", async () => {
  for (const response of [
    () => json({ error: "SYNTHETIC_PRIVATE_SQL_DETAILS" }, 503),
    () => { throw new TypeError("SYNTHETIC_PRIVATE_NETWORK_DETAILS"); },
    () => new Response("SYNTHETIC_PRIVATE_INVALID_JSON", { status: 200 }),
  ]) {
    const ui = await mount(Operations, {}, { fetch: async () => response() });
    try {
      await until(() => assert.match(ui.text(), unavailable));
      assert.doesNotMatch(ui.text(), /SYNTHETIC_PRIVATE|JSON|TypeError/);
    } finally { await ui.close(); }
  }
});
