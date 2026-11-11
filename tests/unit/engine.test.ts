import { describe, expect, it } from "vitest";
import type { CheckResult, Finding, VerificationRequest } from "@/types/verification";
import {
  RULES,
  evaluateAssessment,
  runVerification,
  selectKeyFindings,
  validateReportIntegrity,
  type CorroborationProvider,
  type CorroborationResult,
} from "@/lib/engine";
import { analyzeText } from "@/lib/engine/text";

const FIXED_NOW = () => new Date("2026-10-19T10:00:00.000Z");
const run = (req: VerificationRequest, deps = {}) => runVerification(req, { now: FIXED_NOW, ...deps });

const PAYMENT_MESSAGE =
  "Congratulations! You have been selected for the Marketing Internship at Northwind Example Pvt Ltd. " +
  "To confirm your seat, please pay the registration fee of Rs 2,500 via UPI within 24 hours. " +
  "Contact our HR on Telegram for the joining kit.";

const CLEAN_MESSAGE =
  "Hi Priya, thanks for applying to the Data Analyst Internship. We'd like to schedule a 30-minute video interview " +
  "next week with our analytics team. Please reply with a few times that work for you. The stipend is ₹15,000 per month.";

function provider(result: Partial<CorroborationResult>): CorroborationProvider {
  return {
    id: "test-provider",
    name: "Test Official Registry",
    lookup: async () => ({
      status: "CONFIRMED",
      providerId: "test-provider",
      providerName: "Test Official Registry",
      provenance: "OFFICIAL",
      sourceUrl: "https://registry.test.example/company/123",
      retrievedAt: "2026-10-19T09:59:00.000Z",
      summary: "Record found.",
      limitation: "Registry data may lag.",
      ...result,
    }),
  };
}

function finding(partial: Partial<Finding> & Pick<Finding, "ruleId" | "kind" | "severity">): Finding {
  return {
    id: `f-${Math.random().toString(36).slice(2)}`,
    ruleVersion: 1,
    category: "domain",
    title: partial.ruleId,
    explanation: "",
    observationSummary: "",
    evidenceIds: [],
    sourceType: "LOCAL_HEURISTIC",
    checkId: "url.structure",
    detectedAt: FIXED_NOW().toISOString(),
    limitation: "test",
    ...partial,
  };
}

const COMPLETED_URL_CHECK: CheckResult[] = [{ id: "url.structure", name: "Link structure", category: "domain", status: "COMPLETED", summary: "" }];

describe("text analysis", () => {
  it("flags explicit upfront-payment requests with an excerpt", () => {
    const t = analyzeText(PAYMENT_MESSAGE);
    expect(t.paymentRequests.length).toBeGreaterThan(0);
    expect(t.paymentRequests[0].excerpt).toMatch(/registration fee/i);
    expect(t.offPlatformContact.length).toBe(1);
    expect(t.pressureTactics.length).toBe(1);
    expect(t.organizationNames).toContain("Northwind Example Pvt Ltd");
  });

  it("does not treat stipends or 'no fee' statements as payment requests", () => {
    expect(analyzeText(CLEAN_MESSAGE).paymentRequests).toHaveLength(0);
    const reassured = analyzeText("Please note there is no registration fee at any stage of our hiring process. We never charge candidates.");
    expect(reassured.paymentRequests).toHaveLength(0);
    expect(reassured.paymentReassurances.length).toBeGreaterThan(0);
    expect(analyzeText("You will receive a stipend of $500 per month paid to you by bank transfer.").paymentRequests).toHaveLength(0);
  });

  it("detects cheque-deposit and equipment-purchase patterns", () => {
    expect(analyzeText("Deposit the check we mail you and send $350 to our vendor for your laptop.").paymentRequests.length).toBeGreaterThan(0);
    expect(analyzeText("You are required to purchase the training package before starting.").paymentRequests.length).toBeGreaterThan(0);
  });

  it("detects requests for OTPs or bank details, but not reassurances", () => {
    expect(analyzeText("Please share the OTP you receive so we can verify your account.").sensitiveDataRequests.length).toBe(1);
    expect(analyzeText("We will never ask you to share your OTP or password.").sensitiveDataRequests).toHaveLength(0);
  });
});

