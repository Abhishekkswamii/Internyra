import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setRedisForTests } from "@/lib/cache/redis";
import { setStoreForTests } from "@/lib/store";
import { bearer, installFakeAuth, jsonReq } from "../helpers/auth";
import { MemoryStore } from "../helpers/memory-store";
import { FakeRedis } from "../helpers/fake-redis";
import { MESSAGE, seedQueued } from "../helpers/research";

type Handler = (req: Request, ctx?: { params: Promise<{ id: string }> }) => Promise<Response>;
let inspections: { POST: Handler; GET: Handler };
let byId: { GET: Handler; DELETE: Handler };
let run: { POST: Handler };
let claim: { POST: Handler };
let account: { DELETE: Handler };
let admin: { GET: Handler };
let authAdmin: ReturnType<typeof installFakeAuth>;
let store: MemoryStore;

const p = (id: string) => ({ params: Promise.resolve({ id }) });
const msg = { kind: "message", text: MESSAGE };
const ENV_KEYS = ["AI_INSPECTIONS_ENABLED", "OPENAI_API_KEY", "GEMINI_API_KEY", "ADMIN_UID"];

beforeAll(async () => {
  authAdmin = installFakeAuth("admin-uid");
  inspections = (await import("@/app/api/inspections/route")) as never;
  byId = (await import("@/app/api/inspections/[id]/route")) as never;
  run = (await import("@/app/api/inspections/[id]/run/route")) as never;
  claim = (await import("@/app/api/inspections/claim/route")) as never;
  account = (await import("@/app/api/user/account/route")) as never;
  admin = (await import("@/app/api/admin/data/route")) as never;
});

beforeEach(() => {
  store = new MemoryStore();
  setStoreForTests(store);
  setRedisForTests(null);
  authAdmin.deleted.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const k of ENV_KEYS) delete process.env[k];
});

async function create(auth: string, body: unknown = msg) {
  const res = await inspections.POST(jsonReq("/api/inspections", "POST", auth, body));
  return { res, body: (await res.json()) as { inspection?: { id: string; status: string; ownerUid: string }; error?: { code: string } } };
}

describe("authentication on every protected route", () => {
  it("rejects missing, malformed and unverifiable tokens", async () => {
    for (const auth of [null, "Basic abc", "Bearer ", "Bearer garbage"]) {
      expect((await inspections.POST(jsonReq("/api/inspections", "POST", auth, msg))).status).toBe(401);
      expect((await inspections.GET(jsonReq("/api/inspections", "GET", auth))).status).toBe(401);
      expect((await byId.GET(jsonReq("/api/inspections/x", "GET", auth), p("insp_12345678"))).status).toBe(401);
      expect((await claim.POST(jsonReq("/api/inspections/claim", "POST", auth, { inspectionId: "insp_12345678" }))).status).toBe(401);
      expect((await account.DELETE(jsonReq("/api/user/account", "DELETE", auth))).status).toBe(401);
      expect((await admin.GET(jsonReq("/api/admin/data", "GET", auth))).status).toBe(403);
    }
  });
});

