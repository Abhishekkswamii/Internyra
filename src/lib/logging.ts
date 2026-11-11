/**
 * Safe server-side logging for verification requests.
 *
 * Only the whitelisted metadata fields below are ever written. Submitted URLs, message
 * text, document contents, emails and company names must never be passed here.
 */

import type { Assessment, LifecycleState, SubmissionKind } from "@/types/verification";

export interface VerificationLogEvent {
  event: "verification.completed" | "verification.rejected" | "verification.error";
  kind?: SubmissionKind;
  hasUrl?: boolean;
  textLength?: number;
  durationMs?: number;
  lifecycle?: LifecycleState;
  assessment?: Assessment;
  /** Machine-readable error/validation code, never a message containing user input. */
  code?: string;
  status?: number;
}

const ALLOWED_KEYS: (keyof VerificationLogEvent)[] = [
  "event",
  "kind",
  "hasUrl",
  "textLength",
  "durationMs",
  "lifecycle",
  "assessment",
  "code",
  "status",
];

export function logVerificationEvent(e: VerificationLogEvent): void {
  const safe: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (e[key] !== undefined) safe[key] = e[key];
  }
  if (process.env.NODE_ENV === "test" && !process.env.INTERNYRA_LOG_IN_TESTS) return;
  console.info(`[internyra] ${JSON.stringify(safe)}`);
}
