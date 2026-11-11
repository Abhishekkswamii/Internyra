import "server-only";
import { FieldValue, type Firestore, type DocumentSnapshot } from "firebase-admin/firestore";
import { getFirestoreAdmin } from "@/lib/firebase/admin";
import {
  StorageUnavailableError,
  type AdminCounts,
  type AuditEvent,
  type BeginRunResult,
  type InspectionRecord,
  type InspectionStore,
  type Page,
  type UsageEvent,
  type UserSummary,
} from "./types";

function strip<T>(value: T): T {
  // Firestore rejects undefined values.
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Cursors are the last item's createdAt timestamp (millisecond ISO string), base64url-wrapped. */
function encodeCursor(createdAt: string): string {
  return Buffer.from(createdAt).toString("base64url");
}
function decodeCursor(cursor: string | null | undefined): string | null {
  if (!cursor) return null;
  try {
    const v = Buffer.from(cursor, "base64url").toString();
    return /^\d{4}-\d{2}-\d{2}T/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export class FirestoreStore implements InspectionStore {
  private db(): Firestore {
    const db = getFirestoreAdmin();
    if (!db) throw new StorageUnavailableError();
    return db;
  }
  private inspections(uid: string) {
    return this.db().collection("users").doc(uid).collection("inspections");
  }

  async createInspection(record: InspectionRecord): Promise<void> {
    await this.inspections(record.ownerUid).doc(record.id).create(strip(record));
  }

  async getInspection(uid: string, id: string): Promise<InspectionRecord | null> {
    const snap = await this.inspections(uid).doc(id).get();
    return snap.exists ? (snap.data() as InspectionRecord) : null;
  }

  async listInspections(uid: string, limit: number, cursor?: string | null): Promise<Page<InspectionRecord>> {
    let q = this.inspections(uid).orderBy("createdAt", "desc");
    const c = decodeCursor(cursor);
    if (c) q = q.startAfter(c);
    const snap = await q.limit(limit + 1).get();
    const docs = snap.docs.slice(0, limit).map((d) => d.data() as InspectionRecord);
    const last = docs[docs.length - 1];
    return { items: docs, nextCursor: snap.docs.length > limit && last ? encodeCursor(last.createdAt) : null };
  }

  async deleteInspection(uid: string, id: string): Promise<boolean> {
    const ref = this.inspections(uid).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.delete();
    await this.db().collection("inspectionJobs").doc(id).delete().catch(() => {});
    return true;
  }

  async queueInspection(uid: string, id: string, now: string): Promise<InspectionRecord | null> {
    const ref = this.inspections(uid).doc(id);
    return this.db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const rec = snap.data() as InspectionRecord;
      if (rec.status === "queued") return rec;
      if (rec.status !== "pending_auth") return null;
      const next: InspectionRecord = { ...rec, status: "queued", queuedAt: now, updatedAt: now };
      tx.update(ref, strip({ status: "queued", queuedAt: now, updatedAt: now }));
      tx.set(this.db().collection("inspectionJobs").doc(id), { ownerUid: uid, status: "queued", attempts: 0, updatedAt: now });
      return next;
    });
  }

  async transferPending(fromUid: string, toUid: string, id: string, now: string): Promise<InspectionRecord | null> {
    const from = this.inspections(fromUid).doc(id);
    const to = this.inspections(toUid).doc(id);
    return this.db().runTransaction(async (tx) => {
      const snap = await tx.get(from);
      if (!snap.exists) return null;
      const rec = snap.data() as InspectionRecord;
      if (rec.status !== "pending_auth" || rec.ownerUid !== fromUid) return null;
      const moved: InspectionRecord = { ...rec, ownerUid: toUid, status: "queued", queuedAt: now, updatedAt: now };
      tx.create(to, strip(moved));
      tx.delete(from);
      tx.set(this.db().collection("inspectionJobs").doc(id), { ownerUid: toUid, status: "queued", attempts: 0, updatedAt: now });
      return moved;
    });
  }

  async beginRun(uid: string, id: string, now: string, leaseMs: number): Promise<BeginRunResult> {
    const ref = this.inspections(uid).doc(id);
    return this.db().runTransaction(async (tx): Promise<BeginRunResult> => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, reason: "not_found" };
      const rec = snap.data() as InspectionRecord;
      const leaseLive = rec.status === "running" && rec.leaseExpiresAt && rec.leaseExpiresAt > now;
      if (leaseLive) return { ok: false, reason: "already_running" };
      if (rec.status !== "queued" && rec.status !== "failed" && rec.status !== "running") return { ok: false, reason: "not_runnable" };
      const lease = new Date(new Date(now).getTime() + leaseMs).toISOString();
      const next: InspectionRecord = { ...rec, status: "running", startedAt: now, updatedAt: now, leaseExpiresAt: lease, attempts: (rec.attempts ?? 0) + 1, error: undefined };
      tx.update(ref, strip({ status: "running", startedAt: now, updatedAt: now, leaseExpiresAt: lease, attempts: next.attempts, error: FieldValue.delete() }));
      tx.set(this.db().collection("inspectionJobs").doc(id), { ownerUid: uid, status: "running", attempts: next.attempts, updatedAt: now }, { merge: true });
      return { ok: true, record: next };
    });
  }

  async finishRun(uid: string, id: string, patch: Partial<InspectionRecord>): Promise<void> {
    const clean: Record<string, unknown> = strip(patch);
    // Raw pasted text is not retained once the run has finished successfully.
    if (patch.status === "completed") clean["submission.text"] = FieldValue.delete();
    clean["leaseExpiresAt"] = FieldValue.delete();
    await this.inspections(uid).doc(id).update(clean);
    if (patch.status) {
      await this.db().collection("inspectionJobs").doc(id).set({ status: patch.status, updatedAt: patch.updatedAt ?? new Date().toISOString() }, { merge: true });
    }
  }

  async upsertUser(uid: string, data: { email?: string; provider?: string }, now: string): Promise<void> {
    const ref = this.db().collection("users").doc(uid);
    const snap = await ref.get();
    await ref.set(strip({ uid, ...data, lastSeenAt: now, ...(snap.exists ? {} : { createdAt: now }) }), { merge: true });
  }

  async deleteUserData(uid: string): Promise<number> {
    const db = this.db();
    const col = this.inspections(uid);
    let removed = 0;
    for (;;) {
      const snap = await col.limit(100).get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const d of snap.docs) {
        batch.delete(d.ref);
        batch.delete(db.collection("inspectionJobs").doc(d.id));
      }
      await batch.commit();
      removed += snap.size;
    }
    await db.collection("users").doc(uid).delete();
    return removed;
  }

  async deleteAbandoned(cutoffIso: string, limit: number): Promise<string[]> {
    const snap = await this.db().collectionGroup("inspections").where("status", "==", "pending_auth").where("createdAt", "<", cutoffIso).limit(limit).get();
    const uids = new Set<string>();
    const batch = this.db().batch();
    for (const d of snap.docs) {
      uids.add((d.data() as InspectionRecord).ownerUid);
      batch.delete(d.ref);
    }
    if (!snap.empty) await batch.commit();
    return [...uids];
  }

  async recordUsage(event: UsageEvent, now: string): Promise<void> {
    await this.db().collection("usageEvents").add(strip({ ...event, timestamp: now }));
  }

  async recordAudit(event: AuditEvent, now: string): Promise<void> {
    await this.db().collection("adminAuditLogs").add(strip({ ...event, timestamp: now }));
  }

  // ---------- admin ----------

  async adminCounts(): Promise<AdminCounts> {
    const db = this.db();
    const [users, inspections, ...statuses] = await Promise.all([
      db.collection("users").count().get(),
      db.collectionGroup("inspections").count().get(),
      ...(["pending_auth", "queued", "running", "completed", "failed"] as const).map((s) => db.collectionGroup("inspections").where("status", "==", s).count().get()),
    ]);
    const names = ["pending_auth", "queued", "running", "completed", "failed"];
    const byStatus: Record<string, number> = {};
    statuses.forEach((s, i) => (byStatus[names[i]] = s.data().count));
    return { users: users.data().count, inspections: inspections.data().count, byStatus };
  }

  async adminListUsers(limit: number, cursor?: string | null): Promise<Page<UserSummary>> {
    let q = this.db().collection("users").orderBy("createdAt", "desc");
    const c = decodeCursor(cursor);
    if (c) q = q.startAfter(c);
    const snap = await q.limit(limit + 1).get();
    const items = snap.docs.slice(0, limit).map((d: DocumentSnapshot) => d.data() as UserSummary);
    const last = items[items.length - 1];
    return { items, nextCursor: snap.docs.length > limit && last ? encodeCursor(last.createdAt) : null };
  }

  async adminListInspections(limit: number, cursor?: string | null): Promise<Page<InspectionRecord>> {
    let q = this.db().collectionGroup("inspections").orderBy("createdAt", "desc");
    const c = decodeCursor(cursor);
    if (c) q = q.startAfter(c);
    const snap = await q.limit(limit + 1).get();
    const items = snap.docs.slice(0, limit).map((d) => {
      const r = d.data() as InspectionRecord;
      // Administrators see operational fields, not pasted message bodies.
      return { ...r, submission: { ...r.submission, text: undefined } };
    });
    const last = items[items.length - 1];
    return { items, nextCursor: snap.docs.length > limit && last ? encodeCursor(last.createdAt) : null };
  }

  async adminListUsage(limit: number, cursor?: string | null) {
    let q = this.db().collection("usageEvents").orderBy("timestamp", "desc");
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.limit(limit + 1).get();
    const items = snap.docs.slice(0, limit).map((d) => ({ id: d.id, ...(d.data() as UsageEvent & { timestamp: string }) }));
    const last = items[items.length - 1];
    return { items, nextCursor: snap.docs.length > limit && last ? last.timestamp : null };
  }

  async adminUsageTotals() {
    const db = this.db();
    const count = async (field: string, value: string | boolean) => (await db.collection("usageEvents").where(field, "==", value).count().get()).data().count;
    const [hit, miss, refresh, err, fb, rl] = await Promise.all([
      count("cacheEvent", "hit"), count("cacheEvent", "miss"), count("cacheEvent", "refresh"), count("cacheEvent", "error"),
      count("fallback", true), count("type", "rate_limit"),
    ]);
    const providers: Record<string, number> = {};
    for (const p of ["gemini", "openai"]) providers[p] = (await db.collection("usageEvents").where("type", "==", "research").where("provider", "==", p).count().get()).data().count;
    return { cache: { hit, miss, refresh, error: err }, providers, fallbacks: fb, rateLimited: rl };
  }
}
