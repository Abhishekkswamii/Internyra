/**
 * Starter verification pipeline. Pure and deterministic given its inputs and `deps`;
 * independent of React/Next so it can later run in a background worker.
 */

import {
  CASE_SCHEMA_VERSION,
  type CheckCategory,
  type CheckId,
  type CheckResult,
  type CheckStatus,
  type Confidence,
  type Evidence,
  type Finding,
  type LifecycleState,
  type Provenance,
  type VerificationCase,
  type VerificationReport,
  type VerificationRequest,
} from "@/types/verification";
import type { CorroborationProvider, CorroborationResult } from "./corroboration";
import { deterministicExplanationProvider, type ExplanationProvider } from "./explain";
import { JOB_PLATFORM_HOSTS, SOCIAL_MEDIA_HOSTS, URL_SHORTENER_HOSTS, matchHostList, registrableDomain } from "./lists";
import { RULES, evaluateAssessment, type RuleDefinition } from "./rules";
import { analyzeText, type TextAnalysis } from "./text";
import { validateUrl, type NormalizedUrl } from "./url";
import { ENGINE_VERSION, LOCAL_LISTS_VERSION, RULESET_VERSION } from "./version";

export interface EngineDeps {
  now?: () => Date;
  generateCaseId?: () => string;
  corroborationProviders?: CorroborationProvider[];
  explanationProvider?: ExplanationProvider;
  providerTimeoutMs?: number;
}

export function defaultCaseId(): string {
  return `case_${globalThis.crypto.randomUUID()}`;
}

class ReportBuilder {
  readonly checks: CheckResult[] = [];
  readonly findings: Finding[] = [];
  readonly evidence: Evidence[] = [];
  readonly limitations: string[] = [];

  constructor(private readonly at: string) {}

  addEvidence(e: Omit<Evidence, "id" | "findingIds" | "capturedAt"> & { capturedAt?: string }): string {
    const id = `ev-${this.evidence.length + 1}`;
    this.evidence.push({ capturedAt: this.at, ...e, id, findingIds: [] });
    return id;
  }

  addFinding(
    rule: RuleDefinition,
    f: {
      checkId: CheckId;
      category: CheckCategory;
      title: string;
      explanation: string;
      observationSummary: string;
      evidenceIds: string[];
      sourceType: Provenance;
      limitation: string;
      confidence?: Confidence;
    }
  ): string {
    const id = `f-${this.findings.length + 1}`;
    this.findings.push({
      id,
      ruleId: rule.id,
      ruleVersion: rule.version,
      kind: rule.kind,
      severity: rule.severity,
      signalGroup: rule.signalGroup,
      detectedAt: this.at,
      ...f,
    });
    for (const evId of f.evidenceIds) this.evidence.find((e) => e.id === evId)?.findingIds.push(id);
    return id;
  }

  check(id: CheckId, name: string, category: CheckCategory, status: CheckStatus, summary: string, reason?: string) {
    this.checks.push({
      id,
      name,
      category,
      status,
      summary,
      reason,
      completedAt: status === "COMPLETED" || status === "PARTIAL" ? this.at : undefined,
    });
    if (status === "UNAVAILABLE" || status === "FAILED") {
      this.limitations.push(`${name}: ${reason ?? summary}`);
    }
  }
}

// ---------------------------------------------------------------------------
// URL checks

