import { getAuthAdmin } from "@/lib/firebase/admin";
import { gate } from "@/lib/server/guards";
import { errorResponse, jsonResponse, logEvent } from "@/lib/server/http";
import { getStore } from "@/lib/store";


/** Deletes the caller's own data and Auth account. The UID comes from the verified token only. */
export async function DELETE(req: Request): Promise<Response> {
  const g = await gate(req, { scope: "account-delete", limitUid: 5, limitIp: 10, allowAnonymous: true, checkRevoked: true });
  if (!g.ok) return g.response;
  const { requestId, user } = g.ctx;
  try {
    const removed = await getStore().deleteUserData(user.uid);
    await getAuthAdmin()?.deleteUser(user.uid);
    logEvent("account.deleted", { requestId, inspections: removed });
    return jsonResponse({ ok: true, inspectionsDeleted: removed }, 200, requestId);
  } catch {
    return errorResponse(503, "DELETE_FAILED", "Could not delete the account right now. Nothing was partially hidden; please try again.", requestId);
  }
}
