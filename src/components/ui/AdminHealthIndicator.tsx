import React from "react";
import { CheckCircle2, AlertCircle, XCircle, Clock } from "lucide-react";

export type HealthStatus = "healthy" | "degraded" | "down" | "disabled" | "pending";

export interface AdminHealthIndicatorProps {
  name: string;
  status: HealthStatus;
  statusLabel?: string;
  detail?: string;
  lastChecked?: string;
}

const HEALTH_CONFIG: Record<
  HealthStatus,
  { dot: string; text: string; bg: string; border: string; icon: typeof CheckCircle2 }
> = {
  healthy: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
  degraded: {
    dot: "bg-amber-500",
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: AlertCircle,
  },
  down: {
    dot: "bg-rose-500",
    text: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    icon: XCircle,
  },
  disabled: {
    dot: "bg-slate-400",
    text: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: Clock,
  },
  pending: {
    dot: "bg-blue-400",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Clock,
  },
};

export function AdminHealthIndicator({
  name,
  status,
  statusLabel,
  detail,
  lastChecked,
}: AdminHealthIndicatorProps) {
  const cfg = HEALTH_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] gap-3 shadow-xs">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} aria-hidden="true" />
          <h4 className="text-xs font-bold text-[var(--ink-primary)] font-mono">{name}</h4>
        </div>
        {detail && <p className="text-xs text-[var(--ink-secondary)] pl-4">{detail}</p>}
      </div>

      <div className="flex items-center gap-2.5 self-start sm:self-center pl-4 sm:pl-0">
        {lastChecked && (
          <span className="text-[10px] font-mono text-[var(--ink-muted)]">
            Checked {lastChecked}
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
        >
          <Icon className="w-3 h-3" aria-hidden="true" />
          <span>{statusLabel || status.toUpperCase()}</span>
        </span>
      </div>
    </div>
  );
}
