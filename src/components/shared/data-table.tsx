import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SkeletonTable } from "@/components/ui/loading";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export function DataTable<T>({
  rows,
  columns,
  isLoading,
  emptyTitle = "No data available",
  emptyDescription = "There is nothing to display here yet.",
  emptyAction,
  className,
  rowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  className?: string;
  rowKey?: (row: T, index: number) => string | number;
}) {
  if (isLoading) {
    return <SkeletonTable rows={5} cols={columns.length} />;
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-12 text-center",
          className
        )}
      >
        <svg
          className="mb-3 h-10 w-10 text-[var(--color-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h4 className="text-sm font-semibold text-[var(--color-ink)]">{emptyTitle}</h4>
        <p className="mt-1 text-xs text-[var(--color-muted)] max-w-xs">{emptyDescription}</p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-border)] text-left text-sm" role="table">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]",
                    column.headerClassName
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((row, index) => (
              <tr
                key={rowKey ? rowKey(row, index) : index}
                className="transition-colors duration-150 hover:bg-slate-50/50"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-5 py-4 align-top", column.className)}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
