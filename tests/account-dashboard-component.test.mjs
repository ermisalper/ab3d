import assert from "node:assert/strict";
import { after, test } from "node:test";
import { act } from "react";
import { closeHarness, deferred, json, mount, until } from "./helpers/component-dom.mjs";

const { default: AccountDashboard } = await import("../app/konto/account-dashboard.tsx");
after(closeHarness);

const user = { email: "creator@example.test", displayName: "Synthetic Creator" };
const other = { email: "other@example.test", displayName: "Other Creator" };
const account = (overrides = {}) => ({ email: user.email, tokenBalance: 8, plan: "complete", subscriptionStatus: "active", requestedPlan: null,
  unlimited: false, isOwner: false, capabilities: { canUse3d: true, canUseCappatex: true, canDownload3d: true, canDownloadHd: true }, ...overrides });
const production = () => ({ id: "PRINT-AAAAAAAAAA", email: user.email, status: "awaiting_payment", sourceTaskId: "synthetic-task",
  templateName: "Synthetic private model", heightMm: 100, material: "PLA", finish: "Roh", quantity: 1, estimatedTotalCents: 1000, currency: "CHF", createdAt: 1 });
const shopOrder = () => ({ id: "synthetic-private-order", status: "paid", totalCents: 1000, currency: "CHF", itemsJson: "[]", createdAt: 1 });
const requestReceipt = (plan = "3d-studio") => ({ ok: true, request: { plan, status: "pending" }, message: "Synthetic request confirmed" });
function fixture(handler, initial = account()) {
  const calls = [];
  return { calls, fetch: async (url, init = {}) => {
    const method = init.method || "GET"; calls.push({ url, method, signal: init.signal });
    const intercepted = await handler?.(url, init);
    if (intercepted) return intercepted;
    if (url === "/api/account" && method === "GET") return json({ account: initial });
    if (url === "/api/token-purchases") return json({ enabled: false, message: "Synthetic token purchases disabled", packs: [], purchases: [] });
    if (url === "/api/orders" || String(url).startsWith("/api/production-orders")) return json({ orders: [] });
    throw new Error(`Unexpected offline request: ${method} ${url}`);
  } };
}
async function loaded(ui) { await until(() => assert.equal(ui.button("3D Studio anfragen")?.disabled, false)); }
async function doubleClick(element) {
  await act(async () => {
    element.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
  });
}

test("unverified account reads show unknown balance and plan, never an invented empty account", async () => {
  for (const response of [() => json({ error: "Synthetic unavailable" }, 503), () => json({ account: account() }, 202),
    () => new Response("<html>temporary error</html>"), () => json({ account: account({ email: other.email }) }),
    () => json({ account: account({ tokenBalance: -1 }) })]) {
    const data = fixture(url => url === "/api/account" ? response() : null);
    const ui = await mount(AccountDashboard, { user }, data);
    try {
      await until(() => assert.match(ui.text(), /Kontostatus und Guthaben konnten nicht aktualisiert/));
      assert.equal(ui.container.querySelector(".token-overview b").textContent, "Ungeprüft");
      assert.equal(ui.container.querySelector(".plan-name").textContent, "Ungeprüft");
      assert.doesNotMatch(ui.text(), /Noch keine individuelle 3D-Anfrage/);
      assert.equal(ui.button("3D Studio anfragen").disabled, true);
      assert.equal(ui.button("Kontostatus neu laden").disabled, false);
      assert.equal(data.calls.some(call => call.method !== "GET"), false);
    } finally { await ui.close(); }
  }
});

test("a failed initial account read can be retried manually without starting an action", async () => {
  let reads = 0;
  const data = fixture(url => url === "/api/account" && ++reads === 1 ? Promise.reject(new TypeError("Synthetic internal network detail")) : null);
  const ui = await mount(AccountDashboard, { user }, data);
  try {
    await until(() => assert.match(ui.text(), /Kontostatus und Guthaben konnten nicht aktualisiert/));
    await ui.click(ui.button("Kontostatus neu laden")); await loaded(ui);
    assert.equal(ui.container.querySelector(".token-overview b").textContent, "8");
    assert.doesNotMatch(ui.text(), /Synthetic internal network detail|Kontostatus und Guthaben konnten nicht aktualisiert/);
    assert.equal(data.calls.some(call => call.method !== "GET"), false);
  } finally { await ui.close(); }
});

test("same-render subscription clicks send one request and release the controls after a network failure", async () => {
  const pending = deferred(); let posts = 0;
  const data = fixture((_url, init) => init.method === "POST" ? (posts++, pending.promise) : null);
  const ui = await mount(AccountDashboard, { user }, data);
  try {
    await loaded(ui); await doubleClick(ui.button("3D Studio anfragen"));
    assert.equal(posts, 1); assert.equal(ui.button("CAPPATEX anfragen").disabled, true);
    await act(async () => pending.reject(new TypeError("Synthetic private network detail")));
    await until(() => assert.equal(ui.button("3D Studio anfragen")?.disabled, false));
    assert.match(ui.text(), /Abo-Anfrage konnte nicht bestätigt werden/);
    assert.doesNotMatch(ui.text(), /Synthetic private network detail/);
    assert.equal(posts, 1); assert.equal(ui.container.querySelector(".token-overview b").textContent, "8");
  } finally { pending.resolve(json(requestReceipt())); await ui.close(); }
});

