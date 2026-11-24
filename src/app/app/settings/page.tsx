"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Trash2,
  Shield,
  User,
  Smartphone,
  Database,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import { InstallCard } from "@/components/pwa/InstallCard";
import { useApi } from "@/lib/inspections-client";
import { AppPageHeader } from "@/components/ui/AppPageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function SettingsPage() {
  const router = useRouter();
  const api = useApi();
  const { user, logout, resetPassword } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerNames =
    user?.providerData.map((p) => (p.providerId === "google.com" ? "Google" : "Email & Password")).join(", ") ||
    "Email & Password";

  const isEmailVerified = user?.emailVerified;

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetBusy(true);
    setError(null);
    const r = await resetPassword(user.email);
    setResetBusy(false);
    if (r.ok) {
      setResetSent(true);
    } else {
      setError(r.code === "RATE_LIMITED" ? "Too many reset attempts. Please wait." : "Could not send reset email.");
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    const r = await api<{ ok: boolean; inspectionsDeleted: number }>("/api/user/account", {
      method: "DELETE",
      forceToken: true,
    });
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
      setConfirmingDelete(false);
      return;
    }
    await logout().catch(() => {});
    router.replace("/");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in pb-12">
      <AppPageHeader
        title="Settings"
        eyebrow="Preferences & Governance"
        description="Manage your Internyra account credentials, PWA installation, privacy controls, and data retention."
      />

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-4 text-xs text-[var(--status-risk-text)]"
        >
          {error}
        </div>
      )}

      {/* 1. Account Group */}
      <section className="space-y-4" aria-label="Account">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          <User className="w-4 h-4 text-[var(--brand-primary)]" />
          <h2 id="acct-heading" className="text-sm font-bold uppercase tracking-wider text-[var(--ink-primary)] font-mono">
            Account Profile
          </h2>
        </div>

        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="grid sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">Signed-in Email</span>
              <p className="text-sm font-bold text-[var(--ink-primary)] mt-0.5 truncate" data-testid="account-email">
                {user?.email ?? "unknown"}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">Auth Provider</span>
              <p className="text-sm font-semibold text-[var(--ink-primary)] mt-0.5">
                {providerNames}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">Email Verification</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Unverified address</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">User ID</span>
              <p className="text-[11px] font-mono text-[var(--ink-muted)] mt-0.5 truncate">
                {user?.uid ?? "—"}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <span className="text-xs text-[var(--ink-muted)] font-mono">End this device&apos;s active session</span>
            <button
              type="button"
              onClick={() => void logout().then(() => router.replace("/"))}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--surface-1)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-2)] transition-colors shadow-2xs"
            >
              <LogOut className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Application & PWA Group */}
      <section className="space-y-4" aria-labelledby="app-heading">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          <Smartphone className="w-4 h-4 text-[var(--brand-primary)]" />
          <h2 id="app-heading" className="text-sm font-bold uppercase tracking-wider text-[var(--ink-primary)] font-mono">
            Application & PWA
          </h2>
        </div>

        <InstallCard />

        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold uppercase text-[10px] text-[var(--ink-muted)]">Web Client Version</span>
            <span className="font-mono text-[11px] text-[var(--ink-primary)] font-semibold">v0.1.0-prod (App Hosting)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold uppercase text-[10px] text-[var(--ink-muted)]">Offline Service Worker</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold font-mono text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>v3 (Static Cache Active)</span>
            </span>
          </div>
        </div>
      </section>

      {/* 3. Security Credentials Group */}
      <section className="space-y-4" aria-labelledby="sec-heading">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          <Lock className="w-4 h-4 text-[var(--brand-primary)]" />
          <h2 id="sec-heading" className="text-sm font-bold uppercase tracking-wider text-[var(--ink-primary)] font-mono">
            Security & Access
          </h2>
        </div>

        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[var(--ink-primary)]">Password change</h3>
              <p className="text-xs text-[var(--ink-secondary)] mt-0.5">
                Send a secure reset link to your registered email address.
              </p>
            </div>
            {resetSent ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reset email sent</span>
              </span>
            ) : (
              <button
                type="button"
                disabled={resetBusy}
                onClick={handlePasswordReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-light)] bg-[var(--surface-1)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors shadow-2xs"
              >
                {resetBusy && <RotateCw className="w-3 h-3 animate-spin" />}
                <span>Send password reset</span>
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] text-xs text-[var(--ink-secondary)] leading-relaxed">
            <span className="font-mono text-[10px] uppercase font-bold text-[var(--ink-muted)] block mb-1">
              Multi-Factor Authentication (MFA)
            </span>
            <span>
              MFA is managed through Firebase Authentication. Standard student accounts authenticate via Google Identity OAuth or email token verification.
            </span>
          </div>
        </div>
      </section>

      {/* 4. Privacy & Data Governance Group */}
      <section className="space-y-4" aria-labelledby="data-heading">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          <Database className="w-4 h-4 text-[var(--brand-primary)]" />
          <h2 id="data-heading" className="text-sm font-bold uppercase tracking-wider text-[var(--ink-primary)] font-mono">
            Privacy & Data Governance
          </h2>
        </div>

        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 sm:p-6 shadow-xs space-y-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[var(--ink-primary)]">Data Storage Location:</strong> Submitted URLs and generated reports are stored encrypted at rest in Google Cloud Firestore (Singapore region: <code className="font-mono text-[11px] bg-[var(--surface-2)] px-1 py-0.5 rounded">asia-southeast1</code>).
            </li>
            <li>
              <strong className="text-[var(--ink-primary)]">Automatic Text Purging:</strong> Raw recruiter message texts are removed from Firestore immediately upon report completion; only the character count and cryptographic fingerprint remain.
            </li>
            <li>
              <strong className="text-[var(--ink-primary)]">AI Processing Boundary:</strong> Public link URLs and sanitized opportunity descriptions are processed via Google Gemini or OpenAI. Never submit banking details, OTPs, or passwords.
            </li>
            <li>
              <strong className="text-[var(--ink-primary)]">Caching & Isolation:</strong> Identical requests within a 24-hour window may reuse verified registry lookups from Upstash Redis, but every student receives an isolated, private report document.
            </li>
            <li>
              <strong className="text-[var(--ink-primary)]">Operational Audit Access:</strong> Authorized administrators can inspect high-level telemetry and submitted URLs to maintain uptime and block abuse.
            </li>
          </ul>

          <p className="pt-2 border-t border-[var(--border-subtle)] text-[11px] font-mono text-[var(--ink-muted)] flex items-center gap-3">
            <a className="text-[var(--brand-primary)] underline hover:text-[var(--brand-secondary)] inline-flex items-center gap-1" href="/privacy">
              <span>Privacy notice</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>·</span>
            <a className="text-[var(--brand-primary)] underline hover:text-[var(--brand-secondary)] inline-flex items-center gap-1" href="/terms">
              <span>Terms of service</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </section>

      {/* 5. Danger Zone / Account Deletion */}
      <section className="space-y-4" aria-labelledby="danger-heading">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          <Shield className="w-4 h-4 text-[var(--status-risk-text)]" />
          <h2 id="danger-heading" className="text-sm font-bold uppercase tracking-wider text-[var(--status-risk-text)] font-mono">
            Danger Zone
          </h2>
        </div>

        <div className="rounded-2xl border border-[var(--status-risk-border)] bg-[var(--surface-0)] p-5 sm:p-6 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink-primary)]">Delete your account</h3>
            <p className="text-xs text-[var(--ink-secondary)] leading-relaxed mt-0.5">
              Permanently purges your student profile, authentication identity, and every saved inspection report. This operation is immediate and irreversible.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] px-4 py-2 text-xs font-semibold text-[var(--status-risk-text)] hover:bg-rose-100 transition-colors shadow-2xs"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Delete my account</span>
          </button>
        </div>
      </section>

      {/* Deletion Confirmation Modal */}
      <ConfirmDialog
        open={confirmingDelete}
        title="Permanently delete your account?"
        description="This will permanently delete your authentication identity and all saved inspection reports from Firestore. You will be signed out immediately. This cannot be undone."
        confirmLabel="Yes, delete everything"
        cancelLabel="Cancel"
        isDestructive={true}
        busy={busy}
        onConfirm={deleteAccount}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
