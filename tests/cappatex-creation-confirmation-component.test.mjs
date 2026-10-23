import assert from "node:assert/strict";
import { after, test } from "node:test";
import { act } from "react";
import { encode } from "fast-png";
import { closeHarness, json, mount, until } from "./helpers/component-dom.mjs";

const { default: CappatexDesigner } = await import("../app/cappatex/cappatex-designer.tsx");
const { default: CreationGallery } = await import("../app/creation-gallery.tsx");
after(closeHarness);

const prompt = "Eine alpine Blume als ruhige Linienzeichnung";
const motifId = "CPX-AAAAAAAAAAAA";
const account = { account: { email: "creator@example.test", cappatexGeneration: { enabled: true, pilotOwner: true },
  cappatexUpload: { enabled: true }, capabilities: { canDownloadHd: false } } };
const artwork = source => ({ image: `/api/cappatex/artwork/${motifId}`, designId: motifId,
  width: source === "upload" ? 4 : 2048, height: source === "upload" ? 4 : 3072,
  previewWidth: source === "upload" ? 1 : 512, previewHeight: source === "upload" ? 1 : 768,
  sha256: "a".repeat(64), format: "png", ...(source === "upload" ? { source: "upload" } : { quality: "high" }) });

function studioFixture(response) {
  const posts = [];
  return { posts, url: "https://ab3d.example.test/cappatex", fetch: async (url, init = {}) => {
    if (init.method === "POST") {
      assert.ok(["/api/cappatex", "/api/cappatex/upload"].includes(url));
      posts.push({ url, body: init.body, headers: init.headers }); return response();
    }
    if (url === "/api/account") return json(account);
    assert.equal(url, "/api/cappatex/catalog"); return json({ products: [] });
  } };
}

async function prepareGeneration(ui) {
  await until(() => assert.equal(ui.button("Mit KI gestalten").disabled, false));
  await ui.change(ui.container.querySelector("textarea"), prompt);
  await ui.check(ui.container.querySelector('input[type="radio"]'));
  await ui.check(ui.container.querySelector('.cappatex-consent input[type="checkbox"]'));
  assert.equal(ui.button("Motiv erstellen").disabled, false);
}

// The DOM simulator has no bitmap decoder/canvas. Supply those platform APIs
// only; the actual file preflight, component handlers and fetch path run intact.
async function prepareUpload(ui) {
  await until(() => assert.equal(ui.button("Eigenes Bild verwenden").disabled, false));
  await ui.click(ui.button("Eigenes Bild verwenden"));
  const png = encode({ width: 4, height: 4, channels: 4, depth: 8, data: new Uint8Array(64).fill(255) });
  const file = new File([png], "synthetic.png", { type: "image/png" });
  const input = ui.container.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new window.Event("change", { bubbles: true })));
  await ui.check(ui.container.querySelector('.cappatex-consent input[type="checkbox"]'));
  await ui.check(ui.container.querySelector('input[type="radio"]'));
  const bitmap = globalThis.createImageBitmap;
  const prototype = Object.getPrototypeOf(document.createElement("canvas"));
  const getContext = Object.getOwnPropertyDescriptor(prototype, "getContext"), toBlob = Object.getOwnPropertyDescriptor(prototype, "toBlob");
  globalThis.createImageBitmap = async () => ({ width: 4, height: 4, close() {} });
  Object.defineProperty(prototype, "getContext", { configurable: true, value: () => ({ drawImage() {} }) });
  Object.defineProperty(prototype, "toBlob", { configurable: true, value: callback => callback(new Blob([png], { type: "image/png" })) });
  assert.equal(ui.button("Eigenes Bild übernehmen").disabled, false);
  return () => {
    if (bitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = bitmap;
    if (getContext) Object.defineProperty(prototype, "getContext", getContext); else delete prototype.getContext;
    if (toBlob) Object.defineProperty(prototype, "toBlob", toBlob); else delete prototype.toBlob;
  };
}

