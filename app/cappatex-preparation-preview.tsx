"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import type { DraftSelection } from "./cappatex-resume";
import { knownLegacyMockup, resolveMockupAsset } from "./cappatex-mockup-assets";

type ImageState = "loading" | "loaded" | "failed" | "dimensions" | "timeout";
export const PREPARATION_PREVIEW_TIMEOUT_MS = 20_000;

export const preparationPreviewIdentity = (selection: DraftSelection) => JSON.stringify({
  position: selection.position, designId: selection.designId, artwork: selection.artwork,
  area: selection.area, mockup: selection.mockup, placement: selection.placement,
});

/** Loading a reference image never grants a product, price or fulfillment approval. */
export default function PreparationPreview({ selection, onReadyChange }: {
  selection: DraftSelection; onReadyChange?: (identity: string, ready: boolean) => void;
}) {
  const { mockup: m, area, placement: p, artwork } = selection;
  const identity = preparationPreviewIdentity(selection);
  const asset = resolveMockupAsset(m);
  const legacy = !asset.verified && knownLegacyMockup(m);
  const photoSrc = asset.verified ? asset.src : legacy ? m.url : null;
  const [attempt, setAttempt] = useState(0);
  const [photo, setPhoto] = useState<ImageState>("loading");
  const [motif, setMotif] = useState<ImageState>("loading");
  const loaded = photo === "loaded" && motif === "loaded";
  const ready = asset.verified && loaded;
  const side = selection.position === "front" ? "Vorderseite" : "Rückseite";
  const failed = [photo, motif].some(state => state !== "loading" && state !== "loaded");

  useEffect(() => { onReadyChange?.(identity, ready); }, [identity, ready, onReadyChange]);
  useEffect(() => {
    if (!photoSrc) return;
    const timer = window.setTimeout(() => {
      setPhoto(current => current === "loading" ? "timeout" : current);
      setMotif(current => current === "loading" ? "timeout" : current);
    }, PREPARATION_PREVIEW_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [photoSrc, attempt]);

  function retry() {
    onReadyChange?.(identity, false);
    setPhoto("loading"); setMotif("loading"); setAttempt(current => current + 1);
  }

  return <figure style={{ margin: 0 }} aria-label={`Gespeicherte Produktansicht: ${side}`}>
    <div className="cappatex-preparation-photo" style={{ aspectRatio: `${m.width}/${m.height}` }}>
      {photoSrc && <>
        <img key={`photo:${attempt}`} src={photoSrc} alt={`Blanko-Produkt – ${side}`}
          style={{ visibility: photo === "loaded" ? "visible" : "hidden" }}
          onLoad={event => setPhoto(event.currentTarget.naturalWidth === m.width && event.currentTarget.naturalHeight === m.height ? "loaded" : "dimensions")}
          onError={() => setPhoto("failed")} />
        <span style={{ position: "absolute", left: `${m.left / m.width * 100}%`, top: `${m.top / m.height * 100}%`, width: `${m.printWidth / m.width * 100}%`, height: `${m.printHeight / m.height * 100}%` }}>
          <img key={`motif:${attempt}`} src={`/api/cappatex/artwork/${selection.designId}`} alt={`Gespeichertes Motiv für die ${side}`}
            onLoad={event => setMotif(event.currentTarget.naturalWidth === Math.ceil(artwork.width / 4)
              && event.currentTarget.naturalHeight === Math.ceil(artwork.height / 4) ? "loaded" : "dimensions")}
            onError={() => setMotif("failed")}
            style={{ position: "absolute", maxWidth: "none", visibility: loaded ? "visible" : "hidden",
              left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.scale * 100}%`,
              height: `${p.scale * area.widthPx / area.heightPx * artwork.height / artwork.width * 100}%`, transform: "translate(-50%, -50%)" }} />
        </span>
        {photo === "loaded" && m.foreground?.map((polygon, i) => <img key={`${attempt}:${i}`} src={photoSrc} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0,
          clipPath: `polygon(${polygon.map(([x, y]) => `${100 * x / m.width}% ${100 * y / m.height}%`).join(",")})` }} />)}
      </>}
    </div>
    {!photoSrc ? <p className="cappatex-action-error" role="alert">Das Produktfoto ist für diese gespeicherte Ansicht nicht bestätigt. Die Gestaltung bleibt gespeichert; eine Bildbestätigung ist noch nicht möglich.</p> : <>
      {legacy && <p className="cappatex-preparation-warning" role="status">Live-Produktfoto: Der Bildinhalt ist noch nicht festgehalten. Du kannst diese Ansicht ansehen und als Kopie weitergestalten; eine Bildbestätigung für eine Bestellung ist noch nicht möglich.</p>}
      {!failed && !loaded && <p role="status">{side}: Produktfoto und Motiv werden geladen …</p>}
      {failed && <>
        <p className="cappatex-action-error" role="alert">{[photo, motif].includes("dimensions")
          ? `${side}: Die Bildmasse von Produktfoto oder Motiv stimmen nicht mit der gespeicherten Ansicht überein.`
          : [photo, motif].includes("timeout") ? `${side}: Produktfoto oder Motiv wurde nicht rechtzeitig geladen.`
          : `${side}: Produktfoto oder Motiv ist gerade nicht verfügbar.`} Die Gestaltung bleibt gespeichert. Bitte lade die Ansicht erneut, bevor du sie bestätigst.</p>
        <button type="button" className="button secondary" onClick={retry}>{side} erneut laden</button>
      </>}
    </>}
  </figure>;
}
