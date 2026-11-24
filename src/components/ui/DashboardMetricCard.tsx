import React from "react";
import { type LucideIcon } from "lucide-react";

export interface MetricCardProps {
  label: string;
  value: number | string;
  sublabel?: string;
  icon?: LucideIcon;
  variant?: "neutral" | "safe" | "caution" | "risk" | "brand";
  testId?: string;
  loading?: boolean;
}

const VARIANT_STYLES = {
  neutral: {
    border: "border-[var(--border-light)]",
    iconBg: "bg-[var(--surface-2)]",
    iconColor: "text-[var(--ink-secondary)]",
    valueColor: "text-[var(--ink-primary)]",
  },
  safe: {
    border: "border-[var(--status-safe-border)]",
    iconBg: "bg-[var(--status-safe-bg)]",
    iconColor: "text-[var(--status-safe-text)]",
    valueColor: "text-[var(--ink-primary)]",
  },
  caution: {
    border: "border-[var(--status-review-border)]",
    iconBg: "bg-[var(--status-review-bg)]",
    iconColor: "text-[var(--status-review-text)]",
    valueColor: "text-[var(--ink-primary)]",
  },
  risk: {
    border: "border-[var(--status-risk-border)]",
    iconBg: "bg-[var(--status-risk-bg)]",
    iconColor: "text-[var(--status-risk-text)]",
    valueColor: "text-[var(--ink-primary)]",
  },
  brand: {
    border: "border-[var(--brand-primary)]/20",
    iconBg: "bg-[var(--surface-accent)]",
    iconColor: "text-[var(--brand-primary)]",
    valueColor: "text-[var(--brand-primary)]",
  },
};

export function DashboardMetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  variant = "neutral",
  testId,
  loading = false,
}: MetricCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`rounded-2xl border ${styles.border} bg-[var(--surface-0)] p-4 sm:p-5 shadow-xs transition-shadow duration-200 hover:shadow-sm`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-medium uppercase tracking-wider text-[var(--ink-muted)] truncate">
          {label}
        </span>
        {Icon && (
          <div
            className={`grid place-items-center w-7 h-7 rounded-lg ${styles.iconBg} ${styles.iconColor} shrink-0`}
            aria-hidden="true"
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${styles.valueColor}`}
          data-testid={testId}
        >
          {loading ? "–" : value}
        </span>
      </div>

      {sublabel && (
        <p className="mt-1 text-[11px] font-mono text-[var(--ink-muted)] truncate">
          {sublabel}
        </p>
      )}
    </div>
  );
}
