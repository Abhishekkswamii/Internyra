"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  FileText,
} from "lucide-react";
import { useApi, type Inspection } from "@/lib/inspections-client";
import { useAuth } from "@/lib/firebase/auth-context";
import { resendVerification } from "@/lib/firebase/client";
import { formatDate } from "@/components/report/meta";
import { AppPageHeader } from "@/components/ui/AppPageHeader";
import { DashboardMetricCard } from "@/components/ui/DashboardMetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricTilesSkeleton } from "@/components/ui/LoadingSkeleton";

function titleOf(i: Inspection): string {
  const s = i.submission;
  if (s.claimedCompany) return s.claimedCompany;
  if (s.url) {
    try {
      return new URL(s.url).hostname;
    } catch {
      return s.url;
    }
  }
  return `Pasted message (${s.textLength ?? 0} characters)`;
}

function subtitleOf(i: Inspection): string {
  const s = i.submission;
  if (s.claimedRole) return s.claimedRole;
  if (s.url) return s.url;
  return `Text analysis · ${s.textLength ?? 0} characters`;
}

function DashboardContent() {
  const filter = useSearchParams().get("search")?.toLowerCase() ?? "";
  const api = useApi();
  const { user } = useAuth();
  const [items, setItems] = useState<Inspection[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const needsVerification = Boolean(
    user && !user.emailVerified && user.providerData.some((p) => p.providerId === "password")
  );

  const fetchPage = useCallback(
    (after: string | null) =>
      api<{ inspections: Inspection[]; nextCursor: string | null }>(
        `/api/inspections?limit=20${after ? `&cursor=${encodeURIComponent(after)}` : ""}`
      ),
    [api]
  );

  const apply = useCallback(
    (r: Awaited<ReturnType<typeof fetchPage>>, append: boolean) => {
      if (!r.ok) {
        setError(r.message);
        setState("error");
        return;
      }
      setItems((prev) => (append ? [...prev, ...r.data.inspections] : r.data.inspections));
      setCursor(r.data.nextCursor);
      setState("ready");
    },
    []
  );

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchPage(null).then((r) => alive && apply(r, false));
    return () => {
      alive = false;
    };
  }, [user, fetchPage, apply]);

  const shown = filter
    ? items.filter((i) => `${titleOf(i)} ${i.submission.url ?? ""}`.toLowerCase().includes(filter))
    : items;

  const count = (f: (i: Inspection) => boolean) => items.filter(f).length;
  const attention = count(
    (i) =>
      i.research?.status === "suspicious_indicators_found" ||
      i.research?.status === "needs_caution"
  );
  const completed = count((i) => i.status === "completed");
  const inProgress = count((i) => i.status === "queued" || i.status === "running");

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Workspace Header */}
      <AppPageHeader
        title="Your workspace"
        eyebrow="Student Verification Console"
        description="Track your internship checks, review findings from verified sources, and manage your private reports."
        actions={
          <Link
            href="/app/verify"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink-primary)] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--brand-primary)] transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New inspection</span>
          </Link>
        }
      />

      {/* Verification notice if email not verified */}
      {needsVerification && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900"
          data-testid="verify-banner"
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              {verifyMsg ??
                "Please verify your email address. We sent a link to your inbox when you signed up."}
            </span>
          </div>
          <button
            type="button"
            onClick={async () =>
              setVerifyMsg(
                (await resendVerification())
                  ? "Verification email sent. Check your inbox."
                  : "Couldn't send the email right now. Try again later."
              )
            }
            className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 transition-colors"
          >
            Resend email
          </button>
        </div>
      )}

      {state === "error" && (
        <p
          role="alert"
          className="rounded-2xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-4 text-sm text-[var(--status-risk-text)]"
        >
          {error}
        </p>
      )}

      {/* Genuine Firestore Metric Tiles */}
      {state === "loading" ? (
        <MetricTilesSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <DashboardMetricCard
            label="Total inspections"
            value={items.length}
            sublabel={cursor ? "Loaded page" : "Total saved"}
            icon={ShieldCheck}
            variant="neutral"
            testId="tile-inspections"
          />
          <DashboardMetricCard
            label="Completed"
            value={completed}
            sublabel="Analyses finished"
            icon={CheckCircle2}
            variant="safe"
            testId="tile-completed"
          />
          <DashboardMetricCard
            label="Needs attention"
            value={attention}
            sublabel="Cautions or flags"
            icon={AlertTriangle}
            variant={attention > 0 ? "caution" : "neutral"}
            testId="tile-need-attention"
          />
          <DashboardMetricCard
            label="In progress"
            value={inProgress}
            sublabel="Queued or running"
            icon={RotateCw}
            variant={inProgress > 0 ? "brand" : "neutral"}
            testId="tile-in-progress"
          />
        </div>
      )}

      {/* Recent Inspections List / Table */}
      <section aria-labelledby="history-title" className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
          <div className="flex items-center gap-2">
            <h2 id="history-title" className="text-sm sm:text-base font-bold text-[var(--ink-primary)]">
              Recent inspections
            </h2>
            {filter && (
              <span className="text-xs font-mono text-[var(--ink-muted)]">
                matching &ldquo;{filter}&rdquo;
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-[var(--ink-muted)]">
            {shown.length} {shown.length === 1 ? "record" : "records"}
          </span>
        </div>

        {state === "loading" ? (
          <div className="space-y-3 animate-pulse" aria-busy="true">
            <div className="h-20 rounded-2xl bg-[var(--surface-2)]" />
            <div className="h-20 rounded-2xl bg-[var(--surface-2)]" />
          </div>
        ) : shown.length === 0 && state === "ready" ? (
          <EmptyState
            title={filter ? "No inspections match your search" : "No inspections yet"}
            description={
              filter
                ? "Try a different search term or clear your search."
                : "Submit an internship link or recruiter message to run verification. Your report will appear here."
            }
            actionHref="/app/verify"
            actionLabel="Start your first check"
            testId="empty-state"
          />
        ) : (
          <div className="space-y-3">
            {shown.map((i) => {
              const displayTitle = titleOf(i);
              const displaySub = subtitleOf(i);
              return (
                <Link
                  key={i.id}
                  href={`/app/reports/${encodeURIComponent(i.id)}`}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-4 sm:p-5 shadow-xs transition-all hover:bg-[var(--surface-1)] hover:shadow-sm hover:border-[var(--brand-primary)]/30"
                  data-testid="inspection-row"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="grid place-items-center w-7 h-7 rounded-lg bg-[var(--surface-2)] text-[var(--ink-secondary)] group-hover:bg-[var(--surface-accent)] group-hover:text-[var(--brand-primary)] transition-colors shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                      <p className="truncate text-sm sm:text-base font-bold text-[var(--ink-primary)]">
                        {displayTitle}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--ink-muted)] font-mono pl-9 truncate">
                      {i.inputType === "link" ? "URL Target" : "Recruiter Message"} · {formatDate(i.createdAt)} · {displaySub}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-9 sm:pl-0 shrink-0">
                    <StatusBadge
                      researchStatus={i.research?.status}
                      inspectionStatus={i.status}
                    />
                    <ChevronRight className="w-4 h-4 text-[var(--ink-muted)] group-hover:text-[var(--brand-primary)] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {cursor && (
          <div className="pt-2">
            <button
              type="button"
              disabled={more}
              onClick={async () => {
                setMore(true);
                apply(await fetchPage(cursor), true);
                setMore(false);
              }}
              className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] px-4 py-2 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-1)] disabled:opacity-50 transition-colors"
            >
              {more ? "Loading more records…" : "Load more inspections"}
            </button>
          </div>
        )}
      </section>

      {/* Supporting Section: Verification Guidelines & Safety Protocol */}
      <section className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border-subtle)]">
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-[var(--ink-primary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
            <span>Inspection Guidance</span>
          </div>
          <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
            Checks verify corporate domains, recruiter corroboration, and fee requests against public registries. Never share banking credentials, OTPs, or pay advance training fees.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-[var(--ink-primary)]">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Privacy Guarantee</span>
          </div>
          <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
            Submitted messages are analyzed locally and discarded after processing. Only necessary domain and risk evidence are retained in your private account.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-2)]" />}>
      <DashboardContent />
    </Suspense>
  );
}
