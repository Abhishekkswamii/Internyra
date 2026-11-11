import { classifyIp, isIpv4, isIpv6, type IpClass } from "@/lib/security/ip";
import { hasMixedConfusableScripts, hostnameToUnicode } from "./punycode";

export const MAX_URL_LENGTH = 2048;

export type UrlIssueCode =
  | "EMPTY"
  | "TOO_LONG"
  | "CONTAINS_WHITESPACE"
  | "MISSING_SCHEME"
  | "UNSUPPORTED_PROTOCOL"
  | "MALFORMED"
  | "EMBEDDED_CREDENTIALS"
  | "INVALID_HOST";

export interface NormalizedUrl {
  original: string;
  /** scheme://host[:port]/path?query — fragment dropped, host lowercased/punycoded, default port removed. */
  normalized: string;
  scheme: "http" | "https";
  /** ASCII hostname (punycode form for IDNs). IPv6 literals keep their brackets. */
  hostname: string;
  /** Unicode form of the hostname, for display. */
  displayHostname: string;
  /** Explicit non-default port, or null. */
  port: number | null;
  ipLiteral: { version: 4 | 6; class: IpClass } | null;
  isInternationalized: boolean;
  hasMixedScripts: boolean;
  pathAndQueryLength: number;
}

export type UrlValidationResult =
  | { ok: true; url: NormalizedUrl }
  | { ok: false; code: UrlIssueCode; message: string };

function fail(code: UrlIssueCode, message: string): UrlValidationResult {
  return { ok: false, code, message };
}

const SCHEME_WITH_SLASHES = /^([a-z][a-z0-9+.-]*):\/\//i;
// "javascript:", "mailto:", "data:" … but not "host:8080"
const OPAQUE_SCHEME = /^([a-z][a-z0-9+.-]*):(?!\d)/i;

/**
 * Validates and normalizes a user-supplied link. Only http/https are accepted.
 * Pure function: never performs network access.
 */
export function validateUrl(rawInput: string): UrlValidationResult {
  const input = (rawInput ?? "").trim();

  if (!input) {
    return fail("EMPTY", "Paste the internship link, starting with https://");
  }
  if (input.length > MAX_URL_LENGTH) {
    return fail("TOO_LONG", `That link is longer than ${MAX_URL_LENGTH} characters. Paste the page's address without extra tracking text.`);
  }
  if (/\s/.test(input)) {
    return fail("CONTAINS_WHITESPACE", "Links can't contain spaces. Check that you pasted only the address, not surrounding text.");
  }

  const schemeMatch = SCHEME_WITH_SLASHES.exec(input) ?? OPAQUE_SCHEME.exec(input);
  if (!schemeMatch) {
    return fail("MISSING_SCHEME", "Include the full address, starting with https:// (for example https://careers.example.com/jobs/123).");
  }
  const scheme = schemeMatch[1].toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    return fail("UNSUPPORTED_PROTOCOL", `Only http:// and https:// links can be checked. "${scheme}:" links aren't supported.`);
  }

  // Reject credentials before parsing so "https://user@host" can't be normalised away.
  const afterScheme = input.slice(schemeMatch[0].length);
  const authority = afterScheme.split(/[/?#\\]/, 1)[0];
  if (authority.includes("@")) {
    return fail(
      "EMBEDDED_CREDENTIALS",
      "This link contains a username or password before the “@”. That can disguise where a link really goes, so it isn't accepted. Remove everything up to and including the “@”."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return fail("MALFORMED", "That doesn't look like a valid web address. Check for typos or missing parts.");
  }

  if (parsed.username || parsed.password) {
    return fail("EMBEDDED_CREDENTIALS", "This link contains embedded login details, which isn't accepted.");
  }

  let hostname = parsed.hostname.toLowerCase();
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  if (!hostname) {
    return fail("INVALID_HOST", "The link is missing a website name.");
  }

  let ipLiteral: NormalizedUrl["ipLiteral"] = null;
  if (isIpv4(hostname)) {
    ipLiteral = { version: 4, class: classifyIp(hostname)! };
  } else if (isIpv6(hostname)) {
    ipLiteral = { version: 6, class: classifyIp(hostname)! };
  } else {
    const labels = hostname.split(".");
    if (labels.length < 2 || labels.some((l) => !l || l.length > 63) || !/^[a-z0-9-]+$/.test(labels.join(""))) {
      return fail("INVALID_HOST", `"${hostname}" isn't a public website address. Paste the full link to the job posting.`);
    }
    if (/^\d+$/.test(labels[labels.length - 1])) {
      return fail("INVALID_HOST", "That address looks like an incomplete IP address.");
    }
  }

  const displayHostname = ipLiteral ? hostname : hostnameToUnicode(hostname);
  const isInternationalized = !ipLiteral && hostname.split(".").some((l) => l.startsWith("xn--"));
  const hasMixedScripts = isInternationalized && displayHostname.split(".").some(hasMixedConfusableScripts);

  const port = parsed.port ? Number(parsed.port) : null;
  const normalized = `${scheme}://${hostname}${port !== null ? `:${port}` : ""}${parsed.pathname}${parsed.search}`;

  return {
    ok: true,
    url: {
      original: input,
      normalized,
      scheme,
      hostname,
      displayHostname,
      port,
      ipLiteral,
      isInternationalized,
      hasMixedScripts,
      pathAndQueryLength: parsed.pathname.length + parsed.search.length,
    },
  };
}
