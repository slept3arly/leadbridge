"use client";

import { Input } from "@/components/ui/input";
import { useTableQuery, type TableQueryState } from "@/hooks/use-table-query";

export function TableControls({ query, onChange, filters = [] }: { query: ReturnType<typeof useTableQuery>; onChange?: (next: Partial<TableQueryState>) => void; filters?: Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }> }) {
  const update = onChange ?? query.update;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input value={query.search} onChange={(event) => update({ search: event.target.value })} placeholder="Search" className="max-w-xs" />
      <select value={query.pageSize} onChange={(event) => update({ pageSize: Number(event.target.value), page: 1 })} className="rounded-lg border px-3 py-2 text-sm">
        {[25, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}
      </select>
      {filters.map((filter) => (
        <select key={filter.key} value={query.filters[filter.key] ?? ""} onChange={(event) => update({ filters: { ...query.filters, [filter.key]: event.target.value }, page: 1 })} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">{filter.label}</option>
          {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ))}
    </div>
  );
}
