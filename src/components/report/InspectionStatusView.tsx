"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, ChevronLeft, Clock, Loader2, PauseCircle, Play, RotateCw, Trash2 } from "lucide-react";
import type { Inspection } from "@/lib/inspections-client";
import { formatDateTime } from "./meta";

interface Props {
  inspection: Inspection;
  /** null while the server status has not been read yet. */
  aiEnabled: boolean | null;
  starting: boolean;
  runError: string | null;
  onStart: () => void;
  onDelete: () => void;
}

/** True states from the server only: no timers or percentages imply progress that is not happening. */
export function InspectionStatusView({ inspection, aiEnabled, starting, runError, onStart, onDelete }: Props) {
  const s = inspection.submission;
  const target = s.url ?? `Pasted message (${s.textLength ?? 0} characters)`;
  const running = inspection.status === "running" || starting;

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-10" data-testid="inspection-status" data-status={running ? "running" : inspection.status}>
      <Link href="/app" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-secondary)] hover:text-[var(--brand-primary)]">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span>Dashboard</span>
      </Link>

      <div className="space-y-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-6 shadow-sm">
        <p className="break-all text-xs text-[var(--ink-muted)]" title={target}>{target}</p>

        {running ? (
          <div role="status" className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[var(--brand-primary)]" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-[var(--ink-primary)]">Running</h1>
              <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                The inspection is being processed on the server. This can take up to a couple of minutes. You can leave this page; the result will be here when you come back.
              </p>
              {inspection.startedAt && <p className="mt-1 text-xs text-[var(--ink-muted)]">Started {formatDateTime(inspection.startedAt)}</p>}
            </div>
          </div>
        ) : inspection.status === "failed" ? (
          <div role="alert" className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-risk-text)]" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-[var(--ink-primary)]">The inspection did not complete</h1>
              <p className="mt-1 text-sm text-[var(--ink-secondary)]">{inspection.error?.message ?? "Something went wrong."}</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">Nothing was saved as a finding.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            {aiEnabled === false ? <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" /> : <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />}
            <div>
              <h1 className="text-lg font-bold text-[var(--ink-primary)]">{aiEnabled === false ? "Saved and queued" : "Queued"}</h1>
              <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                {aiEnabled === false
                  ? "Your inspection is saved to your account. AI research is currently paused by the administrator, so it has not run yet. It will stay queued."
                  : "Your inspection is saved to your account and is waiting to be started."}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">Saved {formatDateTime(inspection.createdAt)}</p>
            </div>
          </div>
        )}

        {runError && <p role="alert" className="rounded-lg border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]">{runError}</p>}

        <div className="flex flex-wrap items-center gap-2">
        {!running && (inspection.status === "queued" || inspection.status === "failed") && (
          <button
            type="button"
            onClick={onStart}
            disabled={aiEnabled === false}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inspection.status === "failed" ? <RotateCw className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            <span>{inspection.status === "failed" ? "Try again" : "Start inspection"}</span>
          </button>
        )}
        {!running && (
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-light)] px-3 py-2 text-sm font-semibold text-[var(--ink-secondary)] transition-colors hover:bg-[var(--status-risk-bg)] hover:text-[var(--status-risk-text)]">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Delete</span>
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
