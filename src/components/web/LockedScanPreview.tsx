"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { AuthForm } from "@/components/auth/AuthForm";
import { useApi, type Inspection } from "@/lib/inspections-client";
import { useAuth } from "@/lib/firebase/auth-context";
import type { AuthResult } from "@/lib/firebase/client";

/** The real sections an Internyra report contains. Headings only: nothing is shown before authentication. */
const SECTIONS = ["Company", "Internship", "Recruiter", "Risk indicators", "Evidence"] as const;

export function LockedScanPreview({ inspection, onReset }: { inspection: Inspection; onReset: () => void }) {
  const router = useRouter();
  const api = useApi();
  const { getIdToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const s = inspection.submission;
  const label = s.url ?? `Pasted message (${s.textLength ?? 0} characters)`;

  const claim = async (res: AuthResult) => {
    setError(null);
    setClaiming(true);
    await getIdToken(true); // refresh so the token reflects the permanent account
    const r = await api<{ inspection: Inspection }>("/api/inspections/claim", {
      method: "POST",
      body: { inspectionId: inspection.id },
      forceToken: true,
      headers: res.anonymousToken ? { "X-Anonymous-Token": res.anonymousToken } : undefined,
    });
    if (!r.ok) {
      setError(r.message);
      setClaiming(false);
      return;
    }
    router.push(`/app/reports/${encodeURIComponent(r.data.inspection.id)}?start=1`);
  };

  return (
    <section id="guest-preview" className="scroll-mt-24 border-b border-[var(--border-light)] bg-[var(--canvas)] py-12" aria-labelledby="locked-title">
      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <h2 id="locked-title" className="text-base font-semibold text-[var(--ink-primary)]">Your inspection is saved. Sign in to run it.</h2>
          <span className="max-w-md truncate rounded-md border border-[var(--border-light)] bg-[var(--surface-0)] px-3 py-1 text-xs text-[var(--ink-secondary)]" title={label}>{label}</span>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] shadow-sm" data-testid="locked-shell">
          <div className="grid select-none gap-4 p-6 opacity-50 blur-[3px] sm:grid-cols-2 sm:p-8" aria-hidden="true">
            {SECTIONS.map((name) => (
              <div key={name} className="space-y-2 rounded-xl border border-[var(--border-light)] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-primary)]">{name}</p>
                <div className="h-3 w-full rounded bg-[var(--surface-2)]" />
                <div className="h-3 w-2/3 rounded bg-[var(--surface-2)]" />
              </div>
            ))}
          </div>
          <ul className="sr-only">{SECTIONS.map((n) => <li key={n}>{n}: locked until you sign in</li>)}</ul>

          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto bg-[var(--canvas)]/90 p-5 backdrop-blur-sm sm:p-8">
            <div className="w-full max-w-sm space-y-4">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold text-[var(--ink-primary)]">Create a free account to unlock</h3>
                <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
                  Nothing has been analysed yet. After you sign in, Internyra researches the submission and saves the report to your private history.
                </p>
              </div>
              {error && <p role="alert" className="rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]">{error}</p>}
              {claiming ? <p className="text-center text-sm text-[var(--ink-secondary)]" role="status">Moving your inspection to your account…</p> : <AuthForm onSuccess={claim} onCancel={onReset} submitLabel={{ signup: "Create account and continue", login: "Sign in and continue" }} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
