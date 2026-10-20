import assert from "node:assert/strict";
import { after, test } from "node:test";
import { act } from "react";
import { closeHarness, deferred, json, MemoryStorage, mount, until } from "./helpers/component-dom.mjs";

const { default: TokenShop } = await import("../app/konto/token-shop.tsx");
const { TOKEN_PACKS } = await import("../app/token-packs.ts");
after(closeHarness);
const email = "creator@example.test", otherEmail = "other@example.test";
const pending = { packId: "tokens-5", country: "CH", requestId: "11111111-2222-4333-8444-555555555555" };
const catalogue = () => ({ enabled: true, message: "Synthetic verified response", packs: [{ ...TOKEN_PACKS[0], available: true }], purchases: [] });
const receipt = { purchaseId: `TP-${"a".repeat(32)}`, checkoutUrl: "https://offline-shop.myshopify.com/cart/c/synthetic" };
const credited = () => ({ ...pending, id: `TP-${"b".repeat(32)}`, tokens: 5, priceCents: 500, currency: "CHF", createdAt: 1, status: "credited" });
const props = { email, onRefreshBalance: async () => true };
async function storageKey(account = email) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(account));
  return `ab3d-token-checkout-v1:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
async function choose(ui) {
  await until(() => assert.ok(ui.button("Paket auswählen")));
  await ui.click(ui.button("Paket auswählen"));
  await ui.check(ui.container.querySelector('input[type="checkbox"]'));
}

test("token component rejects an unconfirmed or malformed availability response without enabling checkout", async () => {
  for (const response of [() => json({ ...catalogue(), packs: [{ id: "tokens-5", available: "false" }] }),
    () => json(catalogue(), 202), () => json(null), () => json({ ...catalogue(), packs: [null] }),
    () => json({ ...catalogue(), message: {} })]) {
    const ui = await mount(TokenShop, props, { fetch: async () => response() });
    try {
      await until(() => assert.match(ui.text(), /Tokenpakete konnten nicht geprüft|Tokenpakete können gerade nicht geladen/));
      assert.equal([...ui.container.querySelectorAll(".token-pack button")].every(button => button.disabled), true);
      assert.equal(ui.redirects.length, 0);
    } finally { await ui.close(); }
  }
});

test("a changed server token offer never enables payment for a stale displayed price or token amount", async () => {
  for (const change of [{ priceCents: 501 }, { tokens: 6 }, { currency: "EUR" }]) {
    const ui = await mount(TokenShop, props, { fetch: async () => json({ ...catalogue(), packs: [{ ...TOKEN_PACKS[0], ...change, available: true }] }) });
    try {
      await until(() => assert.match(ui.text(), /Tokenangebot hat sich geändert/));
      assert.equal([...ui.container.querySelectorAll(".token-pack button")].every(button => button.disabled), true);
      assert.equal(ui.redirects.length, 0); assert.equal(ui.storage.values.size, 0);
    } finally { await ui.close(); }
  }
});

test("a failed token status refresh closes previously available checkout and preserves the pending UUID", async () => {
  const storage = new MemoryStorage(), key = await storageKey(); storage.setItem(key, JSON.stringify(pending));
  let reads = 0, writes = 0;
  const ui = await mount(TokenShop, props, { storage, fetch: async (_url, init = {}) => {
    if (init.method === "POST") { writes++; return json(receipt); }
    if (++reads === 1) return json(catalogue());
    throw new TypeError("Failed to fetch");
  } });
  try {
    await until(() => assert.ok(ui.button(/Denselben Checkout öffnen/)));
    await ui.check(ui.container.querySelector('input[type="checkbox"]'));
    await ui.click(ui.button("Kaufstatus & Guthaben aktualisieren"));
    assert.equal(ui.button(/Denselben Checkout öffnen/).disabled, true);
    assert.doesNotMatch(ui.text(), /Failed to fetch/);
    assert.equal(JSON.parse(storage.getItem(key)).requestId, pending.requestId);
    assert.equal(writes, 0);
  } finally { await ui.close(); }
});

test("a late token checkout cannot redirect after the signed-in account changes", async () => {
  const outstanding = deferred(), storage = new MemoryStorage();
  const ui = await mount(TokenShop, props, { storage, fetch: async (_url, init = {}) => init.method === "POST" ? outstanding.promise : json(catalogue()) });
  try {
    await choose(ui); await ui.click(ui.button(/Weiter zur Zahlung/));
    const original = storage.getItem(await storageKey()); assert.ok(original);
    await ui.render({ ...props, email: otherEmail });
    await until(() => assert.ok(ui.button("Paket auswählen")));
    await act(async () => outstanding.resolve(json(receipt)));
    assert.deepEqual(ui.redirects, []);
    assert.equal(storage.getItem(await storageKey()), original);
    assert.equal(storage.getItem(await storageKey(otherEmail)), null);
    assert.equal(ui.container.querySelector('input[type="checkbox"]'), null);
  } finally { outstanding.resolve(json(receipt)); await ui.close(); }
});

test("an incomplete or 202 token checkout response retains the request and never opens payment", async () => {
  for (const response of [() => json(receipt, 202), () => json({ checkoutUrl: receipt.checkoutUrl }),
    () => json({ ...receipt, purchaseId: "wrong-purchase" }), () => new Response("<html>temporary response</html>", { headers: { "content-type": "text/html" } })]) {
    const ui = await mount(TokenShop, props, { fetch: async (_url, init = {}) => init.method === "POST" ? response() : json(catalogue()) });
    try {
      await choose(ui); await ui.click(ui.button(/Weiter zur Zahlung/));
      assert.deepEqual(ui.redirects, []);
      assert.equal(ui.storage.values.size, 1);
      assert.match(ui.text(), /bestätigt|bestätigter|Status.*unklar/);
      assert.doesNotMatch(ui.text(), /Unexpected token|JSON at position|Failed to fetch/);
    } finally { await ui.close(); }
  }
});

test("malformed token history and unrelated credit cannot erase an uncertain local request", async () => {
  for (const purchases of [[null], [{ ...credited(), tokens: "5" }], [{ ...credited(), currency: "USD" }],
    [{ ...credited(), priceCents: 0 }], [{ ...credited(), id: "unconfirmed-purchase" }], [{ ...credited(), packId: "tokens-15" }]]) {
    const storage = new MemoryStorage(), key = await storageKey(); storage.setItem(key, JSON.stringify(pending));
    const ui = await mount(TokenShop, props, { storage, fetch: async () => json({ ...catalogue(), purchases }) });
    try {
      await until(() => assert.ok(ui.button(/Denselben Checkout öffnen/) || ui.container.querySelector('[role="alert"]')));
      assert.equal(JSON.parse(storage.getItem(key)).requestId, pending.requestId);
      assert.equal(ui.redirects.length, 0);
    } finally { await ui.close(); }
  }
});

test("a late initial token catalogue cannot reopen checkout after a newer closed status", async () => {
  const first = deferred(); let reads = 0;
  const ui = await mount(TokenShop, props, { fetch: async () => ++reads === 1 ? first.promise : json({ ...catalogue(), enabled: false, message: "Synthetic latest closed status" }) });
  try {
    await until(() => assert.equal(reads, 1));
    await ui.click(ui.button("Kaufstatus & Guthaben aktualisieren"));
    assert.match(ui.text(), /Synthetic latest closed status/);
    await act(async () => first.resolve(json(catalogue())));
    assert.match(ui.text(), /Synthetic latest closed status/);
    assert.equal([...ui.container.querySelectorAll(".token-pack button")].every(button => button.disabled), true);
    assert.equal(ui.redirects.length, 0);
  } finally { first.resolve(json(catalogue())); await ui.close(); }
});

test("restoring blocked session storage reuses an existing token UUID after an explicit status refresh", async () => {
  const storage = new MemoryStorage(), key = await storageKey(), posts = [];
  storage.setItem(key, JSON.stringify(pending)); storage.blocked = true;
  const ui = await mount(TokenShop, props, { storage, fetch: async (_url, init = {}) => {
    if (init.method !== "POST") return json(catalogue());
    posts.push(JSON.parse(init.body)); return json(receipt);
  } });
  try {
    await choose(ui); await ui.click(ui.button(/Weiter zur Zahlung/));
    assert.equal(posts.length, 0); assert.match(ui.text(), /sicheren Kauf/);
    storage.blocked = false;
    await ui.click(ui.button("Kaufstatus & Guthaben aktualisieren"));
    assert.equal(posts.length, 0);
    assert.ok(ui.button(/Denselben Checkout öffnen/));
    assert.equal(ui.container.querySelector('input[type="checkbox"]').checked, false);
    await ui.check(ui.container.querySelector('input[type="checkbox"]'));
    await ui.click(ui.button(/Denselben Checkout öffnen/));
    assert.equal(posts.length, 1); assert.equal(posts[0].requestId, pending.requestId);
  } finally { await ui.close(); }
});

test("two token checkout clicks in the same event batch send only one request", async () => {
  const outstanding = deferred(), posts = [];
  const ui = await mount(TokenShop, props, { fetch: async (_url, init = {}) => {
    if (init.method !== "POST") return json(catalogue());
    posts.push(JSON.parse(init.body)); return outstanding.promise;
  } });
  try {
    await choose(ui); const button = ui.button(/Weiter zur Zahlung/);
    await act(async () => {
      button.dispatchEvent(new window.Event("click", { bubbles: true }));
      button.dispatchEvent(new window.Event("click", { bubbles: true }));
    });
    assert.equal(posts.length, 1);
    await act(async () => outstanding.resolve(json(receipt)));
    assert.deepEqual(ui.redirects, [receipt.checkoutUrl]);
  } finally { outstanding.resolve(json(receipt)); await ui.close(); }
});
