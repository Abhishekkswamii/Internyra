"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import { useApi, type Inspection } from "@/lib/inspections-client";
import { formatDateTime } from "@/components/report/meta";

type View = "overview" | "users" | "inspections" | "usage";
interface Overview { counts: { users: number; inspections: number; byStatus: Record<string, number> }; usage: { cache: Record<string, number>; providers: Record<string, number>; fallbacks: number; rateLimited: number }; redisConfigured: boolean }
interface UserRow { uid: string; email?: string; provider?: string; createdAt: string; lastSeenAt?: string }
interface UsageRow { id: string; type: string; provider?: string; model?: string; cacheEvent?: string; fallback?: boolean; webSearchUsed?: boolean; success?: boolean; code?: string; timestamp: string }
interface Page<T> { items: T[]; nextCursor: string | null }

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (rows.length === 0) return <p className="rounded-xl border border-dashed border-[var(--border-light)] p-8 text-center text-sm text-[var(--ink-secondary)]">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)]">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead className="border-b border-[var(--border-light)] bg-[var(--surface-1)]"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold text-[var(--ink-secondary)]">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">{r.map((c, j) => <td key={j} className="px-3 py-2 text-[var(--ink-primary)]">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const api = useApi();
  const [view, setView] = useState<View>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<Page<UserRow>>({ items: [], nextCursor: null });
  const [insp, setInsp] = useState<Page<Inspection>>({ items: [], nextCursor: null });
  const [usage, setUsage] = useState<Page<UsageRow>>({ items: [], nextCursor: null });
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  const fetchView = useCallback(
    (v: View, cursor?: string | null) => api<unknown>(`/api/admin/data?view=${v}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { forceToken: true }),
    [api]
  );
  const apply = useCallback((v: View, r: Awaited<ReturnType<typeof fetchView>>, append: boolean) => {
    if (!r.ok) { setError(r.message); setState("error"); return; }
    const merge = <T,>(prev: Page<T>, next: Page<T>): Page<T> => ({ items: append ? [...prev.items, ...next.items] : next.items, nextCursor: next.nextCursor });
    if (v === "overview") setOverview(r.data as Overview);
    if (v === "users") setUsers((p) => merge(p, r.data as Page<UserRow>));
    if (v === "inspections") setInsp((p) => merge(p, r.data as Page<Inspection>));
    if (v === "usage") setUsage((p) => merge(p, r.data as Page<UsageRow>));
    setState("ready");
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    void fetchView(view).then((r) => alive && apply(view, r, false));
    return () => { alive = false; };
  }, [isAdmin, view, fetchView, apply]);

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-2)]" />;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-2 py-16 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-[var(--ink-muted)]" aria-hidden="true" />
        <h1 className="text-lg font-bold text-[var(--ink-primary)]">Administrator access required</h1>
        <p className="text-sm text-[var(--ink-secondary)]">This area is not available for your account.</p>
      </div>
    );
  }

  const tabs: [View, string][] = [["overview", "Overview"], ["users", "Students"], ["inspections", "Inspections"], ["usage", "Usage events"]];
  const more = (page: Page<unknown>) => page.nextCursor && <button type="button" onClick={async () => { setState("loading"); apply(view, await fetchView(view, page.nextCursor), true); }} disabled={state === "loading"} className="mt-3 rounded-lg border border-[var(--border-light)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-1)] disabled:opacity-50">Load more</button>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink-primary)] sm:text-3xl">Administration</h1>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">Live data from Firestore and recorded usage events. Each view you open is written to the admin audit log. Pasted message text is not shown here.</p>
      </div>
      <div role="tablist" aria-label="Admin views" className="flex gap-1 overflow-x-auto border-b border-[var(--border-light)]">
        {tabs.map(([v, name]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => { setState("loading"); setView(v); }} className={`-mb-px shrink-0 border-b-2 px-4 pb-2.5 text-sm font-semibold ${view === v ? "border-[var(--brand-primary)] text-[var(--brand-primary)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"}`}>{name}</button>
        ))}
      </div>
      {state === "error" && <p role="alert" className="rounded-xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-4 text-sm text-[var(--status-risk-text)]">{error}</p>}

      {view === "overview" && overview && (
        <div className="space-y-6" data-testid="admin-overview">
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[["Students", overview.counts.users], ["Inspections", overview.counts.inspections], ["Completed", overview.counts.byStatus.completed ?? 0], ["Failed", overview.counts.byStatus.failed ?? 0]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-4"><dd className="text-2xl font-extrabold text-[var(--ink-primary)]">{v}</dd><dt className="text-xs text-[var(--ink-muted)]">{k}</dt></div>
            ))}
          </dl>
          <Table head={["Measure", "Count (recorded events)"]} empty="No data yet" rows={[
            ["Cache hits", overview.usage.cache.hit ?? 0], ["Cache misses", overview.usage.cache.miss ?? 0], ["Cache refreshes", overview.usage.cache.refresh ?? 0], ["Cache errors", overview.usage.cache.error ?? 0],
            ["Gemini analyses", overview.usage.providers.gemini ?? 0], ["OpenAI analyses", overview.usage.providers.openai ?? 0], ["Fallbacks used", overview.usage.fallbacks], ["Rate-limit events", overview.usage.rateLimited],
          ]} />
          <p className="text-xs text-[var(--ink-muted)]">Redis cache: {overview.redisConfigured ? "configured" : "not configured"}. Counts come only from events recorded by the app; they start at zero.</p>
        </div>
      )}
      {view === "users" && (<><Table head={["Email", "Type", "Created", "Last seen"]} empty="No data yet" rows={users.items.map((u) => [u.email ?? "(anonymous visitor)", u.provider ?? "-", formatDateTime(u.createdAt), u.lastSeenAt ? formatDateTime(u.lastSeenAt) : "-"])} />{more(users)}</>)}
      {view === "inspections" && (<><Table head={["Created", "Kind", "Target", "Status", "Result", "Provider", "Cache"]} empty="No data yet" rows={insp.items.map((i) => [formatDateTime(i.createdAt), i.inputType, i.submission.url ?? `message (${i.submission.textLength ?? 0} chars)`, i.status, i.research?.status.replace(/_/g, " ") ?? "-", i.provider ? `${i.provider}${i.fallbackOccurred ? " (fallback)" : ""}` : "-", i.fromCache ? "reused" : "-"])} />{more(insp)}</>)}
      {view === "usage" && (<><Table head={["Time", "Type", "Provider / model", "Detail"]} empty="No data yet" rows={usage.items.map((u) => [formatDateTime(u.timestamp), u.type, u.provider ? `${u.provider} / ${u.model ?? "?"}` : "-", [u.cacheEvent && `cache ${u.cacheEvent}`, u.fallback && "fallback", u.webSearchUsed && "web search", u.success === false && `failed ${u.code ?? ""}`].filter(Boolean).join(", ") || "-"])} />{more(usage)}</>)}
    </div>
  );
}
