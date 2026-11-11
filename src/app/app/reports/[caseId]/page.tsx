"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Trash2,
  ChevronLeft,
  Calendar,
  Globe,
  Info,
  RotateCw,
  FileSearch,
} from "lucide-react";
import type { CheckStatus, Evidence, Finding, VerificationReport } from "@/types/verification";
import { useAiStatus, useApi, useInspection, type Inspection } from "@/lib/inspections-client";
import { useAuth } from "@/lib/firebase/auth-context";
import { ResearchPanel } from "@/components/report/ResearchPanel";
import { InspectionStatusView } from "@/components/report/InspectionStatusView";
import {
  ASSESSMENT_META,
  CHECK_STATUS_META,
  CONFIDENCE_LABEL,
  LIFECYCLE_LABEL,
  PROVENANCE_LABEL,
  SEVERITY_META,
  caseTitle,
  formatDateTime,
} from "@/components/report/meta";

type Tab = "overview" | "findings" | "evidence" | "checks" | "limitations";

/** Inspection IDs are minted by the server as `insp_<uuid>`. */
const ID_PATTERN = /^insp_[A-Za-z0-9-]{8,64}$/;

function NotFound({ invalid }: { invalid: boolean }) {
  return (
    <div className="py-20 text-center space-y-4" data-testid="report-not-found">
      <h2 className="text-xl font-bold text-[var(--ink-primary)]">{invalid ? "This report link isn't valid" : "Report not found"}</h2>
      <p className="text-xs sm:text-sm text-[var(--ink-secondary)] max-w-md mx-auto">
        {invalid
          ? "The address doesn't contain a valid report ID. Check that the whole link was copied."
          : "There is no report with this ID in your account. It may have been deleted, or it belongs to a different account."}
      </p>
      <Link
        href="/app"
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary)]"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to dashboard</span>
      </Link>
    </div>
  );
}

