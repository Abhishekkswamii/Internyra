"use client";

import React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  Clock,
  Loader2,
  PauseCircle,
  Play,
  RotateCw,
  Trash2,
} from "lucide-react";
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
export function InspectionStatusView({
  inspection,
  aiEnabled,
  starting,
  runError,
  onStart,
  onDelete,
}: Props) {
  const s = inspection.submission;
  const target = s.url ?? `Pasted message (${s.textLength ?? 0} characters)`;
  const running = inspection.status === "running" || starting;

  return (
    <div
      className="mx-auto max-w-2xl space-y-6 py-6 animate-fade-in"
      data-testid="inspection-status"
      data-status={running ? "running" : inspection.status}
    >
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--ink-secondary)] hover:text-[var(--brand-primary)] transition-colors"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span>Return to workspace</span>
      </Link>

      <div className="space-y-5 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-6 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3 text-xs font-mono">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Submission Target
          </span>
          <span className="truncate max-w-xs text-[var(--ink-secondary)]" title={target}>
            {target}
          </span>
        </div>

        {running ? (
          <div role="status" className="flex items-start gap-4">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--surface-accent)] text-[var(--brand-primary)] shrink-0">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-[var(--ink-primary)]">Running</h1>
              <p className="text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed">
                The inspection is being processed on the server. This can take up to a couple of minutes. You can safely leave this page; the result will be saved to your dashboard.
              </p>
              {inspection.startedAt && (
                <p className="text-xs font-mono text-[var(--ink-muted)] pt-1">
                  Started {formatDateTime(inspection.startedAt)}
                </p>
              )}
            </div>
          </div>
        ) : inspection.status === "failed" ? (
          <div role="alert" className="flex items-start gap-4">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--status-risk-bg)] border border-[var(--status-risk-border)] text-[var(--status-risk-text)] shrink-0">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-[var(--ink-primary)]">The inspection did not complete</h1>
              <p className="text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed">
                {inspection.error?.message ?? "Something went wrong during analysis."}
              </p>
              <p className="text-xs font-mono text-[var(--ink-muted)] pt-1">
                No uncorroborated claim was saved as a finding.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div
              className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${
                aiEnabled === false
                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                  : "bg-[var(--surface-accent)] text-[var(--brand-primary)] border border-[#b0c0ff]"
              }`}
            >
              {aiEnabled === false ? (
                <PauseCircle className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Clock className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-[var(--ink-primary)]">
                {aiEnabled === false ? "Saved and queued" : "Queued"}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed">
                {aiEnabled === false
                  ? "Your inspection is saved to your account. AI research is currently paused by the administrator, so it has not run yet. It will stay queued."
                  : "Your inspection is saved to your account and is waiting to be started."}
              </p>
              <p className="text-xs font-mono text-[var(--ink-muted)] pt-1">
                Saved {formatDateTime(inspection.createdAt)}
              </p>
            </div>
          </div>
        )}

        {runError && (
          <p
            role="alert"
            className="rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]"
          >
            {runError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[var(--border-subtle)]">
          {!running && (inspection.status === "queued" || inspection.status === "failed") && (
            <button
              type="button"
              onClick={onStart}
              disabled={aiEnabled === false}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink-primary)] px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
            >
              {inspection.status === "failed" ? (
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{inspection.status === "failed" ? "Try again" : "Start inspection"}</span>
            </button>
          )}
          {!running && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-secondary)] transition-colors hover:bg-[var(--status-risk-bg)] hover:text-[var(--status-risk-text)] hover:border-[var(--status-risk-border)]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Delete record</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
