import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Clock, RotateCw } from "lucide-react";
import { STATUS_LABEL, type ResearchStatus } from "@/lib/research/types";
import type { Inspection } from "@/lib/inspections-client";

export type BadgeTone = "safe" | "caution" | "risk" | "neutral" | "brand";

const RESEARCH_CONFIG: Record<
  ResearchStatus,
  { label: string; tone: BadgeTone; icon: typeof CheckCircle2 }
> = {
  no_major_red_flags_found: {
    label: STATUS_LABEL.no_major_red_flags_found,
    tone: "safe",
    icon: CheckCircle2,
  },
  needs_caution: {
    label: STATUS_LABEL.needs_caution,
    tone: "caution",
    icon: AlertTriangle,
  },
  suspicious_indicators_found: {
    label: STATUS_LABEL.suspicious_indicators_found,
    tone: "risk",
    icon: AlertCircle,
  },
  insufficient_evidence: {
    label: STATUS_LABEL.insufficient_evidence,
    tone: "neutral",
    icon: HelpCircle,
  },
};

const INSPECTION_STATE_CONFIG: Record<
  Inspection["status"],
  { label: string; tone: BadgeTone; icon: typeof Clock }
> = {
  pending_auth: { label: "Waiting for sign-in", tone: "neutral", icon: Clock },
  queued: { label: "Queued", tone: "neutral", icon: Clock },
  running: { label: "Running", tone: "brand", icon: RotateCw },
  completed: { label: "Completed", tone: "safe", icon: CheckCircle2 },
  failed: { label: "Failed", tone: "risk", icon: AlertCircle },
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  safe: "bg-[var(--status-safe-bg)] text-[var(--status-safe-text)] border-[var(--status-safe-border)]",
  caution: "bg-[var(--status-review-bg)] text-[var(--status-review-text)] border-[var(--status-review-border)]",
  risk: "bg-[var(--status-risk-bg)] text-[var(--status-risk-text)] border-[var(--status-risk-border)]",
  neutral: "bg-[var(--surface-2)] text-[var(--ink-secondary)] border-[var(--border-light)]",
  brand: "bg-[var(--surface-accent)] text-[#2a4de0] border-[#b0c0ff]",
};

export interface StatusBadgeProps {
  researchStatus?: ResearchStatus;
  inspectionStatus?: Inspection["status"];
  customLabel?: string;
  tone?: BadgeTone;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({
  researchStatus,
  inspectionStatus,
  customLabel,
  tone,
  showIcon = true,
  size = "md",
}: StatusBadgeProps) {
  let label = customLabel || "Unknown";
  let resolvedTone: BadgeTone = tone || "neutral";
  let IconComponent = HelpCircle;

  if (researchStatus && RESEARCH_CONFIG[researchStatus]) {
    const cfg = RESEARCH_CONFIG[researchStatus];
    label = customLabel || cfg.label;
    resolvedTone = tone || cfg.tone;
    IconComponent = cfg.icon;
  } else if (inspectionStatus && INSPECTION_STATE_CONFIG[inspectionStatus]) {
    const cfg = INSPECTION_STATE_CONFIG[inspectionStatus];
    label = customLabel || cfg.label;
    resolvedTone = tone || cfg.tone;
    IconComponent = cfg.icon;
  }

  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-2 py-0.5 gap-1 font-mono uppercase tracking-wider"
      : "text-xs px-2.5 py-1 gap-1.5 font-medium";

  return (
    <span
      className={`inline-flex items-center rounded-md border font-semibold ${TONE_CLASSES[resolvedTone]} ${sizeClasses}`}
    >
      {showIcon && (
        <IconComponent
          className={`shrink-0 ${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} ${
            inspectionStatus === "running" ? "animate-spin" : ""
          }`}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
  );
}
