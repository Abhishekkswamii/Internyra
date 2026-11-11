/**
 * Adapter boundary for company / opportunity corroboration against real sources
 * (official careers pages, company registries, reputable third-party datasets).
 *
 * No provider is configured in this phase, so the corroboration check reports
 * UNAVAILABLE. A provider must only return what its source actually said; it must
 * never synthesise an official confirmation, URL or timestamp.
 */

export interface CorroborationQuery {
  claimedCompany?: string;
  /** ASCII hostname from the submitted URL, if any. */
  hostname?: string;
  recruiterEmailDomains: string[];
}

export interface CorroborationResult {
  status: "CONFIRMED" | "NOT_FOUND" | "CONTRADICTED";
  providerId: string;
  providerName: string;
  provenance: "OFFICIAL" | "REPUTABLE_INDEPENDENT";
  /** Domains the source states belong to the company. Enables recruiter-domain comparison. */
  officialDomains?: string[];
  /** The page/record actually consulted. */
  sourceUrl: string;
  retrievedAt: string;
  /** What the source said, in one sentence. */
  summary: string;
  limitation: string;
}

export interface CorroborationProvider {
  id: string;
  name: string;
  lookup(query: CorroborationQuery, signal: AbortSignal): Promise<CorroborationResult>;
}

/**
 * Server-side provider registry. Empty until a real, reviewed source is integrated.
 * Providers that make network requests must go through a security-reviewed fetch guard
 * (see docs/verification-engine.md) — none exists yet, so none is registered.
 */
export function getConfiguredCorroborationProviders(): CorroborationProvider[] {
  return [];
}
