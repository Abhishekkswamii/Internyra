import React from "react";
import Link from "next/link";
import { type LucideIcon, FileSearch } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  testId?: string;
}

export function EmptyState({
  icon: Icon = FileSearch,
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
  testId = "empty-state",
}: EmptyStateProps) {
  return (
    <div
      className="rounded-2xl border border-dashed border-[var(--border-light)] bg-[var(--surface-0)] p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4"
      data-testid={testId}
    >
      <div
        className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-muted)]"
        aria-hidden="true"
      >
        <Icon className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base sm:text-lg font-bold text-[var(--ink-primary)]">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-[var(--ink-secondary)] max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {(actionHref || onAction) && actionLabel && (
        <div className="pt-2">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ink-primary)] px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--brand-primary)] shadow-xs"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ink-primary)] px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--brand-primary)] shadow-xs"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
