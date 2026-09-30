import { T as __toESM, b as require_react, t as require_jsx_runtime } from "../index.js";
import { t as Link } from "./link-B59wS0Al.js";
import { n as planName, r as tokenRules, t as creatorPlans } from "./creator-plans-K1yX56-R.js";
//#region app/konto/account-dashboard.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var shopOrderStatuses = {
	checkout_created: "Checkout begonnen",
	inquiry: "In Prüfung",
	paid: "Bezahlt",
	refunded: "Rückerstattet",
	partially_refunded: "Teilweise rückerstattet",
	voided: "Storniert"
};
var productionStatuses = {
	awaiting_payment: "Zahlung ausstehend",
	paid: "Bezahlt · STL druckbereit",
	production: "In Produktion",
	shipped: "Versendet",
	cancelled: "Storniert"
};
function parseOrderItems(value) {
	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) return parsed;
		if (parsed && typeof parsed === "object" && "items" in parsed && Array.isArray(parsed.items)) return parsed.items;
		return [];
	} catch {
		return [];
	}
}
function AccountDashboard({ user }) {
	const [account, setAccount] = (0, import_react.useState)(null);
	const [message, setMessage] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [busyPlan, setBusyPlan] = (0, import_react.useState)("");
	const [busyOrder, setBusyOrder] = (0, import_react.useState)("");
	const [orders, setOrders] = (0, import_react.useState)([]);
	const [productionOrders, setProductionOrders] = (0, import_react.useState)([]);
	const loadProductionOrders = async (owner = account?.isOwner || false) => {
		const response = await fetch(`/api/production-orders${owner ? "?scope=production" : ""}`, { cache: "no-store" });
		if (response.ok) setProductionOrders((await response.json()).orders || []);
	};
	const loadAccount = async () => {
		const response = await fetch("/api/account", { cache: "no-store" });
		const data = await response.json();
		if (response.ok) {
			setAccount(data.account);
			await loadProductionOrders(Boolean(data.account.isOwner));
		} else setMessage(data.error || "Konto konnte nicht geladen werden.");
		setLoading(false);
	};
	(0, import_react.useEffect)(() => {
		fetch("/api/account", { cache: "no-store" }).then(async (response) => ({
			response,
			data: await response.json()
		})).then(async ({ response, data }) => {
			if (!response.ok) throw new Error(data.error || "Konto konnte nicht geladen werden.");
			setAccount(data.account);
			await loadProductionOrders(Boolean(data.account.isOwner));
			setLoading(false);
		}).catch((error) => {
			setMessage(error instanceof Error ? error.message : "Konto konnte nicht geladen werden.");
			setLoading(false);
		});
		fetch("/api/orders", { cache: "no-store" }).then((response) => response.ok ? response.json() : { orders: [] }).then((data) => setOrders(data.orders || [])).catch(() => void 0);
	}, []);
	const requestPlan = async (plan) => {
		setBusyPlan(plan);
		setMessage("");
		const data = await (await fetch("/api/account", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ plan })
		})).json();
		setMessage(data.message || data.error);
		await loadAccount();
		setBusyPlan("");
	};
	const updateProductionStatus = async (id, status) => {
		setBusyOrder(id);
		setMessage("");
		const response = await fetch("/api/production-orders", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id,
				status
			})
		});
		const data = await response.json();
		setMessage(data.message || data.error);
		if (response.ok) await loadProductionOrders(true);
		setBusyOrder("");
	};
	const canDownloadProductionFile = (order) => {
		if (account?.isOwner) return [
			"paid",
			"production",
			"shipped"
		].includes(order.status);
		return Boolean(account?.capabilities.canDownload3d);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "account-wrap",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "account-hero",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "AB3D Creator Account"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", { children: [
						"Hallo, ",
						user.displayName.split(" ")[0],
						"."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Verwalte deine Design-Tokens, Abos, Bestellungen und druckfertigen Dateien an einem Ort." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "account-identity",
						children: user.email
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "token-overview",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Verfügbare Design-Tokens" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: loading ? "—" : account?.unlimited ? "∞" : account?.tokenBalance ?? 0 }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: account?.unlimited ? "Launch-Pass aktiv · aktuell kein Token-Abzug." : "Vor jedem Auftrag siehst du den exakten Tokenpreis." })
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Aktueller Plan" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "plan-name",
							children: account ? planName(account.plan) : "Explorer"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["Status: ", account?.subscriptionStatus === "active" ? "Aktiv" : account?.subscriptionStatus === "pending" ? "Angefragt" : "Kostenlos"] })
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						className: "button primary",
						href: "/#studio",
						children: "Neues 3D-Design"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "token-guide",
				"aria-labelledby": "token-guide-title",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "Einfach erklärt"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "token-guide-title",
						children: "Was kostet wie viele Tokens?"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "token-rule-grid",
						children: tokenRules.map(([tokens, use]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: tokens }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: use })] }, tokens))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Tokens werden nur bei gestarteten KI- oder Druckaufbereitungen eingesetzt. Eine physische Bestellung enthält die interne Produktionsdatei für AB3D – du brauchst dafür kein Abo." })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "order-history",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "section-heading",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "Fertigungsaufträge"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: account?.isOwner ? "Druckwarteschlange." : "Deine 3D-Aufträge." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Nach bestätigter Zahlung wird die STL für AB3D freigeschaltet. Eigene STL-Downloads sind im 3D-Studio- und Complete-Abo enthalten." })]
				}), productionOrders.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "production-order-list",
					children: productionOrders.map((order) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "production-order-main",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								new Date(order.createdAt).toLocaleDateString("de-CH"),
								" · ",
								order.id
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: order.templateName }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								order.quantity,
								"× · ",
								order.heightMm / 10,
								" cm · ",
								order.material,
								" · ",
								order.finish
							] }),
							account?.isOwner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["Kunde: ", order.email] })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "production-order-actions",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `order-status status-${order.status}`,
								children: productionStatuses[order.status] || order.status
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: new Intl.NumberFormat("de-CH", {
								style: "currency",
								currency: order.currency
							}).format(order.estimatedTotalCents / 100) }),
							canDownloadProductionFile(order) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								className: "production-file-link",
								href: `/api/meshy?format=stl&productionOrderId=${encodeURIComponent(order.id)}`,
								download: true,
								children: "STL herunterladen"
							}) : account?.isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "STL nach Zahlungsfreigabe verfügbar" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								className: "production-file-link",
								href: "#plaene",
								children: "Eigenen STL-Download freischalten"
							}),
							account?.isOwner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "production-status-buttons",
								children: [
									order.status === "awaiting_payment" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										disabled: busyOrder === order.id,
										onClick: () => updateProductionStatus(order.id, "paid"),
										children: "Zahlung bestätigen"
									}),
									order.status === "paid" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										disabled: busyOrder === order.id,
										onClick: () => updateProductionStatus(order.id, "production"),
										children: "Produktion starten"
									}),
									order.status === "production" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										disabled: busyOrder === order.id,
										onClick: () => updateProductionStatus(order.id, "shipped"),
										children: "Als versendet markieren"
									})
								]
							})
						]
					})] }, order.id))
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "no-orders",
					children: ["Noch kein individueller Fertigungsauftrag. ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						href: "/#studio",
						children: "3D-Design erstellen →"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "order-history",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "section-heading",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "Shop-Bestellungen"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Deine Objekte." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Deine auf AB3D gestarteten Checkouts und die von Shopify bestätigten Bestellungen." })]
				}), orders.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "order-list",
					children: orders.map((order) => {
						const items = parseOrderItems(order.itemsJson);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: new Date(order.createdAt).toLocaleDateString("de-CH") }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: order.id }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: items.map((item) => `${item.quantity}× ${item.name}`).join(" · ") })
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `order-status status-${order.status}`,
							children: shopOrderStatuses[order.status] || order.status
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: new Intl.NumberFormat("de-CH", {
							style: "currency",
							currency: order.currency
						}).format(order.totalCents / 100) })] })] }, order.id);
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "no-orders",
					children: ["Noch keine Shop-Bestellung gespeichert. ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						href: "/#kollektion",
						children: "Kollektion entdecken →"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "plans-section",
				id: "plaene",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "section-heading",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "Einzeln oder gemeinsam"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Das passende Creator-Abo." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "3D Studio für eigene 3D-Dateien, CAPPATEX für tragbare Motive oder Complete für beide Bereiche mit gemeinsamem Guthaben." })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "plan-grid",
						children: creatorPlans.map((plan) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: `plan-card ${plan.popular ? "popular" : ""}`,
							children: [
								plan.popular && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "plan-badge",
									children: "Bestes Gesamtpaket"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: plan.name }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { children: [plan.price, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: plan.cadence })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: plan.tokens }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "plan-audience",
									children: plan.audience
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: plan.features.map((feature) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["✓ ", feature] }, feature)) }),
								plan.id === "free" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									disabled: true,
									children: "Explorer ist inklusive"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => requestPlan(plan.id),
									disabled: Boolean(busyPlan),
									children: busyPlan === plan.id ? "Wird gespeichert …" : account?.requestedPlan === plan.id ? "Angefragt ✓" : `${plan.name} anfragen`
								})
							]
						}, plan.id))
					}),
					message && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "account-message",
						role: "status",
						children: message
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "billing-note",
						children: "Die Auswahl wird aktuell als Abo-Anfrage gespeichert. Eine Belastung erfolgt erst nach deiner ausdrücklichen Zahlungsfreigabe."
					})
				]
			})
		]
	});
}
//#endregion
export { AccountDashboard as default };
