import "server-only";
import { safeFetchUrl } from "@/lib/security/fetch-guard";
import { buildUserPrompt, detectPromptInjection, SYSTEM_PROMPT } from "./prompts";
import { buildReport, type FetchedPage } from "./sources";
import { ProviderError, ResearchError, type ProviderClient, type ResearchInput, type ResearchReport } from "./types";

export type Strategy = "gemini_primary_openai_fallback" | "gemini_only" | "openai_only" | "openai_temporary_gemini_not_configured" | "none";

export interface Deps {
  providers: ProviderClient[];
  geminiConfigured: boolean;
  webSearch: boolean;
  timeoutMs: number;
  fetchPage?: (url: string) => Promise<{ ok: boolean; finalUrl?: string; title?: string; text?: string; code?: string }>;
  now?: () => string;
}

export interface ResearchOutcome {
  report: ResearchReport;
  provider: string;
  model: string;
  strategy: Strategy;
  fallbackOccurred: boolean;
  fallbackReason?: string;
  webSearchUsed: boolean;
}

export function strategyFor(providers: ProviderClient[], geminiConfigured: boolean): Strategy {
  const ids = providers.map((p) => p.id);
  if (ids.length === 0) return "none";
  if (ids[0] === "gemini") return ids.includes("openai") ? "gemini_primary_openai_fallback" : "gemini_only";
  // OpenAI first. With Gemini absent this is the explicitly recorded temporary mode, not a fallback.
  return geminiConfigured ? "openai_only" : "openai_temporary_gemini_not_configured";
}

/** Stable identifier of the provider/model strategy, used in cache keys. */
export function strategyId(providers: ProviderClient[], webSearch: boolean): string {
  return providers.map((p) => `${p.id}:${p.model}`).join(">") + (webSearch ? "+ws" : "");
}

const MAX_OUTPUT_TOKENS = 3000;

/**
 * One analysis. Gemini first when configured; one controlled OpenAI fallback for provider-side
 * failures only. Invalid output or invalid input never falls back, and nothing retries in a loop.
 */
export async function runResearch(input: ResearchInput, deps: Deps): Promise<ResearchOutcome> {
  const now = deps.now ?? (() => new Date().toISOString());
  if (deps.providers.length === 0) throw new ResearchError("NO_PROVIDER", "No AI provider is configured.", false);

  let fetched: FetchedPage | null = null;
  let attempted = false;
  let fetchReason: string | undefined;
  if (input.targetUrl) {
    attempted = true;
    const fetchPage = deps.fetchPage ?? ((u: string) => safeFetchUrl(u));
    const res = await fetchPage(input.targetUrl);
    if (res.ok && res.text) fetched = { url: res.finalUrl ?? input.targetUrl, title: res.title, text: res.text, retrievedAt: now() };
    else fetchReason = res.code ?? "unavailable";
  }

  const injectionDetected = detectPromptInjection(input.pastedText, input.claimedCompany, input.claimedRole, input.recruiterName, fetched?.text);
  const user = buildUserPrompt(input, fetched ? { url: fetched.url, title: fetched.title, text: fetched.text } : null);
  const strategy = strategyFor(deps.providers, deps.geminiConfigured);

  let fallbackReason: string | undefined;
  let lastError: ProviderError | null = null;
  for (let i = 0; i < Math.min(deps.providers.length, 2); i++) {
    const provider = deps.providers[i];
    try {
      const result = await provider.generate({ system: SYSTEM_PROMPT, user, webSearch: deps.webSearch, timeoutMs: deps.timeoutMs, maxOutputTokens: MAX_OUTPUT_TOKENS });
      const report = buildReport({
        rawText: result.text,
        fetched,
        citations: result.citations,
        attemptedFetch: attempted,
        fetchReason,
        injectionDetected,
        now: now(),
      });
      return {
        report,
        provider: provider.id,
        model: result.model,
        strategy,
        fallbackOccurred: i > 0,
        fallbackReason,
        webSearchUsed: result.webSearchUsed,
      };
    } catch (err) {
      if (err instanceof ResearchError) throw err; // validation failure: no fallback
      if (err instanceof ProviderError) {
        lastError = err;
        if (!err.fallbackEligible) throw new ResearchError("BAD_REQUEST", "The research request was rejected.", false);
        fallbackReason = `${err.provider}:${err.kind}`;
        continue;
      }
      throw new ResearchError("PROVIDER_FAILED", "The research provider failed.", true);
    }
  }
  throw new ResearchError("PROVIDER_FAILED", lastError ? "The research providers are temporarily unavailable." : "The research provider failed.", true);
}
