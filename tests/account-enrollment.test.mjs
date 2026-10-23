import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const runtime = { env: {} };
globalThis.__accountEnrollmentOffline = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") return { url: "enrollment-fixture:workers", shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    return url === "enrollment-fixture:workers"
      ? { format: "module", source: "export const env = globalThis.__accountEnrollmentOffline.env;", shortCircuit: true }
      : next(url, context);
  },
});
const { accountCapabilities, ensureAccount, getTokenBalance, hasUnlimitedTokens, chargeTokens } = await import("../db/account.ts");
const { creatorPlans } = await import("../app/creator-plans.ts");
const migrations = readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()
  .map(name => ({ name, sql: readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8") }));
const zeroBonusMigration = migrations.find(migration => migration.name === "0016_powerful_tenebrous.sql");

class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys=ON");
    for (const migration of migrations) this.db.exec(migration.sql);
  }
  prepare(query) {
    const statement = (args = []) => ({
      bind: (...values) => statement(values),
      first: async () => {
        const row = this.db.prepare(query).get(...args);
        return row ? { ...row } : null;
      },
      runSync: () => ({ success: true, meta: { changes: Number(this.db.prepare(query).run(...args).changes) } }),
      async run() { return this.runSync(); },
    });
    return statement();
  }
  async batch(statements) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map(statement => statement.runSync());
      this.db.exec("COMMIT");
      return results;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}

const priorUnlimited = process.env.AB3D_UNLIMITED_EMAILS, priorFetch = globalThis.fetch;
let database;
beforeEach(() => {
  database = new D1();
  runtime.env.DB = database;
  process.env.AB3D_UNLIMITED_EMAILS = "";
  globalThis.fetch = async () => { throw new Error("Account enrollment must not call an external service"); };
});
afterEach(() => {
  database.db.close();
  globalThis.fetch = priorFetch;
  if (priorUnlimited === undefined) delete process.env.AB3D_UNLIMITED_EMAILS;
  else process.env.AB3D_UNLIMITED_EMAILS = priorUnlimited;
});
after(() => { hooks.deregister(); delete globalThis.__accountEnrollmentOffline; });

test("different new email addresses receive no automatic tokens and create no bonus ledger entries", async () => {
  const emails = Array.from({ length: 60 }, (_, index) => `synthetic-${index}@example.test`);
  for (const email of emails) {
    const account = await ensureAccount(email, "Offline customer");
    assert.equal(account.email, email);
    assert.equal(account.tokenBalance, 0);
    assert.equal(account.plan, "free");
    assert.equal(account.subscriptionStatus, "inactive");
    assert.equal(account.requestedPlan, null);
  }
  assert.equal(database.db.prepare("SELECT COUNT(*) AS total FROM accounts WHERE token_balance != 0").get().total, 0);
  assert.equal(database.db.prepare("SELECT COUNT(*) AS total FROM token_ledger").get().total, 0);
});

test("the migrated database default grants no tokens when enrollment omits the balance column", () => {
  database.db.prepare("INSERT INTO accounts(email,created_at,updated_at) VALUES ('database-default@example.test',10,10)").run();
  const account = database.db.prepare("SELECT token_balance,plan,subscription_status FROM accounts WHERE email='database-default@example.test'").get();
  assert.deepEqual({ ...account }, { token_balance: 0, plan: "free", subscription_status: "inactive" });
  assert.equal(database.db.prepare("SELECT COUNT(*) AS total FROM token_ledger").get().total, 0);
});

test("repeated and concurrent enrollment never replenishes an existing zero balance", async () => {
  const email = "repeat@example.test";
  const accounts = await Promise.all(Array.from({ length: 10 }, () => ensureAccount(email)));
  assert.ok(accounts.every(account => account.tokenBalance === 0));
  const renamed = await ensureAccount(email, "Updated name");
  assert.equal(renamed.displayName, "Updated name");
  assert.equal(renamed.tokenBalance, 0);
  assert.equal((await ensureAccount(email)).displayName, "Updated name");
  assert.equal(database.db.prepare("SELECT COUNT(*) AS total FROM accounts").get().total, 1);
  await assert.rejects(chargeTokens(email, 1, "offline-generation"), /INSUFFICIENT_TOKENS/);
  assert.equal(await getTokenBalance(email), 0);
  assert.equal(database.db.prepare("SELECT COUNT(*) AS total FROM token_ledger").get().total, 0);
});

test("existing paid and legacy balances, plans and ledger records survive enrollment unchanged", async () => {
  const fixtures = [
    { email: "legacy@example.test", balance: 4, plan: "free", status: "inactive", requestedPlan: "cappatex" },
    { email: "paid@example.test", balance: 25, plan: "complete", status: "active", requestedPlan: null },
    { email: "studio@example.test", balance: 8, plan: "studio", status: "trialing", requestedPlan: "complete" },
    { email: "spent@example.test", balance: 0, plan: "3d-studio", status: "inactive", requestedPlan: null },
  ];
  for (const fixture of fixtures) {
    database.db.prepare("INSERT INTO accounts(email,display_name,token_balance,plan,subscription_status,requested_plan,created_at,updated_at) VALUES (?,'Existing',?,?,?,?,10,10)")
      .run(fixture.email, fixture.balance, fixture.plan, fixture.status, fixture.requestedPlan);
    database.db.prepare("INSERT INTO token_ledger(email,delta,reason,created_at) VALUES (?,?,'offline-existing-credit',10)")
      .run(fixture.email, fixture.balance);
  }
  const ledgerBefore = database.db.prepare("SELECT * FROM token_ledger ORDER BY id").all();
  for (const fixture of fixtures) {
    const account = await ensureAccount(fixture.email, "Changed display name");
    assert.equal(account.tokenBalance, fixture.balance);
    assert.equal(account.plan, fixture.plan);
    assert.equal(account.subscriptionStatus, fixture.status);
    assert.equal(account.requestedPlan, fixture.requestedPlan);
    assert.equal(database.db.prepare("SELECT created_at FROM accounts WHERE email=?").get(fixture.email).created_at, 10);
  }
  assert.deepEqual(database.db.prepare("SELECT * FROM token_ledger ORDER BY id").all(), ledgerBefore);
});

test("trusted unlimited account capability remains explicit without granting ordinary new accounts tokens", async () => {
  const owner = "operator@example.test";
  process.env.AB3D_UNLIMITED_EMAILS = `  ${owner.toUpperCase()} `;
  const account = await ensureAccount(owner);
  assert.equal(account.tokenBalance, 0);
  assert.equal(hasUnlimitedTokens(owner), true);
  assert.deepEqual(accountCapabilities(account), { canUse3d: true, canUseCappatex: true, canDownload3d: true, canDownloadHd: true });
  assert.equal(await chargeTokens(owner, 3, "offline-generation"), 0);
  assert.equal(database.db.prepare("SELECT COUNT(*) AS total FROM token_ledger").get().total, 0);
  const customer = await ensureAccount("customer@example.test");
  assert.equal(hasUnlimitedTokens(customer.email), false);
  assert.deepEqual(accountCapabilities(customer), { canUse3d: true, canUseCappatex: true, canDownload3d: false, canDownloadHd: false });
});

test("enrollment does not merge different stored account identifiers or promise new account bonuses", async () => {
  const addresses = ["same@example.test", "Same@example.test", "same+other@example.test"];
  for (const email of addresses) assert.equal((await ensureAccount(email)).tokenBalance, 0);
  assert.deepEqual(database.db.prepare("SELECT email FROM accounts ORDER BY email").all().map(row => row.email), [...addresses].sort());
  const explorer = creatorPlans.find(plan => plan.id === "free");
  assert.equal(explorer.tokens, "Tokens separat erhältlich");
  assert.match(explorer.features.join(" "), /Beispiele kostenlos ansehen/);
  assert.doesNotMatch(JSON.stringify(explorer), /Start-Tokens|Gratisguthaben|20 Tokens/);
});

function legacyDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const migration of migrations.filter(migration => migration.name < "0016_")) db.exec(migration.sql);
  const fixtures = [
    ["legacy@example.test", "Legacy customer", 4, "free", "inactive", "cappatex"],
    ["paid@example.test", "Paid customer", 73, "complete", "active", null],
    ["spent@example.test", null, 0, "3d-studio", "inactive", null],
    ["trial@example.test", "Trial customer", 8, "studio", "trialing", "complete"],
  ];
  for (const [index, fixture] of fixtures.entries()) {
    const email = fixture[0], task = `legacy-task-${index}`, design = `legacy-design-${index}`;
    db.prepare("INSERT INTO accounts(email,display_name,token_balance,plan,subscription_status,requested_plan,created_at,updated_at) VALUES (?,?,?,?,?,?,10,20)")
      .run(...fixture);
    db.prepare("INSERT INTO token_ledger(email,delta,reason,created_at) VALUES (?,?,'offline-existing-credit',10)").run(email, fixture[2]);
    db.prepare("INSERT INTO subscription_requests(email,plan,status,created_at) VALUES (?,'complete','pending',10)").run(email);
    db.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES (?,?,'text',1,'SUCCEEDED',0,10,20)").run(task, email);
    db.prepare("INSERT INTO production_orders(id,email,status,source_task_id,template_name,height_mm,material,finish,quantity,estimated_total_cents,created_at,updated_at) VALUES (?,?,'inquiry',?,'Offline fixture',100,'PLA','Roh',1,1000,10,20)")
      .run(`PRINT-LEGACY${index}`, email, task);
    db.prepare("INSERT INTO cappatex_designs(id,email,prompt,production_prompt,style,product_key,preview_base64,created_at,updated_at) VALUES (?,?,'Synthetic fixture','Synthetic fixture','minimal','offline-product','',10,20)")
      .run(design, email);
    db.prepare("INSERT INTO cappatex_snapshots(id,email,design_id,payload_json,payload_sha256,state,created_at) VALUES (?,?,?,'{}',?,'prepared',10)")
      .run(`legacy-snapshot-${index}`, email, design, "a".repeat(64));
    db.prepare("INSERT INTO cappatex_preparations(id,email,request_id,request_sha256,state,created_at) VALUES (?,?,?,?,'ready',10)")
      .run(`legacy-preparation-${index}`, email, `legacy-request-${index}`, "b".repeat(64));
    db.prepare(`INSERT INTO token_purchases(id,email,request_id,request_sha256,pack_id,tokens,price_cents,country,shop_domain,snapshot_json,snapshot_sha256,status,created_at,updated_at)
      VALUES (?,?,?,?,'offline-fixture',5,500,'CH','offline-fixture.myshopify.com','{}',?,'paid',10,20)`)
      .run(`legacy-purchase-${index}`, email, `legacy-purchase-request-${index}`, "c".repeat(64), "d".repeat(64));
  }
  return db;
}