test("subscription requests require HTTP 200 and the exact pending-plan receipt before reporting success", async () => {
  for (const response of [() => json(requestReceipt(), 202), () => json({ message: "Synthetic request confirmed" }),
    () => json({ ...requestReceipt(), ok: false }), () => json(requestReceipt("cappatex")),
    () => json({ ...requestReceipt(), request: { plan: "3d-studio", status: "active" } }),
    () => new Response("<html>not a receipt</html>")]) {
    const data = fixture((_url, init) => init.method === "POST" ? response() : null);
    const ui = await mount(AccountDashboard, { user }, data);
    try {
      await loaded(ui); await ui.click(ui.button("3D Studio anfragen"));
      await until(() => assert.match(ui.text(), /Abo-Anfrage konnte nicht bestätigt werden/));
      assert.doesNotMatch(ui.text(), /Synthetic request confirmed|Angefragt ✓/);
      assert.equal(ui.button("3D Studio anfragen").disabled, false);
      assert.equal(data.calls.filter(call => call.url === "/api/account" && call.method === "GET").length, 1);
    } finally { await ui.close(); }
  }
});

test("a confirmed subscription request refreshes account data and shows the requested plan separately from the active plan", async () => {
  let requested = false;
  const data = fixture((url, init) => {
    if (init.method === "POST") { requested = true; return json(requestReceipt()); }
    if (url === "/api/account") return json({ account: account({ requestedPlan: requested ? "3d-studio" : null }) });
  });
  const ui = await mount(AccountDashboard, { user }, data);
  try {
    await loaded(ui); await ui.click(ui.button("3D Studio anfragen"));
    await until(() => assert.match(ui.text(), /Separat angefragt: 3D Studio · Prüfung ausstehend/));
    assert.equal(ui.container.querySelector(".plan-name").textContent, "Complete");
    assert.match(ui.text(), /Status: Aktiv/); assert.match(ui.text(), /Synthetic request confirmed/);
    assert.equal(data.calls.filter(call => call.method === "POST").length, 1);
  } finally { await ui.close(); }
});

test("an unsuccessful refresh preserves the confirmed balance with a stale-data warning", async () => {
  let reads = 0;
  const data = fixture(url => url === "/api/account" && ++reads > 1 ? json({ error: "Synthetic unavailable" }, 503) : null);
  const ui = await mount(AccountDashboard, { user }, data);
  try {
    await loaded(ui); await ui.click(ui.button("Kontostatus neu laden"));
    await until(() => assert.match(ui.text(), /Frühere Angaben sind möglicherweise nicht mehr aktuell/));
    assert.equal(ui.container.querySelector(".token-overview b").textContent, "8");
    assert.equal(ui.container.querySelector(".plan-name").textContent, "Complete");
  } finally { await ui.close(); }
});

test("a superseded account refresh cannot replace the latest verified token balance", async () => {
  let reads = 0; const older = deferred();
  const data = fixture(url => {
    if (url !== "/api/account") return null;
    if (++reads === 2) return older.promise;
    return json({ account: account({ tokenBalance: reads === 1 ? 8 : 20 }) });
  });
  const ui = await mount(AccountDashboard, { user }, data);
  try {
    await loaded(ui); await ui.click(ui.button("Kontostatus neu laden"));
    await ui.click(ui.button("Kaufstatus & Guthaben aktualisieren"));
    await until(() => assert.equal(ui.container.querySelector(".token-overview b").textContent, "20"));
    await act(async () => older.resolve(json({ account: account({ tokenBalance: 1 }) })));
    assert.equal(ui.container.querySelector(".token-overview b").textContent, "20"); assert.equal(reads, 3);
  } finally { older.resolve(json({ account: account() })); await ui.close(); }
});

test("production status clicks are locally single-flight and become usable after a failed request", async () => {
  const pending = deferred(); let writes = 0;
  const data = fixture((url, init) => {
    if (init.method === "PATCH") { writes++; return pending.promise; }
    if (String(url).startsWith("/api/production-orders")) return json({ orders: [production()] });
  }, account({ isOwner: true }));
  const ui = await mount(AccountDashboard, { user }, data);
  try {
    await until(() => assert.ok(ui.button("Zahlung bestätigen"))); await doubleClick(ui.button("Zahlung bestätigen"));
    assert.equal(writes, 1); assert.equal(ui.button("Zahlung bestätigen").disabled, true);
    await act(async () => pending.reject(new TypeError("Synthetic private failure")));
    await until(() => assert.equal(ui.button("Zahlung bestätigen").disabled, false));
    assert.match(ui.text(), /Statusänderung konnte nicht bestätigt werden/);
    assert.doesNotMatch(ui.text(), /Synthetic private failure/); assert.equal(writes, 1);
    assert.match(ui.text(), /Zahlung ausstehend/); assert.equal(ui.button("Produktion starten"), undefined);
  } finally { pending.resolve(json({ ok: true, message: "Synthetic status confirmed" })); await ui.close(); }
});