function runUrlChecks(b: ReportBuilder, url: NormalizedUrl) {
  const registrable = url.ipLiteral ? url.hostname : registrableDomain(url.hostname);
  const urlEv = b.addEvidence({
    type: "URL_ANALYSIS",
    title: "Submitted link, parsed locally",
    sourceUrl: url.normalized,
    sourceDomain: url.hostname,
    data: {
      scheme: url.scheme,
      hostname: url.hostname,
      displayHostname: url.displayHostname,
      registrableDomain: registrable,
      port: url.port,
      ipLiteral: url.ipLiteral ? `IPv${url.ipLiteral.version} (${url.ipLiteral.class})` : null,
      internationalized: url.isInternationalized,
      pathAndQueryLength: url.pathAndQueryLength,
    },
    retrievalStatus: "LOCAL_ANALYSIS",
    provenance: "USER_SUPPLIED",
  });

  b.check("input.url", "Link validation & normalization", "input", "COMPLETED", `Valid ${url.scheme}:// link to ${url.displayHostname}.`);

  b.addFinding(RULES.URL_HOSTNAME, {
    checkId: "input.url",
    category: "domain",
    title: `Link points to ${url.displayHostname}`,
    explanation: "This is the website the link actually opens. Compare it with the company's official website address, which you should find independently.",
    observationSummary: url.isInternationalized
      ? `Hostname ${url.displayHostname} (encoded as ${url.hostname}).`
      : `Hostname ${url.hostname}${url.port ? ` on port ${url.port}` : ""}.`,
    evidenceIds: [urlEv],
    sourceType: "USER_SUPPLIED",
    limitation: "Seeing the hostname does not tell us who owns it.",
  });

  const structureNotes: string[] = [];

  if (url.scheme === "http") {
    structureNotes.push("plain http");
    b.addFinding(RULES.URL_PLAIN_HTTP, {
      checkId: "url.structure",
      category: "domain",
      title: "Link uses unencrypted http://",
      explanation: "Pages served over http:// can be read or altered in transit, so avoid entering personal details on them. Many legitimate sites still have old http:// links, so this is not evidence of fraud.",
      observationSummary: "Scheme is http, not https.",
      evidenceIds: [urlEv],
      sourceType: "LOCAL_HEURISTIC",
      limitation: "The site may redirect to https://; redirects were not followed in this build.",
    });
  }

  if (url.ipLiteral) {
    structureNotes.push("IP address host");
    const cls = url.ipLiteral.class;
    b.addFinding(RULES.URL_IP_LITERAL, {
      checkId: "url.structure",
      category: "domain",
      title: "Link uses a raw IP address instead of a website name",
      explanation:
        cls === "public"
          ? "Employers almost always publish job pages under their own domain name. A bare IP address hides who operates the site."
          : `This address is in a ${cls} range, meaning it is not a normal public website. It may only work on a specific network.`,
      observationSummary: `Host is IPv${url.ipLiteral.version} address ${url.hostname} (${cls} range).`,
      evidenceIds: [urlEv],
      sourceType: "LOCAL_HEURISTIC",
      limitation: "Some internal or test systems legitimately use IP addresses.",
    });
  }

  if (url.port !== null) {
    structureNotes.push(`port ${url.port}`);
    b.addFinding(RULES.URL_NONSTANDARD_PORT, {
      checkId: "url.structure",
      category: "domain",
      title: `Link uses non-standard port ${url.port}`,
      explanation: "Public careers pages normally use the default web ports. An explicit port is unusual and worth a second look.",
      observationSummary: `Explicit port ${url.port} in the link.`,
      evidenceIds: [urlEv],
      sourceType: "LOCAL_HEURISTIC",
      limitation: "Unusual ports are also used by legitimate staging or self-hosted systems.",
    });
  }

  const shortener = url.ipLiteral ? undefined : matchHostList(url.hostname, URL_SHORTENER_HOSTS);
  if (shortener) {
    structureNotes.push("URL shortener");
    const listEv = b.addEvidence({
      type: "LOCAL_LIST_MATCH",
      title: "Matched local URL-shortener list",
      data: { matched: shortener, listVersion: LOCAL_LISTS_VERSION },
      retrievalStatus: "LOCAL_ANALYSIS",
      provenance: "LOCAL_HEURISTIC",
    });
    b.addFinding(RULES.URL_SHORTENER, {
      checkId: "url.structure",
      category: "domain",
      title: `Link uses the URL shortener ${shortener}`,
      explanation: "Shortened links hide the real destination. They are widely used legitimately, but the final page could not be checked here.",
      observationSummary: `Hostname matches ${shortener} on the local shortener list.`,
      evidenceIds: [urlEv, listEv],
      sourceType: "LOCAL_HEURISTIC",
      limitation: "The short link was not expanded because outbound fetching is disabled in this build.",
    });
  }

  if (url.isInternationalized) {
    if (url.hasMixedScripts) {
      structureNotes.push("mixed-script hostname");
      b.addFinding(RULES.URL_MIXED_SCRIPT, {
        checkId: "url.structure",
        category: "domain",
        title: "Hostname mixes Latin with Cyrillic or Greek letters",
        explanation: "Mixing alphabets in one name is a known way to imitate a familiar website (letters that look identical but are different characters).",
        observationSummary: `${url.displayHostname} is encoded as ${url.hostname}.`,
        evidenceIds: [urlEv],
        sourceType: "LOCAL_HEURISTIC",
        limitation: "Detects mixed scripts within a label only; whole-label lookalikes in a single alphabet are not detected.",
      });
    } else {
      b.addFinding(RULES.URL_IDN, {
        checkId: "url.structure",
        category: "domain",
        title: "Internationalized website name",
        explanation: "The website name uses non-ASCII characters. That is normal for many languages; both forms are shown so you can compare them.",
        observationSummary: `${url.displayHostname} is encoded as ${url.hostname}.`,
        evidenceIds: [urlEv],
        sourceType: "LOCAL_HEURISTIC",
        limitation: "Single-alphabet lookalike names are not detected.",
      });
    }
  }

  const platform = url.ipLiteral ? undefined : matchHostList(url.hostname, JOB_PLATFORM_HOSTS);
  if (platform) {
    const listEv = b.addEvidence({
      type: "LOCAL_LIST_MATCH",
      title: "Matched local job-platform list",
      data: { matched: platform, listVersion: LOCAL_LISTS_VERSION },
      retrievalStatus: "LOCAL_ANALYSIS",
      provenance: "LOCAL_HEURISTIC",
    });
    b.addFinding(RULES.URL_JOB_PLATFORM, {
      checkId: "url.structure",
      category: "domain",
      title: `Hosted on the job platform ${platform}`,
      explanation: "Many employers list roles on this platform, but so can anyone with an account. Where a listing is hosted does not establish who posted it.",
      observationSummary: `Hostname matches ${platform} on the local job-platform list.`,
      evidenceIds: [urlEv, listEv],
      sourceType: "LOCAL_HEURISTIC",
      limitation: "The listing itself was not fetched, so the employer named on it was not checked.",
    });
  }

  const socialMedia = url.ipLiteral ? undefined : matchHostList(url.hostname, SOCIAL_MEDIA_HOSTS);
  if (socialMedia) {
    structureNotes.push(`social media (${socialMedia})`);
    const listEv = b.addEvidence({
      type: "LOCAL_LIST_MATCH",
      title: "Matched social media / public video host",
      data: { matched: socialMedia, listVersion: LOCAL_LISTS_VERSION },
      retrievalStatus: "LOCAL_ANALYSIS",
      provenance: "LOCAL_HEURISTIC",
    });
    b.addFinding(RULES.URL_SOCIAL_MEDIA_HOST, {
      checkId: "url.structure",
      category: "domain",
      title: `Link points to social media (${socialMedia})`,
      explanation: "A social-media post is not a primary employer source: anyone can publish one, and what it says about a role or company can't be checked from the link. The post itself was not retrieved.",
      observationSummary: `Hostname matches ${socialMedia} on the local social-media host list.`,
      evidenceIds: [urlEv, listEv],
      sourceType: "LOCAL_HEURISTIC",
      limitation: "Only the hostname was classified. Confirm the role on the employer's own careers page, reached independently.",
    });
  }

  b.check(
    "url.structure",
    "Link structure heuristics",
    "domain",
    "COMPLETED",
    structureNotes.length ? `Noted: ${structureNotes.join(", ")}.` : "No unusual structure (scheme, port, IP host, shortener, mixed scripts)."
  );

  return { platform, urlEv };
}

