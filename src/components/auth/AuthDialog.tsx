"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MailCheck,
  RotateCw,
  User as UserIcon,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/firebase/auth-context";
import { useApi, type Inspection } from "@/lib/inspections-client";
import { claimPendingInspections } from "@/lib/auth/claim-pending";
import { safeNextPath } from "@/lib/auth/redirect";
import type { AuthResult } from "@/lib/firebase/client";
import { IMAGES } from "@/lib/media";

export type AuthMode = "signup" | "login";

const SECTIONS = ["Company", "Internship", "Recruiter", "Risk indicators", "Evidence"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordChecks(pw: string) {
  return [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: "Upper and lower case letters" },
    { ok: /\d/.test(pw), label: "A number" },
  ];
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export interface AuthDialogProps {
  open: boolean;
  initialMode?: AuthMode;
  onClose?: () => void;
  /** When arriving from an inspection submission, the pending record to claim */
  pendingInspection?: Inspection | null;
  /** Where to redirect after regular auth */
  nextPath?: string;
  /** If embedded directly in /login or /signup full page */
  isStandalone?: boolean;
}

export function AuthDialog({
  open,
  initialMode = "signup",
  onClose,
  pendingInspection,
  nextPath,
  isStandalone = false,
}: AuthDialogProps) {
  const router = useRouter();
  const uid = useId();
  const api = useApi();
  const { configured, loading, signUp, signIn, signInGoogle, resetPassword, getIdToken } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [view, setView] = useState<"form" | "reset" | "reset-sent">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [claimingMsg, setClaimingMsg] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const resolvedNext = safeNextPath(nextPath);

  const [prevMode, setPrevMode] = useState(initialMode);
  if (initialMode !== prevMode) {
    setPrevMode(initialMode);
    setMode(initialMode);
    setError(null);
    setView("form");
  }

  // Handle body scroll locking and Escape key
  useEffect(() => {
    if (!open || isStandalone) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isStandalone, busy, onClose]);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const strong = checks.every((c) => c.ok);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setView("form");
    if (typeof window !== "undefined") {
      const q = nextPath && nextPath !== "/app" ? `?next=${encodeURIComponent(nextPath)}` : "";
      const path = window.location.pathname;
      if (path.startsWith("/auth") || path.startsWith("/signup") || path.startsWith("/login")) {
        const url = path.startsWith("/auth")
          ? `/auth?mode=${newMode}${nextPath && nextPath !== "/app" ? `&next=${encodeURIComponent(nextPath)}` : ""}`
          : `/${newMode === "signup" ? "signup" : "login"}${q}`;
        window.history.replaceState(null, "", url);
      }
    }
  };

  const claimSpecific = async (res: AuthResult, target: Inspection) => {
    setClaimingMsg("Attaching inspection to your account…");
    const token = await getIdToken(true);
    const r = await api<{ inspection: Inspection }>("/api/inspections/claim", {
      method: "POST",
      body: { inspectionId: target.id },
      forceToken: true,
      headers: res.anonymousToken ? { "X-Anonymous-Token": res.anonymousToken } : undefined,
    });
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
      setClaimingMsg(null);
      return;
    }
    // Also claim any other pending requests in background
    if (token) void claimPendingInspections(token, res.anonymousToken);
    router.push(`/app/reports/${encodeURIComponent(r.data.inspection.id)}?start=1`);
    onClose?.();
  };

  const handleAuthSuccess = async (res: AuthResult) => {
    if (res.error || !res.user) {
      setError(res.error ?? "Authentication failed. Please check your credentials.");
      setBusy(false);
      return;
    }

    if (pendingInspection) {
      await claimSpecific(res, pendingInspection);
      return;
    }

    // Normal sign-in: claim any anonymous background inspections and continue
    const token = await getIdToken(true);
    if (token) await claimPendingInspections(token, res.anonymousToken);
    router.replace(resolvedNext);
    onClose?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (mode === "signup" && !pendingInspection) {
      if (name.trim().length < 2) {
        setError("Enter your full name.");
        return;
      }
      if (!strong) {
        setError("Choose a stronger password. See the checklist below the field.");
        return;
      }
      if (password !== confirm) {
        setError("The two passwords don't match.");
        return;
      }
    } else if (!password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);
    const result =
      mode === "signup"
        ? await signUp(cleanEmail, password, name.trim())
        : await signIn(cleanEmail, password);

    await handleAuthSuccess(result);
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    const result = await signInGoogle();
    await handleAuthSuccess(result);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim();
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter the email address of your account.");
      return;
    }
    setBusy(true);
    const r = await resetPassword(cleanEmail);
    setBusy(false);
    if (!r.ok) {
      setError(
        r.code === "RATE_LIMITED"
          ? "Too many attempts. Please wait a few minutes."
          : "We couldn't send the email right now. Please try again."
      );
      return;
    }
    setView("reset-sent");
  };

  if (!open && !isStandalone) return null;

  const targetLabel = pendingInspection?.submission?.url
    ? pendingInspection.submission.url
    : pendingInspection
    ? `Pasted message (${pendingInspection.submission?.textLength ?? 0} characters)`
    : null;

  const submitButtonLabel = busy
    ? "Please wait…"
    : pendingInspection
    ? mode === "signup"
      ? "Create account and continue"
      : "Sign in and continue"
    : mode === "signup"
    ? "Create account"
    : "Log in";

  const dialogContent = (
    <div
      ref={dialogRef}
      id={pendingInspection ? "guest-preview" : undefined}
      data-testid={pendingInspection ? "locked-shell" : undefined}
      className="relative z-10 w-full max-w-[440px] my-auto rounded-2xl border border-[var(--border-light)] bg-white p-5 sm:p-7 shadow-2xl space-y-4 max-h-[calc(100dvh-3rem)] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header Row with Logo and Close */}
      <div className="flex items-center justify-between">
        <Logo variant="full" size="sm" />
        {!isStandalone && onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Pending Inspection Banner & Locked Preview */}
      {pendingInspection && (
        <div
          className="rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--surface-accent)]/60 p-3.5 space-y-2.5"
        >
          <div className="flex items-start gap-2.5">
            <div className="grid place-items-center w-7 h-7 rounded-lg bg-[var(--brand-primary)] text-white shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--brand-secondary)]">
                  Inspection saved
                </span>
                {targetLabel && (
                  <span
                    className="text-[10px] font-mono text-[var(--ink-muted)] truncate max-w-[140px]"
                    title={targetLabel}
                  >
                    {targetLabel}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-[var(--ink-primary)] mt-0.5">
                Unlock your investigation
              </h3>
              <p className="text-xs text-[var(--ink-secondary)] leading-relaxed mt-0.5">
                Create a free account or log in to continue the research and access your private report.
              </p>
            </div>
          </div>

          {/* Locked Sections Badge Preview */}
          <div className="pt-2 border-t border-[var(--brand-primary)]/15">
            <p className="text-[10px] font-mono uppercase font-bold text-[var(--ink-muted)] mb-1.5">
              Sections prepared for analysis:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map((sec) => (
                <span
                  key={sec}
                  className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-mono font-semibold text-[var(--ink-secondary)] border border-[var(--border-light)]"
                >
                  <Lock className="w-2.5 h-2.5 text-[var(--ink-muted)]" />
                  {sec}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Title & Copy */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink-primary)]" data-testid="auth-title">
          {view !== "form"
            ? "Reset your password"
            : pendingInspection
            ? "Continue to your report"
            : "Welcome to Internyra"}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed">
          {view === "form"
            ? pendingInspection
              ? "Your submission is safely attached to this session."
              : "Your internship verification workspace starts here."
            : "We'll email you a link to choose a new password."}
        </p>
      </div>

      {/* Segmented Mode Selector (Create account / Log in) */}
      {view === "form" && (
        <div
          role="group"
          aria-label="Account"
          className="grid grid-cols-2 rounded-xl border border-[var(--border-light)] bg-[var(--surface-2)] p-1 text-xs font-semibold"
        >
          <button
            type="button"
            aria-pressed={mode === "signup"}
            onClick={() => switchMode("signup")}
            className={`rounded-lg py-2 transition-all ${
              mode === "signup"
                ? "bg-[var(--surface-0)] text-[var(--ink-primary)] shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            }`}
          >
            Create account
          </button>
          <button
            type="button"
            aria-pressed={mode === "login"}
            onClick={() => switchMode("login")}
            className={`rounded-lg py-2 transition-all ${
              mode === "login"
                ? "bg-[var(--surface-0)] text-[var(--ink-primary)] shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            }`}
          >
            Log in
          </button>
        </div>
      )}

      {/* System notices and errors */}
      {!configured && !loading && (
        <p
          role="alert"
          className="rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]"
        >
          Sign-in is not available on this deployment right now.
        </p>
      )}

      {error && (
        <div
          role="alert"
          data-testid="auth-error"
          className="flex items-start gap-2 rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {claimingMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--surface-accent)] p-3 text-xs text-[var(--brand-secondary)]"
        >
          <RotateCw className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{claimingMsg}</span>
        </div>
      )}

      {/* Reset Sent Confirmation View */}
      {view === "reset-sent" ? (
        <div
          role="status"
          className="space-y-4 rounded-xl border border-[var(--border-light)] bg-[var(--surface-1)] p-4 text-center"
          data-testid="reset-sent"
        >
          <div className="mx-auto grid place-items-center w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
            <MailCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
            If an account exists for that address, a password reset link is on its way. Check your inbox and spam folder.
          </p>
          <button
            type="button"
            onClick={() => {
              setView("form");
              setError(null);
            }}
            className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
          >
            Back to log in
          </button>
        </div>
      ) : view === "reset" ? (
        /* Reset Password View */
        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          <div className="space-y-1 text-left">
            <label htmlFor={`${uid}-reset-email`} className="block text-xs font-semibold text-[var(--ink-primary)]">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
              <input
                id={`${uid}-reset-email`}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                className="w-full rounded-xl border border-[var(--border-light)] bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm text-[var(--ink-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary h-11 w-full text-xs sm:text-sm disabled:opacity-50"
          >
            {busy && <RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Send reset link</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setView("form");
              setError(null);
            }}
            className="w-full text-center text-xs font-semibold text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
          >
            Back to log in
          </button>
        </form>
      ) : (
        /* Main Authentication Form */
        <div className="space-y-4">
          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy || !configured}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] text-xs sm:text-sm font-semibold text-[var(--ink-primary)] shadow-xs transition-colors hover:bg-[var(--surface-1)] disabled:opacity-50"
          >
            <GoogleMark />
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center" aria-hidden="true">
            <div className="w-full border-t border-[var(--border-subtle)]" />
            <span className="bg-[var(--surface-0)] px-3 text-[10px] font-mono uppercase tracking-wider text-[var(--ink-muted)]">
              or continue with email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            {mode === "signup" && !pendingInspection && (
              <div className="space-y-1 text-left">
                <label htmlFor={`${uid}-name`} className="block text-xs font-semibold text-[var(--ink-primary)]">
                  Full name
                </label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                  <input
                    id={`${uid}-name`}
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    placeholder="Your full name"
                    className="w-full rounded-xl border border-[var(--border-light)] bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm text-[var(--ink-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1 text-left">
              <label htmlFor={`${uid}-email`} className="block text-xs font-semibold text-[var(--ink-primary)]">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                <input
                  id={`${uid}-email`}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@college.edu"
                  className="w-full rounded-xl border border-[var(--border-light)] bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm text-[var(--ink-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <div className="flex items-center justify-between">
                <label htmlFor={`${uid}-pw`} className="block text-xs font-semibold text-[var(--ink-primary)]">
                  Password
                </label>
                {mode === "login" && !pendingInspection && (
                  <button
                    type="button"
                    onClick={() => {
                      setView("reset");
                      setError(null);
                    }}
                    className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                <input
                  id={`${uid}-pw`}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Create a password" : "Your password"}
                  className="w-full rounded-xl border border-[var(--border-light)] bg-white py-2.5 pl-9 pr-10 text-xs sm:text-sm text-[var(--ink-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
                {!pendingInspection && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-2 p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] rounded"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {mode === "signup" && !pendingInspection && (
                <ul className="mt-1.5 grid gap-1 text-[11px] font-mono" aria-label="Password requirements">
                  {checks.map((c) => (
                    <li
                      key={c.label}
                      className={`flex items-center gap-1.5 ${
                        c.ok ? "text-emerald-700 font-semibold" : "text-[var(--ink-muted)]"
                      }`}
                    >
                      <Check className={`h-3 w-3 ${c.ok ? "text-emerald-600" : "opacity-30"}`} aria-hidden="true" />
                      <span>{c.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {mode === "signup" && !pendingInspection && (
              <div className="space-y-1 text-left">
                <label htmlFor={`${uid}-confirm`} className="block text-xs font-semibold text-[var(--ink-primary)]">
                  Confirm password
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                  <input
                    id={`${uid}-confirm`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full rounded-xl border border-[var(--border-light)] bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm text-[var(--ink-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              data-testid="auth-submit"
              disabled={busy || !configured}
              className="btn-primary h-11 w-full text-xs sm:text-sm disabled:opacity-50 mt-1"
            >
              {busy ? <RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              <span>{submitButtonLabel}</span>
            </button>
          </form>

          {/* Switch mode footer button */}
          {pendingInspection ? (
            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setError(null);
                }}
                className="text-[var(--brand-primary)] hover:underline font-semibold"
              >
                {mode === "signup"
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-xs text-[var(--ink-secondary)]">
              {mode === "signup" ? "Already have an account? " : "New to Internyra? "}
              <button
                type="button"
                onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
                className="font-semibold text-[var(--brand-primary)] hover:underline"
              >
                {mode === "signup" ? "Log in" : "Create account"}
              </button>
            </p>
          )}
        </div>
      )}

      {/* Terms and Privacy Notice */}
      <p className="text-center text-[11px] leading-relaxed text-[var(--ink-muted)] pt-1 border-t border-[var(--border-subtle)]">
        By continuing you agree to the{" "}
        <Link href="/terms" className="underline hover:text-[var(--ink-primary)]">
          Terms
        </Link>{" "}
        and acknowledge the{" "}
        <Link href="/privacy" className="underline hover:text-[var(--ink-primary)]">
          Privacy Notice
        </Link>
        .
      </p>
    </div>
  );

  if (isStandalone) {
    return (
      <div className="grid min-h-screen bg-[var(--canvas)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Brand side (desktop only) */}
        <div className="relative hidden overflow-hidden bg-[var(--ink-primary)] text-white lg:sticky lg:top-0 lg:block lg:h-screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={IMAGES.desk.src}
            srcSet={`${IMAGES.desk.small} 640w, ${IMAGES.desk.src} 1264w`}
            sizes="50vw"
            width={IMAGES.desk.width}
            height={IMAGES.desk.height}
            alt={IMAGES.desk.alt}
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink-primary)] via-[var(--ink-primary)]/55 to-[var(--ink-primary)]/20" />
          <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
            <Logo variant="full" size="md" theme="dark" />
            <div className="max-w-md">
              <h2 className="display text-5xl !text-white xl:text-6xl font-serif">
                Know what you&apos;re <span className="serif font-normal text-[var(--citrus)]">signing up for.</span>
              </h2>
              <p className="mt-5 text-base sm:text-lg leading-relaxed text-white/75">
                Check an internship link or a recruiter message before you pay or share anything. Every finding points to its source, and what can&apos;t be established is said plainly.
              </p>
            </div>
          </div>
        </div>

        {/* Form side (comes first on phones) */}
        <div className="flex flex-col justify-center items-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-[440px] mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--ink-secondary)] hover:text-[var(--brand-primary)] transition-colors"
            >
              ← Back to site
            </Link>
          </div>
          {dialogContent}
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      {dialogContent}
    </div>
  );
}
