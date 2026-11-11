import "server-only";
import { createHash } from "crypto";
import { runVerification } from "@/lib/engine";
import { getConfiguredCorroborationProviders } from "@/lib/engine/corroboration";
import { ENGINE_VERSION, RULESET_VERSION } from "@/lib/engine/version";
import { acquireLock, createCacheFingerprint, deleteCachedAnalysis, freshnessSeconds, getCachedAnalysis, releaseLock, setCachedAnalysis, type CacheEvent } from "@/lib/cache/redis";
import { getServerConfig } from "@/lib/config/env";
import { runResearch, strategyFor, strategyId, type Deps } from "@/lib/research/coordinator";
import { configuredProviders } from "@/lib/research/providers";
import { PROMPT_VERSION, REPORT_SCHEMA_VERSION, ResearchError, ResearchReportSchema, type ResearchReport } from "@/lib/research/types";
import type { InspectionRecord, InspectionStore, SafeError } from "@/lib/store/types";
import type { VerificationRequest } from "@/types/verification";

export const LEASE_MS = 3 * 60_000;

export interface PipelineDeps {
  store: InspectionStore;
  research: Deps;
  aiEnabled: boolean;
  now?: () => string;
  /** Wait for another worker's identical analysis before doing it ourselves. */
  lockWaitMs?: number;
}

export type PipelineResult =
  | { outcome: "completed" | "failed"; record: InspectionRecord }
  | { outcome: "ai_disabled" | "already_running" | "not_runnable" | "not_found" };

export function currentVersions() {
  return { parser: `${ENGINE_VERSION}/${RULESET_VERSION}`, prompt: PROMPT_VERSION, schema: REPORT_SCHEMA_VERSION };
}

export function defaultPipelineDeps(store: InspectionStore): PipelineDeps {
  const p = configuredProviders();
  return {
    store,
    aiEnabled: getServerConfig().AI_INSPECTIONS_ENABLED && p.providers.length > 0,
    research: { providers: p.providers, geminiConfigured: p.geminiConfigured, webSearch: p.webSearch, timeoutMs: p.timeoutMs },
  };
}

function toSafeError(err: unknown): SafeError {
  if (err instanceof ResearchError) {
    const messages: Record<string, string> = {
      AI_DISABLED: "AI research is currently paused. Your inspection is saved.",
      NO_PROVIDER: "AI research is not configured yet.",
      INVALID_OUTPUT: "The research result could not be validated, so nothing was saved as a finding. Please try again.",
      PROVIDER_FAILED: "The research providers are temporarily unavailable. Please try again shortly.",
      BAD_REQUEST: "The research request was rejected. Please check the input and try again.",
    };
    return { code: err.code, message: messages[err.code] ?? "The inspection could not be completed.", retryable: err.retryable };
  }
  return { code: "INTERNAL", message: "The inspection could not be completed. Please try again.", retryable: true };
}

function toRequest(rec: InspectionRecord): VerificationRequest {
  const s = rec.submission;
  return { kind: s.kind, url: s.url, text: s.text, claimedCompany: s.claimedCompany, claimedRole: s.claimedRole, recruiterName: s.recruiterName, recruiterEmail: s.recruiterEmail, origin: "CORE" };
}

export function submissionFingerprint(rec: InspectionRecord): string {
  const s = rec.submission;
  const input = s.kind === "link" ? s.url ?? "" : s.text ?? "";
  // Facts the user typed change the analysis, so they are part of the content identity.
  const extra = [s.claimedCompany, s.claimedRole, s.recruiterName, s.recruiterEmail].map((v) => (v ?? "").trim().toLowerCase()).join("|");
  return createHash("sha256").update(`${input}\n${extra}`).digest("hex");
}

/**
 * Runs one queued inspection for its owner: local deterministic checks plus AI research, then
 * persists the result. Safe to call concurrently: only one caller wins the lease.
 */
