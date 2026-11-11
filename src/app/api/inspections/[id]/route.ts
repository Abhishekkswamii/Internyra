import { gate, publicInspection } from "@/lib/server/guards";
import { errorResponse, INSPECTION_ID, jsonResponse } from "@/lib/server/http";
import { getStore } from "@/lib/store";


type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const g = await gate(req, { scope: "get", limitUid: 600, limitIp: 1200, allowAnonymous: true, mutating: false });
  if (!g.ok) return g.response;
  const { id } = await params;
  if (!INSPECTION_ID.test(id)) return errorResponse(404, "NOT_FOUND", "Inspection not found.", g.ctx.requestId);
  try {
    // Reads are scoped to the verified UID: another user's ID simply does not exist for this caller.
    const rec = await getStore().getInspection(g.ctx.user.uid, id);
    if (!rec) return errorResponse(404, "NOT_FOUND", "Inspection not found.", g.ctx.requestId);
    return jsonResponse({ inspection: publicInspection(rec) }, 200, g.ctx.requestId);
  } catch {
    return errorResponse(503, "STORAGE_UNAVAILABLE", "Could not load the inspection right now.", g.ctx.requestId);
  }
}

export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  const g = await gate(req, { scope: "delete", limitUid: 60, limitIp: 120, allowAnonymous: true });
  if (!g.ok) return g.response;
  const { id } = await params;
  if (!INSPECTION_ID.test(id)) return errorResponse(404, "NOT_FOUND", "Inspection not found.", g.ctx.requestId);
  try {
    const removed = await getStore().deleteInspection(g.ctx.user.uid, id);
    if (!removed) return errorResponse(404, "NOT_FOUND", "Inspection not found.", g.ctx.requestId);
    return jsonResponse({ ok: true }, 200, g.ctx.requestId);
  } catch {
    return errorResponse(503, "STORAGE_UNAVAILABLE", "Could not delete the inspection right now.", g.ctx.requestId);
  }
}