describe("rule engine", () => {
  it("an explicit upfront-payment request triggers an explainable HIGH_RISK signal", async () => {
    const c = await run({ kind: "message", text: PAYMENT_MESSAGE });
    const r = c.report!;
    const pay = r.findings.find((f) => f.ruleId === RULES.TXT_PAYMENT.id)!;
    expect(pay).toBeDefined();
    expect(pay.severity).toBe("HIGH");
    expect(pay.explanation.length).toBeGreaterThan(40);
    expect(pay.evidenceIds.length).toBeGreaterThan(0);
    const ev = r.evidence.find((e) => e.id === pay.evidenceIds[0])!;
    expect(ev.provenance).toBe("USER_SUPPLIED");
    expect(ev.excerpt).toMatch(/registration fee/i);
    expect(ev.sourceUrl).toBeUndefined(); // no invented source
    expect(r.assessment.assessment).toBe("HIGH_RISK");
    expect(r.assessment.triggeredRuleIds).toContain("TXT-001");
    expect(r.assessment.summary).toMatch(/not proof of fraud/i);
  });

  it("missing company corroboration does not establish fraud", async () => {
    const c = await run({ kind: "message", text: CLEAN_MESSAGE, claimedCompany: "Acme" });
    const cor = c.report!.checks.find((x) => x.id === "company.corroboration")!;
    expect(cor.status).toBe("UNAVAILABLE");
    expect(c.report!.assessment.assessment).not.toBe("HIGH_RISK");
    expect(c.report!.assessment.assessment).not.toBe("NEEDS_REVIEW");

    const notFound = await run({ kind: "message", text: CLEAN_MESSAGE, claimedCompany: "Acme" }, { corroborationProviders: [provider({ status: "NOT_FOUND", summary: "No record." })] });
    expect(notFound.report!.findings.find((f) => f.ruleId === "COR-003")?.kind).toBe("OBSERVATION");
    expect(notFound.report!.assessment.assessment).not.toBe("HIGH_RISK");
  });

  it("a free email provider by itself does not establish fraud", async () => {
    const c = await run({ kind: "message", text: `${CLEAN_MESSAGE} You can reach me at priya.recruits@gmail.com.` });
    const free = c.report!.findings.find((f) => f.ruleId === RULES.TXT_FREE_EMAIL.id)!;
    expect(free.kind).toBe("OBSERVATION");
    expect(free.severity).toBe("INFO");
    expect(["HIGH_RISK", "NEEDS_REVIEW"]).not.toContain(c.report!.assessment.assessment);
  });

  it("a new-domain heuristic alone is not treated as proof", () => {
    const d = evaluateAssessment(
      [finding({ ruleId: RULES.DOM_RECENTLY_REGISTERED.id, kind: "RISK_SIGNAL", severity: "LOW", signalGroup: "domain-age" })],
      COMPLETED_URL_CHECK,
      { textLength: 0 }
    );
    expect(d.assessment).not.toBe("HIGH_RISK");
    expect(d.assessment).not.toBe("NEEDS_REVIEW");
  });

  it("records contradictory official evidence with its source", async () => {
    const c = await run(
      { kind: "link", url: "https://acme-careers-hiring.example/apply", claimedCompany: "Acme" },
      { corroborationProviders: [provider({ status: "CONTRADICTED", officialDomains: ["acme.example"], summary: "Acme lists acme.example as its only careers domain." })] }
    );
    const r = c.report!;
    const contra = r.findings.find((f) => f.ruleId === RULES.COR_CONTRADICTED.id)!;
    expect(contra.sourceType).toBe("OFFICIAL");
    const ev = r.evidence.find((e) => e.id === contra.evidenceIds[0])!;
    expect(ev.sourceUrl).toBe("https://registry.test.example/company/123");
    expect(ev.capturedAt).toBe("2026-10-19T09:59:00.000Z");
    expect(ev.retrievalStatus).toBe("RETRIEVED");
    expect(r.assessment.assessment).toBe("HIGH_RISK");
    expect(r.assessment.confidence).toBe("HIGH");
  });

  it("compares recruiter email domains only against an established official domain", async () => {
    const text = `${CLEAN_MESSAGE} Regards, hr@acme-jobs.example`;
    const withoutOfficial = await run({ kind: "message", text });
    expect(withoutOfficial.report!.checks.find((c) => c.id === "recruiter.domain-match")!.status).toBe("UNAVAILABLE");
    expect(withoutOfficial.report!.findings.some((f) => f.ruleId.startsWith("REC-"))).toBe(false);

    const withOfficial = await run({ kind: "message", text, claimedCompany: "Acme" }, { corroborationProviders: [provider({ officialDomains: ["acme.example"] })] });
    const mismatch = withOfficial.report!.findings.find((f) => f.ruleId === RULES.REC_DOMAIN_MISMATCH.id)!;
    expect(mismatch.explanation).toMatch(/acme\.example/);
    expect(mismatch.severity).toBe("MEDIUM");
  });

  it("a weak signal does not dominate stronger official evidence", async () => {
    const c = await run(
      { kind: "link", url: "http://careers.acme.example/intern", claimedCompany: "Acme" },
      { corroborationProviders: [provider({ status: "CONFIRMED", summary: "careers.acme.example is listed as Acme's careers site." })] }
    );
    const r = c.report!;
    expect(r.findings.some((f) => f.ruleId === "URL-001")).toBe(true);
    expect(r.assessment.assessment).toBe("LOWER_CONCERN");
    expect(r.assessment.confidence).toBe("MODERATE");
  });

  it("counts several findings from the same signal group once", () => {
    const d = evaluateAssessment(
      [
        finding({ ruleId: "DOM-002", kind: "RISK_SIGNAL", severity: "LOW", signalGroup: "lookalike" }),
        finding({ ruleId: "DOM-002", kind: "RISK_SIGNAL", severity: "LOW", signalGroup: "lookalike" }),
      ],
      COMPLETED_URL_CHECK,
      { textLength: 0 }
    );
    expect(d.groups).toHaveLength(1);
    expect(d.assessment).toBe("INSUFFICIENT_DATA");
  });

  it("two independent weak signals lead to NEEDS_REVIEW, not HIGH_RISK", async () => {
    const c = await run({ kind: "link", url: "http://bit.ly/3abcXYZ" });
    expect(c.report!.assessment.assessment).toBe("NEEDS_REVIEW");
    expect(c.report!.assessment.confidence).toBe("LOW");
  });

  it("literal-IP and non-standard-port links are marked for review (one group)", async () => {
    const c = await run({ kind: "link", url: "http://203.0.113.7:8080/internship/apply" });
    const r = c.report!;
    expect(r.findings.filter((f) => f.signalGroup === "host-form")).toHaveLength(2);
    expect(r.assessment.assessment).toBe("NEEDS_REVIEW");
  });

  it("flags near-miss company lookalikes with an explainable comparison", async () => {
    const c = await run({ kind: "link", url: "https://technove-solutions.example/careers", claimedCompany: "TechNova Solutions" });
    const f = c.report!.findings.find((x) => x.ruleId === RULES.DOM_LOOKALIKE.id)!;
    expect(f.observationSummary).toMatch(/technovesolutions.*technovasolutions/);
    expect(c.report!.assessment.assessment).toBe("NEEDS_REVIEW");
  });

  it("no available checks produces INSUFFICIENT_DATA without invented confidence", () => {
    const unavailable: CheckResult[] = [
      { id: "domain.registration", name: "Domain registration age", category: "domain", status: "UNAVAILABLE", summary: "" },
      { id: "company.corroboration", name: "Corroboration", category: "company", status: "UNAVAILABLE", summary: "" },
    ];
    const d = evaluateAssessment([], unavailable, { textLength: 0 });
    expect(d.assessment).toBe("INSUFFICIENT_DATA");
    expect(d.confidence).toBeNull();
  });

  it("a clean URL alone is INSUFFICIENT_DATA, never 'safe'", async () => {
    const c = await run({ kind: "link", url: "https://careers.example.com/internships/data-analyst" });
    expect(c.report!.assessment.assessment).toBe("INSUFFICIENT_DATA");
    expect(c.report!.assessment.confidence).toBeNull();
    expect(c.report!.assessment.summary).toMatch(/does not mean the opportunity is safe/i);
  });

  it("every finding references valid evidence and every gap has a limitation", async () => {
    const requests: VerificationRequest[] = [
      { kind: "link", url: "https://careers.example.com/jobs/1" },
      { kind: "link", url: "http://203.0.113.7:8080/apply", text: PAYMENT_MESSAGE, claimedCompany: "Northwind" },
      { kind: "link", url: "https://gооgle.example/careers", claimedCompany: "Google" },
      { kind: "link", url: "https://jobs.lever.co/acme/123", claimedCompany: "Acme" },
      { kind: "message", text: `${CLEAN_MESSAGE} hr@gmail.com` },
      { kind: "document", text: PAYMENT_MESSAGE, documentName: "offer.txt" },
    ];
    for (const req of requests) {
      const c = await run(req, { corroborationProviders: req.claimedCompany ? [provider({ officialDomains: ["acme.example"] })] : [] });
      const r = c.report!;
      expect(validateReportIntegrity(r)).toEqual([]);
      for (const check of r.checks.filter((x) => x.status === "UNAVAILABLE")) {
        expect(r.limitations.some((l) => l.startsWith(`${check.name}:`))).toBe(true);
      }
    }
  });

  it("missing evidence produces explicit limitations for unavailable network checks", async () => {
    const r = (await run({ kind: "link", url: "https://careers.example.com/x" })).report!;
    for (const id of ["domain.registration", "domain.dns", "domain.tls", "page.fetch", "reputation.threat-intel", "company.corroboration"]) {
      const check = r.checks.find((c) => c.id === id)!;
      expect(check.status).toBe("UNAVAILABLE");
      expect(check.reason).toBeTruthy();
    }
    // No evidence is ever attributed to checks that did not run
    expect(r.evidence.some((e) => e.retrievalStatus === "RETRIEVED")).toBe(false);
  });

  it("a slow or failing provider leaves the case PARTIAL with a FAILED/PARTIAL check, not a fake result", async () => {
    const slow: CorroborationProvider = { id: "slow", name: "Slow Source", lookup: () => new Promise(() => {}) };
    const c = await run({ kind: "link", url: "https://careers.example.com/x", claimedCompany: "Example" }, { corroborationProviders: [slow], providerTimeoutMs: 20 });
    expect(c.lifecycle).toBe("PARTIAL");
    const check = c.report!.checks.find((x) => x.id === "company.corroboration")!;
    expect(check.status).toBe("FAILED");
    expect(check.reason).toMatch(/timed out/);
  });

  it("keeps lifecycle separate from assessment and never persists full text", async () => {
    const c = await run({ kind: "message", text: PAYMENT_MESSAGE });
    expect(c.lifecycle).toBe("COMPLETED");
    expect(c.report!.assessment.assessment).toBe("HIGH_RISK");
    expect(c.submission.textLength).toBe(PAYMENT_MESSAGE.length);
    expect(JSON.stringify(c)).not.toContain(PAYMENT_MESSAGE);
  });

  it("guest preview selection never exceeds two findings", async () => {
    const c = await run({ kind: "link", url: "http://203.0.113.7:8080/apply", text: PAYMENT_MESSAGE });
    expect(c.report!.findings.length).toBeGreaterThan(2);
    const key = selectKeyFindings(c.report!, 2);
    expect(key).toHaveLength(2);
    expect(key[0].severity).toBe("HIGH");
  });

  it("evaluates social media reels and posts to INSUFFICIENT_DATA with URL-011 finding", async () => {
    const c = await run({ kind: "link", url: "https://www.instagram.com/reel/C8internship_opportunity" });
    expect(c.lifecycle).toBe("COMPLETED");
    expect(c.report!.assessment.assessment).toBe("INSUFFICIENT_DATA");
    expect(c.report!.assessment.triggeredRuleIds).toContain("URL-011");
    const socialFinding = c.report!.findings.find((f) => f.ruleId === "URL-011");
    expect(socialFinding).toBeDefined();
    expect(socialFinding?.title).toContain("instagram.com");
  });

  it("is deterministic for the same input and clock", async () => {
    const a = await run({ kind: "message", text: PAYMENT_MESSAGE }, { generateCaseId: () => "case_fixed" });
    const b = await run({ kind: "message", text: PAYMENT_MESSAGE }, { generateCaseId: () => "case_fixed" });
    expect(a).toEqual(b);
  });
});

