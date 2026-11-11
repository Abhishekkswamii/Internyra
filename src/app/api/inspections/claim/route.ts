import { z } from "zod";
import { getAuthAdmin, verifyToken } from "@/lib/firebase/admin";
import { gate, publicInspection } from "@/lib/server/guards";
import { errorResponse, INSPECTION_ID, jsonResponse, logEvent, readJsonBody } from "@/lib/server/http";
import { getStore } from "@/lib/store";


const Body = z.object({ inspectionId: z.string().regex(INSPECTION_ID) });

/**
 * Hands a visitor's pending inspection to their permanent account.
 *
 * - Same UID (the anonymous identity was upgraded in place): the record is simply queued.
 * - Different UID (the visitor signed in to an existing account): the caller must also present the
 *   anonymous identity's ID token in X-Anonymous-Token. Both tokens are verified server-side; the
 *   record is looked up under the *verified anonymous UID* only, so a pending request can never be
 *   claimed by someone who does not hold that anonymous identity.
 */
export async function POST(req: Request): Promise<Response> {
  const g = await gate(req, { scope: "claim", limitUid: 20, limitIp: 40, checkRevoked: true });
  if (!g.ok) return g.response;
  const { requestId, user } = g.ctx;

  const body = await readJsonBody(req, 1024);
  if (!body.ok) return errorResponse(body.status, body.code, body.message, requestId);
  const parsed = Body.safeParse(body.value);
  if (!parsed.success) return errorResponse(422, "INVALID_INSPECTION_ID", "Invalid inspection identifier.", requestId);
  const { inspectionId } = parsed.data;

  const store = getStore();
  const now = new Date().toISOString();
  const anonToken = req.headers.get("x-anonymous-token");

  try {
    let record = null;
    if (anonToken) {
      const anon = await verifyToken(anonToken, false);
      if (!anon || !anon.isAnonymous) return errorResponse(403, "CLAIM_REJECTED", "This request cannot be claimed.", requestId);
      if (anon.uid === user.uid) {
        record = await store.queueInspection(user.uid, inspectionId, now);
      } else {
        record = await store.transferPending(anon.uid, user.uid, inspectionId, now);
        if (record) {
          // The anonymous identity has served its purpose; remove it (best effort).
          const auth = getAuthAdmin();
          await store.deleteUserData(anon.uid).catch(() => {});
          await auth?.deleteUser(anon.uid).catch(() => {});
        }
      }
    } else {
      record = await store.queueInspection(user.uid, inspectionId, now);
    }
    if (!record) return errorResponse(404, "NOT_FOUND", "No pending inspection was found for this account.", requestId);
    await store.upsertUser(user.uid, { email: user.email, provider: "account" }, now);
    logEvent("inspection.claimed", { requestId, transferred: Boolean(anonToken) });
    return jsonResponse({ inspection: publicInspection(record) }, 200, requestId);
  } catch {
    return errorResponse(503, "STORAGE_UNAVAILABLE", "Could not claim the inspection right now.", requestId);
  }
}
