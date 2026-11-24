"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Users,
  FileSearch,
  Cpu,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import { useApi, type Inspection } from "@/lib/inspections-client";
import { formatDateTime } from "@/components/report/meta";
import { AppPageHeader } from "@/components/ui/AppPageHeader";
import { DashboardMetricCard } from "@/components/ui/DashboardMetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminHealthIndicator } from "@/components/ui/AdminHealthIndicator";
import { MobileDataCard } from "@/components/ui/MobileDataCard";
import { MetricTilesSkeleton } from "@/components/ui/LoadingSkeleton";

type View = "overview" | "users" | "inspections" | "ai" | "health" | "usage";

interface Overview {
  counts: {
    users: number;
    inspections: number;
    byStatus: Record<string, number>;
  };
  usage: {
    cache: Record<string, number>;
    providers: Record<string, number>;
    fallbacks: number;
    rateLimited: number;
  };
  redisConfigured: boolean;
  redisReachable: boolean;
  ai: {
    enabled: boolean;
    geminiConfigured: boolean;
    openaiConfigured: boolean;
    webSearchEnabled: boolean;
    strategy: string;
  };
}

interface UserRow {
  uid: string;
  email?: string;
  provider?: string;
  createdAt: string;
  lastSeenAt?: string;
}

interface UsageRow {
  id: string;
  type: string;
  provider?: string;
  model?: string;
  cacheEvent?: string;
  fallback?: boolean;
  webSearchUsed?: boolean;
  success?: boolean;
  code?: string;
  timestamp: string;
}

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: (string | number | React.ReactNode)[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-light)] bg-[var(--surface-0)] p-8 text-center text-xs sm:text-sm text-[var(--ink-secondary)]">
        {empty}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] shadow-xs">
      <table className="w-full min-w-[580px] text-left text-xs border-collapse">
        <thead className="border-b border-[var(--border-light)] bg-[var(--surface-1)]">
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-3 font-mono font-semibold uppercase tracking-wider text-[11px] text-[var(--ink-muted)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-[var(--surface-1)]/60 transition-colors">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-3 text-[var(--ink-primary)] align-middle text-xs">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
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
  const [searchFilter, setSearchFilter] = useState("");

  const fetchView = useCallback(
    (v: View, cursor?: string | null) => {
      // Map view to backend endpoint param
      const backendParam = v === "ai" || v === "health" ? "overview" : v;
      return api<unknown>(
        `/api/admin/data?view=${backendParam}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        { forceToken: true }
      );
    },
    [api]
  );

  const apply = useCallback((v: View, r: Awaited<ReturnType<typeof fetchView>>, append: boolean) => {
    if (!r.ok) {
      setError(r.message);
      setState("error");
      return;
    }
    const merge = <T,>(prev: Page<T>, next: Page<T>): Page<T> => ({
      items: append ? [...prev.items, ...next.items] : next.items,
      nextCursor: next.nextCursor,
    });
    if (v === "overview" || v === "ai" || v === "health") {
      setOverview(r.data as Overview);
    } else if (v === "users") {
      setUsers((p) => merge(p, r.data as Page<UserRow>));
    } else if (v === "inspections") {
      setInsp((p) => merge(p, r.data as Page<Inspection>));
    } else if (v === "usage") {
      setUsage((p) => merge(p, r.data as Page<UsageRow>));
    }
    setState("ready");
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    void fetchView(view).then((r) => alive && apply(view, r, false));
    return () => {
      alive = false;
    };
  }, [isAdmin, view, fetchView, apply]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-[var(--surface-2)] rounded-2xl" />
        <MetricTilesSkeleton />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center animate-fade-in">
        <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-[var(--status-risk-bg)] border border-[var(--status-risk-border)] text-[var(--status-risk-text)]">
          <ShieldAlert className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-[var(--ink-primary)]">Administrator access required</h1>
          <p className="text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed">
            This area requires verified custom-claim administrator privileges.
          </p>
        </div>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary)] transition-colors"
        >
          <span>Return to workspace</span>
        </Link>
      </div>
    );
  }

  const tabs: [View, string][] = [
    ["overview", "Overview"],
    ["users", "Students"],
    ["inspections", "Inspections"],
    ["ai", "AI & Providers"],
    ["health", "System Health"],
    ["usage", "Usage events"],
  ];

  const moreButton = (page: Page<unknown>) =>
    page.nextCursor && (
      <button
        type="button"
        onClick={async () => {
          setState("loading");
          apply(view, await fetchView(view, page.nextCursor), true);
        }}
        disabled={state === "loading"}
        className="mt-4 rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] px-4 py-2 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-1)] disabled:opacity-50 transition-colors"
      >
        Load more records
      </button>
    );

  // Search filtered items
  const filteredUsers = searchFilter
    ? users.items.filter((u) => (u.email ?? "").toLowerCase().includes(searchFilter.toLowerCase()))
    : users.items;

  const filteredInspections = searchFilter
    ? insp.items.filter((i) =>
        `${i.id} ${i.submission.url ?? ""} ${i.submission.claimedCompany ?? ""}`
          .toLowerCase()
          .includes(searchFilter.toLowerCase())
      )
    : insp.items;

  const totalCompleted = overview?.counts.byStatus.completed ?? 0;
  const totalFailed = overview?.counts.byStatus.failed ?? 0;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Console Header */}
      <AppPageHeader
        title="Operations overview"
        eyebrow="Staff Intelligence Console"
        description="Monitor student activity, internship inspections and research infrastructure. Pasted message text is cryptographically purged and not stored here."
      />

      {/* Primary Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Admin views"
        className="flex gap-2 overflow-x-auto border-b border-[var(--border-light)] pb-px -mx-2 px-2 scrollbar-none"
      >
        {tabs.map(([v, name]) => {
          const isActive = view === v;
          return (
            <button
              key={v}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setState("loading");
                setView(v);
                setSearchFilter("");
              }}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-all -mb-px ${
                isActive
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      {state === "error" && (
        <div
          role="alert"
          className="rounded-2xl border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-4 text-xs sm:text-sm text-[var(--status-risk-text)]"
        >
          {error}
        </div>
      )}

      {/* VIEW 1: OVERVIEW */}
      {view === "overview" && overview && (
        <div className="space-y-8" data-testid="admin-overview">
          {/* Real Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <DashboardMetricCard
              label="Registered students"
              value={overview.counts.users}
              sublabel="Active Firebase accounts"
              icon={Users}
              variant="neutral"
            />
            <DashboardMetricCard
              label="Total inspections"
              value={overview.counts.inspections}
              sublabel="Firestore records"
              icon={FileSearch}
              variant="brand"
            />
            <DashboardMetricCard
              label="Completed reports"
              value={totalCompleted}
              sublabel="Finished inspections"
              icon={CheckCircle2}
              variant="safe"
            />
            <DashboardMetricCard
              label="Failed / Cautions"
              value={totalFailed}
              sublabel="Terminated / Uncorroborated"
              icon={AlertTriangle}
              variant={totalFailed > 0 ? "risk" : "neutral"}
            />
          </div>

          {/* Infrastructure Health Summary Grid */}
          <section className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">
              Infrastructure Status
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AdminHealthIndicator
                name="Cloud Firestore"
                status="healthy"
                statusLabel="ONLINE"
                detail="asia-southeast1 · Document DB"
                lastChecked="Continuous"
              />
              <AdminHealthIndicator
                name="Upstash Redis Cache"
                status={overview.redisConfigured ? (overview.redisReachable ? "healthy" : "down") : "disabled"}
                statusLabel={overview.redisConfigured ? (overview.redisReachable ? "CONNECTED" : "UNREACHABLE") : "NOT CONFIGURED"}
                detail={overview.redisConfigured ? "24-hour result dedup" : "Running cacheless"}
              />
              <AdminHealthIndicator
                name="AI Inspection Switch"
                status={overview.ai.enabled ? "healthy" : "disabled"}
                statusLabel={overview.ai.enabled ? "ACTIVE" : "PAUSED"}
                detail={overview.ai.enabled ? "Provider calls enabled" : "Kill switch engaged"}
              />
            </div>
          </section>

          {/* Telemetry Tables */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">
                Recorded Telemetry Events
              </h3>
              <Table
                head={["Telemetry metric", "Count (recorded events)"]}
                empty="No events recorded"
                rows={[
                  ["Gemini analyses", overview.usage.providers.gemini ?? 0],
                  ["OpenAI analyses", overview.usage.providers.openai ?? 0],
                  ["Fallback executions", overview.usage.fallbacks],
                  ["Rate-limit encounters", overview.usage.rateLimited],
                  ["Cache hits", overview.usage.cache.hit ?? 0],
                  ["Cache misses", overview.usage.cache.miss ?? 0],
                  ["Cache refreshes", overview.usage.cache.refresh ?? 0],
                  ["Cache errors", overview.usage.cache.error ?? 0],
                ]}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">
                Provider Configuration
              </h3>
              <Table
                head={["Service attribute", "Status"]}
                empty="No configuration data"
                rows={[
                  ["AI engine status", overview.ai.enabled ? "Active / enabled" : "Disabled (kill switch off or no key)"],
                  ["Gemini (Primary)", overview.ai.geminiConfigured ? "Key installed" : "Pending: not configured"],
                  ["OpenAI (Fallback)", overview.ai.openaiConfigured ? "Key installed" : "Not configured"],
                  ["Provider mode", overview.ai.strategy.replace(/_/g, " ")],
                  ["Live web search", overview.ai.webSearchEnabled ? "Enabled" : "Disabled"],
                  ["Redis caching", overview.redisConfigured ? (overview.redisReachable ? "Online & reachable" : "Configured but unreachable") : "Not configured"],
                ]}
              />
            </div>
          </div>

          <p className="text-xs font-mono text-[var(--ink-muted)]">
            Counts come only from events recorded by the app. Configured means a secret or key exists, not that it has passed a live test.
          </p>
        </div>
      )}

      {/* VIEW 2: STUDENTS */}
      {view === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter students by email…"
                className="w-full bg-[var(--surface-0)] border border-[var(--border-light)] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-[var(--ink-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <span className="text-xs font-mono text-[var(--ink-muted)]">
              {filteredUsers.length} student account(s)
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table
              head={["Student email", "Provider", "Registration date", "Last activity"]}
              empty="No student accounts registered yet."
              rows={filteredUsers.map((u) => [
                u.email ?? "(anonymous visitor identity)",
                <span key="prov" className="bg-[var(--surface-2)] px-2 py-0.5 rounded text-[11px] font-mono">
                  {u.provider ?? "firebase"}
                </span>,
                formatDateTime(u.createdAt),
                u.lastSeenAt ? formatDateTime(u.lastSeenAt) : "—",
              ])}
            />
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredUsers.length === 0 ? (
              <p className="p-8 text-center text-xs font-mono text-[var(--ink-muted)] border border-dashed rounded-2xl">
                No students found.
              </p>
            ) : (
              filteredUsers.map((u) => (
                <MobileDataCard
                  key={u.uid}
                  title={u.email ?? "(anonymous visitor)"}
                  subtitle={`UID: ${u.uid.slice(0, 16)}…`}
                  tag={<span className="text-[10px] font-mono px-2 py-0.5 bg-[var(--surface-2)] rounded">{u.provider ?? "email"}</span>}
                  metadata={[
                    { label: "Registered", value: formatDateTime(u.createdAt) },
                    { label: "Last Seen", value: u.lastSeenAt ? formatDateTime(u.lastSeenAt) : "—" },
                  ]}
                />
              ))
            )}
          </div>

          {moreButton(users)}
        </div>
      )}

      {/* VIEW 3: INSPECTIONS */}
      {view === "inspections" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by target or ID…"
                className="w-full bg-[var(--surface-0)] border border-[var(--border-light)] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-[var(--ink-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <span className="text-xs font-mono text-[var(--ink-muted)]">
              {filteredInspections.length} recorded inspection(s)
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table
              head={["Timestamp", "Type", "Target", "Status", "Finding", "Engine", "Actions"]}
              empty="No inspections have been recorded yet."
              rows={filteredInspections.map((i) => [
                formatDateTime(i.createdAt),
                <span key="type" className="uppercase font-mono text-[10px] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
                  {i.inputType}
                </span>,
                <span key="targ" className="truncate max-w-[200px] block" title={i.submission.url ?? "Pasted message"}>
                  {i.submission.url ?? `Message (${i.submission.textLength ?? 0} chars)`}
                </span>,
                <StatusBadge key="st" inspectionStatus={i.status} size="sm" />,
                i.research?.status ? (
                  <StatusBadge key="rs" researchStatus={i.research.status} size="sm" />
                ) : (
                  "—"
                ),
                <span key="prov" className="text-[11px] font-mono text-[var(--ink-muted)]">
                  {i.provider ? `${i.provider}${i.fallbackOccurred ? " (fallback)" : ""}` : "local"}
                </span>,
                <Link
                  key="act"
                  href={`/app/reports/${encodeURIComponent(i.id)}`}
                  className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline font-bold text-xs"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>,
              ])}
            />
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredInspections.length === 0 ? (
              <p className="p-8 text-center text-xs font-mono text-[var(--ink-muted)] border border-dashed rounded-2xl">
                No inspections found.
              </p>
            ) : (
              filteredInspections.map((i) => (
                <MobileDataCard
                  key={i.id}
                  title={i.submission.url ?? `Message (${i.submission.textLength ?? 0} chars)`}
                  subtitle={i.submission.claimedCompany ?? i.id}
                  href={`/app/reports/${encodeURIComponent(i.id)}`}
                  tag={<StatusBadge inspectionStatus={i.status} size="sm" />}
                  metadata={[
                    { label: "Date", value: formatDateTime(i.createdAt) },
                    { label: "Finding", value: i.research?.status ? i.research.status.replace(/_/g, " ") : "Pending" },
                  ]}
                />
              ))
            )}
          </div>

          {moreButton(insp)}
        </div>
      )}

      {/* VIEW 4: AI & PROVIDERS */}
      {view === "ai" && overview && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-6 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--brand-primary)]" />
                  <h3 className="text-sm font-bold text-[var(--ink-primary)]">Google Gemini (Primary)</h3>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    overview.ai.geminiConfigured
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  {overview.ai.geminiConfigured ? "CONFIGURED" : "PENDING"}
                </span>
              </div>
              <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                Preferred model: <code className="font-mono text-[11px] bg-[var(--surface-2)] px-1 py-0.5 rounded">gemini-3.8-flash</code>.
                Analyzes submitted text, corporate claims, and public disclosures with structured outputs.
              </p>
              <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] font-mono text-[var(--ink-muted)]">
                Processed requests: {overview.usage.providers.gemini ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-6 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-[var(--ink-primary)]">OpenAI (Fallback Engine)</h3>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    overview.ai.openaiConfigured
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  {overview.ai.openaiConfigured ? "CONFIGURED" : "NOT CONFIGURED"}
                </span>
              </div>
              <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                Preferred model: <code className="font-mono text-[11px] bg-[var(--surface-2)] px-1 py-0.5 rounded">gpt-6-luna</code>.
                Engaged automatically if primary provider encounters quota, rate limits, or transient 5xx errors.
              </p>
              <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] font-mono text-[var(--ink-muted)]">
                Processed requests: {overview.usage.providers.openai ?? 0} · Fallback events: {overview.usage.fallbacks}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: SYSTEM HEALTH */}
      {view === "health" && overview && (
        <div className="space-y-4">
          <div className="grid gap-3">
            <AdminHealthIndicator
              name="Google Cloud Firestore"
              status="healthy"
              statusLabel="HEALTHY"
              detail="asia-southeast1 · Active replication & document persistence"
              lastChecked="Live connection"
            />
            <AdminHealthIndicator
              name="Upstash Redis REST Cluster"
              status={overview.redisConfigured ? (overview.redisReachable ? "healthy" : "down") : "disabled"}
              statusLabel={overview.redisConfigured ? (overview.redisReachable ? "ONLINE" : "OFFLINE") : "DISABLED"}
              detail={overview.redisConfigured ? "Transient cache & rate limiting" : "No REST credentials in Secret Manager"}
            />
            <AdminHealthIndicator
              name="Google Cloud Run / App Hosting"
              status="healthy"
              statusLabel="SERVING"
              detail="Next.js 16 container instances · Autoscaling 0–2"
              lastChecked="Live deployment"
            />
            <AdminHealthIndicator
              name="Research Safety Kill Switch"
              status={overview.ai.enabled ? "healthy" : "disabled"}
              statusLabel={overview.ai.enabled ? "ENABLED" : "PAUSED"}
              detail="AI_INSPECTIONS_ENABLED in apphosting.yaml"
            />
          </div>
        </div>
      )}

      {/* VIEW 6: USAGE EVENTS */}
      {view === "usage" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">
              Recorded Operational Audit Log
            </h3>
            <span className="text-xs font-mono text-[var(--ink-muted)]">
              {usage.items.length} event(s)
            </span>
          </div>

          <Table
            head={["Timestamp", "Event type", "Provider / model", "Execution details"]}
            empty="No data yet"
            rows={usage.items.map((u) => [
              formatDateTime(u.timestamp),
              <span key="type" className="bg-[var(--surface-2)] px-2 py-0.5 rounded text-[11px] font-mono">
                {u.type}
              </span>,
              u.provider ? `${u.provider} / ${u.model ?? "?"}` : "—",
              [
                u.cacheEvent && `cache ${u.cacheEvent}`,
                u.fallback && "fallback used",
                u.webSearchUsed && "web search",
                u.success === false && `failed ${u.code ?? ""}`,
              ]
                .filter(Boolean)
                .join(", ") || "Normal execution",
            ])}
          />

          {moreButton(usage)}
        </div>
      )}
    </div>
  );
}
