import { z } from "zod";

export const PROMPT_VERSION = "2026-11-11.1";
export const REPORT_SCHEMA_VERSION = "2";

export const RESEARCH_STATUSES = ["no_major_red_flags_found", "needs_caution", "suspicious_indicators_found", "insufficient_evidence"] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];

const str = (max: number) => z.string().trim().min(1).max(max);
const opt = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : undefined));

/** What the model is asked to return. Sources are referenced by URL and validated afterwards. */
export const ModelOutputSchema = z.object({
  company: z.object({ name: opt(200), officialUrl: opt(500), summary: opt(600) }).default({ name: undefined, officialUrl: undefined, summary: undefined }),
  role: opt(200),
  recruiter: z
    .object({
      name: opt(200),
      contact: opt(200),
      corroboration: z.enum(["corroborated", "not_corroborated", "not_checked"]).default("not_checked"),
      notes: opt(500),
    })
    .default({ name: undefined, contact: undefined, corroboration: "not_checked", notes: undefined }),
  facts: z.array(z.object({ statement: str(400), sourceUrl: str(1000), quote: str(400) })).max(12).default([]),
  submittedClaims: z.array(str(300)).max(15).default([]),
  inferences: z.array(z.object({ statement: str(400), basis: str(300) })).max(10).default([]),
  unknowns: z.array(str(300)).max(12).default([]),
  riskIndicators: z
    .array(z.object({ indicator: str(300), severity: z.enum(["low", "medium", "high"]), basis: z.enum(["submitted_text", "retrieved_page", "web_research"]) }))
    .max(12)
    .default([]),
  feeOrPaymentRequests: z.array(str(300)).max(8).default([]),
  missingEvidence: z.array(str(300)).max(10).default([]),
  nextSteps: z.array(str(300)).max(8).default([]),
  status: z.enum(RESEARCH_STATUSES),
  confidence: z.enum(["low", "moderate", "high"]),
  summary: str(900),
});
export type ModelOutput = z.infer<typeof ModelOutputSchema>;

export const ResearchSourceSchema = z.object({
  id: z.string(),
  title: z.string().max(300),
  url: z.string().max(1000),
  retrievedAt: z.string(),
  excerpt: z.string().max(400),
  origin: z.enum(["retrieved_page", "provider_search"]),
});
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

/** The report that is stored and shown. Every fact points at a validated source. */
export const ResearchReportSchema = z.object({
  status: z.enum(RESEARCH_STATUSES),
  confidence: z.enum(["low", "moderate", "high"]),
  summary: z.string(),
  company: z.object({ name: z.string().optional(), officialUrl: z.string().optional(), summary: z.string().optional() }),
  role: z.string().optional(),
  recruiter: z.object({
    name: z.string().optional(),
    contact: z.string().optional(),
    corroboration: z.enum(["corroborated", "not_corroborated", "not_checked"]),
    notes: z.string().optional(),
  }),
  facts: z.array(z.object({ statement: z.string(), sourceId: z.string(), quote: z.string() })),
  submittedClaims: z.array(z.string()),
  inferences: z.array(z.object({ statement: z.string(), basis: z.string() })),
  unknowns: z.array(z.string()),
  riskIndicators: z.array(z.object({ indicator: z.string(), severity: z.enum(["low", "medium", "high"]), basis: z.string() })),
  feeOrPaymentRequests: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  nextSteps: z.array(z.string()),
  sources: z.array(ResearchSourceSchema),
  droppedUnsupportedFacts: z.number().int().min(0),
  promptInjectionDetected: z.boolean(),
  pageRetrieval: z.object({ attempted: z.boolean(), ok: z.boolean(), reason: z.string().optional() }),
  researchedAt: z.string(),
  schemaVersion: z.string(),
  promptVersion: z.string(),
});
export type ResearchReport = z.infer<typeof ResearchReportSchema>;

export const STATUS_LABEL: Record<ResearchStatus, string> = {
  no_major_red_flags_found: "No major red flags found",
  needs_caution: "Needs caution",
  suspicious_indicators_found: "Suspicious indicators found",
  insufficient_evidence: "Insufficient evidence",
};

export interface ResearchInput {
  kind: "link" | "message" | "document";
  targetUrl?: string;
  pastedText?: string;
  claimedCompany?: string;
  claimedRole?: string;
  recruiterName?: string;
  recruiterEmail?: string;
}

export type ProviderId = "gemini" | "openai";

export interface Citation {
  url: string;
  title?: string;
}

export interface GenerateRequest {
  system: string;
  user: string;
  webSearch: boolean;
  timeoutMs: number;
  maxOutputTokens: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  webSearchUsed: boolean;
  citations: Citation[];
}

export interface ProviderClient {
  id: ProviderId;
  model: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

export type ProviderErrorKind = "transient" | "quota" | "auth" | "config" | "bad_request" | "unknown";

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    public readonly provider: ProviderId,
    public readonly status?: number
  ) {
    super(`${provider} ${kind}`);
    this.name = "ProviderError";
  }
  /** Only provider-side failures may fall back. Invalid input and validation errors may not. */
  get fallbackEligible(): boolean {
    return this.kind === "transient" || this.kind === "quota" || this.kind === "auth" || this.kind === "config";
  }
}

/** Application-level failure (invalid model output, no provider, disabled). Never falls back. */
export class ResearchError extends Error {
  constructor(
    public readonly code: "AI_DISABLED" | "NO_PROVIDER" | "INVALID_OUTPUT" | "PROVIDER_FAILED" | "BAD_REQUEST",
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "ResearchError";
  }
}

export function classifyHttpStatus(status: number | undefined, provider: ProviderId, name?: string): ProviderError {
  if (name === "AbortError" || name === "APIConnectionTimeoutError" || name === "TimeoutError") return new ProviderError("transient", provider, status);
  if (status === 429) return new ProviderError("quota", provider, status);
  if (status === 401 || status === 403) return new ProviderError("auth", provider, status);
  if (status === 404) return new ProviderError("config", provider, status);
  if (status === 400 || status === 422) return new ProviderError("bad_request", provider, status);
  if (status === undefined || status >= 500 || status === 408 || status === 409) return new ProviderError("transient", provider, status);
  return new ProviderError("unknown", provider, status);
}
