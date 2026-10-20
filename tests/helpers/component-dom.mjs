// DOM-only component tests. No browser, layout engine, image loads or network.
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { parseHTML } from "linkedom";
import ts from "typescript";
import React, { act } from "react";

const rootUrl = new URL("../../", import.meta.url);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/link") return next(new URL("./next-link.mjs", import.meta.url).href, context);
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      for (const extension of [".ts", ".tsx"]) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (existsSync(candidate)) return next(candidate.href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(rootUrl.href) && /\.tsx?$/.test(url)) return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        fileName: new URL(url).pathname,
      }).outputText,
    };
    return next(url, context);
  },
});

const { window, document } = parseHTML("<!doctype html><html><body></body></html>");
document.oninput = null;
// LinkeDOM omits textarea.defaultValue. React initializes controlled textareas
// through that native property. Supply its initial-value/dirty-value semantics;
// do not replace any React handler, hook or application state.
const textareaValues = new WeakSet(), textareaDefaults = new WeakMap();
const textareaValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
Object.defineProperties(window.HTMLTextAreaElement.prototype, {
  value: { configurable: true, get: textareaValue.get, set(value) { textareaValues.add(this); textareaValue.set.call(this, value); } },
  defaultValue: { configurable: true, get() { return textareaDefaults.get(this) ?? this.textContent; }, set(value) {
    textareaDefaults.set(this, String(value)); if (!textareaValues.has(this)) textareaValue.set.call(this, value);
  } },
});
// Native <option> without a value attribute uses its text as the value.
const optionValue = Object.getOwnPropertyDescriptor(window.HTMLOptionElement.prototype, "value");
Object.defineProperty(window.HTMLOptionElement.prototype, "value", {
  configurable: true, get() { return this.hasAttribute("value") ? optionValue.get.call(this) : this.textContent; }, set: optionValue.set,
});
// Native input.type defaults to "text", which React uses to select its input
// change event path. LinkeDOM otherwise returns null for an omitted attribute.
const inputType = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "type");
Object.defineProperty(window.HTMLInputElement.prototype, "type", {
  configurable: true, get() { return inputType.get.call(this) || "text"; }, set: inputType.set,
});
Object.assign(globalThis, {
  window, document, HTMLElement: window.HTMLElement, HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement, Node: window.Node, Element: window.Element, Event: window.Event,
  IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout,
});
// The simulator does not implement browser viewport/scrolling. These are no-ops,
// never an assertion that a mobile viewport or visual layout was tested.
window.HTMLElement.prototype.scrollIntoView = function () {};
window.matchMedia = query => ({ media: query, matches: false, addEventListener() {}, removeEventListener() {} });
const { createRoot } = await import("react-dom/client");

export class MemoryStorage {
  values = new Map(); blocked = false;
  check() { if (this.blocked) throw new DOMException("Synthetic storage is blocked", "SecurityError"); }
  getItem(key) { this.check(); return this.values.get(key) ?? null; }
  setItem(key, value) { this.check(); this.values.set(key, String(value)); }
  removeItem(key) { this.check(); this.values.delete(key); }
  clear() { this.check(); this.values.clear(); }
}

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
export const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
export async function flush() { await act(async () => { await new Promise(resolve => setImmediate(resolve)); }); }
export async function until(assertion) {
  let last;
  for (let attempt = 0; attempt < 50; attempt++) {
    await flush();
    try { return assertion(); } catch (error) { last = error; }
  }
  throw last;
}

export async function mount(Component, props = {}, { url = "https://ab3d.example.test/", storage = new MemoryStorage(), fetch } = {}) {
  const redirects = [], history = [];
  const location = {
    get href() { return url; }, get search() { return new URL(url).search; }, get hash() { return new URL(url).hash; },
    get origin() { return new URL(url).origin; }, get pathname() { return new URL(url).pathname; },
    assign(value) { redirects.push(String(value)); }, reload() { history.push("reload"); },
  };
  window.location = location;
  window.history = { state: null, replaceState(state, _title, value) { this.state = state; url = new URL(value, url).href; history.push(url); } };
  window.sessionStorage = storage;
  globalThis.sessionStorage = storage;
  globalThis.fetch = fetch || (() => { throw new Error("Unexpected fetch: offline component test"); });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(Component, props)); });
  const text = () => container.textContent;
  const button = (label) => [...container.querySelectorAll("button")].find(element => typeof label === "string" ? element.textContent.trim() === label : label.test(element.textContent.trim()));
  const click = async (element) => {
    if (!element) throw new Error("Missing component control");
    if (element.disabled) return;
    await act(async () => { element.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true })); });
  };
  const change = async (element, value) => {
    if (!element) throw new Error("Missing component input");
    await act(async () => {
      if (element.tagName === "SELECT") {
        const selected = [...element.options].find(option => option.value === value);
        for (const option of element.options) option.selected = false;
        if (!selected) throw new Error(`Missing component option: ${value}`);
        selected.selected = true;
        element.dispatchEvent(new window.Event("change", { bubbles: true }));
      } else {
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
        descriptor.set.call(element, value);
        element.dispatchEvent(new window.Event("input", { bubbles: true }));
      }
    });
  };
  const check = async (element, value = true) => {
    if (!element) throw new Error("Missing component checkbox");
    await act(async () => {
      element.checked = value;
      element.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    });
  };
  const image = async (element, width, height, event = "load") => {
    if (!element) throw new Error("Missing component image");
    Object.defineProperties(element, { naturalWidth: { value: width, configurable: true }, naturalHeight: { value: height, configurable: true } });
    await act(async () => { element.dispatchEvent(new window.Event(event)); });
  };
  return {
    container, text, button, click, change, check, image, storage, redirects, history,
    async render(nextProps) { await act(async () => { root.render(React.createElement(Component, nextProps)); }); },
    async close() { await act(async () => root.unmount()); container.remove(); },
  };
}

export function closeHarness() { hooks.deregister(); }
