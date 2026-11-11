import "server-only";
import { bearerToken, verifyToken, type VerifiedAuthUser } from "@/lib/firebase/admin";
import { checkRateLimit } from "@/lib/cache/redis";
import { getStore } from "@/lib/store";
import { clientAddress, errorResponse, hashKey, isSameOrigin, newRequestId } from "./http";

export interface Ctx {
  requestId: string;
  user: VerifiedAuthUser;
}

type Gate = { ok: true; ctx: Ctx } | { ok: false; response: Response };

/**
 * Common gate for state-changing and private routes: same-origin, verified Firebase ID token,
 * IP + UID rate limits. Rate-limit hits are recorded as real security events.
 */
export async function gate(
  req: Request,
  opts: { limitUid: number; limitIp: number; windowSeconds?: number; scope: string; allowAnonymous?: boolean; checkRevoked?: boolean; mutating?: boolean }
): Promise<Gate> {
  const requestId = newRequestId();
  if (opts.mutating !== false && !isSameOrigin(req)) return { ok: false, response: errorResponse(403, "CROSS_ORIGIN", "Cross-origin requests are not allowed.", requestId) };

  const token = bearerToken(req);
  // Always check revocation/existence: a deleted or disabled account's still-valid ID token must not work.
  const user = token ? await verifyToken(token, opts.checkRevoked ?? true) : null;
  if (!user) return { ok: false, response: errorResponse(401, "UNAUTHORIZED", "Sign-in required.", requestId) };
  if (user.isAnonymous && !opts.allowAnonymous) return { ok: false, response: errorResponse(403, "ACCOUNT_REQUIRED", "Create an account or sign in to continue.", requestId) };

  const window = opts.windowSeconds ?? 3600;
  const [byUid, byIp] = await Promise.all([
    checkRateLimit(`${opts.scope}:uid:${user.uid}`, opts.limitUid, window),
    checkRateLimit(`${opts.scope}:ip:${hashKey(clientAddress(req))}`, opts.limitIp, window),
  ]);
  const blocked = !byUid.allowed ? byUid : !byIp.allowed ? byIp : null;
  if (blocked) {
    void getStore().recordUsage({ uid: user.uid, type: "rate_limit", code: opts.scope }, new Date().toISOString()).catch(() => {});
    return { ok: false, response: errorResponse(429, "RATE_LIMITED", "Too many requests. Please wait before trying again.", requestId, { "Retry-After": String(blocked.retryAfterSeconds) }) };
  }
  return { ok: true, ctx: { requestId, user } };
}

/** Removes server-only fields from a record before it leaves the server. */
export function publicInspection<T extends { leaseExpiresAt?: string }>(rec: T): Omit<T, "leaseExpiresAt"> {
  const { leaseExpiresAt: _lease, ...rest } = rec;
  void _lease;
  return rest;
}
