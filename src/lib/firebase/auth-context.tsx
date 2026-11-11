"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getClientConfig } from "@/lib/config/client";
import { ensureAnonymousUser, getFirebaseAuth, requestPasswordReset, signInWithEmail, signInWithGoogle, signOutUser, signUpWithEmail, type AuthResult } from "./client";

interface AuthContextValue {
  user: User | null;
  /** True until the first auth state has been restored from the browser. */
  loading: boolean;
  /** False when the public Firebase config is missing, so sign-in cannot work. */
  configured: boolean;
  isAnonymous: boolean;
  /** UI hint only. Every admin request is re-verified on the server. */
  isAdmin: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  ensureAnonymous: () => Promise<User | null>;
  signUp: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<{ ok: boolean; code?: string }>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInGoogle: () => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const noop = async () => ({ user: null }) as AuthResult;
const AuthContext = createContext<AuthContextValue>({
  user: null, loading: true, configured: false, isAnonymous: false, isAdmin: false,
  getIdToken: async () => null, ensureAnonymous: async () => null, signUp: noop, resetPassword: async () => ({ ok: false }), signIn: noop, signInGoogle: noop, logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Public Firebase config is fixed at build time, so this is identical on server and client.
  const configured = useMemo(() => Boolean(getClientConfig().apiKey && getClientConfig().projectId), []);
  const [isAdmin, setIsAdmin] = useState(false);
  // Linking an anonymous user to a credential keeps the same User object, so track changes explicitly.
  const [, setVersion] = useState(0);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      const t = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(t);
    }
    return onIdTokenChanged(auth, async (u) => {
      setUser(u);
      setVersion((v) => v + 1);
      setIsAdmin(false);
      if (u && !u.isAnonymous) {
        try {
          setIsAdmin((await u.getIdTokenResult()).claims.admin === true);
        } catch {}
      }
      setLoading(false);
    });
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    const u = getFirebaseAuth()?.currentUser;
    if (!u) return null;
    try {
      return await u.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  }, []);

  // Read at render time (the version bump above re-renders on in-place linking).
  const isAnonymous = Boolean(user?.isAnonymous);

  const value = useMemo<AuthContextValue>(
    () => ({
      user, loading, configured, isAdmin, isAnonymous,
      getIdToken, ensureAnonymous: ensureAnonymousUser, signUp: signUpWithEmail, resetPassword: requestPasswordReset, signIn: signInWithEmail, signInGoogle: signInWithGoogle, logout: signOutUser,
    }),
    [user, loading, configured, isAdmin, isAnonymous, getIdToken]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
