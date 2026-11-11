import { beforeEach, describe, expect, it } from "vitest";
import {
  acquireLock, checkRateLimit, createCacheFingerprint, freshnessSeconds, getCachedAnalysis, normalizeInspectionUrl,
  pingRedis, releaseLock, setCachedAnalysis, setRedisForTests, type CacheKeyParts,
} from "@/lib/cache/redis";
import { FakeRedis } from "../helpers/fake-redis";

const base: CacheKeyParts = { kind: "link", input: "https://jobs.example.com/a?b=2&a=1", parserVersion: "p1", promptVersion: "pr1", schemaVersion: "s1", strategy: "openai:m" };
let redis: FakeRedis;
beforeEach(() => {
  redis = new FakeRedis();
  setRedisForTests(redis.asRedis());
});

describe("cache fingerprints", () => {
  it("normalises tracking params, ordering, case and fragments", () => {
    expect(normalizeInspectionUrl("HTTPS://Jobs.Example.com/a?utm_source=x&b=2&a=1#frag")).toBe("https://jobs.example.com/a?a=1&b=2");
    expect(createCacheFingerprint(base)).toBe(createCacheFingerprint({ ...base, input: "https://JOBS.example.com/a?a=1&b=2&utm_campaign=z#x" }));
  });
  it.each([
    ["input", { input: "https://jobs.example.com/other" }],
    ["parser version", { parserVersion: "p2" }],
    ["prompt version", { promptVersion: "pr2" }],
    ["schema version", { schemaVersion: "s2" }],
    ["provider/model strategy", { strategy: "gemini:g>openai:m" }],
    ["kind", { kind: "message" }],
  ])("changes when the %s changes", (_n, over) => {
    expect(createCacheFingerprint({ ...base, ...over })).not.toBe(createCacheFingerprint(base));
  });
  it("never puts message text or URLs into the key", () => {
    const key = createCacheFingerprint({ ...base, kind: "message", input: "Pay the fee to secret@example.com" });
    expect(key).not.toMatch(/secret|example|fee/i);
    expect(key).toMatch(/^internyra:analysis:message:[0-9a-f]{12}:[0-9a-f]{64}$/);
  });
  it("uses a shorter freshness window for time-sensitive listings", () => {
    expect(freshnessSeconds("link")).toBeLessThan(freshnessSeconds("message"));
  });
});

describe("analysis cache", () => {
  it("returns real hit / miss / error outcomes", async () => {
    expect((await getCachedAnalysis("k")).event).toBe("miss");
    expect(await setCachedAnalysis("k", { payload: { a: 1 }, cachedAt: "t", provider: "openai", model: "m" }, 60)).toBe("stored");
    expect(await getCachedAnalysis("k")).toMatchObject({ event: "hit", value: { provider: "openai" } });
    redis.down = true;
    expect((await getCachedAnalysis("k")).event).toBe("error");
    expect(await setCachedAnalysis("k2", { payload: 1, cachedAt: "t", provider: "p", model: "m" }, 60)).toBe("error");
  });
  it("entries expire after their TTL", async () => {
    await setCachedAnalysis("k", { payload: 1, cachedAt: "t", provider: "p", model: "m" }, 60);
    redis.data.get("k")!.exp = Date.now() - 1;
    expect((await getCachedAnalysis("k")).event).toBe("miss");
  });
  it("reports unconfigured when Redis is absent", async () => {
    setRedisForTests(null);
    expect((await getCachedAnalysis("k")).event).toBe("unconfigured");
    expect(await pingRedis()).toEqual({ configured: false, ok: false });
  });
});

describe("locks", () => {
  it("is atomic: only one holder at a time, and it is re-acquirable after release", async () => {
    const a = await acquireLock("x", 30);
    expect(a?.scope).toBe("redis");
    expect(await acquireLock("x", 30)).toBeNull();
    await releaseLock(a!);
    expect(await acquireLock("x", 30)).not.toBeNull();
  });
  it("a stale holder cannot release a lock that now belongs to someone else", async () => {
    const first = await acquireLock("y", 30);
    redis.data.get(first!.key)!.exp = Date.now() - 1; // expired
    const second = await acquireLock("y", 30);
    expect(second).not.toBeNull();
    await releaseLock(first!);
    expect(await acquireLock("y", 30)).toBeNull(); // second still holds it
  });
  it("falls back to a per-instance lock when Redis is down", async () => {
    redis.down = true;
    const a = await acquireLock("z", 30);
    expect(a?.scope).toBe("local");
    expect(await acquireLock("z", 30)).toBeNull();
    await releaseLock(a!);
    expect(await acquireLock("z", 30)).not.toBeNull();
  });
});

describe("rate limiting", () => {
  it("allows up to the limit, then blocks with a retry-after", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit("u", 3, 60));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
    expect(results[3].scope).toBe("redis");
  });
  it("still enforces a limit locally when Redis is down", async () => {
    redis.down = true;
    const r = [];
    for (let i = 0; i < 3; i++) r.push(await checkRateLimit("u2", 2, 60));
    expect(r.map((x) => x.allowed)).toEqual([true, true, false]);
    expect(r[0].scope).toBe("local");
  });
});
