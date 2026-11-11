/**
 * Deterministic report narrative built only from structured findings.
 *
 * An optional AI explanation provider could later implement ExplanationProvider, but it
 * must only rephrase: every claim must cite existing finding/evidence IDs, and it may not
 * add facts or sources. No AI provider is configured in this build.
 */

import type { CheckResult, Finding, VerificationReport } from "@/types/verification";
import { compareSeverity, type AssessmentDecision } from "./rules";

export interface Narrative {
  summary: string;
  nextSteps: string[];
}

export interface ExplanationProvider {
  id: string;
  explain(decision: AssessmentDecision, findings: Finding[], checks: CheckResult[]): Promise<Narrative>;
}

const GROUP_NEXT_STEPS: Record<string, string> = {
  "upfront-payment":
    "Don't pay any fee, deposit or purchase to get or keep this offer. Ask the company whether the payment is genuine using contact details from its official website, not from the message.",
  "sensitive-data":
    "Don't share OTPs, passwords, card numbers or ID documents over chat or email. Genuine onboarding uses the employer's official HR systems after you hold a verifiable offer.",
  "off-platform":
    "Ask for an interview invitation from an official company email address before continuing on chat apps.",
  pressure:
    "Take the time you need. Genuine employers rarely require a decision within hours or hire without any interview.",
  lookalike:
    "Type the company's official website address yourself (or find it through a search engine) and look for this role on its careers page.",
  "host-form":
    "Treat links with a raw IP address or unusual port with caution; look for the same posting on the company's own website.",
  "destination-hidden":
    "Ask for the full, un-shortened link, or find the posting directly on the company's site.",
  transport:
    "Avoid entering personal details on http:// pages; check whether the company's official site offers the same page over https://.",
  "official-contradiction":
    "Contact the company through its official website to confirm whether this posting or recruiter is genuine.",
  "official-domain-mismatch":
    "Confirm the recruiter's identity with the company through its official website before sharing documents.",
};

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join("; ")}; and ${items[items.length - 1]}`;
}

function topSignalTitles(decision: AssessmentDecision, findings: Finding[]): string[] {
  const byId = new Map(findings.map((f) => [f.id, f]));
  return decision.groups
    .map((g) => byId.get(g.findingIds[0])?.title)
    .filter((t): t is string => Boolean(t))
    .slice(0, 3)
    .map((t) => t.charAt(0).toLowerCase() + t.slice(1));
}

export function buildNarrative(decision: AssessmentDecision, findings: Finding[], checks: CheckResult[]): Narrative {
  const unavailable = checks.filter((c) => c.status === "UNAVAILABLE").length;
  const signals = topSignalTitles(decision, findings);
  let summary: string;

  switch (decision.assessment) {
    case "HIGH_RISK":
      summary = `Strong caution signals were found: ${list(signals)}. This is not proof of fraud, but these requests are commonly associated with recruitment scams. Don't send money or sensitive details until you have confirmed the opportunity through the company's official channels.`;
      break;
    case "NEEDS_REVIEW":
      summary = `Some details need follow-up before you rely on this opportunity: ${list(signals)}. None of these alone proves a problem.`;
      break;
    case "LOWER_CONCERN":
      summary = `The checks that ran did not find material concerns. This is not a guarantee of legitimacy${unavailable > 0 ? `: ${unavailable} check${unavailable > 1 ? "s were" : " was"} unavailable in this build` : ""}.`;
      break;
    case "INSUFFICIENT_DATA":
    default:
      summary = `There isn't enough evidence for a useful assessment. Only local checks ran${unavailable > 0 ? `, and ${unavailable} check${unavailable > 1 ? "s" : ""} (such as domain registration, page content and company corroboration) ${unavailable > 1 ? "are" : "is"} unavailable in this build` : ""}. ${
        decision.groups.length > 0
          ? "The signals noted are weak on their own"
          : "No warning pattern was found"
      }, but that does not mean the opportunity is safe.`;
      break;
  }

  const steps: string[] = [];
  for (const g of [...decision.groups].sort((a, b) => compareSeverity(b.severity, a.severity))) {
    const step = GROUP_NEXT_STEPS[g.group];
    if (step && !steps.includes(step)) steps.push(step);
  }
  const ranText = checks.some((c) => c.id === "content.payment" && c.status === "COMPLETED");
  if (decision.assessment === "INSUFFICIENT_DATA" && !ranText) {
    steps.push("Add the recruiter's message or the job description (Recruiter Message tab in Core) so its content can be analysed.");
  }
  if (decision.assessment !== "HIGH_RISK") {
    steps.push("Find this role on the company's official careers page, reached by typing the company's address yourself rather than following links in messages.");
  }
  steps.push("If anyone later asks for money, banking details or OTPs, stop and re-check before responding.");

  return { summary, nextSteps: steps.slice(0, 5) };
}

export const deterministicExplanationProvider: ExplanationProvider = {
  id: "deterministic-templates",
  explain: async (decision, findings, checks) => buildNarrative(decision, findings, checks),
};

const SEVERITY_ORDER = ["HIGH", "MEDIUM", "LOW", "INFO"] as const;
const PREVIEW_OBSERVATION_RULES = ["URL-010", "TXT-008", "URL-009", "TXT-005", "DOM-003", "DOM-004"];

/**
 * Picks at most `max` findings for the guest preview: strongest risk signals first (one per
 * group), then corroboration, then the most useful observations.
 */
export function selectKeyFindings(report: VerificationReport, max = 2): Finding[] {
  const out: Finding[] = [];
  const seenGroups = new Set<string>();
  const risks = report.findings
    .filter((f) => f.kind === "RISK_SIGNAL")
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  for (const f of risks) {
    const g = f.signalGroup ?? f.ruleId;
    if (seenGroups.has(g)) continue;
    seenGroups.add(g);
    out.push(f);
  }
  out.push(...report.findings.filter((f) => f.kind === "CORROBORATION"));
  for (const ruleId of PREVIEW_OBSERVATION_RULES) {
    const f = report.findings.find((x) => x.ruleId === ruleId);
    if (f) out.push(f);
  }
  return out.slice(0, max);
}
