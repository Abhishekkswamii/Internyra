/**
 * Versioned rule registry and assessment logic (RULESET_VERSION in ./version.ts).
 *
 * - severity      how much a signal matters if true (INFO/LOW/MEDIUM/HIGH)
 * - signalGroup   findings sharing a group stem from one underlying signal; counted once
 * - provenance    recorded per finding/evidence; only OFFICIAL corroboration can offset weak signals
 * - confidence    computed separately, describing support for the overall assessment
 *
 * No numeric score is produced: there is no calibrated basis for one.
 */

import type {
  Assessment,
  CheckResult,
  Confidence,
  Finding,
  FindingKind,
  Severity,
} from "@/types/verification";

export interface RuleDefinition {
  id: string;
  version: number;
  kind: FindingKind;
  severity: Severity;
  signalGroup?: string;
  description: string;
}

function rule(
  id: string,
  kind: FindingKind,
  severity: Severity,
  description: string,
  signalGroup?: string
): RuleDefinition {
  return { id, version: 1, kind, severity, description, signalGroup };
}

export const RULES = {
  // URL structure
  URL_PLAIN_HTTP: rule("URL-001", "RISK_SIGNAL", "LOW", "Link uses unencrypted http://", "transport"),
  URL_IP_LITERAL: rule("URL-002", "RISK_SIGNAL", "MEDIUM", "Link points to a raw IP address instead of a domain name", "host-form"),
  URL_NONSTANDARD_PORT: rule("URL-003", "RISK_SIGNAL", "MEDIUM", "Link uses a non-standard network port", "host-form"),
  URL_SHORTENER: rule("URL-004", "RISK_SIGNAL", "LOW", "Link uses a URL-shortening service that hides the destination", "destination-hidden"),
  URL_MIXED_SCRIPT: rule("URL-005", "RISK_SIGNAL", "MEDIUM", "Internationalized hostname mixes Latin with Cyrillic/Greek letters", "lookalike"),
  URL_IDN: rule("URL-006", "OBSERVATION", "INFO", "Hostname is internationalized (punycode)"),
  URL_JOB_PLATFORM: rule("URL-009", "OBSERVATION", "INFO", "Link is hosted on a known job platform / applicant-tracking system"),
  URL_HOSTNAME: rule("URL-010", "OBSERVATION", "INFO", "Hostname extracted from the submitted link"),
  URL_SOCIAL_MEDIA_HOST: rule("URL-011", "OBSERVATION", "INFO", "Link points to a social media or public video platform"),

  // Domain name vs claimed company
  DOM_LOOKALIKE: rule("DOM-001", "RISK_SIGNAL", "MEDIUM", "Hostname is a near-miss spelling of the claimed company name", "lookalike"),
  DOM_EXTRA_WORDS: rule("DOM-002", "RISK_SIGNAL", "LOW", "Hostname wraps the claimed company name in extra words", "lookalike"),
  DOM_NO_NAME: rule("DOM-003", "OBSERVATION", "INFO", "Hostname does not contain the claimed company name"),
  DOM_EXACT_NAME: rule("DOM-004", "OBSERVATION", "INFO", "Hostname contains the claimed company name"),
  /** Reserved for a future domain-registration provider; never emitted without real registration data. */
  DOM_RECENTLY_REGISTERED: rule("DOM-010", "RISK_SIGNAL", "LOW", "Domain was registered recently (requires registration data)", "domain-age"),

  // Submitted text
  TXT_PAYMENT: rule("TXT-001", "RISK_SIGNAL", "HIGH", "Text asks the candidate to pay a fee, deposit or purchase", "upfront-payment"),
  TXT_SENSITIVE: rule("TXT-002", "RISK_SIGNAL", "MEDIUM", "Text asks for banking, identity or one-time-password details", "sensitive-data"),
  TXT_OFF_PLATFORM: rule("TXT-003", "RISK_SIGNAL", "LOW", "Text moves the process to a chat app (Telegram/WhatsApp…)", "off-platform"),
  TXT_PRESSURE: rule("TXT-004", "RISK_SIGNAL", "LOW", "Text uses urgency or skips the interview", "pressure"),
  TXT_FREE_EMAIL: rule("TXT-005", "OBSERVATION", "INFO", "A contact email uses a free consumer email provider"),
  TXT_COMPENSATION: rule("TXT-006", "OBSERVATION", "INFO", "Compensation claim stated in the text"),
  TXT_ORGANIZATIONS: rule("TXT-007", "OBSERVATION", "INFO", "Organization names mentioned in the text"),
  TXT_NO_PAYMENT: rule("TXT-008", "OBSERVATION", "INFO", "No payment-request language detected in the text"),
  TXT_EMAILS: rule("TXT-009", "OBSERVATION", "INFO", "Contact email addresses found in the text"),

  // Corroboration (only from configured providers)
  COR_CONFIRMED: rule("COR-001", "CORROBORATION", "INFO", "A configured source confirms the company/opportunity"),
  COR_CONTRADICTED: rule("COR-002", "RISK_SIGNAL", "HIGH", "A configured source contradicts the submission", "official-contradiction"),
  COR_NOT_FOUND: rule("COR-003", "OBSERVATION", "INFO", "A configured source had no matching record"),
  REC_DOMAIN_MATCH: rule("REC-001", "CORROBORATION", "INFO", "Recruiter email domain matches an officially listed domain"),
  REC_DOMAIN_MISMATCH: rule("REC-002", "RISK_SIGNAL", "MEDIUM", "Recruiter email domain differs from the officially listed domains", "official-domain-mismatch"),
} as const satisfies Record<string, RuleDefinition>;

