import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/** Provisions the single admin account in the Auth emulator: an ordinary user plus the admin claim. */
export default async function globalSetup() {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Run through `npm run test:e2e` so the Firebase emulators are running.");
  const app = getApps()[0] ?? initializeApp({ projectId: "demo-internyra" });
  const auth = getAuth(app);
  const uid = "e2e-admin-uid";
  await auth.getUser(uid).catch(() => auth.createUser({ uid, email: "admin@e2e.test", password: "e2e-admin-pass-1", emailVerified: true }));
  await auth.setCustomUserClaims(uid, { admin: true });
}