test("an unconfirmed production receipt never reports a completed transition or reloads it as success", async () => {
  for (const response of [() => json({ ok: true, message: "Synthetic status confirmed" }, 202),
    () => json({ message: "Synthetic status confirmed" }), () => new Response("<html>temporary</html>")]) {
    const data = fixture((url, init) => init.method === "PATCH" ? response()
      : String(url).startsWith("/api/production-orders") ? json({ orders: [production()] }) : null, account({ isOwner: true }));
    const ui = await mount(AccountDashboard, { user }, data);
    try {
      await until(() => assert.ok(ui.button("Zahlung bestätigen"))); await ui.click(ui.button("Zahlung bestätigen"));
      await until(() => assert.match(ui.text(), /Statusänderung konnte nicht bestätigt werden/));
      assert.doesNotMatch(ui.text(), /Synthetic status confirmed/);
      assert.equal(data.calls.filter(call => String(call.url).startsWith("/api/production-orders") && call.method === "GET").length, 1);
      assert.equal(ui.button("Zahlung bestätigen").disabled, false);
    } finally { await ui.close(); }
  }
});

test("an account change clears previous state and discards late account and shop-order reads", async () => {
  const oldAccount = deferred(), oldOrders = deferred(); let changed = false;
  const data = fixture(url => {
    if (url === "/api/account") return changed ? json({ account: account({ email: other.email, tokenBalance: 0, plan: "free", subscriptionStatus: "inactive" }) }) : oldAccount.promise;
    if (url === "/api/orders") return changed ? json({ orders: [] }) : oldOrders.promise;
  });
  const ui = await mount(AccountDashboard, { user }, data);
  try {
    changed = true; await ui.render({ user: other }); await loaded(ui);
    await act(async () => { oldAccount.resolve(json({ account: account({ tokenBalance: 999, isOwner: true }) })); oldOrders.resolve(json({ orders: [shopOrder()] })); });
    assert.equal(ui.container.querySelector(".token-overview b").textContent, "0");
    assert.doesNotMatch(ui.text(), /creator@example.test|synthetic-private-order|Alle AB3D-Anfragen prüfen/);
    assert.match(ui.text(), /other@example.test/);
    assert.equal(data.calls.filter(call => call.url === "/api/account")[0].signal.aborted, true);
    assert.equal(data.calls.some(call => String(call.url).includes("scope=production")), false);
  } finally { oldAccount.resolve(json({ account: account() })); oldOrders.resolve(json({ orders: [] })); await ui.close(); }
});

test("late owner lists and subscription receipts cannot affect another signed-in account", async () => {
  const oldProduction = deferred(), oldMutation = deferred(); let changed = false;
  const data = fixture((url, init) => {
    if (init.method === "POST") return oldMutation.promise;
    if (url === "/api/account") return json({ account: account(changed ? { email: other.email, tokenBalance: 3 } : { isOwner: true }) });
    if (String(url).startsWith("/api/production-orders")) return changed ? json({ orders: [] }) : oldProduction.promise;
  });
  const ui = await mount(AccountDashboard, { user }, data);
  try {
    await loaded(ui); await ui.click(ui.button("3D Studio anfragen")); changed = true;
    await ui.render({ user: other }); await loaded(ui);
    await act(async () => { oldProduction.resolve(json({ orders: [production()] })); oldMutation.resolve(json(requestReceipt())); });
    assert.equal(ui.container.querySelector(".token-overview b").textContent, "3");
    assert.doesNotMatch(ui.text(), /Synthetic private model|Synthetic request confirmed|Alle AB3D-Anfragen prüfen/);
    assert.equal(ui.button("Zahlung bestätigen"), undefined);
    assert.equal(data.calls.filter(call => call.url === "/api/account" && call.method === "GET").length, 2);
    assert.equal(data.calls.find(call => call.method === "POST").signal.aborted, true);
  } finally { oldProduction.resolve(json({ orders: [] })); oldMutation.resolve(json(requestReceipt())); await ui.close(); }
});

test("failed or malformed order lists remain unverified instead of looking empty or crashing", async () => {
  for (const response of [() => json({ orders: [] }, 503), () => json({ orders: [null] }), () => new Response("<html>error</html>")]) {
    const data = fixture(url => url === "/api/orders" || String(url).startsWith("/api/production-orders") ? response() : null);
    const ui = await mount(AccountDashboard, { user }, data);
    try {
      await loaded(ui); await until(() => assert.match(ui.text(), /Shop-Bestellungen konnten nicht geladen/));
      assert.match(ui.text(), /3D-Anfragen konnten nicht aktualisiert/);
      assert.doesNotMatch(ui.text(), /Noch keine individuelle 3D-Anfrage|Noch keine Shop-Bestellung gespeichert/);
    } finally { await ui.close(); }
  }
});
