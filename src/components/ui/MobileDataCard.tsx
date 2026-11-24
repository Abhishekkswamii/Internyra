import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface MobileDataCardProps {
  title: string;
  subtitle?: string;
  tag?: React.ReactNode;
  metadata?: { label: string; value: React.ReactNode }[];
  href?: string;
  onClick?: () => void;
  testId?: string;
}

export function MobileDataCard({
  title,
  subtitle,
  tag,
  metadata = [],
  href,
  onClick,
  testId = "mobile-data-card",
}: MobileDataCardProps) {
  const content = (
    <div
      className="rounded-xl border border-[var(--border-light)] bg-[var(--surface-0)] p-4 shadow-xs space-y-3 transition-colors hover:bg-[var(--surface-1)]"
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h4 className="text-sm font-semibold text-[var(--ink-primary)] truncate">
            {title}
          </h4>
          {subtitle && (
            <p className="text-xs text-[var(--ink-muted)] truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {tag}
          {(href || onClick) && (
            <ChevronRight className="w-4 h-4 text-[var(--ink-muted)]" />
          )}
        </div>
      </div>

      {metadata.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] font-mono">
          {metadata.map((item, idx) => (
            <div key={idx} className="min-w-0">
              <dt className="text-[var(--ink-muted)] uppercase text-[10px]">
                {item.label}
              </dt>
              <dd className="text-[var(--ink-secondary)] truncate font-semibold mt-0.5">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}
