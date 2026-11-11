/**
 * Tab-scoped drafts (sessionStorage). Reports and inspections are never stored in the browser:
 * Cloud Firestore is the source of truth.
 */

import type { SubmissionKind } from "@/types/verification";

export const DRAFT_STORAGE_KEY = "internyra.draft.v1";

function probe(get: () => Storage): Storage | null {
  try {
    const s = get();
    const k = "__internyra_probe__";
    s.setItem(k, "1");
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function getSessionStorage(): Storage | null {
  return typeof window === "undefined" ? null : probe(() => window.sessionStorage);
}

// ---------------------------------------------------------------------------
// Drafts: unsent form fields, tab-scoped (sessionStorage), survive refresh.

export interface SubmissionDraft {
  kind: SubmissionKind;
  url?: string;
  text?: string;
  claimedCompany?: string;
  updatedAt: number;
}

export function loadDraft(): SubmissionDraft | null {
  const s = getSessionStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SubmissionDraft;
    return d && typeof d === "object" && typeof d.kind === "string" ? d : null;
  } catch {
    return null;
  }
}

/** Returns false when the draft could not be stored (the UI keeps working from memory). */
export function saveDraft(patch: Partial<SubmissionDraft> & { kind: SubmissionKind }): boolean {
  const s = getSessionStorage();
  if (!s) return false;
  try {
    const next: SubmissionDraft = { ...(loadDraft() ?? {}), ...patch, updatedAt: Date.now() };
    s.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    getSessionStorage()?.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
}
