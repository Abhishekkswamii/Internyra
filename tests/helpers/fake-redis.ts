import type { Redis } from "@upstash/redis";

/** Minimal scriptable stand-in for the Upstash client (only the calls the app makes). */
export class FakeRedis {
  data = new Map<string, { v: unknown; exp: number | null }>();
  down = false;
  private live(k: string) {
    const e = this.data.get(k);
    if (!e) return undefined;
    if (e.exp !== null && e.exp <= Date.now()) { this.data.delete(k); return undefined; }
    return e;
  }
  private check() { if (this.down) throw new Error("redis down"); }
  async get<T>(k: string) { this.check(); return (this.live(k)?.v as T) ?? null; }
  async set(k: string, v: unknown, o?: { ex?: number; nx?: boolean }) {
    this.check();
    if (o?.nx && this.live(k)) return null;
    this.data.set(k, { v, exp: o?.ex ? Date.now() + o.ex * 1000 : null });
    return "OK";
  }
  async del(k: string) { this.check(); return this.data.delete(k) ? 1 : 0; }
  async ping() { this.check(); return "PONG"; }
  async eval(_s: string, keys: string[], args: string[]) {
    this.check();
    const e = this.live(keys[0]);
    if (e && e.v === args[0]) { this.data.delete(keys[0]); return 1; }
    return 0;
  }
  pipeline() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const ops: (() => number)[] = [];
    const p = {
      incr(k: string) { ops.push(() => { const e = self.live(k); const n = ((e?.v as number) ?? 0) + 1; self.data.set(k, { v: n, exp: e?.exp ?? null }); return n; }); return p; },
      expire(k: string, s: number) { ops.push(() => { const e = self.live(k); if (e && e.exp === null) e.exp = Date.now() + s * 1000; return 1; }); return p; },
      ttl(k: string) { ops.push(() => { const e = self.live(k); return e?.exp ? Math.ceil((e.exp - Date.now()) / 1000) : -1; }); return p; },
      async exec() { self.check(); return ops.map((f) => f()); },
    };
    return p;
  }
  asRedis(): Redis { return this as unknown as Redis; }
}
