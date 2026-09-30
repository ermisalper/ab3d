import { T as __toESM, b as require_react, t as require_jsx_runtime } from "../index.js";
import { t as Link } from "./link-B59wS0Al.js";
import SiteHeader from "./site-header-DdH2auuO.js";
import { r as tokenRules, t as creatorPlans } from "./creator-plans-K1yX56-R.js";
//#region app/model-viewer.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function ModelViewer({ src, poster, autoRotate, setAutoRotate }) {
	const shellRef = (0, import_react.useRef)(null);
	const viewerRef = (0, import_react.useRef)(null);
	const [status, setStatus] = (0, import_react.useState)("loading");
	(0, import_react.useEffect)(() => {
		const viewer = viewerRef.current;
		if (!viewer) return;
		setStatus("loading");
		const loaded = () => setStatus("ready");
		const failed = () => setStatus("error");
		viewer.addEventListener("load", loaded);
		viewer.addEventListener("error", failed);
		return () => {
			viewer.removeEventListener("load", loaded);
			viewer.removeEventListener("error", failed);
		};
	}, [src]);
	const resetView = () => {
		const viewer = viewerRef.current;
		if (!viewer) return;
		viewer.setAttribute("camera-orbit", "0deg 75deg auto");
		viewer.setAttribute("camera-target", "auto auto auto");
		viewer.resetTurntableRotation?.(0);
		viewer.jumpCameraToGoal?.();
	};
	const message = status === "ready" ? ["Ziehen zum Drehen", "Mausrad: zoomen · Rechtsklick: verschieben"] : status === "error" ? ["Modell konnte nicht geladen werden", "Lade die GLB-Datei herunter oder starte die Generierung erneut."] : ["3D-Modell wird geladen", "Modelldatei wird sicher übertragen …"];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "model-viewer-shell",
		ref: shellRef,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "viewer-help",
				role: "status",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: message[0] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: message[1] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("model-viewer", {
				ref: viewerRef,
				src,
				poster,
				alt: "Von AB3D generiertes dreidimensionales Design",
				"camera-controls": true,
				"touch-action": "pan-y",
				"auto-rotate": autoRotate || void 0,
				"auto-rotate-delay": "800",
				"rotation-per-second": "18deg",
				"camera-orbit": "0deg 75deg auto",
				"min-camera-orbit": "auto 15deg 50%",
				"max-camera-orbit": "auto 165deg 400%",
				"shadow-intensity": "1.2",
				"shadow-softness": ".8",
				exposure: "1",
				"tone-mapping": "aces",
				"environment-image": "neutral",
				"interaction-prompt": "auto",
				"interaction-prompt-style": "wiggle",
				loading: "eager"
			}, src),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "viewer-controls",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: autoRotate ? "active" : "",
						onClick: () => setAutoRotate(!autoRotate),
						children: autoRotate ? "Rotation stoppen" : "Automatisch drehen"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: resetView,
						children: "Ansicht zentrieren"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => shellRef.current?.requestFullscreen?.(),
						children: "Vollbild"
					})
				]
			})
		]
	});
}
//#endregion
//#region app/ai-design-studio.tsx
var templates = [
	{
		id: "free-design",
		name: "Eigene Idee",
		category: "Freier Start",
		description: "Beschreibe frei, was du bauen möchtest. Der Produktplaner erkennt die Funktion und stellt passende Rückfragen.",
		prompt: "A custom functional 3D-printable product based on the customer's freely described idea",
		mode: "text",
		complexity: 1.2,
		image: "/creation-templates.webp",
		examples: [
			"Ein Kopfhörerständer in Form eines Berges mit Kabelablage",
			"Eine Mondlampe auf einem organischen Holzast-Sockel",
			"Eine kleine Dose in Walform für Schmuck"
		],
		inputHint: "Schreibe deine Idee ganz normal – Produktkarten sind nur optionale Abkürzungen",
		printRule: "Aufbau, Teile, Wandstärken, Passungen und Nutzung werden vor der Generierung im Dialog geklärt.",
		defaultHeight: 20,
		minHeight: 5,
		maxHeight: 50,
		badge: "Frei",
		featured: true
	},
	{
		id: "chibi",
		name: "Chibi-Figur",
		category: "Figuren",
		description: "Dein Foto als freundliche Sammelfigur.",
		prompt: "Transform the person in the reference into an original charming chibi collectible with a recognisable face, enlarged head, simplified robust body and a joined round display base",
		mode: "image",
		complexity: 1.4,
		image: "/creations/chibi.webp",
		examples: [
			"Freundlicher Ausdruck",
			"Lieblingsoutfit übernehmen",
			"Mit rundem Namenssockel"
		],
		inputHint: "Ein klares Ganzkörperfoto einer Person",
		printRule: "Alle Körperteile verbunden, stabiler Sockel, keine dünnen Finger.",
		defaultHeight: 14,
		minHeight: 8,
		maxHeight: 28,
		badge: "Foto"
	},
	{
		id: "vinyl",
		name: "Vinyl-Figur",
		category: "Figuren",
		description: "Markante Sammlerfigur mit glatten Formen.",
		prompt: "Transform the person in the reference into an original premium vinyl-style collectible, recognisable hairstyle and outfit, clean simplified volumes, slightly oversized head and a stable integrated base",
		mode: "image",
		complexity: 1.45,
		image: "/creations/vinyl.webp",
		examples: [
			"Mit Sonnenbrille",
			"Eleganter Sammler-Look",
			"Outfit beibehalten"
		],
		inputHint: "Ein frontales Foto mit gut sichtbarem Gesicht",
		printRule: "Kompakte Volumen, verbundene Gliedmassen und sicherer Stand.",
		defaultHeight: 16,
		minHeight: 10,
		maxHeight: 32,
		badge: "Foto"
	},
	{
		id: "brick",
		name: "Brick-Figur",
		category: "Figuren",
		description: "Dein Look als originale Blockfigur.",
		prompt: "Create an original block-proportioned collectible inspired by the person in the reference, with recognisable face and clothing, simple non-branded toy geometry, connected limbs and a stable display base",
		mode: "image",
		complexity: 1.2,
		image: "/creations/brick.webp",
		examples: [
			"Als Abenteurer",
			"Mit Arbeitskleidung",
			"Lieblingsfarben nutzen"
		],
		inputHint: "Ein Ganzkörper- oder Porträtfoto einer Person",
		printRule: "Originale, markenfreie Form; kräftige Gelenke und flache Standfläche.",
		defaultHeight: 12,
		minHeight: 7,
		maxHeight: 24,
		badge: "Foto"
	},
	{
		id: "pet",
		name: "Haustier-Figur",
		category: "Figuren",
		description: "Dein Tier als ausdrucksstarke Miniatur.",
		prompt: "Transform the animal in the reference into a charming original collectible, preserve defining markings and expression, simplify fur into printable sculpted masses and join the pose to a stable oval base",
		mode: "image",
		complexity: 1.35,
		image: "/creations/pet.webp",
		examples: [
			"Fellzeichnung beibehalten",
			"Sitzende Pose",
			"Mit kleinem Namensschild"
		],
		inputHint: "Ein scharfes Foto, auf dem das Tier vollständig sichtbar ist",
		printRule: "Ohren, Schwanz und Beine werden robust mit Körper oder Sockel verbunden.",
		defaultHeight: 13,
		minHeight: 8,
		maxHeight: 26,
		badge: "Foto"
	},
	{
		id: "keychain",
		name: "3D-Schlüsselanhänger",
		category: "Personalisieren",
		description: "Dein Motiv als robustes Relief für unterwegs.",
		prompt: "Convert the main subject into a clean simplified bas-relief keychain medallion with a flat back, rounded safe edges, readable layered depth and a reinforced integrated 5 mm top loop",
		mode: "image",
		complexity: .75,
		image: "/creations/keychain.webp",
		examples: [
			"Haustier als Relief",
			"Porträt mit Initialen",
			"Bergmotiv in Schichten"
		],
		inputHint: "Ein kontrastreiches Foto mit einem klaren Hauptmotiv",
		printRule: "Flache Rückseite, Relief statt Vollfigur und verstärkte 5-mm-Öse.",
		defaultHeight: 6,
		minHeight: 4,
		maxHeight: 10,
		badge: "Foto"
	},
	{
		id: "magnet",
		name: "3D-Kühlschrankmagnet",
		category: "Personalisieren",
		description: "Foto oder Landschaft als plastisches Relief.",
		prompt: "Turn the reference into an artistic rectangular layered refrigerator magnet bas-relief, with a perfectly flat back, clear foreground and background depth separation, rounded frame and no fragile details",
		mode: "image",
		complexity: .7,
		image: "/creations/magnet.webp",
		examples: [
			"Berglandschaft als Relief",
			"Familienfoto vereinfachen",
			"Haustier im runden Rahmen"
		],
		inputHint: "Ein helles Foto mit klar erkennbarem Motiv",
		printRule: "Maximal 8 mm Relief, flache Magnetfläche und keine freistehenden Details.",
		defaultHeight: 7,
		minHeight: 5,
		maxHeight: 14,
		badge: "Foto"
	},
	{
		id: "lamp",
		name: "Skulpturale LED-Lampe",
		category: "Wohnen & Licht",
		description: "Deine Idee als sanft leuchtendes Objekt.",
		prompt: "A sculptural 3D-printable table lamp shade and coordinated stable base for a low-heat LED module, with rhythmic light openings, removable access and a reinforced cable route",
		mode: "text",
		complexity: 1.25,
		image: "/creations/lamp.webp",
		examples: [
			"Lampe in Katzenform",
			"Pilzform mit feinen Lamellen",
			"Organische Wellen mit warmem Licht"
		],
		inputHint: "Ein Satz zu Motiv, Form und gewünschter Lichtwirkung",
		printRule: "Nur für geprüfte Niedervolt-LED; Wandstärke, Kabelweg und Zugang werden vor Verkauf kontrolliert.",
		defaultHeight: 22,
		minHeight: 12,
		maxHeight: 45,
		badge: "Idee"
	},
	{
		id: "twist-egg",
		name: "Twist Egg",
		category: "Wohnen & Licht",
		description: "Drehbares Designobjekt mit zwei Teilen.",
		prompt: "An elegant two-part twist egg container with complementary spiral ribs, a broad stable lower half, rounded printable edges and generous assembly clearances",
		mode: "text",
		complexity: 1.1,
		image: "/creations/twist-egg.webp",
		examples: [
			"Feine spiralförmige Rillen",
			"Zwei kontrastierende Hälften",
			"Als kleine Schmuckdose"
		],
		inputHint: "Ein Satz zu Muster, Stil und Verwendungszweck",
		printRule: "Zweiteiliges Modell; Passung und 0,4–0,6 mm Spiel werden vor Fertigung geprüft.",
		defaultHeight: 11,
		minHeight: 7,
		maxHeight: 20,
		badge: "Idee"
	},
	{
		id: "planter",
		name: "Blumentopf",
		category: "Wohnen & Licht",
		description: "Individuelles Pflanzgefäss mit Untersetzer.",
		prompt: "A modern sculptural plant pot with a coordinated removable saucer, drainage opening, stable wide proportions, printable wall thickness and a clean original silhouette",
		mode: "text",
		complexity: 1.05,
		image: "/creations/planter.webp",
		examples: [
			"Walfisch mit Sukkulente",
			"Ruhige Japandi-Rillen",
			"Breite Form mit Untersetzer"
		],
		inputHint: "Ein Satz zu Motiv, Pflanze und gewünschtem Stil",
		printRule: "Geschlossene Wand, Ablaufloch, Untersetzer und breite kippsichere Basis.",
		defaultHeight: 16,
		minHeight: 9,
		maxHeight: 38,
		badge: "Idee"
	},
	{
		id: "keycap",
		name: "Individuelle Keycap",
		category: "Personalisieren",
		description: "Kleine 3D-Kunst für deine Tastatur.",
		prompt: "A compact original sculptural mechanical keyboard keycap with a robust low-profile decorative motif, clean underside and protected central cross-shaped mounting stem",
		mode: "image",
		complexity: .8,
		image: "/creations/keycap.webp",
		examples: [
			"Haustierkopf als Motiv",
			"Mini-Berglandschaft",
			"Japanische Wellen"
		],
		inputHint: "Ein klares Foto oder Motiv mit einfacher Silhouette",
		printRule: "MX-kompatible Passform ist Zielwert, wird aber vor Bestellung mit einem Testdruck validiert.",
		defaultHeight: 2,
		minHeight: 2,
		maxHeight: 4,
		badge: "Foto"
	},
	{
		id: "fold-fidget",
		name: "Einklapp-Fidget",
		category: "Spiel & Hobby",
		description: "Faltbares Print-in-Place-Spielobjekt.",
		prompt: "A satisfying foldable print-in-place fidget made from repeating original geometric segments, rounded hand-safe edges, captured hinges and generous functional joint clearances",
		mode: "text",
		complexity: 1.2,
		image: "/creations/fold-fidget.webp",
		examples: [
			"Sternförmige Segmente",
			"Ruhiges Klickgefühl",
			"Geometrische Endlosschleife"
		],
		inputHint: "Ein Satz zu Form, Bewegung und Muster",
		printRule: "Gelenkspiel 0,4–0,6 mm, keine Montage und abgerundete Kanten.",
		defaultHeight: 7,
		minHeight: 5,
		maxHeight: 14,
		badge: "Idee"
	},
	{
		id: "pixel-fidget",
		name: "Pixel-Fidget",
		category: "Spiel & Hobby",
		description: "Dein Pixelmotiv als beweglicher Anhänger.",
		prompt: "Convert the reference into an original pixel-art articulated fidget charm, using chunky readable cells, captured flexible joints, rounded edges and a reinforced attachment loop",
		mode: "image",
		complexity: 1,
		image: "/creations/pixel-fidget.webp",
		examples: [
			"Tier als Pixelmotiv",
			"8-Bit-Fantasiefigur",
			"Mit stabiler Anhängeröse"
		],
		inputHint: "Ein einfaches Motiv oder Pixelbild mit wenig Farben",
		printRule: "Große Pixelzellen, gefangene Gelenke und verstärkte Öse.",
		defaultHeight: 8,
		minHeight: 5,
		maxHeight: 14,
		badge: "Foto"
	},
	{
		id: "terrain",
		name: "Tabletop-Terrain",
		category: "Spiel & Hobby",
		description: "Modulares Gelände für deine Spielwelt.",
		prompt: "A modular rocky tabletop terrain tile with clear walkable levels, a perfectly flat underside, robust readable details, compatible straight edges and no unsupported fragile overhangs",
		mode: "text",
		complexity: 1.45,
		image: "/creations/terrain.webp",
		examples: [
			"Alpine Ruinenlandschaft",
			"Modulare Felsklippen",
			"Fantasy-Wald mit Wegen"
		],
		inputHint: "Ein Satz zu Welt, Geländeart und Spielfläche",
		printRule: "Flache Unterseite, definierte Modulränder und robuste Miniaturdetails.",
		defaultHeight: 6,
		minHeight: 3,
		maxHeight: 15,
		badge: "Idee"
	},
	{
		id: "photo-frame",
		name: "3D-Fotolicht",
		category: "Personalisieren",
		description: "Dein Foto als geschichtetes Lichtrelief.",
		prompt: "Convert the reference into a refined layered lithophane-style photo light panel inside a stable minimal frame, with simplified tonal depth, flat rear illumination cavity and robust rounded borders",
		mode: "image",
		complexity: 1.15,
		image: "/creations/photo-frame.webp",
		examples: [
			"Porträt mit weichem Licht",
			"Bergpanorama im Rahmen",
			"Haustier als Lichtrelief"
		],
		inputHint: "Ein kontrastreiches Foto im Hoch- oder Querformat",
		printRule: "Nur für Niedervolt-LED; Reliefdicke und Lichtabstand werden vor Fertigung geprüft.",
		defaultHeight: 18,
		minHeight: 10,
		maxHeight: 35,
		badge: "Foto"
	}
];
var creativeTemplates = new Set([
	"chibi",
	"vinyl",
	"brick",
	"keychain",
	"magnet",
	"keycap"
]);
function isCreativeTemplate(value) {
	return creativeTemplates.has(value);
}
var styles = {
	Japandi: "calm Japandi aesthetic with soft natural transitions and restrained detail",
	Organisch: "organic flowing sculptural language with harmonious volumes",
	Minimal: "precise minimalist form language with a clear silhouette and few strong details",
	Verspielt: "charming playful stylization, friendly, expressive and collectible",
	Geometrisch: "bold geometric design language with rhythmic surfaces and clean edges"
};
var surfaces = {
	"Feine Rillen": "fine evenly spaced vertical ribbing with softened peaks",
	Glatt: "smooth matte surface with clean uninterrupted volumes",
	Wellen: "subtle flowing wave relief integrated into the surface",
	Facettiert: "controlled geometric facets with softened printable edges"
};
var colorMoods = {
	"Warm Ivory": "warm ivory and sand",
	Terracotta: "muted terracotta and warm clay",
	Salbeigrün: "muted sage green",
	Graphit: "soft charcoal graphite"
};
var money = new Intl.NumberFormat("de-CH", {
	style: "currency",
	currency: "CHF"
});
var wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var formatElapsed = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
async function readJson(response) {
	const data = await response.json().catch(() => ({ error: "Unbekannte Serverantwort." }));
	if (!response.ok) throw new Error(data.error || "Die Anfrage konnte nicht verarbeitet werden.");
	return data;
}
function safeMeshyUrl(value) {
	if (!value) return void 0;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" || !(url.hostname === "meshy.ai" || url.hostname.endsWith(".meshy.ai"))) return void 0;
		return url.toString();
	} catch {
		return;
	}
}
function proxiedModelUrls(urls, taskId, taskType) {
	if (!urls || !taskId) return {};
	const file = (format) => `/api/meshy?taskId=${encodeURIComponent(taskId)}&type=${encodeURIComponent(taskType)}&format=${format}`;
	return {
		glb: urls.glb ? file("glb") : void 0,
		stl: urls.stl ? file("stl") : void 0,
		"3mf": urls["3mf"] ? file("3mf") : void 0
	};
}
function AIDesignStudio({ signedIn }) {
	const [category, setCategory] = (0, import_react.useState)("Alle");
	const [selectedTemplate, setSelectedTemplate] = (0, import_react.useState)(templates[0]);
	const [mode, setMode] = (0, import_react.useState)(templates[0].mode);
	const [customerWish, setCustomerWish] = (0, import_react.useState)("");
	const [imageDatas, setImageDatas] = (0, import_react.useState)([]);
	const [imageNames, setImageNames] = (0, import_react.useState)([]);
	const [interpretedPreview, setInterpretedPreview] = (0, import_react.useState)("");
	const [imageStrategy, setImageStrategy] = (0, import_react.useState)("accurate");
	const [generationMode, setGenerationMode] = (0, import_react.useState)("quality");
	const [style, setStyle] = (0, import_react.useState)("Japandi");
	const [surface, setSurface] = (0, import_react.useState)("Feine Rillen");
	const [colorMood, setColorMood] = (0, import_react.useState)("Warm Ivory");
	const [printReady, setPrintReady] = (0, import_react.useState)(true);
	const [state, setState] = (0, import_react.useState)("idle");
	const [progress, setProgress] = (0, import_react.useState)(0);
	const [statusText, setStatusText] = (0, import_react.useState)("Bereit für deine Idee");
	const [taskId, setTaskId] = (0, import_react.useState)("");
	const [modelTaskId, setModelTaskId] = (0, import_react.useState)("");
	const [modelTaskType, setModelTaskType] = (0, import_react.useState)("text");
	const [modelUrls, setModelUrls] = (0, import_react.useState)({});
	const [thumbnail, setThumbnail] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [tokenBalance, setTokenBalance] = (0, import_react.useState)(null);
	const [unlimited, setUnlimited] = (0, import_react.useState)(false);
	const [canDownload3d, setCanDownload3d] = (0, import_react.useState)(false);
	const [productionOrderId, setProductionOrderId] = (0, import_react.useState)("");
	const [orderBusy, setOrderBusy] = (0, import_react.useState)(false);
	const [orderMessage, setOrderMessage] = (0, import_react.useState)("");
	const [heightCm, setHeightCm] = (0, import_react.useState)(templates[0].defaultHeight);
	const [scaledHeight, setScaledHeight] = (0, import_react.useState)(null);
	const [printability, setPrintability] = (0, import_react.useState)(null);
	const [printFilesReady, setPrintFilesReady] = (0, import_react.useState)(false);
	const [printRepaired, setPrintRepaired] = (0, import_react.useState)(false);
	const [material, setMaterial] = (0, import_react.useState)("PLA");
	const [finish, setFinish] = (0, import_react.useState)("Roh");
	const [quantity, setQuantity] = (0, import_react.useState)(1);
	const [autoRotate, setAutoRotate] = (0, import_react.useState)(true);
	const [startedAt, setStartedAt] = (0, import_react.useState)(0);
	const [elapsedSeconds, setElapsedSeconds] = (0, import_react.useState)(0);
	const [designPlan, setDesignPlan] = (0, import_react.useState)(null);
	const [plannerAnswers, setPlannerAnswers] = (0, import_react.useState)({});
	const [plannerStep, setPlannerStep] = (0, import_react.useState)(0);
	const [plannerBusy, setPlannerBusy] = (0, import_react.useState)(false);
	const [plannerError, setPlannerError] = (0, import_react.useState)("");
	const [plannerApproved, setPlannerApproved] = (0, import_react.useState)(false);
	const fileRef = (0, import_react.useRef)(null);
	const workspaceRef = (0, import_react.useRef)(null);
	const generationRef = (0, import_react.useRef)(0);
	const busy = [
		"uploading",
		"transforming",
		"generating",
		"refining",
		"resizing",
		"analyzing",
		"repairing",
		"converting"
	].includes(state);
	const creativeImage = mode === "image" && imageStrategy === "creative";
	const textured = generationMode === "quality";
	const imageData = imageDatas[0] || "";
	const imagePreview = interpretedPreview || imageData;
	const freeTemplate = templates[0];
	const specificTemplates = templates.filter((item) => !item.featured);
	const shownTemplates = category === "Alle" ? specificTemplates : specificTemplates.filter((item) => item.category === category);
	const plannerQuestions = (designPlan?.questions || []).filter((question) => !(selectedTemplate.id === "lamp" && question.id === "lamp_module" && plannerAnswers.lamp_use === "decor"));
	const finalPrompt = (0, import_react.useMemo)(() => [
		mode === "text" && designPlan?.complete ? designPlan.technicalBrief : selectedTemplate.prompt,
		styles[style],
		surfaces[surface],
		`Material and color direction: ${colorMoods[colorMood]}.`,
		customerWish.trim() ? `Customer request: ${customerWish.trim().slice(0, 120)}.` : "",
		printReady ? `Manufacturing constraint: ${selectedTemplate.printRule} Watertight manufacturable parts, stable flat base, minimum practical wall thickness, no floating parts, no paper-thin or fragile details.` : "",
		mode === "text" ? "Complete product assembly, centered, no scene, no text, no logo." : "Single complete object, centered, no scene, no text, no logo."
	].filter(Boolean).join(". ").slice(0, 1200), [
		colorMood,
		customerWish,
		designPlan,
		mode,
		printReady,
		selectedTemplate,
		style,
		surface
	]);
	const estimate = (0, import_react.useMemo)(() => {
		const scale = Math.pow(heightCm / 20, 2.25);
		const materialFactor = material === "PETG" ? 1.16 : 1;
		const finishing = finish === "Premium" ? 24 + heightCm * .65 : 0;
		const unit = Math.max(24, 14 + 24 * scale * selectedTemplate.complexity * materialFactor + finishing);
		const discount = quantity >= 5 ? .86 : quantity >= 3 ? .92 : 1;
		return Math.ceil(unit * quantity * discount / 5) * 5;
	}, [
		finish,
		heightCm,
		material,
		quantity,
		selectedTemplate
	]);
	(0, import_react.useEffect)(() => {
		import("./model-viewer-CQdaqkrf.js");
	}, []);
	(0, import_react.useEffect)(() => {
		if (!signedIn) return;
		fetch("/api/account", { cache: "no-store" }).then((response) => response.json()).then((data) => {
			if (typeof data.account?.tokenBalance === "number") setTokenBalance(data.account.tokenBalance);
			setUnlimited(Boolean(data.account?.unlimited));
			setCanDownload3d(Boolean(data.account?.capabilities?.canDownload3d));
		}).catch(() => void 0);
	}, [signedIn]);
	(0, import_react.useEffect)(() => () => {
		generationRef.current += 1;
	}, []);
	(0, import_react.useEffect)(() => {
		if (!busy || !startedAt) return;
		const updateElapsed = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1e3)));
		updateElapsed();
		const timer = window.setInterval(updateElapsed, 1e3);
		return () => window.clearInterval(timer);
	}, [busy, startedAt]);
	const resetResult = () => {
		generationRef.current += 1;
		setState("idle");
		setProgress(0);
		setStatusText("Bereit für deine Idee");
		setTaskId("");
		setModelTaskId("");
		setModelTaskType("text");
		setModelUrls({});
		setThumbnail("");
		setScaledHeight(null);
		setPrintability(null);
		setPrintFilesReady(false);
		setPrintRepaired(false);
		setStartedAt(0);
		setElapsedSeconds(0);
		setError("");
		setProductionOrderId("");
		setOrderMessage("");
	};
	const resetPlanner = () => {
		setDesignPlan(null);
		setPlannerAnswers({});
		setPlannerStep(0);
		setPlannerBusy(false);
		setPlannerError("");
		setPlannerApproved(false);
	};
	const requestDesignPlan = async (answers) => {
		setPlannerBusy(true);
		setPlannerError("");
		try {
			const data = await readJson(await fetch("/api/design-agent", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					templateId: selectedTemplate.id,
					idea: customerWish,
					answers
				})
			}));
			setDesignPlan(data.plan);
			setPlannerAnswers(data.plan.answers);
			setPlannerApproved(false);
			return data.plan;
		} catch (caught) {
			setPlannerError(caught instanceof Error ? caught.message : "Der Produktplan konnte nicht erstellt werden.");
			return null;
		} finally {
			setPlannerBusy(false);
		}
	};
	const startDesignPlanner = async () => {
		if (customerWish.trim().length < 6) {
			setPlannerError("Beschreibe deine Idee zuerst in einem kurzen Satz.");
			return;
		}
		setPlannerStep(0);
		setPlannerAnswers({});
		await requestDesignPlan({});
	};
	const advanceDesignPlanner = async () => {
		const currentQuestionId = plannerQuestions[plannerStep]?.id;
		const plan = await requestDesignPlan(plannerAnswers);
		if (!plan) return;
		if (plan.complete) {
			setPlannerStep(plan.questions.length);
			return;
		}
		const answeredIndex = plan.questions.findIndex((question) => question.id === currentQuestionId);
		setPlannerStep(Math.min(Math.max(0, answeredIndex + 1), Math.max(0, plan.questions.length - 1)));
	};
	const updateCustomerIdea = (value) => {
		setCustomerWish(value.slice(0, 240));
		resetPlanner();
		resetResult();
	};
	const stopWatching = () => {
		generationRef.current += 1;
		setState("idle");
		setProgress(0);
		setStartedAt(0);
		setStatusText("Überwachung gestoppt – du kannst einen neuen Auftrag starten");
		setError("");
	};
	const chooseTemplate = (template) => {
		setSelectedTemplate(template);
		setMode(template.mode);
		setGenerationMode(template.mode === "image" ? "quality" : "fast");
		setImageStrategy("accurate");
		setInterpretedPreview("");
		setHeightCm(template.defaultHeight);
		setCustomerWish("");
		resetPlanner();
		resetResult();
		workspaceRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start"
		});
	};
	const switchMode = (next) => {
		setMode(next);
		resetPlanner();
		resetResult();
	};
	const handleImages = async (selection) => {
		const files = Array.from(selection).slice(0, 4);
		if (!files.length) return;
		setError("");
		if (files.some((file) => !["image/jpeg", "image/png"].includes(file.type))) {
			setError("Bitte verwende nur JPG- oder PNG-Dateien.");
			return;
		}
		if (files.some((file) => file.size > 8 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 22 * 1024 * 1024) {
			setError("Ein Bild darf maximal 8 MB gross sein, alle Bilder zusammen maximal 22 MB.");
			return;
		}
		try {
			const values = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(/* @__PURE__ */ new Error("Bild konnte nicht gelesen werden."));
				reader.readAsDataURL(file);
			})));
			setImageDatas(values);
			setImageNames(files.map((file) => file.name));
			setInterpretedPreview("");
			if (values.length > 1) setImageStrategy("accurate");
			resetResult();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Die Bilder konnten nicht gelesen werden.");
		}
	};
	const pollTask = async (id, taskType, runId) => {
		for (let attempt = 0; attempt < 144; attempt += 1) {
			if (generationRef.current !== runId) throw new Error("Generierung abgebrochen.");
			const task = await readJson(await fetch(`/api/meshy?taskId=${encodeURIComponent(id)}&type=${taskType}`, { cache: "no-store" }));
			if (typeof task.tokenBalance === "number") setTokenBalance(task.tokenBalance);
			setProgress(Math.max(2, Math.min(100, Number(task.progress || 0))));
			if (task.status === "SUCCEEDED") return task;
			if (task.status === "FAILED" || task.status === "CANCELED") throw new Error("Die AB3D Design Engine konnte diesen Arbeitsschritt nicht abschliessen. Bitte prüfe deine Eingabe und starte erneut.");
			setStatusText(task.status === "PENDING" ? "Auftrag wartet auf einen freien KI-Platz …" : {
				text: "3D-Geometrie wird aufgebaut …",
				image: "Das interpretierte Motiv wird dreidimensional …",
				"multi-image": "Mehrere Ansichten werden zu präziser 3D-Geometrie verbunden …",
				"image-transform": "Das Foto wird als neues Design interpretiert …",
				"creative-chibi-prototype": "Die Chibi-Vorschau wird gestaltet …",
				"creative-vinyl-prototype": "Die Vinyl-Vorschau wird gestaltet …",
				"creative-brick-prototype": "Die Figuren-Vorschau wird gestaltet …",
				"creative-keychain-prototype": "Das Schlüsselanhänger-Relief wird entworfen …",
				"creative-magnet-prototype": "Das Magnet-Relief wird entworfen …",
				"creative-keycap-prototype": "Die Keycap-Vorschau wird gestaltet …",
				resize: "Das Modell wird auf reale Abmessungen skaliert …",
				"print-analyze": "Wasserdichtheit und Geometrie werden geprüft …",
				"print-repair": "Fehlerhafte Druckgeometrie wird repariert …",
				convert: "STL- und 3MF-Dateien werden erstellt …"
			}[taskType] || "Das finale 3D-Modell wird aufgebaut …");
			await wait(5e3);
		}
		throw new Error("Die Generierung dauert ungewöhnlich lange. Bitte versuche es später erneut.");
	};
	const generate = async () => {
		if (!signedIn) {
			window.location.href = "/signin-with-chatgpt?return_to=%2F%23studio";
			return;
		}
		if (mode === "image" && !imageData) {
			setError("Lade zuerst ein JPG- oder PNG-Bild hoch.");
			return;
		}
		if (mode === "text" && (!designPlan?.complete || !plannerApproved)) {
			setError("Schliesse zuerst den Produktplaner ab und bestätige den technischen Aufbau.");
			return;
		}
		const requiredTokens = mode === "text" ? textured ? 2 : 1 : creativeImage ? 3 : generationMode === "quality" ? 2 : 1;
		if (!unlimited && tokenBalance !== null && tokenBalance < requiredTokens) {
			setError(`Für diesen Ablauf brauchst du ${requiredTokens} Tokens. Dein aktuelles Guthaben reicht dafür nicht aus.`);
			return;
		}
		try {
			await readJson(await fetch("/api/meshy?health=1", { cache: "no-store" }));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Die AB3D Design Engine ist momentan nicht erreichbar.");
			return;
		}
		const runId = generationRef.current + 1;
		generationRef.current = runId;
		setState(mode === "image" ? "uploading" : "generating");
		setProgress(2);
		setStartedAt(Date.now());
		setElapsedSeconds(0);
		setError("");
		setModelUrls({});
		setThumbnail("");
		setScaledHeight(null);
		try {
			let completed;
			let finalTaskId;
			let finalTaskType;
			if (mode === "image" && creativeImage && imageDatas.length === 1 && isCreativeTemplate(selectedTemplate.id)) {
				setState("transforming");
				setStatusText(`${selectedTemplate.name} wird mit dem spezialisierten Meshy-Ablauf entworfen …`);
				const prototypeType = `creative-${selectedTemplate.id}-prototype`;
				const prototype = await readJson(await fetch("/api/meshy", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						action: "creative-prototype",
						templateId: selectedTemplate.id,
						imageData
					})
				}));
				if (typeof prototype.tokenBalance === "number") setTokenBalance(prototype.tokenBalance);
				setTaskId(prototype.taskId);
				const prototypeResult = await pollTask(prototype.taskId, prototypeType, runId);
				const conceptImage = safeMeshyUrl(prototypeResult.image_urls?.[0]);
				if (conceptImage) setInterpretedPreview(conceptImage);
				setState("generating");
				setProgress(5);
				setStatusText("Bestätigter Entwurf wird als spezialisiertes 3D-Modell aufgebaut …");
				const buildType = `creative-${selectedTemplate.id}-build`;
				const built = await readJson(await fetch("/api/meshy", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						action: "creative-build",
						templateId: selectedTemplate.id,
						prototypeTaskId: prototype.taskId,
						candidateId: prototypeResult.candidate_ids?.[0]
					})
				}));
				if (typeof built.tokenBalance === "number") setTokenBalance(built.tokenBalance);
				setTaskId(built.taskId);
				completed = await pollTask(built.taskId, buildType, runId);
				finalTaskId = built.taskId;
				finalTaskType = buildType;
			} else {
				let inputTaskId;
				if (mode === "image" && creativeImage) {
					setState("transforming");
					setStatusText("Das Motiv wird kreativ als konsistente Mehransicht vorbereitet …");
					const transformation = [
						"Create a clean product reference for high-quality multi-view 3D reconstruction.",
						selectedTemplate.prompt,
						styles[style],
						surfaces[surface],
						`Use ${colorMoods[colorMood]} as the material and color direction.`,
						"Create one complete centered object with a clean silhouette, neutral background, even lighting, no text and no extra objects.",
						printReady ? `Make the object cohesive and 3D-printable. Product rule: ${selectedTemplate.printRule}` : "",
						customerWish.trim() ? `Customer request: ${customerWish.trim().slice(0, 100)}.` : ""
					].filter(Boolean).join(" ");
					const transformed = await readJson(await fetch("/api/meshy", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							action: "transform-image",
							imageData,
							prompt: transformation.slice(0, 800)
						})
					}));
					if (typeof transformed.tokenBalance === "number") setTokenBalance(transformed.tokenBalance);
					setTaskId(transformed.taskId);
					const transformedTask = await pollTask(transformed.taskId, "image-transform", runId);
					inputTaskId = transformedTask.id;
					const interpretedImage = safeMeshyUrl(transformedTask.image_urls?.[0]);
					if (interpretedImage) setInterpretedPreview(interpretedImage);
				}
				setState("generating");
				setProgress(2);
				setStatusText(mode === "image" && imageDatas.length > 1 ? "Meshy 7 verbindet deine Ansichten zur präzisen 3D-Form …" : "AB3D baut die echte 3D-Geometrie …");
				const created = await readJson(await fetch("/api/meshy", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						action: "create",
						type: mode,
						prompt: finalPrompt,
						texturePrompt: finalPrompt,
						designPlan: mode === "text" ? {
							templateId: selectedTemplate.id,
							idea: customerWish,
							answers: plannerAnswers,
							planVersion: designPlan?.planVersion
						} : void 0,
						visualDirection: mode === "text" ? {
							style: styles[style],
							surface: surfaces[surface],
							colorMood: colorMoods[colorMood]
						} : void 0,
						imageDatas: mode === "image" && !inputTaskId ? imageDatas : void 0,
						inputTaskId,
						printReady,
						quality: generationMode,
						willRefine: mode === "text" && textured
					})
				}));
				if (typeof created.tokenBalance === "number") setTokenBalance(created.tokenBalance);
				setTaskId(created.taskId);
				const createdType = created.type || mode;
				completed = await pollTask(created.taskId, createdType, runId);
				finalTaskId = created.taskId;
				finalTaskType = createdType;
				if (mode === "text" && textured) {
					setState("refining");
					setProgress(5);
					setStatusText("Geometrie fertig – Material und Farbe werden erzeugt …");
					const refined = await readJson(await fetch("/api/meshy", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							action: "refine",
							previewTaskId: created.taskId,
							texturePrompt: finalPrompt
						})
					}));
					if (typeof refined.tokenBalance === "number") setTokenBalance(refined.tokenBalance);
					setTaskId(refined.taskId);
					finalTaskId = refined.taskId;
					finalTaskType = "text";
					completed = await pollTask(refined.taskId, "text", runId);
				}
			}
			if (generationRef.current !== runId) return;
			if (!completed.model_urls?.glb) throw new Error("Die Design Engine hat keine GLB-Datei geliefert. Bitte starte die Generierung erneut.");
			setModelTaskId(finalTaskId);
			setModelTaskType(finalTaskType);
			setModelUrls(proxiedModelUrls(completed.model_urls, finalTaskId, finalTaskType));
			setThumbnail(safeMeshyUrl(completed.thumbnail_url) || "");
			setProgress(100);
			setState("complete");
			setStatusText(generationMode === "fast" ? "Schnellvorschau fertig – jetzt Form prüfen" : "Dein finales 3D-Design ist fertig");
		} catch (caught) {
			if (generationRef.current !== runId) return;
			setState("error");
			setError(caught instanceof Error ? caught.message : "Die Generierung ist fehlgeschlagen.");
			setStatusText("Generierung nicht abgeschlossen");
		}
	};
	const preparePrintFiles = async () => {
		if (!modelTaskId) return;
		const runId = generationRef.current + 1;
		generationRef.current = runId;
		setState("resizing");
		setProgress(2);
		setError("");
		setPrintability(null);
		setPrintFilesReady(false);
		setPrintRepaired(false);
		setStatusText(`Reale Modellhöhe wird auf ${heightCm} cm gesetzt …`);
		try {
			const created = await readJson(await fetch("/api/meshy", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "resize",
					sourceTaskId: modelTaskId,
					sourceTaskType: modelTaskType,
					heightCm
				})
			}));
			if (typeof created.tokenBalance === "number") setTokenBalance(created.tokenBalance);
			setTaskId(created.taskId);
			const resized = await pollTask(created.taskId, "resize", runId);
			if (!resized.model_urls?.glb) throw new Error("Die Design Engine konnte das Modell nicht auf die Zielgrösse skalieren.");
			setModelUrls(proxiedModelUrls(resized.model_urls, created.taskId, "resize"));
			setModelTaskId(created.taskId);
			setModelTaskType("resize");
			setScaledHeight(heightCm);
			setState("analyzing");
			setProgress(15);
			setStatusText("AB3D prüft Wasserdichtheit und Geometrie …");
			const analyzed = await pollTask((await readJson(await fetch("/api/meshy", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "analyze",
					sourceTaskId: created.taskId,
					sourceTaskType: "resize"
				})
			}))).taskId, "print-analyze", runId);
			if (!analyzed.printability) throw new Error("Die Design Engine hat keinen Druckbarkeitsbericht geliefert.");
			setPrintability(analyzed.printability);
			let productionSourceId = created.taskId;
			let productionSourceType = "resize";
			if (analyzed.printability.status !== "healthy") {
				setState("repairing");
				setProgress(35);
				setStatusText("AB3D repariert Löcher und fehlerhafte Kanten …");
				const repairCreated = await readJson(await fetch("/api/meshy", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						action: "repair",
						sourceTaskId: productionSourceId,
						sourceTaskType: productionSourceType
					})
				}));
				if (typeof repairCreated.tokenBalance === "number") setTokenBalance(repairCreated.tokenBalance);
				if (!(await pollTask(repairCreated.taskId, "print-repair", runId)).model_urls?.glb) throw new Error("Die Druckreparatur hat keine Modelldatei geliefert.");
				productionSourceId = repairCreated.taskId;
				productionSourceType = "print-repair";
				setPrintRepaired(true);
			}
			setState("converting");
			setProgress(70);
			setStatusText("Exakte STL- und 3MF-Druckdateien werden erstellt …");
			const convertCreated = await readJson(await fetch("/api/meshy", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "convert",
					sourceTaskId: productionSourceId,
					sourceTaskType: productionSourceType
				})
			}));
			if (typeof convertCreated.tokenBalance === "number") setTokenBalance(convertCreated.tokenBalance);
			setTaskId(convertCreated.taskId);
			const printUrls = proxiedModelUrls((await pollTask(convertCreated.taskId, "convert", runId)).model_urls, convertCreated.taskId, "convert");
			if (!printUrls.stl || !printUrls["3mf"]) throw new Error("STL oder 3MF konnte nicht erstellt werden.");
			setModelUrls((current) => ({
				...current,
				stl: printUrls.stl,
				"3mf": printUrls["3mf"]
			}));
			setPrintFilesReady(true);
			setProgress(100);
			setState("complete");
			setStatusText(`Druckpaket in ${heightCm} cm ist bereit`);
		} catch (caught) {
			setState("complete");
			setError(caught instanceof Error ? caught.message : "Das Druckpaket konnte nicht fertiggestellt werden.");
			setStatusText("3D-Modell bleibt verfügbar – Druckpaket nicht abgeschlossen");
		}
	};
	const createProductionOrder = async () => {
		if (!printFilesReady || !taskId || orderBusy) return;
		setOrderBusy(true);
		setError("");
		setOrderMessage("");
		try {
			const response = await fetch("/api/production-orders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sourceTaskId: taskId,
					templateName: selectedTemplate.name,
					heightCm,
					material,
					finish,
					quantity,
					estimatedTotal: estimate
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Der Fertigungsauftrag konnte nicht gespeichert werden.");
			setProductionOrderId(data.order.id);
			setOrderMessage(data.message);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Der Fertigungsauftrag konnte nicht gespeichert werden.");
		} finally {
			setOrderBusy(false);
		}
	};
	const tokenCost = mode === "text" ? textured ? 2 : 1 : creativeImage ? 3 : generationMode === "quality" ? 2 : 1;
	const processStages = mode === "text" ? textured ? [
		"Auftrag",
		"Geometrie",
		"Material",
		"Fertig"
	] : [
		"Auftrag",
		"Geometrie",
		"Fertig"
	] : creativeImage ? [
		"Upload",
		"Entwurf",
		"3D-Modell",
		"Fertig"
	] : [
		imageDatas.length > 1 ? "Ansichten" : "Foto",
		"Meshy 7",
		"Fertig"
	];
	const activeStage = state === "complete" ? processStages.length - 1 : state === "refining" ? 2 : state === "transforming" ? 1 : state === "generating" ? mode === "image" && creativeImage ? 2 : 1 : 0;
	const printPipeline = [
		"resizing",
		"analyzing",
		"repairing",
		"converting"
	].includes(state) || printFilesReady;
	const displayedStages = printPipeline ? [
		"Skalieren",
		"Prüfen",
		"Reparieren",
		"Export"
	] : processStages;
	const displayedActiveStage = printPipeline ? state === "resizing" ? 0 : state === "analyzing" ? 1 : state === "repairing" ? 2 : state === "converting" ? 3 : 4 : activeStage;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "ai-studio section",
		id: "studio",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ai-studio-heading",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "AB3D AI Design Studio"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { children: [
					"Deine Idee wird",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "dreidimensional." })
				] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Wähle dein Produkt und starte mit einem Foto oder einer kurzen Idee. Unsere Design Engine übersetzt deine Auswahl in ein echtes 3D-Modell und führt dich bis zur drehbaren, druckgeprüften Datei." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "creation-browser",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "creation-browser-head",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "eyebrow",
								children: "Schritt 1 · Frei starten oder Vorlage wählen"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Was möchtest du gestalten?" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Schreibe jede beliebige Idee – die Produkte darunter sind nur praktische Abkürzungen." })
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [shownTemplates.length, " Vorlagen"] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: `free-idea-start ${selectedTemplate.id === freeTemplate.id ? "selected" : ""}`,
						onClick: () => chooseTemplate(freeTemplate),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "free-idea-symbol",
								children: "✦"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Freier Start" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Eigene Idee beschreiben" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "Vom Kopfhörerständer bis zur Mondlampe: Der Planer erkennt Zweck und Aufbau und fragt nur nach fehlenden Angaben." })
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: selectedTemplate.id === freeTemplate.id ? "Ausgewählt ✓" : "Idee eingeben →" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "creation-paths",
						"aria-label": "Optionale Vorlagen",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Foto-Vorlagen" }), " Figuren, Motive und persönliche Produkte"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Produkt-Vorlagen" }), " Schneller Start mit vorbereiteten Druckregeln"] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "creation-filters",
						children: [
							"Alle",
							"Figuren",
							"Personalisieren",
							"Wohnen & Licht",
							"Spiel & Hobby"
						].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: category === item ? "active" : "",
							onClick: () => setCategory(item),
							children: item
						}, item))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "creation-grid",
						children: shownTemplates.map((template) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: `creation-card ${selectedTemplate.id === template.id ? "selected" : ""}`,
							onClick: () => chooseTemplate(template),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "creation-art",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: template.image,
										alt: "",
										loading: "lazy"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: template.badge || (template.mode === "image" ? "Foto" : "Idee") }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: selectedTemplate.id === template.id ? "Ausgewählt" : "Gestalten" })
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "creation-card-copy",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: template.name }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: template.description }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("em", { children: [template.mode === "image" ? "Foto verwenden" : "Idee beschreiben", " →"] })
								]
							})]
						}, template.id))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ai-workspace",
				ref: workspaceRef,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ai-input-panel",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "selected-creation",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "selected-creation-image",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: selectedTemplate.image,
										alt: ""
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Dein Produkt" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: selectedTemplate.name }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: selectedTemplate.mode === "image" ? "Start mit Foto" : "Start mit Idee" })
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => document.querySelector(".creation-browser")?.scrollIntoView({ behavior: "smooth" }),
									children: "Ändern"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "product-guidance",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "1" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: selectedTemplate.inputHint }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: selectedTemplate.printRule })] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ai-mode-tabs",
							role: "tablist",
							"aria-label": "Eingabeart",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								role: "tab",
								"aria-selected": mode === "text",
								className: mode === "text" ? "active" : "",
								onClick: () => switchMode("text"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Aa" }), " Idee eingeben"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								role: "tab",
								"aria-selected": mode === "image",
								className: mode === "image" ? "active" : "",
								onClick: () => switchMode("image"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "▧" }), " Foto verwenden"]
							})]
						}),
						mode === "text" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "design-agent-flow",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "simple-idea-input",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											htmlFor: "customer-idea",
											children: "Was möchtest du gestalten?"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Schreibe es ganz normal. Der AB3D Produktplaner fragt danach nur die Punkte, die für Funktion und 3D-Druck wirklich fehlen." }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
											id: "customer-idea",
											value: customerWish,
											onChange: (event) => updateCustomerIdea(event.target.value),
											rows: 4,
											placeholder: `Zum Beispiel: ${selectedTemplate.examples[0]}`,
											disabled: busy || plannerBusy
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "wish-examples",
											children: selectedTemplate.examples.map((example) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => updateCustomerIdea(example),
												disabled: busy || plannerBusy,
												children: example
											}, example))
										}),
										!designPlan && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "planner-start",
											onClick: startDesignPlanner,
											disabled: busy || plannerBusy || customerWish.trim().length < 6,
											children: plannerBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "spinner" }), " Produkt wird analysiert …"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "✦" }), " Idee mit KI planen"] })
										})
									]
								}),
								designPlan && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "design-agent",
									"aria-live": "polite",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "agent-head",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "agent-mark",
													children: "AB"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "AB3D Produktplaner" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Funktion · Aufbau · 3D-Druck" })] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: designPlan.complete ? "Plan bereit" : `${Math.min(plannerStep + 1, plannerQuestions.length)} / ${plannerQuestions.length}` })
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "agent-customer-message",
											children: customerWish
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "agent-message",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: designPlan.intro }), (selectedTemplate.id === "lamp" || plannerAnswers.product_purpose === "light") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Elektronik wird niemals als Kunststoffteil mitgeneriert. Geplant werden nur Gehäuse, Lichtschale, Zugang und sichere Führung." })]
										}),
										!designPlan.complete && plannerQuestions[plannerStep] && (() => {
											const question = plannerQuestions[plannerStep];
											const selectedAnswer = plannerAnswers[question.id];
											const selectedOption = question.options.find((entry) => entry.value === selectedAnswer);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "agent-question-card",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "agent-question-title",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Frage ", plannerStep + 1] }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: question.title }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: question.hint })
														] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [
															plannerStep + 1,
															" / ",
															plannerQuestions.length
														] })]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "agent-options",
														role: "radiogroup",
														"aria-label": question.title,
														children: question.options.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
															type: "button",
															role: "radio",
															"aria-checked": selectedAnswer === entry.value,
															className: selectedAnswer === entry.value ? "selected" : "",
															onClick: () => setPlannerAnswers((current) => ({
																...current,
																[question.id]: entry.value
															})),
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: entry.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: entry.description })] })]
														}, entry.value))
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "agent-choice-confirmation",
														"aria-live": "polite",
														children: selectedOption ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Ausgewählt: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: selectedOption.label })] }) : "Wähle eine Antwort, um fortzufahren."
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "agent-nav",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => setPlannerStep((current) => Math.max(0, current - 1)),
															disabled: plannerStep === 0 || plannerBusy,
															children: "← Zurück"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															className: "agent-next",
															disabled: !selectedAnswer || plannerBusy,
															onClick: advanceDesignPlanner,
															children: plannerBusy ? "Antwort wird geprüft …" : selectedOption ? `${selectedOption.label} bestätigen →` : "Antwort wählen"
														})]
													})
												]
											});
										})(),
										designPlan.complete && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "agent-plan",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "agent-plan-title",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "✓" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Technischer Produktplan" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: designPlan.summary })] })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "agent-plan-grid",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Druckteile" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: designPlan.parts.map((part) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: part }, part)) })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Konstruktionsregeln" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: designPlan.specifications.map((spec) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: spec }, spec)) })] })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "agent-manufacturing-plan",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "manufacturing-head",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: designPlan.manufacturing.strategy === "multi-part" ? `${designPlan.manufacturing.printedParts.length} getrennte Druckteile` : designPlan.manufacturing.strategy === "print-in-place" ? "Print-in-Place-Aufbau" : "Einteiliger Aufbau" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Einfacher Fertigungsaufbau" })]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "manufacturing-columns",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
																className: "not-printed",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Nicht drucken · separat einsetzen" }), designPlan.manufacturing.sourcedComponents.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: designPlan.manufacturing.sourcedComponents.map((component) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: component }, component)) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Keine zusätzlichen Kaufteile erforderlich." })]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Passungen & Verbindungen" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: designPlan.manufacturing.interfaces.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: entry }, entry)) })] })]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
															className: "assembly-sequence",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Montage in dieser Reihenfolge" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", { children: designPlan.manufacturing.assemblySteps.map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: step }, step)) })]
														})
													]
												}),
												designPlan.safetyNotes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "agent-safety",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Vor der Fertigung prüfen" }), designPlan.safetyNotes.map((note) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: note }, note))]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													className: `approve-plan ${plannerApproved ? "approved" : ""}`,
													onClick: () => {
														setPlannerApproved(true);
														setError("");
													},
													disabled: plannerApproved,
													children: plannerApproved ? "✓ Produktplan übernommen" : "Diesen Aufbau verwenden"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													className: "restart-plan",
													onClick: startDesignPlanner,
													disabled: plannerBusy,
													children: "Antworten ändern"
												})
											]
										})
									]
								}),
								plannerError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "planner-error",
									role: "alert",
									children: plannerError
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `upload-zone ${imagePreview ? "has-image" : ""}`,
								onClick: () => !busy && fileRef.current?.click(),
								onDragOver: (event) => event.preventDefault(),
								onDrop: (event) => {
									event.preventDefault();
									if (!busy) handleImages(event.dataTransfer.files);
								},
								role: "button",
								tabIndex: 0,
								onKeyDown: (event) => {
									if ((event.key === "Enter" || event.key === " ") && !busy) fileRef.current?.click();
								},
								"aria-label": "Bis zu vier Bilder für das 3D-Modell hochladen",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									ref: fileRef,
									type: "file",
									accept: "image/jpeg,image/png",
									multiple: true,
									onChange: (event) => {
										if (event.target.files) handleImages(event.target.files);
									},
									hidden: true
								}), imagePreview ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `upload-preview-grid views-${interpretedPreview ? 1 : imageDatas.length}`,
									children: interpretedPreview ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: interpretedPreview,
										alt: "KI-Entwurf für die 3D-Kreation"
									}) : imageDatas.map((preview, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: preview,
										alt: index === 0 ? "Frontansicht für das 3D-Modell" : `Zusätzliche Ansicht ${index + 1}`
									}, `${imageNames[index]}-${index}`))
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "upload-replace",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: interpretedPreview ? "KI-Entwurf" : imageDatas.length > 1 ? `${imageDatas.length} Ansichten gewählt` : imageNames[0] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Zum Ersetzen klicken" })]
								})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "upload-icon",
										children: "＋"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "1 bis 4 Bilder auswählen" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [selectedTemplate.inputHint, ". Das erste Bild ist die Frontansicht. Weitere Winkel verbessern Rückseite und Proportionen deutlich."] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "JPG oder PNG · je maximal 8 MB" })
								] })]
							}),
							imageData && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "image-strategy",
								role: "radiogroup",
								"aria-label": "Bildverarbeitung",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										role: "radio",
										"aria-checked": imageStrategy === "accurate",
										className: imageStrategy === "accurate" ? "active" : "",
										onClick: () => {
											setImageStrategy("accurate");
											setInterpretedPreview("");
											resetResult();
										},
										disabled: busy,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Originalgetreu" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: imageDatas.length > 1 ? "Meshy 7 verbindet alle Ansichten direkt" : "Foto direkt mit Meshy 7 in 3D umwandeln" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										role: "radio",
										"aria-checked": imageStrategy === "creative",
										className: imageStrategy === "creative" ? "active" : "",
										onClick: () => {
											setImageStrategy("creative");
											setGenerationMode("quality");
											setInterpretedPreview("");
											resetResult();
										},
										disabled: busy || imageDatas.length > 1,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Kreativ gestalten" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: isCreativeTemplate(selectedTemplate.id) ? `Spezialablauf für ${selectedTemplate.name}` : "Zuerst konsistente Mehransicht gestalten" })]
									}),
									imageDatas.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Mehrere Ansichten werden immer originalgetreu verarbeitet. So entstehen die zuverlässigsten Proportionen." })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "simple-photo-wish",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Was soll daraus entstehen?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									value: customerWish,
									onChange: (event) => setCustomerWish(event.target.value.slice(0, 180)),
									rows: 3,
									placeholder: `Zum Beispiel: ${selectedTemplate.examples[0]}`,
									disabled: busy
								})]
							})
						] }),
						(mode === "image" && !(imageStrategy === "creative" && isCreativeTemplate(selectedTemplate.id)) || plannerApproved) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "simple-style-picker",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Wähle einen Stil" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("fieldset", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "visual-choice-grid style-choices",
								children: Object.keys(styles).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: style === item ? "active" : "",
									"aria-pressed": style === item,
									onClick: () => setStyle(item),
									disabled: busy,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: `style-swatch style-${item.toLowerCase()}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item })]
								}, item))
							}) })]
						}),
						(mode === "image" && !(imageStrategy === "creative" && isCreativeTemplate(selectedTemplate.id)) || plannerApproved) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
							className: "advanced-settings",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: ["Weitere Einstellungen ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "optional" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "Oberfläche" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "visual-choice-grid surface-choices",
									children: Object.keys(surfaces).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: surface === item ? "active" : "",
										"aria-pressed": surface === item,
										onClick: () => setSurface(item),
										disabled: busy,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: `surface-swatch surface-${item.toLowerCase().replace(" ", "-")}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item })]
									}, item))
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "Farbwelt" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "color-choice-grid",
									children: Object.keys(colorMoods).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: colorMood === item ? "active" : "",
										"aria-pressed": colorMood === item,
										onClick: () => setColorMood(item),
										disabled: busy,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: `color-dot color-${item.toLowerCase().replace(" ", "-")}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item })]
									}, item))
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "print-option",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: printReady,
										onChange: (event) => setPrintReady(event.target.checked),
										disabled: busy
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Für 3D-Druck optimieren" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Stabile Basis und robuste Geometrie" })] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "advanced-summary",
									children: [
										"Dein Designauftrag: ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: selectedTemplate.name }),
										", ",
										style,
										", ",
										surface,
										", ",
										colorMood,
										"."
									]
								})
							] })]
						}),
						(mode === "image" || plannerApproved) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "generation-mode-picker",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Wie möchtest du starten?" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: generationMode === "fast" ? "active" : "",
								onClick: () => setGenerationMode("fast"),
								disabled: busy || creativeImage,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Schnelle Vorschau" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: creativeImage ? "Im Kreativmodus nicht verfügbar" : "Form prüfen · etwa 1–3 Minuten" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: generationMode === "quality" ? "active" : "",
								onClick: () => setGenerationMode("quality"),
								disabled: busy,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Finales Modell" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Texturen und feine Details · etwa 3–8 Minuten" })]
							})] })]
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ai-error",
							role: "alert",
							children: error
						}),
						(mode === "image" || plannerApproved) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "generation-actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "generate-button",
								onClick: generate,
								disabled: busy,
								children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "spinner" }),
									" KI arbeitet · ",
									formatElapsed(elapsedSeconds)
								] }) : signedIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "✦" }),
									" ",
									generationMode === "fast" ? "Schnellvorschau erstellen" : "3D-Design in bester Qualität",
									unlimited ? " · Launch-Pass" : ` · ${tokenCost} Token`
								] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: "Anmelden & Design starten" })
							}), busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "stop-generation",
								onClick: stopWatching,
								children: "Überwachung stoppen"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "credit-note",
							children: signedIn ? unlimited ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Launch-Pass aktiv · unbegrenzte Generierungen" }) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								"Dein Guthaben: ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [tokenBalance ?? "–", " Design-Tokens"] }),
								" · Exakte Grössenskalierung: 1 Token"
							] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: "Neue Accounts erhalten Start-Tokens für die erste Kreation." })
						})] })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `ai-output-panel state-${state}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "viewer-topbar",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: busy ? "status-live" : "" }),
								" ",
								statusText
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [startedAt > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: formatElapsed(elapsedSeconds) }), taskId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["ID ", taskId.slice(0, 8)] })] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "model-stage",
							children: modelUrls.glb ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelViewer, {
								src: modelUrls.glb,
								poster: thumbnail,
								autoRotate,
								setAutoRotate
							}) : busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "generation-visual",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "scan-object",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "scan-line" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: state === "transforming" ? "Eigenständiges Design wird entwickelt" : state === "resizing" ? "Reale Abmessungen werden gesetzt" : "Form wird Schicht für Schicht aufgebaut" })
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "empty-viewer",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "wire-vase",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Dein echtes 3D-Modell erscheint hier" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Mit der Maus drehen · Scrollen zum Zoomen" })
								]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "progress-area",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: statusText }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [Math.round(progress), "%"] })] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "process-stages",
									children: displayedStages.map((stage, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: index < displayedActiveStage ? "done" : index === displayedActiveStage ? "active" : "",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: index < displayedActiveStage ? "✓" : index + 1 }), stage]
									}, stage))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "progress-track",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${progress}%` } })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
									className: "progress-note",
									children: printPipeline ? "Die Druckprüfung kontrolliert Wasserdichtheit, Löcher und fehlerhafte Kanten. Die finale Freigabe erfolgt vor der Fertigung." : "Du kannst diesen Tab geöffnet lassen. AB3D baut zuerst die Geometrie und danach – falls gewählt – Material und Farbe."
								})
							]
						}),
						modelUrls.glb && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "production-config",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "size-config",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Zielhöhe ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [heightCm, " cm"] })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "range",
											min: selectedTemplate.minHeight,
											max: selectedTemplate.maxHeight,
											step: "1",
											value: heightCm,
											onChange: (event) => {
												setHeightCm(Number(event.target.value));
												setScaledHeight(null);
												setPrintFilesReady(false);
												setPrintability(null);
											},
											disabled: busy
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: printFilesReady && scaledHeight === heightCm ? "✓ GLB, STL und 3MF sind exakt skaliert und geprüft." : `Empfohlener Bereich für ${selectedTemplate.name}: ${selectedTemplate.minHeight}–${selectedTemplate.maxHeight} cm.` }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: preparePrintFiles,
											disabled: busy || printFilesReady && scaledHeight === heightCm,
											children: [busy && printPipeline ? "Druckpaket wird vorbereitet …" : `Druckpaket für ${heightCm} cm vorbereiten`, unlimited ? " · Launch-Pass" : " · 2–3 Token"]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "price-config",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Material", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: material,
											onChange: (event) => setMaterial(event.target.value),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "PLA" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "PETG" })]
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Finish", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: finish,
											onChange: (event) => setFinish(event.target.value),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Roh" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Premium" })]
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["Menge", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "number",
											min: "1",
											max: "20",
											value: quantity,
											onChange: (event) => setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "price-total",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Automatischer Richtpreis" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: money.format(estimate) }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "inkl. Fertigung · final nach Druckbarkeitsprüfung" })
											]
										})
									]
								}),
								printability && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `printability-report status-${printability.status}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: printFilesReady ? "✓" : "!" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: printFilesReady ? "Druckpaket bereit" : "Geometrie geprüft" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: printRepaired ? "Geometrie wurde automatisch repariert." : printability.status === "healthy" ? "Die Geometrie ist sauber und geschlossen." : "Auffälligkeiten werden im Druckpaket repariert." })] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Wasserdicht" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: printability.metrics.is_watertight ? "Ja" : "Nein" })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Löcher" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: printability.metrics.holes })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Nicht-manifold" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: printability.metrics.non_manifold_edges })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Fehlerflächen" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: printability.metrics.degenerate_faces })] })
									] })]
								})
							]
						}),
						state === "complete" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "result-actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								modelUrls.glb && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: modelUrls.glb,
									download: true,
									children: scaledHeight === heightCm ? `GLB · ${heightCm} cm` : "GLB herunterladen"
								}),
								printFilesReady && canDownload3d && modelUrls.stl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: modelUrls.stl,
									download: true,
									children: [
										"STL · ",
										heightCm,
										" cm"
									]
								}),
								printFilesReady && canDownload3d && modelUrls["3mf"] && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: modelUrls["3mf"],
									download: true,
									children: [
										"3MF · ",
										heightCm,
										" cm"
									]
								}),
								printFilesReady && !canDownload3d && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									href: "/konto#plaene",
									children: "STL selbst laden · Abo wählen"
								})
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "button light",
								type: "button",
								onClick: createProductionOrder,
								disabled: !printFilesReady || orderBusy || Boolean(productionOrderId),
								children: orderBusy ? "Auftrag wird gespeichert …" : productionOrderId ? `Gespeichert · ${productionOrderId}` : printFilesReady ? `Für ${money.format(estimate)} fertigen lassen` : "Zuerst Druckpaket vorbereiten"
							})]
						}), generationMode === "fast" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "quality-upgrade",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Gefällt dir die Grundform?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Erstelle jetzt Material, Farben und die druckbaren STL-/3MF-Dateien." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setGenerationMode("quality");
									workspaceRef.current?.scrollIntoView({
										behavior: "smooth",
										block: "start"
									});
								},
								children: "Beste Qualität vorbereiten"
							})]
						})] }),
						state === "complete" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "file-access-note",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "Physisch bestellen oder Datei besitzen?" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Bei einer Fertigung geht die geprüfte STL automatisch intern an AB3D. Nur für einen eigenen STL-/3MF-Download brauchst du das 3D-Studio- oder Complete-Abo." }),
								orderMessage && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", {
									role: "status",
									children: ["✓ ", orderMessage]
								})
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ai-steps",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "01" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "Vorlage" }),
						"Kategorie und Produktart wählen"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "02" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "KI-Design" }),
						"Motiv kreativ interpretieren"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "03" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "3D & Grösse" }),
						"Modell prüfen und exakt skalieren"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "04" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "Preis & Fertigung" }),
						"Richtpreis erhalten und anfragen"
					] })
				]
			})
		]
	});
}
//#endregion
//#region app/assistant-chat.tsx
var suggestions = [
	"Was kostet mein Design?",
	"Wie funktioniert Foto zu 3D?",
	"PLA oder PETG?",
	"Wie setze ich die Grösse?"
];
function AssistantChat({ signedIn }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [input, setInput] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [messages, setMessages] = (0, import_react.useState)([{
		role: "assistant",
		text: "Hoi! Ich bin der AB3D Design-Guide. Frag mich zu 3D-Modellen, Fotos, Tokens, Materialien, Grössen oder Preisen."
	}]);
	const ask = async (question) => {
		const value = question.trim();
		if (!value || busy) return;
		setMessages((current) => [...current, {
			role: "user",
			text: value
		}]);
		setInput("");
		setBusy(true);
		try {
			const data = await (await fetch("/api/assistant", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: value })
			})).json();
			setMessages((current) => [...current, {
				role: "assistant",
				text: data.answer || "Bitte versuche es nochmals."
			}]);
		} catch {
			setMessages((current) => [...current, {
				role: "assistant",
				text: "Ich bin kurz nicht erreichbar. Du kannst uns an hello@ab3d.ch schreiben."
			}]);
		} finally {
			setBusy(false);
		}
	};
	const submit = (event) => {
		event.preventDefault();
		ask(input);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `assistant-widget ${open ? "open" : ""}`,
		children: [open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "assistant-panel",
			"aria-label": "AB3D Design-Guide",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "AI" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "AB3D Design-Guide" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: signedIn ? "KI & Shopwissen" : "Shopwissen · KI nach Anmeldung" })] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setOpen(false),
					"aria-label": "Chat schliessen",
					children: "×"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "assistant-messages",
					children: [messages.map((message, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: message.role,
						children: message.text
					}, `${message.role}-${index}`)), busy && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "assistant typing",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
						]
					})]
				}),
				messages.length < 3 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "assistant-suggestions",
					children: suggestions.map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => void ask(suggestion),
						children: suggestion
					}, suggestion))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: submit,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: input,
						onChange: (event) => setInput(event.target.value.slice(0, 500)),
						placeholder: "Deine Frage …",
						"aria-label": "Frage an AB3D"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						disabled: busy || !input.trim(),
						"aria-label": "Frage senden",
						children: "↑"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
					className: "assistant-disclaimer",
					children: "KI kann sich irren · Verbindliche Angaben bestätigt AB3D."
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			className: "assistant-launcher",
			onClick: () => setOpen((value) => !value),
			"aria-label": open ? "Design-Guide schliessen" : "Design-Guide öffnen",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: open ? "×" : "✦" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: open ? "Schliessen" : "Fragen?" })]
		})]
	});
}
//#endregion
//#region app/products.ts
function productVariant(product, size, color) {
	return product.variants.find((variant) => variant.size === size && variant.color === color) || product.variants.find((variant) => variant.available) || product.variants[0] || null;
}
function productPrice(product, size, color) {
	return productVariant(product, size, color)?.price ?? product.price;
}
//#endregion
//#region app/shop-types.ts
var formatChf = new Intl.NumberFormat("de-CH", {
	style: "currency",
	currency: "CHF"
});
function defaultProductSelection(product) {
	const variant = product.variants.find((entry) => entry.available && entry.size === "M") || product.variants.find((entry) => entry.available) || product.variants[0];
	return {
		color: variant?.color || product.colors[0]?.name || "Standard",
		size: variant?.size || product.sizes[0] || "Standard"
	};
}
//#endregion
//#region app/shop-product-ui.tsx
function ProductPhoto({ product, color }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "product-photo-wrap",
		style: { "--selected-color": (product.colors.find((entry) => entry.name === color) || product.colors[0])?.value || "#d8d0c3" },
		children: [product.image && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			className: "product-photo",
			src: product.image,
			alt: product.imageAlt,
			width: "800",
			height: "800",
			loading: "lazy",
			decoding: "async"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "product-color-wash",
			"aria-hidden": "true"
		})]
	});
}
function ProductCollection({ categories, filter, products, selectionFor, onFilter, onSelect, onQuickView, onAdd }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "collection section",
		id: "kollektion",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "section-heading",
				"data-reveal": true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "Die Kollektion"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Formen, die bleiben." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Wähle Farbe und Grösse direkt am Objekt. Jedes Stück wird erst nach deiner Bestellung produziert." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "filters",
				role: "group",
				"aria-label": "Produkte filtern",
				children: categories.map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: filter === category ? "active" : "",
					"aria-pressed": filter === category,
					onClick: () => onFilter(category),
					children: category
				}, category))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "product-grid",
				children: [!products.length && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "catalog-empty",
					role: "status",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Kollektion wird synchronisiert" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Shopify liefert momentan keine veröffentlichten Produkte für diese Kollektion." })]
				}), products.map((product, index) => {
					const choice = selectionFor(product);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "product-card",
						"data-reveal": true,
						style: { "--delay": `${index % 4 * 70}ms` },
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `product-visual tone-${index % 4}`,
								onClick: () => onQuickView(product),
								"aria-label": `${product.name} ansehen`,
								children: [
									product.badge && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "badge",
										children: product.badge
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductPhoto, {
										product,
										color: choice.color
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "quick-label",
										children: "Details ansehen"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "product-info",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: product.category }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: product.name })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: ["ab ", formatChf.format(product.price)] })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "product-meta",
								children: product.description
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mini-swatches",
								"aria-label": `Farbe für ${product.name}`,
								children: product.colors.map((color) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: choice.color === color.name ? "active" : "",
									style: { background: color.value },
									onClick: () => onSelect(product, { color: color.name }),
									"aria-label": `${color.name} wählen`,
									"aria-pressed": choice.color === color.name
								}, color.name))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "add-button",
								onClick: () => onAdd(product),
								children: ["In den Warenkorb ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									children: "+"
								})]
							})
						]
					}, product.id);
				})]
			})
		]
	});
}
function QuickProductModal({ product, selection, onClose, onSelect, onAdd }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "quick-modal",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "quick-product-title",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "quick-close",
				onClick: onClose,
				"aria-label": "Schnellansicht schliessen",
				children: "×"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "quick-art",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductPhoto, {
					product,
					color: selection.color
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Produktansicht · Farbe direkt wählbar" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "quick-copy",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: product.category
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "quick-product-title",
						children: product.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: product.description }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "quick-detail",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Fertigung ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: product.leadTime })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Material ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "PLA · matt" })] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
						className: "product-choice-group",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "Farbe" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "color-options",
							children: product.colors.map((color) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: selection.color === color.name ? "active" : "",
								onClick: () => onSelect({ color: color.name }),
								"aria-pressed": selection.color === color.name,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
									style: { background: color.value },
									"aria-hidden": "true"
								}), color.name]
							}, color.name))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
						className: "product-choice-group",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "Grösse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "size-options",
							children: product.sizes.map((size) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: selection.size === size ? "active" : "",
								onClick: () => onSelect({ size }),
								"aria-pressed": selection.size === size,
								children: [size, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: size === "S" ? "kompakt" : size === "M" ? "standard" : size === "L" ? "gross" : "Variante" })]
							}, size))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "quick-buy",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: formatChf.format(productPrice(product, selection.size, selection.color)) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "button primary",
							onClick: onAdd,
							children: "In den Warenkorb"
						})]
					})
				]
			})
		]
	});
}
//#endregion
//#region app/shop-cart-drawer.tsx
function CartDrawer({ open, step, cart, products, subtotal, shipping, total, termsAccepted, checkoutBusy, checkoutError, selectionFor, onClose, onStep, onQuantity, onTerms, onCheckout }) {
	const cartProducts = products.filter((product) => cart[product.id]);
	const count = cartProducts.reduce((sum, product) => sum + cart[product.id], 0);
	const freeShippingProgress = Math.min(100, subtotal / 80 * 100);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: `cart-drawer ${open ? "open" : ""}`,
		"aria-hidden": !open,
		inert: !open,
		role: open ? "dialog" : void 0,
		"aria-modal": open || void 0,
		"aria-labelledby": "cart-title",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "cart-head",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: step === "checkout" ? "Sicher bezahlen" : "Deine Auswahl" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				id: "cart-title",
				children: step === "checkout" ? "Checkout" : "Warenkorb"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onClose,
				"aria-label": "Warenkorb schliessen",
				children: "×"
			})]
		}), step === "checkout" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "checkout-form",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "checkout-back",
					onClick: () => onStep("cart"),
					children: "← Zurück zum Warenkorb"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "checkout-trust",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "✓ Sicherer Shopify-Checkout" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "✓ Keine Kontopflicht bei AB3D" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "checkout-review",
					children: cartProducts.map((product) => {
						const choice = selectionFor(product);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							cart[product.id],
							"× ",
							product.name,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
								choice.size,
								" · ",
								choice.color
							] })
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: formatChf.format(productPrice(product, choice.size, choice.color) * cart[product.id]) })] }, product.id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "checkout-total",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Warenwert inkl. Versandrichtwert" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: formatChf.format(total) })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "legal-consent",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						required: true,
						checked: termsAccepted,
						onChange: (event) => onTerms(event.target.checked)
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
				checkoutError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ai-error",
					role: "alert",
					children: checkoutError
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "button primary full",
					onClick: onCheckout,
					disabled: checkoutBusy || !termsAccepted,
					children: checkoutBusy ? "Checkout wird vorbereitet …" : "Zahlung bei Shopify öffnen →"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", {
					className: "checkout-note",
					children: "Nur dieser Klick öffnet das geschützte Zahlungsfenster von Shopify. Adresse, definitive Versandkosten und Zahlungsmethode werden dort sicher erfasst; deine Produktauswahl bleibt mit AB3D verknüpft."
				})
			]
		}) : !count ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "empty-cart",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					"aria-hidden": "true",
					children: "◯"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Dein Warenkorb ist noch leer." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClose,
					children: "Kollektion ansehen"
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "shipping-progress",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: subtotal >= 80 ? "Kostenloser Versand freigeschaltet" : `Noch ${formatChf.format(80 - subtotal)} bis kostenloser Versand` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [freeShippingProgress.toFixed(0), "%"] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { width: `${freeShippingProgress}%` } }) })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "cart-items",
				children: cartProducts.map((product) => {
					const choice = selectionFor(product);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "cart-item",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "cart-thumb",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductPhoto, {
								product,
								color: choice.color
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: product.name }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
								choice.size,
								" · ",
								choice.color,
								" · ",
								formatChf.format(productPrice(product, choice.size, choice.color))
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "quantity",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => onQuantity(product.id, -1),
										"aria-label": `${product.name} Menge verringern`,
										children: "−"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: cart[product.id] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => onQuantity(product.id, 1),
										"aria-label": `${product.name} Menge erhöhen`,
										children: "+"
									})
								]
							})
						] })]
					}, product.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "cart-summary",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Zwischensumme ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: formatChf.format(subtotal) })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Versand ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: shipping ? formatChf.format(shipping) : "Kostenlos" })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: ["Richtwert ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: formatChf.format(total) })] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "button primary full",
				onClick: () => onStep("checkout"),
				children: "Sicher zum Checkout"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "cart-note",
				children: "Du bleibst bis zum Bezahlen bei AB3D. Adresse und Zahlung folgen sicher im Shopify-Checkout."
			})
		] })]
	});
}
//#endregion
//#region app/shop-sections.tsx
function ShopHero({ productCount }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "hero",
		id: "top",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "hero-copy",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow hero-kicker",
					children: "Designed in Zürich · Für dich gefertigt"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", { children: ["Objekte, die kein zweites Mal ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "genauso entstehen." })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "hero-lead",
					children: "Skulpturale Wohnobjekte und persönliche 3D-Kreationen – lokal, auf Bestellung und in deiner Wunschfarbe gefertigt."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "hero-actions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "button primary",
						href: "#kollektion",
						children: "Kollektion entdecken"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "button ghost",
						href: "#studio",
						children: "Eigenes Design erschaffen"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "trust-row",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "360°" }), " Produktvorschau"] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "100%" }), " erst nach Bestellung"] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: productCount }), " Shopify-Produkte"] })
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "hero-art hero-product-stage",
			"aria-label": "Interaktive dreidimensionale AB3D Produktvorschau",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "sun-disc",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "hero-model-wrap",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("model-viewer", {
						src: "/models/ab3d-ribbed-vase.glb",
						alt: "Gerippte terracottafarbene AB3D Japandi-Vase als frei drehbares 3D-Modell",
						"camera-controls": true,
						"touch-action": "pan-y",
						"camera-orbit": "28deg 72deg auto",
						"min-camera-orbit": "auto 25deg 68%",
						"max-camera-orbit": "auto 155deg 250%",
						"field-of-view": "27deg",
						"shadow-intensity": "1.35",
						"shadow-softness": ".75",
						exposure: "1.08",
						"tone-mapping": "aces",
						"environment-image": "neutral",
						"interaction-prompt": "auto",
						"interaction-prompt-style": "wiggle",
						loading: "eager",
						reveal: "auto"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hero-product-floor",
						"aria-hidden": "true"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "drag-hint",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
						"aria-hidden": "true",
						children: "360°"
					}), " Drehen & zoomen"]
				})
			]
		})]
	});
}
function CappatexTeaser() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "cappatex-home section",
		"data-reveal": true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "cappatex-home-copy",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "Neu · CAPPATEX by AB3D"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { children: [
					"Deine Idee.",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "Jetzt tragbar." })
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Erstelle mit wenigen Worten ein eigenes Motiv, platziere es direkt auf Kleidung oder Accessoires und bestelle dein Einzelstück on demand." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					className: "button light",
					href: "/cappatex",
					children: "CAPPATEX Studio öffnen →"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "cappatex-home-art",
			"aria-hidden": "true",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "AB" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("i", { children: [
					"DEINE",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					"IDEE"
				] })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "Prompt → Motiv → Produkt" })
			]
		})]
	});
}
function PlansSection({ signedIn }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "subscription-teaser section",
		id: "preise",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "section-heading",
				"data-reveal": true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "AB3D Creator Plans"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { children: [
					"Zwei Studios.",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					"Einfach gewählt."
				] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Nutze AB3D 3D und CAPPATEX getrennt oder gemeinsam. Bei physischen Bestellungen geht die Produktionsdatei intern an uns; ein eigener Dateidownload ist im passenden Abo enthalten." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "home-plan-grid",
				children: creatorPlans.map((plan) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: plan.popular ? "featured" : "",
					"data-reveal": true,
					children: [
						plan.popular && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "Beide Studios" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: plan.name }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { children: [plan.price, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: plan.cadence })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: plan.tokens }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: plan.audience }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							plan.features.join(" · ")
						] })
					]
				}, plan.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "home-token-guide",
				"data-reveal": true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Tokens pro Aktion" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: tokenRules.map(([tokens, use]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: tokens }), use] }, tokens)) })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				className: "button primary",
				href: signedIn ? "/konto" : "/signin-with-chatgpt?return_to=%2Fkonto",
				children: signedIn ? "Tokens & Abo verwalten" : "Kostenlos anmelden"
			})
		]
	});
}
var faqItems = [
	["Wie lange dauert die Fertigung?", "Die meisten Kollektionsteile benötigen 5–10 Werktage. Individuelle KI-Designs erhalten nach der Druckbarkeitsprüfung einen konkreten Termin."],
	["Sind die Objekte wasserdicht?", "Dekorative Vasen sind primär für Trockenblumen gedacht. Eine zusätzliche Versiegelung kann individuell angefragt werden."],
	["Kann ich Farbe und Grösse ändern?", "Ja. In der Kollektion stehen mehrere Farben und drei Grössen bereit. Im AI Studio kannst du die Modellhöhe exakt zwischen 5 und 80 cm festlegen."],
	["Wo bezahle ich meine Bestellung?", "Du gestaltest und wählst alles direkt hier bei AB3D. Erst beim Bezahlen öffnet sich der sichere Shopify-Checkout für Adresse, Versandart und Zahlungsmethode."]
];
function FaqSection() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "faq-section section",
		id: "faq",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			"data-reveal": true,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "Gut zu wissen"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { children: [
					"Fragen vor",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					"der Bestellung."
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Der Design-Guide unten rechts hilft dir ebenfalls sofort weiter." })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "faq-list",
			children: faqItems.map(([question, answer]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				"data-reveal": true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: question }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: answer })]
			}, question))
		})]
	});
}
var footerGroups = [
	{
		title: "3D Design",
		links: [
			["Kollektion", "/#kollektion"],
			["3D AI Studio", "/#studio"],
			["Creator Plans", "/#preise"]
		]
	},
	{
		title: "CAPPATEX",
		links: [["Print Studio", "/cappatex"], ["So funktioniert es", "/cappatex#ablauf"]]
	},
	{
		title: "Service & Recht",
		links: [
			["Kontakt", "mailto:hello@ab3d.ch"],
			["Rechtscenter", "/recht"],
			["Impressum", "/recht/impressum"],
			["Datenschutz", "/recht/datenschutz"],
			["AGB", "/recht/agb"],
			["Versand & Rückgabe", "/recht/versand-rueckgabe"]
		]
	}
];
function ShopFooter() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "footer-brand",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
				className: "brand",
				href: "#top",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "AB" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "3D" })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Schweizer 3D-Design für Räume mit Persönlichkeit." })]
		}),
		footerGroups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: group.title }), group.links.map(([label, href]) => href.startsWith("mailto:") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
			href,
			children: label
		}, href) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			href,
			children: label
		}, href))] }, group.title)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "© 2026 AB3D · Designed & made in Switzerland" })
	] });
}
//#endregion
//#region app/shop-experience.tsx
function ShopExperience({ user, products }) {
	const [filter, setFilter] = (0, import_react.useState)("Alle");
	const [cart, setCart] = (0, import_react.useState)({});
	const [selections, setSelections] = (0, import_react.useState)({});
	const [cartOpen, setCartOpen] = (0, import_react.useState)(false);
	const [cartStep, setCartStep] = (0, import_react.useState)("cart");
	const [quickProduct, setQuickProduct] = (0, import_react.useState)(null);
	const [checkoutError, setCheckoutError] = (0, import_react.useState)("");
	const [checkoutBusy, setCheckoutBusy] = (0, import_react.useState)(false);
	const [termsAccepted, setTermsAccepted] = (0, import_react.useState)(false);
	const progressRef = (0, import_react.useRef)(null);
	const categories = (0, import_react.useMemo)(() => ["Alle", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
	const shownProducts = filter === "Alle" ? products : products.filter((product) => product.category === filter);
	const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
	const subtotal = (0, import_react.useMemo)(() => products.reduce((sum, product) => {
		const selection = selections[product.id] || defaultProductSelection(product);
		return sum + productPrice(product, selection.size, selection.color) * (cart[product.id] || 0);
	}, 0), [
		cart,
		selections,
		products
	]);
	const shipping = subtotal >= 80 || subtotal === 0 ? 0 : 9;
	const total = subtotal + shipping;
	(0, import_react.useEffect)(() => {
		import("./model-viewer-CQdaqkrf.js");
		const elements = document.querySelectorAll("[data-reveal]");
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) if (entry.isIntersecting) {
				entry.target.classList.add("is-visible");
				observer.unobserve(entry.target);
			}
		}, {
			threshold: .12,
			rootMargin: "0px 0px -35px"
		});
		elements.forEach((element) => observer.observe(element));
		return () => observer.disconnect();
	}, [filter]);
	(0, import_react.useEffect)(() => {
		let frame = 0;
		const update = () => {
			const max = document.documentElement.scrollHeight - window.innerHeight;
			if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
		};
		const onScroll = () => {
			if (frame) return;
			frame = window.requestAnimationFrame(() => {
				update();
				frame = 0;
			});
		};
		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			if (frame) window.cancelAnimationFrame(frame);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		document.body.style.overflow = cartOpen || quickProduct ? "hidden" : "";
		const closeOnEscape = (event) => {
			if (event.key === "Escape") {
				setCartOpen(false);
				setQuickProduct(null);
			}
		};
		if (cartOpen || quickProduct) window.addEventListener("keydown", closeOnEscape);
		return () => {
			document.body.style.overflow = "";
			window.removeEventListener("keydown", closeOnEscape);
		};
	}, [cartOpen, quickProduct]);
	const selectionFor = (product) => selections[product.id] || defaultProductSelection(product);
	const updateSelection = (product, patch) => {
		setSelections((current) => ({
			...current,
			[product.id]: {
				...current[product.id] || defaultProductSelection(product),
				...patch
			}
		}));
	};
	const addToCart = (product) => {
		setSelections((current) => current[product.id] ? current : {
			...current,
			[product.id]: defaultProductSelection(product)
		});
		setCart((current) => ({
			...current,
			[product.id]: (current[product.id] || 0) + 1
		}));
		setQuickProduct(null);
		setCartStep("cart");
		setCartOpen(true);
	};
	const changeQuantity = (id, delta) => {
		setCart((current) => {
			const next = Math.max(0, (current[id] || 0) + delta);
			const updated = {
				...current,
				[id]: next
			};
			if (!next) delete updated[id];
			return updated;
		});
	};
	const setCheckoutStep = (step) => {
		if (step === "checkout") {
			setCheckoutError("");
			setTermsAccepted(false);
		}
		setCartStep(step);
	};
	const startShopifyCheckout = async () => {
		if (!termsAccepted || checkoutBusy) return;
		setCheckoutBusy(true);
		setCheckoutError("");
		try {
			const items = products.filter((product) => cart[product.id]).map((product) => {
				const selection = selectionFor(product);
				return {
					productHandle: product.handle,
					variantId: productVariant(product, selection.size, selection.color)?.id,
					quantity: cart[product.id]
				};
			});
			const response = await fetch("/api/shopify/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					items,
					termsAccepted
				})
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Der sichere Checkout konnte nicht vorbereitet werden.");
			const checkoutUrl = new URL(data.checkoutUrl);
			if (checkoutUrl.protocol !== "https:") throw new Error("Der sichere Checkout konnte nicht geöffnet werden.");
			window.location.assign(checkoutUrl.toString());
		} catch (error) {
			setCheckoutError(error instanceof Error ? error.message : "Der sichere Checkout konnte nicht vorbereitet werden.");
			setCheckoutBusy(false);
		}
	};
	const closeOverlays = () => {
		setCartOpen(false);
		setQuickProduct(null);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		id: "main-content",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "scroll-progress",
				ref: progressRef
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteHeader, {
				area: "objects",
				userName: user?.displayName,
				cartCount,
				onCartOpen: () => {
					setCartStep("cart");
					setCartOpen(true);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShopHero, { productCount: products.length }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductCollection, {
				categories,
				filter,
				products: shownProducts,
				selectionFor,
				onFilter: setFilter,
				onSelect: updateSelection,
				onQuickView: setQuickProduct,
				onAdd: addToCart
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AIDesignStudio, { signedIn: Boolean(user) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CappatexTeaser, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlansSection, { signedIn: Boolean(user) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FaqSection, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShopFooter, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartDrawer, {
				open: cartOpen,
				step: cartStep,
				cart,
				products,
				subtotal,
				shipping,
				total,
				termsAccepted,
				checkoutBusy,
				checkoutError,
				selectionFor,
				onClose: () => setCartOpen(false),
				onStep: setCheckoutStep,
				onQuantity: changeQuantity,
				onTerms: setTermsAccepted,
				onCheckout: startShopifyCheckout
			}),
			quickProduct && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuickProductModal, {
				product: quickProduct,
				selection: selectionFor(quickProduct),
				onClose: () => setQuickProduct(null),
				onSelect: (patch) => updateSelection(quickProduct, patch),
				onAdd: () => addToCart(quickProduct)
			}),
			(cartOpen || quickProduct) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "overlay",
				onClick: closeOverlays,
				"aria-label": "Dialog schliessen"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssistantChat, { signedIn: Boolean(user) })
		]
	});
}
//#endregion
export { ShopExperience as default };
