import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const owner = "operator@example.test", customer = "customer@example.test", other = "other@example.test";
const origin = "https://ab3d.example.test", id = "PRINT-ABCDE00001", taskId = "converted-offline-0001", previewTaskId = "resized-offline-0001";
const runtime = { env: {}, actor: owner };
globalThis.__ab3dOperationsOffline = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (["cloudflare:workers", "next/headers", "next/navigation"].includes(specifier)) return { url: `operations-fixture:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    const source = {
      "operations-fixture:cloudflare:workers": "export const env = globalThis.__ab3dOperationsOffline.env;",
      "operations-fixture:next/headers": "export async function headers(){return new Headers(globalThis.__ab3dOperationsOffline.actor?{'oai-authenticated-user-email':globalThis.__ab3dOperationsOffline.actor}:{});}",
      "operations-fixture:next/navigation": "export function redirect(){throw new Error('Unexpected redirect');}",
    }[url];
    return source ? { format: "module", source, shortCircuit: true } : next(url, context);
  },
});
const { GET: list } = await import("../app/api/ab3d/operations/route.ts");
const { GET: detail, PATCH: save } = await import("../app/api/ab3d/operations/[id]/route.ts");
const { GET: file } = await import("../app/api/ab3d/operations/[id]/file/route.ts");
const { GET: customerList, PATCH: legacyPatch } = await import("../app/api/production-orders/route.ts");
const { GET: customerFile } = await import("../app/api/meshy/route.ts");

class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:"); this.writes = 0; this.failBatchAt = -1; this.afterBatch = null;
    this.db.exec("PRAGMA foreign_keys=ON");
    for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()) this.db.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  prepare(query) {
    const db = this.db;
    const statement = (args = []) => ({
      query, args, bind: (...values) => statement(values),
      first: async () => { const row = db.prepare(query).get(...args); return row ? { ...row } : null; },
      all: async () => ({ success: true, results: db.prepare(query).all(...args).map(row => ({ ...row })) }),
      run: async () => { this.writes++; return { success: true, meta: { changes: Number(db.prepare(query).run(...args).changes) } }; },
    });
    return statement();
  }
  async batch(statements) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement, index) => {
        if (this.failBatchAt === index) { this.failBatchAt = -1; throw new Error("Injected SQLite batch failure"); }
        this.writes++;
        return { success: true, meta: { changes: Number(this.db.prepare(statement.query).run(...statement.args).changes) } };
      });
      this.db.exec("COMMIT"); if (this.afterBatch) { const fn = this.afterBatch; this.afterBatch = null; await fn(); } return results;
    } catch (failure) { this.db.exec("ROLLBACK"); throw failure; }
  }
}
const envNames = ["AB3D_OWNER_EMAILS", "AB3D_UNLIMITED_EMAILS", "CAPPATEX_GENERATION_ALLOWED_EMAILS", "MESHY_API_KEY"];
const previousEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]])), priorFetch = globalThis.fetch;
let db, calls, taskResponse, assetResponse;
beforeEach(() => {
  db = new D1(); runtime.env.DB = db; runtime.actor = owner; calls = [];
  process.env.AB3D_OWNER_EMAILS = owner; process.env.AB3D_UNLIMITED_EMAILS = "";
  process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS = other; process.env.MESHY_API_KEY = "offline-key-not-a-real-secret";
  for (const email of [owner, customer, other]) db.db.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES (?,4,'free','inactive',0,0)").run(email);
  db.db.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES (?,?,'convert',0,'SUCCEEDED',0,0,0)").run(taskId, customer);
  db.db.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES (?,?,'resize',0,'SUCCEEDED',0,0,0)").run(previewTaskId, customer);
  db.db.prepare("UPDATE generation_tasks SET parent_task_id=? WHERE task_id=?").run(previewTaskId, taskId);
  addOrder();
  taskResponse = () => Response.json({ id: taskId, status: "SUCCEEDED", model_urls: {
    stl: "https://assets.meshy.ai/offline/model.stl", "3mf": "https://assets.meshy.ai/offline/model.3mf",
  } });
  assetResponse = url => {
    const format = new URL(url).pathname.split(".").at(-1);
    if (format === "glb") { const bytes = new Uint8Array(12); bytes.set([0x67, 0x6c, 0x54, 0x46]); new DataView(bytes.buffer).setUint32(4, 2, true); new DataView(bytes.buffer).setUint32(8, 12, true); return new Response(bytes, { headers: { "content-type": "model/gltf-binary" } }); }
    if (format === "3mf") return new Response(new Uint8Array([0x50, 0x4b, 3, 4, 0]), { headers: { "content-type": "application/zip" } });
    const bytes = new Uint8Array(134); new DataView(bytes.buffer).setUint32(80, 1, true);
    return new Response(bytes, { headers: { "content-type": "application/octet-stream", "content-length": "134" } });
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options }); assert.equal(options.method, "GET", "Inspection never makes paid or production calls");
    assert.equal(options.redirect, "manual"); assert.ok(options.signal);
    if (url === `https://api.meshy.ai/openapi/v1/convert/${taskId}`) { assert.equal(options.headers.Authorization, "Bearer offline-key-not-a-real-secret"); return taskResponse(); }
    if ([`https://api.meshy.ai/openapi/v1/resize/${previewTaskId}`, `https://api.meshy.ai/openapi/v1/print/repair/${previewTaskId}`].includes(url)) {
      assert.equal(options.headers.Authorization, "Bearer offline-key-not-a-real-secret");
      return Response.json({ id: previewTaskId, status: "SUCCEEDED", model_urls: { glb: "https://assets.meshy.ai/offline/model.glb?signature=private-fixture" } });
    }
    assert.equal(new URL(url).hostname, "assets.meshy.ai"); assert.equal(options.headers.Authorization, undefined, "Asset downloads never receive the provider API key");
    assert.equal(options.headers["Accept-Encoding"], "identity");
    return assetResponse(url);
  };
});
afterEach(() => { db.db.close(); globalThis.fetch = priorFetch; });
after(() => {
  hooks.deregister(); delete globalThis.__ab3dOperationsOffline;
  for (const [name, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});
function addOrder(orderId = id, at = 100, status = "inquiry", email = customer, task = taskId) {
  db.db.prepare(`INSERT INTO production_orders(id,email,status,source_task_id,source_task_type,template_name,height_mm,material,finish,quantity,estimated_total_cents,currency,request_details_json,created_at,updated_at)
    VALUES (?,?,?,?,'convert','Eigene Idee',200,'PLA','Roh',2,9000,'CHF',?,?,?)`).run(orderId, email, status, task,
    JSON.stringify({ name: "Anna Kunde", country: "CH", postalCode: "8000", city: "Zürich", customerNote: "Bitte Stand prüfen." }), at, at);
  return orderId;
}
const ctx = (orderId = id) => ({ params: Promise.resolve({ id: orderId }) });
const req = (path = "", method = "GET", body, headers = {}) => new Request(`${origin}/api/ab3d/operations${path}`, {
  method, headers: { origin, "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const getDetail = (orderId = id) => detail(req(`/${orderId}`), ctx(orderId));
const patch = (body = { state: "reviewing", notes: "Private Produktionsnotiz", version: 0 }, orderId = id, headers = {}) => save(req(`/${orderId}`, "PATCH", body, headers), ctx(orderId));
const inspect = (format = "stl", orderId = id, extra = "") => file(req(`/${orderId}/file?format=${format}${extra}`), ctx(orderId));
const rows = table => db.db.prepare(`SELECT * FROM ${table}`).all().map(row => ({ ...row }));

test("operations require a configured owner; generation allowlists and customer ownership never grant access", async () => {
  for (const [actor, status] of [[null, 401], [customer, 403], [other, 403]]) {
    runtime.actor = actor;
    for (const response of [await list(req()), await getDetail(), await patch(), await inspect()]) {
      assert.equal(response.status, status); assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
  }
  assert.equal(db.writes, 0); assert.equal(calls.length, 0);
});

test("owner GET list and detail do not write, expose only internal paths, and preserve exact inquiry context", async () => {
  const listing = await (await list(req())).json(), response = await getDetail(), result = await response.json();
  assert.equal(listing.orders.length, 1); assert.deepEqual(listing.counts, [{ state: "new", total: 1 }]);
  assert.equal(result.order.email, customer); assert.equal(result.order.heightMm, 200); assert.equal(result.order.quantity, 2);
  assert.equal(result.order.requestDetails.city, "Zürich"); assert.equal(result.order.sourceTaskStatus, "SUCCEEDED");
  assert.deepEqual(result.order.review, { state: "new", version: 0, updatedAt: null, notes: "", updatedBy: null });
  assert.equal(result.files.stl, `/api/ab3d/operations/${id}/file?format=stl`);
  assert.match(result.inspectionNotice, /weder Herstellbarkeit noch eine Zahlung/);
  assert.doesNotMatch(JSON.stringify(result), /meshy\.ai|private-fixture/);
  assert.equal(db.writes, 0); assert.equal(calls.length, 0);
});

test("keyset pagination handles timestamp ties without duplicates and supports literal bounded filters", async () => {
  addOrder("PRINT-ABCDE00002", 100); addOrder("PRINT-ABCDE00003", 101); addOrder("PRINT-ABCDE00004", 99, "cancelled");
  const first = await (await list(req("?limit=2"))).json();
  assert.deepEqual(first.orders.map(row => row.id), ["PRINT-ABCDE00003", "PRINT-ABCDE00002"]); assert.ok(first.nextCursor);
  const second = await (await list(req(`?limit=2&cursor=${first.nextCursor}`))).json();
  assert.deepEqual(second.orders.map(row => row.id), [id, "PRINT-ABCDE00004"]); assert.equal(second.nextCursor, null);
  assert.equal((await (await list(req("?q=customer%40example.test&status=inquiry&review=new"))).json()).orders.length, 3);
  assert.equal((await (await list(req("?q=%25"))).json()).orders.length, 0, "A user wildcard is treated literally");
  for (const query of ["?limit=51", "?limit=0", "?limit=2.5", "?status=paid%27OR1", "?review=paid", "?cursor=garbage", "?cursor=", "?q=" + "a".repeat(101), "?limit=2&limit=3", "?email=x"]) {
    assert.equal((await list(req(query))).status, 400, query);
  }
  assert.equal(db.writes, 0);
});

test("review saves notes atomically and never modifies inquiry status, estimate, credits or production", async () => {
  const before = rows("production_orders");
  const saved = await (await patch()).json(); assert.equal(saved.ok, true); assert.equal(saved.review.version, 1); assert.equal(saved.review.state, "reviewing");
  const result = await (await getDetail()).json(); assert.equal(result.order.review.notes, "Private Produktionsnotiz");
  assert.equal(result.order.events.length, 1); assert.equal(result.order.events[0].actorEmail, owner); assert.equal(result.order.events[0].version, 1);
  assert.deepEqual(rows("production_orders"), before); assert.equal(rows("token_ledger").length, 0); assert.equal(calls.length, 0);
  assert.equal((await (await list(req("?review=reviewing"))).json()).orders.length, 1);
  assert.equal((await (await list(req("?review=new"))).json()).orders.length, 0);
});

test("stale initial and subsequent review versions cannot overwrite a newer note or append audit entries", async () => {
  assert.equal((await patch()).status, 200);
  for (const version of [0, 3]) {
    const response = await patch({ state: "closed", notes: "Stale note", version }); assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "review_conflict");
  }
  const saved = await (await patch({ state: "needs_information", notes: "Bitte Wandstärke klären.", version: 1 })).json();
  assert.equal(saved.review.version, 2); assert.equal(rows("production_review_events").length, 2);
  assert.equal((await patch({ state: "closed", notes: "Older", version: 1 })).status, 409);
  assert.equal(rows("production_reviews")[0].notes, "Bitte Wandstärke klären.");
});

test("simultaneous saves use one successful compare-and-swap and return their own exact revision", async () => {
  const results = await Promise.all([patch({ state: "reviewing", notes: "One", version: 0 }), patch({ state: "closed", notes: "Two", version: 0 })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); assert.equal(rows("production_review_events").length, 1);
  db.afterBatch = async () => {
    const response = await patch({ state: "reviewed", notes: "Later update", version: 2 }); assert.equal(response.status, 200);
  };
  const earlier = await (await patch({ state: "reviewing", notes: "Exact earlier revision", version: 1 })).json();
  assert.equal(earlier.review.version, 2); assert.equal(earlier.review.notes, "Exact earlier revision");
  assert.equal(rows("production_reviews")[0].version, 3); assert.equal(rows("production_reviews")[0].notes, "Later update");
});

test("audit insert failures roll back the review for initial writes and updates", async () => {
  db.failBatchAt = 1; assert.equal((await patch()).status, 503);
  assert.equal(rows("production_reviews").length, 0); assert.equal(rows("production_review_events").length, 0);
  assert.equal((await patch()).status, 200); db.failBatchAt = 1;
  assert.equal((await patch({ state: "closed", notes: "Should roll back", version: 1 })).status, 503);
  assert.equal(rows("production_reviews")[0].notes, "Private Produktionsnotiz"); assert.equal(rows("production_reviews")[0].version, 1);
  assert.equal(rows("production_review_events").length, 1);
});

test("review input rejects production/payment fields, invalid IDs, controls, oversize streams and cross-origin writes", async () => {
  for (const input of [null, [], { state: "paid", notes: "", version: 0 }, { state: "new", notes: "x", version: "0" },
    { state: "new", notes: "x", version: -1 }, { state: "new", notes: "x".repeat(3001), version: 0 },
    { state: "new", notes: "x\0", version: 0 }, { state: "new", notes: "", version: 0, status: "paid" }]) assert.equal((await patch(input)).status, 400);
  assert.equal((await patch(undefined, "PRINT-invalid")).status, 400);
  assert.equal((await patch(undefined, id, { origin: "https://other.example.test" })).status, 403);
  const missing = new Request(`${origin}/api/ab3d/operations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal((await save(missing, ctx())).status, 403);
  assert.equal((await patch({ state: "new", notes: "a".repeat(20_000), version: 0 })).status, 413);
  assert.equal((await patch(undefined, "PRINT-MISSING001")).status, 404); assert.equal(rows("production_reviews").length, 0);
});

test("internal notes and audit metadata never leak through customer inquiry endpoints", async () => {
  await patch(); runtime.actor = customer;
  const response = await customerList(new Request(`${origin}/api/production-orders`)), json = await response.json();
  assert.equal(json.orders.length, 1); assert.doesNotMatch(JSON.stringify(json), /Private Produktionsnotiz|reviewing|updatedBy|actorEmail/);
  runtime.actor = other; assert.equal((await (await customerList(new Request(`${origin}/api/production-orders?scope=production`))).json()).orders.length, 0);
});

test("owner can inspect existing inquiry files without promoting payment or changing customer download rights", async () => {
  for (const format of ["glb", "stl", "3mf"]) {
    const response = await inspect(format); assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-disposition"), new RegExp(`${id}\\.${format}`)); await response.arrayBuffer();
  }
  assert.equal(rows("production_orders")[0].status, "inquiry"); assert.equal(db.writes, 0); assert.equal(rows("token_ledger").length, 0);
  for (const status of ["paid", "production", "shipped"]) {
    const response = await legacyPatch(new Request(`${origin}/api/production-orders`, { method: "PATCH", headers: { origin, host: "ab3d.example.test", "content-type": "application/json" }, body: JSON.stringify({ id, status }) }));
    assert.equal(response.status, 409);
  }
  const legacyOwnerFile = await customerFile(new Request(`${origin}/api/meshy?productionOrderId=${id}&format=stl`));
  assert.equal(legacyOwnerFile.status, 403, "The old owner payment gate stays intact");
  runtime.actor = customer;
  assert.equal((await customerFile(new Request(`${origin}/api/meshy?productionOrderId=${id}&format=stl`))).status, 403, "Explorer customers still have no STL export rights");
});

test("files are blocked for cancelled, unfinished, nonconversion or foreign-customer sources before upstream fetch", async () => {
  const update = query => db.db.exec(query);
  update("UPDATE production_orders SET status='cancelled'"); assert.equal((await inspect()).status, 409);
  const cancelled = await (await getDetail()).json(); assert.equal(cancelled.files.stl, null);
  update("UPDATE production_orders SET status='inquiry'; UPDATE generation_tasks SET status='IN_PROGRESS'"); assert.equal((await inspect()).status, 409);
  update("UPDATE generation_tasks SET status='SUCCEEDED',kind='resize'"); assert.equal((await inspect()).status, 409);
  update(`UPDATE generation_tasks SET kind='convert',email='${other}'`); assert.equal((await inspect()).status, 409);
  update(`UPDATE generation_tasks SET email='${customer}'; UPDATE production_orders SET source_task_type='resize'`); assert.equal((await inspect()).status, 409);
  assert.equal(calls.length, 0); assert.equal(db.writes, 0);
});

test("only the three fixed file formats are accepted; browser URLs and duplicate queries are rejected", async () => {
  for (const [format, extra] of [["obj", ""], ["stl", "&format=glb"], ["stl", "&url=https://evil.example/test"], ["https://evil.example/", ""]]) assert.equal((await inspect(format, id, extra)).status, 400);
  assert.equal((await inspect("stl", "PRINT-invalid")).status, 400); assert.equal(calls.length, 0);
});

test("GLB is taken only from the same customer's successful conversion input; STL and 3MF stay on conversion", async () => {
  assert.equal((await inspect("glb")).status, 200); assert.match(calls[0].url, /\/v1\/resize\//);
  assert.equal((await inspect("stl")).status, 200); assert.match(calls[2].url, /\/v1\/convert\//);
  db.db.prepare("UPDATE generation_tasks SET kind='print-repair' WHERE task_id=?").run(previewTaskId);
  assert.equal((await inspect("glb")).status, 200); assert.match(calls[4].url, /\/v1\/print\/repair\//);
  for (const query of ["UPDATE generation_tasks SET status='IN_PROGRESS' WHERE kind='print-repair'", `UPDATE generation_tasks SET status='SUCCEEDED',email='${other}' WHERE kind='print-repair'`,
    `UPDATE generation_tasks SET email='${customer}',kind='text-preview' WHERE task_id='${previewTaskId}'`, "UPDATE generation_tasks SET parent_task_id=NULL WHERE kind='convert'"]) {
    db.db.exec(query); const before = calls.length;
    assert.equal((await inspect("glb")).status, 410); assert.equal(calls.length, before);
    assert.equal((await (await getDetail()).json()).files.glb, null);
  }
});

test("upstream task IDs cannot substitute another model", async () => {
  taskResponse = () => Response.json({ id: "unrelated-task-0001", status: "SUCCEEDED", model_urls: { stl: "https://assets.meshy.ai/offline/model.stl" } });
  const response = await inspect(); assert.equal(response.status, 502); assert.equal((await response.json()).code, "source_mismatch"); assert.equal(calls.length, 1);
});

test("remote asset URLs must have the exact trusted HTTPS host and cannot carry credentials, ports or fragments", async () => {
  for (const url of ["http://assets.meshy.ai/test.stl", "https://assets.meshy.ai.evil.test/test.stl", "https://evil.test/test.stl", "https://user:pass@assets.meshy.ai/test.stl", "https://assets.meshy.ai:444/test.stl", "https://assets.meshy.ai/test.stl#fragment", "//assets.meshy.ai/test.stl"]) {
    taskResponse = () => Response.json({ status: "SUCCEEDED", model_urls: { stl: url } });
    const response = await inspect(); assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /evil\.test|pass@|fragment/);
  }
  assert.equal(calls.length, 7, "No malicious asset fetch was attempted");
});

test("provider redirects, missing/expired files and incomplete task states fail without leaking provider URLs", async () => {
  taskResponse = () => new Response(null, { status: 302, headers: { location: "https://evil.test/secret" } }); assert.equal((await inspect()).status, 502);
  taskResponse = () => new Response(null, { status: 404 }); assert.equal((await inspect()).status, 410);
  taskResponse = () => Response.json({ status: "IN_PROGRESS", model_urls: { stl: "https://assets.meshy.ai/offline/model.stl" } }); assert.equal((await inspect()).status, 409);
  taskResponse = () => Response.json({ status: "SUCCEEDED", model_urls: {} }); assert.equal((await inspect()).status, 410);
  taskResponse = () => Response.json({ status: "SUCCEEDED", model_urls: { stl: "https://assets.meshy.ai/offline/model.stl" } });
  assetResponse = () => new Response(null, { status: 302, headers: { location: "https://evil.test/secret" } }); assert.equal((await inspect()).status, 502);
  assetResponse = () => new Response(null, { status: 403 }); assert.equal((await inspect()).status, 410);
  assert.equal(db.writes, 0); assert.ok(calls.every(call => call.options.method === "GET" && call.options.redirect === "manual"));
});

test("file MIME, signatures, declared sizes and actual streaming limits are checked before serving bytes", async () => {
  assetResponse = () => new Response("<html>not a model</html>", { headers: { "content-type": "text/html" } }); assert.equal((await inspect()).status, 502);
  assetResponse = () => new Response("not a model", { headers: { "content-type": "application/octet-stream" } }); assert.equal((await inspect()).status, 502);
  assetResponse = () => new Response(new Uint8Array(1), { headers: { "content-type": "application/octet-stream", "content-length": String(32 * 1024 * 1024 + 1) } }); assert.equal((await inspect()).status, 413);
  assetResponse = () => new Response(new Uint8Array(1), { headers: { "content-type": "application/octet-stream", "content-length": "100" } }); assert.equal((await inspect()).status, 502);
  let cancelled = false;
  assetResponse = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(16 * 1024 * 1024)); controller.enqueue(new Uint8Array(16 * 1024 * 1024)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } }), { headers: { "content-type": "application/octet-stream" } });
  assert.equal((await inspect()).status, 413); assert.equal(cancelled, true);
  assert.equal(db.writes, 0);
});

test("task JSON is bounded, missing keys and upstream failures stay private and no generation is attempted", async () => {
  delete process.env.MESHY_API_KEY; assert.equal((await inspect()).status, 503); assert.equal(calls.length, 0);
  process.env.MESHY_API_KEY = "offline-key-not-a-real-secret";
  taskResponse = () => Response.json({ status: "SUCCEEDED", padding: "x".repeat(256 * 1024) }); assert.equal((await inspect()).status, 413);
  taskResponse = () => { throw new Error("A signed private provider URL and token must never be exposed"); };
  const response = await inspect(); assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /signed private|offline-key|https:\/\//);
  assert.equal(db.writes, 0); assert.equal(rows("token_ledger").length, 0);
});

test("transparent decompression retains actual decoded-byte limits without confusing compressed content lengths", async () => {
  taskResponse = () => Response.json({ id: taskId, status: "SUCCEEDED", model_urls: { stl: "https://assets.meshy.ai/offline/model.stl" } },
    { headers: { "content-encoding": "gzip", "content-length": "50" } });
  assetResponse = () => {
    const bytes = new Uint8Array(134); new DataView(bytes.buffer).setUint32(80, 1, true);
    return new Response(bytes, { headers: { "content-type": "application/octet-stream", "content-encoding": "gzip", "content-length": "35" } });
  };
  const response = await inspect(); assert.equal(response.status, 200); assert.equal((await response.arrayBuffer()).byteLength, 134);
  assert.equal(response.headers.get("content-length"), "134"); assert.equal(response.headers.get("content-encoding"), null);
  assert.equal(calls[0].options.headers["Accept-Encoding"], "identity");
});
