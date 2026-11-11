/**
 * One-time, trusted script: grants the { admin: true } custom claim to the single administrator account.
 *
 *   ADMIN_EMAIL=you@example.com FIREBASE_PROJECT_ID=internyra-385d6 npm run admin:claim
 *   (or pass the UID instead:  ... npm run admin:claim -- <uid>)
 *
 * Safety checks, all enforced here:
 *  - The account must already exist as a real, non-anonymous Firebase Auth user (sign up in the app first).
 *  - Its email must be VERIFIED. Otherwise anyone could register the admin's address with a password first
 *    and inherit admin rights.
 *  - Other existing custom claims are preserved.
 *  - The UID is read through trusted Admin SDK access, printed, and re-verified after the claim is set.
 *    Put that UID in ADMIN_UID (apphosting.yaml); the server only honours the claim when uid === ADMIN_UID.
 *
 * Credentials: Application Default Credentials (`gcloud auth application-default login` as the project owner)
 * or GOOGLE_APPLICATION_CREDENTIALS. Nothing secret is printed.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const arg = process.argv[2];
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!projectId || (!arg && !email)) {
    console.error("Usage: ADMIN_EMAIL=<email> FIREBASE_PROJECT_ID=<project> npm run admin:claim   (or pass a UID argument)");
    process.exit(1);
  }

  const auth = getAuth(initializeApp({ projectId }));
  const user = await (arg ? auth.getUser(arg) : auth.getUserByEmail(email!)).catch(() => null);
  if (!user) {
    console.error("No Firebase Auth user was found. Create the account through the app's sign-up page first; this script never creates one.");
    process.exit(1);
  }
  if (user.providerData.length === 0) {
    console.error("Refusing: that account is an anonymous visitor, not a real account.");
    process.exit(1);
  }
  if (!user.emailVerified) {
    console.error("Refusing: the account's email is not verified. Verify it (or sign in with Google) first, then run this again.");
    process.exit(1);
  }
  if (email && user.email?.toLowerCase() !== email) {
    console.error("Refusing: the account's email does not match ADMIN_EMAIL.");
    process.exit(1);
  }

  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
  await auth.revokeRefreshTokens(user.uid); // the next sign-in gets a token that carries the claim
  const check = await auth.getUser(user.uid);
  console.log(`Admin claim set for ${check.email} (providers: ${check.providerData.map((p) => p.providerId).join(", ")}).`);
  console.log(`UID: ${check.uid}`);
  console.log("claims now:", Object.keys(check.customClaims ?? {}).join(", "));
  console.log("Next: set ADMIN_UID to this UID in apphosting.yaml and redeploy; sign out and back in; enable MFA for this account.");
}

main().catch((e) => {
  console.error("Failed:", (e as { code?: string }).code ?? "unexpected error");
  process.exit(1);
});
