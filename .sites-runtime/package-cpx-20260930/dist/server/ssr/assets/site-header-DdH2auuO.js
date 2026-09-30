import { T as __toESM, b as require_react, t as require_jsx_runtime } from "../index.js";
import { t as Link } from "./link-B59wS0Al.js";
//#region app/site-header.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var objectLinks = [
	["Kollektion", "/#kollektion"],
	["3D AI Studio", "/#studio"],
	["Creator Plans", "/#preise"],
	["FAQ", "/#faq"]
];
var cappatexLinks = [
	["Design Studio", "/cappatex#studio"],
	["So funktioniert es", "/cappatex#ablauf"],
	["FAQ", "/cappatex#faq"]
];
function SiteHeader({ area, userName, cartCount = 0, onCartOpen }) {
	const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
	const isObjects = area === "objects";
	const links = isObjects ? objectLinks : cappatexLinks;
	const accountHref = userName ? "/konto" : "/signin-with-chatgpt?return_to=%2Fkonto";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `announcement ${isObjects ? "" : "cappatex-announcement"}`,
		children: isObjects ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Swiss made" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Kostenloser Versand ab CHF 80" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Auf Bestellung gefertigt" })
		] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "CAPPATEX by AB3D" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Dein Motiv. Dein Produkt." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Print on Demand" })
		] })
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: `site-header ${isObjects ? "" : "cappatex-site-header"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "nav-shell",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						className: "brand",
						href: "/#top",
						"aria-label": "AB3D Startseite",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "AB" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "3D" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "division-nav division-nav-desktop",
						"aria-label": "AB3D Bereiche",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							className: isObjects ? "active" : "",
							href: "/#top",
							"aria-current": isObjects ? "page" : void 0,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "division-mark",
								children: "3D"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "division-copy",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "3D Objekte" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Shop & AI Studio" })]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							className: !isObjects ? "active cappatex-active" : "",
							href: "/cappatex",
							"aria-current": !isObjects ? "page" : void 0,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "division-mark",
								children: "POD"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "division-copy",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "CAPPATEX" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Kleidung gestalten" })]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mobile-area-label",
						children: isObjects ? "3D Objekte" : "CAPPATEX"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "nav-actions",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								className: "account-button",
								href: accountHref,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { "aria-hidden": "true" }),
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: userName ? userName.split(" ")[0] : "Anmelden" })
								]
							}),
							isObjects && onCartOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								className: "cart-button",
								onClick: onCartOpen,
								"aria-label": `Warenkorb öffnen, ${cartCount} Artikel`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "cart-label",
									children: "Warenkorb"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: cartCount })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								className: "header-menu-button",
								type: "button",
								"aria-label": menuOpen ? "Menü schließen" : "Menü öffnen",
								"aria-expanded": menuOpen,
								"aria-controls": "mobile-site-navigation",
								onClick: () => setMenuOpen((open) => !open),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "section-nav",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					"aria-label": isObjects ? "3D-Shop Navigation" : "CAPPATEX Navigation",
					children: links.map(([label, href]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						href,
						children: label
					}, href))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isObjects ? "Entworfen & gefertigt in Zürich" : "KI-Motiv · Print on Demand" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				id: "mobile-site-navigation",
				className: `mobile-site-navigation ${menuOpen ? "open" : ""}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Bereich wählen" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "division-nav",
						"aria-label": "AB3D Bereiche mobil",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							className: isObjects ? "active" : "",
							href: "/#top",
							onClick: () => setMenuOpen(false),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "division-mark",
								children: "3D"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "division-copy",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "3D Objekte" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Shop & AI Studio" })]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							className: !isObjects ? "active cappatex-active" : "",
							href: "/cappatex",
							onClick: () => setMenuOpen(false),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "division-mark",
								children: "POD"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "division-copy",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "CAPPATEX" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Kleidung gestalten" })]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "mobile-section-links",
						"aria-label": "Seitennavigation mobil",
						children: links.map(([label, href]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							href,
							onClick: () => setMenuOpen(false),
							children: [label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "↗" })]
						}, href))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						className: "mobile-account-link",
						href: accountHref,
						onClick: () => setMenuOpen(false),
						children: userName ? `Konto von ${userName.split(" ")[0]}` : "Anmelden & Designs speichern"
					})
				]
			})
		]
	})] });
}
//#endregion
export { SiteHeader as default };
