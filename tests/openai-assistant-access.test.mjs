import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const routes = [
  { name: "assistant", body: { message: "Welche Materialien gibt es?" }, fallback: "guide" },
  { name: "design-agent", body: { templateId: "fixture", idea: "Eine schlichte Vase" }, fallback: "product-rules" },
];

// Execute the actual handlers with isolated environment/authentication and no network.
// The complete plan ensures the planner cannot hide a missing cost gate behind its form checks.
function handler(route, { flag, key = "test-only-placeholder", user = { email: "owner@example.test" } } = {}) {
  const exports = {};
  const requests = [];
  const source = readFileSync(new URL(`../app/api/${route.name}/route.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports, Response, URL, TextEncoder, crypto,
    process: { env: { OPENAI_ASSISTANT_ENABLED: flag, OPENAI_API_KEY: key } },
    require(specifier) {
      if (specifier === "../../chatgpt-auth") return { getChatGPTUser: async () => user };
      if (specifier === "../../design-planner") return {
        buildDesignPlan: () => ({ complete: true, summary: "Fixture plan", technicalBrief: "Fixture geometry" }),
      };
      throw new Error(`Unexpected route dependency: ${specifier}`);
    },
    fetch: async (url) => {
      requests.push(url);
      const text = route.name === "assistant" ? "Fixture answer" : JSON.stringify({ summary: "Fixture enhancement", visual_intent: "Fixture intent" });
      return Response.json({ output: [{ content: [{ type: "output_text", text }] }] });
    },
  });
  return {
    requests,
    invoke: () => exports.POST(new Request(`https://example.test/api/${route.name}`, {
      method: "POST",
      headers: { origin: "https://example.test", host: "example.test", "Content-Type": "application/json" },
      body: JSON.stringify(route.body),
    })),
  };
}

for (const route of routes) {
  test(`${route.name} makes no API request without an explicit cost approval`, async () => {
    for (const flag of [undefined, "false", "TRUE", "1"]) {
      const subject = handler(route, { flag });
      const response = await subject.invoke();
      assert.equal(response.status, 200);
      assert.equal((await response.json()).mode, route.fallback);
      assert.equal(subject.requests.length, 0);
    }
  });

  test(`${route.name} keeps its free fallback without a key or signed-in user`, async () => {
    for (const config of [{ flag: "true", key: "" }, { flag: "true", user: null }]) {
      const subject = handler(route, config);
      const response = await subject.invoke();
      assert.equal(response.status, 200);
      assert.equal((await response.json()).mode, route.fallback);
      assert.equal(subject.requests.length, 0);
    }
  });

  test(`${route.name} calls the mocked API only with cost approval, key and user`, async () => {
    const subject = handler(route, { flag: "true" });
    const response = await subject.invoke();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).mode, "ai");
    assert.deepEqual(subject.requests, ["https://api.openai.com/v1/responses"]);
  });
}
