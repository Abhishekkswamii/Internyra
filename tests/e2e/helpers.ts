import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const MESSAGE =
  "Dear candidate, congratulations on your selection for the software internship at Northwind. Please pay the onboarding fee of 4999 rupees within 24 hours to confirm your seat.";

const app = () => getApps()[0] ?? initializeApp({ projectId: "demo-internyra" });
export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());

let counter = 0;
export const uniqueEmail = (tag: string) => `${tag}.${Date.now()}.${counter++}@e2e.test`;

/** Creates a user directly in the Auth emulator and returns its ID token via the emulator's REST API. */
export async function createUserWithToken(email: string, password = "pass-1234"): Promise<{ uid: string; token: string; email: string }> {
  const user = await adminAuth().createUser({ email, password });
  const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = (await res.json()) as { idToken: string };
  return { uid: user.uid, token: json.idToken, email };
}

export async function tokenFor(email: string, password: string): Promise<string> {
  const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return ((await res.json()) as { idToken: string }).idToken;
}

export const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createInspectionApi(request: APIRequestContext, token: string, body: object = { kind: "message", text: MESSAGE }) {
  const res = await request.post("/api/inspections", { headers: authed(token), data: body });
  return { res, json: (await res.json()) as { inspection?: { id: string; status: string; ownerUid: string }; error?: { code: string } } };
}

/** Submits a link from the hero and waits for the locked shell. */
export async function submitFromHero(page: Page, url = "https://careers.northwind.example/intern") {
  await page.goto("/");
  await page.getByLabel("Internship link to check").fill(url);
  await page.getByLabel("Internship link to check").press("Enter");
  await expect(page.getByTestId("locked-shell")).toBeVisible({ timeout: 20_000 });
}

export async function findInspections(status?: string) {
  const snap = await adminDb().collectionGroup("inspections").get();
  return snap.docs.map((d) => d.data() as { id: string; ownerUid: string; status: string; research?: unknown }).filter((d) => !status || d.status === status);
}

export async function waitForConsoleClean(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Network noise that is expected in tests (blocked analytics/fonts, aborted navigations).
    if (/Failed to load resource|favicon|net::ERR_/i.test(t)) return;
    errors.push(t);
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}
