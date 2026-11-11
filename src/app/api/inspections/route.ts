import { validateVerificationRequest } from "@/lib/engine";
import { normalizeInspectionUrl } from "@/lib/cache/redis";
import { getAuthAdmin } from "@/lib/firebase/admin";
import { currentVersions } from "@/lib/pipeline/run-inspection";
import { gate, publicInspection } from "@/lib/server/guards";
import { errorResponse, jsonResponse, logEvent, newInspectionId, readJsonBody } from "@/lib/server/http";
import { getStore, StorageUnavailableError, type InspectionRecord } from "@/lib/store";
import { createHash } from "crypto";

const MAX_BODY = 48 * 1024;
const ABANDONED_AFTER_MS = 24 * 3600_000;

/** Create an inspection. Anonymous visitors get pending_auth; signed-in users get queued. No AI runs here. */
export async function POST(req: Request): Promise<Response> {
  const g = await gate(req, { scope: "create", limitUid: 20, limitIp: 40, allowAnonymous: true });
  if (!g.ok) return g.response;
  const { requestId, user } = g.ctx;

  const body = await readJsonBody(req, MAX_BODY);
  if (!body.ok) return errorResponse(body.status, body.code, body.message, requestId);
  const v = validateVerificationRequest(body.value);
  if (!v.ok) return errorResponse(422, v.code, v.message, requestId);
  const r = v.value;

  const now = new Date().toISOString();
  const record: InspectionRecord = {
    id: newInspectionId(),
    ownerUid: user.uid, // always the verified token's UID, never a client-supplied one
    inputType: r.kind,
    status: user.isAnonymous ? "pending_auth" : "queued",
    submission: {
      kind: r.kind,
      url: r.url,
      normalizedUrl: r.url ? normalizeInspectionUrl(r.url) : undefined,
      text: r.text,
      textLength: r.text?.length,
      textHash: r.text ? createHash("sha256").update(r.text).digest("hex").slice(0, 16) : undefined,
      claimedCompany: r.claimedCompany,
      claimedRole: r.claimedRole,
      recruiterName: r.recruiterName,
      recruiterEmail: r.recruiterEmail,
    },
    attempts: 0,
    versions: currentVersions(),
    createdAt: now,
    updatedAt: now,
    ...(user.isAnonymous ? {} : { queuedAt: now }),
  };

  try {
    const store = getStore();
    await store.upsertUser(user.uid, { email: user.email, provider: user.isAnonymous ? "anonymous" : "account" }, now);
    await store.createInspection(record);
    void cleanupAbandoned().catch(() => {});
    logEvent("inspection.created", { requestId, status: record.status, kind: r.kind });
    return jsonResponse({ inspection: publicInspection(record) }, 201, requestId);
  } catch (err) {
    logEvent("inspection.create_failed", { requestId, storage: err instanceof StorageUnavailableError });
    return errorResponse(503, "STORAGE_UNAVAILABLE", "Could not save the inspection right now. Please try again.", requestId);
  }
}

/** Bounded, opportunistic cleanup of anonymous requests that were never claimed. */
async function cleanupAbandoned(): Promise<void> {
  const store = getStore();
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS).toISOString();
  const uids = await store.deleteAbandoned(cutoff, 10);
  const auth = getAuthAdmin();
  if (!auth) return;
  for (const uid of uids) {
    try {
      const u = await auth.getUser(uid);
      if (u.providerData.length === 0) {
        await store.deleteUserData(uid);
        await auth.deleteUser(uid);
      }
    } catch {}
  }
}

export async function GET(req: Request): Promise<Response> {
  const g = await gate(req, { scope: "list", limitUid: 120, limitIp: 240, allowAnonymous: true, mutating: false });
  if (!g.ok) return g.response;
  const { requestId, user } = g.ctx;
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20") || 20, 1), 50);
  try {
    const page = await getStore().listInspections(user.uid, limit, url.searchParams.get("cursor"));
    return jsonResponse({ inspections: page.items.map(publicInspection), nextCursor: page.nextCursor }, 200, requestId);
  } catch {
    return errorResponse(503, "STORAGE_UNAVAILABLE", "Could not load inspections right now.", requestId);
  }
}
