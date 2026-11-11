import { describe, it, expect } from "vitest";
import { validateSafeDestination, sanitizeHtmlText } from "@/lib/security/fetch-guard";

describe("Fetch Guard & SSRF Protection", () => {
  it("rejects non-http/https protocols", async () => {
    const ftp = await validateSafeDestination("ftp://example.com/file");
    expect(ftp.safe).toBe(false);
    expect(ftp.error).toContain("Only HTTP and HTTPS");

    const file = await validateSafeDestination("file:///etc/passwd");
    expect(file.safe).toBe(false);
  });

  it("rejects embedded credentials in URLs", async () => {
    const creds = await validateSafeDestination("https://admin:secret@example.com/jobs");
    expect(creds.safe).toBe(false);
    expect(creds.error).toContain("user credentials");
  });

  it("blocks localhost, loopback and cloud metadata hostnames directly", async () => {
    const localhost = await validateSafeDestination("http://localhost:3000/api");
    expect(localhost.safe).toBe(false);

    const internal = await validateSafeDestination("http://metadata.google.internal/computeMetadata");
    expect(internal.safe).toBe(false);

    const sublocal = await validateSafeDestination("http://service.local/data");
    expect(sublocal.safe).toBe(false);
  });

  it("blocks private, loopback, and metadata IP literals", async () => {
    const loopback = await validateSafeDestination("http://127.0.0.1:8080");
    expect(loopback.safe).toBe(false);

    const privateV4 = await validateSafeDestination("http://192.168.1.100");
    expect(privateV4.safe).toBe(false);

    const tenNet = await validateSafeDestination("http://10.0.0.5");
    expect(tenNet.safe).toBe(false);

    const metadataIp = await validateSafeDestination("http://169.254.169.254/latest/meta-data/");
    expect(metadataIp.safe).toBe(false);

    const loopbackV6 = await validateSafeDestination("http://[::1]:3000");
    expect(loopbackV6.safe).toBe(false);
  });

  it("sanitizes HTML and extracts title safely", () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Software Engineering Internship - Acme Corp</title>
          <style>body { color: red; }</style>
          <script>alert("malicious script");</script>
        </head>
        <body>
          <h1>Join Our Engineering Team</h1>
          <p>We are looking for passionate students. No upfront fees are ever required.</p>
          <script src="tracker.js"></script>
        </body>
      </html>
    `;

    const result = sanitizeHtmlText(rawHtml);
    expect(result.title).toBe("Software Engineering Internship - Acme Corp");
    expect(result.text).toContain("Join Our Engineering Team");
    expect(result.text).toContain("No upfront fees are ever required");
    expect(result.text).not.toContain("alert");
    expect(result.text).not.toContain("color: red");
  });
});


import { guardedLookup, robotsAllows, safeFetchUrl } from "@/lib/security/fetch-guard";
import * as dns from "dns";
import { vi, afterEach } from "vitest";

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...headers } });

function router(map: Record<string, () => Response>) {
  const seen: string[] = [];
  const fn = async (url: string) => {
    seen.push(url);
    const h = map[url];
    return h ? h() : new Response("nf", { status: 404 });
  };
  return { fn, seen };
}

// Public IP literals avoid DNS in these tests.
const A = "http://93.184.216.34/page";

describe("safeFetchUrl", () => {
  it("fetches and sanitises a normal page", async () => {
    const r = router({ [A]: () => html("<title>T</title><script>x()</script><p>Hello intern</p>") });
    const res = await safeFetchUrl(A, { fetchImpl: r.fn, respectRobots: false });
    expect(res).toMatchObject({ ok: true, title: "T" });
    expect(res.text).toContain("Hello intern");
    expect(res.text).not.toContain("x()");
  });

  it("re-validates every redirect hop and blocks redirects into private networks", async () => {
    for (const target of ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://10.0.0.5/", "http://localhost/"]) {
      const r = router({ [A]: () => new Response(null, { status: 302, headers: { location: target } }) });
      const res = await safeFetchUrl(A, { fetchImpl: r.fn, respectRobots: false });
      expect(res).toMatchObject({ ok: false, code: "blocked_destination" });
      expect(r.seen).toEqual([A]); // the private target was never requested
    }
  });

  it("blocks non-http redirect targets and credentials in redirects", async () => {
    for (const target of ["file:///etc/passwd", "ftp://example.com/", "http://user:pw@93.184.216.34/"]) {
      const r = router({ [A]: () => new Response(null, { status: 301, headers: { location: target } }) });
      expect((await safeFetchUrl(A, { fetchImpl: r.fn, respectRobots: false })).code).toBe("blocked_destination");
    }
  });

  it("caps the redirect chain at three hops", async () => {
    const map: Record<string, () => Response> = {};
    for (let i = 0; i < 6; i++) map[`http://93.184.216.34/${i}`] = () => new Response(null, { status: 302, headers: { location: `http://93.184.216.34/${i + 1}` } });
    const r = router(map);
    const res = await safeFetchUrl("http://93.184.216.34/0", { fetchImpl: r.fn, respectRobots: false });
    expect(res.code).toBe("too_many_redirects");
    expect(r.seen.length).toBe(4);
  });

  it("rejects non-standard ports", async () => {
    const r = router({});
    expect((await safeFetchUrl("http://93.184.216.34:6379/", { fetchImpl: r.fn, respectRobots: false })).code).toBe("blocked_destination");
    expect(r.seen).toHaveLength(0);
  });

  it("rejects unsupported content types and oversized responses without exposing raw errors", async () => {
    const bin = router({ [A]: () => new Response("x", { status: 200, headers: { "content-type": "application/octet-stream" } }) });
    expect((await safeFetchUrl(A, { fetchImpl: bin.fn, respectRobots: false })).code).toBe("unsupported_type");
    const pdf = router({ [A]: () => new Response("x", { status: 200, headers: { "content-type": "application/pdf" } }) });
    expect((await safeFetchUrl(A, { fetchImpl: pdf.fn, respectRobots: false })).code).toBe("unsupported_type");
    const declared = router({ [A]: () => html("x", { "content-length": "99999999" }) });
    expect((await safeFetchUrl(A, { fetchImpl: declared.fn, respectRobots: false, maxBytes: 1000 })).code).toBe("too_large");
    const streamed = router({ [A]: () => html("y".repeat(5000)) });
    expect((await safeFetchUrl(A, { fetchImpl: streamed.fn, respectRobots: false, maxBytes: 1000 })).code).toBe("too_large");
    const boom = async () => { throw new Error("connect ECONNREFUSED 10.1.2.3:443 internal-host"); };
    const res = await safeFetchUrl(A, { fetchImpl: boom as never, respectRobots: false });
    expect(res).toMatchObject({ ok: false, code: "network" });
    expect(JSON.stringify(res)).not.toMatch(/ECONNREFUSED|10\.1\.2\.3|internal-host/);
  });

  it("times out slow servers", async () => {
    const slow = (async (_u: string, init: RequestInit) => new Promise<Response>((_res, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))))) as never;
    expect((await safeFetchUrl(A, { fetchImpl: slow, respectRobots: false, timeoutMs: 20 })).code).toBe("timeout");
  });

  it("reports HTTP errors without the body", async () => {
    const r = router({ [A]: () => new Response("secret internal stack trace", { status: 500 }) });
    const res = await safeFetchUrl(A, { fetchImpl: r.fn, respectRobots: false });
    expect(res).toMatchObject({ ok: false, code: "http_error", statusCode: 500 });
    expect(JSON.stringify(res)).not.toContain("stack trace");
  });
});

