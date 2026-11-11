"use client";

import React, { useId, useState } from "react";
import { AlertCircle, KeyRound, Mail, RotateCw } from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import type { AuthResult } from "@/lib/firebase/client";

interface AuthFormProps {
  /** Called after a successful sign-in or sign-up. May return a promise (e.g. to claim pending work). */
  onSuccess: (result: AuthResult) => void | Promise<void>;
  initialMode?: "signup" | "login";
  submitLabel?: { signup: string; login: string };
  onCancel?: () => void;
}

export function AuthForm({ onSuccess, initialMode = "signup", submitLabel, onCancel }: AuthFormProps) {
  const { signUp, signIn, signInGoogle, configured, loading } = useAuth();
  const uid = useId();
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (res: AuthResult) => {
    if (res.error || !res.user) {
      if (res.code === "EMAIL_EXISTS" && mode === "signup") setMode("login");
      setError(res.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    try {
      await onSuccess(res);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    await finish(mode === "signup" ? await signUp(email.trim(), password) : await signIn(email.trim(), password));
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    await finish(await signInGoogle());
  };

  const labels = submitLabel ?? { signup: "Create account", login: "Sign in" };

  if (!loading && !configured) {
    return (
      <p role="alert" className="rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]">
        Sign-in is not configured for this deployment yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-left">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor={`${uid}-email`} className="block text-xs font-medium text-[var(--ink-secondary)]">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
            <input id={`${uid}-email`} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu"
              className="w-full rounded-lg border border-[var(--border-light)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--ink-primary)] focus:border-[var(--brand-primary)] focus:outline-none" />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${uid}-password`} className="block text-xs font-medium text-[var(--ink-secondary)]">Password</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
            <input id={`${uid}-password`} type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters"
              className="w-full rounded-lg border border-[var(--border-light)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--ink-primary)] focus:border-[var(--brand-primary)] focus:outline-none" />
          </div>
        </div>
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ink-primary)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary)] disabled:opacity-50">
          {busy && <RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" />}
          <span>{mode === "signup" ? labels.signup : labels.login}</span>
        </button>
      </form>

      <div className="relative flex items-center py-1" aria-hidden="true">
        <div className="flex-grow border-t border-[var(--border-subtle)]" />
        <span className="mx-3 text-[11px] uppercase text-[var(--ink-muted)]">or</span>
        <div className="flex-grow border-t border-[var(--border-subtle)]" />
      </div>

      <button type="button" onClick={google} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-light)] bg-white py-2 text-sm font-semibold text-[var(--ink-primary)] shadow-xs transition-colors hover:bg-[var(--surface-1)] disabled:opacity-50">
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        <span>Continue with Google</span>
      </button>

      <div className="flex items-center justify-between pt-1 text-xs">
        <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(null); }} className="text-[var(--brand-primary)] hover:underline">
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)]">Cancel</button>}
      </div>
    </div>
  );
}
