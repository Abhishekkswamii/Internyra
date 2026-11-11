import React from "react";
import { AlertTriangle, ExternalLink, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import { STATUS_LABEL, type ResearchReport, type ResearchStatus } from "@/lib/research/types";
import type { Inspection } from "@/lib/inspections-client";
import { formatDateTime } from "./meta";

const TONE: Record<ResearchStatus, { box: string; icon: typeof ShieldCheck; color: string }> = {
  no_major_red_flags_found: { box: "bg-emerald-50/80 border-emerald-200 text-emerald-950", icon: ShieldCheck, color: "text-emerald-600" },
  needs_caution: { box: "bg-amber-50/80 border-amber-200 text-amber-950", icon: AlertTriangle, color: "text-amber-600" },
  suspicious_indicators_found: { box: "bg-rose-50/80 border-rose-200 text-rose-950", icon: ShieldAlert, color: "text-rose-600" },
  insufficient_evidence: { box: "bg-slate-50 border-slate-200 text-slate-900", icon: Info, color: "text-slate-500" },
};

const CONF = { low: "Low confidence", moderate: "Moderate confidence", high: "High confidence" } as const;
const SEV = { low: "Low", medium: "Medium", high: "High" } as const;

function List({ title, items, empty }: { title: string; items: React.ReactNode[]; empty?: string }) {
  if (items.length === 0 && !empty) return null;
  return (
    <section className="space-y-1.5">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-primary)]">{title}</h4>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-[var(--ink-secondary)]">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--ink-muted)]">{empty}</p>
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
    <section className="space-y-5" aria-labelledby="research-title" data-testid="research-panel">
      <div className={`rounded-xl border p-5 shadow-xs sm:p-7 ${tone.box}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Research result</span>
        <div className="mt-1 flex items-center gap-2.5">
          <Icon className={`h-6 w-6 shrink-0 ${tone.color}`} aria-hidden="true" />
          <h2 id="research-title" className="text-xl font-bold tracking-tight sm:text-2xl" data-testid="research-status">{STATUS_LABEL[research.status]}</h2>
        </div>
        <p className="mt-1 text-xs opacity-85">{CONF[research.confidence]}. Based only on the evidence listed below.</p>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed">{research.summary}</p>
      </div>

      <p className="rounded-lg border border-[var(--border-light)] bg-[var(--surface-accent)] p-3 text-xs text-[var(--ink-secondary)]">
        This is research support, not a guarantee. Internyra cannot certify that an offer is legitimate. Always confirm through the company&apos;s official channels before paying anything or sharing documents.
      </p>

      {research.promptInjectionDetected && (
        <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          The submitted content contained text written to instruct an AI system. It was treated as untrusted data and was not followed.
        </p>
      )}

      <div className="space-y-5 rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 shadow-xs sm:p-6">
        <List
          title="Verified facts (each tied to a source)"
          empty="No facts could be tied to a retrievable source."
          items={research.facts.map((f) => {
            const s = srcIndex.get(f.sourceId);
            return (
              <span key={f.statement}>
                {f.statement}{" "}
                <span className="text-[var(--ink-muted)]">
                  [{f.sourceId}{s ? `: ${new URL(s.url).hostname}` : ""}] &ldquo;{f.quote}&rdquo;
                </span>
              </span>
            );
          })}
        />
        <List title="Risk indicators" items={research.riskIndicators.map((r) => `${SEV[r.severity]} · ${r.indicator} (${r.basis.replace(/_/g, " ")})`)} empty="No risk indicators were identified in the evidence reviewed." />
        <List title="Fee or payment requests" items={research.feeOrPaymentRequests} empty="None found in the submitted text." />
        <section className="space-y-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-primary)]">Recruiter corroboration</h4>
          <p className="text-xs text-[var(--ink-secondary)]">
            {research.recruiter.corroboration === "corroborated" ? "Corroborated" : research.recruiter.corroboration === "not_corroborated" ? "Not corroborated" : "Not checked"}
            {research.recruiter.name ? ` · ${research.recruiter.name}` : ""}
            {research.recruiter.notes ? `. ${research.recruiter.notes}` : ""}
          </p>
        </section>
        <List title="Claims made in the submission (not verified)" items={research.submittedClaims} />
        <List title="Inferences" items={research.inferences.map((i) => `${i.statement} (basis: ${i.basis})`)} />
        <List title="Unknown or unverified" items={research.unknowns} />
        <List title="Missing evidence" items={research.missingEvidence} />
        <List title="Suggested next steps" items={research.nextSteps} />
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 shadow-xs sm:p-6">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-primary)]">Sources ({research.sources.length})</h3>
        {research.sources.length === 0 ? (
          <p className="text-xs text-[var(--ink-muted)]">
            No external source was retrieved
            {research.pageRetrieval.attempted && !research.pageRetrieval.ok ? " (the submitted page could not be retrieved or does not allow automated access)" : ""}. Findings above are based on the submitted text only.
          </p>
        ) : (
          <ul className="space-y-3">
            {research.sources.map((s) => (
              <li key={s.id} className="rounded-lg border border-[var(--border-light)] bg-[var(--canvas)] p-3 text-xs" data-testid="research-source">
                <p className="font-semibold text-[var(--ink-primary)]">{s.id} · {s.title}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 inline-flex items-center gap-1 break-all text-[var(--brand-primary)] hover:underline">
                  {s.url}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
                <p className="mt-1 text-[var(--ink-muted)]">Retrieved {formatDateTime(s.retrievedAt)} · {s.origin === "retrieved_page" ? "fetched by Internyra" : "from provider web search"}</p>
                {s.excerpt && <p className="mt-1 text-[var(--ink-secondary)]">&ldquo;{s.excerpt}&rdquo;</p>}
              </li>
            ))}
          </ul>
        )}
        {research.droppedUnsupportedFacts > 0 && (
          <p className="text-[11px] text-[var(--ink-muted)]">{research.droppedUnsupportedFacts} statement(s) from the analysis were discarded because they could not be tied to a source.</p>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-5 text-xs shadow-xs sm:grid-cols-2" data-testid="research-provenance">
        <div><dt className="font-bold uppercase text-[10px] text-[var(--ink-secondary)]">Produced by</dt><dd className="mt-0.5 text-[var(--ink-primary)]">{inspection.fromCache ? "Reused from a recent identical analysis, originally by " : ""}{ranWith}</dd></div>
        <div><dt className="font-bold uppercase text-[10px] text-[var(--ink-secondary)]">Provider mode</dt><dd className="mt-0.5 text-[var(--ink-primary)]">{(inspection.providerStrategy ?? "unknown").replace(/_/g, " ")}{inspection.fallbackOccurred ? ` · fallback used (${inspection.fallbackReason ?? "provider error"})` : ""}</dd></div>
        <div><dt className="font-bold uppercase text-[10px] text-[var(--ink-secondary)]">Web search</dt><dd className="mt-0.5 text-[var(--ink-primary)]">{inspection.fromCache ? "Not repeated for this reused result" : inspection.webSearchUsed ? "Used by the provider" : "Not used"}</dd></div>
        <div><dt className="font-bold uppercase text-[10px] text-[var(--ink-secondary)]">Page retrieval</dt><dd className="mt-0.5 text-[var(--ink-primary)]">{research.pageRetrieval.attempted ? (research.pageRetrieval.ok ? "Retrieved" : `Not retrieved (${research.pageRetrieval.reason ?? "unavailable"})`) : "No link submitted"}</dd></div>
        <div><dt className="font-bold uppercase text-[10px] text-[var(--ink-secondary)]">Researched</dt><dd className="mt-0.5 text-[var(--ink-primary)]">{formatDateTime(research.researchedAt)}{inspection.researchMs ? ` · ${(inspection.researchMs / 1000).toFixed(1)}s` : ""}</dd></div>
        <div><dt className="font-bold uppercase text-[10px] text-[var(--ink-secondary)]">Versions</dt><dd className="mt-0.5 font-mono text-[11px] text-[var(--ink-muted)]">schema {research.schemaVersion} · prompt {research.promptVersion}</dd></div>
      </dl>
    </section>
  );
}
