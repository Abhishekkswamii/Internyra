"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Check, Eye, EyeOff, KeyRound, Mail, MailCheck, RotateCw, User as UserIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/firebase/auth-context";
import { claimPendingInspections } from "@/lib/auth/claim-pending";
import { safeNextPath } from "@/lib/auth/redirect";
import type { AuthResult } from "@/lib/firebase/client";
import { IMAGES } from "@/lib/media";

type Mode = "signup" | "login";

export function passwordChecks(pw: string) {
  return [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: "Upper and lower case letters" },
    { ok: /\d/.test(pw), label: "A number" },
  ];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export function AuthExperience({ initialMode }: { initialMode?: Mode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const uid = useId();
  const { user, loading, isAnonymous, configured, signUp, signIn, signInGoogle, resetPassword, getIdToken } = useAuth();

  const next = safeNextPath(params.get("next"));
  const [mode, setMode] = useState<Mode>(initialMode ?? (params.get("mode") === "login" ? "login" : "signup"));
  const [view, setView] = useState<"form" | "reset" | "reset-sent">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in with a real account: go straight to the destination.
  useEffect(() => {
    if (!loading && user && !isAnonymous) router.replace(next);
  }, [loading, user, isAnonymous, next, router]);

  const q = next === "/app" ? "" : `next=${encodeURIComponent(next)}`;
  // Switching modes is instant client state; the URL is kept in sync (without a navigation) so a refresh or a
  // shared link lands on the same form.
  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setView("form");
    const url = pathname === "/auth" ? `/auth?mode=${m}${q ? `&${q}` : ""}` : `/${m === "signup" ? "signup" : "login"}${q ? `?${q}` : ""}`;
    window.history.replaceState(null, "", url);
  };

  const checks = useMemo(() => passwordChecks(password), [password]);
  const strong = checks.every((c) => c.ok);

  const afterAuth = async (res: AuthResult) => {
    const token = await getIdToken(true);
    if (token) await claimPendingInspections(token, res.anonymousToken); // never blocks navigation
    router.replace(next);
  };

  const finish = async (res: AuthResult) => {
    if (res.error || !res.user) {
      setError(res.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    await afterAuth(res);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email address.");
    if (mode === "signup") {
      if (name.trim().length < 2) return setError("Enter your full name.");
      if (!strong) return setError("Choose a stronger password. See the checklist below the field.");
      if (password !== confirm) return setError("The two passwords don't match.");
    } else if (!password) return setError("Enter your password.");
    setBusy(true);
    await finish(mode === "signup" ? await signUp(email.trim(), password, name) : await signIn(email.trim(), password));
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    await finish(await signInGoogle());
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError("Enter the email address of your account.");
    setBusy(true);
    const r = await resetPassword(email.trim());
    setBusy(false);
    if (!r.ok) return setError(r.code === "RATE_LIMITED" ? "Too many attempts. Please wait a few minutes." : "We couldn't send the email right now. Please try again.");
    setView("reset-sent");
  };

  const input = "w-full rounded-xl border border-[var(--ink-primary)]/15 bg-white py-3 pl-10 pr-3 text-[15px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20";
  const icon = "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]";
  const label = "mb-1.5 block text-sm font-medium text-[var(--ink-primary)]";

  const Eye_ = (
    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink-primary)]">
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="grid min-h-screen bg-[var(--canvas)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Brand side (desktop) */}
      <div className="relative hidden overflow-hidden bg-[var(--ink-primary)] text-white lg:sticky lg:top-0 lg:block lg:h-screen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMAGES.desk.src} srcSet={`${IMAGES.desk.small} 640w, ${IMAGES.desk.src} 1264w`} sizes="50vw" width={IMAGES.desk.width} height={IMAGES.desk.height} alt={IMAGES.desk.alt} className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink-primary)] via-[var(--ink-primary)]/55 to-[var(--ink-primary)]/20" />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Logo variant="full" size="md" theme="dark" />
          <div className="max-w-md">
            <h2 className="display text-5xl !text-white xl:text-6xl">Know what you&apos;re <span className="serif font-normal text-[var(--citrus)]">signing up for.</span></h2>
            <p className="mt-5 text-lg leading-relaxed text-white/75">
              Check an internship link or a recruiter message before you pay or share anything. Every finding points to its source, and what can&apos;t be established is said plainly.
            </p>
          </div>
        </div>
      </div>

      {/* Form side */}
      <main className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <div className="lg:invisible"><Logo variant="full" size="sm" /></div>
          <Link href="/" className="text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]">← Back to site</Link>
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-8">
          <h1 className="display text-4xl sm:text-[2.6rem]" data-testid="auth-title">
            {view !== "form" ? "Reset your password" : "Welcome to Internyra"}
          </h1>
          <p className="mt-2 text-[var(--ink-secondary)]">
            {view === "form" ? "Your internship verification workspace starts here." : "We'll email you a link to choose a new password."}
          </p>

          {view === "form" && (
            <div role="group" aria-label="Account" className="mt-7 grid grid-cols-2 rounded-full border border-[var(--ink-primary)]/12 bg-white p-1">
              {(["signup", "login"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => switchMode(m)}
                  className={`rounded-full py-2.5 text-center text-sm font-semibold transition-colors ${mode === m ? "bg-[var(--ink-primary)] text-white" : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"}`}>
                  {m === "signup" ? "Create account" : "Log in"}
                </button>
              ))}
            </div>
          )}

          {!configured && !loading && (
            <p role="alert" className="mt-6 rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-sm text-[var(--status-risk-text)]">Sign-in is not available on this deployment right now.</p>
          )}

          {error && (
            <div role="alert" data-testid="auth-error" className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-sm text-[var(--status-risk-text)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {view === "reset-sent" ? (
            <div role="status" className="mt-7 space-y-4 rounded-2xl border border-[var(--border-light)] bg-white p-5" data-testid="reset-sent">
              <MailCheck className="h-6 w-6 text-[var(--brand-primary)]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">If an account exists for that address, a password reset link is on its way. Check your inbox and spam folder.</p>
              <button type="button" onClick={() => { setView("form"); setError(null); }} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">Back to log in</button>
            </div>
          ) : view === "reset" ? (
            <form onSubmit={sendReset} className="mt-7 space-y-4" noValidate>
              <div>
                <label htmlFor={`${uid}-re`} className={label}>Email address</label>
                <div className="relative"><Mail className={icon} aria-hidden="true" /><input id={`${uid}-re`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="you@college.edu" /></div>
              </div>
              <button type="submit" disabled={busy} className="btn-primary h-12 w-full disabled:opacity-50">{busy ? <RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}<span>Send reset link</span></button>
              <button type="button" onClick={() => { setView("form"); setError(null); }} className="w-full text-center text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]">Back to log in</button>
            </form>
          ) : (
            <>
              <button type="button" onClick={google} disabled={busy || !configured} className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[var(--ink-primary)]/15 bg-white text-[15px] font-semibold text-[var(--ink-primary)] shadow-xs transition-colors hover:bg-[var(--surface-1)] disabled:opacity-50">
                <GoogleMark /><span>Continue with Google</span>
              </button>

              <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]" aria-hidden="true">
                <span className="h-px flex-1 bg-[var(--ink-primary)]/12" /><span>or continue with email</span><span className="h-px flex-1 bg-[var(--ink-primary)]/12" />
              </div>

              <form onSubmit={submit} className="space-y-4" noValidate>
                {mode === "signup" && (
                  <div>
                    <label htmlFor={`${uid}-name`} className={label}>Full name</label>
                    <div className="relative"><UserIcon className={icon} aria-hidden="true" /><input id={`${uid}-name`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} placeholder="Your full name" /></div>
                  </div>
                )}
                <div>
                  <label htmlFor={`${uid}-email`} className={label}>Email address</label>
                  <div className="relative"><Mail className={icon} aria-hidden="true" /><input id={`${uid}-email`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="you@college.edu" /></div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor={`${uid}-pw`} className="text-sm font-medium text-[var(--ink-primary)]">Password</label>
                    {mode === "login" && <button type="button" onClick={() => { setView("reset"); setError(null); }} className="text-sm font-medium text-[var(--brand-primary)] hover:underline">Forgot password?</button>}
                  </div>
                  <div className="relative"><KeyRound className={icon} aria-hidden="true" /><input id={`${uid}-pw`} type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} pr-11`} placeholder={mode === "signup" ? "Create a password" : "Your password"} />{Eye_}</div>
                  {mode === "signup" && (
                    <ul className="mt-2 grid gap-1 text-xs" aria-label="Password requirements">
                      {checks.map((c) => (
                        <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? "text-emerald-700" : "text-[var(--ink-muted)]"}`}><Check className={`h-3.5 w-3.5 ${c.ok ? "" : "opacity-30"}`} aria-hidden="true" />{c.label}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {mode === "signup" && (
                  <div>
                    <label htmlFor={`${uid}-cf`} className={label}>Confirm password</label>
                    <div className="relative"><KeyRound className={icon} aria-hidden="true" /><input id={`${uid}-cf`} type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} placeholder="Repeat the password" /></div>
                  </div>
                )}
                <button type="submit" data-testid="auth-submit" disabled={busy || !configured} className="btn-primary h-12 w-full disabled:opacity-50">
                  {busy ? <RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  <span>{mode === "signup" ? "Create account" : "Log in"}</span>
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-[var(--ink-secondary)]">
                {mode === "signup" ? "Already have an account? " : "New to Internyra? "}
                <button type="button" onClick={() => switchMode(mode === "signup" ? "login" : "signup")} className="font-semibold text-[var(--brand-primary)] hover:underline">{mode === "signup" ? "Log in" : "Create account"}</button>
              </p>
            </>
          )}

          <p className="mt-8 text-center text-xs leading-relaxed text-[var(--ink-muted)]">
            By continuing you agree to the <Link href="/terms" className="underline hover:text-[var(--ink-primary)]">Terms</Link> and acknowledge the <Link href="/privacy" className="underline hover:text-[var(--ink-primary)]">Privacy Notice</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
