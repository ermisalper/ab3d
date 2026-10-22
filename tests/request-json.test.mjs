import assert from "node:assert/strict";
import { test } from "node:test";
import { readRequestJson, RequestJsonError, isJsonObject } from "../app/request-json.ts";

const origin = "https://request.example.test";
function streamRequest(chunks, headers = {}) {
  const state = { reads: 0, cancelled: false };
  const body = new ReadableStream({
    pull(controller) {
      state.reads++;
      if (chunks.length) controller.enqueue(chunks.shift()); else controller.close();
    },
    cancel() { state.cancelled = true; },
  }, { highWaterMark: 0 });
  return { state, body, request: new Request(origin, { method: "POST", body, duplex: "half", headers }) };
}
const fails = (status, code) => error => error instanceof RequestJsonError && error.status === status && error.code === code;

for (const declared of [undefined, "1", "not-a-number"]) test(`actual UTF-8 bytes determine the JSON limit with Content-Length ${declared ?? "absent"}`, async () => {
  const bytes = new TextEncoder().encode('{"message":"ü"}');
  const options = declared === undefined ? {} : { "content-length": declared };
  const stream = streamRequest([bytes.subarray(0, 13), bytes.subarray(13)], options);
  await assert.rejects(readRequestJson(stream.request, bytes.length - 1), fails(413, "request_too_large"));
  assert.equal(stream.state.cancelled, true);
  assert.equal(stream.state.reads, 2);
  assert.equal(stream.body.locked, false);
});

test("declared excess fails before reading the request", async () => {
  const stream = streamRequest([new Uint8Array(100)], { "content-length": "101" });
  await assert.rejects(readRequestJson(stream.request, 100), fails(413, "request_too_large"));
  assert.equal(stream.state.reads, 0);
  assert.equal(stream.body.locked, false);
});

test("the exact byte limit accepts split UTF-8 sequences and whitespace", async () => {
  const bytes = new TextEncoder().encode(' \n{"message":"Grüsse"}\n');
  const stream = streamRequest(Array.from(bytes, byte => Uint8Array.of(byte)));
  assert.deepEqual(await readRequestJson(stream.request, bytes.length), { message: "Grüsse" });
  assert.equal(stream.body.locked, false);
});

for (const bytes of [new Uint8Array(), new TextEncoder().encode('{"message":'), Uint8Array.of(123, 34, 120, 34, 58, 34, 0xc3, 0x28, 34, 125)]) {
  test(`invalid JSON or UTF-8 (${bytes.length} bytes) returns a fixed client error`, async () => {
    const stream = streamRequest([bytes]);
    await assert.rejects(readRequestJson(stream.request, 100), fails(400, "invalid_request"));
    assert.equal(stream.body.locked, false);
  });
}

test("failed reading cancels and unlocks without exposing the stream error", async () => {
  const body = new ReadableStream({ pull() { throw new Error("private fixture storage detail"); } }, { highWaterMark: 0 });
  const request = new Request(origin, { method: "POST", body, duplex: "half" });
  await assert.rejects(readRequestJson(request, 100), error => fails(400, "invalid_request")(error) && !error.message.includes("private"));
  assert.equal(body.locked, false);
});

test("a missing body fails as invalid JSON and object checking excludes arrays and null", async () => {
  await assert.rejects(readRequestJson(new Request(origin, { method: "POST" }), 100), fails(400, "invalid_request"));
  assert.equal(isJsonObject(null), false);
  assert.equal(isJsonObject([]), false);
  assert.equal(isJsonObject("text"), false);
  assert.equal(isJsonObject({ message: "text" }), true);
});
