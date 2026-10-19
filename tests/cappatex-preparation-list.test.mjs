import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

// Real route + real migrated SQLite. Every account and image reference is a synthetic local fixture.
const runtimeKey = "__cappatexPreparationListOffline";
const OWNER = "list-owner@example.test", OTHER = "list-other@example.test", ORIGIN = "https://list.example.test";
const runtime = { actor: OWNER, env: {} };
globalThis[runtimeKey] = runtime;
const sources = new Map([
  ["cloudflare:workers", `export const env=globalThis.${runtimeKey}.env;`],
  ["next/headers", `export async function headers(){const actor=globalThis.${runtimeKey}.actor;return new Headers(actor?{'oai-authenticated-user-email':actor}:{});}`],
  ["next/navigation", "export function redirect(){throw Error('Unexpected redirect');}"],
]);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (sources.has(specifier)) return { url: `preparation-list-offline:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const file = new URL(`${specifier}.ts`, context.parentURL); if (existsSync(file)) return nextResolve(file.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("preparation-list-offline:")) return { format: "module", source: sources.get(url.slice("preparation-list-offline:".length)), shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { GET: list } = await import("../app/api/cappatex/preparations/route.ts");
const { preparationListCursor, parsePreparationListCursor, preparationListFilters } = await import("../app/cappatex-preparation-list.ts");
const { sha256 } = await import("../app/cappatex-artwork.ts");
const originalFetch = globalThis.fetch;
let sqlite, reads, sideEffects;
beforeEach(() => {
  runtime.actor = OWNER; reads = []; sideEffects = [];
  sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON");
  const folder = new URL("../drizzle/", import.meta.url);
  for (const name of readdirSync(folder).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(name, folder), "utf8"));
  for (const email of [OWNER, OTHER]) sqlite.prepare("INSERT INTO accounts(email,created_at,updated_at) VALUES(?,0,0)").run(email);
  const forbidden = name => { sideEffects.push(name); throw new Error(`Unexpected side effect ${name}`); };
  runtime.env.DB = {
    prepare(sql) {
      assert.match(sql, /^SELECT\s+id,created_at,payload_json,payload_sha256 FROM cappatex_preparations/);
      assert.match(sql, /WHERE email = \? AND state = 'ready'/);
      assert.match(sql, /ORDER BY created_at DESC,id DESC LIMIT \?/);
      assert.ok(!/\bOFFSET\b/i.test(sql));
      return { bind(...args) { return {
        async all() { reads.push({ sql, args }); return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { forbidden("DB.run"); }, async first() { forbidden("unexpected DB.first"); },
      }; } };
    },
    async batch() { forbidden("DB.batch"); }, async exec() { forbidden("DB.exec"); },
  };
  runtime.env.BUCKET = { async get() { forbidden("R2.get"); }, async put() { forbidden("R2.put"); } };
  globalThis.fetch = async () => { forbidden("fetch"); };
});
afterEach(() => {
  assert.deepEqual(sideEffects, []);
  sqlite.close(); globalThis.fetch = originalFetch;
});
after(() => { hooks.deregister(); delete globalThis[runtimeKey]; });

const id = n => `CPP-${n.toString(16).padStart(32, "0")}`;
function fixturePayload(n, createdAt) {
  return { schemaVersion: 2, rendererVersion: "rgba-area-v1", id: id(n), createdAt, name: `Synthetic product ${n}`,
    profileId: "offline-profile", profileVersion: "offline-v1", quantity: 2, country: "LI", shopId: "hidden-shop",
    email: "hidden-payload@example.test", prompt: "private prompt must not be returned", currency: "USD", unitPriceCents: 1,
    variant: { color: "White", size: "M", sku: "HIDDEN-SKU", shopifyVariantId: "gid://shopify/ProductVariant/1", printifyVariantId: 123 },
    sides: ["front", "back"].map((position, i) => ({ position, designId: i ? "CPX-BBBBBBBBBBBB" : "CPX-AAAAAAAAAAAA", source: "generated",
      artwork: { key: "private/source.png", sha256: "a".repeat(64), width: 2048, height: 2048 },
      placement: { x: .4, y: .5, scale: .3 }, area: { position, widthPx: 4200, heightPx: 4800 },
      mockup: { url: "https://private.example.test/do-not-return.jpg" }, raster: { left: 100, top: 200, width: 1000, height: 1000 }, dpi: 360,
      file: { key: `private/${position}.png`, sha256: "b".repeat(64), width: 4200, height: 4800 },
      previewUrl: "https://untrusted.example.test/never-use.png", downloadUrl: "https://untrusted.example.test/original.png" })) };
}
async function seed(n, createdAt = 1000 + n, { email = OWNER, state = "ready", change, json, digest } = {}) {
  const payload = fixturePayload(n, createdAt); change?.(payload);
  const text = json === undefined ? JSON.stringify(payload) : json;
  const hash = digest === undefined ? await sha256(text) : digest;
  sqlite.prepare("INSERT INTO cappatex_preparations(id,email,request_id,request_sha256,state,payload_json,payload_sha256,created_at) VALUES(?,?,?,'offline',?,?,?,?)")
    .run(id(n), email, `offline-request-${n}`, state, text, hash, createdAt);
  return payload;
}
async function page(query = "") {
  const response = await list(new Request(`${ORIGIN}/api/cappatex/preparations${query}`));
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  return { response, data: await response.json() };
}
const snapshot = () => sqlite.prepare("SELECT * FROM cappatex_preparations ORDER BY id").all();

test("history requires authentication before reading any account or storage", async () => {
  await seed(1); runtime.actor = null;
  const { response } = await page(); assert.equal(response.status, 401); assert.equal(reads.length, 0);
});

test("empty private history returns a stable empty page without creating account records", async () => {
  runtime.actor = "new-account-without-row@example.test";
  const before = sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n;
  const { response, data } = await page(); assert.equal(response.status, 200); assert.deepEqual(data, { items: [], nextCursor: null });
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n, before);
});

test("all rows are owner-filtered and failed or in-progress attempts are excluded", async () => {
  await seed(1); await seed(2, 2000, { email: OTHER }); await seed(3, 3000, { state: "failed" }); await seed(4, 4000, { state: "preparing" });
  const { response, data } = await page(); assert.equal(response.status, 200); assert.deepEqual(data.items.map(v => v.id), [id(1)]);
  assert.deepEqual(reads[0].args, [OWNER, 13]);
  runtime.actor = OTHER;
  assert.deepEqual((await page()).data.items.map(v => v.id), [id(2)]);
});

test("verified DTO returns only compact safe metadata and reconstructed private preview addresses", async () => {
  await seed(1); const before = snapshot();
  const { data } = await page();
  assert.deepEqual(data.items, [{ id: id(1), createdAt: 1001, integrity: "verified", name: "Synthetic product 1", profileId: "offline-profile", profileVersion: "offline-v1",
    variant: { color: "White", size: "M" }, quantity: 2, country: "LI", sides: ["front", "back"].map((position, i) => ({ position,
      designId: i ? "CPX-BBBBBBBBBBBB" : "CPX-AAAAAAAAAAAA", previewUrl: `/api/cappatex/artwork/${i ? "CPX-BBBBBBBBBBBB" : "CPX-AAAAAAAAAAAA"}`,
      file: { width: 4200, height: 4800 }, dpi: 360 })) }]);
  const encoded = JSON.stringify(data);
  for (const forbidden of [OWNER, "hidden-payload", "private/", "sha256", "HIDDEN-SKU", "private prompt", "untrusted.example", "private.example", "downloadUrl", "unitPriceCents"]) assert.equal(encoded.includes(forbidden), false, forbidden);
  assert.deepEqual(snapshot(), before);
});

test("12 plus one keyset pagination is deterministic with equal timestamps and never repeats or loses an entry", async () => {
  for (let n = 1; n <= 25; n++) await seed(n, 5000);
  const first = await page(); assert.equal(first.data.items.length, 12); assert.ok(first.data.nextCursor);
  assert.deepEqual(first.data.items.map(v => v.id), Array.from({ length: 12 }, (_, i) => id(25 - i)));
  const second = await page(`?cursor=${first.data.nextCursor}`); assert.equal(second.data.items.length, 12); assert.ok(second.data.nextCursor);
  const third = await page(`?cursor=${second.data.nextCursor}`); assert.equal(third.data.items.length, 1); assert.equal(third.data.nextCursor, null);
  const all = [...first.data.items, ...second.data.items, ...third.data.items].map(v => v.id);
  assert.equal(new Set(all).size, 25); assert.deepEqual(all, Array.from({ length: 25 }, (_, i) => id(25 - i)));
  assert.deepEqual(parsePreparationListCursor(first.data.nextCursor), { createdAt: 5000, id: id(14) });
});

test("new entries before an existing cursor do not shift later pages or duplicate earlier entries", async () => {
  for (let n = 1; n <= 15; n++) await seed(n, 5000);
  const first = (await page()).data; await seed(20, 6000); await seed(21, 5000);
  const second = (await page(`?cursor=${first.nextCursor}`)).data;
  assert.deepEqual(second.items.map(v => v.id), [id(3), id(2), id(1)]); assert.equal(second.nextCursor, null);
  const refreshed = (await page()).data;
  assert.deepEqual(refreshed.items.slice(0, 2).map(v => v.id), [id(20), id(21)]);
});

test("a cursor belonging to another account remains only a position, never an account selector", async () => {
  await seed(1, 100); await seed(2, 300, { email: OTHER });
  const cursor = preparationListCursor({ createdAt: 300, id: id(2) });
  const { response, data } = await page(`?cursor=${cursor}`); assert.equal(response.status, 200);
  assert.deepEqual(data.items.map(v => v.id), [id(1)]); assert.equal(reads[0].args[0], OWNER);
});

test("unknown view/owner/limit parameters, duplicate cursors and malformed cursors fail before database access", async () => {
  const arbitrary = btoa(JSON.stringify({ v: 1, createdAt: 100, id: id(1), email: OTHER })).replace(/=+$/, "");
  for (const query of ["?email=" + OTHER, "?scope=all", "?owner=" + OTHER, "?limit=1000", "?cursor=", "?cursor=bad", "?cursor=%2F", "?cursor=" + "a".repeat(257),
    `?cursor=${arbitrary}`, "?cursor=a&cursor=b", `?cursor=${btoa(JSON.stringify({ v: 1, createdAt: -1, id: id(1) })).replace(/=+$/, "")}`]) {
    const { response } = await page(query); assert.equal(response.status, 400, query);
  }
  assert.equal(reads.length, 0);
});

test("corrupt hashes and invalid payloads produce safe unavailable cards without breaking other rows or pagination", async () => {
  await seed(1); await seed(2, 1002, { digest: "a".repeat(64) }); await seed(3, 1003, { json: "{not json" });
  await seed(4, 1004, { change: p => { p.id = id(999); } });
  await seed(5, 1005, { change: p => { p.sides[0].designId = "../../foreign"; } });
  await seed(6, 1006, { change: p => { p.sides[0].dpi = null; } });
  await seed(7, 1007, { change: p => { p.sides[1].position = "front"; } });
  await seed(8, 1008, { change: p => { p.createdAt = 100; } });
  const { response, data } = await page(); assert.equal(response.status, 200); assert.equal(data.items.length, 8);
  assert.deepEqual(data.items.filter(v => v.integrity === "unavailable"), Array.from({ length: 7 }, (_, i) => ({ id: id(8 - i), createdAt: 1008 - i, integrity: "unavailable" })));
  assert.equal(data.items.at(-1).integrity, "verified");
  assert.equal(JSON.stringify(data).includes("foreign"), false);
});

test("an unavailable first page still advances from database metadata to later valid preparations", async () => {
  await seed(1, 5000);
  for (let n = 2; n <= 13; n++) await seed(n, 5000, { json: "corrupt private payload" });
  const first = (await page()).data;
  assert.equal(first.items.length, 12); assert.ok(first.items.every(item => item.integrity === "unavailable"));
  assert.deepEqual(parsePreparationListCursor(first.nextCursor), { createdAt: 5000, id: id(2) });
  const second = (await page(`?cursor=${first.nextCursor}`)).data;
  assert.deepEqual(second.items.map(item => [item.id, item.integrity]), [[id(1), "verified"]]); assert.equal(second.nextCursor, null);
});

test("malformed IDs or invalid database dates cannot escape into response links or cursor metadata", async () => {
  await seed(1); await seed(2);
  sqlite.prepare("UPDATE cappatex_preparations SET id='../foreign' WHERE id=?").run(id(1));
  sqlite.prepare("UPDATE cappatex_preparations SET created_at=-1 WHERE id=?").run(id(2));
  const { data } = await page(); assert.deepEqual(data, { items: [], nextCursor: null });
});

test("storage failure returns a generic private error without leaking SQL or account details", async () => {
  runtime.env.DB.prepare = () => { throw Error("sensitive database fixture detail"); };
  const { response, data } = await page(); assert.equal(response.status, 503);
  assert.equal(data.code, "preparation_list_unavailable");
  assert.equal(JSON.stringify(data).includes("sensitive"), false); assert.equal(JSON.stringify(data).includes(OWNER), false);
});

test("literal search trims its term and searches names, colours, sizes and each owned side design ID", async () => {
  await seed(1, 1001, { change: p => { p.name = "Synthetic Hoodie"; p.variant.color = "Ocean Blue"; p.variant.size = "XL"; } });
  await seed(2, 1002, { change: p => { p.name = "Synthetic Poster"; p.variant.color = "Graphite"; p.variant.size = "A3";
    p.sides[0].designId = "CPX-CCCCCCCCCCCC"; p.sides[1].designId = "CPX-DDDDDDDDDDDD"; } });
  for (const q of ["  hOoDiE  ", "oCeAn", "XL", "cpx-aaaaaaaaaaaa", "BBBBBBBBBBBB"]) {
    const { response, data } = await page(`?q=${encodeURIComponent(q)}`);
    assert.equal(response.status, 200); assert.deepEqual(data.items.map(item => item.id), [id(1)], q);
    assert.ok(reads.at(-1).args.slice(1, -1).every(value => value === q.trim()));
  }
  assert.deepEqual((await page("?q=graphite")).data.items.map(item => item.id), [id(2)]);
  assert.deepEqual((await page("?q=missing")).data, { items: [], nextCursor: null });
  assert.equal(reads.at(-1).args[0], OWNER);
});

test("percent, underscore, backslash and SQL-looking search terms remain literal parameter values", async () => {
  const terms = ["%", "_", "\\", "' OR 1=1 --", "100%_cotton"];
  let parameterizedSql;
  for (let n = 0; n < terms.length; n++) await seed(n + 1, 1000 + n, { change: p => { p.name = `Literal ${terms[n]} marker`; } });
  await seed(50, 2000, { change: p => { p.name = "Ordinary product"; } });
  for (const q of terms) {
    const { response, data } = await page(`?q=${encodeURIComponent(q)}`);
    assert.equal(response.status, 200);
    const expected = terms.flatMap((term, index) => term.includes(q) ? [id(index + 1)] : []).reverse();
    assert.deepEqual(data.items.map(item => item.id), expected, q);
    parameterizedSql ??= reads.at(-1).sql;
    assert.equal(reads.at(-1).sql, parameterizedSql, "Changing customer text must not change SQL syntax");
    assert.ok(reads.at(-1).args.includes(q));
    assert.equal(/\bLIKE\b/i.test(reads.at(-1).sql), false);
  }
});

test("search never examines prompts, emails, storage paths, private URLs, SKUs or fulfillment identifiers", async () => {
  await seed(1);
  const before = snapshot();
  for (const q of [OWNER, "hidden-payload@example.test", "private prompt", "private/source.png", "private/front.png", "HIDDEN-SKU",
    "hidden-shop", "offline-profile", "private.example.test", "untrusted.example.test", "aaaaaaaaaaaaa", "gid://shopify/ProductVariant/1"]) {
    const { response, data } = await page(`?q=${encodeURIComponent(q)}`);
    assert.equal(response.status, 200); assert.deepEqual(data, { items: [], nextCursor: null }, q);
  }
  const sql = reads.at(-1).sql;
  for (const forbidden of ["$.prompt", "$.email", "$.artwork", "$.file", "$.sku", "$.shopId", "$.profileId", "payload_json LIKE"]) assert.equal(sql.includes(forbidden), false);
  assert.deepEqual(snapshot(), before);
});

test("side filters mean exactly front-only, back-only or both sides in either stored order", async () => {
  await seed(1, 1001, { change: p => { p.sides.splice(1); } });
  await seed(2, 1002, { change: p => { p.sides.splice(0, 1); } });
  await seed(3); await seed(4, 1004, { change: p => { p.sides.reverse(); } });
  for (const [sides, expected] of [["front", [id(1)]], ["back", [id(2)]], ["both", [id(4), id(3)]]]) {
    const { response, data } = await page(`?sides=${sides}`);
    assert.equal(response.status, 200); assert.deepEqual(data.items.map(item => item.id), expected);
    assert.deepEqual(reads.at(-1).args, [OWNER, sides, sides, 13]);
  }
  assert.equal((await page()).data.items.length, 4);
});

test("combined filters keep the authenticated owner and ready-only predicates mandatory", async () => {
  const change = p => { p.name = "Synthetic Hoodie"; p.sides.splice(1); };
  await seed(1, 1001, { change }); await seed(2, 1002, { change, email: OTHER });
  await seed(3, 1003, { change, state: "preparing" }); await seed(4, 1004, { change, state: "failed" });
  await seed(5, 1005, { change: p => { p.name = "Synthetic Hoodie"; } });
  assert.deepEqual((await page("?q=hoodie&sides=front")).data.items.map(item => item.id), [id(1)]);
  assert.equal(reads.at(-1).args[0], OWNER);
  runtime.actor = OTHER;
  assert.deepEqual((await page("?q=hoodie&sides=front")).data.items.map(item => item.id), [id(2)]);
});

test("filtered 12 plus one pagination keeps equal-date ordering and excludes newly inserted earlier matches", async () => {
  for (let n = 1; n <= 25; n++) await seed(n, 5000);
  await seed(30, 6000, { change: p => { p.variant.color = "Black"; } });
  const filters = { q: "white", sides: "both" };
  const first = (await page("?q=white&sides=both")).data;
  assert.deepEqual(first.items.map(item => item.id), Array.from({ length: 12 }, (_, n) => id(25 - n)));
  assert.deepEqual(parsePreparationListCursor(first.nextCursor, filters), { createdAt: 5000, id: id(14) });
  await seed(31, 7000); await seed(32, 5000);
  const second = (await page(`?q=white&sides=both&cursor=${first.nextCursor}`)).data;
  const third = (await page(`?sides=both&q=white&cursor=${second.nextCursor}`)).data;
  assert.equal(second.items.length, 12); assert.equal(third.items.length, 1); assert.equal(third.nextCursor, null);
  assert.deepEqual([...first.items, ...second.items, ...third.items].map(item => item.id), Array.from({ length: 25 }, (_, n) => id(25 - n)));
});

test("v2 cursors bind the normalized query and exact side filter before database access", async () => {
  const cursor = preparationListCursor({ createdAt: 5000, id: id(10) }, { q: "white", sides: "both" });
  for (const query of [`?cursor=${cursor}`, `?q=black&sides=both&cursor=${cursor}`, `?q=white&sides=front&cursor=${cursor}`,
    `?q=white&cursor=${cursor}`, `?q=WHITE&sides=both&cursor=${cursor}`]) assert.equal((await page(query)).response.status, 400, query);
  assert.equal(reads.length, 0);
  await seed(1);
  assert.equal((await page(`?q=%20white%20&sides=both&cursor=${cursor}`)).response.status, 200);
  assert.equal(reads.length, 1);
});

test("old v1 cursors stay compatible only with unfiltered requests and new cursors explicitly carry v2 filter state", async () => {
  const legacy = btoa(JSON.stringify({ v: 1, createdAt: 5000, id: id(10) })).replace(/=+$/, "");
  await seed(1);
  assert.equal((await page(`?cursor=${legacy}`)).response.status, 200);
  assert.equal((await page(`?q=%20%20&cursor=${legacy}`)).response.status, 200);
  reads.length = 0;
  for (const query of [`?q=white&cursor=${legacy}`, `?sides=both&cursor=${legacy}`]) assert.equal((await page(query)).response.status, 400);
  assert.equal(reads.length, 0);
  const encoded = preparationListCursor({ createdAt: 5000, id: id(10) });
  const decoded = JSON.parse(atob(encoded.replaceAll("-", "+").replaceAll("_", "/")));
  assert.deepEqual(decoded, { v: 2, createdAt: 5000, id: id(10), q: "", sides: null });
});

test("UTF-8 queries and cursors preserve literal text without assuming SQLite Unicode case folding", async () => {
  const q = "漢".repeat(80);
  for (let n = 1; n <= 13; n++) await seed(n, 5000, { change: p => { p.name = q; } });
  const first = (await page(`?q=${encodeURIComponent(q)}`)).data;
  assert.equal(first.items.length, 12); assert.ok(first.nextCursor); assert.ok(first.nextCursor.length <= 1024);
  assert.deepEqual(parsePreparationListCursor(first.nextCursor, { q, sides: null }), { createdAt: 5000, id: id(2) });
  const second = await page(`?q=${encodeURIComponent(q)}&cursor=${first.nextCursor}`);
  assert.equal(second.response.status, 200); assert.deepEqual(second.data.items.map(item => item.id), [id(1)]);
  await seed(14, 6000, { change: p => { p.name = "MÜNCHEN"; } });
  assert.deepEqual((await page(`?q=${encodeURIComponent("mÜn")}`)).data.items.map(item => item.id), [id(14)]);
  assert.deepEqual((await page(`?q=${encodeURIComponent("mün")}`)).data.items, []);
});

test("unknown or duplicate filters, invalid sides and oversized normalized queries fail before any database read", async () => {
  for (const query of ["?q=a&q=b", "?sides=front&sides=front", "?sides=", "?sides=all", "?sides=Front", "?sides=front,back",
    "?q=" + "x".repeat(81), "?q=white&owner=" + OTHER, "?q=white&scope=all", "?q=white&limit=500", "?sides=both&cursor=a&cursor=b"]) {
    assert.equal((await page(query)).response.status, 400, query);
  }
  assert.equal(reads.length, 0);
  assert.deepEqual(preparationListFilters("  " + "x".repeat(80) + "  ", null), { q: "x".repeat(80), sides: null });
  runtime.actor = null;
  assert.equal((await page("?q=white&sides=both")).response.status, 401); assert.equal(reads.length, 0);
});

test("filtered SQL tolerates invalid JSON and malformed side shapes without returning unverified candidates", async () => {
  await seed(1, 1001); await seed(2, 1002, { json: "{invalid private JSON" }); await seed(3, 1003, { json: "null" });
  await seed(4, 1004, { change: p => { p.sides = "front"; } }); await seed(5, 1005, { change: p => { p.sides = [null]; } });
  await seed(6, 1006, { change: p => { p.sides[1].position = "front"; } });
  await seed(7, 1007, { change: p => { p.sides = { position: "front" }; } });
  await seed(8, 1008, { digest: "a".repeat(64) });
  for (const query of ["?q=synthetic", "?sides=both", "?q=synthetic&sides=both"]) {
    const { response, data } = await page(query); assert.equal(response.status, 200);
    assert.deepEqual(data.items.map(item => item.id), [id(1)]); assert.equal(data.items[0].integrity, "verified");
    assert.match(reads.at(-1).sql, /CASE WHEN length\(payload_json\) <= 256000 AND json_valid\(payload_json\)/);
  }
});

test("an empty filtered page of bad-hash candidates keeps its cursor and can reach later verified matches", async () => {
  await seed(1, 5000);
  for (let n = 2; n <= 13; n++) await seed(n, 5000, { digest: "0".repeat(64) });
  const before = snapshot();
  const first = (await page("?q=white&sides=both")).data;
  assert.deepEqual(first.items, []); assert.ok(first.nextCursor);
  assert.deepEqual(parsePreparationListCursor(first.nextCursor, { q: "white", sides: "both" }), { createdAt: 5000, id: id(2) });
  const second = (await page(`?q=white&sides=both&cursor=${first.nextCursor}`)).data;
  assert.deepEqual(second.items.map(item => item.id), [id(1)]); assert.equal(second.nextCursor, null);
  assert.deepEqual(snapshot(), before); assert.deepEqual(sideEffects, []);
});

test("filtered foreign-account cursors remain positions and cannot override the current authenticated owner", async () => {
  await seed(1, 100); await seed(2, 300, { email: OTHER });
  const cursor = preparationListCursor({ createdAt: 300, id: id(2) }, { q: "white", sides: "both" });
  const { response, data } = await page(`?q=white&sides=both&cursor=${cursor}`);
  assert.equal(response.status, 200); assert.deepEqual(data.items.map(item => item.id), [id(1)]);
  assert.equal(reads[0].args[0], OWNER);
});
