"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DesignPlan } from "./design-planner";
import ModelViewer from "./model-viewer";

type InputMode = "text" | "image";
type GenerationMode = "fast" | "quality";
type TaskType = InputMode | "image-transform" | "resize" | "convert" | "print-analyze" | "print-repair";
type ModelTaskType = Exclude<TaskType, "image-transform" | "print-analyze">;
type GenerationState = "idle" | "uploading" | "transforming" | "generating" | "refining" | "resizing" | "analyzing" | "repairing" | "converting" | "complete" | "error";
type ModelUrls = { glb?: string; stl?: string; "3mf"?: string; obj?: string; fbx?: string; usdz?: string };
type Printability = {
  status: "healthy" | "warning" | "error" | "unknown";
  issue_count: number;
  error_count: number;
  warning_count: number;
  metrics: { is_watertight: boolean; volume: number; non_manifold_edges: number; degenerate_faces: number; holes: number };
};
type MeshyTask = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress?: number;
  model_urls?: ModelUrls;
  image_urls?: string[];
  thumbnail_url?: string;
  task_error?: { message?: string };
  tokenBalance?: number;
  printability?: Printability | null;
};
type Template = {
  id: string;
  name: string;
  category: "Freier Start" | "Figuren" | "Personalisieren" | "Wohnen & Licht" | "Spiel & Hobby";
  description: string;
  prompt: string;
  mode: InputMode;
  complexity: number;
  image: string;
  examples: string[];
  inputHint: string;
  printRule: string;
  defaultHeight: number;
  minHeight: number;
  maxHeight: number;
  badge?: string;
  featured?: boolean;
};

