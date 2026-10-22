import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

// The production routes, account functions and migrations are real. Every identity,
// database and provider response is synthetic; no request can reach a live service.
const origin = "https://ai-input.example.test", email = "ai-input-owner@example.test";
const runtime = { env: {}, actor: email, requests: [], storageWrites: 0 };
globalThis.__aiRequestBoundaries = runtime;
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (["cloudflare:workers", "next/headers", "next/navigation"].includes(specifier)) return { url: `ai-input:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const path = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(path)) return next(path.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    const source = {
      "ai-input:cloudflare:workers": "export const env=globalThis.__aiRequestBoundaries.env;",
      "ai-input:next/headers": "export async function headers(){return new Headers({'oai-authenticated-user-email':globalThis.__aiRequestBoundaries.actor});}",
      "ai-input:next/navigation": "export function redirect(){throw new Error('Unexpected redirect');}",
    }[url];
    return source ? { format: "module", source, shortCircuit: true } : next(url, context);
  },
});
const { POST: meshy } = await import("../app/api/meshy/route.ts");
const { POST: cappatex } = await import("../app/api/cappatex/route.ts");
const { POST: assistant } = await import("../app/api/assistant/route.ts");
const { POST: planner } = await import("../app/api/design-agent/route.ts");
const { buildDesignPlan, getDesignQuestions } = await import("../app/design-planner.ts");
const routes = [
  { name: "meshy", handler: meshy, limit: 32_060_000 },
  { name: "cappatex", handler: cappatex, limit: 4_000 },
  { name: "assistant", handler: assistant, limit: 4_000 },
  { name: "design-agent", handler: planner, limit: 12_000 },
];
class D1 {
  constructor() {
    this.sql = new DatabaseSync(":memory:");
    this.sql.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort())
      this.sql.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  prepare(query) {
    const sql = this.sql;
    const statement = (args = []) => ({
      bind: (...args) => statement(args),
      first: async () => { const row = sql.prepare(query).get(...args);return row ? { ...row } : null; },
      all: async () => ({ results: sql.prepare(query).all(...args) }),
      runSync() { return { success: true, meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
      async run() { return this.runSync(); },
    });
    return statement();
  }
  async batch(statements) {
    this.sql.exec("BEGIN");
    try { const results = statements.map(statement => statement.runSync());this.sql.exec("COMMIT");return results; }
    catch (error) { this.sql.exec("ROLLBACK");throw error; }
  }
}
const settings = { OPENAI_API_KEY: "offline-fixture-never-a-real-key", MESHY_API_KEY: "offline-fixture-never-a-real-key",
  OPENAI_ASSISTANT_ENABLED: "true", CAPPATEX_GENERATION_ENABLED: "true", CAPPATEX_GENERATION_AUDIENCE: "owner",
  CAPPATEX_GENERATION_ALLOWED_EMAILS: email, AB3D_UNLIMITED_EMAILS: "", AB3D_OWNER_EMAILS: "" };
const oldSettings = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]])), oldFetch = globalThis.fetch;
let db;
beforeEach(() => {
  Object.assign(process.env, settings);
  db = new D1();runtime.env.DB = db;runtime.actor = email;runtime.requests = [];runtime.storageWrites = 0;
  runtime.env.BUCKET = { put: async () => { runtime.storageWrites++;throw new Error("Unexpected artwork write"); } };
  db.sql.prepare("INSERT INTO accounts(email,token_balance,created_at,updated_at) VALUES(?,20,0,0)").run(email);
  globalThis.fetch = async (url, init = {}) => {
    runtime.requests.push({ url: String(url), method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    assert.equal(String(url), "https://api.openai.com/v1/responses", "Only a successful planner regression may request a mocked provider");
    return Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "Offline plan", visual_intent: "Offline object" }) }] }] });
  };
});
afterEach(() => {
  db.sql.close();globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldSettings)) { if (value === undefined) delete process.env[key];else process.env[key] = value; }
});
after(() => { hook.deregister();delete globalThis.__aiRequestBoundaries; });
const request = (route, body, headers = {}) => new Request(`${origin}/api/${route.name}`, {
  method: "POST", headers: { origin, host: "ai-input.example.test", "Content-Type": "application/json", ...headers }, body,
  ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
});
function assertNoPaidWork() {
  assert.equal(runtime.requests.length, 0);
  assert.equal(runtime.storageWrites, 0);
  assert.equal(db.sql.prepare("SELECT token_balance FROM accounts WHERE email=?").get(email).token_balance, 20);
  for (const table of ["token_ledger", "ai_usage_admissions", "gallery_entries", "cappatex_designs"])
    assert.equal(db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0, table);
}

for (const route of routes) {
  for (const declared of [undefined, "1", String(route.limit + 1)]) test(`${route.name} limits actual streamed bytes with Content-Length ${declared ?? "absent"}`, async () => {
    const chunk = new Uint8Array(Math.ceil(route.limit / 2)).fill(32);
    let reads = 0, cancelled = false;
    const body = new ReadableStream({ pull(controller) { reads++;controller.enqueue(chunk); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
    const response = await route.handler(request(route, body, declared === undefined ? {} : { "content-length": declared }));
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, "request_too_large");
    assert.equal(reads, declared === String(route.limit + 1) ? 0 : 3);
    assert.equal(cancelled, declared !== String(route.limit + 1));
    assert.equal(body.locked, false);
    assertNoPaidWork();
  });
  for (const raw of ["null", "[]", "true", "42", '"text"', "{", ""]) test(`${route.name} rejects malformed or non-object JSON ${JSON.stringify(raw)} as a client error`, async () => {
    const response = await route.handler(request(route, raw));
    assert.equal(response.status, 400);
    assertNoPaidWork();
  });
  test(`${route.name} rejects malformed UTF-8 before validation or paid work`, async () => {
    const response = await route.handler(request(route, Uint8Array.of(123, 34, 120, 34, 58, 34, 0xc3, 0x28, 34, 125)));
    assert.equal(response.status, 400);
    assertNoPaidWork();
  });
}

for (const body of [{ message: 42 }, { message: {} }, { message: [] }, { message: null }]) test(`assistant rejects non-string message ${JSON.stringify(body.message)}`, async () => {
  assert.equal((await assistant(request(routes[2], JSON.stringify(body)))).status, 400);
  assertNoPaidWork();
});
for (const body of [{ templateId: 42, idea: "Eine kleine Vase" }, { templateId: "planter", idea: {} },
  { templateId: "planter", idea: "Eine kleine Vase", answers: [] }, { templateId: "planter", idea: "Eine kleine Vase", answers: { drainage: true } }]) {
  test(`planner rejects invalid input types ${JSON.stringify(body)}`, async () => {
    assert.equal((await planner(request(routes[3], JSON.stringify(body)))).status, 400);
    assertNoPaidWork();
  });
}
for (const field of ["action", "type", "prompt", "texturePrompt", "imageData", "inputTaskId", "prototypeTaskId", "candidateId", "templateId",
  "quality", "previewTaskId", "modelTaskId", "sourceTaskId", "sourceTaskType", "sourceFormat", "printReady", "willRefine", "heightCm",
  "designPlan", "visualDirection"]) test(`Meshy rejects a wrong ${field} type before admission, debit or provider dispatch`, async () => {
  const body = { action: "create", type: "image", imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB", [field]: ["designPlan", "visualDirection"].includes(field) ? [] : {} };
  assert.equal((await meshy(request(routes[0], JSON.stringify(body)))).status, 400);
  assertNoPaidWork();
});
for (const value of [{}, [], 42, null, " ", "x".repeat(201)]) test(`Meshy keycap selection rejects invalid candidate ${JSON.stringify(value)}`, async () => {
  db.sql.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES(?,?,?,1,'SUCCEEDED',0,0,0)")
    .run("fixture-prototype-12345678", email, "creative-keycap-prototype");
  const response = await meshy(request(routes[0], JSON.stringify({ action: "creative-build", templateId: "keycap", prototypeTaskId: "fixture-prototype-12345678", candidateId: value })));
  assert.equal(response.status, 400);
  assertNoPaidWork();
});

test("prototype names retain the generic planner fallback instead of resolving object properties", async () => {
  for (const templateId of ["constructor", "__proto__", "toString", "unknown-template"]) {
    const expected = buildDesignPlan("unknown-template", "Eine kleine stabile Vase");
    assert.deepEqual(getDesignQuestions(templateId), expected.questions);
    const plan = buildDesignPlan(templateId, "Eine kleine stabile Vase");
    assert.equal(plan.productName, expected.productName);
    assert.equal(plan.technicalBrief, expected.technicalBrief);
    const response = await planner(request(routes[3], JSON.stringify({ templateId, idea: "Eine kleine stabile Vase" })));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).mode, "product-rules");
  }
  assertNoPaidWork();
});
