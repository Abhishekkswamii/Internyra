import { vi } from "vitest";

/**
 * Token scheme for tests: "tok:<uid>:<kind>" where kind is user | anon | admin | claimOnly.
 * Installed by mocking token verification only; all route logic runs for real.
 */
export function installFakeAuth(adminUid = "admin-uid") {
  const authAdmin = { deleted: [] as string[], getUser: async (uid: string) => ({ uid, providerData: [] }), deleteUser: async (uid: string) => { authAdmin.deleted.push(uid); } };
  vi.doMock("@/lib/firebase/admin", () => {
    const verify = async (token: string) => {
      const [prefix, uid, kind] = token.split(":");
      if (prefix !== "tok" || !uid) return null;
      return { uid, email: kind === "anon" ? undefined : `${uid}@example.test`, isAnonymous: kind === "anon", isAdmin: kind === "admin" && uid === adminUid };
    };
    return {
      verifyToken: verify,
      bearerToken: (req: Request, header = "authorization") => {
        const raw = req.headers.get(header);
        if (!raw) return null;
        const t = header === "authorization" ? (raw.startsWith("Bearer ") ? raw.slice(7).trim() : "") : raw.trim();
        return t || null;
      },
      verifyRequestAuth: async (req: Request) => {
        const raw = req.headers.get("authorization");
        return raw?.startsWith("Bearer ") ? verify(raw.slice(7)) : null;
      },
      requireAdminAuth: async (req: Request) => {
        const raw = req.headers.get("authorization");
        const u = raw?.startsWith("Bearer ") ? await verify(raw.slice(7)) : null;
        return u?.isAdmin ? u : null;
      },
      getAuthAdmin: () => authAdmin,
    };
  });
  return authAdmin;
}

export const bearer = (uid: string, kind: "user" | "anon" | "admin" = "user") => `Bearer tok:${uid}:${kind}`;

export function jsonReq(path: string, method: string, auth: string | null, body?: unknown, extra: Record<string, string> = {}) {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
