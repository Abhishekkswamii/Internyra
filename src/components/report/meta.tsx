import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  HelpCircle,
  Info,
  Shield,
  ShieldAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  Assessment,
  CheckStatus,
  Confidence,
  LifecycleState,
  Provenance,
  Severity,
  VerificationCase,
} from "@/types/verification";

export interface AssessmentMeta {
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  /** Light surfaces */
  badge: string;
  dot: string;
  banner: string;
  iconColor: string;
  /** Dark surfaces (guest preview) */
  darkBadge: string;
}

export const ASSESSMENT_META: Record<Assessment, AssessmentMeta> = {
  HIGH_RISK: {
    label: "High Risk",
    short: "High risk",
    description: "Strong, relevant signals warrant caution.",
    icon: ShieldAlert,
    badge: "bg-rose-50 border-rose-200 text-rose-700",
    dot: "bg-rose-500",
    banner: "bg-rose-50/80 border-rose-200/90 text-rose-950",
    iconColor: "text-rose-600",
    darkBadge: "bg-rose-500/15 border-rose-500/30 text-rose-300",
  },
  NEEDS_REVIEW: {
    label: "Needs Review",
    short: "Needs review",
    description: "Meaningful uncertainties need further investigation.",
    icon: AlertTriangle,
    badge: "bg-amber-50 border-amber-200 text-amber-800",
    dot: "bg-amber-500",
    banner: "bg-amber-50/80 border-amber-200/90 text-amber-950",
    iconColor: "text-amber-600",
    darkBadge: "bg-amber-500/15 border-amber-500/30 text-amber-300",
  },
  LOWER_CONCERN: {
    label: "Lower Concern",
    short: "Lower concern",
    description: "Available evidence shows fewer material concerns. Not a guarantee of legitimacy.",
    icon: Shield,
    badge: "bg-emerald-50 border-emerald-200 text-emerald-700",
    dot: "bg-emerald-500",
    banner: "bg-emerald-50/80 border-emerald-200/90 text-emerald-950",
    iconColor: "text-emerald-600",
    darkBadge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
  },
  INSUFFICIENT_DATA: {
    label: "Insufficient Data",
    short: "Insufficient data",
    description: "Not enough evidence for a useful determination.",
    icon: HelpCircle,
    badge: "bg-slate-100 border-slate-200 text-slate-700",
    dot: "bg-slate-400",
    banner: "bg-slate-50 border-slate-200 text-slate-900",
    iconColor: "text-slate-500",
    darkBadge: "bg-slate-500/15 border-slate-500/30 text-slate-300",
  },
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  LOW: "Low confidence",
  MODERATE: "Moderate confidence",
  HIGH: "High confidence",
};

export const SEVERITY_META: Record<Severity, { label: string; badge: string; icon: LucideIcon; iconColor: string }> = {
  HIGH: { label: "High-severity signal", badge: "bg-rose-50 border-rose-200 text-rose-700", icon: XCircle, iconColor: "text-rose-600" },
  MEDIUM: { label: "Medium-severity signal", badge: "bg-amber-50 border-amber-200 text-amber-800", icon: AlertTriangle, iconColor: "text-amber-600" },
  LOW: { label: "Low-severity signal", badge: "bg-yellow-50 border-yellow-200 text-yellow-800", icon: AlertTriangle, iconColor: "text-yellow-600" },
  INFO: { label: "Observation", badge: "bg-slate-100 border-slate-200 text-slate-700", icon: Info, iconColor: "text-slate-500" },
};

export const CHECK_STATUS_META: Record<CheckStatus, { label: string; badge: string; icon: LucideIcon; iconColor: string }> = {
  COMPLETED: { label: "Completed", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, iconColor: "text-emerald-600" },
  PARTIAL: { label: "Partial", badge: "bg-amber-50 text-amber-800 border-amber-200", icon: CircleDashed, iconColor: "text-amber-600" },
  UNAVAILABLE: { label: "Unavailable", badge: "bg-slate-100 text-slate-600 border-slate-200", icon: CircleSlash, iconColor: "text-slate-500" },
  NOT_RUN: { label: "Not run", badge: "bg-white text-slate-500 border-slate-200", icon: CircleDashed, iconColor: "text-slate-400" },
  FAILED: { label: "Failed", badge: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle, iconColor: "text-rose-600" },
};

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  OFFICIAL: "Official source",
  REPUTABLE_INDEPENDENT: "Reputable independent source",
  USER_SUPPLIED: "From your submission",
  COMMUNITY_SUBMITTED: "Community-submitted",
  LOCAL_HEURISTIC: "Local heuristic",
};

export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  COMPLETED: "Completed",
  PARTIAL: "Partially completed",
  FAILED: "Failed",
  TIMEOUT: "Timed out",
  NEEDS_REVIEW: "Awaiting review",
};

export function caseAssessment(c: VerificationCase): Assessment {
  return c.report?.assessment.assessment ?? "INSUFFICIENT_DATA";
}

/** Primary display name for a case: claimed company, else hostname, else the input kind. */
export function caseTitle(c: VerificationCase): string {
  return (
    c.submission.claimedCompany ||
    c.submission.displayHostname ||
    c.submission.documentName ||
    (c.inputType === "message" ? "Recruiter message" : "Submitted text")
  );
}

export function caseSubtitle(c: VerificationCase): string {
  if (c.submission.normalizedUrl) return c.submission.displayHostname ?? c.submission.hostname ?? "";
  return c.inputType === "document" ? "Document text" : "Pasted message";
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AssessmentBadge({ assessment, className = "" }: { assessment: Assessment; className?: string }) {
  const m = ASSESSMENT_META[assessment];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${m.badge} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} aria-hidden="true" />
      <span>{m.label}</span>
    </span>
  );
}
