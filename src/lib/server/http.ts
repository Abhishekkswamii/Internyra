import "server-only";
import { createHash, randomUUID } from "crypto";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function newRequestId(): string {
  return `req_${randomUUID().slice(0, 12)}`;
}

export function jsonResponse(body: unknown, status: number, requestId: string, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, "X-Request-Id": requestId, ...extra } });
}

/** Safe error body: a stable code and a user-facing message. Never exception text. */
export function errorResponse(status: number, code: string, message: string, requestId: string, extra: Record<string, string> = {}): Response {
  return jsonResponse({ error: { code, message, requestId } }, status, requestId, extra);
}

/**
 * Hosts this deployment is legitimately served from. Behind Firebase App Hosting / Cloud Run the request URL
 * carries an internal host, so the public host arrives in X-Forwarded-Host (set by Google's front end, which a
 * cross-site browser request cannot forge). APP_BASE_URL, when set, is also accepted.
 */
function ownHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  const add = (h: string | null | undefined) => h && hosts.add(h.split(",")[0].trim().toLowerCase());
  add(req.headers.get("x-forwarded-host"));
  add(req.headers.get("host"));
  try {
    add(new URL(req.url).host);
  } catch {}
  try {
    const base = process.env.APP_BASE_URL;
    if (base) add(new URL(base).host);
  } catch {}
  return hosts;
}

/** Rejects cross-origin state-changing requests (CSRF defence for cookie-less bearer APIs too). */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients and same-origin GETs send no Origin
  try {
    return ownHosts(req).has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

export type BodyResult = { ok: true; value: unknown } | { ok: false; status: number; code: string; message: string };

/** Reads a size-limited JSON body. Enforces the limit on actual bytes, not only Content-Length. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<BodyResult> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, status: 415, code: "UNSUPPORTED_MEDIA_TYPE", message: "Send the request as JSON." };
  }
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, status: 413, code: "PAYLOAD_TOO_LARGE", message: "The request is too large." };
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, status: 400, code: "INVALID_BODY", message: "Could not read the request body." };
  }
  if (Buffer.byteLength(raw, "utf8") > maxBytes) return { ok: false, status: 413, code: "PAYLOAD_TOO_LARGE", message: "The request is too large." };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400, code: "INVALID_JSON", message: "The request body is not valid JSON." };
  }
}

/**
 * Best-effort client address for rate limiting. Behind Google's front end the address that the
 * platform appends is the right-most entry; earlier entries can be client-supplied. Only ever used
 * hashed, and only as one of two rate-limit keys (the other is the verified UID).
 */
export function clientAddress(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

/** Inspection IDs are server-minted; anything else is rejected before touching storage. */
export const INSPECTION_ID = /^insp_[A-Za-z0-9-]{8,64}$/;
export function newInspectionId(): string {
  return `insp_${randomUUID()}`;
}

/** Structured log line that never includes request bodies, tokens or message text. */
export function logEvent(event: string, fields: Record<string, string | number | boolean | undefined>): void {
  console.log(JSON.stringify({ event, ...fields, ts: new Date().toISOString() }));
}
