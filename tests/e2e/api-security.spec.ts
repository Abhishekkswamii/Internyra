import { expect, test } from "@playwright/test";
import { authed, createInspectionApi, createUserWithToken, tokenFor, uniqueEmail, MESSAGE } from "./helpers";

test.describe("API security (real server, emulated Auth/Firestore)", () => {
  test.skip(({ isMobile }) => isMobile, "API behaviour is viewport independent");

  test("every protected endpoint rejects missing or forged tokens", async ({ request }) => {
    for (const headers of [{} as Record<string, string>, { Authorization: "Bearer not-a-real-token" }, { Authorization: "Basic abc" }]) {
      expect((await request.get("/api/inspections", { headers })).status()).toBe(401);
      expect((await request.post("/api/inspections", { headers, data: { kind: "message", text: MESSAGE } })).status()).toBe(401);
      expect((await request.get("/api/inspections/insp_00000000-0000", { headers })).status()).toBe(401);
      expect((await request.delete("/api/user/account", { headers })).status()).toBe(401);
      expect((await request.get("/api/admin/data", { headers })).status()).toBe(403);
    }
  });

  test("student B cannot read, delete or run student A's inspection", async ({ request }) => {
    const a = await createUserWithToken(uniqueEmail("a"));
    const b = await createUserWithToken(uniqueEmail("b"));
    const { json } = await createInspectionApi(request, a.token);
    const id = json.inspection!.id;
    expect((await request.get(`/api/inspections/${id}`, { headers: authed(a.token) })).status()).toBe(200);
    expect((await request.get(`/api/inspections/${id}`, { headers: authed(b.token) })).status()).toBe(404);
    expect((await request.delete(`/api/inspections/${id}`, { headers: authed(b.token) })).status()).toBe(404);
    expect((await request.post(`/api/inspections/${id}/run`, { headers: authed(b.token), data: {} })).status()).toBeGreaterThanOrEqual(404);
    const list = (await (await request.get("/api/inspections", { headers: authed(b.token) })).json()) as { inspections: unknown[] };
    expect(list.inspections).toHaveLength(0);
    expect((await request.get(`/api/inspections/${id}`, { headers: authed(a.token) })).status()).toBe(200);
  });

  test("client-supplied owner / status / admin fields are ignored", async ({ request }) => {
    const a = await createUserWithToken(uniqueEmail("mass"));
    const { json } = await createInspectionApi(request, a.token, { kind: "message", text: MESSAGE, ownerUid: "someone-else", status: "completed", isAdmin: true });
    expect(json.inspection).toMatchObject({ ownerUid: a.uid, status: "queued" });
  });

  test("AI stays paused: running a queued inspection returns 503 and the record remains queued", async ({ request }) => {
    const a = await createUserWithToken(uniqueEmail("paused"));
    const id = (await createInspectionApi(request, a.token)).json.inspection!.id;
    const run = await request.post(`/api/inspections/${id}/run`, { headers: authed(a.token), data: {} });
    expect(run.status()).toBe(503);
    expect((await run.json()).error.code).toBe("AI_DISABLED");
    const rec = (await (await request.get(`/api/inspections/${id}`, { headers: authed(a.token) })).json()) as { inspection: { status: string; research?: unknown } };
    expect(rec.inspection.status).toBe("queued");
    expect(rec.inspection.research).toBeUndefined();
  });

  test("input validation, size limits and cross-origin protection", async ({ request }) => {
    const a = await createUserWithToken(uniqueEmail("val"));
    const post = (data: unknown, headers: Record<string, string> = {}) => request.post("/api/inspections", { headers: { ...authed(a.token), ...headers }, data });
    expect((await post({ kind: "link", url: "javascript:alert(1)" })).status()).toBe(422);
    expect((await post({ kind: "link", url: "http://127.0.0.1/admin" })).status()).toBeLessThan(500); // accepted as input; fetch layer blocks it (unit-tested)
    expect((await post({ kind: "message", text: "x".repeat(200_000) })).status()).toBe(413);
    expect((await post({ kind: "message", text: MESSAGE }, { Origin: "https://evil.example" })).status()).toBe(403);
    const res = await post({ kind: "message", text: "short" });
    expect(res.status()).toBe(422);
    expect(res.headers()["x-request-id"]).toMatch(/^req_/);
    expect(JSON.stringify(await res.json())).not.toMatch(/stack|at \/|node_modules/i);
  });

  test("anonymous identities cannot run inspections or claim", async ({ request }) => {
    const anonRes = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
    const anon = (await anonRes.json()) as { idToken: string };
    const { json } = await createInspectionApi(request, anon.idToken);
    expect(json.inspection?.status).toBe("pending_auth");
    expect((await request.post(`/api/inspections/${json.inspection!.id}/run`, { headers: authed(anon.idToken), data: {} })).status()).toBe(403);
    expect((await request.post("/api/inspections/claim", { headers: authed(anon.idToken), data: { inspectionId: json.inspection!.id } })).status()).toBe(403);
  });

  test("a different account cannot claim someone else's pending request, with or without a forged anonymous token", async ({ request }) => {
    const anonRes = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
    const anon = (await anonRes.json()) as { idToken: string };
    const id = (await createInspectionApi(request, anon.idToken)).json.inspection!.id;
    const attacker = await createUserWithToken(uniqueEmail("attacker"));
    expect((await request.post("/api/inspections/claim", { headers: authed(attacker.token), data: { inspectionId: id } })).status()).toBe(404);
    const otherAnonRes = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
    const otherAnon = (await otherAnonRes.json()) as { idToken: string };
    expect((await request.post("/api/inspections/claim", { headers: { ...authed(attacker.token), "X-Anonymous-Token": otherAnon.idToken }, data: { inspectionId: id } })).status()).toBe(404);
    expect((await request.post("/api/inspections/claim", { headers: { ...authed(attacker.token), "X-Anonymous-Token": "garbage" }, data: { inspectionId: id } })).status()).toBe(403);
    // The legitimate owner (the anonymous identity upgraded) can still claim.
    const email = uniqueEmail("owner");
    const upgraded = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: anon.idToken, email, password: "pass-1234", returnSecureToken: true }) });
    const up = (await upgraded.json()) as { idToken: string };
    const ok = await request.post("/api/inspections/claim", { headers: authed(up.idToken), data: { inspectionId: id } });
    expect(ok.status()).toBe(200);
  });

  test("admin endpoints: ordinary users are refused, only the provisioned admin gets real (empty-safe) data", async ({ request }) => {
    const student = await createUserWithToken(uniqueEmail("plain"));
    for (const view of ["overview", "users", "inspections", "usage"]) {
      expect((await request.get(`/api/admin/data?view=${view}`, { headers: authed(student.token) })).status()).toBe(403);
    }
    const adminToken = await tokenFor("admin@e2e.test", "e2e-admin-pass-1");
    const overview = await request.get("/api/admin/data?view=overview", { headers: authed(adminToken) });
    expect(overview.status()).toBe(200);
    const body = (await overview.json()) as { counts: { users: number }; usage: { cache: Record<string, number>; fallbacks: number } };
    expect(body.counts.users).toBeGreaterThanOrEqual(0);
    expect(body.usage.fallbacks).toBe(0); // no provider ever ran: real zero, not invented numbers
    expect(body.usage.cache.hit).toBe(0);
    const users = await request.get("/api/admin/data?view=users&limit=2", { headers: authed(adminToken) });
    expect(users.status()).toBe(200);
    expect(((await users.json()) as { items: unknown[] }).items.length).toBeLessThanOrEqual(2); // paginated
    expect((await request.get("/api/admin/data?view=nope", { headers: authed(adminToken) })).status()).toBe(422);
  });

  test("responses carry security headers and are not cacheable", async ({ request }) => {
    const res = await request.get("/api/status");
    expect(res.headers()["cache-control"]).toBe("no-store");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(((await res.json()) as { aiEnabled: boolean }).aiEnabled).toBe(false);
    const home = await request.get("/");
    expect(home.headers()["strict-transport-security"]).toContain("max-age");
    expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(home.headers()["x-powered-by"]).toBeUndefined();
  });
});
