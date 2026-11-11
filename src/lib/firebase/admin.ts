import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getServerConfig } from "@/lib/config/env";

let adminApp: App | null = null;

/**
 * Initialises the Admin SDK. On Firebase App Hosting / Cloud Run it uses Application Default
 * Credentials (no key material in config). Local development may supply a service-account
 * triple through env; the emulators need only a project ID.
 */
export function getFirebaseAdminApp(): App | null {
  if (adminApp) return adminApp;
  const existing = getApps()[0];
  if (existing) return (adminApp = existing);

  const config = getServerConfig();
  const projectId = config.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) return null;

  // Emulators need only a project ID; never use key material against them.
  const emulated = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);

  try {
    if (!emulated && config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY) {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
          privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
        projectId,
      });
    } else {
      adminApp = initializeApp({ projectId });
    }
    return adminApp;
  } catch {
    return null;
  }
}

export function getFirestoreAdmin(): Firestore | null {
  const app = getFirebaseAdminApp();
  return app ? getFirestore(app) : null;
}

export function getAuthAdmin(): Auth | null {
  const app = getFirebaseAdminApp();
  return app ? getAuth(app) : null;
}

export interface VerifiedAuthUser {
  uid: string;
  email?: string;
  isAnonymous: boolean;
  /** True only for the exact ADMIN_UID that also carries the admin custom claim. */
  isAdmin: boolean;
}

export function bearerToken(req: Request, header = "authorization"): string | null {
  const raw = req.headers.get(header);
  if (!raw) return null;
  const token = header === "authorization" ? (raw.startsWith("Bearer ") ? raw.slice(7).trim() : "") : raw.trim();
  return token || null;
}

/** Verifies a Firebase ID token. Never trusts UID, email or role supplied by the client. */
export async function verifyToken(token: string, checkRevoked = false): Promise<VerifiedAuthUser | null> {
  const auth = getAuthAdmin();
  if (!auth || !token) return null;
  try {
    const decoded = await auth.verifyIdToken(token, checkRevoked);
    const { ADMIN_UID } = getServerConfig();
    const anonymous = decoded.firebase?.sign_in_provider === "anonymous";
    return {
      uid: decoded.uid,
      email: decoded.email,
      isAnonymous: anonymous,
      isAdmin: Boolean(ADMIN_UID && decoded.admin === true && decoded.uid === ADMIN_UID && !anonymous),
    };
  } catch {
    return null;
  }
}

export async function verifyRequestAuth(req: Request, checkRevoked = false): Promise<VerifiedAuthUser | null> {
  const token = bearerToken(req);
  return token ? verifyToken(token, checkRevoked) : null;
}

/** Admin access requires a verified, non-revoked token, the admin claim and the exact configured UID. */
export async function requireAdminAuth(req: Request): Promise<VerifiedAuthUser | null> {
  const user = await verifyRequestAuth(req, true);
  return user?.isAdmin ? user : null;
}
