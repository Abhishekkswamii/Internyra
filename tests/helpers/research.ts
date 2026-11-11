import { ProviderError, type GenerateRequest, type GenerateResult, type ProviderClient, type ProviderId } from "@/lib/research/types";
import type { InspectionRecord } from "@/lib/store/types";
import type { MemoryStore } from "./memory-store";

export function modelJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    company: { name: "Northwind", officialUrl: null, summary: null },
    role: "Intern",
    recruiter: { name: null, contact: null, corroboration: "not_checked", notes: null },
    facts: [],
    submittedClaims: ["Offer for a software internship"],
    inferences: [{ statement: "The message creates urgency.", basis: "It sets a 24 hour deadline." }],
    unknowns: ["Recruiter identity not established"],
    riskIndicators: [{ indicator: "Payment requested before onboarding", severity: "high", basis: "submitted_text" }],
    feeOrPaymentRequests: ["Onboarding fee"],
    missingEvidence: ["No company page was retrievable"],
    nextSteps: ["Contact the company through its official website"],
    status: "suspicious_indicators_found",
    confidence: "moderate",
    summary: "The message asks for a payment before onboarding, which is a common recruitment-fraud pattern.",
    ...over,
  });
}

export type Script = (req: GenerateRequest, call: number) => GenerateResult | Error | Promise<GenerateResult | Error>;

export class FakeProvider implements ProviderClient {
  calls: GenerateRequest[] = [];
  constructor(public id: ProviderId, public model: string, private script: Script) {}
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    this.calls.push(req);
    const r = await this.script(req, this.calls.length);
    if (r instanceof Error) throw r;
    return r;
  }
}

export const ok = (text = modelJson(), extra: Partial<GenerateResult> = {}): Script => () => ({ text, model: "m", webSearchUsed: false, citations: [], ...extra });
export const fail = (provider: ProviderId, kind: ConstructorParameters<typeof ProviderError>[0]): Script => () => new ProviderError(kind, provider, 503);

export const MESSAGE =
  "Dear candidate, congratulations on your selection for the software internship at Northwind. Please pay the onboarding fee of 4999 rupees within 24 hours to confirm your seat.";

export async function seedQueued(store: MemoryStore, uid: string, over: Partial<InspectionRecord["submission"]> = {}, id?: string): Promise<InspectionRecord> {
  const now = new Date().toISOString();
  const rec: InspectionRecord = {
    id: id ?? `insp_${crypto.randomUUID()}`,
    ownerUid: uid,
    inputType: over.url ? "link" : "message",
    status: "queued",
    submission: { kind: over.url ? "link" : "message", text: over.url ? undefined : MESSAGE, ...over },
    attempts: 0,
    versions: { parser: "t", prompt: "t", schema: "t" },
    createdAt: now,
    updatedAt: now,
    queuedAt: now,
  };
  await store.createInspection(rec);
  return rec;
}
