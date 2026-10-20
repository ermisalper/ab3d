export type PromptBrief = {
  colors: string;
  lettering: string;
  details: string;
  avoid: string;
};

export const PROMPT_MAX_LENGTH = 500;
export const PROMPT_MIN_LENGTH = 12;

export function newPromptBrief(): PromptBrief {
  return { colors: "", lettering: "", details: "", avoid: "" };
}

/** A visible, local draft only. Applying it is a separate customer action. */
export function composePromptBrief(value: string, brief: PromptBrief) {
  const colors = brief.colors.trim(), lettering = brief.lettering.trim();
  const details = brief.details.trim(), avoid = brief.avoid.trim();
  const additions = [
    colors ? `Farben: ${colors}` : "",
    lettering ? `Schriftzug (genau): „${lettering}“` : "",
    details ? `Details und Bildaufbau: ${details}` : "",
    avoid ? `Vermeiden: ${avoid}` : "",
  ].filter(Boolean);
  const prompt = [value.trim(), ...additions].filter(Boolean).join("\n");
  return {
    prompt,
    length: prompt.length,
    hasOptions: additions.length > 0,
    canApply: additions.length > 0 && prompt.length >= PROMPT_MIN_LENGTH && prompt.length <= PROMPT_MAX_LENGTH,
  };
}
