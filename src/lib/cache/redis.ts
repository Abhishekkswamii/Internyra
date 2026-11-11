import "server-only";
import { Redis } from "@upstash/redis";
import { createHash, randomUUID } from "crypto";
import { getServerConfig } from "@/lib/config/env";

/**
 * Upstash Redis is a cache and coordination layer only. Firestore is the source of truth.
 * Every function degrades safely when Redis is unconfigured or unreachable.
 */

let client: Redis | null | undefined;
let override: Redis | null | undefined;
const memoryLocks = new Map<string, { token: string; expires: number }>();
const memoryWindows = new Map<string, { count: number; resetAt: number }>();

/** Test seam. */
export function setRedisForTests(r: Redis | null | undefined): void {
  override = r;
  client = undefined;
  memoryWindows.clear();
  memoryLocks.clear();
}

export function getRedisClient(): Redis | null {
  if (override !== undefined) return override;
  if (client !== undefined) return client;
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = getServerConfig();
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

// ---------- fingerprints ----------

const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "msclkid", "_ga", "ref", "trk", "tracking_id"];

export function normalizeInspectionUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    u.hostname = u.hostname.toLowerCase();
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    u.searchParams.sort();
    u.hash = "";
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

export interface CacheKeyParts {
  kind: string;
  /** Normalised URL, or the message text. Only its hash is used in the key. */
  input: string;
  parserVersion: string;
  promptVersion: string;
  schemaVersion: string;
  /** Provider/model strategy, so a different model never reuses another's analysis. */
  strategy: string;
}

export function createCacheFingerprint(parts: CacheKeyParts): string {
  const normalized = parts.kind === "link" ? normalizeInspectionUrl(parts.input) : parts.input.trim().replace(/\s+/g, " ").toLowerCase();
  const contentHash = createHash("sha256").update(normalized).digest("hex");
  const versions = createHash("sha256").update([parts.parserVersion, parts.promptVersion, parts.schemaVersion, parts.strategy].join("|")).digest("hex").slice(0, 12);
  return `internyra:analysis:${parts.kind}:${versions}:${contentHash}`;
}

/** Time-sensitive job listings go stale faster than a fixed message. */
export function freshnessSeconds(kind: string): number {
  return kind === "link" ? 6 * 3600 : 24 * 3600;
}

// ---------- analysis cache ----------

export interface CachedAnalysis {
  payload: unknown;
  cachedAt: string;
  provider: string;
  model: string;
}

export type CacheEvent = "hit" | "miss" | "error" | "refresh";

/** Returns the real outcome so callers can record true hit/miss/error counts. Never throws. */
export async function getCachedAnalysis(key: string): Promise<{ event: CacheEvent | "unconfigured"; value: CachedAnalysis | null }> {
  const redis = getRedisClient();
  if (!redis) return { event: "unconfigured", value: null };
  try {
    const data = await redis.get<CachedAnalysis>(key);
    return data ? { event: "hit", value: data } : { event: "miss", value: null };
  } catch {
    return { event: "error", value: null };
  }
}

export async function setCachedAnalysis(key: string, value: CachedAnalysis, ttlSeconds: number): Promise<"stored" | "unconfigured" | "error"> {
  const redis = getRedisClient();
  if (!redis) return "unconfigured";
  try {
    await redis.set(key, value, { ex: ttlSeconds });
    return "stored";
  } catch {
    return "error";
  }
}

export async function deleteCachedAnalysis(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
}

// ---------- locks ----------

export interface Lock {
  key: string;
  token: string;
  /** "redis" when coordinated across instances, "local" when degraded to this instance only. */
  scope: "redis" | "local";
}

/** Atomic SET NX EX with a unique token. Returns null when someone else holds it. */
export async function acquireLock(name: string, ttlSeconds: number): Promise<Lock | null> {
  const key = `internyra:lock:${name}`;
  const token = randomUUID();
  const redis = getRedisClient();
  if (redis) {
    try {
      const ok = await redis.set(key, token, { nx: true, ex: ttlSeconds });
      return ok ? { key, token, scope: "redis" } : null;
    } catch {
      // fall through to the per-instance lock
    }
  }
  const now = Date.now();
  const held = memoryLocks.get(key);
  if (held && held.expires > now) return null;
  memoryLocks.set(key, { token, expires: now + ttlSeconds * 1000 });
  return { key, token, scope: "local" };
}

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/** Releases only a lock this caller still owns. */
export async function releaseLock(lock: Lock): Promise<void> {
  if (lock.scope === "local") {
    if (memoryLocks.get(lock.key)?.token === lock.token) memoryLocks.delete(lock.key);
    return;
  }
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.eval(RELEASE_SCRIPT, [lock.key], [lock.token]);
  } catch {}
}

// ---------- rate limiting ----------

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** "local" means Redis was unavailable and a per-instance limit was applied instead. */
  scope: "redis" | "local";
}

/** Fixed-window limiter. Falls back to an in-memory window so Redis outages never remove limits. */
export async function checkRateLimit(identifier: string, max: number, windowSeconds: number): Promise<RateResult> {
  const redis = getRedisClient();
  const key = `internyra:rl:${identifier}`;
  if (redis) {
    try {
      const res = await redis.pipeline().incr(key).expire(key, windowSeconds, "NX").ttl(key).exec<[number, number, number]>();
      const count = res[0];
      const ttl = res[2] > 0 ? res[2] : windowSeconds;
      return { allowed: count <= max, remaining: Math.max(0, max - count), retryAfterSeconds: ttl, scope: "redis" };
    } catch {
      // fall through to the per-instance window
    }
  }
  const now = Date.now();
  let w = memoryWindows.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowSeconds * 1000 };
    memoryWindows.set(key, w);
    if (memoryWindows.size > 5000) for (const [k, v] of memoryWindows) if (v.resetAt <= now) memoryWindows.delete(k);
  }
  w.count += 1;
  return { allowed: w.count <= max, remaining: Math.max(0, max - w.count), retryAfterSeconds: Math.ceil((w.resetAt - now) / 1000), scope: "local" };
}

// ---------- health ----------

export async function pingRedis(): Promise<{ configured: boolean; ok: boolean }> {
  const redis = getRedisClient();
  if (!redis) return { configured: false, ok: false };
  try {
    return { configured: true, ok: (await redis.ping()) === "PONG" };
  } catch {
    return { configured: true, ok: false };
  }
}
