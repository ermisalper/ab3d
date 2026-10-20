import { AB3D_OPERATION_ID, isAb3dReviewState, type Ab3dReview, type Ab3dReviewState } from "../ab3d-operations";

export type ReviewDraft = { state: Ab3dReviewState; notes: string; version: number; savedState: Ab3dReviewState; savedNotes: string };
export type ReviewDrafts = Record<string, ReviewDraft>;
const MAX_DRAFTS = 100, MAX_STORAGE_LENGTH = 800_000;
export const isDirtyReviewDraft = (draft: ReviewDraft) => draft.state !== draft.savedState || draft.notes !== draft.savedNotes;
export const reviewDraft = (review: Ab3dReview): ReviewDraft => ({ state: review.state, notes: review.notes, version: review.version, savedState: review.state, savedNotes: review.notes });

export function parseReviewDrafts(raw: string | null): ReviewDrafts {
  if (raw === null) return {};
  if (raw.length > MAX_STORAGE_LENGTH) throw new Error("DRAFT_STORAGE_INVALID");
  const stored: unknown = JSON.parse(raw);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) throw new Error("DRAFT_STORAGE_INVALID");
  const entries = Object.entries(stored);
  if (entries.length > MAX_DRAFTS) throw new Error("DRAFT_STORAGE_INVALID");
  const output: ReviewDrafts = {};
  for (const [id, value] of entries) {
    if (!AB3D_OPERATION_ID.test(id) || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("DRAFT_STORAGE_INVALID");
    const item = value as Record<string, unknown>;
    if (Object.keys(item).sort().join(",") !== "notes,savedNotes,savedState,state,version"
      || !isAb3dReviewState(item.state) || !isAb3dReviewState(item.savedState)
      || typeof item.notes !== "string" || item.notes.length > 3000 || typeof item.savedNotes !== "string" || item.savedNotes.length > 3000
      || !Number.isSafeInteger(item.version) || Number(item.version) < 0 || Number(item.version) > 1_000_000) throw new Error("DRAFT_STORAGE_INVALID");
    const draft = item as ReviewDraft;
    if (isDirtyReviewDraft(draft)) output[id] = draft;
  }
  return output;
}

export function serializeReviewDrafts(drafts: ReviewDrafts): string | null {
  const entries = Object.entries(drafts).filter(([, draft]) => isDirtyReviewDraft(draft));
  if (!entries.length) return null;
  const raw = JSON.stringify(Object.fromEntries(entries.map(([id, item]) => [id, { state: item.state, notes: item.notes, version: item.version, savedState: item.savedState, savedNotes: item.savedNotes }])));
  parseReviewDrafts(raw);
  return raw;
}

/** Local changes win over recovery; clean server data can safely yield to recovered unsaved work. */
export function mergeRecoveredReviewDrafts(current: ReviewDrafts, recovered: ReviewDrafts): ReviewDrafts {
  const merged = { ...current };
  for (const [id, incoming] of Object.entries(recovered)) {
    if (!merged[id] || !isDirtyReviewDraft(merged[id])) merged[id] = incoming;
  }
  return merged;
}

export function reconcileReviewDraft(existing: ReviewDraft | undefined, incoming: Ab3dReview, saving: boolean): ReviewDraft {
  if (existing && (isDirtyReviewDraft(existing) || saving || existing.version > incoming.version)) return existing;
  return reviewDraft(incoming);
}
