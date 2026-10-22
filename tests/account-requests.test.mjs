import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const email = "customer@example.test", origin = "https://account.example.test";
const runtime = { env: {}, actor: email };
globalThis.__accountRequestsOffline = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (["cloudflare:workers", "next/headers", "next/navigation"].includes(specifier))
      return { url: `account-request:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const path = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(path)) return next(path.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    const source = {
      "account-request:cloudflare:workers": "export const env=globalThis.__accountRequestsOffline.env;",
      "account-request:next/headers": "export async function headers(){const email=globalThis.__accountRequestsOffline.actor;return new Headers(email?{'oai-authenticated-user-email':email}:{});}",
      "account-request:next/navigation": "export function redirect(){throw new Error('Unexpected redirect');}",
    }[url];
    return source ? { format: "module", source, shortCircuit: true } : next(url, context);
  },
});
const { GET, POST } = await import("../app/api/account/route.ts");
const { planCapabilities } = await import("../app/creator-plans.ts");
class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:"); this.writes = 0; this.failAt = -1; this.uncertain = false;
    this.db.exec("PRAGMA foreign_keys=ON");
    for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()) {
      this.db.exec("BEGIN");
      this.db.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
      this.db.exec("COMMIT");
    }
  }
  prepare(query) {
    const statement = (args = []) => ({
      query, args, bind: (...args) => statement(args),
      first: async () => { const row = this.db.prepare(query).get(...args); return row ? { ...row } : null; },
      run: async () => { this.writes++; return { success: true, meta: { changes: Number(this.db.prepare(query).run(...args).changes) } }; },
    });
    return statement();
  }
  async batch(statements) {
    this.db.exec("BEGIN IMMEDIATE");
    let results;
    try {
      results = statements.map((statement, index) => {
        if (index === this.failAt) throw new Error("Synthetic database failure with internal details");
        this.writes++;
        return { success: true, meta: { changes: Number(this.db.prepare(statement.query).run(...statement.args).changes) } };
      });
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return this.uncertain ? [{ success: false }, { success: false }] : results;
  }
}
let database;
const priorFetch = globalThis.fetch, oldUnlimited = process.env.AB3D_UNLIMITED_EMAILS;
beforeEach(() => {
  database = new D1(); runtime.env.DB = database; runtime.actor = email;
  delete process.env.AB3D_UNLIMITED_EMAILS;
  globalThis.fetch = async () => { throw new Error("Account requests must not contact a provider or payment service"); };
});
afterEach(() => {
  database.db.close(); globalThis.fetch = priorFetch;
  if (oldUnlimited === undefined) delete process.env.AB3D_UNLIMITED_EMAILS; else process.env.AB3D_UNLIMITED_EMAILS = oldUnlimited;
});
after(() => { hooks.deregister(); delete globalThis.__accountRequestsOffline; });
const send = (body = { plan: "complete" }, headers = {}) => POST(new Request(`${origin}/api/account`, {
  method: "POST", headers: { origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
}));
const seed = (plan = "complete", status = "active", target = email) => database.db.prepare(
  "INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES(?,37,?,?,1,1)",
).run(target, plan, status);
const accountRow = () => database.db.prepare("SELECT token_balance,plan,subscription_status,requested_plan FROM accounts WHERE email=?").get(email);
const pending = () => database.db.prepare("SELECT email,plan,status FROM subscription_requests ORDER BY id").all().map(row => ({ ...row }));

test("subscription requests require an authenticated same-origin user before writing", async () => {
  for (const source of ["https://other.example.test", "null", ""]) {
    const response = await send(undefined, { origin: source });
    assert.equal(response.status, 403); assert.equal(database.writes, 0);
  }
  runtime.actor = null;
  assert.equal((await send()).status, 401); assert.equal(database.writes, 0);
});

test("invalid and injected subscription fields do not create an account or request", async () => {
  for (const body of [null, [], true, {}, { plan: null }, { plan: {} }, { plan: "free" }, { plan: "complete", email: "other@example.test" },
    { plan: "complete", subscriptionStatus: "active" }, { plan: "complete", tokenBalance: 100 }]) {
    const response = await send(body);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal(database.writes, 0); assert.deepEqual(pending(), []);
});

test("actual oversized or invalid streamed JSON is rejected without writes regardless of Content-Length", async () => {
  for (const advertised of [undefined, "1"]) {
    const headers = new Headers({ origin, "Content-Type": "application/json" });
    if (advertised) headers.set("content-length", advertised);
    const response = await POST(new Request(`${origin}/api/account`, { method: "POST", headers,
      body: JSON.stringify({ plan: "complete" }) + " ".repeat(1_010) }));
    assert.equal(response.status, 413);
  }
  const response = await POST(new Request(`${origin}/api/account`, { method: "POST", headers: { origin }, body: "{broken" }));
  assert.equal(response.status, 400); assert.equal(database.writes, 0);
});

test("a free account request stores only a pending wish without tokens, payment or activation", async () => {
  const response = await send(), body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.ok, true);
  assert.deepEqual(body.request, { plan: "complete", status: "pending" });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual({ ...accountRow() }, { token_balance: 0, plan: "free", subscription_status: "pending", requested_plan: "complete" });
  assert.deepEqual(pending(), [{ email, plan: "complete", status: "pending" }]);
  assert.equal(database.db.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n, 0);
});

test("a new subscription wish preserves active, trial and other existing subscription rights and balances", async () => {
  for (const [index, status] of ["active", "trialing", "past_due", "cancelled"].entries()) {
    const target = `existing-${index}@example.test`; runtime.actor = target; seed("complete", status, target);
    database.db.prepare("INSERT INTO token_ledger(email,delta,reason,created_at) VALUES(?,37,'paid-fixture',1)").run(target);
    const response = await send({ plan: "cappatex" });
    assert.equal(response.status, 200);
    const account = (await (await GET()).json()).account;
    assert.equal(account.plan, "complete"); assert.equal(account.subscriptionStatus, status);
    assert.equal(account.tokenBalance, 37); assert.equal(account.requestedPlan, "cappatex");
    assert.deepEqual(account.capabilities, planCapabilities("complete", status));
    assert.deepEqual(database.db.prepare("SELECT delta,reason FROM token_ledger WHERE email=?").all(target).map(row => ({ ...row })),
      [{ delta: 37, reason: "paid-fixture" }]);
  }
});

test("repeated and concurrent same-plan requests produce only one pending row", async () => {
  seed();
  const responses = await Promise.all(Array.from({ length: 12 }, () => send()));
  assert.ok(responses.every(response => response.status === 200));
  assert.deepEqual(pending(), [{ email, plan: "complete", status: "pending" }]);
  assert.equal(accountRow().subscription_status, "active"); assert.equal(accountRow().token_balance, 37);
});

test("deduplication is scoped to the same account, requested plan and pending status", async () => {
  seed(); seed("complete", "active", "other@example.test");
  database.db.prepare("INSERT INTO subscription_requests(email,plan,status,created_at) VALUES(?,?,'approved',1)").run(email, "complete");
  assert.equal((await send({ plan: "3d-studio" })).status, 200);
  assert.equal((await send()).status, 200);
  runtime.actor = "other@example.test"; assert.equal((await send()).status, 200);
  assert.equal(pending().length, 4);
  assert.deepEqual(pending().map(row => [row.email, row.plan, row.status]), [
    [email, "complete", "approved"], [email, "3d-studio", "pending"], [email, "complete", "pending"], ["other@example.test", "complete", "pending"],
  ]);
});

test("a failed request transaction preserves the old requested plan and exposes no database internals", async () => {
  seed(); database.db.prepare("UPDATE accounts SET requested_plan='3d-studio' WHERE email=?").run(email);
  database.failAt = 1;
  const response = await send(), body = await response.json();
  assert.equal(response.status, 503); assert.notEqual(body.ok, true);
  assert.doesNotMatch(JSON.stringify(body), /Synthetic|database failure|internal details|INSERT|accounts/);
  assert.equal(accountRow().requested_plan, "3d-studio"); assert.equal(accountRow().subscription_status, "active");
  assert.deepEqual(pending(), []);
});

test("an uncertain database acknowledgement never confirms success and an explicit repeat does not duplicate the row", async () => {
  seed(); database.uncertain = true;
  const response = await send(); assert.equal(response.status, 503); assert.notEqual((await response.json()).ok, true);
  assert.equal(pending().length, 1);
  database.uncertain = false;
  const replay = await send(); assert.equal(replay.status, 200); assert.equal((await replay.json()).ok, true);
  assert.equal(pending().length, 1); assert.equal(accountRow().token_balance, 37);
});