function tableSnapshots(db) {
  return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map(({ name }) => [name, db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all().map(row => ({ ...row }))]));
}

test("the zero-bonus migration preserves every legacy account and child row with foreign keys enabled", () => {
  const legacy = legacyDatabase();
  try {
    const before = tableSnapshots(legacy);
    const priorColumns = legacy.prepare("PRAGMA table_info(accounts)").all();
    assert.equal(priorColumns.find(column => column.name === "token_balance").dflt_value, "2");
    legacy.exec("BEGIN IMMEDIATE");
    legacy.exec(zeroBonusMigration.sql);
    legacy.exec("COMMIT");
    const { ai_usage_admissions, ...after } = tableSnapshots(legacy);
    assert.deepEqual(ai_usage_admissions, []);
    assert.deepEqual(after, before, "Account values, balances, plans, timestamps and all child records remain unchanged");
    assert.deepEqual(legacy.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(legacy.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    const columns = legacy.prepare("PRAGMA table_info(accounts)").all();
    assert.equal(columns.find(column => column.name === "token_balance").dflt_value, "0");
    assert.equal(columns.find(column => column.name === "_token_balance_no_bonus"), undefined);
    assert.equal(columns.length, priorColumns.length);
    legacy.prepare("INSERT INTO accounts(email,created_at,updated_at) VALUES ('after-upgrade@example.test',30,30)").run();
    assert.equal(legacy.prepare("SELECT token_balance FROM accounts WHERE email='after-upgrade@example.test'").get().token_balance, 0);
    assert.throws(() => legacy.prepare("INSERT INTO token_ledger(email,delta,reason,created_at) VALUES ('absent@example.test',1,'offline',1)").run(), /FOREIGN KEY/);
  } finally { legacy.close(); }
});

test("an interrupted zero-bonus migration rolls back copied balances, column changes and admissions schema", () => {
  const statements = zeroBonusMigration.sql.split("--> statement-breakpoint");
  const dropIndex = statements.findIndex(statement => /ALTER TABLE\s+`accounts`\s+DROP COLUMN\s+`token_balance`/i.test(statement));
  assert.ok(dropIndex > 0);
  for (const count of [dropIndex, dropIndex + 1]) {
    const legacy = legacyDatabase();
    try {
      const before = tableSnapshots(legacy);
      const schemaBefore = legacy.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").all();
      assert.throws(() => {
        legacy.exec("BEGIN IMMEDIATE");
        try {
          for (const statement of statements.slice(0, count)) legacy.exec(statement);
          throw new Error("Injected local migration interruption");
        } catch (failure) { legacy.exec("ROLLBACK"); throw failure; }
      }, /Injected local migration interruption/);
      assert.deepEqual(tableSnapshots(legacy), before);
      assert.deepEqual(legacy.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").all(), schemaBefore);
      assert.deepEqual(legacy.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(legacy.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    } finally { legacy.close(); }
  }
});
