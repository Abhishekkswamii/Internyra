"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, FileSearch, Plus } from "lucide-react";
import { useApi, type Inspection } from "@/lib/inspections-client";
import { useAuth } from "@/lib/firebase/auth-context";
import { resendVerification } from "@/lib/firebase/client";
import { STATUS_LABEL } from "@/lib/research/types";
import { formatDate } from "@/components/report/meta";

const STATE_LABEL: Record<Inspection["status"], string> = {
  pending_auth: "Waiting for sign-in",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

const RESEARCH_TONE: Record<string, string> = {
  no_major_red_flags_found: "bg-emerald-50 border-emerald-200 text-emerald-800",
  needs_caution: "bg-amber-50 border-amber-200 text-amber-800",
  suspicious_indicators_found: "bg-rose-50 border-rose-200 text-rose-700",
  insufficient_evidence: "bg-slate-50 border-slate-200 text-slate-700",
};

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
  const needsVerification = Boolean(user && !user.emailVerified && user.providerData.some((p) => p.providerId === "password"));

  const fetchPage = useCallback(
    (after: string | null) => api<{ inspections: Inspection[]; nextCursor: string | null }>(`/api/inspections?limit=20${after ? `&cursor=${encodeURIComponent(after)}` : ""}`),
    [api]
  );
  const apply = useCallback((r: Awaited<ReturnType<typeof fetchPage>>, append: boolean) => {
    if (!r.ok) {
      setError(r.message);
      setState("error");
      return;
    }
    setItems((prev) => (append ? [...prev, ...r.data.inspections] : r.data.inspections));
    setCursor(r.data.nextCursor);
    setState("ready");
  }, []);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchPage(null).then((r) => alive && apply(r, false));
    return () => {
      alive = false;
    };
  }, [user, fetchPage, apply]);

  const shown = filter ? items.filter((i) => `${titleOf(i)} ${i.submission.url ?? ""}`.toLowerCase().includes(filter)) : items;
  const count = (f: (i: Inspection) => boolean) => items.filter(f).length;
  const attention = count((i) => i.research?.status === "suspicious_indicators_found" || i.research?.status === "needs_caution");
  const tiles = [
    { label: "Inspections", value: items.length },
    { label: "Completed", value: count((i) => i.status === "completed") },
    { label: "Need attention", value: attention },
    { label: "In progress", value: count((i) => i.status === "queued" || i.status === "running") },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink-primary)] sm:text-3xl">Your inspections</h1>
          <p className="mt-0.5 text-sm text-[var(--ink-secondary)]">Every report is saved to your account and private to you.</p>
        </div>
        <Link href="/app/verify" className="inline-flex items-center gap-2 self-start rounded-lg bg-[var(--ink-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary)]">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New inspection</span>
        </Link>
      </div>

      {needsVerification && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="verify-banner">
          <span>{verifyMsg ?? "Please verify your email address. We sent a link to your inbox when you signed up."}</span>
          <button type="button" onClick={async () => setVerifyMsg((await resendVerification()) ? "Verification email sent. Check your inbox." : "Couldn't send the email right now. Try again later.")} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100">Resend email</button>
        </div>
      )}

      {state === "error" && (
        <p role="alert" className="rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-4 text-sm text-[var(--status-risk-text)]">{error}</p>
      )}

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-4 shadow-xs sm:p-5">
            <dd className="text-2xl font-extrabold tracking-tight text-[var(--ink-primary)] sm:text-3xl" data-testid={`tile-${t.label.toLowerCase().replace(/ /g, "-")}`}>{state === "loading" ? "–" : t.value}</dd>
            <dt className="mt-1 text-xs font-medium text-[var(--ink-muted)]">{t.label}{cursor ? " (loaded)" : ""}</dt>
          </div>
        ))}
      </dl>

      <section aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="text-sm font-semibold text-[var(--ink-primary)]">History{filter ? ` matching “${filter}”` : ""}</h2>
        {state === "loading" ? (
          <div className="space-y-3 animate-pulse" aria-busy="true"><div className="h-16 rounded-xl bg-[var(--surface-2)]" /><div className="h-16 rounded-xl bg-[var(--surface-2)]" /></div>
        ) : shown.length === 0 && state === "ready" ? (
          <div className="rounded-xl border border-dashed border-[var(--border-light)] bg-[var(--surface-0)] p-10 text-center" data-testid="empty-state">
            <FileSearch className="mx-auto h-8 w-8 text-[var(--ink-muted)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[var(--ink-primary)]">{filter ? "No inspections match your search" : "No inspections yet"}</p>
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">{filter ? "Try a different company or link." : "Check an internship link or a recruiter message and the report will appear here."}</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {shown.map((i) => (
              <li key={i.id}>
                <Link href={`/app/reports/${encodeURIComponent(i.id)}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-4 shadow-xs transition-colors hover:bg-[var(--surface-1)]" data-testid="inspection-row">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--ink-primary)]">{titleOf(i)}</p>
                    <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{i.inputType === "link" ? "Link" : "Message"} · {formatDate(i.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {i.research ? (
                      <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${RESEARCH_TONE[i.research.status]}`}>{STATUS_LABEL[i.research.status]}</span>
                    ) : (
                      <span className="rounded border border-[var(--border-light)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-secondary)]">{STATE_LABEL[i.status]}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {cursor && (
          <button
            type="button"
            disabled={more}
            onClick={async () => { setMore(true); apply(await fetchPage(cursor), true); setMore(false); }}
            className="rounded-lg border border-[var(--border-light)] bg-[var(--surface-0)] px-4 py-2 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-1)] disabled:opacity-50"
          >
            {more ? "Loading…" : "Load more"}
          </button>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-[var(--surface-2)]" />}>
      <DashboardContent />
    </Suspense>
  );
}
