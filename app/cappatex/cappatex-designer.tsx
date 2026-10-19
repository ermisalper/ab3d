"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import CappatexPreparationPanel from "./cappatex-preparation-panel";
import GalleryConsent from "../gallery-consent";
import { galleryChoiceValid, newGalleryDraft } from "../gallery-policy";
import { initialPlacement, placementGeometry, type ArtworkSize, type Placement } from "../cappatex-print-profile";
import { maximumPrintSizeCm, printSizeHelp } from "../cappatex-print-size";
import { compositionKey, emptyCompositionDraft, ownedMotif, preparationDesignIds, resumePreparation,
  type CompositionDraft, type OwnedMotif, type WorkingSide } from "../cappatex-resume";
import { hydrateSessionDraft, serializeSessionDraft, sessionDraftDesignIds } from "../cappatex-session-draft";
import { chooseColor, productFrontChoice, type MissingColorChoice } from "../cappatex-designer-choice";
import { knownLegacyMockup, resolveMockupAsset } from "../cappatex-mockup-assets";
import { accountDraftKey, assertDiscardTarget, conflictsWithLocalMotif, inspectLocalDraft, recoveryUrl } from "../cappatex-recovery";
import { parsePreparationResponse } from "../cappatex-preparation-response";
import type { CappatexDesignProduct } from "../cappatex-design-catalog";
import { prepareCustomerImage } from "../cappatex-upload-client";
import { designStateUrl, readDesignState, retainedPlacement, verifiedDesignSelection, rememberConfiguration, rememberedConfiguration, reconcileConfigurations,
  type ProductConfigurations } from "../cappatex-design-state";

const styles = ["Minimal", "Illustrativ", "Retro", "Streetwear"];
const money = (amount: number, currency: string) => new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(amount);
const centimetres = (value: number) => value < .1 ? "<0.1" : new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 }).format(Math.floor(value * 10 + 1e-9) / 10);
type DesignVariant = CappatexDesignProduct["variants"][number];