const templates: Template[] = [
  { id: "free-design", name: "Eigene Idee", category: "Freier Start", description: "Beschreibe frei, was du bauen möchtest. Der Produktplaner erkennt die Funktion und stellt passende Rückfragen.", prompt: "A custom functional 3D-printable product based on the customer's freely described idea", mode: "text", complexity: 1.2, image: "/creation-templates.webp", examples: ["Ein Kopfhörerständer in Form eines Berges mit Kabelablage", "Eine Mondlampe auf einem organischen Holzast-Sockel", "Eine kleine Dose in Walform für Schmuck"], inputHint: "Schreibe deine Idee ganz normal – Produktkarten sind nur optionale Abkürzungen", printRule: "Aufbau, Teile, Wandstärken, Passungen und Nutzung werden vor der Generierung im Dialog geklärt.", defaultHeight: 20, minHeight: 5, maxHeight: 50, badge: "Frei", featured: true },
  { id: "chibi", name: "Chibi-Figur", category: "Figuren", description: "Dein Foto als freundliche Sammelfigur.", prompt: "Transform the person in the reference into an original charming chibi collectible with a recognisable face, enlarged head, simplified robust body and a joined round display base", mode: "image", complexity: 1.4, image: "/creations/chibi.webp", examples: ["Freundlicher Ausdruck", "Lieblingsoutfit übernehmen", "Mit rundem Namenssockel"], inputHint: "Ein klares Ganzkörperfoto einer Person", printRule: "Alle Körperteile verbunden, stabiler Sockel, keine dünnen Finger.", defaultHeight: 14, minHeight: 8, maxHeight: 28, badge: "Foto" },
  { id: "vinyl", name: "Vinyl-Figur", category: "Figuren", description: "Markante Sammlerfigur mit glatten Formen.", prompt: "Transform the person in the reference into an original premium vinyl-style collectible, recognisable hairstyle and outfit, clean simplified volumes, slightly oversized head and a stable integrated base", mode: "image", complexity: 1.45, image: "/creations/vinyl.webp", examples: ["Mit Sonnenbrille", "Eleganter Sammler-Look", "Outfit beibehalten"], inputHint: "Ein frontales Foto mit gut sichtbarem Gesicht", printRule: "Kompakte Volumen, verbundene Gliedmassen und sicherer Stand.", defaultHeight: 16, minHeight: 10, maxHeight: 32, badge: "Foto" },
  { id: "brick", name: "Brick-Figur", category: "Figuren", description: "Dein Look als originale Blockfigur.", prompt: "Create an original block-proportioned collectible inspired by the person in the reference, with recognisable face and clothing, simple non-branded toy geometry, connected limbs and a stable display base", mode: "image", complexity: 1.2, image: "/creations/brick.webp", examples: ["Als Abenteurer", "Mit Arbeitskleidung", "Lieblingsfarben nutzen"], inputHint: "Ein Ganzkörper- oder Porträtfoto einer Person", printRule: "Originale, markenfreie Form; kräftige Gelenke und flache Standfläche.", defaultHeight: 12, minHeight: 7, maxHeight: 24, badge: "Foto" },
  { id: "pet", name: "Haustier-Figur", category: "Figuren", description: "Dein Tier als ausdrucksstarke Miniatur.", prompt: "Transform the animal in the reference into a charming original collectible, preserve defining markings and expression, simplify fur into printable sculpted masses and join the pose to a stable oval base", mode: "image", complexity: 1.35, image: "/creations/pet.webp", examples: ["Fellzeichnung beibehalten", "Sitzende Pose", "Mit kleinem Namensschild"], inputHint: "Ein scharfes Foto, auf dem das Tier vollständig sichtbar ist", printRule: "Ohren, Schwanz und Beine werden robust mit Körper oder Sockel verbunden.", defaultHeight: 13, minHeight: 8, maxHeight: 26, badge: "Foto" },
  { id: "keychain", name: "3D-Schlüsselanhänger", category: "Personalisieren", description: "Dein Motiv als robustes Relief für unterwegs.", prompt: "Convert the main subject into a clean simplified bas-relief keychain medallion with a flat back, rounded safe edges, readable layered depth and a reinforced integrated 5 mm top loop", mode: "image", complexity: .75, image: "/creations/keychain.webp", examples: ["Haustier als Relief", "Porträt mit Initialen", "Bergmotiv in Schichten"], inputHint: "Ein kontrastreiches Foto mit einem klaren Hauptmotiv", printRule: "Flache Rückseite, Relief statt Vollfigur und verstärkte 5-mm-Öse.", defaultHeight: 6, minHeight: 4, maxHeight: 10, badge: "Foto" },
  { id: "magnet", name: "3D-Kühlschrankmagnet", category: "Personalisieren", description: "Foto oder Landschaft als plastisches Relief.", prompt: "Turn the reference into an artistic rectangular layered refrigerator magnet bas-relief, with a perfectly flat back, clear foreground and background depth separation, rounded frame and no fragile details", mode: "image", complexity: .7, image: "/creations/magnet.webp", examples: ["Berglandschaft als Relief", "Familienfoto vereinfachen", "Haustier im runden Rahmen"], inputHint: "Ein helles Foto mit klar erkennbarem Motiv", printRule: "Maximal 8 mm Relief, flache Magnetfläche und keine freistehenden Details.", defaultHeight: 7, minHeight: 5, maxHeight: 14, badge: "Foto" },
  { id: "lamp", name: "Skulpturale LED-Lampe", category: "Wohnen & Licht", description: "Deine Idee als sanft leuchtendes Objekt.", prompt: "A sculptural 3D-printable table lamp shade and coordinated stable base for a low-heat LED module, with rhythmic light openings, removable access and a reinforced cable route", mode: "text", complexity: 1.25, image: "/creations/lamp.webp", examples: ["Lampe in Katzenform", "Pilzform mit feinen Lamellen", "Organische Wellen mit warmem Licht"], inputHint: "Ein Satz zu Motiv, Form und gewünschter Lichtwirkung", printRule: "Nur für geprüfte Niedervolt-LED; Wandstärke, Kabelweg und Zugang werden vor Verkauf kontrolliert.", defaultHeight: 22, minHeight: 12, maxHeight: 45, badge: "Idee" },
  { id: "twist-egg", name: "Twist Egg", category: "Wohnen & Licht", description: "Drehbares Designobjekt mit zwei Teilen.", prompt: "An elegant two-part twist egg container with complementary spiral ribs, a broad stable lower half, rounded printable edges and generous assembly clearances", mode: "text", complexity: 1.1, image: "/creations/twist-egg.webp", examples: ["Feine spiralförmige Rillen", "Zwei kontrastierende Hälften", "Als kleine Schmuckdose"], inputHint: "Ein Satz zu Muster, Stil und Verwendungszweck", printRule: "Zweiteiliges Modell; Passung und 0,4–0,6 mm Spiel werden vor Fertigung geprüft.", defaultHeight: 11, minHeight: 7, maxHeight: 20, badge: "Idee" },
  { id: "planter", name: "Blumentopf", category: "Wohnen & Licht", description: "Individuelles Pflanzgefäss mit Untersetzer.", prompt: "A modern sculptural plant pot with a coordinated removable saucer, drainage opening, stable wide proportions, printable wall thickness and a clean original silhouette", mode: "text", complexity: 1.05, image: "/creations/planter.webp", examples: ["Walfisch mit Sukkulente", "Ruhige Japandi-Rillen", "Breite Form mit Untersetzer"], inputHint: "Ein Satz zu Motiv, Pflanze und gewünschtem Stil", printRule: "Geschlossene Wand, Ablaufloch, Untersetzer und breite kippsichere Basis.", defaultHeight: 16, minHeight: 9, maxHeight: 38, badge: "Idee" },
  { id: "keycap", name: "Individuelle Keycap", category: "Personalisieren", description: "Kleine 3D-Kunst für deine Tastatur.", prompt: "A compact original sculptural mechanical keyboard keycap with a robust low-profile decorative motif, clean underside and protected central cross-shaped mounting stem", mode: "image", complexity: .8, image: "/creations/keycap.webp", examples: ["Haustierkopf als Motiv", "Mini-Berglandschaft", "Japanische Wellen"], inputHint: "Ein klares Foto oder Motiv mit einfacher Silhouette", printRule: "MX-kompatible Passform ist Zielwert, wird aber vor Bestellung mit einem Testdruck validiert.", defaultHeight: 2, minHeight: 2, maxHeight: 4, badge: "Foto" },
  { id: "fold-fidget", name: "Einklapp-Fidget", category: "Spiel & Hobby", description: "Faltbares Print-in-Place-Spielobjekt.", prompt: "A satisfying foldable print-in-place fidget made from repeating original geometric segments, rounded hand-safe edges, captured hinges and generous functional joint clearances", mode: "text", complexity: 1.2, image: "/creations/fold-fidget.webp", examples: ["Sternförmige Segmente", "Ruhiges Klickgefühl", "Geometrische Endlosschleife"], inputHint: "Ein Satz zu Form, Bewegung und Muster", printRule: "Gelenkspiel 0,4–0,6 mm, keine Montage und abgerundete Kanten.", defaultHeight: 7, minHeight: 5, maxHeight: 14, badge: "Idee" },
  { id: "pixel-fidget", name: "Pixel-Fidget", category: "Spiel & Hobby", description: "Dein Pixelmotiv als beweglicher Anhänger.", prompt: "Convert the reference into an original pixel-art articulated fidget charm, using chunky readable cells, captured flexible joints, rounded edges and a reinforced attachment loop", mode: "image", complexity: 1, image: "/creations/pixel-fidget.webp", examples: ["Tier als Pixelmotiv", "8-Bit-Fantasiefigur", "Mit stabiler Anhängeröse"], inputHint: "Ein einfaches Motiv oder Pixelbild mit wenig Farben", printRule: "Große Pixelzellen, gefangene Gelenke und verstärkte Öse.", defaultHeight: 8, minHeight: 5, maxHeight: 14, badge: "Foto" },
  { id: "terrain", name: "Tabletop-Terrain", category: "Spiel & Hobby", description: "Modulares Gelände für deine Spielwelt.", prompt: "A modular rocky tabletop terrain tile with clear walkable levels, a perfectly flat underside, robust readable details, compatible straight edges and no unsupported fragile overhangs", mode: "text", complexity: 1.45, image: "/creations/terrain.webp", examples: ["Alpine Ruinenlandschaft", "Modulare Felsklippen", "Fantasy-Wald mit Wegen"], inputHint: "Ein Satz zu Welt, Geländeart und Spielfläche", printRule: "Flache Unterseite, definierte Modulränder und robuste Miniaturdetails.", defaultHeight: 6, minHeight: 3, maxHeight: 15, badge: "Idee" },
  { id: "photo-frame", name: "3D-Fotolicht", category: "Personalisieren", description: "Dein Foto als geschichtetes Lichtrelief.", prompt: "Convert the reference into a refined layered lithophane-style photo light panel inside a stable minimal frame, with simplified tonal depth, flat rear illumination cavity and robust rounded borders", mode: "image", complexity: 1.15, image: "/creations/photo-frame.webp", examples: ["Porträt mit weichem Licht", "Bergpanorama im Rahmen", "Haustier als Lichtrelief"], inputHint: "Ein kontrastreiches Foto im Hoch- oder Querformat", printRule: "Nur für Niedervolt-LED; Reliefdicke und Lichtabstand werden vor Fertigung geprüft.", defaultHeight: 18, minHeight: 10, maxHeight: 35, badge: "Foto" },
];

