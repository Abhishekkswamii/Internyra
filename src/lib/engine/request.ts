import type { SubmissionKind, VerificationRequest } from "@/types/verification";
import { MAX_TEXT_LENGTH } from "./text";
import { validateUrl } from "./url";

export const MAX_COMPANY_LENGTH = 120;
export const MIN_TEXT_LENGTH = 20;
const KINDS: SubmissionKind[] = ["link", "message", "document"];

export type RequestValidation =
  | { ok: true; value: VerificationRequest }
  | { ok: false; code: string; field?: string; message: string };

function optionalString(body: Record<string, unknown>, key: string, max: number): string | undefined | Error {
  const v = body[key];
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") return new Error(`${key} must be a string`);
  const trimmed = v.trim();
  if (trimmed.length > max) return new Error(`${key} is too long (max ${max} characters)`);
  return trimmed || undefined;
}

/** Validates an untrusted request body (from the API or a form). */
export function validateVerificationRequest(input: unknown): RequestValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "INVALID_BODY", message: "Request body must be a JSON object." };
  }
  const body = input as Record<string, unknown>;
  const kind = body.kind as SubmissionKind;
  if (!KINDS.includes(kind)) {
    return { ok: false, code: "INVALID_KIND", field: "kind", message: "Choose a link, message or document submission." };
  }

  const url = optionalString(body, "url", 4096);
  const text = optionalString(body, "text", MAX_TEXT_LENGTH);
  const claimedCompany = optionalString(body, "claimedCompany", MAX_COMPANY_LENGTH);
  const documentName = optionalString(body, "documentName", 200);
  const claimedRole = optionalString(body, "claimedRole", MAX_COMPANY_LENGTH);
  const recruiterName = optionalString(body, "recruiterName", MAX_COMPANY_LENGTH);
  const recruiterEmail = optionalString(body, "recruiterEmail", 254);
  for (const [field, v] of Object.entries({ url, text, claimedCompany, documentName, claimedRole, recruiterName, recruiterEmail })) {
    if (v instanceof Error) return { ok: false, code: "INVALID_FIELD", field, message: v.message };
  }

  if (kind === "link" && !url) {
    return { ok: false, code: "URL_REQUIRED", field: "url", message: "Paste the internship link, starting with https://" };
  }
  if (kind !== "link" && !text) {
    return {
      ok: false,
      code: "TEXT_REQUIRED",
      field: "text",
      message: kind === "document" ? "Choose a text document to analyse." : "Paste the recruiter's message or the job description.",
    };
  }
  if (typeof text === "string" && text.length < MIN_TEXT_LENGTH) {
    return { ok: false, code: "TEXT_TOO_SHORT", field: "text", message: `Paste at least ${MIN_TEXT_LENGTH} characters so there is something to analyse.` };
  }
  if (typeof url === "string") {
    const v = validateUrl(url);
    if (!v.ok) return { ok: false, code: v.code, field: "url", message: v.message };
  }

  const origin = body.origin === "GUEST_PREVIEW" ? "GUEST_PREVIEW" : "CORE";
  return {
    ok: true,
    value: {
      kind,
      url: url as string | undefined,
      text: text as string | undefined,
      claimedCompany: claimedCompany as string | undefined,
      claimedRole: claimedRole as string | undefined,
      recruiterName: recruiterName as string | undefined,
      recruiterEmail: recruiterEmail as string | undefined,
      documentName: documentName as string | undefined,
      origin,
    },
  };
}