async function readOwnMotif(id: string) {
  const response = await fetch(`/api/cappatex/designs/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Ein gespeichertes Motiv ist für dein Konto nicht verfügbar. Es wurde nichts neu erstellt.");
  return ownedMotif(await response.json(), id);
}

function photoPrintArea(variant: DesignVariant): CSSProperties {
  const photo = variant.mockup;
  return { left: `${100 * photo.left / photo.width}%`, top: `${100 * photo.top / photo.height}%`,
    width: `${100 * photo.printWidth / photo.width}%`, height: `${100 * photo.printHeight / photo.height}%` };
}

function placedArtwork(variant: DesignVariant, artwork: ArtworkSize, placement: Placement): CSSProperties {
  return { position: "absolute", maxWidth: "none", width: `${placement.scale * 100}%`,
    height: `${100 * placement.scale * variant.area.widthPx / variant.area.heightPx * artwork.height / artwork.width}%`,
    left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, transform: "translate(-50%, -50%)" };
}

function MockupForeground({ variant, src }: { variant: DesignVariant; src: string }) {
  const photo = variant.mockup;
  return <>{photo.foreground?.map((polygon, index) => <img key={index} src={src} alt="" aria-hidden="true"
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none",
      clipPath: `polygon(${polygon.map(([x, y]) => `${100 * x / photo.width}% ${100 * y / photo.height}%`).join(",")})` }} />)}</>;
}

function ProductComparisonCard({ product, variant, placement, image, artwork, previewSize, active, disabled, onSelect }: {
  product: CappatexDesignProduct; variant: DesignVariant; placement: Placement; image: string | null;
  artwork: ArtworkSize; previewSize: ArtworkSize; active: boolean; disabled: boolean; onSelect: () => void;
}) {
  const [loadedPhoto, setLoadedPhoto] = useState("");
  const [loadedMotif, setLoadedMotif] = useState("");
  const [failedPhoto, setFailedPhoto] = useState("");
  const identity = `${product.profileVersion}:${variant.shopifyVariantId}:${variant.mockup.url}`;
  const asset = resolveMockupAsset(variant.mockup);
  const legacy = knownLegacyMockup(variant.mockup);
  const photoSrc = asset.verified ? asset.src : legacy ? variant.mockup.url : null;
  const geometry = placementGeometry(variant.area, artwork, placement);
  return <button type="button" className={`cappatex-product-card${active ? " active" : ""}`} aria-pressed={active}
    disabled={disabled} onClick={onSelect}>
    <span className="cappatex-product-card-photo" style={{ aspectRatio: `${variant.mockup.width}/${variant.mockup.height}` }}>
      {photoSrc && <img key={identity} className="cappatex-card-blank" src={photoSrc} alt="" loading="lazy"
        onLoad={event => { if (event.currentTarget.naturalWidth === variant.mockup.width && event.currentTarget.naturalHeight === variant.mockup.height) {
          setLoadedPhoto(identity); setFailedPhoto("");
        } else { setLoadedPhoto(""); setFailedPhoto(identity); } }}
        onError={() => { setLoadedPhoto(""); setFailedPhoto(identity); }} />}
      {photoSrc && image && loadedPhoto === identity && <span className="cappatex-card-print-area" style={photoPrintArea(variant)}>
        <img key={image} src={image} alt="" style={{ ...placedArtwork(variant, artwork, placement), opacity: loadedMotif === image ? 1 : 0 }}
          onLoad={event => setLoadedMotif(event.currentTarget.naturalWidth === previewSize.width && event.currentTarget.naturalHeight === previewSize.height ? image : "")}
          onError={() => setLoadedMotif("")} />
      </span>}
      {photoSrc && loadedPhoto === identity && <MockupForeground variant={variant} src={photoSrc} />}
    </span>
    <span className="cappatex-product-card-name">{product.name}</span>
    <span className="cappatex-product-card-variant">Vorderseite · {variant.color} · {variant.size}</span>
    <small className={image && !geometry.ok ? "cappatex-card-warning" : "cappatex-card-status"}>
      {!photoSrc ? "Produktfoto noch nicht bestätigt" : failedPhoto === identity ? "Produktfoto nicht verfügbar" : legacy ? "Ältere Anbieteransicht · noch nicht fest bestätigt" : image && !geometry.ok ? "Platzierung prüfen"
        : active ? "Wird angepasst" : "Ansehen & anpassen"}
      {image && geometry.dpi !== undefined && <> · {Math.floor(geometry.dpi)} dpi</>}
    </small>
  </button>;
}

export default function CappatexDesigner() {
  const [products, setProducts] = useState<CappatexDesignProduct[]>([]);
  const [message, setMessage] = useState("Blanko-Produkte werden geprüft …");
  const [generationEnabled, setGenerationEnabled] = useState(false);
  const [pilotOwner, setPilotOwner] = useState(false);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [source, setSource] = useState("prompt");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [imageRights, setImageRights] = useState(false);
  const [uploadedArtwork, setUploadedArtwork] = useState(false);
  const [previewSize, setPreviewSize] = useState<ArtworkSize>({ width: 512, height: 768 });
  const [canDownloadHd, setCanDownloadHd] = useState(false);
  const [accountCanDownloadHd, setAccountCanDownloadHd] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Minimal");
  const [canvas, setCanvas] = useState("portrait");
  const [confirmed, setConfirmed] = useState(false);
  const [galleryChoice,setGalleryChoice]=useState(newGalleryDraft);
  const [image, setImage] = useState<string | null>(null);
  const [artwork, setArtwork] = useState<ArtworkSize>({ width: 2048, height: 3072 });
  const [designId, setDesignId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [side, setSide] = useState<"front" | "back">("front");
  const [photoUrl, setPhotoUrl] = useState("");
  const [selectedPlacement, setPlacement] = useState<Placement | null>(null);
  const [configurations, setConfigurations] = useState<ProductConfigurations>({});
  const [quantity, setQuantity] = useState(1);
  const [country, setCountry] = useState<"CH" | "LI">("CH");
  const [busy, setBusy] = useState("restore");
  const [error, setError] = useState("");
  const [creationError, setCreationError] = useState<{ source: "prompt" | "upload"; message: string } | null>(null);
  const previewPanel = useRef<HTMLElement | null>(null);
  const [loadedArtwork, setLoadedArtwork] = useState("");
  const [loadedBlank, setLoadedBlank] = useState("");
  const [restorationComplete, setRestorationComplete] = useState(false);
  const [selectionNeedsReview, setSelectionNeedsReview] = useState(false);
  const [motifs, setMotifs] = useState<Record<string, OwnedMotif>>({});
  const [drafts, setDrafts] = useState<Record<string, CompositionDraft>>({});
  const [sessionKey, setSessionKey] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [restoreProblem, setRestoreProblem] = useState<{ kind: "load" | "invalid" | "conflict" | "saved"; hasLocalDraft: boolean; pending: boolean;
    preparationId?: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const recoveryRaw = useRef<string | null | undefined>(undefined);
  const [missingColor, setMissingColor] = useState<(MissingColorChoice & { profileId: string; profileVersion: string }) | null>(null);
  const localRecoveryBlocked = Boolean(restoreProblem?.hasLocalDraft);

  const product = products.find(p => p.id === productId) || (selectionNeedsReview ? undefined : products[0]);
  const baseVariant = product?.variants.find(v => v.shopifyVariantId === variantId) || (selectionNeedsReview ? undefined : product?.variants[0]);
  const variant = useMemo(() => baseVariant && side === "back" && baseVariant.back ? { ...baseVariant, ...baseVariant.back } : baseVariant, [baseVariant, side]);
  const configurationProduct = product ? { ...product, id: side === "back" ? `${product.id}:back` : product.id } : undefined;
  const galleryPhoto = baseVariant?.photos?.find(photo => photo.url === photoUrl);
  const placement = useMemo(() => selectedPlacement || (variant ? initialPlacement(variant.area, artwork) : { x: .5, y: .5, scale: .5 }),
    [selectedPlacement, variant, artwork]);
  const geometry = variant ? placementGeometry(variant.area, artwork, placement) : null;
  const printHelp = image && variant ? printSizeHelp(artwork, variant.area) : null;
  const uploadExampleDpi = variant?.area.minDpi || 300;
  const uploadExample = maximumPrintSizeCm({ width: 2048, height: 3072 }, uploadExampleDpi)!;
  const blankIdentity = variant ? `${product?.id}:${product?.profileVersion}:${variant.shopifyVariantId}:${variant.mockup.url}` : "";
  const blankAsset = variant ? resolveMockupAsset(variant.mockup) : null;
  const legacyBlank = Boolean(variant && knownLegacyMockup(variant.mockup));
  const blankSrc = blankAsset?.verified ? blankAsset.src : legacyBlank ? variant!.mockup.url : null;
  const previewReady = Boolean(image && loadedArtwork === image && variant && blankSrc && loadedBlank === blankIdentity);
  const draftKey = product && baseVariant ? compositionKey(product.id, product.profileVersion, baseVariant.shopifyVariantId) : "";
  const storedDraft = useMemo(() => drafts[draftKey] || emptyCompositionDraft(), [drafts, draftKey]);
  const currentDraft: CompositionDraft = useMemo(() => designId ? { ...storedDraft,
    working: { ...storedDraft.working, [side]: { designId, placement: { ...placement } } } } : storedDraft, [storedDraft, designId, side, placement]);
  const galleryHint = !galleryChoice.visibility ? "Bitte wähle, ob dein Motiv privat bleibt oder für die Galerie vorgeschlagen wird."
    : galleryChoice.visibility === "public" && !galleryChoice.rightsConfirmed ? "Bitte bestätige die Rechte für die Galerie."
    : !galleryChoiceValid(galleryChoice, "cappatex") ? "Bitte vervollständige die Angaben für deine Sammlung." : "";
  const generationHint = busy === "restore" ? "Dein Studio wird geladen …"
    : !generationEnabled ? "Die KI-Erstellung ist für dein Konto noch nicht freigegeben."
    : busy === "generation" ? "Dein Motiv entsteht. Bitte lasse diese Seite geöffnet."
    : busy ? "Bitte warte, bis der aktuelle Vorgang abgeschlossen ist."
    : prompt.trim().length < 12 ? "Beschreibe deine Idee mit mindestens 12 Zeichen."
    : galleryHint || (!confirmed ? "Bitte bestätige vor der Erstellung die angezeigten Kosten." : "Alles bereit – du kannst dein Motiv erstellen.");
  const uploadHint = busy === "restore" ? "Dein Studio wird geladen …"
    : !uploadEnabled ? "Der Bild-Upload ist für dein Konto noch nicht freigegeben."
    : busy === "upload" ? "Dein Bild wird geprüft und gespeichert …"
    : busy ? "Bitte warte, bis der aktuelle Vorgang abgeschlossen ist."
    : !uploadFile ? "Wähle zuerst eine PNG- oder JPG-Datei."
    : !imageRights ? "Bitte bestätige, dass du dein Bild verwenden und bedrucken lassen darfst."
    : galleryHint || "Alles bereit – du kannst dein Bild übernehmen.";

  function showProductPreview() {
    window.requestAnimationFrame(() => {
      const panel = previewPanel.current;
      if (!panel) return;
      panel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      panel.focus({ preventScroll: true });
    });
  }

  const showMotif = useCallback((motif: OwnedMotif, nextPlacement: Placement | null) => {
    setImage(motif.previewUrl); setDesignId(motif.designId); setArtwork({ width: motif.width, height: motif.height });
    setPreviewSize({ width: motif.previewWidth, height: motif.previewHeight }); setUploadedArtwork(motif.source === "upload");
    setCanDownloadHd(motif.canDownloadOriginal); setLoadedArtwork(current => current === motif.previewUrl ? current : "");
    setPlacement(nextPlacement); setPhotoUrl("");
  }, []);

  useEffect(() => {
    let active = true;
    async function restore() {
      const query = new URLSearchParams(window.location.search), restored = readDesignState(window.location.search);
      const [catalogResponse, account] = await Promise.all([
        fetch("/api/cappatex/catalog", { cache: "no-store", signal: AbortSignal.timeout(30_000) }).catch(() => null),
        fetch("/api/account", { cache: "no-store", signal: AbortSignal.timeout(30_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (!active) return;
      setGenerationEnabled(account?.account?.cappatexGeneration?.enabled === true); setPilotOwner(account?.account?.cappatexGeneration?.pilotOwner === true);
      setUploadEnabled(account?.account?.cappatexUpload?.enabled === true); setCanDownloadHd(account?.account?.capabilities?.canDownloadHd === true);
      setAccountCanDownloadHd(account?.account?.capabilities?.canDownloadHd === true);
      let storageKey = "", inspection: ReturnType<typeof inspectLocalDraft> = { kind: "empty", reference: null };
      if (typeof account?.account?.email === "string" && account.account.email) {
        storageKey = await accountDraftKey(account.account.email);
        try { recoveryRaw.current = window.sessionStorage.getItem(storageKey); inspection = inspectLocalDraft(recoveryRaw.current); }
        catch { setSessionNotice("Dein Browser erlaubt keine Sitzungssicherung. Speichere die Druckseiten vor dem Verlassen dieser Seite."); }
        if (!active) return;
        setSessionKey(storageKey);
      }
      const recovery = { kind: "load" as const, hasLocalDraft: inspection.kind !== "empty", pending: Boolean(inspection.reference?.pendingSignature) };
      if (recovery.hasLocalDraft) setRestoreProblem({ ...recovery, kind: inspection.kind === "invalid" ? "invalid" : "load" });
      if (!catalogResponse?.ok) {
        setMessage("Die Blanko-Produkte sind vorübergehend nicht erreichbar. Produktwahl und Druckvorbereitung bleiben gesperrt.");
        setRestoreProblem({ ...recovery, kind: inspection.kind === "invalid" ? "invalid" : "load" });
        throw new Error("Der Produktkatalog konnte nicht bestätigt werden. Bereits freigegebene Motiv-Erstellung und Bildupload bleiben verfügbar; es wird nichts automatisch erstellt.");
      }
      const data = await catalogResponse.json(), catalogProducts: CappatexDesignProduct[] = Array.isArray(data.products) ? data.products : [];
      if (!active) return;
      setProducts(catalogProducts); setMessage(data.message || "Die Blanko-Produkte sind derzeit nicht verfügbar.");
      if (inspection.kind === "invalid" && !/^CPP-[a-f0-9]{32}$/.test(query.get("preparationId") || "")) {
        setRestoreProblem({ ...recovery, kind: "invalid" });
        throw new Error("Der lokale Tab-Entwurf ist beschädigt oder verwendet ein älteres Format. Er wird nicht automatisch überschrieben.");
      }
      const reference = inspection.reference;
      const intendedSide = reference && !restored.profileId ? reference.side : restored.side || "front";
      if (reference && !query.has("preparationId") && conflictsWithLocalMotif(reference, restored.designId, intendedSide)) {
        setRestoreProblem({ ...recovery, kind: "conflict" });
        throw new Error("Du hast ein anderes Motiv geöffnet. Im Tab liegt noch ein Entwurf mit eigenen Druckseiten. Wähle zuerst, welchen Stand du weiterbearbeiten möchtest.");
      }
      if (query.get("resume") === "1") {
        const id = query.get("preparationId") || "";
        if (!/^CPP-[a-f0-9]{32}$/.test(id)) throw new Error("Der Verweis auf die gespeicherten Druckseiten ist ungültig.");
        const response = await fetch(`/api/cappatex/preparations/${id}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new Error("Dieser gespeicherte Stand ist für dein Konto nicht verfügbar.");
        const preparation = parsePreparationResponse(await response.json(), id);
        const own = await Promise.all(preparationDesignIds(preparation).map(readOwnMotif));
        const verified = Object.fromEntries(own.map(motif => [motif.designId, motif]));
        if (inspection.kind === "invalid") {
          setRestoreProblem({ ...recovery, kind: "saved", preparationId: id });
          throw new Error("Der gespeicherte Stand und seine eigenen Motive wurden gelesen. Bevor du ihn als Kopie öffnest, entscheide bitte über den vorhandenen lokalen Tab-Entwurf. Dieser wird nicht automatisch ersetzt.");
        }
        const copy = resumePreparation(preparation, catalogProducts, verified, crypto.randomUUID());
        if (!active) return;
        setMotifs(verified); setProductId(copy.profileId); setVariantId(copy.variantId); setQuantity(copy.quantity); setCountry(copy.country); setSide(copy.side);
        setDrafts({ [compositionKey(copy.profileId, copy.profileVersion, copy.variantId)]: copy.draft });
        const working = copy.draft.working[copy.side]!; showMotif(verified[working.designId], working.placement);
        setSelectionNeedsReview(false); setMessage("Deine gespeicherten Druckseiten sind als neue Kopie geladen. Das Original bleibt unverändert.");
        const product = catalogProducts.find(p => p.id === copy.profileId)!, variant = product.variants.find(v => v.shopifyVariantId === copy.variantId)!;
        if (storageKey) try { window.sessionStorage.setItem(storageKey, serializeSessionDraft(product, variant, copy.draft, verified, copy.quantity, copy.country, copy.side)); }
        catch { setSessionNotice("Die Kopie ist im offenen Tab geladen. Die Sitzungssicherung ist nicht verfügbar; speichere vor dem Verlassen."); }
        const consumed = new URL(window.location.href); consumed.searchParams.delete("resume"); window.history.replaceState(window.history.state, "", consumed);
      } else if (reference && (!query.has("preparationId") || query.get("preparationId") === reference.receiptId || query.get("preparationId") === reference.copyOf)
        && (!restored.profileId || restored.profileId === reference.profileId)
        && (!restored.variantId || restored.variantId === reference.variantId)) {
        if (conflictsWithLocalMotif(reference, restored.designId, intendedSide)) {
          setRestoreProblem({ ...recovery, kind: "conflict" });
          throw new Error("Du hast ein anderes Motiv geöffnet. Im Tab liegt noch ein Entwurf mit eigenen Druckseiten. Wähle zuerst, welchen Stand du weiterbearbeiten möchtest.");
        }
        const ids = [...new Set([...sessionDraftDesignIds(reference), ...(restored.designId ? [restored.designId] : [])])];
        const own = await Promise.all(ids.map(readOwnMotif)), verified = Object.fromEntries(own.map(motif => [motif.designId, motif]));
        const loaded = hydrateSessionDraft(reference, catalogProducts, verified);
        const activeSide = restored.profileId ? restored.side || "front" : reference.side;
        if (activeSide === "back" && !loaded.variant.back) throw new Error("Die Rückseite dieses Entwurfs ist nicht mehr verfügbar.");
        const working = loaded.draft.working[activeSide];
        if (!working) throw new Error("Die aktive Druckseite des Entwurfs ist unvollständig.");
        if (restored.designId) {
          const motif = verified[restored.designId], area = activeSide === "back" && loaded.variant.back ? loaded.variant.back.area : loaded.variant.area;
          loaded.draft.working[activeSide] = { designId: motif.designId, placement: restored.placement || (motif.designId === working.designId
            ? working.placement : initialPlacement(area, motif)) };
        }
        if (reference.receiptId) {
          const response = await fetch(`/api/cappatex/preparations/${reference.receiptId}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
          if (response.ok) {
            const receipt = parsePreparationResponse(await response.json(), reference.receiptId);
            if (receipt.profileId === loaded.product.id && receipt.profileVersion === loaded.product.profileVersion
              && receipt.variant.shopifyVariantId === loaded.variant.shopifyVariantId) {
              loaded.draft.receipt = receipt;
              loaded.draft.savedSignature = JSON.stringify({ profileId: receipt.profileId, profileVersion: receipt.profileVersion,
                shopifyVariantId: receipt.variant.shopifyVariantId, quantity: receipt.quantity, country: receipt.country,
                sides: receipt.sides.map(s => ({ position: s.position, designId: s.designId, placement: s.placement })) });
            }
          }
        }
        if (!active) return;
        setMotifs(verified); setProductId(loaded.product.id); setVariantId(loaded.variant.shopifyVariantId);
        setSide(activeSide); setQuantity(query.has("quantity") ? restored.quantity : reference.quantity); setCountry(query.has("country") ? restored.country : reference.country);
        setDrafts({ [loaded.key]: loaded.draft }); const current = loaded.draft.working[activeSide]!; showMotif(verified[current.designId], current.placement);
        setSelectionNeedsReview(false); setMessage("Dein Tab-Entwurf wurde nach erneuter Konto- und Profilprüfung wiederhergestellt. Dauerhaft gespeichert sind nur ausdrücklich gespeicherte Druckseiten.");
      } else if (query.has("preparationId")) {
        const id = query.get("preparationId") || "";
        if (!/^CPP-[a-f0-9]{32}$/.test(id)) throw new Error("Der Verweis auf den gespeicherten Stand ist ungültig.");
        const response = await fetch(`/api/cappatex/preparations/${id}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new Error("Der gespeicherte Stand ist für dein Konto nicht verfügbar.");
        const receipt = parsePreparationResponse(await response.json(), id);
        const own = await Promise.all([...new Set([...preparationDesignIds(receipt), ...(restored.designId ? [restored.designId] : [])])].map(readOwnMotif));
        const verified = Object.fromEntries(own.map(motif => [motif.designId, motif]));
        if (inspection.kind === "invalid") {
          setRestoreProblem({ ...recovery, kind: "saved", preparationId: id });
          throw new Error("Der gespeicherte Stand und seine eigenen Motive wurden gelesen. Der vorhandene lokale Tab-Entwurf bleibt geschützt, bis du entscheidest, welchen Stand du weiterbearbeitest.");
        }
        const copy = resumePreparation(receipt, catalogProducts, verified, crypto.randomUUID());
        copy.draft.receipt = receipt; copy.draft.savedSignature = JSON.stringify({ profileId: receipt.profileId, profileVersion: receipt.profileVersion,
          shopifyVariantId: receipt.variant.shopifyVariantId, quantity: receipt.quantity, country: receipt.country,
          sides: receipt.sides.map(s => ({ position: s.position, designId: s.designId, placement: s.placement })) });
        delete copy.draft.copyOf;
        if (!active) return;
        setMotifs(verified); setProductId(copy.profileId); setVariantId(copy.variantId); setQuantity(copy.quantity); setCountry(copy.country); setSide(copy.side);
        setDrafts({ [compositionKey(copy.profileId, copy.profileVersion, copy.variantId)]: copy.draft });
        const current = copy.draft.working[copy.side]!; showMotif(verified[current.designId], current.placement);
        setMessage("Der gespeicherte Stand ist geladen. Nicht gespeicherte Änderungen waren ohne Sitzungssicherung nicht wiederherstellbar.");
      } else {
        const selection = verifiedDesignSelection(restored, catalogProducts);
        const motif = restored.designId ? await readOwnMotif(restored.designId) : null;
        if (!active) return;
        setQuantity(restored.quantity); setCountry(restored.country); setProductId(selection.profileId); setVariantId(selection.variantId);
        setSide(selection.side); setPlacement(selection.placement || null); setSelectionNeedsReview(selection.requiresSelection);
        setConfigurations(reconcileConfigurations(catalogProducts, restored.configurations || {}));
        if (selection.requiresSelection) setError("Die gespeicherte Produktvariante ist nicht mehr verfügbar oder das Druckprofil wurde geändert. Bitte wähle Produkt und Variante erneut.");
        if (motif) { setMotifs({ [motif.designId]: motif }); showMotif(motif, selection.placement || null); }
      }
      if (active) setRestoreProblem(null);
    }
    restore().catch(caught => { if (active) { setRestoreProblem(current => current || { kind: "load", hasLocalDraft: false, pending: false }); setSelectionNeedsReview(true); setError(caught instanceof Error ? caught.message : "Der Gestaltungsstand konnte nicht sicher geladen werden."); } })
      .finally(() => { if (active) { setBusy(""); setRestorationComplete(true); } });
    return () => { active = false; };
  }, [showMotif]);

  useEffect(() => {
    if (!restorationComplete || !sessionKey || localRecoveryBlocked || selectionNeedsReview || !product || !baseVariant || !designId) return;
    try { window.sessionStorage.setItem(sessionKey, serializeSessionDraft(product, baseVariant, currentDraft, motifs, quantity, country, side)); }
    catch { /* A blocked/full session store must never stop explicit server-side saving. */ }
  }, [restorationComplete, sessionKey, localRecoveryBlocked, selectionNeedsReview, product, baseVariant, designId, currentDraft, motifs, quantity, country, side]);

  useEffect(() => {
    if (!restorationComplete || !designId || selectionNeedsReview) return;
    const url = designStateUrl(window.location.href, { designId, profileId: product?.id || productId,
      variantId: variant?.shopifyVariantId || variantId, placement, quantity, country, side,
      configurations: product && variant ? rememberConfiguration(configurations, { ...product, id: side === "back" ? `${product.id}:back` : product.id }, variant.shopifyVariantId, placement) : configurations });
    window.history.replaceState(window.history.state, "", url);
  }, [restorationComplete, selectionNeedsReview, designId, product, productId, variant, variantId, placement, quantity, country, configurations, side]);

  function recheckStudio(action: "retry" | "local" = "retry") {
    if (busy) return;
    setBusy("restore");
    const target = recoveryUrl(window.location.href, action, motifs[designId]?.designId || "");
    window.history.replaceState(window.history.state, "", target);
    window.location.reload();
  }

  async function discardLocalDraft() {
    if (busy || !confirmDiscard || !sessionKey || !restoreProblem?.hasLocalDraft || recoveryRaw.current === undefined || recoveryRaw.current === null) return;
    setBusy("recovery");
    try {
      const response = await fetch("/api/account", { cache: "no-store", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error("Dein aktuelles Konto konnte nicht bestätigt werden. Der lokale Entwurf bleibt erhalten.");
      const account = await response.json();
      assertDiscardTarget(sessionKey, await accountDraftKey(account?.account?.email), recoveryRaw.current, window.sessionStorage.getItem(sessionKey));
      window.sessionStorage.removeItem(sessionKey);
      const target = recoveryUrl(window.location.href, "retry", motifs[designId]?.designId || "");
      window.history.replaceState(window.history.state, "", target);
      window.location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Der lokale Entwurf konnte nicht verworfen werden. Es wurde nichts gelöscht."); setBusy(""); }
  }

  function rememberDraft() {
    return draftKey && designId ? { ...drafts, [draftKey]: currentDraft } : drafts;
  }

  function selectDraftLink(draft: CompositionDraft) {
    const url = new URL(window.location.href), id = draft.receipt?.id || draft.copyOf;
    if (id) url.searchParams.set("preparationId", id); else url.searchParams.delete("preparationId");
    url.searchParams.delete("resume"); window.history.replaceState(window.history.state, "", url);
  }

  function selectProduct(nextProduct: CappatexDesignProduct) {
    if (localRecoveryBlocked) { setError("Bitte entscheide zuerst, ob du den lokalen Tab-Entwurf erneut prüfst oder verwirfst."); return; }
    const updated = product && variant && !selectionNeedsReview
      ? rememberConfiguration(configurations, configurationProduct!, variant.shopifyVariantId, placement) : configurations;
    const saved = rememberedConfiguration(nextProduct, updated);
    const remembered = rememberDraft();
    const choice = productFrontChoice(nextProduct, nextProduct.id === product?.id ? baseVariant?.shopifyVariantId : saved?.variantId,
      remembered, motifs, { motif: motifs[designId] || null, artwork, placement: saved?.placement });
    if (!choice.ok) { setError(choice.reason); return; }
    const next = choice.variant, key = compositionKey(nextProduct.id, nextProduct.profileVersion, next.shopifyVariantId);
    const target = remembered[key] || emptyCompositionDraft();
    const working = choice.motif ? { designId: choice.motif.designId, placement: choice.placement } : undefined;
    setDrafts({ ...remembered, [key]: { ...target, working: { ...target.working, ...(working ? { front: working } : {}) } } });
    selectDraftLink(target);
    setConfigurations(updated); setProductId(nextProduct.id); setVariantId(next.shopifyVariantId); setSide("front"); setPhotoUrl("");
    if (working) showMotif(motifs[working.designId], working.placement); else setPlacement(saved?.placement || null);
    setSelectionNeedsReview(false); setMissingColor(null); setError("");
  }

  function selectVariant(nextProduct: CappatexDesignProduct, nextId: string) {
    if (localRecoveryBlocked) return;
    const matches = nextProduct.variants.filter(v => v.shopifyVariantId === nextId), next = matches[0];
    if (matches.length !== 1 || !next || next.available !== true) { setError("Die gewählte Variante ist nicht eindeutig verfügbar. Deine bisherige Auswahl bleibt erhalten."); return; }
    setMissingColor(null);
    const remembered = rememberDraft(), key = compositionKey(nextProduct.id, nextProduct.profileVersion, next.shopifyVariantId);
    const nextSide = side === "back" && !next.back ? "front" : side;
    const target = remembered[key] || { ...emptyCompositionDraft(), working: next.back ? { ...currentDraft.working }
      : { ...(currentDraft.working.front ? { front: currentDraft.working.front } : {}) } };
    const working = target.working[nextSide] || (designId ? { designId,
      placement: retainedPlacement(product?.id, nextProduct.id, placement) || initialPlacement(nextSide === "back" && next.back ? next.back.area : next.area, artwork) } : undefined);
    if (working && !motifs[working.designId]) { setError("Das Motiv dieses Entwurfs muss erneut für dein Konto geladen werden."); return; }
    setDrafts({ ...remembered, [key]: { ...target, working: { ...target.working, ...(working ? { [nextSide]: working } : {}) } } });
    selectDraftLink(target);
    setProductId(nextProduct.id); setVariantId(next.shopifyVariantId); setPhotoUrl("");
    setSide(nextSide);
    const nextPlacement = working?.placement || null;
    setPlacement(nextPlacement);
    if (working) showMotif(motifs[working.designId], working.placement);
    setConfigurations(current => rememberConfiguration(current, { ...nextProduct, id: nextSide === "back" ? `${nextProduct.id}:back` : nextProduct.id }, next.shopifyVariantId,
      nextPlacement || initialPlacement(nextSide === "back" && next.back ? next.back.area : next.area, artwork)));
    setSelectionNeedsReview(false); setError(nextSide !== side ? "Für diese Variante ist nur die Vorderseite geprüft. Der bisherige Entwurf mit Rückseite bleibt bei seiner ursprünglichen Variante erhalten."
      : "Farbe oder Grösse gewechselt: Motive und Positionen bleiben erhalten. Prüfe die neue Druckfläche und übernimm die gewünschten Seiten erneut.");
  }
  function selectSide(nextSide: "front" | "back") {
    if (!product || !baseVariant || !variant || (nextSide === "back" && !baseVariant.back)) return;
    const updated = rememberConfiguration(configurations, configurationProduct!, variant.shopifyVariantId, placement);
    const target = { ...product, id: nextSide === "back" ? `${product.id}:back` : product.id };
    const saved = rememberedConfiguration(target, updated);
    const remembered = rememberDraft(), targetDraft = remembered[draftKey] || emptyCompositionDraft();
    const area = nextSide === "back" && baseVariant.back ? baseVariant.back.area : baseVariant.area;
    const working: WorkingSide | undefined = targetDraft.working[nextSide] || (designId ? { designId,
      placement: saved?.variantId === variant.shopifyVariantId ? saved.placement : initialPlacement(area, artwork) } : undefined);
    if (working && !motifs[working.designId]) { setError("Das Motiv dieser Druckseite ist für dein Konto noch nicht bestätigt."); return; }
    setDrafts({ ...remembered, [draftKey]: { ...targetDraft, working: { ...targetDraft.working, ...(working ? { [nextSide]: working } : {}) } } });
    setConfigurations(updated); setSide(nextSide); setPhotoUrl("");
    if (working) showMotif(motifs[working.designId], working.placement);
    else setPlacement(saved?.variantId === variant.shopifyVariantId ? saved.placement : null);
    setError("");
  }
  async function generate() {
    if (!confirmed || !generationEnabled || busy || !galleryChoiceValid(galleryChoice,"cappatex")) return;
    setBusy("generation"); setError(""); setCreationError(null);
    try {
      const response = await fetch("/api/cappatex", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, canvas, confirmGeneration: confirmed,galleryChoice }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Das Motiv konnte nicht erstellt werden.");
      const motif = ownedMotif({ ...data, previewUrl: data.image, source: "generated", canDownloadOriginal: accountCanDownloadHd,
        previewWidth: data.previewWidth ?? Math.ceil(data.width / 4), previewHeight: data.previewHeight ?? Math.ceil(data.height / 4) }, data.designId);
      setMotifs(current => ({ ...current, [motif.designId]: motif }));
      const nextPlacement = variant ? initialPlacement(variant.area, motif) : null;
      showMotif(motif, nextPlacement);
      if (draftKey && nextPlacement) setDrafts({ ...rememberDraft(), [draftKey]: { ...currentDraft,
        working: { ...currentDraft.working, [side]: { designId: motif.designId, placement: nextPlacement } } } });
      setGalleryChoice(newGalleryDraft());setConfirmed(false);
      setPreviewSize({ width: data.previewWidth ?? Math.ceil(data.width / 4), height: data.previewHeight ?? Math.ceil(data.height / 4) });
      setUploadedArtwork(false); setLoadedArtwork(""); setPhotoUrl("");
      showProductPreview();
    } catch (caught) { setCreationError({ source: "prompt", message: caught instanceof Error ? caught.message : "Bilddienst nicht erreichbar." }); }
    finally { setBusy(""); }
  }
  async function upload() {
    if (!uploadFile || !imageRights || !uploadEnabled || busy || !galleryChoiceValid(galleryChoice,"cappatex")) return;
    setBusy("upload"); setError(""); setCreationError(null);
    try {
      const file = await prepareCustomerImage(uploadFile);
      const response = await fetch("/api/cappatex/upload", { method: "POST", headers: { "Content-Type": "image/png", "X-Cappatex-Image-Rights": "confirmed","X-Gallery-Choice":encodeURIComponent(JSON.stringify(galleryChoice)) }, body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Das Bild konnte nicht gespeichert werden.");
      const motif = ownedMotif({ ...data, previewUrl: data.image, source: "upload", canDownloadOriginal: true }, data.designId);
      setMotifs(current => ({ ...current, [motif.designId]: motif }));
      const nextPlacement = variant ? initialPlacement(variant.area, motif) : null;
      showMotif(motif, nextPlacement);
      if (draftKey && nextPlacement) setDrafts({ ...rememberDraft(), [draftKey]: { ...currentDraft,
        working: { ...currentDraft.working, [side]: { designId: motif.designId, placement: nextPlacement } } } });
      setGalleryChoice(newGalleryDraft());
      setPreviewSize({ width: data.previewWidth, height: data.previewHeight });
      setUploadedArtwork(true); setLoadedArtwork(""); setPhotoUrl("");
      showProductPreview();
    } catch (caught) { setCreationError({ source: "upload", message: caught instanceof Error ? caught.message : "Das Bild konnte nicht verarbeitet werden." }); }
    finally { setBusy(""); }
  }
  return <section className="cappatex-flow" id="studio">
    <div className="cappatex-flow-intro"><p className="eyebrow">Selbst gestalten</p><h2>Erst dein Motiv.<br />Dann dein Einzelstück.</h2>
      <p>Gestalte ein Motiv, wähle deinen Blanko-Artikel und prüfe den Druck vor der Bestellung.</p></div>
    <ol className="cappatex-flow-steps" aria-label="Deine Gestaltung in drei Schritten">
      <li><a href="#cappatex-motif"><span>1</span><b>Motiv erstellen</b><small>KI oder eigenes Bild</small></a></li>
      <li><a href="#cappatex-product"><span>2</span><b>Produkt gestalten</b><small>Farbe, Grösse & Druckseite</small></a></li>
      <li><a href="#cappatex-save"><span>3</span><b>Prüfen & speichern</b><small>Deinen Stand sichern</small></a></li>
    </ol>
    {restoreProblem && <section className="cappatex-profile-note" aria-labelledby="cappatex-recovery-heading">
      <h3 id="cappatex-recovery-heading">Deinen Gestaltungsstand sicher laden</h3>
      <p>{restoreProblem.kind === "invalid" ? "Der lokale Tab-Entwurf ist beschädigt oder stammt aus einem älteren Format. Sein Inhalt bleibt bis zu deiner Entscheidung unverändert."
        : restoreProblem.kind === "conflict" ? "Ein anderes Motiv wurde geöffnet. Dein bisheriger lokaler Entwurf mit seinen Druckseiten wird nicht automatisch ersetzt."
        : restoreProblem.kind === "saved" ? "Dein gespeicherter Stand und seine Motive sind für dieses Konto lesbar. Die lokale Sicherung ist beschädigt oder stammt aus einem älteren Format; sie wird nicht automatisch ersetzt."
        : "Katalog, Konto oder gespeicherte Quellen konnten nicht vollständig geprüft werden. Du kannst die Ladeprüfung wiederholen."}</p>
      <p>„Erneut prüfen“ lädt Katalog, Konto und Quellen neu. Es erstellt kein Motiv und sendet keine Speicheranfrage.</p>
      {restoreProblem.pending && <p role="status"><strong>Der Ausgang einer früheren Speicherung ist möglicherweise noch unklar.</strong> Die bisherige Anfrage-ID bleibt bei „Erneut prüfen“ erhalten.
        Eine unveränderte Speicherung wird erst mit deinem ausdrücklichen Klick auf „Druckseiten & Dateien speichern“ erneut angefragt.</p>}
      <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => recheckStudio()}>Erneut prüfen</button>
      {restoreProblem.kind === "conflict" && <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => recheckStudio("local")}>Bisherigen Tab-Entwurf öffnen</button>}
      {restoreProblem.preparationId && <p><Link className="text-link" href={`/cappatex/vorbereitung/${restoreProblem.preparationId}`}>Diesen gespeicherten Stand ansehen →</Link></p>}
      {restoreProblem.hasLocalDraft && sessionKey && !confirmDiscard && <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => setConfirmDiscard(true)}>Nur lokalen Tab-Entwurf verwerfen</button>}
      {confirmDiscard && <div role="group" aria-label="Lokales Verwerfen bestätigen">
        <p>Wirklich nur diesen lokalen Tab-Entwurf verwerfen? Nicht gespeicherte Druckseiten und Platzierungen gehen dabei verloren.
          Deine dauerhaft gespeicherten Motive und Druckvorbereitungen bleiben erhalten.</p>
        {restoreProblem.pending && <p>Eine möglicherweise bereits gespeicherte Druckvorbereitung bleibt bestehen. Prüfe deine gespeicherten Stände, bevor du dieselben Seiten als neue Zusammenstellung speicherst.</p>}
        <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={discardLocalDraft}>Ja, nur lokalen Tab-Entwurf verwerfen</button>
        <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => setConfirmDiscard(false)}>Abbrechen und Entwurf behalten</button>
      </div>}
      <p><Link className="text-link" href="/cappatex/gestaltungen">Gespeicherte Druckvorbereitungen ansehen →</Link>{" "}
        <Link className="text-link" href="/cappatex/sammlung">Gespeicherte Motive ansehen →</Link></p>
    </section>}
    <section className="cappatex-comparison" aria-labelledby="cappatex-compare-heading">
      <div className="cappatex-comparison-heading"><h3 id="cappatex-compare-heading">Produkte vergleichen</h3>
        <p>{image ? "Jede Karte zeigt den Vorderseiten-Entwurf, der bei der Auswahl geöffnet wird. Produkte behalten ihre eigenen Motive und Platzierungen."
          : "Wähle ein Blanko. Sobald dein Motiv bereit ist, erscheint es hier auf jedem verfügbaren Produkt."}</p></div>
      <p className="cappatex-catalog-state" role="status">{message}</p>
      <div className="cappatex-products">{products.map(item => {
        const saved = rememberedConfiguration(item, configurations);
        const choice = productFrontChoice(item, item.id === product?.id ? baseVariant?.shopifyVariantId : saved?.variantId,
          draftKey && designId ? { ...drafts, [draftKey]: currentDraft } : drafts, motifs,
          { motif: motifs[designId] || null, artwork, placement: saved?.placement });
        if (!choice.ok) return <p className="cappatex-action-hint" key={item.id}>{item.name}: {choice.reason}</p>;
        const cardMotif = choice.motif;
        const isActive = product?.id === item.id && side === "front" && baseVariant?.shopifyVariantId === choice.variant.shopifyVariantId;
        return <ProductComparisonCard key={item.id} product={item} variant={choice.variant} placement={choice.placement}
          image={cardMotif?.previewUrl || null} artwork={cardMotif ? { width: cardMotif.width, height: cardMotif.height } : artwork}
          previewSize={cardMotif ? { width: cardMotif.previewWidth, height: cardMotif.previewHeight } : previewSize}
          active={isActive} disabled={Boolean(busy) || localRecoveryBlocked} onSelect={() => selectProduct(item)} />;
      })}</div>
      {!products.length && <a className="text-link" href="#kollektion">Fertige Motive im Katalog ansehen →</a>}
    </section>
    <div className={`cappatex-workspace${image ? " has-artwork" : ""}`}>
      <div className="cappatex-controls">
        <section className="cappatex-step" id="cappatex-motif" aria-labelledby="cappatex-motif-heading">
          <div className="cappatex-step-heading"><span>1</span><div><h3 id="cappatex-motif-heading">Dein Motiv</h3><p>Was möchtest du tragen?</p></div></div>
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
          <GalleryConsent studio="cappatex" value={galleryChoice} onChange={setGalleryChoice} disabled={Boolean(busy)}/>
          <label className="legal-consent cappatex-consent"><input type="checkbox" checked={confirmed} disabled={!generationEnabled} onChange={e => setConfirmed(e.target.checked)} />
            <span>{pilotOwner ? "Ein Testmotiv als Betreiber erstellen. Es entstehen OpenAI-API-Kosten; kein Design-Token wird abgezogen." : "Ein Motiv für 1 Design-Token erstellen."}</span></label>
          <p className="cappatex-action-hint" id="cappatex-generation-hint" role="status">{generationHint}</p>
          {creationError?.source === "prompt" && <p className="cappatex-error cappatex-action-error" role="alert">{creationError.message}</p>}
          <button className="button primary cappatex-generate" aria-describedby="cappatex-generation-hint" onClick={generate} disabled={!confirmed || !generationEnabled || prompt.trim().length < 12 || Boolean(busy) || !galleryChoiceValid(galleryChoice,"cappatex")}>
            {busy === "generation" ? "Motiv wird erstellt …" : "Motiv erstellen"}</button>
          <p className="cappatex-wait-note">{generationEnabled ? "Die Vorschau ist eine verkleinerte Ansicht deiner Druckdatei. Es gibt keine automatische zweite Generierung."
            : "Die KI-Generierung wartet auf den freigegebenen Test. Du kannst deine Idee bereits formulieren; es entstehen keine API-Kosten."}</p>
          </> : <div className="cappatex-upload">
            <label className="cappatex-field">Bild auswählen<input type="file" accept="image/png,image/jpeg" disabled={Boolean(busy)} onChange={e => { setUploadFile(e.target.files?.[0] || null); setImageRights(false); setError(""); setCreationError(null); }} /></label>
            <p>PNG oder JPG, bis 12 MB und 6,29 Megapixel. Als Grössenvergleich: 2048 × 3072 Pixel reichen bei {uploadExampleDpi} dpi für höchstens {centimetres(uploadExample.maxWidthCm)} × {centimetres(uploadExample.maxHeightCm)} cm Motivgrösse.
              Grosse Druckflächen können damit nur teilweise bedeckt werden. Nach der Übernahme siehst du die Druckgrössen-Hilfe für deine Datei.
              Dein Bild wird ohne KI-Bearbeitung und ohne Verkleinerung als PNG-Druckdatei gespeichert.</p>
            <label className="legal-consent cappatex-consent"><input type="checkbox" checked={imageRights} onChange={e => setImageRights(e.target.checked)} />
              <span>Ich darf dieses Bild verwenden und bedrucken lassen.</span></label>
            <GalleryConsent studio="cappatex" value={galleryChoice} onChange={setGalleryChoice} disabled={Boolean(busy)}/>
            <p className="cappatex-action-hint" id="cappatex-upload-hint" role="status">{uploadHint}</p>
            {creationError?.source === "upload" && <p className="cappatex-error cappatex-action-error" role="alert">{creationError.message}</p>}
            <button className="button primary cappatex-generate" aria-describedby="cappatex-upload-hint" onClick={upload} disabled={!uploadFile || !imageRights || !uploadEnabled || Boolean(busy) || !galleryChoiceValid(galleryChoice,"cappatex")}>{busy === "upload" ? "Bild wird geprüft …" : "Eigenes Bild übernehmen"}</button>
            <p className="cappatex-wait-note">{uploadEnabled ? "Keine KI-Kosten und kein Design-Token. Bis zu zehn Upload-Versuche innerhalb von 24 Stunden."
              : "Der Upload ist noch nicht freigegeben. Für den Test ist ein angemeldetes Betreiberkonto erforderlich."}</p>
          </div>}
        </section>
      </div>
      <section className="cappatex-preview-panel" id="cappatex-product" ref={previewPanel} tabIndex={-1} aria-labelledby="cappatex-product-heading">
        <div className="cappatex-preview-head"><div><small>2 · Produkt & Platzierung</small><h3 id="cappatex-product-heading">{product?.name || "Dein Motiv"}</h3></div>
          {variant && <b>{variant.price ? money(Number(variant.price.amount), variant.price.currencyCode) : "Preis noch nicht freigegeben"}</b>}</div>
        {product && variant && <div className="cappatex-variant-fields">
          <label className="cappatex-field">{product.optionLabel || "Farbe"}<select disabled={Boolean(busy)} value={variant.color} onChange={e => {
            const choice = chooseColor(product, e.target.value, variant.size);
            if (!choice.ok) { setMissingColor({ ...choice, profileId: product.id, profileVersion: product.profileVersion }); setError(choice.reason); return; }
            selectVariant(product, choice.variant.shopifyVariantId);
          }}>{[...new Set(product.variants.map(v => v.color))].map(color => <option key={color}>{color}</option>)}</select></label>
          <label className="cappatex-field">Grösse<select disabled={Boolean(busy)} value={variant.shopifyVariantId} onChange={e => selectVariant(product, e.target.value)}>
            {product.variants.filter(v => v.color === variant.color).map(v => <option key={v.shopifyVariantId} value={v.shopifyVariantId}>{v.size}</option>)}</select></label>
        </div>}
        {product && missingColor && missingColor.profileId === product.id && missingColor.profileVersion === product.profileVersion && <fieldset className="cappatex-photo-options">
          <legend>{missingColor.color}: verfügbare Grössen ausdrücklich wählen</legend>
          <p className="cappatex-action-hint">{missingColor.reason}</p>
          {missingColor.options.map(option => <button type="button" disabled={Boolean(busy)} key={option.variantId}
            onClick={() => selectVariant(product, option.variantId)}>{missingColor.color} · {option.size}</button>)}
        </fieldset>}
        {variant && <fieldset className="cappatex-styles cappatex-print-sides"><legend>Druckseite</legend>
          <button type="button" aria-pressed={side === "front"} className={side === "front" ? "active" : ""} disabled={Boolean(busy)} onClick={() => selectSide("front")}>Vorderseite</button>
          {baseVariant?.back && <button type="button" aria-pressed={side === "back"} className={side === "back" ? "active" : ""} disabled={Boolean(busy)} onClick={() => selectSide("back")}>Rückseite</button>}
        </fieldset>}
        {baseVariant && <fieldset className="cappatex-photo-options"><legend>Ansicht</legend>
          <button type="button" aria-pressed={!galleryPhoto} onClick={() => setPhotoUrl("")}>Motiv platzieren</button>
          {baseVariant.photos?.map(photo => <button type="button" key={photo.url} aria-pressed={galleryPhoto?.url === photo.url} onClick={() => setPhotoUrl(photo.url)}>{photo.label}</button>)}
        </fieldset>}
        {galleryPhoto && <figure className="cappatex-provider-photo"><img src={galleryPhoto.url} alt={`${product?.name}, ${baseVariant?.color} – ${galleryPhoto.label}, unbedrucktes Anbieterfoto`} />
          <figcaption>{galleryPhoto.label} · {baseVariant?.color}. Unbedrucktes Anbieterfoto zur Passform und zum Material. Dein Motiv siehst du unter „Motiv platzieren“.</figcaption></figure>}
        <div hidden={Boolean(galleryPhoto)} className={`cappatex-placement-workbench${variant ? " has-product" : ""}`}>
        <div className="cappatex-verified-preview">
          {variant ? <div className="cappatex-blank-photo" style={{ aspectRatio: `${variant.mockup.width}/${variant.mockup.height}` }}>
            {blankSrc ? <img key={blankIdentity} className="cappatex-blank-image" src={blankSrc} alt={`${product?.name || "Blanko"}, ${variant.color}, ${variant.size}, unbedruckt`}
              onLoad={e => { if (e.currentTarget.naturalWidth === variant.mockup.width && e.currentTarget.naturalHeight === variant.mockup.height) setLoadedBlank(blankIdentity); else { setLoadedBlank(""); setError("Die Produktansicht stimmt nicht mit der geprüften Vorlage überein."); } }}
              onError={() => { setLoadedBlank(""); setError("Die Produktansicht konnte nicht geladen werden."); }} />
              : <p className="cappatex-error" role="alert">Diese Produktansicht ist noch nicht als feste Referenz bestätigt. Vorschau und Seitenübernahme bleiben gesperrt.</p>}
            <div className="cappatex-verified-area" style={photoPrintArea(variant)}>
              {image && <img key={image} src={image} alt="Dein unverändertes Motiv in der Druckfläche"
                onLoad={e => { if (e.currentTarget.naturalWidth === previewSize.width && e.currentTarget.naturalHeight === previewSize.height) setLoadedArtwork(image); else { setLoadedArtwork(""); setError("Die Motivdatei stimmt nicht mit der Druckdatei überein."); } }}
                onError={() => { setLoadedArtwork(""); setError("Das Motiv konnte nicht geladen werden. Die Bestellung bleibt gesperrt."); }}
                style={{ ...placedArtwork(variant, artwork, placement), opacity: blankSrc && loadedBlank === blankIdentity && loadedArtwork === image ? 1 : 0 }} />}
            </div>
            {blankSrc && loadedBlank === blankIdentity && <MockupForeground variant={variant} src={blankSrc} />}
          </div> : image ? <div style={{ width: "100%", maxWidth: 460 * artwork.width / artwork.height, aspectRatio: `${artwork.width}/${artwork.height}`, margin: "auto" }}>
            <img className="cappatex-artwork-only" src={image} style={{ width: "100%", height: "100%", objectFit: "fill" }} alt="Dein fertiges Motiv" /></div> :
            <div className="cappatex-preview-placeholder"><span aria-hidden="true">✦</span><b>Hier beginnt dein Einzelstück</b><p>Beschreibe deine Idee oder wähle ein eigenes Bild. Dein Motiv erscheint hier.</p></div>}
        </div>
        {legacyBlank && <p className="cappatex-profile-note" role="note">Ältere Rückseitenansicht: Dieses Anbieterfoto ist noch nicht als feste Referenz bestätigt.
          Die Gestaltung bleibt für deinen Entwurf nutzbar; der Verkauf bleibt bis zur Freigabe gesperrt.</p>}
        {variant && <div className="cappatex-customize">
          <button type="button" disabled={!image || Boolean(busy)} onClick={() => { setPlacement(initialPlacement(variant.area, artwork)); }}>Passend einfügen</button>
          <button type="button" disabled={!image || Boolean(busy)} onClick={() => { setPlacement({ ...placement, x: .5, y: .5 }); }}>Zentrieren</button>
          <label>Motivbreite <b>{Math.round(placement.scale * 100)} %</b><input type="range" disabled={!image || Boolean(busy)} min={variant.area.minScale} max={variant.area.maxScale} step="0.01" value={placement.scale} onChange={e => { setPlacement({ ...placement, scale: Number(e.target.value) }); }} /></label>
          <label>Horizontal <b>{Math.round(placement.x * 100)} %</b><input type="range" disabled={!image || Boolean(busy)} min="0" max="1" step="0.01" value={placement.x} onChange={e => { setPlacement({ ...placement, x: Number(e.target.value) }); }} /></label>
          <label>Vertikal <b>{Math.round(placement.y * 100)} %</b><input type="range" disabled={!image || Boolean(busy)} min="0" max="1" step="0.01" value={placement.y} onChange={e => { setPlacement({ ...placement, y: Number(e.target.value) }); }} /></label>
        </div>}
        </div>
        {image && geometry && <p className={geometry.ok ? "cappatex-quality-ok" : "cappatex-error"} role="status">{geometry.reason}
          {geometry.dpi !== undefined && <> · {Math.floor(geometry.dpi)} dpi · {Math.round(geometry.widthMm!)} × {Math.round(geometry.heightMm!)} mm</>}</p>}
        {printHelp && <div className="cappatex-profile-note" role="note" aria-label="Druckgrösse deiner Datei">
          <p><strong>Druckgrösse deiner Datei:</strong> Bei mindestens {printHelp.minDpi} dpi reicht die Originalauflösung für höchstens {centimetres(printHelp.maxWidthCm)} × {centimetres(printHelp.maxHeightCm)} cm Motivgrösse.
            Zusätzlich gilt die geprüfte Druckfläche des Produkts.</p>
          {printHelp.insufficientResolutionForFullArea && <p>{printHelp.canPlaceAtMinimumDpi
            ? "Dieses Motiv eignet sich für einen Teilbereich; randfüllend ist mit dieser Auflösung nicht möglich."
            : "Die Auflösung reicht auf diesem Produkt auch bei der kleinsten erlaubten Motivgrösse nicht aus."}</p>}
          {!printHelp.aspectMatches && <p>Motiv und Druckfläche haben unterschiedliche Seitenverhältnisse. Beim proportionalen Einpassen bleiben Ränder.</p>}
        </div>}
        {image && (canDownloadHd || uploadedArtwork) && <a className="text-link" href={`${image}?download=1`}>Freigegebene PNG-Druckdatei herunterladen →</a>}
        {variant && <>
          {product?.mockupReferenceSize && <p className="cappatex-profile-note">Produktansicht: Referenzgrösse {product.mockupReferenceSize}. Druckmasse für deine gewählte Grösse.</p>}
          <p className="cappatex-profile-note">Druckfläche: {variant.area.position === "front" ? "Vorderseite" : variant.area.position === "back" ? "Rückseite" : variant.area.position} · {Math.round(variant.area.widthMm)} × {Math.round(variant.area.heightMm)} mm · {variant.area.widthPx} × {variant.area.heightPx} px · Qualitätsziel: mindestens {variant.area.minDpi} dpi.
              Die gestrichelte Linie markiert die erlaubte Fläche. Die Fotovorschau zeigt Position und Grösse.
              {product?.kind === "accessory" ? " Oberfläche und Bildschirmfarben können vom Druck abweichen. Fotohalterungen gehören nicht zum Lieferumfang."
                : " Stofffalten werden vereinfacht dargestellt. Stoffstruktur und Bildschirmfarben können vom Druck abweichen."}</p>
          <div className="cappatex-order-config">
            <label>Menge<select disabled={Boolean(busy)} value={quantity} onChange={e => { setQuantity(Number(e.target.value)); }}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></label>
            <label>Lieferland<select disabled={Boolean(busy)} value={country} onChange={e => { setCountry(e.target.value === "LI" ? "LI" : "CH"); }}><option value="CH">Schweiz</option><option value="LI">Liechtenstein</option></select></label>
            <div><small>{variant.price ? "Artikelpreis · zzgl. Versand" : "Gestaltungsvorschau"}</small><strong>{variant.price ? money(Number(variant.price.amount) * quantity, variant.price.currencyCode) : `${quantity} Artikel ausgewählt`}</strong></div>
          </div>
        </>}
        {error && <p className="cappatex-error" role="alert">{error}</p>}
        {sessionNotice && <p className="cappatex-action-hint" role="status">{sessionNotice}</p>}
        <p className="cappatex-action-hint">Dein Motiv sieht noch nicht so aus wie gewünscht? <Link className="text-link" href="/cappatex/kontakt" target="_blank" rel="noopener noreferrer">Persönliche Designhilfe ↗</Link></p>
        <section className="cappatex-save-step" id="cappatex-save" aria-labelledby="cappatex-save-heading">
        <div className="cappatex-step-heading"><span>3</span><div><h3 id="cappatex-save-heading">Prüfen & speichern</h3><p>Prüfe dein Motiv und die gewünschten Druckseiten.</p></div></div>
        {pilotOwner && product && variant && !localRecoveryBlocked && <CappatexPreparationPanel key={`${product.id}:${product.profileVersion}:${variant.shopifyVariantId}`}
          product={product} variant={variant} side={side} designId={designId} artwork={artwork} placement={placement}
          ready={previewReady && Boolean(geometry?.ok) && !busy} quantity={quantity} country={country}
          draft={currentDraft} onDraftChange={update => setDrafts(current => ({ ...current,
            [draftKey]: update({ ...(current[draftKey] || emptyCompositionDraft()), working: currentDraft.working }) }))}
          onPersist={value => { if (sessionKey && product && baseVariant) try {
            window.sessionStorage.setItem(sessionKey, serializeSessionDraft(product, baseVariant, value, motifs, quantity, country, side));
          } catch { setSessionNotice("Die Sitzungssicherung ist nicht verfügbar. Bei unklarem Speicherstatus bleibe auf dieser Seite und wiederhole dieselbe Anfrage."); } }}
          onSaving={saving => setBusy(saving ? "preparation" : "")} />}
        <div className="cappatex-ready">
          {designId&&<Link className="text-link" href="/cappatex/sammlung">Deine gespeicherten CAPPATEX-Motive ansehen →</Link>}
          <p className="cappatex-action-hint">Übernimm und speichere zuerst alle gewünschten Druckseiten. Öffne anschliessend deinen gespeicherten Stand,
            um Motive, Positionen und Preis gemeinsam zu prüfen. Von dort geht es nach der Verkaufsfreigabe zu Shopify.</p>
          <a className="text-link" href="#cappatex-save">Druckseiten übernehmen und speichern →</a>
          <p>{product?.blockedReason || "Bestellungen bleiben bis zum abgeschlossenen Produkt-, Versand- und Checkout-Test gesperrt."}</p>
        </div>
        </section>
      </section>
    </div>
  </section>;
}
