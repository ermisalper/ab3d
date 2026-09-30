import { C as stripBasePath, T as __toESM, b as require_react, t as require_jsx_runtime, u as ReadonlyURLSearchParams } from "../index.js";
//#region node_modules/.pnpm/vinext@0.0.50_@vitejs+plugi_6558342ba0b940cbd621b36b626ca262/node_modules/vinext/dist/shims/navigation.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var _SERVER_INSERTED_HTML_CTX_KEY = Symbol.for("vinext.serverInsertedHTMLContext");
function getServerInsertedHTMLContext() {
	if (typeof import_react.createContext !== "function") return null;
	const globalState = globalThis;
	if (!globalState[_SERVER_INSERTED_HTML_CTX_KEY]) globalState[_SERVER_INSERTED_HTML_CTX_KEY] = import_react.createContext(null);
	return globalState[_SERVER_INSERTED_HTML_CTX_KEY] ?? null;
}
getServerInsertedHTMLContext();
var _GLOBAL_ACCESSORS_KEY = Symbol.for("vinext.navigation.globalAccessors");
var _GLOBAL_HYDRATION_CONTEXT_KEY = Symbol.for("vinext.navigation.clientHydrationContext");
function _getGlobalAccessors() {
	return globalThis[_GLOBAL_ACCESSORS_KEY];
}
function _getClientHydrationContext() {
	const globalState = globalThis;
	if (Object.prototype.hasOwnProperty.call(globalState, _GLOBAL_HYDRATION_CONTEXT_KEY)) return globalState[_GLOBAL_HYDRATION_CONTEXT_KEY] ?? null;
}
var _serverContext = null;
var _getServerContext = () => {
	if (typeof window !== "undefined") {
		const hydrationContext = _getClientHydrationContext();
		return hydrationContext !== void 0 ? hydrationContext : _serverContext;
	}
	const g = _getGlobalAccessors();
	return g ? g.getServerContext() : _serverContext;
};
var isServer = typeof window === "undefined";
var _CLIENT_NAV_STATE_KEY = Symbol.for("vinext.clientNavigationState");
function getClientNavigationState() {
	if (isServer) return null;
	const globalState = window;
	globalState[_CLIENT_NAV_STATE_KEY] ??= {
		listeners: /* @__PURE__ */ new Set(),
		cachedSearch: window.location.search,
		cachedReadonlySearchParams: new ReadonlyURLSearchParams(window.location.search),
		cachedPathname: stripBasePath(window.location.pathname, ""),
		clientParams: {},
		clientParamsJson: "{}",
		pendingClientParams: null,
		pendingClientParamsJson: null,
		pendingPathname: null,
		pendingPathnameNavId: null,
		originalPushState: window.history.pushState.bind(window.history),
		originalReplaceState: window.history.replaceState.bind(window.history),
		patchInstalled: false,
		hasPendingNavigationUpdate: false,
		suppressUrlNotifyCount: 0,
		navigationSnapshotActiveCount: 0
	};
	return globalState[_CLIENT_NAV_STATE_KEY];
}
function notifyNavigationListeners() {
	const state = getClientNavigationState();
	if (!state) return;
	for (const fn of state.listeners) fn();
}
/**
* Get cached pathname snapshot for useSyncExternalStore.
* Note: Returns cached value from ClientNavigationState, not live window.location.
* The cache is updated by syncCommittedUrlStateFromLocation() after navigation commits.
* This ensures referential stability and prevents infinite re-renders.
* External pushState/replaceState while URL notifications are suppressed won't
* be visible until the next commit.
*/
function getPathnameSnapshot() {
	return getClientNavigationState()?.cachedPathname ?? "/";
}
function syncCommittedUrlStateFromLocation() {
	const state = getClientNavigationState();
	if (!state) return false;
	let changed = false;
	const pathname = stripBasePath(window.location.pathname, "");
	if (pathname !== state.cachedPathname) {
		state.cachedPathname = pathname;
		changed = true;
	}
	const search = window.location.search;
	if (search !== state.cachedSearch) {
		state.cachedSearch = search;
		state.cachedReadonlySearchParams = new ReadonlyURLSearchParams(search);
		changed = true;
	}
	return changed;
}
var _CLIENT_NAV_RENDER_CTX_KEY = Symbol.for("vinext.clientNavigationRenderContext");
function getClientNavigationRenderContext() {
	if (typeof import_react.createContext !== "function") return null;
	const globalState = globalThis;
	if (!globalState[_CLIENT_NAV_RENDER_CTX_KEY]) globalState[_CLIENT_NAV_RENDER_CTX_KEY] = import_react.createContext(null);
	return globalState[_CLIENT_NAV_RENDER_CTX_KEY] ?? null;
}
function useClientNavigationRenderSnapshot() {
	const ctx = getClientNavigationRenderContext();
	if (!ctx || typeof import_react.useContext !== "function") return null;
	try {
		return import_react.useContext(ctx);
	} catch {
		return null;
	}
}
function subscribeToNavigation(cb) {
	const state = getClientNavigationState();
	if (!state) return () => {};
	state.listeners.add(cb);
	return () => {
		state.listeners.delete(cb);
	};
}
/**
* Returns the current pathname.
* Server: from request context. Client: from window.location.
*/
function usePathname() {
	if (isServer) return _getServerContext()?.pathname ?? "/";
	const renderSnapshot = useClientNavigationRenderSnapshot();
	const pathname = import_react.useSyncExternalStore(subscribeToNavigation, getPathnameSnapshot, () => _getServerContext()?.pathname ?? "/");
	if (renderSnapshot && (getClientNavigationState()?.navigationSnapshotActiveCount ?? 0) > 0) return renderSnapshot.pathname;
	return pathname;
}
/**
* Commit pending client navigation state to committed snapshots.
*
* navId is optional: callers that don't own pendingPathname (for example,
* superseded pre-paint cleanup) may pass undefined to flush URL/params state
* without clearing pendingPathname owned by the active navigation. Such callers
* must opt in explicitly if they also own an activated render snapshot.
*/
function commitClientNavigationState(navId, options) {
	if (isServer) return;
	const state = getClientNavigationState();
	if (!state) return;
	if ((navId !== void 0 || options?.releaseSnapshot === true) && state.navigationSnapshotActiveCount > 0) state.navigationSnapshotActiveCount -= 1;
	const urlChanged = syncCommittedUrlStateFromLocation();
	if (state.pendingClientParams !== null && state.pendingClientParamsJson !== null) {
		state.clientParams = state.pendingClientParams;
		state.clientParamsJson = state.pendingClientParamsJson;
		state.pendingClientParams = null;
		state.pendingClientParamsJson = null;
	}
	if (state.pendingPathnameNavId === null || navId !== void 0 && state.pendingPathnameNavId === navId) {
		state.pendingPathname = null;
		state.pendingPathnameNavId = null;
	}
	const shouldNotify = urlChanged || state.hasPendingNavigationUpdate;
	state.hasPendingNavigationUpdate = false;
	if (shouldNotify) notifyNavigationListeners();
}
/**
* Restore scroll position from a history state object (used on popstate).
*
* When an RSC navigation is in flight (back/forward triggers both this
* handler and the browser entry's popstate handler which calls
* __VINEXT_RSC_NAVIGATE__), we must wait for the new content to render
* before scrolling. Otherwise the user sees old content flash at the
* restored scroll position.
*
* This handler fires before the browser entry's popstate handler (because
* navigation.ts is loaded before hydration completes), so we defer via a
* microtask to give the browser entry handler a chance to set
* __VINEXT_RSC_PENDING__. Promise.resolve() schedules a microtask
* that runs after all synchronous event listeners have completed.
*/
function restoreScrollPosition(state) {
	if (state && typeof state === "object" && "__vinext_scrollY" in state) {
		const { __vinext_scrollX: x, __vinext_scrollY: y } = state;
		Promise.resolve().then(() => {
			const pending = window.__VINEXT_RSC_PENDING__ ?? null;
			if (pending) pending.then(() => {
				requestAnimationFrame(() => {
					window.scrollTo(x, y);
				});
			});
			else requestAnimationFrame(() => {
				window.scrollTo(x, y);
			});
		});
	}
}
if (!isServer) {
	const state = getClientNavigationState();
	if (state && !state.patchInstalled) {
		state.patchInstalled = true;
		window.addEventListener("popstate", (event) => {
			if (typeof window.__VINEXT_RSC_NAVIGATE__ !== "function") {
				commitClientNavigationState();
				restoreScrollPosition(event.state);
			}
		});
		window.history.pushState = function patchedPushState(data, unused, url) {
			state.originalPushState.call(window.history, data, unused, url);
			if (state.suppressUrlNotifyCount === 0) commitClientNavigationState();
		};
		window.history.replaceState = function patchedReplaceState(data, unused, url) {
			state.originalReplaceState.call(window.history, data, unused, url);
			if (state.suppressUrlNotifyCount === 0) commitClientNavigationState();
		};
	}
}
//#endregion
//#region app/brand-intro.tsx
var import_jsx_runtime = require_jsx_runtime();
function BrandIntro() {
	const isCappatex = usePathname().startsWith("/cappatex");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `brand-intro ${isCappatex ? "brand-intro-cappatex" : "brand-intro-ab3d"}`,
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "brand-print-stage",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "brand-print-machine",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "printer-frame",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "printer-rail" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "printer-cable" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "printer-head",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "printed-brand",
						children: isCappatex ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "CAPPATEX" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "AB" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "3D" })] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "printer-bed" })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), isCappatex ? "Dein Motiv wird tragbar" : "Idee wird Schicht für Schicht Form"] })]
		})
	}, isCappatex ? "cappatex" : "ab3d");
}
//#endregion
export { BrandIntro as default };
