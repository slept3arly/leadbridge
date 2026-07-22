"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTableQuery, type TableQueryState } from "@/hooks/use-table-query";

export type FilterConfig = {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  type?: "select" | "date-preset";
};

export function TableControls({
  query,
  onChange,
  filters = [],
}: {
  query: ReturnType<typeof useTableQuery>;
  onChange?: (next: Partial<TableQueryState>) => void;
  filters?: FilterConfig[];
}) {
  const update = onChange ?? query.update;

  function setDatePreset(preset: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let dateFrom: string | undefined;
    let dateTo: string | undefined;

    switch (preset) {
      case "today":
        dateFrom = today.toISOString();
        dateTo = new Date(today.getTime() + 86400000).toISOString();
        break;
      case "yesterday":
        dateFrom = new Date(today.getTime() - 86400000).toISOString();
        dateTo = today.toISOString();
        break;
      case "last7":
        dateFrom = new Date(today.getTime() - 7 * 86400000).toISOString();
        dateTo = new Date(today.getTime() + 86400000).toISOString();
        break;
      case "last30":
        dateFrom = new Date(today.getTime() - 30 * 86400000).toISOString();
        dateTo = new Date(today.getTime() + 86400000).toISOString();
        break;
      case "thisMonth":
        dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        dateTo = new Date(today.getTime() + 86400000).toISOString();
        break;
      case "lastMonth":
        dateFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
        dateTo = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        break;
    }

    if (dateFrom) {
      update({
        filters: { ...query.filters, dateFrom, dateTo: dateTo ?? "" },
      });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        value={query.search}
        onChange={(event) => update({ search: event.target.value })}
        placeholder="Search leads..."
        className="max-w-xs"
      />

      <Select
        value={String(query.pageSize)}
        onChange={(event) => update({ pageSize: Number(event.target.value), page: 1 })}
        className="w-36"
      >
        <option value="25">25 per page</option>
        <option value="50">50 per page</option>
        <option value="100">100 per page</option>
      </Select>

      <Select
        value={query.sortBy ? `${query.sortBy}:${query.sortDirection}` : ""}
        onChange={(event) => {
          const val = event.target.value;
          if (!val) return;
          const [sortBy, sortDirection] = val.split(":");
          update({ sortBy, sortDirection: sortDirection as "asc" | "desc", page: 1 });
        }}
        className="w-44"
      >
        <option value="">Sort</option>
        <option value="createdAt:desc">Newest First</option>
        <option value="createdAt:asc">Oldest First</option>
        <option value="updatedAt:desc">Recently Updated</option>
        <option value="updatedAt:asc">Least Recently Updated</option>
        <option value="displayName:asc">Name (A-Z)</option>
        <option value="displayName:desc">Name (Z-A)</option>
        <option value="status:asc">Status (A-Z)</option>
        <option value="priority:asc">Priority (asc)</option>
        <option value="priority:desc">Priority (desc)</option>
      </Select>

      <Select
        value=""
        onChange={(event) => setDatePreset(event.target.value)}
        className="w-44"
      >
        <option value="">Date Range</option>
        <option value="today">Created Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="last7">Last 7 Days</option>
        <option value="last30">Last 30 Days</option>
        <option value="thisMonth">This Month</option>
        <option value="lastMonth">Last Month</option>
      </Select>

      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={query.filters[filter.key] ?? ""}
          onChange={(event) =>
            update({ filters: { ...query.filters, [filter.key]: event.target.value }, page: 1 })
          }
          className="w-40"
        >
          <option value="">{filter.label}</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ))}
    </div>
  );
}
