"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { loginUrlFor } from "@/lib/auth/redirect";
import { recentlyLoggedOut } from "@/lib/firebase/client";
import { AppShell } from "./AppShell";

/**
 * The signed-in application. A signed-out visitor never sees the Core shell: they are sent to the login
 * page with a validated internal `next` destination. Authorisation still happens on the server per request.
 */
export function ProtectedApp({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { user, loading, isAnonymous } = useAuth();
  const signedIn = Boolean(user && !isAnonymous);

  useEffect(() => {
    if (loading || signedIn) return;
    // After an explicit log-out go home; otherwise ask the visitor to log in and come back.
    router.replace(recentlyLoggedOut() ? "/" : loginUrlFor(`${pathname}${search ? `?${search}` : ""}`));
  }, [loading, signedIn, pathname, search, router]);

  if (loading || !signedIn) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--canvas)]" role="status" aria-label="Loading">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--ink-primary)]/15 border-t-[var(--brand-primary)]" />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