function exportCase(c: unknown, id: string) {
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `internyra-${id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function FindingCard({ finding, onEvidence }: { finding: Finding; onEvidence: (id: string) => void }) {
  const sev = SEVERITY_META[finding.severity];
  const Icon = sev.icon;
  return (
    <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-4 sm:p-5 space-y-3 shadow-xs" data-testid="finding-card">
      <div className="flex items-start gap-2.5">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${sev.iconColor}`} />
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-[var(--ink-primary)] break-words">{finding.title}</h4>
          <span className="font-mono text-[10px] uppercase font-bold text-[var(--ink-muted)]">
            {sev.label} · {finding.ruleId}
          </span>
        </div>
      </div>
      <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">{finding.explanation}</p>
      {finding.evidenceIds.length > 0 && (
        <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap gap-1.5 text-[11px]">
          <span className="text-[var(--ink-muted)] font-mono">Evidence:</span>
          {finding.evidenceIds.map((id) => (
            <button key={id} type="button" onClick={() => onEvidence(id)} className="font-mono font-bold text-[var(--brand-primary)] hover:underline">
              {id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();
  const { user, loading: authLoading } = useAuth();
  const aiEnabled = useAiStatus();
  const rawId = typeof params?.caseId === "string" ? params.caseId : "";
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    id = "";
  }
  const validId = ID_PATTERN.test(id);
  const wantsStart = searchParams.get("start") === "1";

  const { state, reload, setState } = useInspection(validId ? id : undefined);
  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [focusEvidence, setFocusEvidence] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const start = useCallback(
    async (refresh = false) => {
      setRunError(null);
      setStarting(true);
      const r = await api<{ inspection: Inspection }>(`/api/inspections/${encodeURIComponent(id)}/run`, { method: "POST", body: { refresh }, forceToken: true });
      setStarting(false);
      if (r.ok) setState({ status: "ready", data: r.data.inspection });
      else {
        // 409 means another request is already processing it: just follow the server state.
        if (r.code !== "ALREADY_RUNNING") setRunError(r.message);
        void reload();
      }
    },
    [api, id, reload, setState]
  );

  // Arriving from sign-up / submission: start once, only if the record is queued and AI is on.
  useEffect(() => {
    if (!wantsStart || autoStarted.current || aiEnabled !== true || state.status !== "ready" || state.data.status !== "queued") return;
    autoStarted.current = true;
    void start(false);
  }, [wantsStart, aiEnabled, state, start]);

  useEffect(() => {
    if (activeTab === "evidence" && focusEvidence) {
      const el = document.getElementById(`evidence-${focusEvidence}`);
      el?.scrollIntoView({ block: "center" });
      el?.focus();
    }
  }, [activeTab, focusEvidence]);

  if (!validId) return <NotFound invalid />;

  if (authLoading || state.status === "loading") {
    return (
      <div className="max-w-5xl mx-auto py-12 animate-pulse space-y-6">
        <div className="h-28 bg-[var(--surface-2)] rounded-xl" />
        <div className="h-44 bg-[var(--surface-2)] rounded-xl" />
      </div>
    );
  }
  if (!user) return <NotFound invalid={false} />;
  if (state.status === "error") {
    if (state.code === "NOT_FOUND") return <NotFound invalid={false} />;
    return (
      <div className="py-12 max-w-xl mx-auto text-center space-y-3" role="alert">
        <p className="text-sm text-[var(--ink-secondary)]">{state.message}</p>
        <button type="button" onClick={() => void reload()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-light)] px-3 py-1.5 text-xs font-semibold"><RotateCw className="w-3.5 h-3.5" />Try again</button>
      </div>
    );
  }

  const inspection = state.data;
  const handleDelete = async () => {
    if (!window.confirm("Delete this report permanently from your account? This can't be undone.")) return;
    const r = await api(`/api/inspections/${encodeURIComponent(inspection.id)}`, { method: "DELETE" });
    if (r.ok) router.push("/app");
    else setRunError(r.message);
  };

  const currentCase = inspection.case;
  if (inspection.status !== "completed" || !currentCase || !currentCase.report) {
    return <InspectionStatusView inspection={inspection} aiEnabled={aiEnabled} starting={starting} runError={runError} onStart={() => void start(false)} onDelete={() => void handleDelete()} />;
  }

  const report: VerificationReport = currentCase.report;
  const a = report.assessment;
  const meta = ASSESSMENT_META[a.assessment];
  const AssessIcon = meta.icon;
  const s = currentCase.submission;
  const countBy = (st: CheckStatus) => report.checks.filter((c) => c.status === st).length;
  const SEVERITY_ORDER = ["HIGH", "MEDIUM", "LOW", "INFO"];
  const keyFindings: Finding[] = report.findings
    .filter((f) => f.kind !== "OBSERVATION")
    .sort((x, y) => SEVERITY_ORDER.indexOf(x.severity) - SEVERITY_ORDER.indexOf(y.severity));
  const overviewFindings: Finding[] = keyFindings.length ? keyFindings : report.findings.slice(0, 4);
  const evidenceById = new Map<string, Evidence>(report.evidence.map((e) => [e.id, e]));
  const findingById = new Map<string, Finding>(report.findings.map((f) => [f.id, f]));

  const showEvidence = (id: string) => {
    setFocusEvidence(id);
    setActiveTab("evidence");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "findings", label: `Findings (${report.findings.length})` },
    { id: "evidence", label: `Evidence (${report.evidence.length})` },
    { id: "checks", label: `Checks (${report.checks.length})` },
    { id: "limitations", label: "Limitations" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-7 animate-fade-in pb-12">

      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--ink-secondary)] hover:text-[var(--brand-primary)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCase(inspection, inspection.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-0)] border border-[var(--border-light)] px-3 py-1.5 text-xs font-mono font-semibold text-[var(--ink-secondary)] hover:bg-[var(--surface-2)] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={handleDelete}
            title="Delete this report"
            className="grid place-items-center w-8 h-8 rounded-lg text-[var(--ink-muted)] hover:text-[var(--status-risk-text)] hover:bg-[var(--status-risk-bg)] transition-colors"
            aria-label="Delete report"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {runError && <p role="alert" className="rounded-lg border border-[var(--status-risk-border)] bg-[var(--status-risk-bg)] p-3 text-xs text-[var(--status-risk-text)]">{runError}</p>}

      {inspection.research && <ResearchPanel research={inspection.research} inspection={inspection} />}

      {/* Primary Assessment Banner */}
      <div className={`rounded-xl p-5 sm:p-7 border shadow-xs ${meta.banner}`} data-testid="report-assessment">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-75">
              Local checks only (no network lookups)
            </span>
            <div className="flex items-center gap-2.5">
              <AssessIcon className={`w-6 h-6 shrink-0 ${meta.iconColor}`} />
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="assessment-badge">
                {meta.label}
              </h2>
            </div>
            <p className="text-xs font-mono opacity-85">
              {a.confidence ? CONFIDENCE_LABEL[a.confidence] : "No calibrated confidence level"} · {meta.description}
            </p>
          </div>

          {/* Coverage Summary Pill */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono bg-[var(--surface-0)] px-3 py-1.5 rounded-lg border border-[var(--border-light)] text-[var(--ink-primary)]">
            <div>
              <span className="text-[var(--status-safe-text)] font-bold">{countBy("COMPLETED")}</span>
              <span className="text-[var(--ink-muted)] ml-1">Completed</span>
            </div>
            <div className="h-3 w-px bg-[var(--border-light)]" />
            <div>
              <span className="text-[var(--ink-secondary)] font-bold">{countBy("UNAVAILABLE")}</span>
              <span className="text-[var(--ink-muted)] ml-1">Unavailable</span>
            </div>
            <div className="h-3 w-px bg-[var(--border-light)]" />
            <div>
              <span className="text-[var(--ink-muted)] font-bold">{countBy("NOT_RUN")}</span>
              <span className="text-[var(--ink-muted)] ml-1">Not Run</span>
            </div>
          </div>
        </div>

        <p className="mt-3.5 text-xs sm:text-sm leading-relaxed opacity-95 max-w-4xl font-normal">
          {a.summary}
        </p>
      </div>

      {/* Target Opportunity Header Card */}
      <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[var(--ink-primary)] break-all">
              {caseTitle(currentCase)}
            </h1>
            <p className="text-xs text-[var(--ink-secondary)] mt-0.5 font-mono">
              {currentCase.inputType === "link" ? "URL Target" : currentCase.inputType === "document" ? "Offer Document" : "Direct Message"}
              {" · "}
              {LIFECYCLE_LABEL[currentCase.lifecycle]}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ink-muted)] font-mono">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDateTime(report.generatedAt)}</span>
            </span>
            {s.displayHostname && (
              <span className="flex items-center gap-1.5 break-all">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span data-testid="report-hostname">{s.displayHostname}</span>
              </span>
            )}
          </div>
        </div>

        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
          {s.originalUrl && (
            <div className="sm:col-span-2 min-w-0">
              <dt className="font-mono font-bold text-[var(--ink-secondary)] uppercase text-[10px]">Submitted URL (not opened)</dt>
              <dd className="font-mono text-[var(--ink-primary)] break-all mt-0.5" data-testid="report-submitted-url">{s.originalUrl}</dd>
              {s.normalizedUrl && s.normalizedUrl !== s.originalUrl && (
                <dd className="font-mono text-[var(--ink-muted)] break-all mt-0.5 text-[11px]">Normalized: {s.normalizedUrl}</dd>
              )}
            </div>
          )}
          {s.claimedCompany && (
            <div>
              <dt className="font-mono font-bold text-[var(--ink-secondary)] uppercase text-[10px]">Claimed Company</dt>
              <dd className="text-[var(--ink-primary)] mt-0.5 break-words font-semibold">{s.claimedCompany}</dd>
            </div>
          )}
          {s.textLength !== undefined && (
            <div>
              <dt className="font-mono font-bold text-[var(--ink-secondary)] uppercase text-[10px]">{s.documentName ? `Document: ${s.documentName}` : "Submitted Text"}</dt>
              <dd className="text-[var(--ink-primary)] mt-0.5 font-mono text-[11px]">{s.textLength.toLocaleString("en-US")} chars analyzed; only excerpts persisted</dd>
            </div>
          )}
          <div>
            <dt className="font-mono font-bold text-[var(--ink-secondary)] uppercase text-[10px]">Report ID</dt>
            <dd className="font-mono text-[var(--ink-muted)] mt-0.5 break-all text-[11px]" data-testid="report-case-id">{currentCase.id}</dd>
          </div>
          <div>
            <dt className="font-mono font-bold text-[var(--ink-secondary)] uppercase text-[10px]">Engine / Ruleset</dt>
            <dd className="font-mono text-[var(--ink-muted)] mt-0.5 text-[11px]">{report.engineVersion} / {report.rulesetVersion}</dd>
          </div>
        </dl>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-[var(--border-light)] -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Report sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={activeTab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 pb-3 px-4 text-xs font-mono font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${
              activeTab === t.id
                ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="space-y-6 animate-fade-in">
          <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">Assessment Rationale</h3>
            <ul className="space-y-1.5 text-xs text-[var(--ink-secondary)] list-disc pl-5">
              {a.rationale.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="text-[10px] font-mono text-[var(--ink-muted)]">Triggered Rule IDs: {a.triggeredRuleIds.join(", ")}</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">
              {keyFindings.length ? "Risk Signals & Corroboration" : "Observed Characteristics"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {overviewFindings.map((f) => (
                <FindingCard key={f.id} finding={f} onEvidence={showEvidence} />
              ))}
            </div>
            {!keyFindings.length && (
              <p className="text-xs text-[var(--ink-muted)] font-mono">
                No risk signals from the local checks. That doesn&apos;t establish that the employer or the opportunity is genuine.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 space-y-2.5 shadow-xs">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)] flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
              <span>Recommended Follow-Up Actions</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-[var(--ink-secondary)] list-disc pl-5">
              {a.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Tab: Findings */}
      {activeTab === "findings" && (
        <div id="panel-findings" role="tabpanel" aria-labelledby="tab-findings" className="space-y-4 animate-fade-in">
          {report.findings.map((finding) => {
            const sev = SEVERITY_META[finding.severity];
            return (
              <div key={finding.id} className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 space-y-3.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded border text-[10px] font-mono font-bold px-2 py-0.5 ${sev.badge}`}>
                      {finding.kind === "CORROBORATION" ? "Corroboration" : sev.label}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--ink-muted)]">{formatDateTime(finding.detectedAt)}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--ink-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded">
                    {finding.ruleId} v{finding.ruleVersion} · {PROVENANCE_LABEL[finding.sourceType]}
                    {finding.confidence ? ` · ${CONFIDENCE_LABEL[finding.confidence]}` : ""}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[var(--ink-primary)] break-words">{finding.title}</h3>

                <div className="grid sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-[var(--canvas)] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1">
                    <p className="font-bold font-mono text-[10px] uppercase text-[var(--ink-secondary)]">1. Observation</p>
                    <p className="text-[var(--ink-primary)] leading-relaxed break-words font-mono text-[11px]">{finding.observationSummary}</p>
                  </div>
                  <div className="bg-[var(--canvas)] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1">
                    <p className="font-bold font-mono text-[10px] uppercase text-[var(--ink-secondary)]">2. Why it matters (rule&apos;s interpretation)</p>
                    <p className="text-[var(--ink-secondary)] leading-relaxed">{finding.explanation}</p>
                  </div>
                  <div className="bg-[var(--canvas)] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1">
                    <p className="font-bold font-mono text-[10px] uppercase text-[var(--ink-secondary)]">3. Limitation</p>
                    <p className="text-[var(--ink-secondary)] leading-relaxed">{finding.limitation}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  <span className="text-[var(--ink-muted)]">Evidence:</span>
                  {finding.evidenceIds.length === 0 ? (
                    <span className="text-[var(--ink-muted)]">No independent record; see limitation</span>
                  ) : (
                    finding.evidenceIds.map((id) => (
                      <button key={id} type="button" onClick={() => showEvidence(id)} className="font-bold text-[var(--brand-primary)] hover:underline">
                        {id}: {evidenceById.get(id)?.title ?? "record"}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Evidence */}
      {activeTab === "evidence" && (
        <div id="panel-evidence" role="tabpanel" aria-labelledby="tab-evidence" className="space-y-4 animate-fade-in">
          {report.evidence.length === 0 && (
            <p className="text-xs font-mono text-[var(--ink-muted)]">No evidence records. See Limitations tab for unavailable network checks.</p>
          )}
          {report.evidence.map((ev: Evidence) => (
            <div
              key={ev.id}
              id={`evidence-${ev.id}`}
              tabIndex={-1}
              className={`rounded-xl border bg-[var(--surface-0)] p-5 space-y-3 shadow-xs outline-none ${focusEvidence === ev.id ? "border-[var(--brand-primary)] ring-2 ring-[var(--brand-glow)]" : "border-[var(--border-light)]"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSearch className="w-4 h-4 text-[var(--brand-primary)] shrink-0" />
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--ink-primary)] break-words font-mono">
                    <span className="text-[var(--brand-primary)] mr-1.5">{ev.id}</span>
                    {ev.title}
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-[var(--ink-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded">
                  {PROVENANCE_LABEL[ev.provenance]} · {ev.retrievalStatus === "LOCAL_ANALYSIS" ? `analysed locally ${formatDateTime(ev.capturedAt)}` : ev.retrievalStatus === "RETRIEVED" ? `retrieved ${formatDateTime(ev.capturedAt)}` : ev.retrievalStatus.toLowerCase()}
                </span>
              </div>

              {ev.sourceUrl && (
                <p className="text-xs text-[var(--ink-secondary)] break-all font-mono">
                  <span className="font-bold text-[var(--ink-primary)]">{ev.retrievalStatus === "RETRIEVED" ? "Source URL: " : "Submitted URL (not fetched): "}</span>
                  <span>{ev.sourceUrl}</span>
                </p>
              )}

              {ev.excerpt && (
                <blockquote className="border-l-2 border-[var(--brand-primary)] pl-3 text-xs text-[var(--ink-primary)] bg-[var(--surface-1)] py-1.5 rounded-r font-mono break-words">
                  {ev.excerpt}
                </blockquote>
              )}

              {ev.data && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs font-mono">
                  {Object.entries(ev.data).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-[var(--ink-muted)]">{k}:</dt>
                      <dd className="text-[var(--ink-primary)] break-all">{v === null ? "—" : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <p className="text-[11px] font-mono text-[var(--ink-muted)] pt-1 border-t border-[var(--border-subtle)]">
                Supports: {ev.findingIds.map((id) => findingById.get(id)?.title ?? id).join("; ") || "no finding"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Checks */}
      {activeTab === "checks" && (
        <div id="panel-checks" role="tabpanel" aria-labelledby="tab-checks" className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 shadow-xs divide-y divide-[var(--border-subtle)] animate-fade-in">
          <div className="pb-3 mb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">Check coverage</h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Every check the engine knows about and whether it ran. Unavailable checks need sources that aren&apos;t connected in this build.
            </p>
          </div>

          {(["COMPLETED", "PARTIAL", "FAILED", "UNAVAILABLE", "NOT_RUN"] as CheckStatus[]).flatMap((status) =>
            report.checks
              .filter((c) => c.status === status)
              .map((check) => {
                const st = CHECK_STATUS_META[check.status];
                const StIcon = st.icon;
                return (
                  <div key={check.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid={`check-${check.id}`}>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[9px] uppercase font-bold text-[var(--ink-muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
                          {check.category}
                        </span>
                        <h4 className="text-xs font-bold text-[var(--ink-primary)] font-mono">{check.name}</h4>
                      </div>
                      <p className="text-xs text-[var(--ink-secondary)]">{check.summary}</p>
                      {check.reason && <p className="text-[11px] font-mono text-[var(--ink-muted)]">{check.reason}</p>}
                    </div>
                    <span className={`shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-mono font-bold border ${st.badge}`}>
                      <StIcon className={`w-3 h-3 ${st.iconColor}`} />
                      <span>{st.label}</span>
                    </span>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* Tab: Limitations */}
      {activeTab === "limitations" && (
        <div id="panel-limitations" role="tabpanel" aria-labelledby="tab-limitations" className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 sm:p-6 space-y-4 shadow-xs animate-fade-in">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">Limitations</h3>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5 font-mono">
              What this report could not check, and the limits of the checks that ran.
            </p>
          </div>
          <ul className="space-y-2.5 text-xs text-[var(--ink-secondary)] leading-relaxed">
            {report.limitations.map((l) => (
              <li key={l} className="p-3.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-light)] font-mono text-[11px]">{l}</li>
            ))}
            <li className="p-3.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-light)] font-mono text-[11px]">
              This report is stored in your Internyra account (Cloud Firestore). The administrator can review account activity for operations and abuse prevention. You can delete it at any time.
            </li>
          </ul>
        </div>
      )}

    </div>
  );
}

export default function ReportDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto py-12 animate-pulse space-y-6">
          <div className="h-28 bg-[var(--surface-2)] rounded-xl" />
          <div className="h-44 bg-[var(--surface-2)] rounded-xl" />
        </div>
      }
    >
      <ReportDetailContent />
    </Suspense>
  );
}