const styles = {
  Japandi: "calm Japandi aesthetic with soft natural transitions and restrained detail",
  Organisch: "organic flowing sculptural language with harmonious volumes",
  Minimal: "precise minimalist form language with a clear silhouette and few strong details",
  Verspielt: "charming playful stylization, friendly, expressive and collectible",
  Geometrisch: "bold geometric design language with rhythmic surfaces and clean edges",
};

const surfaces = {
  "Feine Rillen": "fine evenly spaced vertical ribbing with softened peaks",
  Glatt: "smooth matte surface with clean uninterrupted volumes",
  Wellen: "subtle flowing wave relief integrated into the surface",
  Facettiert: "controlled geometric facets with softened printable edges",
};

const colorMoods = {
  "Warm Ivory": "warm ivory and sand",
  Terracotta: "muted terracotta and warm clay",
  Salbeigrün: "muted sage green",
  Graphit: "soft charcoal graphite",
};

const money = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const formatElapsed = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({ error: "Unbekannte Serverantwort." }));
  if (!response.ok) throw new Error(data.error || "Die Anfrage konnte nicht verarbeitet werden.");
  return data;
}

function safeMeshyUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !(url.hostname === "meshy.ai" || url.hostname.endsWith(".meshy.ai"))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function proxiedModelUrls(urls: ModelUrls | undefined, taskId: string, taskType: ModelTaskType): ModelUrls {
  if (!urls || !taskId) return {};
  const file = (format: "glb" | "stl" | "3mf") => `/api/meshy?taskId=${encodeURIComponent(taskId)}&type=${encodeURIComponent(taskType)}&format=${format}`;
  return {
    glb: urls.glb ? file("glb") : undefined,
    stl: urls.stl ? file("stl") : undefined,
    "3mf": urls["3mf"] ? file("3mf") : undefined,
  };
}

