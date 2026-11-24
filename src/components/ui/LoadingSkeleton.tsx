import React from "react";

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--surface-2)] ${className}`}
      aria-hidden="true"
    />
  );
}

export function MetricTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-4 sm:p-5 space-y-3"
        >
          <div className="h-3 w-1/2 bg-[var(--surface-2)] rounded animate-pulse" />
          <div className="h-8 w-2/3 bg-[var(--surface-2)] rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] p-4">
      <div className="h-8 w-full bg-[var(--surface-2)] rounded-lg animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 w-full bg-[var(--surface-1)] rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}