export type RuleKey = keyof typeof RULES;

/** Plain-language names for signal groups, used in rationale text. */
export const GROUP_LABEL: Record<string, string> = {
  transport: "unencrypted http link",
  "host-form": "unusual link host or port",
  "destination-hidden": "shortened link",
  lookalike: "lookalike website name",
  "domain-age": "recently registered domain",
  "upfront-payment": "request for payment",
  "sensitive-data": "request for sensitive details",
  "off-platform": "chat-app contact",
  pressure: "urgency or no interview",
  "official-contradiction": "contradicted by an official source",
  "official-domain-mismatch": "recruiter domain differs from official domain",
};

const groupNames = (gs: { group: string }[]) => gs.map((g) => GROUP_LABEL[g.group] ?? g.group).join(", ");

const SEVERITY_RANK: Record<Severity, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b];
}

export interface SignalGroupSummary {
  group: string;
  severity: Severity;
  findingIds: string[];
  ruleIds: string[];
}

/** Collapses risk signals by group so one underlying signal is never counted twice. */
export function groupRiskSignals(findings: Finding[]): SignalGroupSummary[] {
  const groups = new Map<string, SignalGroupSummary>();
  for (const f of findings) {
    if (f.kind !== "RISK_SIGNAL" || f.severity === "INFO") continue;
    const key = f.signalGroup ?? f.ruleId;
    const g = groups.get(key) ?? { group: key, severity: f.severity, findingIds: [], ruleIds: [] };
    if (compareSeverity(f.severity, g.severity) > 0) g.severity = f.severity;
    g.findingIds.push(f.id);
    if (!g.ruleIds.includes(f.ruleId)) g.ruleIds.push(f.ruleId);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => compareSeverity(b.severity, a.severity));
}

export interface AssessmentDecision {
  assessment: Assessment;
  confidence: Confidence | null;
  /** Assessment-rule IDs (ASSESS-*) plus the finding rule IDs that drove the decision. */
  triggeredRuleIds: string[];
  rationale: string[];
  groups: SignalGroupSummary[];
}

/** Minimum submitted-text length for "no concerning language" to count as meaningful coverage. */
export const MIN_MEANINGFUL_TEXT = 80;

/**
 * ASSESS-1  any HIGH group                         → HIGH_RISK
 * ASSESS-2  any MEDIUM group                       → NEEDS_REVIEW
 * ASSESS-3  ≥2 LOW groups, no official confirmation → NEEDS_REVIEW
 * ASSESS-4  official confirmation, nothing above   → LOWER_CONCERN (MODERATE)
 * ASSESS-5  meaningful text analysed, nothing above → INSUFFICIENT_DATA (no confidence; coverage noted)
 * ASSESS-6  otherwise                              → INSUFFICIENT_DATA (no confidence)
 *
 * Only an official corroboration (ASSESS-4) can produce LOWER_CONCERN; absence of warnings never does.
 */