export default function AIDesignStudio({ signedIn }: { signedIn: boolean }) {
  const [category, setCategory] = useState("Alle");
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [mode, setMode] = useState<InputMode>(templates[0].mode);
  const [customerWish, setCustomerWish] = useState("");
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [generationMode, setGenerationMode] = useState<GenerationMode>("quality");
  const [style, setStyle] = useState<keyof typeof styles>("Japandi");
  const [surface, setSurface] = useState<keyof typeof surfaces>("Feine Rillen");
  const [colorMood, setColorMood] = useState<keyof typeof colorMoods>("Warm Ivory");
  const [printReady, setPrintReady] = useState(true);
  const [state, setState] = useState<GenerationState>("idle");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Bereit für deine Idee");
  const [taskId, setTaskId] = useState("");
  const [modelTaskId, setModelTaskId] = useState("");
  const [modelTaskType, setModelTaskType] = useState<ModelTaskType>("text");
  const [modelUrls, setModelUrls] = useState<ModelUrls>({});
  const [thumbnail, setThumbnail] = useState("");
  const [error, setError] = useState("");
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [canDownload3d, setCanDownload3d] = useState(false);
  const [productionOrderId, setProductionOrderId] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const [heightCm, setHeightCm] = useState(templates[0].defaultHeight);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);
  const [printability, setPrintability] = useState<Printability | null>(null);
  const [printFilesReady, setPrintFilesReady] = useState(false);
  const [printRepaired, setPrintRepaired] = useState(false);
  const [material, setMaterial] = useState<"PLA" | "PETG">("PLA");
  const [finish, setFinish] = useState<"Roh" | "Premium">("Roh");
  const [quantity, setQuantity] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [designPlan, setDesignPlan] = useState<DesignPlan | null>(null);
  const [plannerAnswers, setPlannerAnswers] = useState<Record<string, string>>({});
  const [plannerStep, setPlannerStep] = useState(0);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [plannerError, setPlannerError] = useState("");
  const [plannerApproved, setPlannerApproved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);

  const busy = ["uploading", "transforming", "generating", "refining", "resizing", "analyzing", "repairing", "converting"].includes(state);
  const creativeImage = generationMode === "quality";
  const textured = generationMode === "quality";
  const freeTemplate = templates[0];
  const specificTemplates = templates.filter((item) => !item.featured);
  const shownTemplates = category === "Alle" ? specificTemplates : specificTemplates.filter((item) => item.category === category);
  const plannerQuestions = (designPlan?.questions || []).filter((question) => !(
    selectedTemplate.id === "lamp" && question.id === "lamp_module" && plannerAnswers.lamp_use === "decor"
  ));
  const finalPrompt = useMemo(() => [
    mode === "text" && designPlan?.complete ? designPlan.technicalBrief : selectedTemplate.prompt,
    styles[style],
    surfaces[surface],
    `Material and color direction: ${colorMoods[colorMood]}.`,
    customerWish.trim() ? `Customer request: ${customerWish.trim().slice(0, 120)}.` : "",
    printReady ? `Manufacturing constraint: ${selectedTemplate.printRule} Watertight manufacturable parts, stable flat base, minimum practical wall thickness, no floating parts, no paper-thin or fragile details.` : "",
    mode === "text" ? "Complete product assembly, centered, no scene, no text, no logo." : "Single complete object, centered, no scene, no text, no logo.",
  ].filter(Boolean).join(". ").slice(0, 1200), [colorMood, customerWish, designPlan, mode, printReady, selectedTemplate, style, surface]);
  const estimate = useMemo(() => {
    const scale = Math.pow(heightCm / 20, 2.25);
    const materialFactor = material === "PETG" ? 1.16 : 1;
    const finishing = finish === "Premium" ? 24 + heightCm * .65 : 0;
    const unit = Math.max(24, 14 + 24 * scale * selectedTemplate.complexity * materialFactor + finishing);
    const discount = quantity >= 5 ? .86 : quantity >= 3 ? .92 : 1;
    return Math.ceil(unit * quantity * discount / 5) * 5;
  }, [finish, heightCm, material, quantity, selectedTemplate]);

  useEffect(() => {
    import("@google/model-viewer");
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    fetch("/api/account", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (typeof data.account?.tokenBalance === "number") setTokenBalance(data.account.tokenBalance);
        setUnlimited(Boolean(data.account?.unlimited));
        setCanDownload3d(Boolean(data.account?.capabilities?.canDownload3d));
      })
      .catch(() => undefined);
  }, [signedIn]);

  useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  useEffect(() => {
    if (!busy || !startedAt) return;
    const updateElapsed = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
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

  const requestDesignPlan = async (answers: Record<string, string>) => {
    setPlannerBusy(true);
    setPlannerError("");
    try {
      const response = await fetch("/api/design-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplate.id, idea: customerWish, answers }),
      });
      const data = await readJson(response) as { plan: DesignPlan };
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

  const updateCustomerIdea = (value: string) => {
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

  const chooseTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setMode(template.mode);
    setGenerationMode(template.mode === "image" ? "quality" : "fast");
    setHeightCm(template.defaultHeight);
    setCustomerWish("");
    resetPlanner();
    resetResult();
    workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const switchMode = (next: InputMode) => {
    setMode(next);
    resetPlanner();
    resetResult();
  };

  const handleImage = (file?: File) => {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Bitte verwende eine JPG- oder PNG-Datei.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Das Bild darf maximal 8 MB gross sein.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setImageData(value);
      setImagePreview(value);
      setImageName(file.name);
      resetResult();
    };
    reader.readAsDataURL(file);
  };

  const pollTask = async (id: string, taskType: TaskType, runId: number): Promise<MeshyTask> => {
    for (let attempt = 0; attempt < 144; attempt += 1) {
      if (generationRef.current !== runId) throw new Error("Generierung abgebrochen.");
      const response = await fetch(`/api/meshy?taskId=${encodeURIComponent(id)}&type=${taskType}`, { cache: "no-store" });
      const task = (await readJson(response)) as MeshyTask;
      if (typeof task.tokenBalance === "number") setTokenBalance(task.tokenBalance);
      setProgress(Math.max(2, Math.min(100, Number(task.progress || 0))));
      if (task.status === "SUCCEEDED") return task;
      if (task.status === "FAILED" || task.status === "CANCELED") {
        throw new Error("Die AB3D Design Engine konnte diesen Arbeitsschritt nicht abschliessen. Bitte prüfe deine Eingabe und starte erneut.");
      }
      const labels: Record<TaskType, string> = {
        text: "3D-Geometrie wird aufgebaut …",
        image: "Das interpretierte Motiv wird dreidimensional …",
        "image-transform": "Das Foto wird als neues Design interpretiert …",
        resize: "Das Modell wird auf reale Abmessungen skaliert …",
        "print-analyze": "Wasserdichtheit und Geometrie werden geprüft …",
        "print-repair": "Fehlerhafte Druckgeometrie wird repariert …",
        convert: "STL- und 3MF-Dateien werden erstellt …",
      };
      setStatusText(task.status === "PENDING" ? "Auftrag wartet auf einen freien KI-Platz …" : labels[taskType]);
      await wait(5000);
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
    const requiredTokens = mode === "text" ? (textured ? 2 : 1) : (creativeImage ? 3 : 1);
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
      let inputTaskId: string | undefined;
      if (mode === "image" && creativeImage) {
        setState("transforming");
        setStatusText("Das Motiv wird kreativ neu interpretiert …");
        const transformation = [
          "Create a clean square product reference image for high-quality Image-to-3D reconstruction.",
          selectedTemplate.prompt,
          styles[style],
          surfaces[surface],
          `Use ${colorMoods[colorMood]} as the material and color direction.`,
          "Create an original design rather than a literal photo copy, while preserving only the defining features of the main subject.",
          "One complete centered object, front three-quarter view, plain neutral background, even lighting, no text, no extra objects.",
          printReady ? `The silhouette must work as one stable, cohesive 3D-printable object. Product rule: ${selectedTemplate.printRule}` : "",
          customerWish.trim() ? `Customer request: ${customerWish.trim().slice(0, 100)}.` : "",
        ].filter(Boolean).join(" ");
        const transformResponse = await fetch("/api/meshy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "transform-image", imageData, prompt: transformation.slice(0, 600) }),
        });
        const transformed = await readJson(transformResponse);
        if (typeof transformed.tokenBalance === "number") setTokenBalance(transformed.tokenBalance);
        setTaskId(transformed.taskId);
        const transformedTask = await pollTask(transformed.taskId, "image-transform", runId);
        inputTaskId = transformedTask.id;
        const interpretedImage = safeMeshyUrl(transformedTask.image_urls?.[0]);
        if (interpretedImage) setImagePreview(interpretedImage);
      }

      setState("generating");
      setProgress(2);
      setStatusText("AB3D baut die echte 3D-Geometrie …");
      const createResponse = await fetch("/api/meshy", {
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
            planVersion: designPlan?.planVersion,
          } : undefined,
          visualDirection: mode === "text" ? {
            style: styles[style],
            surface: surfaces[surface],
            colorMood: colorMoods[colorMood],
          } : undefined,
          imageData: mode === "image" && !inputTaskId ? imageData : undefined,
          inputTaskId,
          printReady,
          quality: generationMode,
          willRefine: mode === "text" && textured,
        }),
      });
      const created = await readJson(createResponse);
      if (typeof created.tokenBalance === "number") setTokenBalance(created.tokenBalance);
      setTaskId(created.taskId);
      let completed = await pollTask(created.taskId, mode, runId);
      let finalTaskId = created.taskId;

      if (mode === "text" && textured) {
        setState("refining");
        setProgress(5);
        setStatusText("Geometrie fertig – Material und Farbe werden erzeugt …");
        const refineResponse = await fetch("/api/meshy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "refine", previewTaskId: created.taskId, texturePrompt: finalPrompt }),
        });
        const refined = await readJson(refineResponse);
        if (typeof refined.tokenBalance === "number") setTokenBalance(refined.tokenBalance);
        setTaskId(refined.taskId);
        finalTaskId = refined.taskId;
        completed = await pollTask(refined.taskId, "text", runId);
      }

      if (generationRef.current !== runId) return;
      if (!completed.model_urls?.glb) throw new Error("Die Design Engine hat keine GLB-Datei geliefert. Bitte starte die Generierung erneut.");
      setModelTaskId(finalTaskId);
      setModelTaskType(mode);
      setModelUrls(proxiedModelUrls(completed.model_urls, finalTaskId, mode));
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
      const response = await fetch("/api/meshy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resize", sourceTaskId: modelTaskId, sourceTaskType: modelTaskType, heightCm }),
      });
      const created = await readJson(response);
      if (typeof created.tokenBalance === "number") setTokenBalance(created.tokenBalance);
      setTaskId(created.taskId);
      const resized = await pollTask(created.taskId, "resize", runId);
      if (!resized.model_urls?.glb) throw new Error("Die Design Engine konnte das Modell nicht auf die Zielgrösse skalieren.");
      const resizedUrls = proxiedModelUrls(resized.model_urls, created.taskId, "resize");
      setModelUrls(resizedUrls);
      setModelTaskId(created.taskId);
      setModelTaskType("resize");
      setScaledHeight(heightCm);

      setState("analyzing");
      setProgress(15);
      setStatusText("AB3D prüft Wasserdichtheit und Geometrie …");
      const analyzeResponse = await fetch("/api/meshy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", sourceTaskId: created.taskId, sourceTaskType: "resize" }),
      });
      const analyzeCreated = await readJson(analyzeResponse);
      const analyzed = await pollTask(analyzeCreated.taskId, "print-analyze", runId);
      if (!analyzed.printability) throw new Error("Die Design Engine hat keinen Druckbarkeitsbericht geliefert.");
      setPrintability(analyzed.printability);

      let productionSourceId = created.taskId as string;
      let productionSourceType: ModelTaskType = "resize";
      if (analyzed.printability.status !== "healthy") {
        setState("repairing");
        setProgress(35);
        setStatusText("AB3D repariert Löcher und fehlerhafte Kanten …");
        const repairResponse = await fetch("/api/meshy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "repair", sourceTaskId: productionSourceId, sourceTaskType: productionSourceType }),
        });
        const repairCreated = await readJson(repairResponse);
        if (typeof repairCreated.tokenBalance === "number") setTokenBalance(repairCreated.tokenBalance);
        const repaired = await pollTask(repairCreated.taskId, "print-repair", runId);
        if (!repaired.model_urls?.glb) throw new Error("Die Druckreparatur hat keine Modelldatei geliefert.");
        productionSourceId = repairCreated.taskId;
        productionSourceType = "print-repair";
        setPrintRepaired(true);
      }

      setState("converting");
      setProgress(70);
      setStatusText("Exakte STL- und 3MF-Druckdateien werden erstellt …");
      const convertResponse = await fetch("/api/meshy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert", sourceTaskId: productionSourceId, sourceTaskType: productionSourceType }),
      });
      const convertCreated = await readJson(convertResponse);
      if (typeof convertCreated.tokenBalance === "number") setTokenBalance(convertCreated.tokenBalance);
      setTaskId(convertCreated.taskId);
      const converted = await pollTask(convertCreated.taskId, "convert", runId);
      const printUrls = proxiedModelUrls(converted.model_urls, convertCreated.taskId, "convert");
      if (!printUrls.stl || !printUrls["3mf"]) throw new Error("STL oder 3MF konnte nicht erstellt werden.");
      setModelUrls((current) => ({ ...current, stl: printUrls.stl, "3mf": printUrls["3mf"] }));
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
          estimatedTotal: estimate,
        }),
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

  const tokenCost = mode === "text" ? (textured ? 2 : 1) : (creativeImage ? 3 : 1);
  const processStages = mode === "text"
    ? (textured ? ["Auftrag", "Geometrie", "Material", "Fertig"] : ["Auftrag", "Geometrie", "Fertig"])
    : (creativeImage ? ["Upload", "Interpretation", "3D-Modell", "Fertig"] : ["Upload", "3D-Modell", "Fertig"]);
  const activeStage = state === "complete"
    ? processStages.length - 1
    : state === "refining"
      ? 2
      : state === "transforming"
        ? 1
        : state === "generating"
          ? (mode === "image" && creativeImage ? 2 : 1)
          : 0;
  const printPipeline = ["resizing", "analyzing", "repairing", "converting"].includes(state) || printFilesReady;
  const displayedStages = printPipeline ? ["Skalieren", "Prüfen", "Reparieren", "Export"] : processStages;
  const displayedActiveStage = printPipeline
    ? state === "resizing" ? 0 : state === "analyzing" ? 1 : state === "repairing" ? 2 : state === "converting" ? 3 : 4
    : activeStage;
  return (
    <section className="ai-studio section" id="studio">
      <div className="ai-studio-heading">
        <div><p className="eyebrow">AB3D AI Design Studio</p><h2>Deine Idee wird<br /><em>dreidimensional.</em></h2></div>
        <p>Wähle dein Produkt und starte mit einem Foto oder einer kurzen Idee. Unsere Design Engine übersetzt deine Auswahl in ein echtes 3D-Modell und führt dich bis zur drehbaren, druckgeprüften Datei.</p>
      </div>

      <div className="creation-browser">
        <div className="creation-browser-head"><div><p className="eyebrow">Schritt 1 · Frei starten oder Vorlage wählen</p><h3>Was möchtest du gestalten?</h3><p>Schreibe jede beliebige Idee – die Produkte darunter sind nur praktische Abkürzungen.</p></div><span>{shownTemplates.length} Vorlagen</span></div>
        <button type="button" className={`free-idea-start ${selectedTemplate.id === freeTemplate.id ? "selected" : ""}`} onClick={() => chooseTemplate(freeTemplate)}>
          <span className="free-idea-symbol">✦</span>
          <span><small>Freier Start</small><strong>Eigene Idee beschreiben</strong><em>Vom Kopfhörerständer bis zur Mondlampe: Der Planer erkennt Zweck und Aufbau und fragt nur nach fehlenden Angaben.</em></span>
          <b>{selectedTemplate.id === freeTemplate.id ? "Ausgewählt ✓" : "Idee eingeben →"}</b>
        </button>
        <div className="creation-paths" aria-label="Optionale Vorlagen"><span><b>Foto-Vorlagen</b> Figuren, Motive und persönliche Produkte</span><span><b>Produkt-Vorlagen</b> Schneller Start mit vorbereiteten Druckregeln</span></div>
        <div className="creation-filters">
          {["Alle", "Figuren", "Personalisieren", "Wohnen & Licht", "Spiel & Hobby"].map((item) => (
            <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
        <div className="creation-grid">
          {shownTemplates.map((template) => (
            <button className={`creation-card ${selectedTemplate.id === template.id ? "selected" : ""}`} key={template.id} onClick={() => chooseTemplate(template)}>
              <span className="creation-art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={template.image} alt="" loading="lazy" />
                <b>{template.badge || (template.mode === "image" ? "Foto" : "Idee")}</b>
                <i>{selectedTemplate.id === template.id ? "Ausgewählt" : "Gestalten"}</i>
              </span>
              <span className="creation-card-copy"><strong>{template.name}</strong><small>{template.description}</small><em>{template.mode === "image" ? "Foto verwenden" : "Idee beschreiben"} →</em></span>
            </button>
          ))}
        </div>
      </div>

      <div className="ai-workspace" ref={workspaceRef}>
        <div className="ai-input-panel">
          <div className="selected-creation">
            <span className="selected-creation-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedTemplate.image} alt="" />
            </span>
            <div><small>Dein Produkt</small><b>{selectedTemplate.name}</b><span>{selectedTemplate.mode === "image" ? "Start mit Foto" : "Start mit Idee"}</span></div>
            <button type="button" onClick={() => document.querySelector(".creation-browser")?.scrollIntoView({ behavior: "smooth" })}>Ändern</button>
          </div>
          <div className="product-guidance"><span>1</span><div><b>{selectedTemplate.inputHint}</b><small>{selectedTemplate.printRule}</small></div></div>
          <div className="ai-mode-tabs" role="tablist" aria-label="Eingabeart">
            <button role="tab" aria-selected={mode === "text"} className={mode === "text" ? "active" : ""} onClick={() => switchMode("text")}><span>Aa</span> Idee eingeben</button>
            <button role="tab" aria-selected={mode === "image"} className={mode === "image" ? "active" : ""} onClick={() => switchMode("image")}><span>▧</span> Foto verwenden</button>
          </div>

          {mode === "text" ? (
            <div className="design-agent-flow">
              <div className="simple-idea-input">
                <label htmlFor="customer-idea">Was möchtest du gestalten?</label>
                <p>Schreibe es ganz normal. Der AB3D Produktplaner fragt danach nur die Punkte, die für Funktion und 3D-Druck wirklich fehlen.</p>
                <textarea id="customer-idea" value={customerWish} onChange={(event) => updateCustomerIdea(event.target.value)} rows={4} placeholder={`Zum Beispiel: ${selectedTemplate.examples[0]}`} disabled={busy || plannerBusy} />
                <div className="wish-examples">{selectedTemplate.examples.map((example) => <button type="button" key={example} onClick={() => updateCustomerIdea(example)} disabled={busy || plannerBusy}>{example}</button>)}</div>
                {!designPlan && <button type="button" className="planner-start" onClick={startDesignPlanner} disabled={busy || plannerBusy || customerWish.trim().length < 6}>{plannerBusy ? <><i className="spinner" /> Produkt wird analysiert …</> : <><span>✦</span> Idee mit KI planen</>}</button>}
              </div>

              {designPlan && (
                <div className="design-agent" aria-live="polite">
                  <div className="agent-head"><span className="agent-mark">AB</span><div><b>AB3D Produktplaner</b><small>Funktion · Aufbau · 3D-Druck</small></div><em>{designPlan.complete ? "Plan bereit" : `${Math.min(plannerStep + 1, plannerQuestions.length)} / ${plannerQuestions.length}`}</em></div>
                  <div className="agent-customer-message">{customerWish}</div>
                  <div className="agent-message"><p>{designPlan.intro}</p>{(selectedTemplate.id === "lamp" || plannerAnswers.product_purpose === "light") && <p>Elektronik wird niemals als Kunststoffteil mitgeneriert. Geplant werden nur Gehäuse, Lichtschale, Zugang und sichere Führung.</p>}</div>

                  {!designPlan.complete && plannerQuestions[plannerStep] && (() => {
                    const question = plannerQuestions[plannerStep];
                    const selectedAnswer = plannerAnswers[question.id];
                    const selectedOption = question.options.find((entry) => entry.value === selectedAnswer);
                    return <div className="agent-question-card">
                      <div className="agent-question-title"><div><span>Frage {plannerStep + 1}</span><h3>{question.title}</h3><p>{question.hint}</p></div><b>{plannerStep + 1} / {plannerQuestions.length}</b></div>
                      <div className="agent-options" role="radiogroup" aria-label={question.title}>
                        {question.options.map((entry) => <button type="button" role="radio" aria-checked={selectedAnswer === entry.value} className={selectedAnswer === entry.value ? "selected" : ""} key={entry.value} onClick={() => setPlannerAnswers((current) => ({ ...current, [question.id]: entry.value }))}><i /><span><b>{entry.label}</b><small>{entry.description}</small></span></button>)}
                      </div>
                      <span className="agent-choice-confirmation" aria-live="polite">{selectedOption ? <>Ausgewählt: <b>{selectedOption.label}</b></> : "Wähle eine Antwort, um fortzufahren."}</span>
                      <div className="agent-nav"><button type="button" onClick={() => setPlannerStep((current) => Math.max(0, current - 1))} disabled={plannerStep === 0 || plannerBusy}>← Zurück</button><button type="button" className="agent-next" disabled={!selectedAnswer || plannerBusy} onClick={advanceDesignPlanner}>{plannerBusy ? "Antwort wird geprüft …" : selectedOption ? `${selectedOption.label} bestätigen →` : "Antwort wählen"}</button></div>
                    </div>;
                  })()}

                  {designPlan.complete && <div className="agent-plan">
                    <div className="agent-plan-title"><span>✓</span><div><b>Technischer Produktplan</b><p>{designPlan.summary}</p></div></div>
                    <div className="agent-plan-grid"><div><span>Druckteile</span><ul>{designPlan.parts.map((part) => <li key={part}>{part}</li>)}</ul></div><div><span>Konstruktionsregeln</span><ul>{designPlan.specifications.map((spec) => <li key={spec}>{spec}</li>)}</ul></div></div>
                    <div className="agent-manufacturing-plan">
                      <div className="manufacturing-head"><span>{designPlan.manufacturing.strategy === "multi-part" ? `${designPlan.manufacturing.printedParts.length} getrennte Druckteile` : designPlan.manufacturing.strategy === "print-in-place" ? "Print-in-Place-Aufbau" : "Einteiliger Aufbau"}</span><b>Einfacher Fertigungsaufbau</b></div>
                      <div className="manufacturing-columns">
                        <section className="not-printed"><span>Nicht drucken · separat einsetzen</span>{designPlan.manufacturing.sourcedComponents.length > 0 ? <ul>{designPlan.manufacturing.sourcedComponents.map((component) => <li key={component}>{component}</li>)}</ul> : <p>Keine zusätzlichen Kaufteile erforderlich.</p>}</section>
                        <section><span>Passungen & Verbindungen</span><ul>{designPlan.manufacturing.interfaces.map((entry) => <li key={entry}>{entry}</li>)}</ul></section>
                      </div>
                      <section className="assembly-sequence"><span>Montage in dieser Reihenfolge</span><ol>{designPlan.manufacturing.assemblySteps.map((step) => <li key={step}>{step}</li>)}</ol></section>
                    </div>
                    {designPlan.safetyNotes.length > 0 && <div className="agent-safety"><b>Vor der Fertigung prüfen</b>{designPlan.safetyNotes.map((note) => <span key={note}>{note}</span>)}</div>}
                    <button type="button" className={`approve-plan ${plannerApproved ? "approved" : ""}`} onClick={() => { setPlannerApproved(true); setError(""); }} disabled={plannerApproved}>{plannerApproved ? "✓ Produktplan übernommen" : "Diesen Aufbau verwenden"}</button>
                    <button type="button" className="restart-plan" onClick={startDesignPlanner} disabled={plannerBusy}>Antworten ändern</button>
                  </div>}
                </div>
              )}
              {plannerError && <div className="planner-error" role="alert">{plannerError}</div>}
            </div>
          ) : (
            <>
              <div className={`upload-zone ${imagePreview ? "has-image" : ""}`} onClick={() => !busy && fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) handleImage(event.dataTransfer.files[0]); }} role="button" tabIndex={0} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !busy) fileRef.current?.click(); }} aria-label="Bild für 3D-Modell hochladen">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={(event) => handleImage(event.target.files?.[0])} hidden />
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Motiv für die 3D-Kreation" />
                    <div className="upload-replace"><b>{imageName || "KI-Interpretation"}</b><span>Zum Ersetzen klicken</span></div>
                  </>
                ) : (
                  <><span className="upload-icon">＋</span><h3>Foto auswählen</h3><p>{selectedTemplate.inputHint}. Ruhiger Hintergrund, gutes Licht, nur ein Hauptmotiv.</p><small>JPG oder PNG · maximal 8 MB</small></>
                )}
              </div>
              <label className="simple-photo-wish"><span>Was soll daraus entstehen?</span><textarea value={customerWish} onChange={(event) => setCustomerWish(event.target.value.slice(0, 180))} rows={3} placeholder={`Zum Beispiel: ${selectedTemplate.examples[0]}`} disabled={busy} /></label>
            </>
          )}

          {(mode === "image" || plannerApproved) && <div className="simple-style-picker">
            <h3>Wähle einen Stil</h3>
            <fieldset>
              <div className="visual-choice-grid style-choices">
                {(Object.keys(styles) as Array<keyof typeof styles>).map((item) => (
                  <button type="button" key={item} className={style === item ? "active" : ""} aria-pressed={style === item} onClick={() => setStyle(item)} disabled={busy}><i className={`style-swatch style-${item.toLowerCase()}`} /><span>{item}</span></button>
                ))}
              </div>
            </fieldset>
          </div>}

          {(mode === "image" || plannerApproved) && <details className="advanced-settings">
            <summary>Weitere Einstellungen <span>optional</span></summary>
            <div>
            <fieldset>
              <legend>Oberfläche</legend>
              <div className="visual-choice-grid surface-choices">
                {(Object.keys(surfaces) as Array<keyof typeof surfaces>).map((item) => (
                  <button type="button" key={item} className={surface === item ? "active" : ""} aria-pressed={surface === item} onClick={() => setSurface(item)} disabled={busy}><i className={`surface-swatch surface-${item.toLowerCase().replace(" ", "-")}`} /><span>{item}</span></button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Farbwelt</legend>
              <div className="color-choice-grid">
                {(Object.keys(colorMoods) as Array<keyof typeof colorMoods>).map((item) => (
                  <button type="button" key={item} className={colorMood === item ? "active" : ""} aria-pressed={colorMood === item} onClick={() => setColorMood(item)} disabled={busy}><i className={`color-dot color-${item.toLowerCase().replace(" ", "-")}`} /><span>{item}</span></button>
                ))}
              </div>
            </fieldset>
            <label className="print-option"><input type="checkbox" checked={printReady} onChange={(event) => setPrintReady(event.target.checked)} disabled={busy} /><span><b>Für 3D-Druck optimieren</b><small>Stabile Basis und robuste Geometrie</small></span></label>
            <p className="advanced-summary">Dein Designauftrag: <b>{selectedTemplate.name}</b>, {style}, {surface}, {colorMood}.</p>
            </div>
          </details>}

          {(mode === "image" || plannerApproved) && <div className="generation-mode-picker">
            <div><span>Wie möchtest du starten?</span></div>
            <div>
              <button type="button" className={generationMode === "fast" ? "active" : ""} onClick={() => setGenerationMode("fast")} disabled={busy}><b>Schnelle Vorschau</b><small>Form prüfen · etwa 1–3 Minuten</small></button>
              <button type="button" className={generationMode === "quality" ? "active" : ""} onClick={() => setGenerationMode("quality")} disabled={busy}><b>Finales Modell</b><small>Texturen und feine Details · etwa 3–8 Minuten</small></button>
            </div>
          </div>}

          {error && <div className="ai-error" role="alert">{error}</div>}
          {(mode === "image" || plannerApproved) && <><div className="generation-actions"><button className="generate-button" onClick={generate} disabled={busy}>{busy ? <><i className="spinner" /> KI arbeitet · {formatElapsed(elapsedSeconds)}</> : signedIn ? <><span>✦</span> {generationMode === "fast" ? "Schnellvorschau erstellen" : "3D-Design in bester Qualität"}{unlimited ? " · Launch-Pass" : ` · ${tokenCost} Token`}</> : <>Anmelden & Design starten</>}</button>{busy && <button type="button" className="stop-generation" onClick={stopWatching}>Überwachung stoppen</button>}</div>
          <p className="credit-note">{signedIn ? unlimited ? <><b>Launch-Pass aktiv · unbegrenzte Generierungen</b></> : <>Dein Guthaben: <b>{tokenBalance ?? "–"} Design-Tokens</b> · Exakte Grössenskalierung: 1 Token</> : <>Neue Accounts erhalten Start-Tokens für die erste Kreation.</>}</p></>}
        </div>

        <div className={`ai-output-panel state-${state}`}>
          <div className="viewer-topbar"><span><i className={busy ? "status-live" : ""} /> {statusText}</span><div>{startedAt > 0 && <b>{formatElapsed(elapsedSeconds)}</b>}{taskId && <small>ID {taskId.slice(0, 8)}</small>}</div></div>
          <div className="model-stage">
            {modelUrls.glb ? (
              <ModelViewer src={modelUrls.glb} poster={thumbnail} autoRotate={autoRotate} setAutoRotate={setAutoRotate} />
            ) : busy ? (
              <div className="generation-visual"><div className="scan-object"><span /><span /><span /><span /><span /></div><div className="scan-line" /><p>{state === "transforming" ? "Eigenständiges Design wird entwickelt" : state === "resizing" ? "Reale Abmessungen werden gesetzt" : "Form wird Schicht für Schicht aufgebaut"}</p></div>
            ) : (
              <div className="empty-viewer"><div className="wire-vase"><i /><i /><i /><i /><i /></div><p>Dein echtes 3D-Modell erscheint hier</p><small>Mit der Maus drehen · Scrollen zum Zoomen</small></div>
            )}
          </div>
          <div className="progress-area"><div><span>{statusText}</span><b>{Math.round(progress)}%</b></div><div className="process-stages">{displayedStages.map((stage, index) => <span key={stage} className={index < displayedActiveStage ? "done" : index === displayedActiveStage ? "active" : ""}><i>{index < displayedActiveStage ? "✓" : index + 1}</i>{stage}</span>)}</div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small className="progress-note">{printPipeline ? "Die Druckprüfung kontrolliert Wasserdichtheit, Löcher und fehlerhafte Kanten. Die finale Freigabe erfolgt vor der Fertigung." : "Du kannst diesen Tab geöffnet lassen. AB3D baut zuerst die Geometrie und danach – falls gewählt – Material und Farbe."}</small></div>

          {modelUrls.glb && (
            <div className="production-config">
              <div className="size-config">
                <label>Zielhöhe <b>{heightCm} cm</b></label>
                <input type="range" min={selectedTemplate.minHeight} max={selectedTemplate.maxHeight} step="1" value={heightCm} onChange={(event) => { setHeightCm(Number(event.target.value)); setScaledHeight(null); setPrintFilesReady(false); setPrintability(null); }} disabled={busy} />
                <small>{printFilesReady && scaledHeight === heightCm ? "✓ GLB, STL und 3MF sind exakt skaliert und geprüft." : `Empfohlener Bereich für ${selectedTemplate.name}: ${selectedTemplate.minHeight}–${selectedTemplate.maxHeight} cm.`}</small>
                <button onClick={preparePrintFiles} disabled={busy || (printFilesReady && scaledHeight === heightCm)}>{busy && printPipeline ? "Druckpaket wird vorbereitet …" : `Druckpaket für ${heightCm} cm vorbereiten`}{unlimited ? " · Launch-Pass" : " · 2–3 Token"}</button>
              </div>
              <div className="price-config">
                <label>Material<select value={material} onChange={(event) => setMaterial(event.target.value as "PLA" | "PETG")}><option>PLA</option><option>PETG</option></select></label>
                <label>Finish<select value={finish} onChange={(event) => setFinish(event.target.value as "Roh" | "Premium")}><option>Roh</option><option>Premium</option></select></label>
                <label>Menge<input type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
                <div className="price-total"><span>Automatischer Richtpreis</span><b>{money.format(estimate)}</b><small>inkl. Fertigung · final nach Druckbarkeitsprüfung</small></div>
              </div>
              {printability && <div className={`printability-report status-${printability.status}`}>
                <div><span>{printFilesReady ? "✓" : "!"}</span><p><b>{printFilesReady ? "Druckpaket bereit" : "Geometrie geprüft"}</b><small>{printRepaired ? "Geometrie wurde automatisch repariert." : printability.status === "healthy" ? "Die Geometrie ist sauber und geschlossen." : "Auffälligkeiten werden im Druckpaket repariert."}</small></p></div>
                <dl><div><dt>Wasserdicht</dt><dd>{printability.metrics.is_watertight ? "Ja" : "Nein"}</dd></div><div><dt>Löcher</dt><dd>{printability.metrics.holes}</dd></div><div><dt>Nicht-manifold</dt><dd>{printability.metrics.non_manifold_edges}</dd></div><div><dt>Fehlerflächen</dt><dd>{printability.metrics.degenerate_faces}</dd></div></dl>
              </div>}
            </div>
          )}

          {state === "complete" && (
            <><div className="result-actions">
              <div>{modelUrls.glb && <a href={modelUrls.glb} download>{scaledHeight === heightCm ? `GLB · ${heightCm} cm` : "GLB herunterladen"}</a>}{printFilesReady && canDownload3d && modelUrls.stl && <a href={modelUrls.stl} download>STL · {heightCm} cm</a>}{printFilesReady && canDownload3d && modelUrls["3mf"] && <a href={modelUrls["3mf"]} download>3MF · {heightCm} cm</a>}{printFilesReady && !canDownload3d && <Link href="/konto#plaene">STL selbst laden · Abo wählen</Link>}</div>
              <button className="button light" type="button" onClick={createProductionOrder} disabled={!printFilesReady || orderBusy || Boolean(productionOrderId)}>{orderBusy ? "Auftrag wird gespeichert …" : productionOrderId ? `Gespeichert · ${productionOrderId}` : printFilesReady ? `Für ${money.format(estimate)} fertigen lassen` : "Zuerst Druckpaket vorbereiten"}</button>
            </div>{generationMode === "fast" && <div className="quality-upgrade"><div><b>Gefällt dir die Grundform?</b><span>Erstelle jetzt Material, Farben und die druckbaren STL-/3MF-Dateien.</span></div><button type="button" onClick={() => { setGenerationMode("quality"); workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Beste Qualität vorbereiten</button></div>}</>
          )}
          {state === "complete" && <div className="file-access-note"><b>Physisch bestellen oder Datei besitzen?</b><span>Bei einer Fertigung geht die geprüfte STL automatisch intern an AB3D. Nur für einen eigenen STL-/3MF-Download brauchst du das 3D-Studio- oder Complete-Abo.</span>{orderMessage && <small role="status">✓ {orderMessage}</small>}</div>}
        </div>
      </div>

      <div className="ai-steps"><span><b>01</b><i>Vorlage</i>Kategorie und Produktart wählen</span><span><b>02</b><i>KI-Design</i>Motiv kreativ interpretieren</span><span><b>03</b><i>3D & Grösse</i>Modell prüfen und exakt skalieren</span><span><b>04</b><i>Preis & Fertigung</i>Richtpreis erhalten und anfragen</span></div>
    </section>
  );
}
