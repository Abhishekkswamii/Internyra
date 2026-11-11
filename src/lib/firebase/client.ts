import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  linkWithPopup,
  linkWithCredential,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInAnonymously,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import { getClientConfig } from "@/lib/config/client";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let emulatorConnected = false;

export function getFirebaseClientApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  const config = getClientConfig();
  if (!config.apiKey || !config.projectId) return null;
  app ??= getApps().length ? getApp() : initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  const a = getFirebaseClientApp();
  if (!a) return null;
  auth = getAuth(a);
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
    emulatorConnected = true;
  }
  return auth;
}

export interface AuthResult {
  user: User | null;
  /**
   * Set when the visitor signed in to a DIFFERENT, existing account while holding an anonymous
   * identity with pending work. The server needs this token to verify that the same person owns
   * the pending inspection before moving it.
   */
  anonymousToken?: string;
  /** Stable code: EMAIL_EXISTS, INVALID_CREDENTIALS, WEAK_PASSWORD, RATE_LIMITED, POPUP_CLOSED, METHOD_DISABLED, NETWORK, UNAVAILABLE, FAILED */
  code?: string;
  error?: string;
}

const MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: "An account with this email already exists. Sign in instead.",
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  WEAK_PASSWORD: "Choose a stronger password (at least 6 characters).",
  RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  POPUP_CLOSED: "The Google sign-in window was closed before finishing.",
  METHOD_DISABLED: "This sign-in method is not enabled yet.",
  NETWORK: "Could not reach the sign-in service. Check your connection.",
  UNAVAILABLE: "Sign-in is not available right now.",
  FAILED: "Something went wrong. Please try again.",
};

function fail(err: unknown): AuthResult {
  const c = (err as { code?: string })?.code ?? "";
  let code = "FAILED";
  if (c === "auth/email-already-in-use" || c === "auth/credential-already-in-use") code = "EMAIL_EXISTS";
  else if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(c)) code = "INVALID_CREDENTIALS";
  else if (c === "auth/weak-password") code = "WEAK_PASSWORD";
  else if (c === "auth/too-many-requests") code = "RATE_LIMITED";
  else if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") code = "POPUP_CLOSED";
  else if (c === "auth/operation-not-allowed" || c === "auth/admin-restricted-operation") code = "METHOD_DISABLED";
  else if (c === "auth/network-request-failed") code = "NETWORK";
  return { user: null, code, error: MESSAGES[code] };
}

const unavailable = (): AuthResult => ({ user: null, code: "UNAVAILABLE", error: MESSAGES.UNAVAILABLE });

/** Short-lived identity for a visitor, used only to hold a pending inspection before signup. */
export async function ensureAnonymousUser(): Promise<User | null> {
  const a = getFirebaseAuth();
  if (!a) return null;
  if (a.currentUser) return a.currentUser;
  try {
    return (await signInAnonymously(a)).user;
  } catch {
    return null;
  }
}

/** New account. An anonymous identity is upgraded in place, so its pending work stays with the same UID. */
export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const a = getFirebaseAuth();
  if (!a) return unavailable();
  try {
    if (a.currentUser?.isAnonymous) {
      const res = await linkWithCredential(a.currentUser, EmailAuthProvider.credential(email, password));
      await res.user.getIdToken(true); // refresh so the token no longer says "anonymous"
      return { user: res.user };
    }
    return { user: (await createUserWithEmailAndPassword(a, email, password)).user };
  } catch (err) {
    return fail(err);
  }
}

/** Existing account. Captures the anonymous token first so pending work can be claimed safely. */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const a = getFirebaseAuth();
  if (!a) return unavailable();
  try {
    const anon = a.currentUser?.isAnonymous ? a.currentUser : null;
    const anonymousToken = anon ? await anon.getIdToken() : undefined;
    const res = await signInWithEmailAndPassword(a, email, password);
    return { user: res.user, anonymousToken };
  } catch (err) {
    return fail(err);
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const a = getFirebaseAuth();
  if (!a) return unavailable();
  const provider = new GoogleAuthProvider();
  const current = a.currentUser;
  try {
    if (current?.isAnonymous) {
      try {
        const res = await linkWithPopup(current, provider);
        await res.user.getIdToken(true);
        return { user: res.user };
      } catch (err) {
        // This Google account already exists: sign in to it and let the server verify the handoff.
        if ((err as { code?: string })?.code === "auth/credential-already-in-use") {
          const credential = GoogleAuthProvider.credentialFromError(err as never);
          if (!credential) return fail(err);
          const anonymousToken = await current.getIdToken();
          const res = await signInWithCredential(a, credential);
          return { user: res.user, anonymousToken };
        }
        throw err;
      }
    }
    return { user: (await signInWithPopup(a, provider)).user };
  } catch (err) {
    return fail(err);
  }
}

export async function signOutUser(): Promise<void> {
  const a = getFirebaseAuth();
  if (a) await firebaseSignOut(a);
}
