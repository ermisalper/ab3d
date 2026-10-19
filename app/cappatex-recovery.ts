import { parseSessionDraft } from "./cappatex-session-draft";
import type { SessionDraft } from "./cappatex-session-draft";

export type LocalDraftInspection = { kind: "empty"; reference: null } | { kind: "invalid"; reference: null }
  | { kind: "valid"; reference: SessionDraft };

export async function accountDraftKey(email: unknown) {
  if (typeof email !== "string" || !email.trim()) throw new Error("Das aktuelle Konto konnte nicht bestätigt werden.");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.trim().toLowerCase()));
  return `cappatex-draft-v1:${[...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, "0")).join("")}`;
}

/** A damaged reference is not an empty studio, and must not be silently replaced. */
export function inspectLocalDraft(raw: string | null): LocalDraftInspection {
  if (raw === null) return { kind: "empty", reference: null };
  const reference = parseSessionDraft(raw);
  return reference ? { kind: "valid", reference } : { kind: "invalid", reference: null };
}

export function conflictsWithLocalMotif(reference: SessionDraft, designId: string, side: "front" | "back") {
  return Boolean(designId && reference.working.find(value => value.position === side)?.designId !== designId);
}

/** Check immediately before removing this one account's unchanged local reference. */
export function assertDiscardTarget(expectedKey: string, currentKey: string, expectedRaw: string | null | undefined, currentRaw: string | null) {
  if (!/^cappatex-draft-v1:[a-f0-9]{64}$/.test(expectedKey) || currentKey !== expectedKey)
    throw new Error("Das angemeldete Konto hat sich geändert. Bitte prüfe das Studio erneut; es wurde nichts verworfen.");
  if (typeof expectedRaw !== "string" || currentRaw !== expectedRaw)
    throw new Error("Der lokale Entwurf hat sich inzwischen geändert. Bitte prüfe ihn erneut; es wurde nichts verworfen.");
}

const studioParameters = ["designId", "profileId", "variantId", "quantity", "country", "x", "y", "scale", "side", "products", "preparationId", "resume"];

/** Keep the exact retry URL, except a newly created owned motif must not vanish on reload. */
export function recoveryUrl(currentUrl: string, action: "retry" | "local", currentOwnedDesignId = "") {
  const url = new URL(currentUrl);
  const newMotif = /^CPX-[A-Z0-9]{12}$/.test(currentOwnedDesignId) && currentOwnedDesignId !== url.searchParams.get("designId");
  if (action === "local" || newMotif) {
    for (const key of studioParameters) url.searchParams.delete(key);
    if (action !== "local" && newMotif) url.searchParams.set("designId", currentOwnedDesignId);
  }
  url.hash = "studio";
  return url.toString();
}
