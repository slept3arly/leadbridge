"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTableQuery, type TableQueryState } from "@/hooks/use-table-query";

export function TableControls({ query, onChange, filters = [] }: { query: ReturnType<typeof useTableQuery>; onChange?: (next: Partial<TableQueryState>) => void; filters?: Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }> }) {
  const update = onChange ?? query.update;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input value={query.search} onChange={(event) => update({ search: event.target.value })} placeholder="Search leads..." className="max-w-xs" />
      <Select value={String(query.pageSize)} onChange={(event) => update({ pageSize: Number(event.target.value), page: 1 })} className="w-36">
        <option value="25">25 per page</option>
        <option value="50">50 per page</option>
        <option value="100">100 per page</option>
      </Select>
      {filters.map((filter) => (
        <Select key={filter.key} value={query.filters[filter.key] ?? ""} onChange={(event) => update({ filters: { ...query.filters, [filter.key]: event.target.value }, page: 1 })} className="w-40">
          <option value="">{filter.label}</option>
          {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      ))}
    </div>
  );
}
