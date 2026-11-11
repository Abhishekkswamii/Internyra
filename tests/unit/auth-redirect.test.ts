import { describe, expect, it } from "vitest";
import { loginUrlFor, safeNextPath } from "@/lib/auth/redirect";
import { passwordChecks } from "@/components/auth/AuthExperience";

describe("safeNextPath (post-login redirect)", () => {
  it.each(["/app", "/app/", "/app/verify", "/app/settings", "/app/reports/insp_12345678-abcd?start=1", "/app?search=acme"])("allows the internal destination %s", (p) => {
    expect(safeNextPath(p)).toBe(p);
  });

  it.each([
    "https://evil.example",
    "http://evil.example/app",
    "//evil.example",
    "//evil.example/app",
    "/\\evil.example",
    "\\\\evil.example",
    "/%2F%2Fevil.example",
    "%2F%2Fevil.example",
    "/%252F%252Fevil.example",
    "/app/\u0000x",
    "/app\r\nSet-Cookie: x=1",
    "javascript:alert(1)",
    "data:text/html,x",
    "///evil.example",
    "/https://evil.example",
    "/login",
    "/auth?next=/app",
    "/",
    "app",
    "",
    "/applications",
    "/api/user/account",
  ])("rejects %j and falls back to /app", (p) => {
    expect(safeNextPath(p)).toBe("/app");
  });

  it("falls back for missing values and malformed encoding", () => {
    expect(safeNextPath(null)).toBe("/app");
    expect(safeNextPath(undefined)).toBe("/app");
    expect(safeNextPath("%E0%A4%A")).toBe("/app");
  });

  it("builds a login URL that carries only a validated destination", () => {
    expect(loginUrlFor("/app/settings")).toBe("/login?next=%2Fapp%2Fsettings");
    expect(loginUrlFor("https://evil.example")).toBe("/login?next=%2Fapp");
  });
});

describe("password guidance", () => {
  it("reports each requirement independently", () => {
    expect(passwordChecks("").every((c) => !c.ok)).toBe(true);
    expect(passwordChecks("abcdefgh").map((c) => c.ok)).toEqual([true, false, false]);
    expect(passwordChecks("Abcdefg1").every((c) => c.ok)).toBe(true);
  });
});
