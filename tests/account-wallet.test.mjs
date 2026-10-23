import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

// Exercise the production wallet functions against SQLite transactions. Provider
// fetches are forbidden, and every account and task below is synthetic.
const runtime = { env: {} };
globalThis.__accountWalletOffline = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") return { url: "wallet-fixture:workers", shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    return url === "wallet-fixture:workers"
      ? { format: "module", source: "export const env = globalThis.__accountWalletOffline.env;", shortCircuit: true }
      : next(url, context);
  },
});
const { chargeTokens, refundTokens } = await import("../db/account.ts");
const migrations = readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()
  .map(name => readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));

class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys=ON");
    for (const migration of migrations) {
      this.db.exec("BEGIN"); this.db.exec(migration); this.db.exec("COMMIT");
    }
    this.batchCalls = 0;
    this.batchReply = results => results;
    this.failBalanceRead = false;
  }
  prepare(query) {
    const statement = (args = []) => ({
      bind: (...values) => statement(values),
      first: async () => {
        if (this.failBalanceRead && query.includes("token_balance AS tokenBalance")) throw new Error("Synthetic balance read failure");
        const row = this.db.prepare(query).get(...args);
        return row ? { ...row } : null;
      },
      runSync: () => ({ success: true, meta: { changes: Number(this.db.prepare(query).run(...args).changes) } }),
      async run() { return this.runSync(); },
    });
    return statement();
  }
  async batch(statements) {
    this.batchCalls++;
    this.db.exec("BEGIN IMMEDIATE");
    let results;
    try {
      results = statements.map(statement => statement.runSync());
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    // A D1 result can be lost or incomplete after commit. Never pretend such a
    // result rolled the real database transaction back.
    return this.batchReply(results);
  }
}

const email = "wallet@example.test", taskId = "offline-wallet-task";
const priorFetch = globalThis.fetch, priorUnlimited = process.env.AB3D_UNLIMITED_EMAILS;
let database;
beforeEach(() => {
  database = new D1(); runtime.env.DB = database;
  process.env.AB3D_UNLIMITED_EMAILS = "";
  globalThis.fetch = async () => { throw new Error("Wallet tests must not contact providers or payment services"); };
  seedAccount(email, 10);
});
afterEach(() => {
  database.db.close(); globalThis.fetch = priorFetch;
  if (priorUnlimited === undefined) delete process.env.AB3D_UNLIMITED_EMAILS;
  else process.env.AB3D_UNLIMITED_EMAILS = priorUnlimited;
});
after(() => { hooks.deregister(); delete globalThis.__accountWalletOffline; });

function seedAccount(target, balance) {
  database.db.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES (?,?,'complete','active',1,1)")
    .run(target, balance);
}
function seedTask(owner = email, amount = 2) {
  database.db.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES (?,?,'text-preview',?,'PENDING',0,1,1)")
    .run(taskId, owner, amount);
}
const account = (target = email) => ({ ...database.db.prepare("SELECT token_balance,plan,subscription_status,created_at,updated_at FROM accounts WHERE email=?").get(target) });
const task = () => ({ ...database.db.prepare("SELECT email,status,refunded,token_cost,updated_at FROM generation_tasks WHERE task_id=?").get(taskId) });
const ledger = () => database.db.prepare("SELECT email,delta,reason,task_id FROM token_ledger ORDER BY id").all().map(row => ({ ...row }));
function failBefore(table, operation = "INSERT") {
  database.db.exec(`CREATE TRIGGER offline_wallet_failure BEFORE ${operation} ON ${table}
    BEGIN SELECT RAISE(ABORT, 'synthetic wallet transaction failure'); END`);
}
const removeFailure = () => database.db.exec("DROP TRIGGER offline_wallet_failure");

test("a debit and its ledger entry commit together and preserve plan entitlements", async () => {
  assert.equal(await chargeTokens(email, 2, "offline-debit"), 8);
  assert.equal(database.batchCalls, 1);
  assert.deepEqual(ledger(), [{ email, delta: -2, reason: "offline-debit", task_id: null }]);
  assert.equal(account().plan, "complete"); assert.equal(account().subscription_status, "active");
});

