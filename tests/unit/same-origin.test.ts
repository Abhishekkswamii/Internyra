import { describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/server/http";

const req = (url: string, headers: Record<string, string>) => new Request(url, { method: "POST", headers });

describe("same-origin check behind a proxy (App Hosting / Cloud Run)", () => {
  it("accepts a browser write whose Origin is the public host forwarded by the front end", () => {
    // The server sees an internal host in the URL; the public host arrives in X-Forwarded-Host.
    expect(isSameOrigin(req("http://localhost:8080/api/user/account", { origin: "https://internyra--internyra-385d6.asia-southeast1.hosted.app", "x-forwarded-host": "internyra--internyra-385d6.asia-southeast1.hosted.app" }))).toBe(true);
  });
  it("accepts the Host header and a plain same-host request", () => {
    expect(isSameOrigin(req("https://app.example/api/x", { origin: "https://app.example" }))).toBe(true);
    expect(isSameOrigin(req("http://internal:8080/api/x", { origin: "https://app.example", host: "app.example" }))).toBe(true);
  });
  it("rejects a foreign Origin even when the forwarded host is ours", () => {
    expect(isSameOrigin(req("http://localhost:8080/api/x", { origin: "https://evil.example", "x-forwarded-host": "app.example" }))).toBe(false);
    expect(isSameOrigin(req("https://app.example/api/x", { origin: "https://app.example.evil.example" }))).toBe(false);
    expect(isSameOrigin(req("https://app.example/api/x", { origin: "null" }))).toBe(false);
    expect(isSameOrigin(req("https://app.example/api/x", { origin: "not a url" }))).toBe(false);
  });
  it("takes only the first value of a multi-valued forwarded host", () => {
    expect(isSameOrigin(req("http://localhost:8080/x", { origin: "https://evil.example", "x-forwarded-host": "app.example, evil.example" }))).toBe(false);
    expect(isSameOrigin(req("http://localhost:8080/x", { origin: "https://app.example", "x-forwarded-host": "app.example, proxy.internal" }))).toBe(true);
  });
  it("allows non-browser clients that send no Origin", () => {
    expect(isSameOrigin(req("https://app.example/api/x", {}))).toBe(true);
  });
});
