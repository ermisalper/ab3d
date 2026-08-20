"use client";

import { useEffect, useRef, useState } from "react";

type ModelViewerProps = {
  src: string;
  poster?: string;
  autoRotate: boolean;
  setAutoRotate: (value: boolean) => void;
};

export default function ModelViewer({ src, poster, autoRotate, setAutoRotate }: ModelViewerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<(HTMLElement & { resetTurntableRotation?: (theta?: number) => void; jumpCameraToGoal?: () => void }) | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
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

  const message = status === "ready"
    ? ["Ziehen zum Drehen", "Mausrad: zoomen · Rechtsklick: verschieben"]
    : status === "error"
      ? ["Modell konnte nicht geladen werden", "Lade die GLB-Datei herunter oder starte die Generierung erneut."]
      : ["3D-Modell wird geladen", "Modelldatei wird sicher übertragen …"];

  return (
    <div className="model-viewer-shell" ref={shellRef}>
      <div className="viewer-help" role="status"><b>{message[0]}</b><span>{message[1]}</span></div>
      {/* @ts-expect-error model-viewer is a registered web component. */}
      <model-viewer key={src} ref={viewerRef} src={src} poster={poster} alt="Von AB3D generiertes dreidimensionales Design" camera-controls touch-action="pan-y" auto-rotate={autoRotate || undefined} auto-rotate-delay="800" rotation-per-second="18deg" camera-orbit="0deg 75deg auto" min-camera-orbit="auto 15deg 50%" max-camera-orbit="auto 165deg 400%" shadow-intensity="1.2" shadow-softness=".8" exposure="1" tone-mapping="aces" environment-image="neutral" interaction-prompt="auto" interaction-prompt-style="wiggle" loading="eager" />
      <div className="viewer-controls"><button type="button" className={autoRotate ? "active" : ""} onClick={() => setAutoRotate(!autoRotate)}>{autoRotate ? "Rotation stoppen" : "Automatisch drehen"}</button><button type="button" onClick={resetView}>Ansicht zentrieren</button><button type="button" onClick={() => shellRef.current?.requestFullscreen?.()}>Vollbild</button></div>
    </div>
  );
}
