"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { Pagination } from "@/components/ui/pagination";
import { SearchToolbar } from "@/components/shared/search-toolbar";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { ActiveFilters } from "@/components/shared/active-filters";
import { Filter, X } from "lucide-react";
import { useTableQuery, type TableQueryState } from "@/hooks/use-table-query";
import {
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  LEAD_CATEGORIES,
} from "@/lib/lead-constants";

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest Created" },
  { value: "createdAt:asc", label: "Oldest Created" },
  { value: "updatedAt:desc", label: "Recently Updated" },
  { value: "priority:desc", label: "Priority (High → Low)" },
  { value: "priority:asc", label: "Priority (Low → High)" },
  { value: "status:asc", label: "Status (A-Z)" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function dateToInput(value: string | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export function LeadTableControls({
  initial,
  pagination,
  leadSources,
  assignableUsers,
  actions,
}: {
  initial: Partial<TableQueryState>;
  pagination?: { page: number; totalPages: number };
  leadSources: Array<{ id: string; name: string }>;
  assignableUsers?: Array<{ id: string; name: string }>;
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

  const handleArchivedToggle = () => {
    const current = query.filters.archived === "true";
    if (current) {
      const next = { ...query.filters };
      delete next.archived;
      query.update({ filters: next, page: 1 });
    } else {
      query.update({ filters: { ...query.filters, archived: "true" }, page: 1 });
    }
  };

  const activeFilterLabels = useMemo(() => {
    const labels: Array<{ key: string; label: string }> = [];
    if (query.filters.status) {
      const opt = LEAD_STATUSES.find((o) => o.value === query.filters.status);
      labels.push({ key: "status", label: `Status: ${opt?.label ?? query.filters.status}` });
    }
    if (query.filters.priority) {
      const opt = LEAD_PRIORITIES.find((o) => o.value === query.filters.priority);
      labels.push({ key: "priority", label: `Priority: ${opt?.label ?? query.filters.priority}` });
    }
    if (query.filters.category) {
      const opt = LEAD_CATEGORIES.find((o) => o.value === query.filters.category);
      labels.push({ key: "category", label: `Category: ${opt?.label ?? query.filters.category}` });
    }
    if (query.filters.source) {
      const opt = leadSources.find((s) => s.id === query.filters.source);
      labels.push({ key: "source", label: `Source: ${opt?.name ?? query.filters.source}` });
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
    if (query.filters.archived === "true") {
      labels.push({ key: "archived", label: "Showing archived" });
    }
    return labels;
  }, [query.filters, query.dateFrom, query.dateTo, leadSources]);

  const resetAll = () => {
    query.update({
      filters: {}, dateFrom: undefined, dateTo: undefined,
      sortBy: undefined, sortDirection: "desc", page: 1,
    });
  };

  const removeFilter = (key: string) => {
    if (key === "dateFrom" || key === "dateTo") {
      query.update({ [key]: undefined, page: 1 });
    } else if (key === "archived") {
      const next = { ...query.filters };
      delete next.archived;
      query.update({ filters: next, page: 1 });
    } else {
      setFilter(key, "");
    }
  };

  const currentSortValue: SortValue = query.sortBy
    ? `${query.sortBy}:${query.sortDirection}` as SortValue
    : "createdAt:desc";

  const activeFilterCount = activeFilterLabels.length;

  const assignmentPills = useMemo(() => {
    if (!assignableUsers?.length) return [];
    const pills: SegmentedOption<string>[] = [
      { value: "", label: "All" },
      ...assignableUsers.map((u) => ({ value: u.id, label: u.name })),
    ];
    return pills;
  }, [assignableUsers]);

  const currentAssignee = query.filters.assignedUserId ?? "";

  const handleAssigneeChange = (value: string) => {
    if (value) {
      query.update({ filters: { ...query.filters, assignedUserId: value }, page: 1 });
    } else {
      const next = { ...query.filters };
      delete next.assignedUserId;
      query.update({ filters: next, page: 1 });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <SearchToolbar
            value={query.search}
            onChange={(value) => query.update({ search: value })}
            placeholder="Search leads..."
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
                    Status
                  </p>
                  <Select
                    value={query.filters.status ?? ""}
                    onChange={(e) => setFilter("status", e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    {LEAD_STATUSES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Priority
                  </p>
                  <Select
                    value={query.filters.priority ?? ""}
                    onChange={(e) => setFilter("priority", e.target.value)}
                  >
                    <option value="">All Priorities</option>
                    {LEAD_PRIORITIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Category
                  </p>
                  <Select
                    value={query.filters.category ?? ""}
                    onChange={(e) => setFilter("category", e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {LEAD_CATEGORIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Lead Source
                  </p>
                  <Select
                    value={leadSources.length > 0 ? (query.filters.source ?? "") : ""}
                    onChange={(e) => setFilter("source", e.target.value)}
                    disabled={leadSources.length === 0}
                  >
                    <option value="">All Sources</option>
                    {leadSources.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
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
                    Archived
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer h-10">
                    <input
                      type="checkbox"
                      checked={query.filters.archived === "true"}
                      onChange={handleArchivedToggle}
                      className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]/20"
                    />
                    <span className="text-sm text-[var(--color-ink)]">Include archived</span>
                  </label>
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

      {assignmentPills.length > 0 && (
        <div className="flex justify-center sm:justify-start">
          <SegmentedControl
            options={assignmentPills}
            value={currentAssignee}
            onChange={handleAssigneeChange}
          />
        </div>
      )}

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
