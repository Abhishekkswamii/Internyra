import { defaultPipelineDeps, runInspection } from "@/lib/pipeline/run-inspection";
import { gate, publicInspection } from "@/lib/server/guards";
import { errorResponse, INSPECTION_ID, jsonResponse, logEvent, readJsonBody } from "@/lib/server/http";
import { getStore } from "@/lib/store";

// Gemini/OpenAI calls plus one page fetch must fit inside the Cloud Run request timeout.
export const maxDuration = 240;

/** Runs a queued inspection for its signed-in owner. Anonymous visitors can never reach this. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const g = await gate(req, { scope: "run", limitUid: 15, limitIp: 40, checkRevoked: true });
  if (!g.ok) return g.response;
  const { requestId, user } = g.ctx;
  const { id } = await params;
  if (!INSPECTION_ID.test(id)) return errorResponse(404, "NOT_FOUND", "Inspection not found.", requestId);

  const body = req.headers.get("content-length") === "0" ? { ok: true as const, value: {} } : await readJsonBody(req, 1024);
  const refresh = body.ok && typeof body.value === "object" && body.value !== null && (body.value as { refresh?: unknown }).refresh === true;

  const store = getStore();
  const result = await runInspection(user.uid, id, { refresh }, defaultPipelineDeps(store));
  logEvent("inspection.run", { requestId, outcome: result.outcome });

  switch (result.outcome) {
    case "completed":
    case "failed":
      return jsonResponse({ inspection: publicInspection(result.record) }, 200, requestId);
    case "ai_disabled":
      return errorResponse(503, "AI_DISABLED", "AI research is currently paused. Your inspection is saved and will stay queued.", requestId);
    case "already_running":
      return errorResponse(409, "ALREADY_RUNNING", "This inspection is already being processed.", requestId);
    case "not_runnable":
      return errorResponse(409, "NOT_RUNNABLE", "This inspection cannot be run in its current state.", requestId);
    default:
      return errorResponse(404, "NOT_FOUND", "Inspection not found.", requestId);
  }
}