// ---------------------------------------------------------------------------
// Claimed-company name comparison

const LEGAL_SUFFIXES = /\b(inc|llc|ltd|limited|pvt|private|corp|corporation|co|gmbh|plc|llp)\b\.?/g;

export function companySlug(name: string): string {
  return name.toLowerCase().replace(LEGAL_SUFFIXES, "").replace(/[^a-z0-9]/g, "");
}

function homoglyphFold(s: string): string {
  return s.replace(/rn/g, "m").replace(/vv/g, "w").replace(/0/g, "o").replace(/[1l|]/g, "i").replace(/5/g, "s");
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function runLookalikeCheck(b: ReportBuilder, url: NormalizedUrl | null, claimedCompany: string | undefined, platform: string | undefined, urlEv?: string) {
  const name = "Lookalike name comparison";
  if (!url) return b.check("domain.lookalike", name, "domain", "NOT_RUN", "No link was submitted.");
  if (!claimedCompany) {
    return b.check("domain.lookalike", name, "domain", "NOT_RUN", "No claimed company name was supplied to compare against.", "Add the claimed company name to compare it with the website name.");
  }
  if (url.ipLiteral || platform) {
    return b.check("domain.lookalike", name, "domain", "NOT_RUN", url.ipLiteral ? "The link uses an IP address, so there is no name to compare." : `The link is on ${platform}, a shared platform, so its name says nothing about the employer.`);
  }
  const slug = companySlug(claimedCompany);
  if (slug.length < 3) {
    return b.check("domain.lookalike", name, "domain", "NOT_RUN", "The claimed company name is too short for a meaningful comparison.");
  }

  const registrable = registrableDomain(url.hostname);
  const label = registrable.split(".")[0].replace(/-/g, "");
  const subdomainPart = url.hostname.slice(0, -registrable.length).replace(/[.-]/g, "");
  const distance = levenshtein(label, slug);
  const threshold = slug.length >= 8 ? 2 : 1;

  const cmpEv = b.addEvidence({
    type: "NAME_COMPARISON",
    title: "Claimed company name compared with website name",
    data: { claimedCompany, normalizedName: slug, domainLabel: label, editDistance: distance },
    retrievalStatus: "LOCAL_ANALYSIS",
    provenance: "LOCAL_HEURISTIC",
  });
  const evidenceIds = urlEv ? [urlEv, cmpEv] : [cmpEv];
  const common = { checkId: "domain.lookalike" as const, category: "domain" as const, evidenceIds, sourceType: "LOCAL_HEURISTIC" as const };
  let summary: string;

  if (label === slug) {
    summary = "Website name contains the claimed company name.";
    b.addFinding(RULES.DOM_EXACT_NAME, {
      ...common,
      title: `Website name matches "${claimedCompany}"`,
      explanation: "The domain contains the company name you entered. Anyone can register a matching name, so this is not confirmation that the company owns it.",
      observationSummary: `Domain label "${label}" equals the normalized name "${slug}".`,
      limitation: "Ownership of the domain was not checked.",
    });
  } else if (homoglyphFold(label) === homoglyphFold(slug) || (slug.length >= 5 && distance > 0 && distance <= threshold)) {
    summary = "Website name is a near-miss spelling of the claimed company name.";
    b.addFinding(RULES.DOM_LOOKALIKE, {
      ...common,
      title: `Website name "${label}" closely resembles "${slug}"`,
      explanation: "The domain differs from the company name by only a character or two, or by look-alike characters. Impersonators use near-miss names; genuine companies occasionally do too.",
      observationSummary: `"${label}" vs "${slug}": ${distance} character edit${distance === 1 ? "" : "s"}.`,
      limitation: "Based only on the company name you entered; the company's real domain was not looked up.",
      confidence: "MODERATE",
    });
  } else if (label.includes(slug) || subdomainPart.includes(slug)) {
    summary = "Claimed company name appears with extra words or only as a subdomain.";
    b.addFinding(RULES.DOM_EXTRA_WORDS, {
      ...common,
      title: label.includes(slug) ? `Company name wrapped in extra words ("${registrable}")` : `Company name appears only as a subdomain of ${registrable}`,
      explanation: "Domains such as company-careers-hiring.com or company.some-portal.com can be legitimate, but impersonators use them too. Check the company's official site for this role.",
      observationSummary: `Name "${slug}" found within ${url.hostname}, registrable domain ${registrable}.`,
      limitation: "Recruitment platforms commonly host employers on subdomains; the platform was not recognised from the local list.",
    });
  } else {
    summary = "Website name does not contain the claimed company name.";
    b.addFinding(RULES.DOM_NO_NAME, {
      ...common,
      title: "Website name doesn't include the claimed company name",
      explanation: "This is common (parent companies, recruitment agencies, applicant-tracking systems) and not a warning on its own.",
      observationSummary: `"${slug}" not found in ${url.hostname}.`,
      limitation: "Based only on the company name you entered.",
    });
  }
  b.check("domain.lookalike", name, "domain", "COMPLETED", summary);
}

// ---------------------------------------------------------------------------
// Text checks

function runTextChecks(b: ReportBuilder, t: TextAnalysis | null) {
  const notRun = "No message or document text was supplied.";
  if (!t) {
    b.check("content.payment", "Payment-request language", "content", "NOT_RUN", notRun);
    b.check("content.sensitive-data", "Sensitive-detail requests", "content", "NOT_RUN", notRun);
    b.check("content.contact-patterns", "Contact & pressure patterns", "content", "NOT_RUN", notRun);
    b.check("content.entities", "Names, emails & compensation extraction", "content", "NOT_RUN", notRun);
    return;
  }

  const excerptEv = (title: string, excerpt: string) =>
    b.addEvidence({ type: "TEXT_EXCERPT", title, excerpt, retrievalStatus: "LOCAL_ANALYSIS", provenance: "USER_SUPPLIED" });

  // Payment
  if (t.paymentRequests.length) {
    const ids = t.paymentRequests.map((m) => excerptEv("Excerpt from your submission", m.excerpt));
    b.addFinding(RULES.TXT_PAYMENT, {
      checkId: "content.payment",
      category: "content",
      title: "Asks you to pay a fee, deposit or purchase",
      explanation: "Requests for application, training, equipment or security fees — or to deposit a cheque and send money on — are among the most common internship-scam patterns. Genuine employers do not charge candidates to be hired.",
      observationSummary: `Payment language found: "${t.paymentRequests[0].matched}".`,
      evidenceIds: ids,
      sourceType: "USER_SUPPLIED",
      confidence: "MODERATE",
      limitation: "Pattern matching on the text you supplied; the sender's identity and intent were not verified.",
    });
    b.check("content.payment", "Payment-request language", "content", "COMPLETED", `${t.paymentRequests.length} payment request${t.paymentRequests.length > 1 ? "s" : ""} found.`);
  } else {
    const ids = t.paymentReassurances.map((m) => excerptEv("Statement about fees in your submission", m.excerpt));
    b.addFinding(RULES.TXT_NO_PAYMENT, {
      checkId: "content.payment",
      category: "content",
      title: "No request for payment found in the text",
      explanation: "The supplied text doesn't ask you to pay a fee, deposit or purchase. That's a good sign as far as it goes, but scams sometimes ask for money later.",
      observationSummary: t.paymentReassurances.length ? `Text states: "${t.paymentReassurances[0].matched}".` : `Scanned ${t.length} characters.`,
      evidenceIds: ids,
      sourceType: "LOCAL_HEURISTIC",
      limitation: "Absence of payment language is not evidence that the opportunity is genuine.",
    });
    b.check("content.payment", "Payment-request language", "content", "COMPLETED", "No payment request found.");
  }

  // Sensitive data
  if (t.sensitiveDataRequests.length) {
    const ids = t.sensitiveDataRequests.map((m) => excerptEv("Excerpt from your submission", m.excerpt));
    b.addFinding(RULES.TXT_SENSITIVE, {
      checkId: "content.sensitive-data",
      category: "content",
      title: "Asks for banking, identity or one-time-password details",
      explanation: "Sharing OTPs, passwords, card details or ID documents before a verified offer enables account takeover and identity fraud. Payroll details are normally collected later through official HR systems.",
      observationSummary: `Requested detail: "${t.sensitiveDataRequests[0].matched}".`,
      evidenceIds: ids,
      sourceType: "USER_SUPPLIED",
      limitation: "Genuine employers do collect some of these details after hiring; context matters.",
    });
  }
  b.check("content.sensitive-data", "Sensitive-detail requests", "content", "COMPLETED", t.sensitiveDataRequests.length ? "Request for sensitive details found." : "No request for sensitive details found.");

  // Contact & pressure
  if (t.offPlatformContact.length) {
    b.addFinding(RULES.TXT_OFF_PLATFORM, {
      checkId: "content.contact-patterns",
      category: "recruiter",
      title: "Moves the conversation to a chat app",
      explanation: "Interviews or offers conducted only over Telegram/WhatsApp are harder to verify. Many recruiters use these apps legitimately, so this is a weak signal alone.",
      observationSummary: `Mentions "${t.offPlatformContact[0].matched}".`,
      evidenceIds: t.offPlatformContact.map((m) => excerptEv("Excerpt from your submission", m.excerpt)),
      sourceType: "USER_SUPPLIED",
      limitation: "Mentioning an app is not the same as requiring it.",
    });
  }
  if (t.pressureTactics.length) {
    b.addFinding(RULES.TXT_PRESSURE, {
      checkId: "content.contact-patterns",
      category: "content",
      title: "Uses urgency or skips the interview",
      explanation: "Pressure to decide within hours, or an offer without any interview, limits your chance to check the opportunity. Weak alone, but worth noticing.",
      observationSummary: `Phrase: "${t.pressureTactics[0].matched}".`,
      evidenceIds: t.pressureTactics.map((m) => excerptEv("Excerpt from your submission", m.excerpt)),
      sourceType: "USER_SUPPLIED",
      limitation: "Genuine deadlines exist; wording alone cannot show intent.",
    });
  }
  b.check("content.contact-patterns", "Contact & pressure patterns", "content", "COMPLETED", [t.offPlatformContact.length && "chat-app contact", t.pressureTactics.length && "urgency"].filter(Boolean).join(", ") || "None found.");

  // Entities
  if (t.emails.length) {
    const ev = b.addEvidence({
      type: "EXTRACTED_ENTITY",
      title: "Email addresses stated in your submission",
      data: Object.fromEntries(t.emails.map((e, i) => [`email${i + 1}`, e.address])),
      retrievalStatus: "LOCAL_ANALYSIS",
      provenance: "USER_SUPPLIED",
    });
    b.addFinding(RULES.TXT_EMAILS, {
      checkId: "content.entities",
      category: "recruiter",
      title: `Contact email${t.emails.length > 1 ? "s" : ""}: ${t.emails.map((e) => e.address).join(", ")}`,
      explanation: "Extracted from your submission. Who controls these addresses was not verified.",
      observationSummary: `Domains: ${[...new Set(t.emails.map((e) => e.domain))].join(", ")}.`,
      evidenceIds: [ev],
      sourceType: "USER_SUPPLIED",
      limitation: "Email sender addresses can be spoofed; message headers were not analysed.",
    });
    const free = t.emails.filter((e) => e.freeProvider);
    if (free.length) {
      b.addFinding(RULES.TXT_FREE_EMAIL, {
        checkId: "content.entities",
        category: "recruiter",
        title: `Uses a free email provider (${[...new Set(free.map((e) => e.freeProvider))].join(", ")})`,
        explanation: "Anyone can create these addresses. Small companies and individual recruiters use them legitimately, so on its own this does not indicate fraud — but it also gives no assurance of identity.",
        observationSummary: free.map((e) => e.address).join(", "),
        evidenceIds: [ev],
        sourceType: "LOCAL_HEURISTIC",
        limitation: "Not counted as a risk signal.",
      });
    }
  }
  if (t.compensationClaims.length) {
    b.addFinding(RULES.TXT_COMPENSATION, {
      checkId: "content.entities",
      category: "content",
      title: "Compensation stated in the text",
      explanation: "This is what the message claims. It was not checked against any other source.",
      observationSummary: `"${t.compensationClaims[0].matched}"`,
      evidenceIds: t.compensationClaims.map((m) => excerptEv("Excerpt from your submission", m.excerpt)),
      sourceType: "USER_SUPPLIED",
      limitation: "Unusually high pay for little work can be a lure; normal pay is not evidence of legitimacy.",
    });
  }
  if (t.organizationNames.length) {
    const ev = b.addEvidence({
      type: "EXTRACTED_ENTITY",
      title: "Organization names stated in your submission",
      data: Object.fromEntries(t.organizationNames.map((n, i) => [`organization${i + 1}`, n])),
      retrievalStatus: "LOCAL_ANALYSIS",
      provenance: "USER_SUPPLIED",
    });
    b.addFinding(RULES.TXT_ORGANIZATIONS, {
      checkId: "content.entities",
      category: "company",
      title: `Mentions ${t.organizationNames.join(", ")}`,
      explanation: "Names the text uses. Mentioning a company does not mean it is involved.",
      observationSummary: t.organizationNames.join("; "),
      evidenceIds: [ev],
      sourceType: "USER_SUPPLIED",
      limitation: "Simple pattern extraction; names without a legal suffix may be missed.",
    });
  }
  b.check("content.entities", "Names, emails & compensation extraction", "content", "COMPLETED", `${t.emails.length} email${t.emails.length === 1 ? "" : "s"}, ${t.organizationNames.length} organization name${t.organizationNames.length === 1 ? "" : "s"}, ${t.compensationClaims.length} compensation claim${t.compensationClaims.length === 1 ? "" : "s"}.`);
}

// ---------------------------------------------------------------------------
// Corroboration & recruiter-domain comparison

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(ctrl.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          ctrl.abort();
          reject(new Error("timeout"));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function runCorroboration(
  b: ReportBuilder,
  providers: CorroborationProvider[],
  query: { claimedCompany?: string; hostname?: string; recruiterEmailDomains: string[] },
  timeoutMs: number
): Promise<{ results: CorroborationResult[]; failed: boolean }> {
  const name = "Company & opportunity corroboration";
  if (providers.length === 0) {
    b.check("company.corroboration", name, "company", "UNAVAILABLE", "Not checked.", "No official careers-page, company-registry or third-party source is configured in this build, so the company was not independently corroborated.");
    return { results: [], failed: false };
  }
  if (!query.claimedCompany && !query.hostname) {
    b.check("company.corroboration", name, "company", "NOT_RUN", "Nothing to look up (no link or company name).");
    return { results: [], failed: false };
  }

  const results: CorroborationResult[] = [];
  const failures: string[] = [];
  for (const p of providers) {
    try {
      results.push(await withTimeout((signal) => p.lookup(query, signal), timeoutMs));
    } catch (err) {
      failures.push(`${p.name}: ${err instanceof Error && err.message === "timeout" ? "timed out" : "lookup failed"}`);
    }
  }

  for (const r of results) {
    const ev = b.addEvidence({
      type: "EXTERNAL_SOURCE",
      title: `${r.providerName} lookup`,
      sourceUrl: r.sourceUrl,
      sourceDomain: safeHost(r.sourceUrl),
      excerpt: r.summary,
      data: { status: r.status, officialDomains: r.officialDomains?.join(", ") ?? null },
      capturedAt: r.retrievedAt,
      retrievalStatus: "RETRIEVED",
      provenance: r.provenance,
    });
    const common = { checkId: "company.corroboration" as const, category: "company" as const, evidenceIds: [ev], sourceType: r.provenance, limitation: r.limitation };
    if (r.status === "CONFIRMED") {
      b.addFinding(RULES.COR_CONFIRMED, { ...common, title: `Corroborated by ${r.providerName}`, explanation: r.summary, observationSummary: r.summary, confidence: r.provenance === "OFFICIAL" ? "HIGH" : "MODERATE" });
    } else if (r.status === "CONTRADICTED") {
      b.addFinding(RULES.COR_CONTRADICTED, { ...common, title: `Contradicted by ${r.providerName}`, explanation: `A configured source states something that conflicts with this submission: ${r.summary}`, observationSummary: r.summary });
    } else {
      b.addFinding(RULES.COR_NOT_FOUND, { ...common, title: `No matching record in ${r.providerName}`, explanation: "The source had no record matching this submission. Missing records are common for new or small organisations and do not establish fraud.", observationSummary: r.summary });
    }
  }

  const status: CheckStatus = failures.length === 0 ? "COMPLETED" : results.length ? "PARTIAL" : "FAILED";
  b.check("company.corroboration", name, "company", status, results.length ? `${results.length} source${results.length > 1 ? "s" : ""} consulted.` : "No source responded.", failures.length ? failures.join("; ") : undefined);
  return { results, failed: failures.length > 0 };
}

function safeHost(u: string): string | undefined {
  try {
    return new URL(u).hostname;
  } catch {
    return undefined;
  }
}

function runRecruiterDomainCheck(b: ReportBuilder, t: TextAnalysis | null, corroboration: CorroborationResult[]) {
  const name = "Recruiter email domain comparison";
  const domains = [...new Set((t?.emails ?? []).map((e) => e.domain))];
  if (domains.length === 0) {
    return b.check("recruiter.domain-match", name, "recruiter", "NOT_RUN", "No recruiter email address was found in the submission.");
  }
  const official = corroboration.find((r) => r.officialDomains?.length);
  if (!official) {
    return b.check(
      "recruiter.domain-match",
      name,
      "recruiter",
      "UNAVAILABLE",
      "Not compared.",
      "No officially corroborated company domain is available. Comparing the email with the submitted link would only compare two unverified claims."
    );
  }
  const officialRegistrables = official.officialDomains!.map((d) => registrableDomain(d.toLowerCase()));
  const ev = b.addEvidence({
    type: "EXTERNAL_SOURCE",
    title: `Official domains listed by ${official.providerName}`,
    sourceUrl: official.sourceUrl,
    sourceDomain: safeHost(official.sourceUrl),
    data: { officialDomains: official.officialDomains!.join(", "), recruiterDomains: domains.join(", ") },
    capturedAt: official.retrievedAt,
    retrievalStatus: "RETRIEVED",
    provenance: official.provenance,
  });
  const mismatched = domains.filter((d) => !officialRegistrables.includes(registrableDomain(d)));
  const common = { checkId: "recruiter.domain-match" as const, category: "recruiter" as const, evidenceIds: [ev], sourceType: official.provenance };
  if (mismatched.length === 0) {
    b.addFinding(RULES.REC_DOMAIN_MATCH, {
      ...common,
      title: "Recruiter email domain matches an official company domain",
      explanation: `${official.providerName} lists ${official.officialDomains!.join(", ")} as the company's domain(s).`,
      observationSummary: `Recruiter domain(s) ${domains.join(", ")} match.`,
      limitation: "Sender addresses can be spoofed; message headers were not analysed.",
    });
  } else {
    b.addFinding(RULES.REC_DOMAIN_MISMATCH, {
      ...common,
      title: `Recruiter email domain ${mismatched.join(", ")} isn't an official company domain`,
      explanation: `${official.providerName} lists ${official.officialDomains!.join(", ")} as the company's domain(s), and the recruiter's address uses a different one. Agencies and hiring platforms can explain this, so confirm with the company.`,
      observationSummary: `Recruiter: ${mismatched.join(", ")}; official: ${official.officialDomains!.join(", ")}.`,
      limitation: "Third-party recruiters and applicant-tracking systems legitimately use other domains.",
    });
  }
  b.check("recruiter.domain-match", name, "recruiter", "COMPLETED", mismatched.length ? "Domain differs from official domains." : "Domain matches official domains.");
}

// ---------------------------------------------------------------------------

function addUnavailableNetworkChecks(b: ReportBuilder, hasUrl: boolean) {
  if (!hasUrl) {
    for (const [id, name, cat] of [
      ["domain.registration", "Domain registration age", "domain"],
      ["domain.dns", "DNS & mail records", "domain"],
      ["domain.tls", "TLS certificate", "domain"],
      ["page.fetch", "Page content & redirects", "domain"],
      ["reputation.threat-intel", "Threat-intelligence lookup", "reputation"],
    ] as const) {
      b.check(id, name, cat, "NOT_RUN", "No link was submitted.");
    }
    return;
  }
  b.check("domain.registration", "Domain registration age", "domain", "UNAVAILABLE", "Not checked.", "No domain-registration (RDAP/WHOIS) provider is configured, so the domain's age and registrant were not looked up.");
  b.check("domain.dns", "DNS & mail records", "domain", "UNAVAILABLE", "Not checked.", "DNS lookups are not performed in this build.");
  b.check("domain.tls", "TLS certificate", "domain", "UNAVAILABLE", "Not checked.", "Certificate inspection requires connecting to the site, which this build does not do.");
  b.check(
    "page.fetch",
    "Page content & redirects",
    "domain",
    "UNAVAILABLE",
    "Not checked.",
    "The page was not fetched, so its content and redirects were not inspected. Server-side fetching stays disabled until a security-reviewed fetch guard (private-range blocking, DNS pinning, redirect revalidation, size/time limits) is in place."
  );
  b.check("reputation.threat-intel", "Threat-intelligence lookup", "reputation", "UNAVAILABLE", "Not checked.", "No blocklist or threat-intelligence provider is configured.");
}

export const GENERAL_LIMITATIONS = [
  "Internyra only analyses what you submit. Phone calls, video interviews and private chats it hasn't seen are outside its view.",
  "Finding no warning signs is not the same as verifying that an opportunity is genuine.",
];

/**
 * Runs all supported checks for an already-validated request and returns a completed case.
 * Never throws for individual check failures; those are recorded as FAILED checks and
 * the case lifecycle becomes PARTIAL.
 */
export async function runVerification(request: VerificationRequest, deps: EngineDeps = {}): Promise<VerificationCase> {
  const now = deps.now ?? (() => new Date());
  const createdAt = now().toISOString();
  const caseId = (deps.generateCaseId ?? defaultCaseId)();
  const b = new ReportBuilder(createdAt);

  const urlResult = request.url ? validateUrl(request.url) : null;
  if (urlResult && !urlResult.ok) {
    throw new Error(`runVerification called with invalid URL (${urlResult.code}); validate the request first`);
  }
  const url = urlResult?.ok ? urlResult.url : null;
  let anyFailure = false;

  // On an internal error, every check the step owns that hasn't recorded a result is marked FAILED,
  // so coverage never silently omits a check.
  const guard = (owned: [CheckId, string, CheckCategory][], fn: () => void) => {
    try {
      fn();
    } catch {
      anyFailure = true;
      for (const [checkId, name, category] of owned) {
        if (b.checks.some((c) => c.id === checkId)) continue;
        b.check(checkId, name, category, "FAILED", "The check encountered an internal error.", "An internal error stopped this check; its result is missing from this report.");
      }
    }
  };

  let platform: string | undefined;
  let urlEv: string | undefined;
  if (url) {
    guard(
      [
        ["input.url", "Link validation & normalization", "input"],
        ["url.structure", "Link structure heuristics", "domain"],
      ],
      () => ({ platform, urlEv } = runUrlChecks(b, url))
    );
  } else {
    b.check("input.url", "Link validation & normalization", "input", "NOT_RUN", "No link was submitted.");
    b.check("url.structure", "Link structure heuristics", "domain", "NOT_RUN", "No link was submitted.");
  }
  guard([["domain.lookalike", "Lookalike name comparison", "domain"]], () => runLookalikeCheck(b, url, request.claimedCompany, platform, urlEv));
  addUnavailableNetworkChecks(b, Boolean(url));

  let text: TextAnalysis | null = null;
  guard(
    [
      ["content.payment", "Payment-request language", "content"],
      ["content.sensitive-data", "Sensitive-detail requests", "content"],
      ["content.contact-patterns", "Contact & pressure patterns", "content"],
      ["content.entities", "Names, emails & compensation extraction", "content"],
    ],
    () => {
      text = request.text ? analyzeText(request.text) : null;
      runTextChecks(b, text);
    }
  );

  const { results, failed } = await runCorroboration(
    b,
    deps.corroborationProviders ?? [],
    { claimedCompany: request.claimedCompany, hostname: url?.hostname, recruiterEmailDomains: (text as TextAnalysis | null)?.emails.map((e) => e.domain) ?? [] },
    deps.providerTimeoutMs ?? 5000
  );
  anyFailure ||= failed;
  guard([["recruiter.domain-match", "Recruiter email domain comparison", "recruiter"]], () => runRecruiterDomainCheck(b, text, results));

  const textLength = request.text?.length ?? 0;
  const decision = evaluateAssessment(b.findings, b.checks, { textLength });
  const narrative = await (deps.explanationProvider ?? deterministicExplanationProvider).explain(decision, b.findings, b.checks);

  const report: VerificationReport = {
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    generatedAt: now().toISOString(),
    checks: b.checks,
    findings: b.findings,
    evidence: b.evidence,
    assessment: {
      assessment: decision.assessment,
      confidence: decision.confidence,
      summary: narrative.summary,
      rationale: decision.rationale,
      triggeredRuleIds: decision.triggeredRuleIds,
      nextSteps: narrative.nextSteps,
    },
    limitations: [...b.limitations, ...GENERAL_LIMITATIONS],
  };

  const lifecycle: LifecycleState = anyFailure ? "PARTIAL" : "COMPLETED";
  return {
    id: caseId,
    schemaVersion: CASE_SCHEMA_VERSION,
    createdAt,
    updatedAt: report.generatedAt,
    origin: request.origin ?? "CORE",
    inputType: request.kind,
    submission: {
      kind: request.kind,
      originalUrl: url?.original,
      normalizedUrl: url?.normalized,
      hostname: url?.hostname,
      displayHostname: url?.displayHostname,
      claimedCompany: request.claimedCompany,
      textLength: request.text ? request.text.length : undefined,
      documentName: request.documentName,
    },
    lifecycle,
    report,
    saved: false,
    owner: { kind: "LOCAL_DEVICE" },
    retention: { storage: "BROWSER_LOCAL", serverCopy: false },
  };
}

/** Structural invariants every report must satisfy. Returns a list of problems (empty = valid). */
export function validateReportIntegrity(report: VerificationReport): string[] {
  const problems: string[] = [];
  const evIds = new Set(report.evidence.map((e) => e.id));
  const fIds = new Set(report.findings.map((f) => f.id));
  for (const f of report.findings) {
    for (const id of f.evidenceIds) if (!evIds.has(id)) problems.push(`${f.id} references missing evidence ${id}`);
    if (f.evidenceIds.length === 0 && !f.limitation) problems.push(`${f.id} has no evidence and no limitation`);
    if (!report.checks.some((c) => c.id === f.checkId)) problems.push(`${f.id} references unknown check ${f.checkId}`);
  }
  for (const e of report.evidence) {
    for (const id of e.findingIds) if (!fIds.has(id)) problems.push(`${e.id} links to missing finding ${id}`);
  }
  for (const c of report.checks) {
    if ((c.status === "UNAVAILABLE" || c.status === "FAILED") && !report.limitations.some((l) => l.startsWith(`${c.name}:`))) {
      problems.push(`${c.id} is ${c.status} but has no limitation entry`);
    }
  }
  if (report.assessment.assessment === "INSUFFICIENT_DATA" && report.assessment.confidence !== null) {
    problems.push("INSUFFICIENT_DATA must not carry a confidence level");
  }
  return problems;
}
