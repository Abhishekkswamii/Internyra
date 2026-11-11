/**
 * Verification case & report model (schema v2).
 *
 * Keeps these concepts deliberately separate:
 *  - OBSERVATION    directly observed information (Finding.kind = "OBSERVATION")
 *  - EVIDENCE       a recorded source/result supporting an observation (Evidence)
 *  - RISK SIGNAL    a reason to investigate further (Finding.kind = "RISK_SIGNAL")
 *  - ASSESSMENT     a qualified conclusion from the available signals (AssessmentResult.assessment)
 *  - CONFIDENCE     how well the evidence supports that assessment (AssessmentResult.confidence)
 *  - COVERAGE       which checks completed / were unavailable / not run (CheckResult.status)
 *
 * Analysis lifecycle (LifecycleState) is independent of the assessment.
 */

export const CASE_SCHEMA_VERSION = 2 as const;

export type SubmissionKind = "link" | "message" | "document";

export type LifecycleState =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "TIMEOUT"
  | "NEEDS_REVIEW";

export type Assessment =
  | "LOWER_CONCERN"
  | "NEEDS_REVIEW"
  | "HIGH_RISK"
  | "INSUFFICIENT_DATA";

export type Confidence = "LOW" | "MODERATE" | "HIGH";

export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH";

export type FindingKind = "OBSERVATION" | "RISK_SIGNAL" | "CORROBORATION";

export type Provenance =
  | "OFFICIAL"
  | "REPUTABLE_INDEPENDENT"
  | "USER_SUPPLIED"
  | "COMMUNITY_SUBMITTED"
  | "LOCAL_HEURISTIC";

export type RetrievalStatus = "LOCAL_ANALYSIS" | "RETRIEVED" | "FAILED" | "NOT_ATTEMPTED";

export type CheckStatus = "COMPLETED" | "PARTIAL" | "UNAVAILABLE" | "NOT_RUN" | "FAILED";

export type CheckCategory = "input" | "domain" | "content" | "recruiter" | "company" | "reputation";

export type CheckId =
  | "input.url"
  | "url.structure"
  | "domain.lookalike"
  | "domain.registration"
  | "domain.dns"
  | "domain.tls"
  | "page.fetch"
  | "reputation.threat-intel"
  | "content.payment"
  | "content.sensitive-data"
  | "content.entities"
  | "content.contact-patterns"
  | "recruiter.domain-match"
  | "company.corroboration";

export interface CheckResult {
  id: CheckId;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  summary: string;
  /** Why the check was unavailable / not run / failed. */
  reason?: string;
  completedAt?: string;
}

export type EvidenceType =
  | "URL_ANALYSIS"
  | "TEXT_EXCERPT"
  | "EXTRACTED_ENTITY"
  | "LOCAL_LIST_MATCH"
  | "NAME_COMPARISON"
  | "EXTERNAL_SOURCE";

export type EvidenceValue = string | number | boolean | null;

export interface Evidence {
  id: string;
  type: EvidenceType;
  title: string;
  /** Only set when a real source URL exists (never invented). */
  sourceUrl?: string;
  sourceDomain?: string;
  /** Short excerpt; never the full submitted text. */
  excerpt?: string;
  data?: Record<string, EvidenceValue>;
  capturedAt: string;
  retrievalStatus: RetrievalStatus;
  provenance: Provenance;
  /** Findings this evidence supports. */
  findingIds: string[];
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleVersion: number;
  kind: FindingKind;
  category: CheckCategory;
  severity: Severity;
  /** Findings in the same group stem from the same underlying signal and are counted once. */
  signalGroup?: string;
  title: string;
  explanation: string;
  observationSummary: string;
  evidenceIds: string[];
  sourceType: Provenance;
  checkId: CheckId;
  detectedAt: string;
  confidence?: Confidence;
  limitation: string;
}

export interface AssessmentResult {
  assessment: Assessment;
  /** null when no meaningful determination exists (INSUFFICIENT_DATA). */
  confidence: Confidence | null;
  summary: string;
  rationale: string[];
  triggeredRuleIds: string[];
  nextSteps: string[];
}

export interface VerificationReport {
  engineVersion: string;
  rulesetVersion: string;
  generatedAt: string;
  checks: CheckResult[];
  findings: Finding[];
  evidence: Evidence[];
  assessment: AssessmentResult;
  limitations: string[];
}

export interface CaseSubmission {
  kind: SubmissionKind;
  /** The URL as the user typed it (kept so the original submission is preserved). */
  originalUrl?: string;
  normalizedUrl?: string;
  /** ASCII (punycode) hostname. */
  hostname?: string;
  /** Unicode display form when the hostname is internationalized. */
  displayHostname?: string;
  claimedCompany?: string;
  /** Length of submitted text. The full text itself is not persisted. */
  textLength?: number;
  documentName?: string;
}

export interface VerificationCase {
  id: string;
  schemaVersion: typeof CASE_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  origin: "GUEST_PREVIEW" | "CORE";
  inputType: SubmissionKind;
  submission: CaseSubmission;
  lifecycle: LifecycleState;
  report?: VerificationReport;
  error?: { code: string; message: string };
  saved: boolean;
  /** Who owns this record. Accounts arrive with the auth/Redis phase. */
  owner: { kind: "LOCAL_DEVICE" };
  retention: {
    storage: "BROWSER_LOCAL";
    /** The server keeps no copy in this phase. */
    serverCopy: false;
  };
}

/** Body accepted by POST /api/verifications. */
export interface VerificationRequest {
  kind: SubmissionKind;
  url?: string;
  text?: string;
  claimedCompany?: string;
  claimedRole?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  documentName?: string;
  origin?: VerificationCase["origin"];
}
