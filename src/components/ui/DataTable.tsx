import React from "react";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  keyExtractor: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = "No records found",
  keyExtractor,
  onRowClick,
  className = "",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-light)] bg-[var(--surface-0)] p-8 text-center text-sm text-[var(--ink-secondary)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-[var(--border-light)] bg-[var(--surface-0)] shadow-xs ${className}`}
    >
      <table className="w-full min-w-[640px] text-left text-xs border-collapse">
        <thead className="border-b border-[var(--border-light)] bg-[var(--surface-1)]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 font-mono font-semibold uppercase tracking-wider text-[11px] text-[var(--ink-muted)] ${
                  col.className || ""
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {data.map((row, idx) => {
            const rowKey = keyExtractor(row, idx);
            return (
              <tr
                key={rowKey}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${
                  onRowClick
                    ? "cursor-pointer hover:bg-[var(--surface-1)] active:bg-[var(--surface-2)]"
                    : "hover:bg-[var(--surface-1)]/50"
                }`}
              >
                {columns.map((col) => {
                  const content = col.render
                    ? col.render(row)
                    : (row as Record<string, unknown>)[col.key] != null
                    ? String((row as Record<string, unknown>)[col.key])
                    : "—";

                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 text-[var(--ink-primary)] align-middle ${
                        col.className || ""
                      }`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