describe("visitor submission", () => {
  it("creates a pending_auth inspection for an anonymous identity and runs no analysis", async () => {
    process.env.AI_INSPECTIONS_ENABLED = "true";
    const { res, body } = await create(bearer("visitor-1", "anon"));
    expect(res.status).toBe(201);
    expect(body.inspection).toMatchObject({ status: "pending_auth", ownerUid: "visitor-1" });
    const saved = await store.getInspection("visitor-1", body.inspection!.id);
    expect(saved?.status).toBe("pending_auth");
    expect(saved?.research).toBeUndefined();
    expect(saved?.case).toBeUndefined();
    expect(store.usage).toHaveLength(0); // no provider call, no research event
  });

  it("ignores any client-supplied owner, status or role fields (mass assignment)", async () => {
    const { body } = await create(bearer("visitor-1", "anon"), { ...msg, ownerUid: "victim", status: "completed", isAdmin: true, research: { status: "no_major_red_flags_found" } });
    expect(body.inspection).toMatchObject({ ownerUid: "visitor-1", status: "pending_auth" });
    expect(await store.getInspection("victim", body.inspection!.id)).toBeNull();
  });

  it("queues immediately for a signed-in account", async () => {
    const { body } = await create(bearer("student-1"));
    expect(body.inspection?.status).toBe("queued");
  });

  it("validates and size-limits input", async () => {
    expect((await create(bearer("u1"), { kind: "link", url: "javascript:alert(1)" })).res.status).toBe(422);
    expect((await create(bearer("u1"), { kind: "link", url: "https://user:pw@example.com/" })).res.status).toBe(422);
    expect((await create(bearer("u1"), { kind: "message", text: "short" })).res.status).toBe(422);
    const huge = await inspections.POST(jsonReq("/api/inspections", "POST", bearer("u1"), { kind: "message", text: "x".repeat(200_000) }));
    expect(huge.status).toBe(413);
    const wrongType = await inspections.POST(new Request("http://localhost:3000/api/inspections", { method: "POST", headers: { "content-type": "text/plain", authorization: bearer("u1") }, body: "x" }));
    expect(wrongType.status).toBe(415);
  });

  it("rejects cross-origin writes and returns safe errors with request ids", async () => {
    const res = await inspections.POST(jsonReq("/api/inspections", "POST", bearer("u1"), msg, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("x-request-id")).toMatch(/^req_/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("rate limits per user and records the event", async () => {
    let last = 0;
    for (let i = 0; i < 22; i++) last = (await create(bearer("spammer"))).res.status;
    expect(last).toBe(429);
    expect(store.usage.some((u) => u.type === "rate_limit")).toBe(true);
  });

  it("keeps limiting when Redis is down (local fallback window)", async () => {
    const redis = new FakeRedis();
    redis.down = true;
    setRedisForTests(redis.asRedis());
    let last = 0;
    for (let i = 0; i < 22; i++) last = (await create(bearer("spammer-2"))).res.status;
    expect(last).toBe(429);
  });
});

describe("student isolation (IDOR)", () => {
  it("student B cannot read, run or delete student A's inspection", async () => {
    process.env.AI_INSPECTIONS_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test"; // AI is on, so the ownership check is what stops the run
    const a = (await create(bearer("alice"))).body.inspection!;
    expect((await byId.GET(jsonReq(`/api/inspections/${a.id}`, "GET", bearer("bob")), p(a.id))).status).toBe(404);
    expect((await byId.DELETE(jsonReq(`/api/inspections/${a.id}`, "DELETE", bearer("bob")), p(a.id))).status).toBe(404);
    expect((await run.POST(jsonReq(`/api/inspections/${a.id}/run`, "POST", bearer("bob")), p(a.id))).status).toBe(404);
    expect(await store.getInspection("alice", a.id)).not.toBeNull();
    const list = (await (await inspections.GET(jsonReq("/api/inspections", "GET", bearer("bob")))).json()) as { inspections: unknown[] };
    expect(list.inspections).toEqual([]);
  });

  it("a student can read and delete their own inspection", async () => {
    const a = (await create(bearer("alice"))).body.inspection!;
    expect((await byId.GET(jsonReq("/", "GET", bearer("alice")), p(a.id))).status).toBe(200);
    expect((await byId.DELETE(jsonReq("/", "DELETE", bearer("alice")), p(a.id))).status).toBe(200);
    expect(await store.getInspection("alice", a.id)).toBeNull();
  });

  it("rejects malformed inspection ids before touching storage", async () => {
    for (const id of ["../users/alice", "insp_", "x", "insp_<script>"]) {
      expect((await byId.GET(jsonReq("/", "GET", bearer("alice")), p(id))).status).toBe(404);
    }
  });

  it("paginates the history", async () => {
    for (let i = 0; i < 5; i++) { await seedQueued(store, "alice"); await new Promise((r) => setTimeout(r, 2)); }
    const first = (await (await inspections.GET(jsonReq("/api/inspections?limit=2", "GET", bearer("alice")))).json()) as { inspections: { id: string }[]; nextCursor: string | null };
    expect(first.inspections).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = (await (await inspections.GET(jsonReq(`/api/inspections?limit=10&cursor=${first.nextCursor}`, "GET", bearer("alice")))).json()) as { inspections: { id: string }[]; nextCursor: string | null };
    expect(second.inspections).toHaveLength(3);
    expect(new Set([...first.inspections, ...second.inspections].map((x) => x.id)).size).toBe(5);
  });
});

describe("running an inspection", () => {
  it("anonymous visitors can never trigger analysis", async () => {
    process.env.AI_INSPECTIONS_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test";
    const v = (await create(bearer("visitor", "anon"))).body.inspection!;
    const res = await run.POST(jsonReq(`/api/inspections/${v.id}/run`, "POST", bearer("visitor", "anon")), p(v.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("ACCOUNT_REQUIRED");
    expect(store.usage).toHaveLength(0);
  });

  it("reports AI as paused (503) and keeps the inspection queued when the kill switch is off", async () => {
    const q = (await create(bearer("alice"))).body.inspection!;
    const res = await run.POST(jsonReq(`/api/inspections/${q.id}/run`, "POST", bearer("alice")), p(q.id));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("AI_DISABLED");
    expect((await store.getInspection("alice", q.id))?.status).toBe("queued");
  });

  it("keeps AI disabled when enabled but no provider key is configured", async () => {
    process.env.AI_INSPECTIONS_ENABLED = "true";
    const q = (await create(bearer("alice"))).body.inspection!;
    expect((await run.POST(jsonReq(`/api/inspections/${q.id}/run`, "POST", bearer("alice")), p(q.id))).status).toBe(503);
  });
});

describe("claiming a pending inspection", () => {
  it("same identity upgraded in place: the record is queued for that account", async () => {
    const v = (await create(bearer("u-1", "anon"))).body.inspection!;
    const res = await claim.POST(jsonReq("/api/inspections/claim", "POST", bearer("u-1", "user"), { inspectionId: v.id }));
    expect(res.status).toBe(200);
    expect((await store.getInspection("u-1", v.id))?.status).toBe("queued");
  });

  it("existing account sign-in: moves the record only when the caller proves the anonymous identity", async () => {
    const v = (await create(bearer("anon-9", "anon"))).body.inspection!;
    const res = await claim.POST(jsonReq("/api/inspections/claim", "POST", bearer("existing-student"), { inspectionId: v.id }, { "x-anonymous-token": "tok:anon-9:anon" }));
    expect(res.status).toBe(200);
    const moved = await store.getInspection("existing-student", v.id);
    expect(moved).toMatchObject({ ownerUid: "existing-student", status: "queued" });
    expect(await store.getInspection("anon-9", v.id)).toBeNull();
    expect(authAdmin.deleted).toContain("anon-9");
  });

  it("rejects a claim without proof of the anonymous identity", async () => {
    const v = (await create(bearer("anon-9", "anon"))).body.inspection!;
    const res = await claim.POST(jsonReq("/api/inspections/claim", "POST", bearer("attacker"), { inspectionId: v.id }));
    expect(res.status).toBe(404);
    expect(await store.getInspection("attacker", v.id)).toBeNull();
    expect((await store.getInspection("anon-9", v.id))?.status).toBe("pending_auth");
  });

  it("rejects a claim made with someone else's anonymous token or a non-anonymous token", async () => {
    const v = (await create(bearer("anon-9", "anon"))).body.inspection!;
    const wrongAnon = await claim.POST(jsonReq("/api/inspections/claim", "POST", bearer("attacker"), { inspectionId: v.id }, { "x-anonymous-token": "tok:other-anon:anon" }));
    expect(wrongAnon.status).toBe(404);
    const notAnon = await claim.POST(jsonReq("/api/inspections/claim", "POST", bearer("attacker"), { inspectionId: v.id }, { "x-anonymous-token": "tok:anon-9:user" }));
    expect(notAnon.status).toBe(403);
    expect((await store.getInspection("anon-9", v.id))?.status).toBe("pending_auth");
  });

  it("an anonymous caller cannot claim", async () => {
    const v = (await create(bearer("anon-9", "anon"))).body.inspection!;
    expect((await claim.POST(jsonReq("/api/inspections/claim", "POST", bearer("anon-9", "anon"), { inspectionId: v.id }))).status).toBe(403);
  });

  it("validates the claim body", async () => {
    expect((await claim.POST(jsonReq("/api/inspections/claim", "POST", bearer("u1"), { inspectionId: "nope" }))).status).toBe(422);
  });
});

describe("admin access", () => {
  it("ordinary users and anonymous visitors cannot read admin data", async () => {
    process.env.ADMIN_UID = "admin-uid";
    for (const auth of [bearer("student"), bearer("anon", "anon"), bearer("admin-uid", "user")]) {
      expect((await admin.GET(jsonReq("/api/admin/data?view=users", "GET", auth))).status).toBe(403);
    }
    expect(store.audit).toHaveLength(0);
  });

  it("a user cannot grant themselves admin through a request body or header", async () => {
    const res = await admin.GET(jsonReq("/api/admin/data", "GET", bearer("student"), undefined, { "x-admin": "true" }));
    expect(res.status).toBe(403);
  });

  it("the exact admin identity gets honest, paginated, audited data", async () => {
    const overview = await admin.GET(jsonReq("/api/admin/data?view=overview", "GET", bearer("admin-uid", "admin")));
    expect(overview.status).toBe(200);
    expect(await overview.json()).toMatchObject({ counts: { users: 0, inspections: 0 }, usage: { cache: { hit: 0, miss: 0 }, fallbacks: 0 } });
    await seedQueued(store, "alice", { text: "private pasted message " + "x".repeat(40) });
    await store.upsertUser("alice", { email: "alice@example.test" }, new Date().toISOString());
    const list = (await (await admin.GET(jsonReq("/api/admin/data?view=inspections", "GET", bearer("admin-uid", "admin")))).json()) as { items: { submission: { text?: string } }[] };
    expect(list.items).toHaveLength(1);
    expect(list.items[0].submission.text).toBeUndefined(); // pasted text is not exposed to the admin table
    const users = (await (await admin.GET(jsonReq("/api/admin/data?view=users", "GET", bearer("admin-uid", "admin")))).json()) as { items: unknown[] };
    expect(users.items).toHaveLength(1);
    expect(store.audit.map((a) => a.action)).toEqual(["admin.read.overview", "admin.read.inspections", "admin.read.users"]);
    expect(store.audit.every((a) => a.adminUid === "admin-uid")).toBe(true);
  });

  it("rejects unknown views", async () => {
    expect((await admin.GET(jsonReq("/api/admin/data?view=secrets", "GET", bearer("admin-uid", "admin")))).status).toBe(422);
  });
});

describe("account deletion", () => {
  it("deletes only the caller's data and auth user", async () => {
    await seedQueued(store, "alice");
    await seedQueued(store, "alice");
    const keep = await seedQueued(store, "bob");
    await store.upsertUser("alice", {}, new Date().toISOString());
    const res = await account.DELETE(jsonReq("/api/user/account", "DELETE", bearer("alice")));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, inspectionsDeleted: 2 });
    expect(authAdmin.deleted).toEqual(["alice"]);
    expect(store.users.has("alice")).toBe(false);
    expect(await store.getInspection("bob", keep.id)).not.toBeNull();
  });
});
