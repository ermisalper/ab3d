"use client";
import { useId, useState } from "react";
import { composePromptBrief, newPromptBrief, PROMPT_MAX_LENGTH, type PromptBrief } from "../cappatex-prompt-brief";

export default function CappatexPromptHelper({ value, onApply, disabled = false }: {
  value: string;
  onApply: (prompt: string) => void;
  disabled?: boolean;
}) {
  const [brief, setBrief] = useState(newPromptBrief);
  const [open, setOpen] = useState(false);
  const id = useId();
  // Use the current manual description on every render, never a captured copy.
  const proposal = composePromptBrief(value, brief);
  const patch = (field: keyof PromptBrief, text: string) => setBrief(current => ({ ...current, [field]: text }));

  function apply() {
    if (disabled || !proposal.canApply) return;
    onApply(proposal.prompt);
    setBrief(newPromptBrief());
    setOpen(false);
  }

  return <details className="cappatex-prompt-helper" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Idee genauer beschreiben</summary>
    <fieldset disabled={disabled}>
      <legend>Optionale Wünsche</legend>
      <div className="cappatex-brief-fields">
        <label>Farben<input value={brief.colors} maxLength={80} placeholder="Zum Beispiel: Terracotta und Creme"
          onChange={event => patch("colors", event.target.value)} /></label>
        <label>Text im Motiv<input value={brief.lettering} maxLength={80} placeholder="Gewünschten Wortlaut genau eingeben"
          aria-describedby={`${id}-lettering`} onChange={event => patch("lettering", event.target.value)} /></label>
        <label>Details & Bildaufbau<textarea value={brief.details} maxLength={180} rows={3}
          placeholder="Zum Beispiel: eine einzelne Blume, feine Linien, viel freier Raum"
          onChange={event => patch("details", event.target.value)} /></label>
        <label>Was soll nicht vorkommen?<input value={brief.avoid} maxLength={80} placeholder="Zum Beispiel: Rahmen, Schatten"
          onChange={event => patch("avoid", event.target.value)} /></label>
      </div>
      <p className="cappatex-brief-help" id={`${id}-lettering`}>KI kann Schrift verändern. Prüfe den Wortlaut im fertigen Motiv vor dem Druck.</p>
      {proposal.hasOptions && <div className="cappatex-brief-proposal">
        <label>Deine ergänzte Beschreibung<textarea readOnly value={proposal.prompt} rows={6}
          aria-describedby={`${id}-count`} /></label>
        <p id={`${id}-count`} className={proposal.length > PROMPT_MAX_LENGTH ? "cappatex-error" : "cappatex-brief-count"} role="status">
          {proposal.length}/{PROMPT_MAX_LENGTH} Zeichen{proposal.length > PROMPT_MAX_LENGTH ? " · Bitte kürze deine Beschreibung oder die Ergänzungen. Es wird nichts abgeschnitten." : ""}
        </p>
      </div>}
      <button type="button" className="button secondary" disabled={disabled || !proposal.canApply} onClick={apply}>Beschreibung übernehmen</button>
    </fieldset>
  </details>;
}
