/**
 * Post-login redirect targets must be same-site paths. Anything that could leave the site
 * (absolute URLs, protocol-relative "//host", backslash tricks, encoded variants, control characters)
 * falls back to the default.
 */
export const DEFAULT_AFTER_AUTH = "/app";

export function safeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_AFTER_AUTH): string {
  if (!raw) return fallback;
  let value = raw.trim();
  // Decode up to twice so "%2F%2Fevil.com" cannot sneak through, then judge the decoded form.
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      return fallback;
    }
  }
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(value)) return fallback;
  // Only the signed-in application, never the auth pages themselves (avoids redirect loops).
  if (!(value === "/app" || value.startsWith("/app/") || value.startsWith("/app?"))) return fallback;
  return value;
}

export function loginUrlFor(next: string): string {
  return `/login?next=${encodeURIComponent(safeNextPath(next))}`;
}
