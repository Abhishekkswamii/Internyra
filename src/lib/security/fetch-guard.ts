import * as dns from "dns/promises";
import * as dnsCb from "dns";
import { Agent } from "undici";
import { isPublicIp, parseIpv4, isIpv6 } from "./ip";

export type FetchFailureCode =
  | "blocked_destination"
  | "robots_disallowed"
  | "timeout"
  | "http_error"
  | "unsupported_type"
  | "too_large"
  | "too_many_redirects"
  | "network";

export interface SafeFetchResult {
  ok: boolean;
  /** Stable, safe category. Raw network errors are never surfaced to clients. */
  code?: FetchFailureCode;
  finalUrl?: string;
  statusCode?: number;
  contentType?: string;
  text?: string;
  title?: string;
  error?: string;
}

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
const TIMEOUT_MS = 8000;
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const USER_AGENT = "InternyraBot/1.0 (+https://internyra-385d6.web.app; safety-research)";
const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain", "application/xhtml+xml"];

/**
 * Validates a URL destination for SSRF safety.
 * Resolves DNS and checks that all resolved addresses are public, non-private IPs.
 */
export async function validateSafeDestination(targetUrl: string): Promise<{ safe: boolean; urlObj?: URL; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { safe: false, error: "Invalid URL structure." };
  }

  // 1. Protocol check
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, error: "Only HTTP and HTTPS protocols are supported." };
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    return { safe: false, error: "URLs containing user credentials are not permitted." };
  }

  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { safe: false, error: "Only standard web ports are permitted." };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Reject known metadata/localhost hostnames directly
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal" ||
    hostname === "instance-data"
  ) {
    return { safe: false, error: "Access to private or local hosts is strictly prohibited." };
  }

  // 4. Resolve DNS and validate each IP
  try {
    // If hostname is already an IP literal
    if (parseIpv4(hostname) || isIpv6(hostname)) {
      if (!isPublicIp(hostname)) {
        return { safe: false, error: "Access to non-public IP ranges is strictly prohibited." };
      }
      return { safe: true, urlObj: parsed };
    }

    // Resolve both IPv4 and IPv6
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: "Host could not be resolved." };
    }

    for (const record of addresses) {
      if (!isPublicIp(record.address)) {
        return { safe: false, error: "Host resolves to an internal or private network IP." };
      }
    }

    return { safe: true, urlObj: parsed };
  } catch (err) {
    return { safe: false, error: `DNS resolution failed: ${(err as Error).message}` };
  }
}

/**
 * Strips script tags, style blocks, and HTML tags to yield clean plain text.
 */
export function sanitizeHtmlText(html: string): { title: string; text: string } {
  // Extract <title> if present
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Remove scripts, styles, svg, comments
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Strip remaining tags
  clean = clean.replace(/<[^>]+>/g, " ");

  // Normalize whitespace
  clean = clean.replace(/\s+/g, " ").trim();

  // Cap extracted text length to avoid token explosion
  if (clean.length > 25000) {
    clean = clean.slice(0, 25000) + "... [truncated]";
  }

  return { title, text: clean };
}

/**
 * DNS lookup used at connection time. Validating DNS before fetch() is not enough: a hostile
 * resolver can answer differently the second time (DNS rebinding). The connection itself is made
 * only to an address that passed the public-IP check here.
 */
