"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { initialPlacement, placementGeometry, type ArtworkSize, type Placement } from "../cappatex-print-profile";
import type { CappatexDesignProduct } from "../cappatex-design-catalog";
import { prepareCustomerImage } from "../cappatex-upload-client";
import { designStateUrl, readDesignState, retainedPlacement, verifiedDesignSelection } from "../cappatex-design-state";

const styles = ["Minimal", "Illustrativ", "Retro", "Streetwear"];
const money = (amount: number, currency: string) => new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(amount);

export default function CappatexDesigner() {
  const [products, setProducts] = useState<CappatexDesignProduct[]>([]);
  const [message, setMessage] = useState("Blanko-Produkte werden geprüft …");
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [generationEnabled, setGenerationEnabled] = useState(false);
  const [pilotOwner, setPilotOwner] = useState(false);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [source, setSource] = useState("prompt");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [imageRights, setImageRights] = useState(false);
  const [uploadedArtwork, setUploadedArtwork] = useState(false);
  const [previewSize, setPreviewSize] = useState<ArtworkSize>({ width: 512, height: 768 });
  const [canDownloadHd, setCanDownloadHd] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Minimal");
  const [canvas, setCanvas] = useState("portrait");
  const [confirmed, setConfirmed] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [artwork, setArtwork] = useState<ArtworkSize>({ width: 2048, height: 3072 });
  const [designId, setDesignId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [selectedPlacement, setPlacement] = useState<Placement | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [country, setCountry] = useState<"CH" | "LI">("CH");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState("restore");
  const [error, setError] = useState("");
  const [loadedArtwork, setLoadedArtwork] = useState("");
  const [loadedBlank, setLoadedBlank] = useState("");
  const [restorationComplete, setRestorationComplete] = useState(false);
  const [selectionNeedsReview, setSelectionNeedsReview] = useState(false);

  const product = products.find(p => p.id === productId) || (selectionNeedsReview ? undefined : products[0]);
  const variant = product?.variants.find(v => v.shopifyVariantId === variantId) || (selectionNeedsReview ? undefined : product?.variants[0]);
  const placement = useMemo(() => selectedPlacement || (variant ? initialPlacement(variant.area, artwork) : { x: .5, y: .5, scale: .5 }),
    [selectedPlacement, variant, artwork]);
  const geometry = variant ? placementGeometry(variant.area, artwork, placement) : null;
  const blankIdentity = variant ? `${variant.shopifyVariantId}:${variant.mockup.url}` : "";
  const previewReady = Boolean(image && loadedArtwork === image && variant && loadedBlank === blankIdentity);

  useEffect(() => {
    let active = true;
    const restored = readDesignState(window.location.search);
    const metadata = restored.designId
      ? fetch(`/api/cappatex/designs/${restored.designId}`, { cache: "no-store" }).then(async response => {
        if (!response.ok) throw new Error("Das gespeicherte Motiv konnte für dein Konto nicht geladen werden.");
        return response.json();
      }).then(data => {
        if (data.designId !== restored.designId || data.previewUrl !== `/api/cappatex/artwork/${restored.designId}`
          || ![data.width, data.height, data.previewWidth, data.previewHeight].every(value => Number.isInteger(value) && value > 0)
          || data.previewWidth !== Math.ceil(data.width / 4) || data.previewHeight !== Math.ceil(data.height / 4)) {
          throw new Error("Die gespeicherten Motivdaten sind unvollständig.");
        }
        return data;
      }) : Promise.resolve(null);
    const catalog = fetch("/api/cappatex/catalog", { cache: "no-store" }).then(response => response.json());
    Promise.allSettled([catalog, metadata]).then(([catalogResult, designResult]) => {
      if (!active) return;
      setQuantity(restored.quantity); setCountry(restored.country);
      if (catalogResult.status === "fulfilled") {
        const data = catalogResult.value;
        const catalogProducts = Array.isArray(data.products) ? data.products : [];
        const selection = verifiedDesignSelection(restored, catalogProducts);
        setProducts(catalogProducts); setProductId(selection.profileId); setVariantId(selection.variantId);
        setPlacement(selection.placement || null);
        setSelectionNeedsReview(selection.requiresSelection);
        if (selection.requiresSelection) setError("Die gespeicherte Produktvariante ist nicht mehr verfügbar. Bitte wähle Produkt und Variante erneut.");
        setMessage(data.message || "Die Blanko-Produkte sind derzeit nicht verfügbar.");
        setCheckoutEnabled(data.checkoutEnabled === true);
      } else {
        setMessage("Die Blanko-Produkte konnten gerade nicht geladen werden. Bitte lade die Seite erneut.");
        setSelectionNeedsReview(Boolean(restored.profileId || restored.variantId || restored.placement));
      }
      if (designResult.status === "fulfilled" && designResult.value) {
        const data = designResult.value;
        setImage(data.previewUrl); setDesignId(data.designId); setArtwork({ width: data.width, height: data.height });
        setPreviewSize({ width: data.previewWidth, height: data.previewHeight });
        setUploadedArtwork(data.source === "upload"); setCanDownloadHd(data.canDownloadOriginal === true);
      } else if (designResult.status === "rejected") setError(designResult.reason instanceof Error ? designResult.reason.message : "Das Motiv konnte nicht geladen werden.");
      setBusy(""); setRestorationComplete(true);
    });
    fetch("/api/account", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => {
      if (active) {
        setGenerationEnabled(data?.account?.cappatexGeneration?.enabled === true);
        setPilotOwner(data?.account?.cappatexGeneration?.pilotOwner === true);
        setUploadEnabled(data?.account?.cappatexUpload?.enabled === true);
        setCanDownloadHd(data?.account?.capabilities?.canDownloadHd === true);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!restorationComplete || !designId || selectionNeedsReview) return;
    const url = designStateUrl(window.location.href, { designId, profileId: product?.id || productId,
      variantId: variant?.shopifyVariantId || variantId, placement, quantity, country });
    window.history.replaceState(window.history.state, "", url);
  }, [restorationComplete, selectionNeedsReview, designId, product, productId, variant, variantId, placement, quantity, country]);

  function selectVariant(nextProduct: CappatexDesignProduct, nextId: string) {
    const next = nextProduct.variants.find(v => v.shopifyVariantId === nextId) || nextProduct.variants[0];
    setProductId(nextProduct.id); setVariantId(next.shopifyVariantId);
    setPlacement(selectionNeedsReview ? null : retainedPlacement(product?.id, nextProduct.id, placement));
    setSelectionNeedsReview(false); setTerms(false); setError("");
  }
  async function generate() {
    if (!confirmed || !generationEnabled || busy) return;
    setBusy("generation"); setError("");
    try {
      const response = await fetch("/api/cappatex", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, canvas, confirmGeneration: confirmed }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Das Motiv konnte nicht erstellt werden.");
      setImage(data.image); setDesignId(data.designId); setArtwork({ width: data.width, height: data.height });
      setPreviewSize({ width: data.previewWidth ?? Math.ceil(data.width / 4), height: data.previewHeight ?? Math.ceil(data.height / 4) });
      setUploadedArtwork(false); setLoadedArtwork("");
      if (variant) setPlacement(initialPlacement(variant.area, { width: data.width, height: data.height }));
      setTerms(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Bilddienst nicht erreichbar."); }
    finally { setBusy(""); }
  }
  async function upload() {
    if (!uploadFile || !imageRights || !uploadEnabled || busy) return;
    setBusy("upload"); setError("");
    try {
      const file = await prepareCustomerImage(uploadFile);
      const response = await fetch("/api/cappatex/upload", { method: "POST", headers: { "Content-Type": "image/png", "X-Cappatex-Image-Rights": "confirmed" }, body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Das Bild konnte nicht gespeichert werden.");
      const size = { width: data.width, height: data.height };
      setImage(data.image); setDesignId(data.designId); setArtwork(size);
      setPreviewSize({ width: data.previewWidth, height: data.previewHeight });
      setUploadedArtwork(true); setLoadedArtwork(""); setTerms(false);
      if (variant) setPlacement(initialPlacement(variant.area, size));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Das Bild konnte nicht verarbeitet werden."); }
    finally { setBusy(""); }
  }
  async function checkout() {
    if (!product?.purchaseReady || !variant?.price || !previewReady || !geometry?.ok || !checkoutEnabled || !terms || !designId || busy) return;
    setBusy("checkout"); setError("");
    try {
      const response = await fetch("/api/cappatex/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, profileId: product.id, profileVersion: product.profileVersion,
          shopifyVariantId: variant.shopifyVariantId, placement, quantity, country, termsAccepted: terms }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout konnte nicht vorbereitet werden.");
      const url = new URL(data.checkoutUrl);
      if (url.protocol !== "https:") throw new Error("Ungültiger Checkout.");
      window.location.assign(url.toString());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Checkout nicht erreichbar."); setBusy(""); }
  }
  return <section className="cappatex-flow" id="studio">
    <div className="cappatex-flow-intro"><p className="eyebrow">Selbst gestalten</p><h2>Erst dein Motiv.<br />Dann dein Einzelstück.</h2>
      <p>Gestalte ein Motiv, wähle deinen Blanko-Artikel und prüfe den Druck vor der Bestellung.</p></div>
    <div className="cappatex-workspace">
      <div className="cappatex-controls">
        <section className="cappatex-step">
          <div className="cappatex-step-heading"><span>1</span><div><h3>Dein Motiv</h3><p>Was möchtest du tragen?</p></div></div>
          <fieldset className="cappatex-styles cappatex-source"><legend>Wie möchtest du starten?</legend>
            <button type="button" aria-pressed={source === "prompt"} className={source === "prompt" ? "active" : ""} disabled={Boolean(busy)} onClick={() => setSource("prompt")}>Mit KI gestalten</button>
            <button type="button" aria-pressed={source === "upload"} className={source === "upload" ? "active" : ""} disabled={Boolean(busy)} onClick={() => setSource("upload")}>Eigenes Bild verwenden</button>
          </fieldset>
          {source === "prompt" ? <>
          <label className="cappatex-prompt"><span>Idee beschreiben</span><textarea value={prompt} maxLength={500}
            onChange={e => setPrompt(e.target.value)} placeholder="Zum Beispiel: Eine alpine Blume als ruhige Linienzeichnung in Terracotta und Creme, ohne Text" />
            <small>{prompt.length}/500 Zeichen</small></label>
          <fieldset className="cappatex-styles"><legend>Bildstil</legend>{styles.map(value => <button type="button" key={value} aria-pressed={style === value}
            className={style === value ? "active" : ""} onClick={() => setStyle(value)}>{value}</button>)}</fieldset>
          <label className="cappatex-field">Motivformat<select value={canvas} onChange={e => setCanvas(e.target.value)}>
            <option value="portrait">Hochformat · 2048 × 3072 px</option><option value="square">Quadratisch · 2048 × 2048 px</option><option value="landscape">Querformat · 3072 × 2048 px</option>
          </select></label>
          <label className="legal-consent cappatex-consent"><input type="checkbox" checked={confirmed} disabled={!generationEnabled} onChange={e => setConfirmed(e.target.checked)} />
            <span>{pilotOwner ? "Ein Testmotiv als Betreiber erstellen. Es entstehen OpenAI-API-Kosten; kein Design-Token wird abgezogen." : "Ein Motiv für 1 Design-Token erstellen."}</span></label>
          <button className="button primary cappatex-generate" onClick={generate} disabled={!confirmed || !generationEnabled || prompt.trim().length < 12 || Boolean(busy)}>
            {busy === "generation" ? "Motiv wird erstellt …" : "Motiv erstellen"}</button>
          <p className="cappatex-wait-note">{generationEnabled ? "Die Vorschau ist eine verkleinerte Ansicht deiner Druckdatei. Es gibt keine automatische zweite Generierung."
            : "Die KI-Generierung wartet auf den freigegebenen Test. Du kannst deine Idee bereits formulieren; es entstehen keine API-Kosten."}</p>
          </> : <div className="cappatex-upload">
            <label className="cappatex-field">Bild auswählen<input type="file" accept="image/png,image/jpeg" disabled={Boolean(busy)} onChange={e => { setUploadFile(e.target.files?.[0] || null); setImageRights(false); setError(""); }} /></label>
            <p>PNG oder JPG, bis 12 MB und 6,29 Megapixel. Dein Bild wird ohne KI-Bearbeitung und ohne Verkleinerung als PNG-Druckdatei gespeichert. Bitte prüfe danach Farben, Ausrichtung und Platzierung in der Vorschau.</p>
            <label className="legal-consent cappatex-consent"><input type="checkbox" checked={imageRights} onChange={e => setImageRights(e.target.checked)} />
              <span>Ich darf dieses Bild verwenden und bedrucken lassen.</span></label>
            <button className="button primary cappatex-generate" onClick={upload} disabled={!uploadFile || !imageRights || !uploadEnabled || Boolean(busy)}>{busy === "upload" ? "Bild wird geprüft …" : "Eigenes Bild übernehmen"}</button>
            <p className="cappatex-wait-note">{uploadEnabled ? "Keine KI-Kosten und kein Design-Token. Bis zu zehn Upload-Versuche innerhalb von 24 Stunden."
              : "Der Upload ist noch nicht freigegeben. Für den Test ist ein angemeldetes Betreiberkonto erforderlich."}</p>
          </div>}
        </section>
        <section className="cappatex-step">
          <div className="cappatex-step-heading"><span>2</span><div><h3>Blanko-Artikel wählen</h3><p>Dein Motiv bekommt seinen Platz.</p></div></div>
          <p className="cappatex-catalog-state" role="status">{message}</p>
          <div className="cappatex-products">{products.map(item => <button key={item.id} aria-pressed={product?.id === item.id}
            className={product?.id === item.id ? "active" : ""} onClick={() => selectVariant(item, item.variants[0].shopifyVariantId)}>
            <img src={item.variants[0].mockup.url} alt="" /><span>{item.name}</span>
          </button>)}</div>
          {!products.length && <a className="text-link" href="#kollektion">Fertige Motive im Katalog ansehen →</a>}
          {product && variant && <div className="cappatex-variant-fields">
            <label className="cappatex-field">Farbe<select value={variant.color} onChange={e => {
              const next = product.variants.find(v => v.color === e.target.value && v.size === variant.size)
                || product.variants.find(v => v.color === e.target.value)!;
              selectVariant(product, next.shopifyVariantId);
            }}>{[...new Set(product.variants.map(v => v.color))].map(color => <option key={color}>{color}</option>)}</select></label>
            <label className="cappatex-field">Grösse<select value={variant.shopifyVariantId} onChange={e => selectVariant(product, e.target.value)}>
              {product.variants.filter(v => v.color === variant.color).map(v => <option key={v.shopifyVariantId} value={v.shopifyVariantId}>{v.size}</option>)}</select></label>
          </div>}
        </section>
      </div>
      <section className="cappatex-preview-panel">
        <div className="cappatex-preview-head"><div><small>3 · Vorschau prüfen</small><h3>{product?.name || "Dein Motiv"}</h3></div>
          {variant && <b>{variant.price ? money(Number(variant.price.amount), variant.price.currencyCode) : "Preis noch nicht freigegeben"}</b>}</div>
        <div className="cappatex-verified-preview">
          {variant ? <div className="cappatex-blank-photo" style={{ aspectRatio: `${variant.mockup.width}/${variant.mockup.height}` }}>
            <img key={blankIdentity} className="cappatex-blank-image" src={variant.mockup.url} alt={`${product?.name || "Blanko"}, ${variant.color}, ${variant.size}, unbedruckt`}
              onLoad={e => { if (e.currentTarget.naturalWidth === variant.mockup.width && e.currentTarget.naturalHeight === variant.mockup.height) setLoadedBlank(blankIdentity); else setError("Die Produktansicht stimmt nicht mit der geprüften Vorlage überein."); }}
              onError={() => { setLoadedBlank(""); setTerms(false); setError("Die Produktansicht konnte nicht geladen werden."); }} />
            <div className="cappatex-verified-area" style={{ left: `${100 * variant.mockup.left / variant.mockup.width}%`, top: `${100 * variant.mockup.top / variant.mockup.height}%`,
              width: `${100 * variant.mockup.printWidth / variant.mockup.width}%`, height: `${100 * variant.mockup.printHeight / variant.mockup.height}%` }}>
              {image && <img key={image} src={image} alt="Dein unverändertes Motiv in der Druckfläche"
                onLoad={e => { if (e.currentTarget.naturalWidth === previewSize.width && e.currentTarget.naturalHeight === previewSize.height) setLoadedArtwork(image); else setError("Die Motivdatei stimmt nicht mit der Druckdatei überein."); }}
                onError={() => { setLoadedArtwork(""); setTerms(false); setError("Das Motiv konnte nicht geladen werden. Die Bestellung bleibt gesperrt."); }} style={{ position: "absolute", maxWidth: "none", width: `${placement.scale * 100}%`,
                height: `${100 * placement.scale * variant.area.widthPx / variant.area.heightPx * artwork.height / artwork.width}%`, left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, transform: "translate(-50%, -50%)" }} />}
            </div>
          </div> : image ? <div style={{ width: "100%", maxWidth: 460 * artwork.width / artwork.height, aspectRatio: `${artwork.width}/${artwork.height}`, margin: "auto" }}>
            <img className="cappatex-artwork-only" src={image} style={{ width: "100%", height: "100%", objectFit: "fill" }} alt="Dein fertiges Motiv" /></div> :
            <div className="cappatex-preview-placeholder"><span aria-hidden="true">✦</span><b>Hier beginnt dein Einzelstück</b><p>Beschreibe deine Idee oder wähle ein eigenes Bild. Dein Motiv erscheint hier.</p></div>}
        </div>
        {image && (canDownloadHd || uploadedArtwork) && <a className="text-link" href={`${image}?download=1`}>Freigegebene PNG-Druckdatei herunterladen →</a>}
        {variant && <>
          {product?.mockupReferenceSize && <p className="cappatex-profile-note">Produktansicht: Referenzgrösse {product.mockupReferenceSize}. Druckmasse für deine gewählte Grösse.</p>}
          <p className="cappatex-profile-note">Druckfläche: {variant.area.position === "front" ? "Vorderseite" : variant.area.position} · {Math.round(variant.area.widthMm)} × {Math.round(variant.area.heightMm)} mm · {variant.area.widthPx} × {variant.area.heightPx} px · Qualitätsziel: mindestens {variant.area.minDpi} dpi.
              Die gestrichelte Linie markiert die erlaubte Fläche. Die Fotovorschau zeigt Position und Grösse; Stofffalten werden vereinfacht dargestellt. Stoffstruktur und Bildschirmfarben können vom Druck abweichen.</p>
          <div className="cappatex-customize">
            <label>Motivbreite <b>{Math.round(placement.scale * 100)} %</b><input type="range" min={variant.area.minScale} max={variant.area.maxScale} step="0.01" value={placement.scale} onChange={e => { setPlacement({ ...placement, scale: Number(e.target.value) }); setTerms(false); }} /></label>
            <label>Horizontal<input type="range" min="0" max="1" step="0.01" value={placement.x} onChange={e => { setPlacement({ ...placement, x: Number(e.target.value) }); setTerms(false); }} /></label>
            <label>Vertikal<input type="range" min="0" max="1" step="0.01" value={placement.y} onChange={e => { setPlacement({ ...placement, y: Number(e.target.value) }); setTerms(false); }} /></label>
          </div>
          {image && geometry && <p className={geometry.ok ? "cappatex-quality-ok" : "cappatex-error"} role="status">{geometry.reason}
            {geometry.dpi !== undefined && <> · {Math.floor(geometry.dpi)} dpi · {Math.round(geometry.widthMm!)} × {Math.round(geometry.heightMm!)} mm</>}</p>}
          <div className="cappatex-order-config">
            <label>Menge<select value={quantity} onChange={e => { setQuantity(Number(e.target.value)); setTerms(false); }}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></label>
            <label>Lieferland<select value={country} onChange={e => { setCountry(e.target.value === "LI" ? "LI" : "CH"); setTerms(false); }}><option value="CH">Schweiz</option><option value="LI">Liechtenstein</option></select></label>
            <div><small>{variant.price ? "Artikelpreis · zzgl. Versand" : "Gestaltungsvorschau"}</small><strong>{variant.price ? money(Number(variant.price.amount) * quantity, variant.price.currencyCode) : `${quantity} Artikel ausgewählt`}</strong></div>
          </div>
        </>}
        {error && <p className="cappatex-error" role="alert">{error}</p>}
        <div className="cappatex-ready">
          <label className="legal-consent cappatex-consent"><input type="checkbox" checked={terms} disabled={!product?.purchaseReady || !previewReady || !geometry?.ok} onChange={e => setTerms(e.target.checked)} />
            <span>Motiv und Platzierung sind geprüft. Ich akzeptiere die <Link href="/recht/agb" target="_blank">AGB</Link> und habe die <Link href="/recht/datenschutz" target="_blank">Datenschutzerklärung</Link> gelesen.</span></label>
          <button className="button primary" onClick={checkout} disabled={!product?.purchaseReady || !variant?.price || !checkoutEnabled || !previewReady || !terms || !designId || !geometry?.ok || Boolean(busy)}>
            {busy === "checkout" ? "Checkout wird vorbereitet …" : "Shopify-Checkout vorbereiten →"}</button>
          <p>{product?.blockedReason || (checkoutEnabled ? "Motiv, Variante, Grösse und Position werden unveränderlich gespeichert. Im Shopify-Checkout siehst du Versand und Gesamtpreis."
            : "Bestellungen bleiben bis zum abgeschlossenen Produkt-, Versand- und Checkout-Test gesperrt.")}</p>
        </div>
      </section>
    </div>
  </section>;
}