export async function runInspection(uid: string, id: string, opts: { refresh?: boolean }, deps: PipelineDeps): Promise<PipelineResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const { store } = deps;

  if (!deps.aiEnabled) return { outcome: "ai_disabled" };

  const begin = await store.beginRun(uid, id, now(), LEASE_MS);
  if (!begin.ok) return { outcome: begin.reason };
  const rec = begin.record;
  const started = Date.now();
  const cacheEvents: CacheEvent[] = [];
  const track = (e: CacheEvent) => cacheEvents.push(e);

  let lock: Awaited<ReturnType<typeof acquireLock>> = null;
  try {
    const caseResult = await runVerification(toRequest(rec), { corroborationProviders: getConfiguredCorroborationProviders() });

    const strat = strategyId(deps.research.providers, deps.research.webSearch);
    const fingerprintInput = submissionFingerprint(rec);
    const key = createCacheFingerprint({
      kind: rec.inputType,
      input: fingerprintInput,
      parserVersion: rec.versions.parser,
      promptVersion: PROMPT_VERSION,
      schemaVersion: REPORT_SCHEMA_VERSION,
      strategy: strat,
    });
    // Link analyses are time-sensitive: a refresh drops the stale entry first.
    if (opts.refresh) {
      await deleteCachedAnalysis(key);
      track("refresh");
    }

    let report: ResearchReport | null = null;
    let provider = "";
    let model = "";
    let fromCache = false;
    let fallbackOccurred = false;
    let fallbackReason: string | undefined;
    let webSearchUsed = false;
    const strategy = strategyFor(deps.research.providers, deps.research.geminiConfigured);

    const readCache = async () => {
      const res = await getCachedAnalysis(key);
      if (res.event === "error") track("error");
      const hit = res.value;
      if (!hit) return null;
      const parsed = ResearchReportSchema.safeParse(hit.payload);
      return parsed.success ? { report: parsed.data, hit } : null;
    };

    let cached = opts.refresh ? null : await readCache();
    if (!cached) {
      lock = await acquireLock(key, 150);
      if (!lock) {
        // Someone is already doing this exact analysis: wait briefly for their result instead of paying twice.
        const deadline = Date.now() + (deps.lockWaitMs ?? 25_000);
        while (!cached && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 1500));
          cached = await readCache();
        }
      }
    }

    if (cached) {
      report = cached.report;
      provider = cached.hit.provider;
      model = cached.hit.model;
      fromCache = true;
    } else {
      const outcome = await runResearch(
        { kind: rec.inputType, targetUrl: rec.submission.url, pastedText: rec.submission.text, claimedCompany: rec.submission.claimedCompany, claimedRole: rec.submission.claimedRole, recruiterName: rec.submission.recruiterName, recruiterEmail: rec.submission.recruiterEmail },
        deps.research
      );
      report = outcome.report;
      provider = outcome.provider;
      model = outcome.model;
      fallbackOccurred = outcome.fallbackOccurred;
      fallbackReason = outcome.fallbackReason;
      webSearchUsed = outcome.webSearchUsed;
      const stored = await setCachedAnalysis(key, { payload: report, cachedAt: now(), provider, model }, freshnessSeconds(rec.inputType));
      if (stored === "error") track("error");
    }

    const done = now();
    const submission = { ...rec.submission, textLength: rec.submission.text?.length ?? rec.submission.textLength, textHash: rec.submission.text ? createHash("sha256").update(rec.submission.text).digest("hex").slice(0, 16) : rec.submission.textHash };
    await store.finishRun(uid, id, {
      status: "completed",
      case: caseResult,
      research: report,
      submission,
      provider,
      model,
      providerStrategy: strategy,
      fallbackOccurred,
      fallbackReason,
      webSearchUsed,
      fromCache,
      researchMs: Date.now() - started,
      error: undefined,
      completedAt: done,
      updatedAt: done,
      versions: currentVersions(),
    });

    await store.recordUsage({ uid, type: "research", provider, model, fallback: fallbackOccurred, webSearchUsed, success: true, durationMs: Date.now() - started, inspectionId: id, cacheEvent: fromCache ? "hit" : "miss" }, done).catch(() => {});
    for (const e of cacheEvents.filter((e) => e === "refresh" || e === "error")) await store.recordUsage({ uid, type: "cache", cacheEvent: e, inspectionId: id }, done).catch(() => {});

    const finished = await store.getInspection(uid, id);
    return { outcome: "completed", record: finished ?? { ...rec, status: "completed" } };
  } catch (err) {
    const safe = toSafeError(err);
    const failedAt = now();
    await store.finishRun(uid, id, { status: "failed", error: safe, updatedAt: failedAt, researchMs: Date.now() - started }).catch(() => {});
    await store.recordUsage({ uid, type: "provider_error", code: safe.code, success: false, durationMs: Date.now() - started, inspectionId: id }, failedAt).catch(() => {});
    const finished = await store.getInspection(uid, id).catch(() => null);
    return { outcome: "failed", record: finished ?? { ...rec, status: "failed", error: safe } };
  } finally {
    if (lock) await releaseLock(lock);
  }
}