for (const source of ["generated", "upload"]) {
  for (const [name, response] of [
    ["HTTP202 with a complete looking motif", () => json(artwork(source), 202)],
    ["HTML instead of JSON", () => new Response("<html>Upstream unavailable</html>", { status: 200, headers: { "Content-Type": "text/html" } })],
    ["empty JSON", () => json({})],
    ["missing preview dimensions", () => { const value = artwork(source); delete value.previewWidth; return json(value); }],
    ["missing print-file hash", () => { const value = artwork(source); delete value.sha256; return json(value); }],
    ["non-string print-file hash", () => json({ ...artwork(source), sha256: ["a".repeat(64)] })],
    ["unexpected file format", () => json({ ...artwork(source), format: "jpeg" })],
  ]) {
    test(`actual CAPPATEX ${source} does not confirm ${name} or discard customer choices`, async () => {
      const fixture = studioFixture(response), ui = await mount(CappatexDesigner, {}, fixture);
      let restore = () => {};
      try {
        if (source === "upload") restore = await prepareUpload(ui); else await prepareGeneration(ui);
        await ui.click(ui.button(source === "upload" ? "Eigenes Bild übernehmen" : "Motiv erstellen"));
        await until(() => assert.ok(ui.container.querySelector('.cappatex-error[role="alert"]')));
        assert.equal(ui.container.querySelector("#studio").getAttribute("data-stage"), "1");
        assert.equal(ui.container.querySelector('input[type="radio"]').checked, true, "privacy choice remains selected");
        assert.equal(ui.container.querySelector('.cappatex-consent input[type="checkbox"]').checked, true, "explicit customer decision is retained for review");
        if (source === "generated") assert.equal(ui.container.querySelector("textarea").value, prompt);
        else assert.equal(ui.container.querySelector('input[type="file"]').files[0].name, "synthetic.png");
        assert.doesNotMatch(ui.text(), /Unexpected token|SyntaxError|Upstream unavailable/);
        assert.equal(fixture.posts.length, 1, "no automatic repeat of an uncertain operation");
      } finally { restore(); await ui.close(); }
    });
  }
  test(`actual CAPPATEX ${source} accepts its confirmed complete HTTP200 result`, async () => {
    const fixture = studioFixture(() => json(artwork(source))), ui = await mount(CappatexDesigner, {}, fixture);
    let restore = () => {};
    try {
      if (source === "upload") restore = await prepareUpload(ui); else await prepareGeneration(ui);
      await ui.click(ui.button(source === "upload" ? "Eigenes Bild übernehmen" : "Motiv erstellen"));
      await until(() => assert.equal(ui.container.querySelector("#studio").getAttribute("data-stage"), "2"));
      assert.equal(ui.container.querySelector('input[type="radio"]').checked, false, "a later creation needs a fresh privacy decision");
      assert.equal(fixture.posts.length, 1);
    } finally { restore(); await ui.close(); }
  });
}

const galleryId = "GLD-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const detail = { id: galleryId, studio: "cappatex", category: "natur", title: "Synthetic design", visibility: "pending", state: "ready",
  mine: true, canReview: false, revision: 1, versions: [], sourceId: motifId, modelUrl: null, thumbnailUrl: null };
for (const [name, response] of [
  ["HTTP202", () => json({ ok: true }, 202)],
  ["missing acknowledgement", () => json({})],
  ["negative acknowledgement", () => json({ ok: false })],
  ["HTML", () => new Response("<html>Upstream unavailable</html>", { status: 200 })],
]) {
  test(`actual gallery does not report an unconfirmed withdrawal for ${name}`, async () => {
    let posts = 0, reads = 0;
    const ui = await mount(CreationGallery, { studio: "cappatex", scope: "mine", detailId: galleryId }, { fetch: async (_url, init) => {
      if (init?.method === "POST") { posts++; return response(); }
      reads++; return json(detail);
    } });
    try {
      await until(() => assert.ok(ui.button("Aus Galerie zurückziehen")));
      await ui.click(ui.button("Aus Galerie zurückziehen"));
      await until(() => assert.ok(ui.container.querySelector('[role="alert"]')));
      assert.doesNotMatch(ui.text(), /Die Veröffentlichung wurde zurückgezogen|Unexpected token|Upstream unavailable/);
      assert.equal(posts, 1); assert.equal(reads, 1, "no successful-write refresh or automatic repeat");
    } finally { await ui.close(); }
  });
}
test("actual gallery refreshes only after its confirmed HTTP200 acknowledgement", async () => {
  let posts = 0, reads = 0;
  const ui = await mount(CreationGallery, { studio: "cappatex", scope: "mine", detailId: galleryId }, { fetch: async (_url, init) => {
    if (init?.method === "POST") { posts++; return json({ ok: true }); }
    reads++; return json(detail);
  } });
  try {
    await until(() => assert.ok(ui.button("Aus Galerie zurückziehen")));
    await ui.click(ui.button("Aus Galerie zurückziehen"));
    await until(() => assert.match(ui.text(), /Die Veröffentlichung wurde zurückgezogen/));
    assert.equal(posts, 1); assert.equal(reads, 2);
  } finally { await ui.close(); }
});
