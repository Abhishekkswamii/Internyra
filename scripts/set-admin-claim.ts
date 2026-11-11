/**
 * One-time, trusted script: grants the { admin: true } custom claim to the single admin account.
 *
 * Preconditions (all checked here):
 *  - ADMIN_UID is set and equals the UID you pass. The UID is never inferred from an email.
 *  - That UID already exists as an ordinary, non-anonymous Firebase Auth user (sign up in the app first).
 *
 * Credentials: Application Default Credentials (`gcloud auth application-default login` as the project
 * owner) or a service-account key referenced through GOOGLE_APPLICATION_CREDENTIALS. Nothing secret is printed.
 *
 *   ADMIN_UID=<uid> FIREBASE_PROJECT_ID=internyra-385d6 npm run admin:claim -- <uid>
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

async function main() {
  const target = process.argv[2];
  const configured = process.env.ADMIN_UID;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!target || !configured || !projectId) {
    console.error("Usage: ADMIN_UID=<uid> FIREBASE_PROJECT_ID=<project> npm run admin:claim -- <uid>");
    process.exit(1);
  }
  if (target !== configured) {
    console.error("Refusing: the UID argument must equal ADMIN_UID, so the claim is granted to exactly one account.");
    process.exit(1);
  }

  const auth = getAuth(initializeApp({ projectId }));
  const user = await auth.getUser(target).catch(() => null);
  if (!user) {
    console.error("Refusing: no Firebase Auth user with that UID exists in this project. Sign up in the app first.");
    process.exit(1);
  }
  if (user.providerData.length === 0) {
    console.error("Refusing: that UID is an anonymous visitor, not a real account.");
    process.exit(1);
  }
  const providers = user.providerData.map((p) => p.providerId).join(", ");
  console.log(`Found account ${user.email ?? "(no email)"} via ${providers}. Granting admin claim…`);
  await auth.setCustomUserClaims(target, { ...(user.customClaims ?? {}), admin: true });
  await auth.revokeRefreshTokens(target); // forces a fresh token that carries the claim
  console.log("Done. Sign out and back in to receive the claim. Enable multi-factor auth on this account in the Firebase console.");
}

main().catch((e) => {
  console.error("Failed:", (e as { code?: string }).code ?? "unexpected error");
  process.exit(1);
});
