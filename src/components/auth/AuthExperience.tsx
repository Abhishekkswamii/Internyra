"use client";

import React, { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { safeNextPath } from "@/lib/auth/redirect";
import { AuthDialog, type AuthMode } from "@/components/auth/AuthDialog";

export { passwordChecks } from "@/components/auth/AuthDialog";

export function AuthExperience({ initialMode }: { initialMode?: AuthMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, isAnonymous } = useAuth();

  const next = safeNextPath(params.get("next"));
  const modeParam = params.get("mode") === "login" ? "login" : params.get("mode") === "signup" ? "signup" : undefined;
  const resolvedMode: AuthMode = initialMode ?? modeParam ?? "signup";

  // Prevent immediate bounce while sign-in completes
  const inFlow = useRef(false);

  useEffect(() => {
    if (!loading && user && !isAnonymous && !inFlow.current) {
      router.replace(next);
    }
  }, [loading, user, isAnonymous, next, router]);

  return (
    <AuthDialog
      open={true}
      isStandalone={true}
      initialMode={resolvedMode}
      nextPath={next}
    />
  );
}
