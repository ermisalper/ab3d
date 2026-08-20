"use client";

/* Printify returns dynamic CDN hosts; product mockups intentionally render as external images. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "../site-header";

type ProductId = "tshirt" | "hoodie" | "cap" | "case" | "swimwear" | "socks" | "poster" | "notebook" | "underwear";
type Product = {
  id: string;
  shopifyProductId: string;
  printifyProductId: string | null;
  kind: ProductId;
  name: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  image?: string | null;
  source: "shopify";
  blueprintId?: number;
  printProviderId?: number;
  variants: Array<{
    printifyVariantId: number | null;
    shopifyVariantId: string;
    sku: string;
    title: string;
    available: boolean;
    price: { amount: string; currencyCode: string } | null;
  }>;
};

const colors = [
  { name: "Natural", value: "#eee8dd" },
  { name: "Graphit", value: "#303531" },
  { name: "Salbei", value: "#8d9a87" },
  { name: "Terracotta", value: "#bd684d" },
];

const styles = ["Minimal", "Illustrativ", "Retro", "Streetwear"] as const;
const examples = [
  "Eine einzelne alpine Blume als ruhige Linienzeichnung in Terracotta und Creme",
  "Abstrakte Wellen, geometrisch, kräftiger Kontrast, ohne Text",
  "Verspielter Fuchs im Schweizer Scherenschnitt-Stil, warm und freundlich",
];

const heroPrints = [
  { id: "alpine", label: "Alpine Bloom", mark: "✦", lineOne: "ALPINE", lineTwo: "BLOOM" },
  { id: "orbit", label: "Orbit 03", mark: "●", lineOne: "ORBIT", lineTwo: "03" },
  { id: "wild", label: "Wild Lines", mark: "≈", lineOne: "WILD", lineTwo: "LINES" },
  { id: "cappatex", label: "CAPPATEX Studio", mark: "C", lineOne: "CAPPA", lineTwo: "TEX" },
] as const;

function money(amount: number, currency = "CHF") {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(amount);
}

export default function CappatexStudio({ userName }: { userName?: string | null }) {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogMessage, setCatalogMessage] = useState("Produktkatalog wird geladen …");
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [canDownloadHd, setCanDownloadHd] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [productId, setProductId] = useState("tshirt");
  const [prompt, setPrompt] = useState(examples[0]);
  const [style, setStyle] = useState<(typeof styles)[number]>("Minimal");
  const [productColor, setProductColor] = useState(colors[0].value);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [designScale, setDesignScale] = useState(72);
  const [designY, setDesignY] = useState(50);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [heroPrintIndex, setHeroPrintIndex] = useState(0);
  const [heroPressActive, setHeroPressActive] = useState(false);
  const heroPrintTimer = useRef<number | null>(null);

  const product = useMemo(() => catalogProducts.find((entry) => entry.id === productId) || catalogProducts[0] || null, [productId, catalogProducts]);
  const variant = product?.variants.find((entry) => entry.shopifyVariantId === variantId) || product?.variants[0] || null;
  const unitPrice = variant?.price ? Number(variant.price.amount) : product?.price || 0;
  const currency = variant?.price?.currencyCode || product?.currency || "CHF";
  const total = unitPrice * quantity;

  useEffect(() => {
    let active = true;
    fetch("/api/cappatex/catalog", { headers: { Accept: "application/json" } })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok || !Array.isArray(data.products) || data.products.length === 0) {
          setCatalogMessage(data.message || data.error || "Der verbundene Produktkatalog ist momentan nicht verfügbar.");
          setCatalogStatus("error");
          return;
        }
        const normalized = data.products.map((entry: Product) => ({ ...entry, category: entry.category || "CAPPATEX", price: Number(entry.variants?.[0]?.price?.amount || entry.price || 0), currency: entry.variants?.[0]?.price?.currencyCode || entry.currency || "CHF", source: "shopify" as const }));
        setCatalogProducts(normalized);
        setCatalogMessage(data.message || `${normalized.length} Shopify-Produkte verfügbar`);
        setCatalogStatus("ready");
        setProductId(normalized[0].id);
        setVariantId(normalized[0].variants[0]?.shopifyVariantId || "");
      })
      .catch(() => {
        if (!active) return;
        setCatalogMessage("Der verbundene Produktkatalog ist momentan nicht erreichbar.");
        setCatalogStatus("error");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
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

  useEffect(() => {
    fetch("/api/account", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        setCanDownloadHd(Boolean(data?.account?.capabilities?.canDownloadHd));
        if (typeof data?.account?.tokenBalance === "number") setTokenBalance(data.account.tokenBalance);
      })
      .catch(() => undefined);
  }, []);

  const selectProduct = (next: Product) => {
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
        body: JSON.stringify({ prompt: idea, product: product.kind, style, confirmGeneration: true }),
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
          placement: { scale: designScale, y: designY },
        }),
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

  return (
    <main className="cappatex-page" id="main-content">
      <SiteHeader area="cappatex" userName={userName} />

      <section className="cappatex-hero">
        <div>
          <p className="eyebrow">KI-Design · Print on Demand</p>
          <h1>Deine Idee.<br /><em>Dein Statement.</em></h1>
          <p>Beschreibe dein Wunschmotiv, sieh es direkt auf deinem Produkt und passe Grösse sowie Position selbst an.</p>
          <a className="button primary" href="#studio">Jetzt gestalten</a>
        </div>
        <div className="cappatex-hero-art">
          <button
            type="button"
            className={`cappatex-press-scene ${heroPressActive ? "is-pressing" : ""}`}
            onClick={pressNextHeroDesign}
            onAnimationEnd={(event) => {
              if (event.animationName === "cappatexPressCycle") setHeroPressActive(false);
            }}
            aria-label={`T-Shirt bedrucken. Aktuelles Motiv: ${heroPrints[heroPrintIndex].label}. Klicken für das nächste Design.`}
          >
            <span className="cappatex-press-grid" aria-hidden="true" />
            <span className="cappatex-press-machine" aria-hidden="true">
              <span className="cappatex-press-column" />
              <span className="cappatex-press-rail" />
              <span className="cappatex-press-head"><i /><b>PRINT</b></span>
            </span>
            <span className="cappatex-shirt-stage" aria-hidden="true">
              <span className="cappatex-shirt-shadow" />
              <span className="cappatex-hero-shirt-real">
                <span className="cappatex-shirt-neck" />
                <span className="cappatex-shirt-seam seam-left" />
                <span className="cappatex-shirt-seam seam-right" />
                <span className={`cappatex-shirt-print print-${heroPrints[heroPrintIndex].id}`}>
                  <i>{heroPrints[heroPrintIndex].mark}</i>
                  <b>{heroPrints[heroPrintIndex].lineOne}</b>
                  <strong>{heroPrints[heroPrintIndex].lineTwo}</strong>
                </span>
              </span>
            </span>
            <span className="cappatex-ink-flash" aria-hidden="true" />
            <span className="cappatex-press-instruction">
              <i>{String(heroPrintIndex + 1).padStart(2, "0")} / {String(heroPrints.length).padStart(2, "0")}</i>
              <b>{heroPressActive ? "Wird gepresst …" : "Klicken & neu bedrucken"}</b>
              <small>Jeder Klick · ein neues Motiv</small>
            </span>
          </button>
        </div>
      </section>

      <section className="cappatex-flow" id="studio">
        <div className="cappatex-flow-intro">
          <p className="eyebrow">CAPPATEX Design Studio</p>
          <h2>In drei klaren Schritten.</h2>
          <p>Du brauchst keine Design-Erfahrung. Wähle, beschreibe und prüfe dein Produkt vor der Bestellung.</p>
        </div>

        {product ? <div className="cappatex-workspace">
          <div className="cappatex-controls">
            <section className="cappatex-step">
              <div className="cappatex-step-heading"><span>1</span><div><h3>Produkt wählen</h3><p>Worauf soll dein Motiv gedruckt werden?</p></div></div>
              <p className={`cappatex-catalog-state ${catalogProducts.length ? "is-live" : ""}`}>{catalogMessage}</p>
              <div className="cappatex-products">
                {catalogProducts.map((entry) => (
                  <button key={entry.id} className={entry.id === product.id ? "active" : ""} onClick={() => selectProduct(entry)}>
                    {entry.image ? <img src={entry.image} alt="" /> : <ProductIcon id={entry.kind} />}
                    <span>{entry.name}</span><small>ab {money(entry.price, entry.currency)}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="cappatex-step">
              <div className="cappatex-step-heading"><span>2</span><div><h3>Idee beschreiben</h3><p>Farben, Stil, Motiv und Stimmung helfen der KI.</p></div></div>
              <label className="cappatex-prompt">
                <span>Dein Wunschmotiv</span>
                <textarea value={prompt} maxLength={500} onChange={(event) => setPrompt(event.target.value)} placeholder="Zum Beispiel: Eine einzelne alpine Blume als klare Linienzeichnung …" />
                <small>{prompt.length}/500 Zeichen</small>
              </label>
              <div className="cappatex-examples" aria-label="Prompt-Beispiele">
                {examples.map((example, index) => <button key={example} onClick={() => setPrompt(example)}>Idee {index + 1}</button>)}
              </div>
              <fieldset className="cappatex-styles"><legend>Bildstil</legend>{styles.map((entry) => <button type="button" key={entry} className={style === entry ? "active" : ""} onClick={() => setStyle(entry)}>{entry}</button>)}</fieldset>
              {error && <div className="cappatex-error" role="alert">{error}</div>}
              <button className="button primary cappatex-generate" onClick={generate} disabled={busy || prompt.trim().length < 12}>
                {busy ? <><i /> Design wird erstellt …</> : <>✦ Design generieren</>}
              </button>
              <p className="cappatex-wait-note">1 Motivvorschau = 1 Token{tokenBalance !== null ? ` · Dein Guthaben: ${tokenBalance}` : ""}. Die KI benötigt meistens 20–60 Sekunden.</p>
            </section>
          </div>

          <section className="cappatex-preview-panel" aria-live="polite">
            <div className="cappatex-preview-head"><div><small>Live-Vorschau</small><h3>{product.name}</h3></div><b>{money(unitPrice, currency)}</b></div>
            <div className={`cappatex-preview product-${product.kind} ${busy ? "is-busy" : ""}`}>
              <div className="cappatex-preview-grid" />
              <ProductMockup id={product.kind} productImage={product.image} color={productColor} image={generatedImage} scale={designScale} y={designY} />
              {busy && <div className="cappatex-generating"><i /><b>Deine Idee wird gestaltet</b><span>Motiv · Farben · Druckfläche</span></div>}
              {!generatedImage && !busy && <div className="cappatex-empty-preview"><span>✦</span><b>Dein Motiv erscheint hier</b><small>Nach der Generierung kannst du es frei anpassen.</small></div>}
            </div>

            <div className="cappatex-customize">
              <label>Produktfarbe<div className="cappatex-color-row">{colors.map((color) => <button key={color.value} className={productColor === color.value ? "active" : ""} style={{ background: color.value }} onClick={() => setProductColor(color.value)} aria-label={`${color.name} wählen`} title={color.name} />)}</div></label>
              <label>Motivgrösse <b>{designScale}%</b><input type="range" min="35" max="110" value={designScale} onChange={(event) => setDesignScale(Number(event.target.value))} /></label>
              <label>Position <b>{designY < 42 ? "Oben" : designY > 58 ? "Unten" : "Mitte"}</b><input type="range" min="28" max="72" value={designY} onChange={(event) => setDesignY(Number(event.target.value))} /></label>
            </div>

            <div className="cappatex-order-config">
              <label>Variante<select value={variant?.shopifyVariantId || ""} onChange={(event) => setVariantId(event.target.value)}>{product.variants.map((entry) => <option key={entry.shopifyVariantId} value={entry.shopifyVariantId} disabled={!entry.available || !entry.printifyVariantId}>{entry.title}{!entry.available ? " – ausverkauft" : !entry.printifyVariantId ? " – Produktion wird verknüpft" : ""}</option>)}</select></label>
              <label>Menge<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((entry) => <option key={entry}>{entry}</option>)}</select></label>
              <div><small>Shoppreis</small><strong>{money(total, currency)}</strong></div>
            </div>

            {generatedImage && <div className="cappatex-ready">
              <div><span>✓</span><p><b>Design bereit</b><small>Referenz {reference}</small></p></div>
              <div className="cappatex-ready-actions"><button onClick={downloadDesign}>{canDownloadHd ? "HD-Motiv herunterladen" : "HD-Download im Abo"}</button><button onClick={copyOrderDetails}>{copied ? "Referenz kopiert ✓" : "Bestelldaten kopieren"}</button></div>
              <label className="legal-consent cappatex-consent"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>Ich akzeptiere die <Link href="/recht/agb" target="_blank">AGB</Link> und habe die <Link href="/recht/datenschutz" target="_blank">Datenschutzerklärung</Link> gelesen.</span></label>
              <button className="button primary" onClick={startCheckout} disabled={checkoutBusy || !termsAccepted || !product.printifyProductId || !variant?.shopifyVariantId || !variant.printifyVariantId || !variant.available}>{checkoutBusy ? "Sicherer Checkout wird vorbereitet …" : "Zahlung sicher öffnen →"}</button>
              <p>Design, Variante und Platzierung werden an den geschützten Shopify-Checkout übergeben. Nach bestätigter Zahlung wird die finale Druckdatei für die Produktion erstellt.</p>
            </div>}
          </section>
        </div> : (
          <div className="cappatex-catalog-unavailable" role={catalogStatus === "loading" ? "status" : "alert"}>
            <span aria-hidden="true">{catalogStatus === "loading" ? "…" : "!"}</span>
            <div>
              <h3>{catalogStatus === "loading" ? "Produktkatalog wird verbunden" : "Studio derzeit nicht bestellbar"}</h3>
              <p>{catalogMessage}</p>
              {catalogStatus === "error" && <p>Es werden keine erfundenen Produkte oder Preise angezeigt. Bitte versuche es später erneut.</p>}
            </div>
          </div>
        )}
      </section>

      <section className="cappatex-how section" id="ablauf">
        <div><p className="eyebrow">So entsteht dein Einzelstück</p><h2>Einfach gestaltet.<br />Bewusst produziert.</h2></div>
        <ol>
          <li><b>01</b><div><strong>Du gestaltest</strong><p>Die KI übersetzt deine Beschreibung in ein druckbares, quadratisches Motiv.</p></div></li>
          <li><b>02</b><div><strong>Du prüfst</strong><p>Produkt, Farbe, Grösse und Platzierung bleiben bis zur Bestellung anpassbar.</p></div></li>
          <li><b>03</b><div><strong>Wir produzieren</strong><p>Erst nach deiner Bestellung wird dein Einzelstück gedruckt und versendet.</p></div></li>
        </ol>
      </section>

      <section className="faq-section section cappatex-faq" id="faq">
        <div><p className="eyebrow">Häufige Fragen</p><h2>Klar vor der Bestellung.</h2><p>Du entscheidest erst nach der Vorschau, ob dein Motiv produziert werden soll.</p></div>
        <div className="faq-list">
          <details><summary>Wann wird mein Produkt produziert?</summary><p>Erst nach deiner bestätigten Zahlung. Produkt, Variante, Motivgrösse und Position werden mit der Bestellung gespeichert und für die Produktion aufbereitet.</p></details>
          <details><summary>Kann ich mein Motiv herunterladen?</summary><p>Ein eigener HD-Dateidownload ist im CAPPATEX- oder Complete-Abo enthalten. Für die Bestellung eines physischen Produkts brauchst du kein Download-Abo.</p></details>
          <details><summary>Warum sehe ich manchmal keinen Produktkatalog?</summary><p>Das Studio zeigt ausschliesslich tatsächlich verbundene und bestellbare Produkte. Ist die Verbindung vorübergehend nicht verfügbar, werden keine erfundenen Produkte oder Preise eingeblendet.</p></details>
        </div>
      </section>

      <footer className="cappatex-footer">
        <div className="footer-brand"><Link className="brand" href="/#top"><span>AB</span><b>3D</b></Link><p>CAPPATEX verbindet deine Idee mit hochwertigem Print on Demand.</p></div>
        <div><b>Studios</b><Link href="/#studio">3D AI Studio</Link><a href="#studio">CAPPATEX Studio</a><Link href="/#kollektion">Kollektion</Link></div>
        <div><b>Service & Recht</b><a href="mailto:hello@ab3d.ch">Kontakt</a><Link href="/recht">Rechtscenter</Link><Link href="/recht/datenschutz">Datenschutz</Link><Link href="/recht/agb">AGB</Link><Link href="/recht/versand-rueckgabe">Versand & Rückgabe</Link></div>
        <small>© 2026 AB3D · CAPPATEX · Designed in Switzerland</small>
      </footer>
    </main>
  );
}

function ProductIcon({ id }: { id: ProductId }) {
  const icons: Record<ProductId, string> = { tshirt: "T", hoodie: "H", cap: "⌒", case: "▯", swimwear: "≈", socks: "∿", poster: "□", notebook: "▥", underwear: "⌒" };
  return <i aria-hidden="true">{icons[id]}</i>;
}

function ProductMockup({ id, productImage, color, image, scale, y }: { id: ProductId; productImage?: string | null; color: string; image: string | null; scale: number; y: number }) {
  return <div className={`cappatex-mockup mockup-${id} ${productImage ? "has-photo" : ""}`} style={{ "--product-color": color } as React.CSSProperties}>
    {productImage && <img className="cappatex-product-photo" src={productImage} alt="" />}
    <span className="mockup-piece piece-a" /><span className="mockup-piece piece-b" />
    <div className="cappatex-print-area">
      {image && <span className="cappatex-design" role="img" aria-label="Dein generiertes Motiv auf dem Produkt" style={{ backgroundImage: `url(${JSON.stringify(image).slice(1, -1)})`, width: `${scale}%`, aspectRatio: "1", top: `${y}%` }} />}
    </div>
  </div>;
}