describe("assessment honesty", () => {
  it("text with no warning patterns stays INSUFFICIENT_DATA (ASSESS-5), never 'lower concern'", async () => {
    const c = await run({ kind: "message", text: CLEAN_MESSAGE });
    const a = c.report!.assessment;
    expect(a.assessment).toBe("INSUFFICIENT_DATA");
    expect(a.confidence).toBeNull();
    expect(a.triggeredRuleIds).toEqual(["ASSESS-5"]);
    expect(a.rationale.join(" ")).toMatch(/does not show the opportunity is genuine/);
    expect(a.summary).toMatch(/does not mean the opportunity is safe/);
  });

  it("LOWER_CONCERN is only reachable through an official corroboration", async () => {
    const inputs: VerificationRequest[] = [
      { kind: "link", url: "https://careers.example.com/jobs/1" },
      { kind: "link", url: "https://jobs.lever.co/acme/123", claimedCompany: "Acme", text: CLEAN_MESSAGE },
      { kind: "link", url: "https://acme.example/careers", claimedCompany: "Acme" },
      { kind: "message", text: `${CLEAN_MESSAGE} Please note there is no fee at any stage.` },
      { kind: "document", text: CLEAN_MESSAGE, documentName: "offer.txt" },
    ];
    for (const req of inputs) {
      expect((await run(req)).report!.assessment.assessment).not.toBe("LOWER_CONCERN");
    }
    const official = await run({ kind: "message", text: CLEAN_MESSAGE, claimedCompany: "Acme" }, { corroborationProviders: [provider({})] });
    expect(official.report!.assessment.assessment).toBe("LOWER_CONCERN");
    expect(official.report!.assessment.triggeredRuleIds).toContain("ASSESS-4");
  });

  it("does not say 'no warning' when weak signals were noted", async () => {
    const c = await run({ kind: "link", url: "http://www.instagram.com/reel/abc" });
    expect(c.report!.assessment.assessment).toBe("INSUFFICIENT_DATA");
    expect(c.report!.findings.some((f) => f.ruleId === "URL-001")).toBe(true);
    expect(c.report!.assessment.summary).not.toMatch(/No warning/);
    expect(c.report!.assessment.summary).toMatch(/weak on their own/);
  });

  it("a social-media link still reports real signals from the submitted text", async () => {
    const c = await run({ kind: "link", url: "https://www.instagram.com/reel/abc", text: PAYMENT_MESSAGE });
    expect(c.report!.assessment.assessment).toBe("HIGH_RISK");
    expect(c.report!.assessment.triggeredRuleIds).toContain("TXT-001");
  });

  it("text parsing never fabricates recruiter emails, organisations or official domains", async () => {
    const c = await run({ kind: "message", text: "Hello, we liked your profile and want to talk about an internship next week. Reply if interested." });
    const r = c.report!;
    expect(r.findings.some((f) => f.ruleId === RULES.TXT_EMAILS.id)).toBe(false);
    expect(r.findings.some((f) => f.ruleId === RULES.TXT_ORGANIZATIONS.id)).toBe(false);
    expect(r.checks.find((x) => x.id === "recruiter.domain-match")!.status).toBe("NOT_RUN");
    expect(r.evidence.some((e) => e.type === "EXTERNAL_SOURCE")).toBe(false);
  });

  it("only local checks complete without providers; every network check is UNAVAILABLE", async () => {
    const r = (await run({ kind: "link", url: "https://careers.example.com/x", text: CLEAN_MESSAGE, claimedCompany: "Example" })).report!;
    const completed = r.checks.filter((c) => c.status === "COMPLETED").map((c) => c.id).sort();
    expect(completed).toEqual(
      ["content.contact-patterns", "content.entities", "content.payment", "content.sensitive-data", "domain.lookalike", "input.url", "url.structure"].sort()
    );
    for (const e of r.evidence) {
      expect(e.retrievalStatus).toBe("LOCAL_ANALYSIS");
      expect(e.capturedAt).toBe(r.generatedAt);
      expect(["USER_SUPPLIED", "LOCAL_HEURISTIC"]).toContain(e.provenance);
    }
  });

  it("the landing page's mixed-script example is flagged by a rule that actually ran", async () => {
    const c = await run({ kind: "link", url: "https://jobs.nоrthwind.example/internship" });
    expect(c.report!.findings.some((f) => f.ruleId === RULES.URL_MIXED_SCRIPT.id)).toBe(true);
    expect(c.report!.assessment.assessment).toBe("NEEDS_REVIEW");
  });

  it("a lookalike of a well-known brand is NOT detected without a claimed company name", async () => {
    // Guards marketing copy: link-only checks cannot spot single-alphabet typosquats.
    const c = await run({ kind: "link", url: "https://careers-goog1e.example/jobs" });
    expect(c.report!.checks.find((x) => x.id === "domain.lookalike")!.status).toBe("NOT_RUN");
    expect(c.report!.assessment.assessment).toBe("INSUFFICIENT_DATA");
  });
});

describe("payment negation is judged per clause", () => {
  it("still flags a fee requested after a reassurance in the same sentence", () => {
    const t = analyzeText("There is no application fee, but you must pay a $50 kit fee before joining.");
    expect(t.paymentRequests.length).toBeGreaterThan(0);
    expect(t.paymentRequests[0].excerpt).toContain("kit fee");
  });

  it("still treats a pure reassurance as a reassurance", () => {
    const t = analyzeText("There is no application fee for this internship.");
    expect(t.paymentRequests).toHaveLength(0);
    expect(t.paymentReassurances.length).toBeGreaterThan(0);
  });
});

describe("pathological input stays fast", () => {
  it("analyses a 20,000-digit line quickly", () => {
    const start = performance.now();
    analyzeText(`pay ${"1".repeat(20_000)}x`);
    expect(performance.now() - start).toBeLessThan(150);
  });
});
