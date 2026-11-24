import React from "react";

export interface FilterOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

export interface FilterBarProps<T extends string = string> {
  options: FilterOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}

export function FilterBar<T extends string = string>({
  options,
  activeId,
  onChange,
  ariaLabel = "Filter options",
}: FilterBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1"
    >
      {options.map((opt) => {
        const isActive = activeId === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isActive
                ? "bg-[var(--ink-primary)] text-white shadow-xs"
                : "bg-[var(--surface-0)] text-[var(--ink-secondary)] border border-[var(--border-light)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-primary)]"
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[var(--surface-2)] text-[var(--ink-muted)]"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