describe("robots.txt", () => {
  const url = new URL("http://93.184.216.34/jobs/1");
  const withRobots = (txt: string, status = 200) => (async () => new Response(txt, { status })) as never;

  it("honours Disallow for all agents and for our own agent", async () => {
    expect(await robotsAllows(url, withRobots("User-agent: *\nDisallow: /jobs"), 500)).toBe(false);
    expect(await robotsAllows(url, withRobots("User-agent: InternyraBot\nDisallow: /"), 500)).toBe(false);
    expect(await robotsAllows(url, withRobots("User-agent: *\nDisallow: /private"), 500)).toBe(true);
    expect(await robotsAllows(url, withRobots("User-agent: SomeoneElse\nDisallow: /"), 500)).toBe(true);
  });
  it("allows when robots.txt is missing or unreadable", async () => {
    expect(await robotsAllows(url, withRobots("", 404), 500)).toBe(true);
    expect(await robotsAllows(url, (async () => { throw new Error("x"); }) as never, 500)).toBe(true);
  });
  it("safeFetchUrl refuses a page that robots.txt disallows and never requests it", async () => {
    const seen: string[] = [];
    const fn = (async (u: string) => { seen.push(u); return u.endsWith("/robots.txt") ? new Response("User-agent: *\nDisallow: /") : html("secret"); }) as never;
    const res = await safeFetchUrl("http://93.184.216.34/jobs/1", { fetchImpl: fn });
    expect(res.code).toBe("robots_disallowed");
    expect(seen).toEqual(["http://93.184.216.34/robots.txt"]);
  });
});

describe("DNS rebinding defence (connection-time lookup)", () => {
  afterEach(() => vi.restoreAllMocks());
  const stub = (addresses: { address: string; family: number }[]) =>
    ((_h: string, _o: unknown, cb: (e: Error | null, a: unknown) => void) => cb(null, addresses)) as unknown as typeof dns.lookup;

  it("refuses to connect when any resolved address is private, even if another is public", () => {
    const cb = vi.fn();
    guardedLookup("rebind.example", { all: true }, cb, stub([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.7", family: 4 }]));
    expect(cb.mock.calls[0][0]).toMatchObject({ code: "EBLOCKED" });
  });
  it("refuses loopback and metadata answers", () => {
    for (const address of ["127.0.0.1", "169.254.169.254", "::1", "fd00:ec2::254"]) {
      const cb = vi.fn();
      guardedLookup("rebind.example", { all: true }, cb, stub([{ address, family: address.includes(":") ? 6 : 4 }]));
      expect(cb.mock.calls[0][0]).toMatchObject({ code: "EBLOCKED" });
    }
  });
  it("returns only validated public addresses", () => {
    const cb = vi.fn();
    guardedLookup("ok.example", { all: true }, cb, stub([{ address: "93.184.216.34", family: 4 }]));
    expect(cb).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
  });
});
