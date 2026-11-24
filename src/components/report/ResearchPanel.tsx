import React from "react";
import { AlertTriangle, ExternalLink, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import { STATUS_LABEL, type ResearchReport, type ResearchStatus } from "@/lib/research/types";
import type { Inspection } from "@/lib/inspections-client";
import { formatDateTime } from "./meta";

const TONE: Record<ResearchStatus, { box: string; icon: typeof ShieldCheck; color: string; badge: string }> = {
  no_major_red_flags_found: {
    box: "bg-emerald-50/70 border-emerald-200 text-emerald-950",
    icon: ShieldCheck,
    color: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  needs_caution: {
    box: "bg-amber-50/70 border-amber-200 text-amber-950",
    icon: AlertTriangle,
    color: "text-amber-600",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
  },
  suspicious_indicators_found: {
    box: "bg-rose-50/70 border-rose-200 text-rose-950",
    icon: ShieldAlert,
    color: "text-rose-600",
    badge: "bg-rose-100 text-rose-800 border-rose-300",
  },
  insufficient_evidence: {
    box: "bg-slate-50 border-slate-200 text-slate-900",
    icon: Info,
    color: "text-slate-500",
    badge: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

const CONF = { low: "Low confidence", moderate: "Moderate confidence", high: "High confidence" } as const;
const SEV = { low: "Low", medium: "Medium", high: "High" } as const;

function List({ title, items, empty }: { title: string; items: React.ReactNode[]; empty?: string }) {
  if (items.length === 0 && !empty) return null;
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">
        {title}
      </h4>
      {items.length ? (
        <ul className="list-disc space-y-1.5 pl-5 text-xs sm:text-sm leading-relaxed text-[var(--ink-secondary)]">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs font-mono text-[var(--ink-muted)]">{empty}</p>
      )}
    </section>
  );
}

export function ResearchPanel({ research, inspection }: { research: ResearchReport; inspection: Inspection }) {
  const tone = TONE[research.status];
  const Icon = tone.icon;
  const srcIndex = new Map(research.sources.map((s) => [s.id, s]));
  const ranWith = inspection.provider ? `${inspection.provider} (${inspection.model})` : "unknown provider";

  return (
    <section className="space-y-6" aria-labelledby="research-title" data-testid="research-panel">
      {/* Primary Research Result Dossier Header */}
      <div className={`rounded-2xl border p-5 sm:p-7 shadow-xs ${tone.box}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-75">
            Corroborated Intelligence Finding
          </span>
          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${tone.badge}`}>
            {CONF[research.confidence]}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-white/70 shrink-0 shadow-2xs">
            <Icon className={`h-5 w-5 ${tone.color}`} aria-hidden="true" />
          </div>
          <div>
            <h2 id="research-title" className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="research-status">
              {STATUS_LABEL[research.status]}
            </h2>
            <p className="text-xs opacity-85 mt-0.5">Based only on public verifiable sources and submitted materials.</p>
          </div>
        </div>

        <p className="mt-4 max-w-4xl text-xs sm:text-sm leading-relaxed opacity-95">
          {research.summary}
        </p>
      </div>

      {/* Disclaimers & Prompt Injection Alert */}
      <div className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-accent)]/60 p-3.5 text-xs text-[var(--ink-secondary)] leading-relaxed">
        <strong>Forensic disclaimer:</strong> This report is research support, not a legal certification. Always confirm through the company&apos;s verified public domain before paying anything or sharing government identification.
      </div>

      {research.promptInjectionDetected && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed font-mono">
          <strong>Security note:</strong> The submitted text contained prompt injection instructions directed at an automated model. These directives were isolated as untrusted text and ignored.
        </p>
      )}

      {/* Findings Breakdown Container */}
      <div className="space-y-6 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 sm:p-7 shadow-xs">
        <List
          title="Verified facts (each tied to an external source)"
          empty="No claims could be independently corroborated against a retrievable public registry."
          items={research.facts.map((f) => {
            const s = srcIndex.get(f.sourceId);
            return (
              <span key={f.statement}>
                <span className="text-[var(--ink-primary)] font-medium">{f.statement}</span>{" "}
                <span className="text-[var(--ink-muted)] font-mono text-[11px]">
                  [{f.sourceId}{s ? `: ${new URL(s.url).hostname}` : ""}] &ldquo;{f.quote}&rdquo;
                </span>
              </span>
            );
          })}
        />

        <div className="h-px bg-[var(--border-subtle)]" />

        <List
          title="Risk indicators identified"
          items={research.riskIndicators.map((r) => `${SEV[r.severity]} severity · ${r.indicator} (${r.basis.replace(/_/g, " ")})`)}
          empty="No high-risk indicators were detected in the reviewed materials."
        />

        <div className="h-px bg-[var(--border-subtle)]" />

        <List
          title="Fee or financial payment demands"
          items={research.feeOrPaymentRequests}
          empty="No advance fees, equipment deposits, or training charges were found in the text."
        />

        <div className="h-px bg-[var(--border-subtle)]" />

        <section className="space-y-1.5">
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">
            Recruiter corroboration
          </h4>
          <p className="text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed">
            <span className="font-semibold text-[var(--ink-primary)]">
              {research.recruiter.corroboration === "corroborated"
                ? "Corroborated"
                : research.recruiter.corroboration === "not_corroborated"
                ? "Not corroborated"
                : "Not checked"}
            </span>
            {research.recruiter.name ? ` · Recruiter: ${research.recruiter.name}` : ""}
            {research.recruiter.notes ? `. ${research.recruiter.notes}` : ""}
          </p>
        </section>

        <div className="h-px bg-[var(--border-subtle)]" />

        <List title="Claims made in the submission (unverified)" items={research.submittedClaims} />
        <List title="System inferences" items={research.inferences.map((i) => `${i.statement} (basis: ${i.basis})`)} />
        <List title="Unknown or unverified aspects" items={research.unknowns} />
        <List title="Missing evidence" items={research.missingEvidence} />
        <List title="Recommended follow-up actions" items={research.nextSteps} />
      </div>

      {/* Verified Sources Card */}
      <div className="space-y-4 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ink-primary)]">
            Corroboration Sources ({research.sources.length})
          </h3>
          <span className="text-[10px] font-mono text-[var(--ink-muted)]">Public Evidence</span>
        </div>

        {research.sources.length === 0 ? (
          <p className="text-xs font-mono text-[var(--ink-muted)]">
            No external source was retrieved
            {research.pageRetrieval.attempted && !research.pageRetrieval.ok
              ? " (the submitted page could not be reached or robot access was blocked)"
              : ""}
            . Findings above are based on the submitted text only.
          </p>
        ) : (
          <ul className="space-y-3">
            {research.sources.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-[var(--border-light)] bg-[var(--canvas)] p-3.5 text-xs space-y-1.5"
                data-testid="research-source"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-[var(--ink-primary)] font-mono">{s.id} · {s.title}</p>
                  <span className="text-[10px] font-mono text-[var(--ink-muted)]">
                    {s.origin === "retrieved_page" ? "Internyra fetch" : "Search provider"}
                  </span>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 break-all text-[var(--brand-primary)] hover:underline font-mono text-[11px]"
                >
                  <span>{s.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
                <p className="text-[11px] font-mono text-[var(--ink-muted)]">
                  Retrieved {formatDateTime(s.retrievedAt)}
                </p>
                {s.excerpt && (
                  <blockquote className="mt-1 border-l-2 border-[var(--brand-primary)] pl-2.5 text-[11px] font-mono text-[var(--ink-secondary)] italic">
                    &ldquo;{s.excerpt}&rdquo;
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        )}
        {research.droppedUnsupportedFacts > 0 && (
          <p className="text-[11px] font-mono text-[var(--ink-muted)] pt-2 border-t border-[var(--border-subtle)]">
            {research.droppedUnsupportedFacts} statement(s) were removed because they lacked verifiable citations.
          </p>
        )}
      </div>

      {/* Model & Provenance Details */}
      <dl
        className="grid gap-x-6 gap-y-3 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 text-xs shadow-xs sm:grid-cols-2 font-mono"
        data-testid="research-provenance"
      >
        <div>
          <dt className="font-bold uppercase text-[10px] text-[var(--ink-muted)]">Processing Model</dt>
          <dd className="mt-0.5 text-[var(--ink-primary)]">
            {inspection.fromCache ? "Cached record, originally by " : ""}
            {ranWith}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-[10px] text-[var(--ink-muted)]">Routing Strategy</dt>
          <dd className="mt-0.5 text-[var(--ink-primary)]">
            {(inspection.providerStrategy ?? "unknown").replace(/_/g, " ")}
            {inspection.fallbackOccurred ? ` · fallback used (${inspection.fallbackReason ?? "provider error"})` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-[10px] text-[var(--ink-muted)]">Live Web Retrieval</dt>
          <dd className="mt-0.5 text-[var(--ink-primary)]">
            {inspection.fromCache
              ? "Reused from cache"
              : inspection.webSearchUsed
              ? "Executed by provider"
              : "Disabled"}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-[10px] text-[var(--ink-muted)]">Page Scraper Status</dt>
          <dd className="mt-0.5 text-[var(--ink-primary)]">
            {research.pageRetrieval.attempted
              ? research.pageRetrieval.ok
                ? "Retrieved successfully"
                : `Failed (${research.pageRetrieval.reason ?? "unavailable"})`
              : "No URL submitted"}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-[10px] text-[var(--ink-muted)]">Execution Timestamp</dt>
          <dd className="mt-0.5 text-[var(--ink-primary)]">
            {formatDateTime(research.researchedAt)}
            {inspection.researchMs ? ` · ${(inspection.researchMs / 1000).toFixed(1)}s latency` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-[10px] text-[var(--ink-muted)]">Engine Specification</dt>
          <dd className="mt-0.5 text-[var(--ink-primary)]">
            schema v{research.schemaVersion} · prompt v{research.promptVersion}
          </dd>
        </div>
      </dl>
    </section>
  );
}
