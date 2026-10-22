import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join, dirname, basename, resolve } from "node:path";
import { Worker } from "node:worker_threads";

const runtime = { env: {} };
globalThis.__aiUsageOffline = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return specifier === "cloudflare:workers" ? { url: "ai-usage-fixture:workers", shortCircuit: true } : next(specifier, context);
  },
  load(url, context, next) {
    return url === "ai-usage-fixture:workers"
      ? { format: "module", source: "export const env = globalThis.__aiUsageOffline.env;", shortCircuit: true }
      : next(url, context);
  },
});
const { reserveAiUsage } = await import("../db/ai-usage.ts");
const migrationFiles = readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort();
const migrations = migrationFiles.map(name => ({ name, sql: readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8") }));
const LIMIT_NAMES = ["AI_ACCOUNT_10_MINUTE_LIMIT", "AI_ACCOUNT_DAILY_LIMIT", "AI_PROVIDER_DAILY_LIMIT"];
const ENV_NAMES = [...LIMIT_NAMES, "AB3D_OWNER_EMAILS", "AB3D_UNLIMITED_EMAILS"];
const priorEnv = Object.fromEntries(ENV_NAMES.map(name => [name, process.env[name]]));
const priorFetch = globalThis.fetch;
const now = Date.UTC(2026, 9, 22, 12), DAY = 86_400_000;
const services = ["meshy", "cappatex", "assistant", "planner"];
let database, fetches;

class D1 {
  constructor(path = ":memory:", migrate = true) {
    this.db = new DatabaseSync(path); this.queries = []; this.response = null; this.fail = false; this.failRead = false;
    this.db.exec("PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON");
    if (migrate) for (const migration of migrations) this.applyMigration(migration.sql);
  }
  applyMigration(sql) {
    this.db.exec("BEGIN IMMEDIATE");
    try { this.db.exec(sql); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  prepare(query) {
    this.queries.push(query);
    const statement = (args = []) => ({
      bind: (...values) => statement(values),
      run: async () => {
        if (this.fail) throw new Error("PRIVATE SQLITE PATH /private/customer-and-secret");
        const result = this.db.prepare(query).run(...args);
        return this.response ?? { success: true, meta: { changes: Number(result.changes) } };
      },
      first: async () => {
        if (this.failRead) throw new Error("PRIVATE SQLITE READ DETAIL");
        const row = this.db.prepare(query).get(...args); return row ? { ...row } : null;
      },
    });
    return statement();
  }
}
beforeEach(() => {
  database = new D1(); runtime.env.DB = database; fetches = 0;
  for (const name of ENV_NAMES) delete process.env[name];
  globalThis.fetch = async () => { fetches++; throw new Error("External network forbidden in admission tests"); };
});
afterEach(() => {
  database.db.close(); globalThis.fetch = priorFetch;
  assert.equal(fetches, 0, "Usage checks must never make provider calls");
  for (const [name, value] of Object.entries(priorEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});
after(() => { hooks.deregister(); delete globalThis.__aiUsageOffline; });
const rows = () => database.db.prepare("SELECT * FROM ai_usage_admissions ORDER BY created_at,id").all().map(row => ({ ...row }));
const allow = (email = "customer@example.test", service = "cappatex", timestamp = now) => reserveAiUsage(email, service, timestamp);
const highLimits = () => { for (const name of LIMIT_NAMES) process.env[name] = "100000"; };

test("a single persistent account ceiling covers all four services and stores no raw email or prompts", async () => {
  const results = await Promise.all(Array.from({ length: 13 }, (_, index) => allow(undefined, services[index % 4])));
  assert.equal(results.filter(result => result.allowed).length, 12);
  const denied = results.find(result => !result.allowed);
  assert.equal(denied.status, 429); assert.equal(denied.code, "ai_usage_account_rate_limit"); assert.equal(denied.retryAfterSeconds, 600);
  const stored = rows(); assert.equal(stored.length, 12);
  assert.equal(new Set(stored.map(row => row.id)).size, 12);
  assert.ok(stored.every(row => /^[a-f0-9]{64}$/.test(row.account_hash) && services.includes(row.service) && row.created_at === now));
  assert.doesNotMatch(JSON.stringify(stored), /customer|example|@|prompt|image|token_balance/i);
  const inserts = database.queries.filter(query => query.startsWith("INSERT"));
  assert.equal(inserts.length, 13);
  assert.ok(inserts.every(query => (query.match(/SELECT COUNT\(\*\)/g) || []).length === 3), "All checks belong to the same atomic INSERT");
});

test("trimmed lower-case account hashes prevent case and whitespace from resetting the quota", async () => {
  process.env.AI_ACCOUNT_10_MINUTE_LIMIT = "1";
  assert.equal((await allow(" Customer@Example.Test ")).allowed, true);
  assert.equal((await allow("customer@example.test")).status, 429);
  assert.equal(rows().length, 1);
});

test("a rolling window is inclusive until the exact expiry and survives a fresh database wrapper", async () => {
  process.env.AI_ACCOUNT_10_MINUTE_LIMIT = "1";
  assert.equal((await allow()).allowed, true);
  assert.equal((await allow(undefined, "meshy", now + 599_999)).retryAfterSeconds, 1);
  runtime.env.DB = { prepare: query => database.prepare(query) };
  assert.equal((await allow(undefined, "planner", now + 600_000)).allowed, true);
  assert.equal(rows().length, 2, "Reservations are retained, not deleted when their burst window expires");
});

test("the default 30-attempt UTC account day ceiling is shared across the studios", async () => {
  process.env.AI_ACCOUNT_10_MINUTE_LIMIT = "100000";
  for (let index = 0; index < 30; index++) assert.equal((await allow(undefined, services[index % 4])).allowed, true);
  const denied = await allow(); assert.equal(denied.code, "ai_usage_account_daily_limit");
  assert.equal(denied.retryAfterSeconds, 43_200); assert.equal(rows().length, 30);
});

test("email rotation cannot exceed the default shared 100-attempt provider day ceiling", async () => {
  const results = await Promise.all(Array.from({ length: 130 }, (_, index) => allow(`alias-${index}@example.test`, services[index % 4])));
  assert.equal(results.filter(result => result.allowed).length, 100);
  assert.ok(results.filter(result => !result.allowed).every(result => result.code === "ai_usage_provider_daily_limit" && result.retryAfterSeconds === 43_200));
  assert.equal(rows().length, 100);
});

test("UTC daily limits reset at midnight while an account burst continues across midnight", async () => {
  const dayEnd = Math.floor(now / DAY) * DAY + DAY;
  process.env.AI_PROVIDER_DAILY_LIMIT = "2";
  assert.equal((await allow("first@example.test", "meshy", dayEnd - 1)).allowed, true);
  assert.equal((await allow("second@example.test", "cappatex", dayEnd - 1)).allowed, true);
  const denied = await allow("third@example.test", "planner", dayEnd - 1);
  assert.equal(denied.code, "ai_usage_provider_daily_limit"); assert.equal(denied.retryAfterSeconds, 1);
  assert.equal((await allow("third@example.test", "planner", dayEnd)).allowed, true);
  process.env.AI_ACCOUNT_10_MINUTE_LIMIT = "1";
  const burst = await allow("first@example.test", "assistant", dayEnd);
  assert.equal(burst.code, "ai_usage_account_rate_limit"); assert.equal(burst.retryAfterSeconds, 600);
});

test("each zero-valued limit blocks instead of disabling the guard", async () => {
  for (const name of LIMIT_NAMES) {
    highLimits(); process.env[name] = "0";
    const result = await allow(); assert.equal(result.allowed, false); assert.equal(result.status, 429);
  }
  assert.equal(rows().length, 0);
});

test("only bounded decimal integer configuration is accepted and invalid values fail before any write", async () => {
  for (const name of LIMIT_NAMES) {
    for (const invalid of ["", " ", "-1", "+1", "1.0", "1e2", "Infinity", "NaN", "12x", " 12", "12 ", "01", "100001", "1000000"]) {
      highLimits(); process.env[name] = invalid;
      const result = await allow(); assert.equal(result.status, 503, `${name}=${JSON.stringify(invalid)}`);
      assert.equal(result.code, "ai_usage_unavailable");
    }
  }
  assert.equal(database.queries.length, 0); assert.equal(rows().length, 0);
  highLimits(); assert.equal((await allow()).allowed, true);
});

test("operators and unlimited-token accounts receive no quota bypass", async () => {
  const email = "operator@example.test";
  process.env.AB3D_OWNER_EMAILS = email; process.env.AB3D_UNLIMITED_EMAILS = email; process.env.AI_ACCOUNT_10_MINUTE_LIMIT = "1";
  assert.equal((await allow(email)).allowed, true);
  assert.equal((await allow(email, "meshy")).status, 429);
  assert.equal(rows().length, 1);
});

test("an uncertain successful write fails closed and keeps its admission for subsequent attempts", async () => {
  process.env.AI_ACCOUNT_10_MINUTE_LIMIT = "1";
  database.response = { success: true, meta: {} };
  assert.equal((await allow()).status, 503); assert.equal(rows().length, 1);
  database.response = null;
  assert.equal((await allow()).status, 429); assert.equal(rows().length, 1);
});

test("failed or malformed D1 responses cannot report an admitted provider request", async () => {
  for (const response of [{ success: false, meta: { changes: 1 } }, { success: true, meta: { changes: 2 } }, { success: true }, {}]) {
    database.response = response;
    const result = await allow(); assert.equal(result.status, 503);
    assert.doesNotMatch(JSON.stringify(result), /SQLITE|PRIVATE|@|secret|SELECT|INSERT|binding/);
  }
  assert.equal(rows().length, 4, "An uncertain response never rolls back or retries a possible admission");
});

test("missing migration or binding and database errors fail closed without exposing internal details", async () => {
  const goodDb = runtime.env.DB;
  delete runtime.env.DB;
  assert.equal((await allow()).status, 503);
  runtime.env.DB = goodDb; database.fail = true;
  const failed = await allow(); assert.equal(failed.status, 503);
  assert.doesNotMatch(JSON.stringify(failed), /PRIVATE|SQLITE|customer|secret/);
  database.fail = false;
  database.db.exec("DROP TABLE ai_usage_admissions");
  assert.equal((await allow()).status, 503);
});

test("a failed denial explanation never turns into an admission or exposes database details", async () => {
  process.env.AI_ACCOUNT_10_MINUTE_LIMIT = "0"; database.failRead = true;
  const result = await allow(); assert.equal(result.status, 503);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|SQLITE|READ/); assert.equal(rows().length, 0);
});

test("invalid internal identity, service and clock arguments fail without touching the database", async () => {
  for (const [email, service, timestamp] of [["", "meshy", now], [" ", "meshy", now], [null, "meshy", now],
    ["a".repeat(321), "meshy", now], ["customer@example.test", "other", now], ["customer@example.test", "meshy", -1],
    ["customer@example.test", "meshy", NaN], ["customer@example.test", "meshy", 1.1], ["customer@example.test", "meshy", Number.MAX_SAFE_INTEGER]]) {
    assert.equal((await reserveAiUsage(email, service, timestamp)).status, 503);
  }
  assert.equal(database.queries.length, 0);
});

test("the usage migration preserves existing account balances and can admit new accounts without an account-row dependency", async () => {
  const usageIndex = migrations.findIndex(migration => /CREATE TABLE\s+[`"]?ai_usage_admissions/.test(migration.sql));
  assert.ok(usageIndex >= 0, "A checked-in local migration creates the admission table");
  const old = new D1(":memory:", false);
  try {
    for (const migration of migrations.slice(0, usageIndex)) old.applyMigration(migration.sql);
    old.db.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES ('existing@example.test',17,'free','inactive',1,1)").run();
    for (const migration of migrations.slice(usageIndex)) old.applyMigration(migration.sql);
    assert.equal(old.db.prepare("SELECT token_balance FROM accounts WHERE email='existing@example.test'").get().token_balance, 17);
    runtime.env.DB = old;
    assert.equal((await allow("not-an-account-row@example.test")).allowed, true, "The route must separately check account credit before this guard");
    assert.equal(old.db.prepare("SELECT COUNT(*) AS total FROM accounts").get().total, 1);
    const indexes = old.db.prepare("PRAGMA index_list(ai_usage_admissions)").all();
    assert.ok(indexes.length >= 3, "Primary key, account/time and shared time indexes exist");
  } finally { old.db.close(); runtime.env.DB = database; }
});

// Separate Node workers use independent SQLite connections and start together. This
// exercises the real atomic SQL write under contention, not a mocked count check.
async function concurrentAdmissions({ globalLimit, burstLimit, sameAccount, attempts = 30 }) {
  const temporaryRoot = resolve(tmpdir());
  const directory = mkdtempSync(join(temporaryRoot, "ab3d-admission-offline-")), path = join(directory, "usage.sqlite");
  const seed = new D1(path); seed.db.exec("PRAGMA journal_mode=WAL"); seed.db.close();
  const moduleUrl = new URL("../db/ai-usage.ts", import.meta.url).href;
  const workerSource = `
    const { parentPort, workerData } = require('node:worker_threads');
    const { registerHooks } = require('node:module');
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(workerData.path);
    db.exec('PRAGMA busy_timeout=10000');
    globalThis.__admissionWorker = { prepare(query) {
      const statement = (args=[]) => ({ bind:(...values)=>statement(values),
        run:async()=>({success:true,meta:{changes:Number(db.prepare(query).run(...args).changes)}}),
        first:async()=>db.prepare(query).get(...args) ?? null });
      return statement();
    }};
    registerHooks({ resolve(specifier,context,next){return specifier==='cloudflare:workers'?{url:'usage-worker:env',shortCircuit:true}:next(specifier,context);},
      load(url,context,next){return url==='usage-worker:env'?{format:'module',source:'export const env={DB:globalThis.__admissionWorker};',shortCircuit:true}:next(url,context);} });
    process.env.AI_ACCOUNT_10_MINUTE_LIMIT=String(workerData.burstLimit);
    process.env.AI_ACCOUNT_DAILY_LIMIT='100000'; process.env.AI_PROVIDER_DAILY_LIMIT=String(workerData.globalLimit);
    import(workerData.moduleUrl).then(({reserveAiUsage})=> {
      parentPort.postMessage({ready:true});
      parentPort.once('message', async()=> {
        const results = await Promise.all(Array.from({length:workerData.attempts},(_,index)=>reserveAiUsage(
          workerData.sameAccount?'shared@example.test':'worker-'+workerData.index+'-'+index+'@example.test',
          ['meshy','cappatex','assistant','planner'][index%4],workerData.now)));
        db.close(); parentPort.postMessage({results});
      });
    }).catch(error=>{parentPort.postMessage({failure:String(error)});process.exitCode=1;db.close();});
  `;
  const workers = [], pending = [];
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Offline SQLite workers timed out")), 10_000); });
  try {
    for (let index = 0; index < 4; index++) {
      const worker = new Worker(workerSource, { eval: true, workerData: { path, moduleUrl, index, now, globalLimit, burstLimit, sameAccount, attempts } });
      workers.push(worker);
      let readyResolve;
      const ready = new Promise(resolve => { readyResolve = resolve; });
      const done = new Promise((resolve, reject) => {
        worker.on("error", reject);
        worker.on("message", value => { if (value.ready) readyResolve(); else if (value.failure) reject(new Error(value.failure)); else resolve(value.results); });
        worker.on("exit", code => { if (code) reject(new Error(`Offline SQLite worker exited ${code}`)); });
      });
      // A worker can fail before its ready signal. Keep the eventual rejection
      // handled while the bounded ready wait is still in progress.
      done.catch(() => {});
      pending.push({ ready, done });
    }
    await Promise.race([Promise.all(pending.map(item => item.ready)), deadline]); workers.forEach(worker => worker.postMessage("start"));
    const results = (await Promise.race([Promise.all(pending.map(item => item.done)), deadline])).flat();
    const verify = new DatabaseSync(path);
    try { return { results, rows: Number(verify.prepare("SELECT COUNT(*) AS total FROM ai_usage_admissions").get().total) }; }
    finally { verify.close(); }
  } finally {
    clearTimeout(timer);
    await Promise.all(workers.map(worker => worker.terminate()));
    assert.equal(dirname(resolve(directory)), temporaryRoot);
    assert.ok(basename(directory).startsWith("ab3d-admission-offline-"), "Cleanup is restricted to this fixture's fresh temporary directory");
    rmSync(directory, { recursive: true, force: true });
  }
}

test("four concurrent SQLite writers and rotating email addresses cannot overspend the shared 100-attempt limit", async () => {
  const result = await concurrentAdmissions({ globalLimit: 100, burstLimit: 100000, sameAccount: false });
  assert.equal(result.rows, 100); assert.equal(result.results.filter(value => value.allowed).length, 100);
  assert.equal(result.results.filter(value => value.status === 429).length, 20);
  assert.ok(result.results.filter(value => !value.allowed).every(value => value.code === "ai_usage_provider_daily_limit"));
});

test("four concurrent SQLite writers share a single account allowance without double admission", async () => {
  const result = await concurrentAdmissions({ globalLimit: 100000, burstLimit: 12, sameAccount: true, attempts: 8 });
  assert.equal(result.rows, 12); assert.equal(result.results.filter(value => value.allowed).length, 12);
  assert.equal(result.results.filter(value => value.status === 429).length, 20);
  assert.ok(result.results.filter(value => !value.allowed).every(value => value.code === "ai_usage_account_rate_limit"));
});
