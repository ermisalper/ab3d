import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

// Real production handlers, account operations and admission SQL. Only identity,
// D1 and provider responses are local; fetch can never reach a live API.
const email = "assistant-owner@example.test", origin = "https://app.example.test";
const runtime = { env: {}, actor: email, requests: [] };
globalThis.__assistantOfflineAccess = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (["cloudflare:workers", "next/headers", "next/navigation"].includes(specifier))
      return { url: `assistant-fixture:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const path = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(path)) return next(path.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    const source = {
      "assistant-fixture:cloudflare:workers": "export const env=globalThis.__assistantOfflineAccess.env;",
      "assistant-fixture:next/headers": "export async function headers(){const email=globalThis.__assistantOfflineAccess.actor;return new Headers(email?{'oai-authenticated-user-email':email}:{});}",
      "assistant-fixture:next/navigation": "export function redirect(){throw new Error('Unexpected redirect');}",
    }[url];
    return source ? { format: "module", source, shortCircuit: true } : next(url, context);
  },
});
const { POST: assistant } = await import("../app/api/assistant/route.ts");
const { POST: planner } = await import("../app/api/design-agent/route.ts");
const { buildDesignPlan } = await import("../app/design-planner.ts");
const answers = {};
let completePlan = buildDesignPlan("planter", "Ein schlichter Topf für eine kleine Pflanze", answers);
for (let round = 0; round < 4 && !completePlan.complete; round++) {
  for (const question of completePlan.questions) answers[question.id] ||= question.options[0].value;
  completePlan = buildDesignPlan("planter", completePlan.customerIdea, answers);
}
assert.equal(completePlan.complete, true, "The real planner must reach the live enhancement gate");
const routes = [
  { name: "assistant", handler: assistant, body: { message: "Welche Materialien gibt es?" }, fallback: "guide", service: "assistant" },
  { name: "design-agent", handler: planner, body: { templateId: "planter", idea: completePlan.customerIdea, answers }, fallback: "product-rules", service: "planner" },
];

class OfflineD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter(file => file.endsWith(".sql")).sort())
      this.sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  prepare(sql) {
    const sqlite = this.sqlite;
    const statement = (args = []) => ({
      bind: (...args) => statement(args),
      first: async () => { const row = sqlite.prepare(sql).get(...args); return row ? { ...row } : null; },
      async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
    });
    return statement();
  }
}
const envNames = ["OPENAI_ASSISTANT_ENABLED", "OPENAI_API_KEY", "AB3D_UNLIMITED_EMAILS", "AI_ACCOUNT_10_MINUTE_LIMIT", "AI_ACCOUNT_DAILY_LIMIT", "AI_PROVIDER_DAILY_LIMIT"];
const oldEnv = Object.fromEntries(envNames.map(key => [key, process.env[key]])), oldFetch = globalThis.fetch;
let db;
beforeEach(() => {
  db = new OfflineD1();runtime.env.DB = db;runtime.actor = email;runtime.requests = [];
  for (const key of envNames) delete process.env[key];
  process.env.OPENAI_ASSISTANT_ENABLED = "true";
  process.env.OPENAI_API_KEY = "offline-fixture-not-a-real-key";
  db.sqlite.prepare("INSERT INTO accounts(email,token_balance,created_at,updated_at) VALUES(?,20,0,0)").run(email);
  globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses", "Only synthetic OpenAI responses are allowed");
    assert.equal(init.method, "POST");runtime.requests.push(String(url));
    const body = JSON.parse(init.body);
    const text = body.text.format ? JSON.stringify({ summary: "Fixture enhancement", visual_intent: "Fixture intent" }) : "Fixture answer";
    return Response.json({ output: [{ content: [{ type: "output_text", text }] }] });
  };
});
afterEach(() => {
  db.sqlite.close();globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key];else process.env[key] = value;
  }
});
after(() => { hooks.deregister();delete globalThis.__assistantOfflineAccess; });
const invoke = route => route.handler(new Request(`${origin}/api/${route.name}`, {
  method: "POST", headers: { origin, host: "app.example.test", "Content-Type": "application/json" }, body: JSON.stringify(route.body),
}));
const admissions = () => db.sqlite.prepare("SELECT COUNT(*) AS n FROM ai_usage_admissions").get().n;
const assertNoDebit = () => {
  assert.equal(db.sqlite.prepare("SELECT token_balance FROM accounts WHERE email=?").get(email).token_balance, 20);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n, 0);
};

for (const route of routes) {
  test(`${route.name} makes no API request without explicit provider cost approval`, async () => {
    for (const flag of [undefined, "false", "TRUE", "1"]) {
      if (flag === undefined) delete process.env.OPENAI_ASSISTANT_ENABLED;else process.env.OPENAI_ASSISTANT_ENABLED = flag;
      const response = await invoke(route);
      assert.equal(response.status, 200);assert.equal((await response.json()).mode, route.fallback);
    }
    assert.equal(runtime.requests.length, 0);assert.equal(admissions(), 0);assertNoDebit();
  });

  test(`${route.name} keeps its free fallback without a key or signed-in user`, async () => {
    delete process.env.OPENAI_API_KEY;
    assert.equal((await (await invoke(route)).json()).mode, route.fallback);
    process.env.OPENAI_API_KEY = "offline-fixture-not-a-real-key";runtime.actor = null;
    assert.equal((await (await invoke(route)).json()).mode, route.fallback);
    assert.equal(runtime.requests.length, 0);assert.equal(admissions(), 0);assertNoDebit();
  });

  test(`${route.name} calls the mocked API only with approval, a funded account and shared admission`, async () => {
    const response = await invoke(route);
    assert.equal(response.status, 200);assert.equal((await response.json()).mode, "ai");
    assert.deepEqual(runtime.requests, ["https://api.openai.com/v1/responses"]);assert.equal(admissions(), 1);assertNoDebit();
    assert.equal(db.sqlite.prepare("SELECT service FROM ai_usage_admissions").get().service, route.service);
  });

  test(`${route.name} new email accounts receive the free deterministic response without consuming provider capacity`, async () => {
    runtime.actor = "fresh-email@example.test";
    const response = await invoke(route);
    assert.equal(response.status, 200);assert.equal((await response.json()).mode, route.fallback);
    assert.equal(db.sqlite.prepare("SELECT token_balance FROM accounts WHERE email=?").get(runtime.actor).token_balance, 0);
    assert.equal(runtime.requests.length, 0);assert.equal(admissions(), 0);assertNoDebit();
  });

  for (const issue of ["limit", "missing migration", "unknown write"]) test(`${route.name} ${issue} preserves free guidance and blocks paid requests`, async () => {
    if (issue === "limit") process.env.AI_PROVIDER_DAILY_LIMIT = "0";
    if (issue === "missing migration") db.sqlite.exec("DROP TABLE ai_usage_admissions");
    if (issue === "unknown write") {
      const prepare = db.prepare.bind(db);
      db.prepare = sql => {
        const statement = prepare(sql);
        return sql.startsWith("INSERT INTO ai_usage_admissions") ? { bind: (...args) => ({ run: async () => {
          await statement.bind(...args).run();return { success: true, meta: {} };
        } }) } : statement;
      };
    }
    const response = await invoke(route), body = await response.json();
    assert.equal(response.status, 200);assert.equal(body.mode, route.fallback);assert.ok(body.note);
    assert.equal(runtime.requests.length, 0);assertNoDebit();
  });

  test(`${route.name} unlimited-token entitlement permits live assistance but never bypasses provider limits`, async () => {
    process.env.AB3D_UNLIMITED_EMAILS = email;
    db.sqlite.prepare("UPDATE accounts SET token_balance=0 WHERE email=?").run(email);
    assert.equal((await (await invoke(route)).json()).mode, "ai");assert.equal(runtime.requests.length, 1);
    process.env.AI_PROVIDER_DAILY_LIMIT = "1";
    assert.equal((await (await invoke(route)).json()).mode, route.fallback);assert.equal(runtime.requests.length, 1);
    assert.equal(admissions(), 1);assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n, 0);
  });
}

test("assistant and planner consume the same account and provider allowance", async () => {
  process.env.AI_ACCOUNT_10_MINUTE_LIMIT = "1";
  assert.equal((await (await invoke(routes[0])).json()).mode, "ai");
  const response = await invoke(routes[1]);
  assert.equal((await response.json()).mode, "product-rules");assert.ok(Number(response.headers.get("retry-after")) > 0);
  assert.equal(runtime.requests.length, 1);assert.equal(admissions(), 1);assertNoDebit();
});
