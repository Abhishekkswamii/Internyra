import type {
  AdminCounts, AuditEvent, BeginRunResult, InspectionRecord, InspectionStore, Page, UsageEvent, UserSummary,
} from "@/lib/store/types";

/** Test-only in-memory InspectionStore with the same semantics as the Firestore store. */
export class MemoryStore implements InspectionStore {
  inspections = new Map<string, InspectionRecord>(); // key: uid/id
  users = new Map<string, UserSummary>();
  usage: (UsageEvent & { id: string; timestamp: string })[] = [];
  audit: (AuditEvent & { timestamp: string })[] = [];
  jobs = new Map<string, { ownerUid: string; status: string }>();
  private key = (uid: string, id: string) => `${uid}/${id}`;
  private seq = 0;

  async createInspection(r: InspectionRecord) {
    if (this.inspections.has(this.key(r.ownerUid, r.id))) throw new Error("exists");
    this.inspections.set(this.key(r.ownerUid, r.id), structuredClone(r));
  }
  async getInspection(uid: string, id: string) {
    const r = this.inspections.get(this.key(uid, id));
    return r ? structuredClone(r) : null;
  }
  private forUser(uid: string) {
    return [...this.inspections.values()].filter((r) => r.ownerUid === uid).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  private page<T extends { createdAt: string }>(all: T[], limit: number, cursor?: string | null): Page<T> {
    const rows = cursor ? all.filter((r) => r.createdAt < cursor) : all;
    const items = rows.slice(0, limit);
    return { items: structuredClone(items), nextCursor: rows.length > limit ? items[items.length - 1].createdAt : null };
  }
  async listInspections(uid: string, limit: number, cursor?: string | null) {
    return this.page(this.forUser(uid), limit, cursor);
  }
  async deleteInspection(uid: string, id: string) {
    this.jobs.delete(id);
    return this.inspections.delete(this.key(uid, id));
  }
  async queueInspection(uid: string, id: string, now: string) {
    const r = this.inspections.get(this.key(uid, id));
    if (!r) return null;
    if (r.status === "queued") return structuredClone(r);
    if (r.status !== "pending_auth") return null;
    r.status = "queued"; r.queuedAt = now; r.updatedAt = now;
    this.jobs.set(id, { ownerUid: uid, status: "queued" });
    return structuredClone(r);
  }
  async transferPending(fromUid: string, toUid: string, id: string, now: string) {
    const r = this.inspections.get(this.key(fromUid, id));
    if (!r || r.status !== "pending_auth" || r.ownerUid !== fromUid) return null;
    this.inspections.delete(this.key(fromUid, id));
    const moved = { ...r, ownerUid: toUid, status: "queued" as const, queuedAt: now, updatedAt: now };
    this.inspections.set(this.key(toUid, id), moved);
    this.jobs.set(id, { ownerUid: toUid, status: "queued" });
    return structuredClone(moved);
  }
  async beginRun(uid: string, id: string, now: string, leaseMs: number): Promise<BeginRunResult> {
    const r = this.inspections.get(this.key(uid, id));
    if (!r) return { ok: false, reason: "not_found" };
    if (r.status === "running" && r.leaseExpiresAt && r.leaseExpiresAt > now) return { ok: false, reason: "already_running" };
    if (!["queued", "failed", "running"].includes(r.status)) return { ok: false, reason: "not_runnable" };
    r.status = "running"; r.startedAt = now; r.updatedAt = now; r.attempts = (r.attempts ?? 0) + 1; r.error = undefined;
    r.leaseExpiresAt = new Date(new Date(now).getTime() + leaseMs).toISOString();
    return { ok: true, record: structuredClone(r) };
  }
  async finishRun(uid: string, id: string, patch: Partial<InspectionRecord>) {
    const r = this.inspections.get(this.key(uid, id));
    if (!r) return;
    Object.assign(r, patch);
    if (patch.status === "completed" && r.submission) delete r.submission.text;
    delete r.leaseExpiresAt;
  }
  async upsertUser(uid: string, data: { email?: string; provider?: string }, now: string) {
    const prev = this.users.get(uid);
    this.users.set(uid, { uid, ...prev, ...data, createdAt: prev?.createdAt ?? now, lastSeenAt: now });
  }
  async deleteUserData(uid: string) {
    let n = 0;
    for (const [k, r] of this.inspections) if (r.ownerUid === uid) { this.inspections.delete(k); this.jobs.delete(r.id); n++; }
    this.users.delete(uid);
    return n;
  }
  async deleteAbandoned(cutoff: string, limit: number) {
    const uids = new Set<string>();
    for (const [k, r] of this.inspections) {
      if (uids.size >= limit) break;
      if (r.status === "pending_auth" && r.createdAt < cutoff) { this.inspections.delete(k); uids.add(r.ownerUid); }
    }
    return [...uids];
  }
  async recordUsage(e: UsageEvent, now: string) { this.usage.push({ ...e, id: `u${++this.seq}`, timestamp: now }); }
  async recordAudit(e: AuditEvent, now: string) { this.audit.push({ ...e, timestamp: now }); }
  async adminCounts(): Promise<AdminCounts> {
    const byStatus: Record<string, number> = {};
    for (const r of this.inspections.values()) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    return { users: this.users.size, inspections: this.inspections.size, byStatus };
  }
  async adminListUsers(limit: number, cursor?: string | null) {
    return this.page([...this.users.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), limit, cursor);
  }
  async adminListInspections(limit: number, cursor?: string | null) {
    const all = [...this.inspections.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => ({ ...r, submission: { ...r.submission, text: undefined } }));
    return this.page(all, limit, cursor);
  }
  async adminListUsage(limit: number, cursor?: string | null) {
    const all = [...this.usage].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    const rows = cursor ? all.filter((r) => r.timestamp < cursor) : all;
    const items = rows.slice(0, limit);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].timestamp : null };
  }
  async adminUsageTotals() {
    const cache: Record<string, number> = { hit: 0, miss: 0, refresh: 0, error: 0 };
    const providers: Record<string, number> = { gemini: 0, openai: 0 };
    let fallbacks = 0, rateLimited = 0;
    for (const u of this.usage) {
      if (u.cacheEvent) cache[u.cacheEvent] += 1;
      if (u.type === "research" && u.provider) providers[u.provider] = (providers[u.provider] ?? 0) + 1;
      if (u.fallback) fallbacks++;
      if (u.type === "rate_limit") rateLimited++;
    }
    return { cache, providers, fallbacks, rateLimited };
  }
}
