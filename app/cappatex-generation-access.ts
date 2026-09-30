export type GenerationAccess =
  | { allowed: true; pilotOwner: boolean }
  | { allowed: false; reason: "owner_not_configured" | "owner_only" | "invalid_audience" };

export function generationAccess(
  email: string,
  audience: string | undefined,
  allowedEmails: string | undefined,
): GenerationAccess {
  if (audience === "subscribers") return { allowed: true, pilotOwner: false };
  if (audience && audience !== "owner") return { allowed: false, reason: "invalid_audience" };

  const owners = new Set((allowedEmails || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean));
  if (owners.size === 0) return { allowed: false, reason: "owner_not_configured" };
  if (!owners.has(email.trim().toLowerCase())) return { allowed: false, reason: "owner_only" };
  return { allowed: true, pilotOwner: true };
}
