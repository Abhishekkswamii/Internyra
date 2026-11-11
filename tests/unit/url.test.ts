import { describe, expect, it } from "vitest";
import { validateUrl } from "@/lib/engine/url";
import { runVerification } from "@/lib/engine";

function ok(input: string) {
  const r = validateUrl(input);
  if (!r.ok) throw new Error(`expected valid: ${input} (${r.code})`);
  return r.url;
}

function rejected(input: string) {
  const r = validateUrl(input);
  if (r.ok) throw new Error(`expected rejection: ${input}`);
  return r;
}

describe("validateUrl", () => {
  it("accepts and normalizes a valid HTTPS URL", () => {
    const u = ok("  HTTPS://Careers.Example.COM:443/jobs/123?ref=x#apply ");
    expect(u.scheme).toBe("https");
    expect(u.hostname).toBe("careers.example.com");
    expect(u.port).toBeNull();
    expect(u.normalized).toBe("https://careers.example.com/jobs/123?ref=x");
    expect(u.ipLiteral).toBeNull();
  });

  it("accepts HTTP, and the report gives only a qualified low-severity warning", async () => {
    const u = ok("http://careers.example.com/intern");
    expect(u.scheme).toBe("http");
    const c = await runVerification({ kind: "link", url: "http://careers.example.com/intern" });
    const f = c.report!.findings.find((x) => x.ruleId === "URL-001")!;
    expect(f.severity).toBe("LOW");
    expect(f.explanation).toMatch(/not evidence of fraud/i);
    expect(c.report!.assessment.assessment).not.toBe("HIGH_RISK");
  });

  it("rejects malformed URLs with actionable feedback", () => {
    expect(rejected("https://").code).toBe("MALFORMED");
    expect(rejected("https://exa mple.com").code).toBe("CONTAINS_WHITESPACE");
    expect(rejected("careers.example.com/jobs").code).toBe("MISSING_SCHEME");
    expect(rejected("careers.example.com/jobs").message).toMatch(/https:\/\//);
    expect(rejected("https://intranet/jobs").code).toBe("INVALID_HOST");
  });

  it("rejects embedded credentials, including disguised ones", () => {
    expect(rejected("https://user:pass@example.com/").code).toBe("EMBEDDED_CREDENTIALS");
    expect(rejected("https://careers.google.com@evil.example/").code).toBe("EMBEDDED_CREDENTIALS");
    expect(rejected("https://@example.com/").code).toBe("EMBEDDED_CREDENTIALS");
  });

  it("rejects unsafe or unsupported protocols", () => {
    for (const input of ["javascript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd", "ftp://example.com/x", "mailto:hr@example.com", "vbscript:msgbox"]) {
      expect(rejected(input).code).toBe("UNSUPPORTED_PROTOCOL");
    }
  });

  it("identifies IPv4 and IPv6 literal hosts and classifies their range", () => {
    expect(ok("http://203.0.113.7/apply").ipLiteral).toEqual({ version: 4, class: "documentation" });
    expect(ok("http://8.8.8.8/").ipLiteral).toEqual({ version: 4, class: "public" });
    expect(ok("http://127.0.0.1:3000/").ipLiteral?.class).toBe("loopback");
    expect(ok("http://169.254.169.254/latest/meta-data").ipLiteral?.class).toBe("metadata");
    // Alternate IPv4 notations are normalized by the URL parser before classification
    expect(ok("http://0x7f.1/").hostname).toBe("127.0.0.1");
    expect(ok("http://[::1]/").ipLiteral).toEqual({ version: 6, class: "loopback" });
  });

  it("handles punycode / internationalized hostnames", () => {
    const idn = ok("https://bücher.example/jobs");
    expect(idn.hostname).toBe("xn--bcher-kva.example");
    expect(idn.displayHostname).toBe("bücher.example");
    expect(idn.isInternationalized).toBe(true);
    expect(idn.hasMixedScripts).toBe(false);

    // Latin "g" + Cyrillic "о" (U+043E) — a homograph
    const mixed = ok("https://gооgle.example/careers");
    expect(mixed.hostname.startsWith("xn--")).toBe(true);
    expect(mixed.hasMixedScripts).toBe(true);
  });

  it("identifies non-standard ports", () => {
    expect(ok("https://careers.example.com:8443/").port).toBe(8443);
    expect(ok("http://careers.example.com:80/").port).toBeNull();
  });

  it("accepts a safe but long path/query string without flagging it", async () => {
    const long = `https://jobs.example.com/apply/${"a".repeat(600)}?utm_source=${"b".repeat(600)}`;
    const u = ok(long);
    expect(u.pathAndQueryLength).toBeGreaterThan(1200);
    const c = await runVerification({ kind: "link", url: long });
    expect(c.report!.findings.filter((f) => f.kind === "RISK_SIGNAL")).toHaveLength(0);
  });

  it("rejects empty, whitespace-only and over-long input", () => {
    expect(rejected("").code).toBe("EMPTY");
    expect(rejected("   ").code).toBe("EMPTY");
    expect(rejected(`https://example.com/${"x".repeat(3000)}`).code).toBe("TOO_LONG");
  });
});
