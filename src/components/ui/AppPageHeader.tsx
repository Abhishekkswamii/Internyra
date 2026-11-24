import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export interface AppPageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}

export function AppPageHeader({
  title,
  description,
  badge,
  backHref,
  backLabel = "Back",
  actions,
  eyebrow,
}: AppPageHeaderProps) {
  return (
    <header className="space-y-3 pb-6 border-b border-[var(--border-subtle)]">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--ink-secondary)] hover:text-[var(--brand-primary)] transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{backLabel}</span>
        </Link>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              {eyebrow}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink-primary)]">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-[var(--ink-secondary)] max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