for (const [table, operation] of [["token_ledger", "INSERT"], ["accounts", "UPDATE"]]) {
  test(`a failing ${table} ${operation} rolls the whole debit back before an explicit retry`, async () => {
    const before = account(); failBefore(table, operation);
    await assert.rejects(chargeTokens(email, 2, "offline-debit"), /TOKEN_ACCOUNT_UNCONFIRMED/);
    assert.deepEqual(account(), before); assert.deepEqual(ledger(), []);
    assert.equal(database.batchCalls, 1, "No automatic retry or compensating write");
    removeFailure();
    assert.equal(await chargeTokens(email, 2, "offline-debit"), 8);
    assert.equal(ledger().length, 1); assert.equal(ledger()[0].delta, -2);
  });
}

test("concurrent debits cannot overdraw an account or create unbacked ledger entries", async () => {
  database.db.prepare("UPDATE accounts SET token_balance=3 WHERE email=?").run(email);
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => chargeTokens(email, 1, "offline-concurrent-debit")));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 3);
  const denied = results.filter(result => result.status === "rejected");
  assert.equal(denied.length, 7); assert.ok(denied.every(result => result.reason.message === "INSUFFICIENT_TOKENS"));
  assert.equal(account().token_balance, 0); assert.equal(ledger().length, 3);
  assert.equal(ledger().reduce((sum, row) => sum + row.delta, 0), -3);
});

test("insufficient and missing accounts cannot debit or append a ledger entry", async () => {
  await assert.rejects(chargeTokens(email, 11, "offline-debit"), /INSUFFICIENT_TOKENS/);
  await assert.rejects(chargeTokens("absent@example.test", 1, "offline-debit"), /INSUFFICIENT_TOKENS/);
  assert.equal(account().token_balance, 10); assert.deepEqual(ledger(), []);
});

test("a zero-token charge retains the existing zero-delta booking without inventing a token debit", async () => {
  assert.equal(await chargeTokens(email, 0, "offline-analysis"), 10);
  assert.deepEqual(ledger(), [{ email, delta: 0, reason: "offline-analysis", task_id: null }]);
});

test("the trusted operator charge exemption remains token-free and creates no ledger or batch write", async () => {
  process.env.AB3D_UNLIMITED_EMAILS = ` ${email.toUpperCase()} `;
  assert.equal(await chargeTokens(email, 3, "offline-operator-debit"), 10);
  assert.equal(database.batchCalls, 0); assert.deepEqual(ledger(), []);
});

for (const [table, operation] of [["generation_tasks", "UPDATE"], ["token_ledger", "INSERT"], ["accounts", "UPDATE"]]) {
  test(`a failing ${table} ${operation} rolls the refund marker, balance and ledger back together`, async () => {
    seedTask(); const beforeAccount = account(), beforeTask = task(); failBefore(table, operation);
    await assert.rejects(refundTokens(email, taskId, 2, "offline-refund"), /TOKEN_ACCOUNT_UNCONFIRMED/);
    assert.deepEqual(account(), beforeAccount); assert.deepEqual(task(), beforeTask); assert.deepEqual(ledger(), []);
    assert.equal(database.batchCalls, 1, "No automatic correction after a failed transaction");
    removeFailure();
    assert.equal(await refundTokens(email, taskId, 2, "offline-refund"), 12);
    assert.equal(task().refunded, 1); assert.equal(task().status, "FAILED");
    assert.deepEqual(ledger(), [{ email, delta: 2, reason: "offline-refund", task_id: taskId }]);
  });
}

test("parallel and repeated task refunds credit the original account exactly once", async () => {
  seedTask();
  const balances = await Promise.all(Array.from({ length: 10 }, () => refundTokens(email, taskId, 2, "offline-refund")));
  assert.ok(balances.every(balance => balance === 12));
  assert.equal(account().token_balance, 12); assert.equal(task().refunded, 1);
  assert.deepEqual(ledger(), [{ email, delta: 2, reason: "offline-refund", task_id: taskId }]);
  assert.equal(await refundTokens(email, taskId, 2, "offline-refund"), 12); assert.equal(ledger().length, 1);
});

