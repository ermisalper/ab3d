import { T as __toESM, b as require_react, t as require_jsx_runtime } from "../index.js";
import { t as Link } from "./link-B59wS0Al.js";
import SiteHeader from "./site-header-DdH2auuO.js";
//#region app/cappatex/cappatex-studio.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var colors = [
	{
		name: "Natural",
		value: "#eee8dd"
	},
	{
		name: "Graphit",
		value: "#303531"
	},
	{
		name: "Salbei",
		value: "#8d9a87"
	},
	{
		name: "Terracotta",
		value: "#bd684d"
	}
];
var styles = [
	"Minimal",
	"Illustrativ",
	"Retro",
	"Streetwear"
];
var examples = [
	"Eine einzelne alpine Blume als ruhige Linienzeichnung in Terracotta und Creme",
	"Abstrakte Wellen, geometrisch, kräftiger Kontrast, ohne Text",
	"Verspielter Fuchs im Schweizer Scherenschnitt-Stil, warm und freundlich"
];
var heroPrints = [
	{
		id: "alpine",
		label: "Alpine Bloom",
		mark: "✦",
		lineOne: "ALPINE",
		lineTwo: "BLOOM"
	},
	{
		id: "orbit",
		label: "Orbit 03",
		mark: "●",
		lineOne: "ORBIT",
		lineTwo: "03"
	},
	{
		id: "wild",
		label: "Wild Lines",
		mark: "≈",
		lineOne: "WILD",
		lineTwo: "LINES"
	},
	{
		id: "cappatex",
		label: "CAPPATEX Studio",
		mark: "C",
		lineOne: "CAPPA",
		lineTwo: "TEX"
	}
];
function money(amount, currency = "CHF") {
	return new Intl.NumberFormat("de-CH", {
		style: "currency",
		currency
	}).format(amount);
}
function CappatexStudio({ userName }) {
	const [catalogProducts, setCatalogProducts] = (0, import_react.useState)([]);
	const [catalogMessage, setCatalogMessage] = (0, import_react.useState)("Produktkatalog wird geladen …");
	const [catalogStatus, setCatalogStatus] = (0, import_react.useState)("loading");
	const [canDownloadHd, setCanDownloadHd] = (0, import_react.useState)(false);
	const [tokenBalance, setTokenBalance] = (0, import_react.useState)(null);
	const [productId, setProductId] = (0, import_react.useState)("tshirt");
	const [prompt, setPrompt] = (0, import_react.useState)(examples[0]);
	const [style, setStyle] = (0, import_react.useState)("Minimal");
	const [productColor, setProductColor] = (0, import_react.useState)(colors[0].value);
	const [variantId, setVariantId] = (0, import_react.useState)("");
	const [quantity, setQuantity] = (0, import_react.useState)(1);
	const [designScale, setDesignScale] = (0, import_react.useState)(72);
	const [designY, setDesignY] = (0, import_react.useState)(50);
	const [generatedImage, setGeneratedImage] = (0, import_react.useState)(null);
	const [reference, setReference] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [checkoutBusy, setCheckoutBusy] = (0, import_react.useState)(false);
	const [termsAccepted, setTermsAccepted] = (0, import_react.useState)(false);
	const [heroPrintIndex, setHeroPrintIndex] = (0, import_react.useState)(0);
	const [heroPressActive, setHeroPressActive] = (0, import_react.useState)(false);
	const heroPrintTimer = (0, import_react.useRef)(null);
	const product = (0, import_react.useMemo)(() => catalogProducts.find((entry) => entry.id === productId) || catalogProducts[0] || null, [productId, catalogProducts]);
	const variant = product?.variants.find((entry) => entry.shopifyVariantId === variantId) || product?.variants[0] || null;
	const unitPrice = variant?.price ? Number(variant.price.amount) : product?.price || 0;
	const currency = variant?.price?.currencyCode || product?.currency || "CHF";
	const total = unitPrice * quantity;
	(0, import_react.useEffect)(() => {
		let active = true;
		fetch("/api/cappatex/catalog", { headers: { Accept: "application/json" } }).then(async (response) => ({
			response,
			data: await response.json()
		})).then(({ response, data }) => {
			if (!active) return;
			if (!response.ok || !Array.isArray(data.products) || data.products.length === 0) {
				setCatalogMessage(data.message || data.error || "Der verbundene Produktkatalog ist momentan nicht verfügbar.");
				setCatalogStatus("error");
				return;
			}
			const normalized = data.products.map((entry) => ({
				...entry,
				category: entry.category || "CAPPATEX",
				price: Number(entry.variants?.[0]?.price?.amount || entry.price || 0),
				currency: entry.variants?.[0]?.price?.currencyCode || entry.currency || "CHF",
				source: "shopify"
			}));
			setCatalogProducts(normalized);
			setCatalogMessage(data.message || `${normalized.length} Shopify-Produkte verfügbar`);
			setCatalogStatus("ready");
			setProductId(normalized[0].id);
			setVariantId(normalized[0].variants[0]?.shopifyVariantId || "");
		}).catch(() => {
			if (!active) return;
			setCatalogMessage("Der verbundene Produktkatalog ist momentan nicht erreichbar.");
			setCatalogStatus("error");
		});
		return () => {
			active = false;
		};
	}, []);
	(0, import_react.useEffect)(() => () => {
		if (heroPrintTimer.current !== null) window.clearTimeout(heroPrintTimer.current);
	}, []);
	const pressNextHeroDesign = () => {
		if (heroPressActive) return;
		setHeroPressActive(true);
		heroPrintTimer.current = window.setTimeout(() => {
			setHeroPrintIndex((current) => (current + 1) % heroPrints.length);
			heroPrintTimer.current = null;
		}, 310);
	};
	(0, import_react.useEffect)(() => {
		fetch("/api/account", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => {
			setCanDownloadHd(Boolean(data?.account?.capabilities?.canDownloadHd));
			if (typeof data?.account?.tokenBalance === "number") setTokenBalance(data.account.tokenBalance);
		}).catch(() => void 0);
	}, []);
	const selectProduct = (next) => {
		setProductId(next.id);
		setVariantId(next.variants[0]?.shopifyVariantId || "");
	};
	const generate = async () => {
		const idea = prompt.trim();
		if (idea.length < 12 || busy) return;
		if (!product) {
			setError("Wähle zuerst ein verfügbares Produkt aus dem verbundenen Katalog.");
			return;
		}
		setBusy(true);
		setError("");
		setCopied(false);
		try {
			const response = await fetch("/api/cappatex", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prompt: idea,
					product: product.kind,
					style,
					confirmGeneration: true
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Das Design konnte nicht erstellt werden.");
			setGeneratedImage(data.image);
			setReference(data.designId);
			if (typeof data.tokenBalance === "number") setTokenBalance(data.tokenBalance);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Das Design konnte nicht erstellt werden.");
		} finally {
			setBusy(false);
		}
	};
	const downloadDesign = () => {
		if (!generatedImage) return;
		if (!canDownloadHd) {
			setError("Der eigene HD-Motivdownload ist im CAPPATEX- oder Complete-Abo enthalten. Für eine physische Bestellung brauchst du kein Datei-Abo.");
			return;
		}
		if (generatedImage.startsWith("data:")) {
			const anchor = document.createElement("a");
			anchor.href = generatedImage;
			anchor.download = `${reference || "cappatex-design"}.png`;
			anchor.click();
			return;
		}
		window.open(generatedImage, "_blank", "noopener,noreferrer");
	};
	const copyOrderDetails = async () => {
		if (!product) return;
		const details = `${reference}\n${product.name} · ${variant?.title || "Standard"} · ${colors.find((color) => color.value === productColor)?.name}\nMotiv: ${prompt.trim()}`;
		await navigator.clipboard.writeText(details);
		setCopied(true);
	};
	const startCheckout = async () => {
		if (!reference || !product || !variant?.shopifyVariantId || checkoutBusy) return;
		if (!product.printifyProductId || !variant.printifyVariantId) {
			setError("Dieses Shopify-Produkt ist noch nicht eindeutig mit seiner Printify-Produktionsvariante verknüpft.");
			return;
		}
		setCheckoutBusy(true);
		setError("");
		try {
			const response = await fetch("/api/cappatex/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					designId: reference,
					printifyProductId: product.printifyProductId,
					printifyVariantId: variant.printifyVariantId,
					shopifyVariantId: variant.shopifyVariantId,
					quantity,
					termsAccepted,
					placement: {
						scale: designScale,
						y: designY
					}
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Der Checkout konnte nicht vorbereitet werden.");
			const checkoutUrl = new URL(data.checkoutUrl);
			if (checkoutUrl.protocol !== "https:") throw new Error("Der sichere Checkout konnte nicht geöffnet werden.");
			window.location.assign(checkoutUrl.toString());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Der Checkout konnte nicht vorbereitet werden.");
			setCheckoutBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "cappatex-page",
		id: "main-content",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteHeader, {
				area: "cappatex",
				userName
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "cappatex-hero",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "KI-Design · Print on Demand"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", { children: [
						"Deine Idee.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "Dein Statement." })
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Beschreibe dein Wunschmotiv, sieh es direkt auf deinem Produkt und passe Grösse sowie Position selbst an." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "button primary",
						href: "#studio",
						children: "Jetzt gestalten"
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "cappatex-hero-art",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: `cappatex-press-scene ${heroPressActive ? "is-pressing" : ""}`,
						onClick: pressNextHeroDesign,
						onAnimationEnd: (event) => {
							if (event.animationName === "cappatexPressCycle") setHeroPressActive(false);
						},
						"aria-label": `T-Shirt bedrucken. Aktuelles Motiv: ${heroPrints[heroPrintIndex].label}. Klicken für das nächste Design.`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "cappatex-press-grid",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "cappatex-press-machine",
								"aria-hidden": "true",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cappatex-press-column" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cappatex-press-rail" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "cappatex-press-head",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "PRINT" })]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "cappatex-shirt-stage",
								"aria-hidden": "true",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cappatex-shirt-shadow" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "cappatex-hero-shirt-real",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cappatex-shirt-neck" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cappatex-shirt-seam seam-left" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cappatex-shirt-seam seam-right" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: `cappatex-shirt-print print-${heroPrints[heroPrintIndex].id}`,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: heroPrints[heroPrintIndex].mark }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: heroPrints[heroPrintIndex].lineOne }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: heroPrints[heroPrintIndex].lineTwo })
											]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "cappatex-ink-flash",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "cappatex-press-instruction",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("i", { children: [
										String(heroPrintIndex + 1).padStart(2, "0"),
										" / ",
										String(heroPrints.length).padStart(2, "0")
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: heroPressActive ? "Wird gepresst …" : "Klicken & neu bedrucken" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Jeder Klick · ein neues Motiv" })
								]
							})
						]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "cappatex-flow",
				id: "studio",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "cappatex-flow-intro",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "eyebrow",
							children: "CAPPATEX Design Studio"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "In drei klaren Schritten." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Du brauchst keine Design-Erfahrung. Wähle, beschreibe und prüfe dein Produkt vor der Bestellung." })
					]
				}), product ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "cappatex-workspace",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "cappatex-controls",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "cappatex-step",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "cappatex-step-heading",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "1" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Produkt wählen" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Worauf soll dein Motiv gedruckt werden?" })] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: `cappatex-catalog-state ${catalogProducts.length ? "is-live" : ""}`,
									children: catalogMessage
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "cappatex-products",
									children: catalogProducts.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										className: entry.id === product.id ? "active" : "",
										onClick: () => selectProduct(entry),
										children: [
											entry.image ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
												src: entry.image,
												alt: ""
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductIcon, { id: entry.kind }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: entry.name }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["ab ", money(entry.price, entry.currency)] })
										]
									}, entry.id))
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "cappatex-step",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "cappatex-step-heading",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Idee beschreiben" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Farben, Stil, Motiv und Stimmung helfen der KI." })] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "cappatex-prompt",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Dein Wunschmotiv" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
											value: prompt,
											maxLength: 500,
											onChange: (event) => setPrompt(event.target.value),
											placeholder: "Zum Beispiel: Eine einzelne alpine Blume als klare Linienzeichnung …"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [prompt.length, "/500 Zeichen"] })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "cappatex-examples",
									"aria-label": "Prompt-Beispiele",
									children: examples.map((example, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setPrompt(example),
										children: ["Idee ", index + 1]
									}, example))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
									className: "cappatex-styles",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "Bildstil" }), styles.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: style === entry ? "active" : "",
										onClick: () => setStyle(entry),
										children: entry
									}, entry))]
								}),
								error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "cappatex-error",
									role: "alert",
									children: error
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "button primary cappatex-generate",
									onClick: generate,
									disabled: busy || prompt.trim().length < 12,
									children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), " Design wird erstellt …"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: "✦ Design generieren" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "cappatex-wait-note",
									children: [
										"1 Motivvorschau = 1 Token",
										tokenBalance !== null ? ` · Dein Guthaben: ${tokenBalance}` : "",
										". Die KI benötigt meistens 20–60 Sekunden."
									]
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "cappatex-preview-panel",
						"aria-live": "polite",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "cappatex-preview-head",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Live-Vorschau" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: product.name })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: money(unitPrice, currency) })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `cappatex-preview product-${product.kind} ${busy ? "is-busy" : ""}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cappatex-preview-grid" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductMockup, {
										id: product.kind,
										productImage: product.image,
										color: productColor,
										image: generatedImage,
										scale: designScale,
										y: designY
									}),
									busy && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "cappatex-generating",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Deine Idee wird gestaltet" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Motiv · Farben · Druckfläche" })
										]
									}),
									!generatedImage && !busy && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "cappatex-empty-preview",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "✦" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Dein Motiv erscheint hier" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Nach der Generierung kannst du es frei anpassen." })
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "cappatex-customize",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Produktfarbe", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "cappatex-color-row",
										children: colors.map((color) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: productColor === color.value ? "active" : "",
											style: { background: color.value },
											onClick: () => setProductColor(color.value),
											"aria-label": `${color.name} wählen`,
											title: color.name
										}, color.value))
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
										"Motivgrösse ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [designScale, "%"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "range",
											min: "35",
											max: "110",
											value: designScale,
											onChange: (event) => setDesignScale(Number(event.target.value))
										})
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
										"Position ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: designY < 42 ? "Oben" : designY > 58 ? "Unten" : "Mitte" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "range",
											min: "28",
											max: "72",
											value: designY,
											onChange: (event) => setDesignY(Number(event.target.value))
										})
									] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "cappatex-order-config",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Variante", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
										value: variant?.shopifyVariantId || "",
										onChange: (event) => setVariantId(event.target.value),
										children: product.variants.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
											value: entry.shopifyVariantId,
											disabled: !entry.available || !entry.printifyVariantId,
											children: [entry.title, !entry.available ? " – ausverkauft" : !entry.printifyVariantId ? " – Produktion wird verknüpft" : ""]
										}, entry.shopifyVariantId))
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Menge", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
										value: quantity,
										onChange: (event) => setQuantity(Number(event.target.value)),
										children: [
											1,
											2,
											3,
											4,
											5
										].map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: entry }, entry))
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Shoppreis" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: money(total, currency) })] })
								]
							}),
							generatedImage && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "cappatex-ready",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "✓" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Design bereit" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["Referenz ", reference] })] })] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "cappatex-ready-actions",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: downloadDesign,
											children: canDownloadHd ? "HD-Motiv herunterladen" : "HD-Download im Abo"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: copyOrderDetails,
											children: copied ? "Referenz kopiert ✓" : "Bestelldaten kopieren"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "legal-consent cappatex-consent",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: termsAccepted,
											onChange: (event) => setTermsAccepted(event.target.checked)
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Ich akzeptiere die ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
												href: "/recht/agb",
												target: "_blank",
												children: "AGB"
											}),
											" und habe die ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
												href: "/recht/datenschutz",
												target: "_blank",
												children: "Datenschutzerklärung"
											}),
											" gelesen."
										] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										className: "button primary",
										onClick: startCheckout,
										disabled: checkoutBusy || !termsAccepted || !product.printifyProductId || !variant?.shopifyVariantId || !variant.printifyVariantId || !variant.available,
										children: checkoutBusy ? "Sicherer Checkout wird vorbereitet …" : "Zahlung sicher öffnen →"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Design, Variante und Platzierung werden an den geschützten Shopify-Checkout übergeben. Nach bestätigter Zahlung wird die finale Druckdatei für die Produktion erstellt." })
								]
							})
						]
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "cappatex-catalog-unavailable",
					role: catalogStatus === "loading" ? "status" : "alert",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						"aria-hidden": "true",
						children: catalogStatus === "loading" ? "…" : "!"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: catalogStatus === "loading" ? "Produktkatalog wird verbunden" : "Studio derzeit nicht bestellbar" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: catalogMessage }),
						catalogStatus === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Es werden keine erfundenen Produkte oder Preise angezeigt. Bitte versuche es später erneut." })
					] })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "cappatex-how section",
				id: "ablauf",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "So entsteht dein Einzelstück"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { children: [
					"Einfach gestaltet.",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					"Bewusst produziert."
				] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "01" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Du gestaltest" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Die KI übersetzt deine Beschreibung in ein druckbares, quadratisches Motiv." })] })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "02" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Du prüfst" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Produkt, Farbe, Grösse und Platzierung bleiben bis zur Bestellung anpassbar." })] })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "03" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Wir produzieren" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Erst nach deiner Bestellung wird dein Einzelstück gedruckt und versendet." })] })] })
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "faq-section section cappatex-faq",
				id: "faq",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "Häufige Fragen"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Klar vor der Bestellung." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Du entscheidest erst nach der Vorschau, ob dein Motiv produziert werden soll." })
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "faq-list",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "Wann wird mein Produkt produziert?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Erst nach deiner bestätigten Zahlung. Produkt, Variante, Motivgrösse und Position werden mit der Bestellung gespeichert und für die Produktion aufbereitet." })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "Kann ich mein Motiv herunterladen?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Ein eigener HD-Dateidownload ist im CAPPATEX- oder Complete-Abo enthalten. Für die Bestellung eines physischen Produkts brauchst du kein Download-Abo." })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "Warum sehe ich manchmal keinen Produktkatalog?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Das Studio zeigt ausschliesslich tatsächlich verbundene und bestellbare Produkte. Ist die Verbindung vorübergehend nicht verfügbar, werden keine erfundenen Produkte oder Preise eingeblendet." })] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "cappatex-footer",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "footer-brand",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							className: "brand",
							href: "/#top",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "AB" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "3D" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "CAPPATEX verbindet deine Idee mit hochwertigem Print on Demand." })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Studios" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							href: "/#studio",
							children: "3D AI Studio"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: "#studio",
							children: "CAPPATEX Studio"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							href: "/#kollektion",
							children: "Kollektion"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Service & Recht" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: "mailto:hello@ab3d.ch",
							children: "Kontakt"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							href: "/recht",
							children: "Rechtscenter"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							href: "/recht/datenschutz",
							children: "Datenschutz"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							href: "/recht/agb",
							children: "AGB"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							href: "/recht/versand-rueckgabe",
							children: "Versand & Rückgabe"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "© 2026 AB3D · CAPPATEX · Designed in Switzerland" })
				]
			})
		]
	});
}
function ProductIcon({ id }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
		"aria-hidden": "true",
		children: {
			tshirt: "T",
			hoodie: "H",
			cap: "⌒",
			case: "▯",
			swimwear: "≈",
			socks: "∿",
			poster: "□",
			notebook: "▥",
			underwear: "⌒"
		}[id]
	});
}
function ProductMockup({ id, productImage, color, image, scale, y }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `cappatex-mockup mockup-${id} ${productImage ? "has-photo" : ""}`,
		style: { "--product-color": color },
		children: [
			productImage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				className: "cappatex-product-photo",
				src: productImage,
				alt: ""
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mockup-piece piece-a" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mockup-piece piece-b" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "cappatex-print-area",
				children: image && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "cappatex-design",
					role: "img",
					"aria-label": "Dein generiertes Motiv auf dem Produkt",
					style: {
						backgroundImage: `url(${JSON.stringify(image).slice(1, -1)})`,
						width: `${scale}%`,
						aspectRatio: "1",
						top: `${y}%`
					}
				})
			})
		]
	});
}
//#endregion
export { CappatexStudio as default };
