import { getRedisClient, pingRedis } from "@/lib/cache/redis";
import { getServerConfig } from "@/lib/config/env";
import { strategyFor } from "@/lib/research/coordinator";
import { configuredProviders } from "@/lib/research/providers";
import { requireAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit } from "@/lib/cache/redis";
import { errorResponse, isSameOrigin, jsonResponse, newRequestId } from "@/lib/server/http";
import { getStore } from "@/lib/store";


const VIEWS = ["overview", "users", "inspections", "usage"] as const;
type View = (typeof VIEWS)[number];

/** Admin data. Requires a verified token, the admin custom claim, and the exact configured ADMIN_UID. */
export async function GET(req: Request): Promise<Response> {
  const requestId = newRequestId();
  if (!isSameOrigin(req)) return errorResponse(403, "CROSS_ORIGIN", "Cross-origin requests are not allowed.", requestId);
  const admin = await requireAdminAuth(req);
  // The same response for "not signed in" and "not admin" avoids revealing that an admin area exists.
  if (!admin) return errorResponse(403, "FORBIDDEN", "Administrator access required.", requestId);

  const rl = await checkRateLimit(`admin:${admin.uid}`, 120, 3600);
  if (!rl.allowed) return errorResponse(429, "RATE_LIMITED", "Too many requests.", requestId, { "Retry-After": String(rl.retryAfterSeconds) });

  const url = new URL(req.url);
  const view = (url.searchParams.get("view") ?? "overview") as View;
  if (!VIEWS.includes(view)) return errorResponse(422, "INVALID_VIEW", "Unknown view.", requestId);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20") || 20, 1), 50);
  const cursor = url.searchParams.get("cursor");

  const store = getStore();
  try {
    await store.recordAudit({ adminUid: admin.uid, action: `admin.read.${view}` }, new Date().toISOString());
    if (view === "overview") {
      const [counts, usage] = await Promise.all([store.adminCounts(), store.adminUsageTotals()]);
      // Booleans only: what is configured, never any value.
      const p = configuredProviders();
      const redis = getRedisClient() ? await pingRedis() : { configured: false, ok: false };
      const ai = {
        enabled: getServerConfig().AI_INSPECTIONS_ENABLED && p.providers.length > 0,
        geminiConfigured: p.geminiConfigured,
        openaiConfigured: p.openaiConfigured,
        webSearchEnabled: p.webSearch,
        strategy: strategyFor(p.providers, p.geminiConfigured),
      };
      return jsonResponse({ counts, usage, redisConfigured: redis.configured, redisReachable: redis.ok, ai }, 200, requestId);
    }
    if (view === "users") return jsonResponse(await store.adminListUsers(limit, cursor), 200, requestId);
    if (view === "inspections") return jsonResponse(await store.adminListInspections(limit, cursor), 200, requestId);
    return jsonResponse(await store.adminListUsage(limit, cursor), 200, requestId);
  } catch {
    return errorResponse(503, "STORAGE_UNAVAILABLE", "Could not load admin data right now.", requestId);
  }
}