export function guardedLookup(
  hostname: string,
  options: dnsCb.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dnsCb.LookupAddress[], family?: number) => void,
  resolve: typeof dnsCb.lookup = dnsCb.lookup
): void {
  resolve(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = (addresses as dnsCb.LookupAddress[]).filter((a) => isPublicIp(a.address));
    if (list.length === 0 || list.length !== (addresses as dnsCb.LookupAddress[]).length) {
      return callback(Object.assign(new Error("blocked destination"), { code: "EBLOCKED" }) as NodeJS.ErrnoException, "", 0);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

let agent: Agent | null = null;
function getAgent(): Agent {
  agent ??= new Agent({ connect: { lookup: guardedLookup as never }, maxRedirections: 0 } as never);
  return agent;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  /** Test seam; production always uses the pinned undici agent. */
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  respectRobots?: boolean;
}

/** Minimal robots.txt check: honours Disallow for "*" and our own agent token. Missing robots.txt allows. */
export async function robotsAllows(url: URL, fetchImpl: NonNullable<FetchOptions["fetchImpl"]>, timeoutMs: number): Promise<boolean> {
  try {
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
    const check = await validateSafeDestination(robotsUrl);
    if (!check.safe) return true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetchImpl(robotsUrl, { signal: ctrl.signal, redirect: "manual", headers: { "User-Agent": USER_AGENT } } as RequestInit);
    clearTimeout(timer);
    if (!res.ok) return true;
    const body = (await res.text()).slice(0, 64 * 1024);
    let applies = false;
    const wildcardDisallow: string[] = [];
    const ownDisallow: string[] = [];
    let ownSeen = false;
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*/, "").trim();
      const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
      if (!m) continue;
      const field = m[1].toLowerCase();
      const value = m[2].trim();
      if (field === "user-agent") {
        const ua = value.toLowerCase();
        applies = ua === "*" || ua === "internyrabot";
        if (ua === "internyrabot") ownSeen = true;
      } else if (field === "disallow" && applies && value) {
        (ownSeen ? ownDisallow : wildcardDisallow).push(value);
      }
    }
    const rules = ownDisallow.length ? ownDisallow : wildcardDisallow;
    const path = url.pathname + url.search;
    return !rules.some((r) => (r === "/" ? true : path.startsWith(r.replace(/\*$/, ""))));
  } catch {
    return true;
  }
}

/**
 * Safely fetches a URL: re-validates every redirect hop, pins the connection to a validated public
 * address, caps redirects/size/time, accepts only text content, and never executes anything.
 */
export async function safeFetchUrl(initialUrl: string, options: FetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_BODY_BYTES;
  const doFetch =
    options.fetchImpl ??
    ((url: string, init: RequestInit) => fetch(url, { ...init, dispatcher: getAgent() } as RequestInit));

  let currentUrl = initialUrl;
  let hops = 0;

  while (hops <= MAX_REDIRECTS) {
    const check = await validateSafeDestination(currentUrl);
    if (!check.safe || !check.urlObj) return { ok: false, code: "blocked_destination", error: check.error || "Blocked unsafe destination." };

    if (options.respectRobots !== false && hops === 0 && !(await robotsAllows(check.urlObj, doFetch, timeoutMs))) {
      return { ok: false, code: "robots_disallowed", error: "The site's robots.txt does not allow automated access." };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(currentUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9" },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        clearTimeout(timer);
        const location = response.headers.get("location");
        if (!location) return { ok: false, code: "http_error", statusCode: response.status, error: "Redirect without a location." };
        hops++;
        if (hops > MAX_REDIRECTS) return { ok: false, code: "too_many_redirects", error: "Too many redirects." };
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        clearTimeout(timer);
        return { ok: false, code: "http_error", statusCode: response.status, error: `HTTP ${response.status}` };
      }

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.some((t) => contentType.includes(t))) {
        clearTimeout(timer);
        await response.body?.cancel().catch(() => {});
        return { ok: false, code: "unsupported_type", statusCode: response.status, contentType, error: "Unsupported content type." };
      }

      const declared = Number(response.headers.get("content-length") ?? "0");
      if (declared > maxBytes) {
        clearTimeout(timer);
        await response.body?.cancel().catch(() => {});
        return { ok: false, code: "too_large", error: "Response too large." };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        clearTimeout(timer);
        return { ok: false, code: "network", error: "No response body." };
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.length;
          if (total > maxBytes) {
            clearTimeout(timer);
            await reader.cancel().catch(() => {});
            return { ok: false, code: "too_large", error: "Response too large." };
          }
          chunks.push(value);
        }
      }
      clearTimeout(timer);
      const { title, text } = sanitizeHtmlText(Buffer.concat(chunks).toString("utf-8"));
      return { ok: true, finalUrl: currentUrl, statusCode: response.status, contentType, title, text };
    } catch (err: unknown) {
      clearTimeout(timer);
      if ((err as { name?: string })?.name === "AbortError") return { ok: false, code: "timeout", error: "Timed out." };
      const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
      if (code === "EBLOCKED") return { ok: false, code: "blocked_destination", error: "Blocked unsafe destination." };
      return { ok: false, code: "network", error: "Network request failed." };
    }
  }
  return { ok: false, code: "too_many_redirects", error: "Redirect chain limit reached." };
}
