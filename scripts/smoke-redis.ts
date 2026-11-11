/**
 * Opt-in Redis smoke test. Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from the environment
 * (load .env.local yourself: `node --env-file=.env.local ...`). Prints outcomes only, never values.
 * Run it only with your NEWLY ROTATED token.
 */
import { Redis } from "@upstash/redis";

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return console.log("SKIPPED: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set.");
  const r = new Redis({ url, token });
  const key = `internyra:smoke:${Date.now()}`;
  const checks: [string, () => Promise<boolean>][] = [
    ["PING", async () => (await r.ping()) === "PONG"],
    ["SET with TTL + GET", async () => { await r.set(key, "ok", { ex: 15 }); return (await r.get(key)) === "ok"; }],
    ["lock: first SET NX succeeds", async () => (await r.set(`${key}:lock`, "a", { nx: true, ex: 15 })) === "OK"],
    ["lock: second SET NX is refused", async () => (await r.set(`${key}:lock`, "b", { nx: true, ex: 15 })) === null],
    ["cleanup", async () => { await r.del(key, `${key}:lock`); return (await r.get(key)) === null; }],
  ];
  let failed = 0;
  for (const [name, fn] of checks) {
    try {
      const ok = await fn();
      console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
      if (!ok) failed++;
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name} (${(e as { name?: string }).name ?? "error"})`);
    }
  }
  process.exit(failed ? 1 : 0);
}
void main();