export function evaluateAssessment(
  findings: Finding[],
  checks: CheckResult[],
  context: { textLength: number }
): AssessmentDecision {
  const groups = groupRiskSignals(findings);
  const high = groups.filter((g) => g.severity === "HIGH");
  const medium = groups.filter((g) => g.severity === "MEDIUM");
  const low = groups.filter((g) => g.severity === "LOW");
  const officialConfirmation = findings.filter(
    (f) => f.kind === "CORROBORATION" && f.sourceType === "OFFICIAL"
  );
  const completed = (id: CheckResult["id"]) => checks.some((c) => c.id === id && c.status === "COMPLETED");
  const substantiveRan = checks.some(
    (c) => c.status === "COMPLETED" || c.status === "PARTIAL"
  );
  const ruleIdsOf = (gs: SignalGroupSummary[]) => gs.flatMap((g) => g.ruleIds);

  if (!substantiveRan) {
    return {
      assessment: "INSUFFICIENT_DATA",
      confidence: null,
      triggeredRuleIds: ["ASSESS-6"],
      rationale: ["No check completed, so there is nothing to base an assessment on."],
      groups,
    };
  }

  if (high.length > 0) {
    const fromOfficial = findings.some(
      (f) => f.kind === "RISK_SIGNAL" && f.severity === "HIGH" && f.sourceType === "OFFICIAL"
    );
    const independentGroups = high.length + medium.length;
    const rationale = [
      `${high.length} high-severity signal${high.length > 1 ? "s" : ""} found (${groupNames(high)}).`,
    ];
    if (officialConfirmation.length > 0) {
      rationale.push("A configured source also confirmed parts of the submission; the high-severity signal is still reported because it concerns what the candidate is being asked to do.");
    }
    return {
      assessment: "HIGH_RISK",
      confidence: fromOfficial || independentGroups >= 2 ? "HIGH" : "MODERATE",
      triggeredRuleIds: ["ASSESS-1", ...ruleIdsOf(high), ...ruleIdsOf(medium)],
      rationale,
      groups,
    };
  }

  if (medium.length > 0) {
    return {
      assessment: "NEEDS_REVIEW",
      confidence: medium.length + low.length >= 2 ? "MODERATE" : "LOW",
      triggeredRuleIds: ["ASSESS-2", ...ruleIdsOf(medium), ...ruleIdsOf(low)],
      rationale: [
        `${medium.length} medium-severity signal${medium.length > 1 ? "s" : ""} need${medium.length > 1 ? "" : "s"} follow-up (${groupNames(medium)}).`,
      ],
      groups,
    };
  }

  if (low.length >= 2 && officialConfirmation.length === 0) {
    return {
      assessment: "NEEDS_REVIEW",
      confidence: "LOW",
      triggeredRuleIds: ["ASSESS-3", ...ruleIdsOf(low)],
      rationale: [
        `${low.length} separate low-severity signals (${groupNames(low)}). Each is weak alone; together they merit a closer look.`,
      ],
      groups,
    };
  }

  const lowNote =
    low.length > 0
      ? [`${low.length} low-severity signal${low.length > 1 ? "s were" : " was"} noted but ${low.length > 1 ? "are" : "is"} not decisive on ${low.length > 1 ? "their" : "its"} own.`]
      : [];

  if (officialConfirmation.length > 0) {
    return {
      assessment: "LOWER_CONCERN",
      confidence: "MODERATE",
      triggeredRuleIds: ["ASSESS-4", ...officialConfirmation.map((f) => f.ruleId)],
      rationale: ["A configured official source corroborated the submission and no material risk signals were found.", ...lowNote],
      groups,
    };
  }

  const hasSocialMedia = findings.some((f) => f.ruleId === "URL-011");
  if (hasSocialMedia) {
    return {
      assessment: "INSUFFICIENT_DATA",
      confidence: null,
      triggeredRuleIds: ["ASSESS-6", "URL-011"],
      rationale: [
        "The link points to a social-media post or video. The post was not retrieved, and a social-media post is not a primary employer source, so the link alone can't support an assessment.",
        "Look for the same role on the employer's own careers page, reached independently.",
        ...lowNote,
      ],
      groups,
    };
  }

  // Not finding known warning patterns is not evidence of legitimacy, so analysed text with no
  // material signals stays INSUFFICIENT_DATA; the rationale records what was covered.
  const textAnalysed = completed("content.payment") && context.textLength >= MIN_MEANINGFUL_TEXT;
  if (textAnalysed) {
    return {
      assessment: "INSUFFICIENT_DATA",
      confidence: null,
      triggeredRuleIds: ["ASSESS-5"],
      rationale: [
        `The submitted text (${context.textLength} characters) was scanned and contained none of the payment, sensitive-detail or pressure patterns this build looks for.`,
        "Not finding those patterns does not show the opportunity is genuine, and the company was not independently corroborated.",
        ...lowNote,
      ],
      groups,
    };
  }

  return {
    assessment: "INSUFFICIENT_DATA",
    confidence: null,
    triggeredRuleIds: ["ASSESS-6"],
    rationale: [
      "Only local checks on the link's structure ran. They found no decisive signals, but they cannot tell whether the opportunity is genuine.",
      ...lowNote,
    ],
    groups,
  };
}
