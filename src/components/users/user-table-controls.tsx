"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { Pagination } from "@/components/ui/pagination";
import { SearchToolbar } from "@/components/shared/search-toolbar";
import { Select } from "@/components/ui/select";
import { ActiveFilters } from "@/components/shared/active-filters";
import { Filter, X, Plus } from "lucide-react";
import { useTableQuery, type TableQueryState } from "@/hooks/use-table-query";

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest Created" },
  { value: "createdAt:asc", label: "Oldest Created" },
  { value: "lastSeenAt:desc", label: "Recently Active" },
  { value: "name:asc", label: "Name A-Z" },
  { value: "name:desc", label: "Name Z-A" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function dateToInput(value: string | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export function UserTableControls({
  initial,
  pagination,
  actions,
}: {
  initial: Partial<TableQueryState>;
  pagination?: { page: number; totalPages: number };
  actions?: ReactNode;
}) {
  const query = useTableQuery(initial);
  const [filterOpen, setFilterOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterOpen]);

  const setFilter = (key: string, value: string) => {
    if (value) {
      query.update({ filters: { ...query.filters, [key]: value }, page: 1 });
    } else {
      const next = { ...query.filters };
      delete next[key];
      query.update({ filters: next, page: 1 });
    }
  };

  const handleDateChange = (field: "dateFrom" | "dateTo", value: string) => {
    query.update({
      [field]: value ? new Date(value + "T" + (field === "dateTo" ? "23:59:59" : "00:00:00")).toISOString() : undefined,
      page: 1,
    });
  };

  const handleSortChange = (value: string) => {
    if (!value) return;
    const [sortBy, sortDirection] = value.split(":");
    query.update({ sortBy, sortDirection: sortDirection as "asc" | "desc", page: 1 });
  };

  const activeFilterLabels = useMemo(() => {
    const labels: Array<{ key: string; label: string }> = [];
    if (query.filters.role) {
      labels.push({ key: "role", label: `Role: ${query.filters.role}` });
    }
    if (query.filters.salesPrivilege) {
      labels.push({ key: "salesPrivilege", label: `Privilege: ${query.filters.salesPrivilege}` });
    }
    if (query.filters.active) {
      labels.push({ key: "active", label: query.filters.active === "true" ? "Active only" : "Inactive only" });
    }
    if (query.dateFrom) {
      const d = new Date(query.dateFrom);
      labels.push({
        key: "dateFrom",
        label: `From: ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      });
    }
    if (query.dateTo) {
      const d = new Date(query.dateTo);
      labels.push({
        key: "dateTo",
        label: `To: ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      });
    }
    return labels;
  }, [query.filters, query.dateFrom, query.dateTo]);

  const resetAll = () => {
    query.update({
      filters: {}, dateFrom: undefined, dateTo: undefined,
      sortBy: undefined, sortDirection: "desc", page: 1,
    });
  };

  const removeFilter = (key: string) => {
    if (key === "dateFrom" || key === "dateTo") {
      query.update({ [key]: undefined, page: 1 });
    } else {
      setFilter(key, "");
    }
  };

  const currentSortValue: SortValue = query.sortBy
    ? `${query.sortBy}:${query.sortDirection}` as SortValue
    : "createdAt:desc";

  const activeFilterCount = activeFilterLabels.length;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <SearchToolbar
            value={query.search}
            onChange={(value) => query.update({ search: value })}
            placeholder="Search users..."
          />
        </div>
        {actions && (
          <div className="shrink-0">{actions}</div>
        )}
        <div className="relative shrink-0">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-slate-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 h-10"
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] text-white min-w-5 h-5 px-1.5 text-[11px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {filterOpen && (
            <div
              ref={panelRef}
              className="absolute right-0 top-full z-50 mt-2 w-[90vw] sm:w-[640px] lg:w-[720px] max-w-[calc(100vw-1rem)] rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">Filters</h3>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5">
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Sort
                  </p>
                  <Select
                    value={currentSortValue}
                    onChange={(e) => handleSortChange(e.target.value)}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Role
                  </p>
                  <Select
                    value={query.filters.role ?? ""}
                    onChange={(e) => setFilter("role", e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SALES">Sales</option>
                  </Select>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Sales Privilege
                  </p>
                  <Select
                    value={query.filters.salesPrivilege ?? ""}
                    onChange={(e) => setFilter("salesPrivilege", e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="JUNIOR">Junior</option>
                    <option value="SENIOR">Senior</option>
                  </Select>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Status
                  </p>
                  <Select
                    value={query.filters.active ?? ""}
                    onChange={(e) => setFilter("active", e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    From
                  </p>
                  <input
                    type="date"
                    value={dateToInput(query.dateFrom)}
                    onChange={(e) => handleDateChange("dateFrom", e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 h-10 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    To
                  </p>
                  <input
                    type="date"
                    value={dateToInput(query.dateTo)}
                    onChange={(e) => handleDateChange("dateTo", e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 h-10 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Page Size
                  </p>
                  <Select
                    value={String(query.pageSize)}
                    onChange={(e) => query.update({ pageSize: Number(e.target.value), page: 1 })}
                  >
                    <option value="25">25 / page</option>
                    <option value="50">50 / page</option>
                    <option value="100">100 / page</option>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ActiveFilters
        filters={activeFilterLabels}
        onRemove={removeFilter}
        onReset={resetAll}
      />

      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onChange={(page) => query.update({ page })}
        />
      )}
    </div>
  );
}