test("foreign and unknown task identifiers cannot be refunded to the caller", async () => {
  const other = "other-wallet@example.test"; seedAccount(other, 20); seedTask(other);
  const beforeTask = task(), beforeOther = account(other);
  assert.equal(await refundTokens(email, taskId, 2, "offline-refund"), 10);
  assert.equal(await refundTokens(email, "unknown-wallet-task", 2, "offline-refund"), 10);
  assert.deepEqual(task(), beforeTask); assert.deepEqual(account(other), beforeOther);
  assert.equal(account().token_balance, 10); assert.deepEqual(ledger(), []);
});

test("a zero-cost operator task refund remains a single zero-delta record", async () => {
  process.env.AB3D_UNLIMITED_EMAILS = email; seedTask(email, 0);
  assert.equal(await refundTokens(email, taskId, 0, "offline-zero-refund"), 10);
  assert.equal(await refundTokens(email, taskId, 0, "offline-zero-refund"), 10);
  assert.equal(task().refunded, 1);
  assert.deepEqual(ledger(), [{ email, delta: 0, reason: "offline-zero-refund", task_id: taskId }]);
});

const unconfirmedReplies = [
  ["missing success", results => results.map(({ meta }) => ({ meta }))],
  ["negative success", results => results.map(result => ({ ...result, success: false }))],
  ["missing change counts", results => results.map(result => ({ ...result, meta: {} }))],
  ["string change counts", results => results.map(result => ({ ...result, meta: { changes: String(result.meta.changes) } }))],
  ["inconsistent change counts", results => results.map((result, index) => ({ ...result, meta: { changes: index === 0 ? 0 : 1 } }))],
  ["excessive change counts", results => results.map(result => ({ ...result, meta: { changes: 2 } }))],
  ["truncated response", results => results.slice(0, 1)],
];
for (const [description, reply] of unconfirmedReplies) {
  test(`a committed debit with ${description} never reports success or corrects the balance automatically`, async () => {
    database.batchReply = reply;
    await assert.rejects(chargeTokens(email, 2, "offline-debit"), /TOKEN_ACCOUNT_UNCONFIRMED/);
    assert.equal(account().token_balance, 8); assert.equal(ledger().length, 1); assert.equal(ledger()[0].delta, -2);
    assert.equal(database.batchCalls, 1, "An unconfirmed write must not be repeated or refunded automatically");
  });
  test(`a committed refund with ${description} remains uncertain and an explicit retry cannot duplicate credit`, async () => {
    seedTask(); database.batchReply = reply;
    await assert.rejects(refundTokens(email, taskId, 2, "offline-refund"), /TOKEN_ACCOUNT_UNCONFIRMED/);
    assert.equal(account().token_balance, 12); assert.equal(task().refunded, 1); assert.equal(ledger().length, 1);
    assert.equal(database.batchCalls, 1);
    database.batchReply = results => results;
    assert.equal(await refundTokens(email, taskId, 2, "offline-refund"), 12); assert.equal(ledger().length, 1);
  });
}

for (const operation of ["debit", "refund"]) {
  test(`a lost response after a committed ${operation} is not followed by a second write`, async () => {
    if (operation === "refund") seedTask();
    database.batchReply = () => { throw new Error("Synthetic response lost after commit"); };
    const action = operation === "debit" ? chargeTokens(email, 2, "offline-debit") : refundTokens(email, taskId, 2, "offline-refund");
    await assert.rejects(action, /TOKEN_ACCOUNT_UNCONFIRMED/);
    assert.equal(account().token_balance, operation === "debit" ? 8 : 12);
    assert.equal(ledger().length, 1); assert.equal(database.batchCalls, 1);
    if (operation === "refund") assert.equal(task().refunded, 1);
  });
  test(`a balance read failure after a committed ${operation} cannot report a confirmed result or trigger correction`, async () => {
    if (operation === "refund") seedTask();
    database.failBalanceRead = true;
    const action = operation === "debit" ? chargeTokens(email, 2, "offline-debit") : refundTokens(email, taskId, 2, "offline-refund");
    await assert.rejects(action, /TOKEN_ACCOUNT_UNCONFIRMED/);
    assert.equal(account().token_balance, operation === "debit" ? 8 : 12);
    assert.equal(ledger().length, 1); assert.equal(database.batchCalls, 1);
    if (operation === "refund") assert.equal(task().refunded, 1);
  });
}
