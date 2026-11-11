import { ModelOutputSchema, ResearchReportSchema, PROMPT_VERSION, REPORT_SCHEMA_VERSION, ResearchError, type Citation, type ModelOutput, type ResearchReport, type ResearchSource } from "./types";

export interface FetchedPage {
  url: string;
  title?: string;
  text: string;
  retrievedAt: string;
}

const FORBIDDEN_CLAIMS = /(100\s*%\s*(legit|safe|genuine|authentic)|guarantee[ds]?\s+(legit|safe|genuine|authentic|scam)|certified\s+(legit|authentic|genuine|safe)|verified\s+authentic|scam[- ]free|definitely\s+(legit|safe|genuine))/i;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** URL equality that ignores fragments and a trailing slash. */
function canonical(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** Extracts the single JSON object from model text, tolerating code fences. Never evaluates anything. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ResearchError("INVALID_OUTPUT", "The model did not return a JSON object.", true);
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    throw new ResearchError("INVALID_OUTPUT", "The model returned malformed JSON.", true);
  }
}

export interface BuildReportArgs {
  rawText: string;
  fetched: FetchedPage | null;
  citations: Citation[];
  attemptedFetch: boolean;
  fetchReason?: string;
  injectionDetected: boolean;
  now: string;
}

/**
 * Validates model output and turns it into the stored report. Facts must cite a source we actually
 * hold (the page we retrieved, or a citation the provider's search returned), and a quote from a
 * retrieved page must really appear in that page. Unsupported facts are dropped and counted, never guessed.
 */
export function buildReport(args: BuildReportArgs): ResearchReport {
  const parsed = ModelOutputSchema.safeParse(extractJson(args.rawText));
  if (!parsed.success) throw new ResearchError("INVALID_OUTPUT", "The model output did not match the report schema.", true);
  const out: ModelOutput = parsed.data;

  const prose = [out.summary, ...out.inferences.map((i) => i.statement), ...out.nextSteps, out.company.summary ?? ""].join(" \n ");
  if (FORBIDDEN_CLAIMS.test(prose)) throw new ResearchError("INVALID_OUTPUT", "The model made an absolute legitimacy claim, which is not allowed.", true);

  const sources: ResearchSource[] = [];
  const byUrl = new Map<string, ResearchSource & { pageText?: string }>();
  const add = (s: ResearchSource & { pageText?: string }) => {
    byUrl.set(canonical(s.url), s);
    sources.push({ id: s.id, title: s.title, url: s.url, retrievedAt: s.retrievedAt, excerpt: s.excerpt, origin: s.origin });
  };

  if (args.fetched) {
    add({
      id: "src-1",
      title: (args.fetched.title || new URL(args.fetched.url).hostname).slice(0, 300),
      url: args.fetched.url,
      retrievedAt: args.fetched.retrievedAt,
      excerpt: args.fetched.text.slice(0, 280),
      origin: "retrieved_page",
      pageText: norm(args.fetched.text),
    });
  }
  for (const c of args.citations) {
    const key = canonical(c.url);
    if (byUrl.has(key)) continue;
    try {
      const u = new URL(c.url);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    } catch {
      continue;
    }
    add({ id: `src-${sources.length + 1}`, title: (c.title || new URL(c.url).hostname).slice(0, 300), url: c.url, retrievedAt: args.now, excerpt: "", origin: "provider_search" });
  }

  let dropped = 0;
  const facts: ResearchReport["facts"] = [];
  for (const f of out.facts) {
    const src = byUrl.get(canonical(f.sourceUrl));
    if (!src) {
      dropped++;
      continue;
    }
    if (src.pageText !== undefined && !src.pageText.includes(norm(f.quote))) {
      dropped++;
      continue;
    }
    facts.push({ statement: f.statement, sourceId: src.id, quote: f.quote.slice(0, 400) });
    const stored = sources.find((s) => s.id === src.id);
    if (stored && src.origin === "provider_search" && !stored.excerpt) stored.excerpt = f.quote.slice(0, 280);
  }

  // Without any fact we hold evidence for, "no major red flags" is not supportable.
  let status = out.status;
  let confidence = out.confidence;
  if (status === "no_major_red_flags_found" && facts.length === 0) {
    status = "insufficient_evidence";
    confidence = "low";
  }

  const report: ResearchReport = {
    status,
    confidence,
    summary: out.summary,
    company: { name: out.company.name, officialUrl: out.company.officialUrl, summary: out.company.summary },
    role: out.role,
    recruiter: { name: out.recruiter.name, contact: out.recruiter.contact, corroboration: out.recruiter.corroboration, notes: out.recruiter.notes },
    facts,
    submittedClaims: out.submittedClaims,
    inferences: out.inferences,
    unknowns: out.unknowns,
    riskIndicators: out.riskIndicators,
    feeOrPaymentRequests: out.feeOrPaymentRequests,
    missingEvidence: out.missingEvidence,
    nextSteps: out.nextSteps,
    sources,
    droppedUnsupportedFacts: dropped,
    promptInjectionDetected: args.injectionDetected,
    pageRetrieval: { attempted: args.attemptedFetch, ok: Boolean(args.fetched), reason: args.fetchReason },
    researchedAt: args.now,
    schemaVersion: REPORT_SCHEMA_VERSION,
    promptVersion: PROMPT_VERSION,
  };

  if (args.injectionDetected && !report.riskIndicators.some((r) => /instruct|prompt|AI/i.test(r.indicator))) {
    report.riskIndicators.push({ indicator: "The submitted content contains instructions aimed at an AI system, which legitimate recruiters do not send.", severity: "medium", basis: "submitted_text" });
    if (report.status === "no_major_red_flags_found") report.status = "needs_caution";
  }
  return ResearchReportSchema.parse(report);
}
