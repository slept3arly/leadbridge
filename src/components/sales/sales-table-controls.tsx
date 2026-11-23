"use client";

import { useState, useEffect, useMemo, type TransitionStartFunction } from "react";
import { SearchToolbar } from "@/components/shared/search-toolbar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FilterChip } from "@/components/ui/filter-chip";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FilterPopover } from "@/components/ui/filter-popover";
import { ExportButton } from "@/components/shared/export-button";
import { Filter, X, RotateCcw } from "lucide-react";
import { useTableQuery, type TableQueryState } from "@/hooks/use-table-query";
import { formatDate } from "@/lib/utils";
import { getContextualExportParamsFromState } from "@/lib/export/ui";
import { ACTIVITY_ACTION_OPTIONS, ACTIVITY_INTEREST_OPTIONS, ACTIVITY_RESPONSE_OPTIONS } from "@/lib/activity-options";
import {
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  LEAD_CATEGORIES,
} from "@/lib/lead-constants";

const FOLLOW_UP_OPTIONS = [
  { value: "", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
] as const;

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest Created" },
  { value: "createdAt:asc", label: "Oldest Created" },
  { value: "updatedAt:desc", label: "Recently Updated" },
  { value: "updatedAt:asc", label: "Oldest Updated" },
  { value: "displayName:asc", label: "Name (A-Z)" },
  { value: "displayName:desc", label: "Name (Z-A)" },
  { value: "priority:desc", label: "Priority (High → Low)" },
  { value: "priority:asc", label: "Priority (Low → High)" },
  { value: "nextFollowUpAt:asc", label: "Next Follow-up" },
  { value: "nextFollowUpAt:desc", label: "Furthest Follow-up" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function dateToInput(value: string | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export function SalesTableControls({
  initial,
  pagination,
  leadSources,
  assignableUsers,
  adminMode = false,
  showExportShortcut = false,
  actions,
  startTransition,
}: {
  initial: Partial<TableQueryState>;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  leadSources: Array<{ id: string; name: string }>;
  assignableUsers?: Array<{ id: string; name: string }>;
  adminMode?: boolean;
  showExportShortcut?: boolean;
  actions?: React.ReactNode;
  startTransition?: TransitionStartFunction;
}) {
  const query = useTableQuery(initial, 300, startTransition);
  const exportContext = getContextualExportParamsFromState("leads", query);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const followUp = query.filters.followUp ?? "";
  const assignedQuickFilter = query.filters.assignedUserId === "unassigned"
    ? "unassigned"
    : query.filters.assignedUserId
      ? "__assigned__"
      : "";

  const handleFollowUpChange = (value: string) => {
    if (value) {
      query.update({ filters: { ...query.filters, followUp: value }, page: 1 });
    } else {
      const next = { ...query.filters };
      delete next.followUp;
      query.update({ filters: next, page: 1 });
    }
  };

  const setFilter = (key: string, value: string) => {
    if (value) {
      query.update({ filters: { ...query.filters, [key]: value }, page: 1 });
    } else {
      const next = { ...query.filters };
      delete next[key];
      query.update({ filters: next, page: 1 });
    }
  };

  const handleActivityDateChange = (value: string) => {
    const next = { ...query.filters };
    if (value) {
      next.activityDate = value;
    } else {
      delete next.activityDate;
    }
    const updatePayload: Partial<TableQueryState> = {
      filters: next,
      page: 1,
    };
    if (value !== "custom") {
      updatePayload.dateFrom = undefined;
      updatePayload.dateTo = undefined;
    }
    query.update(updatePayload);
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
    if (query.filters.assignedUserId === "unassigned") {
      labels.push({ key: "assignedUserId", label: "Unassigned" });
    } else if (query.filters.assignedUserId) {
      const user = assignableUsers?.find((item) => item.id === query.filters.assignedUserId);
      labels.push({ key: "assignedUserId", label: `Assigned: ${user?.name ?? query.filters.assignedUserId}` });
    }
    if (adminMode && query.filters.followUp) {
      const followUpLabel = query.filters.followUp === "new"
        ? "No Follow-up Yet"
        : query.filters.followUp[0].toUpperCase() + query.filters.followUp.slice(1);
      labels.push({ key: "followUp", label: `Follow-up: ${followUpLabel}` });
    }
    if (query.filters.archived === "true") {
      labels.push({ key: "archived", label: "Showing archived" });
    }
    if (query.filters.activityDate) {
      const dateLabelMap: Record<string, string> = {
        today: "Today",
        yesterday: "Yesterday",
        custom: "Custom",
      };
      labels.push({
        key: "activityDate",
        label: `Activity: ${dateLabelMap[query.filters.activityDate] ?? query.filters.activityDate}`,
      });
    }
    if (query.dateFrom) {
      labels.push({
        key: "dateFrom",
        label: `From: ${formatDate(query.dateFrom, "-", hydrated ? undefined : "UTC")}`,
      });
    }
    if (query.dateTo) {
      labels.push({
        key: "dateTo",
        label: `To: ${formatDate(query.dateTo, "-", hydrated ? undefined : "UTC")}`,
      });
    }
    if (query.filters.activityAction) {
      const opt = ACTIVITY_ACTION_OPTIONS.find((o) => o.value === query.filters.activityAction);
      labels.push({ key: "activityAction", label: `Action: ${opt?.label ?? query.filters.activityAction}` });
    }
    if (query.filters.activityResponse) {
      const opt = ACTIVITY_RESPONSE_OPTIONS.find((o) => o.value === query.filters.activityResponse);
      labels.push({ key: "activityResponse", label: `Response: ${opt?.label ?? query.filters.activityResponse}` });
    }
    if (query.filters.activityInterest) {
      const opt = ACTIVITY_INTEREST_OPTIONS.find((o) => o.value === query.filters.activityInterest);
      labels.push({ key: "activityInterest", label: `Interest: ${opt?.label ?? query.filters.activityInterest}` });
    }
    return labels;
  }, [query.filters, query.dateFrom, query.dateTo, leadSources, assignableUsers, adminMode, hydrated]);

  const resetAll = () => {
    query.update({
      filters: {},
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: undefined,
      sortDirection: "desc",
      page: 1,
    });
  };

  const removeFilter = (key: string) => {
    if (key === "dateFrom" || key === "dateTo") {
      query.update({ [key]: undefined, page: 1 });
    } else if (key === "activityDate") {
      const next = { ...query.filters };
      delete next.activityDate;
      query.update({ filters: next, dateFrom: undefined, dateTo: undefined, page: 1 });
    } else if (key === "archived") {
      const next = { ...query.filters };
      delete next.archived;
      query.update({ filters: next, page: 1 });
    } else {
      setFilter(key, "");
    }
  };

  const currentSortValue: SortValue = query.sortBy
    ? (`${query.sortBy}:${query.sortDirection}` as SortValue)
    : "createdAt:desc";

  const activeFilterCount = activeFilterLabels.length;
  const filterTrigger = (
    <button
      type="button"
      aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-slate-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
    >
      <Filter size={16} />
      Filters
      {activeFilterCount > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] text-white min-w-5 h-5 px-1.5 text-[11px] font-bold">
          {activeFilterCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Search + Filter row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <SearchToolbar
            value={query.search}
            ariaLabel="Search leads"
            onChange={(value) => query.update({ search: value })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {showExportShortcut && <ExportButton type="leads" params={exportContext.params} disabledReason={exportContext.error} iconOnly />}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        <div className="shrink-0">
          <FilterPopover
            open={filterOpen}
            onOpenChange={setFilterOpen}
            contentClassName="mt-0 w-[90vw] sm:w-[640px] lg:w-[720px]"
            trigger={filterTrigger}
          >

            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">Filters</h3>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  aria-label="Close filters"
                  className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
                {/* SORT */}
                <div>
                  <label id="leads-filter-sort-label" htmlFor="leads-filter-sort" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Sort
                  </label>
                  <Select
                    id="leads-filter-sort"
                    aria-labelledby="leads-filter-sort-label"
                    value={currentSortValue}
                    onChange={(e) => handleSortChange(e.target.value)}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* STATUS */}
                <div>
                  <label id="leads-filter-status-label" htmlFor="leads-filter-status" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Status
                  </label>
                  <Select
                    id="leads-filter-status"
                    aria-labelledby="leads-filter-status-label"
                    value={query.filters.status ?? ""}
                    onChange={(e) => setFilter("status", e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    {LEAD_STATUSES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* LEAD SOURCE */}
                <div>
                  <label id="leads-filter-source-label" htmlFor="leads-filter-source" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Lead Source
                  </label>
                  <Select
                    id="leads-filter-source"
                    aria-labelledby="leads-filter-source-label"
                    value={leadSources.length > 0 ? (query.filters.source ?? "") : ""}
                    onChange={(e) => setFilter("source", e.target.value)}
                    disabled={leadSources.length === 0}
                  >
                    <option value="">All Sources</option>
                    {leadSources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* ACTIVITY DATE */}
                <div>
                  <label id="leads-filter-activity-date-label" htmlFor="leads-filter-activity-date" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Activity Date
                  </label>
                  <Select
                    id="leads-filter-activity-date"
                    aria-labelledby="leads-filter-activity-date-label"
                    value={query.filters.activityDate ?? ""}
                    onChange={(e) => handleActivityDateChange(e.target.value)}
                  >
                    <option value="">Any Activity</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="custom">Custom</option>
                  </Select>
                </div>

                {/* ACTION */}
                <div>
                  <label id="leads-filter-action-label" htmlFor="leads-filter-action" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Action
                  </label>
                  <Select
                    id="leads-filter-action"
                    aria-labelledby="leads-filter-action-label"
                    value={query.filters.activityAction ?? ""}
                    onChange={(e) => setFilter("activityAction", e.target.value)}
                  >
                    <option value="">All Actions</option>
                    {ACTIVITY_ACTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* RESPONSE */}
                <div>
                  <label id="leads-filter-response-label" htmlFor="leads-filter-response" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Response
                  </label>
                  <Select
                    id="leads-filter-response"
                    aria-labelledby="leads-filter-response-label"
                    value={query.filters.activityResponse ?? ""}
                    onChange={(e) => setFilter("activityResponse", e.target.value)}
                  >
                    <option value="">All Responses</option>
                    {ACTIVITY_RESPONSE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* PRIORITY */}
                <div>
                  <label id="leads-filter-priority-label" htmlFor="leads-filter-priority" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Priority
                  </label>
                  <Select
                    id="leads-filter-priority"
                    aria-labelledby="leads-filter-priority-label"
                    value={query.filters.priority ?? ""}
                    onChange={(e) => setFilter("priority", e.target.value)}
                  >
                    <option value="">All Priorities</option>
                    {LEAD_PRIORITIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* CATEGORY */}
                <div>
                  <label id="leads-filter-category-label" htmlFor="leads-filter-category" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Category
                  </label>
                  <Select
                    id="leads-filter-category"
                    aria-labelledby="leads-filter-category-label"
                    value={query.filters.category ?? ""}
                    onChange={(e) => setFilter("category", e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {LEAD_CATEGORIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* INTEREST */}
                <div>
                  <label id="leads-filter-interest-label" htmlFor="leads-filter-interest" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Interest
                  </label>
                  <Select
                    id="leads-filter-interest"
                    aria-labelledby="leads-filter-interest-label"
                    value={query.filters.activityInterest ?? ""}
                    onChange={(e) => setFilter("activityInterest", e.target.value)}
                  >
                    <option value="">All Interests</option>
                    {ACTIVITY_INTEREST_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* ARCHIVED */}
                <div>
                  <label id="leads-filter-archived-label" htmlFor="leads-filter-archived" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Archived
                  </label>
                  <Select
                    id="leads-filter-archived"
                    aria-labelledby="leads-filter-archived-label"
                    value={query.filters.archived === "true" ? "true" : ""}
                    onChange={(e) => setFilter("archived", e.target.value)}
                  >
                    <option value="">Hide Archived</option>
                    <option value="true">Show Archived</option>
                  </Select>
                </div>

                {adminMode && <div>
                  <label id="leads-filter-assigned-label" htmlFor="leads-filter-assigned" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Assigned To
                  </label>
                  <Select
                    id="leads-filter-assigned"
                    aria-labelledby="leads-filter-assigned-label"
                    value={query.filters.assignedUserId ?? ""}
                    onChange={(e) => setFilter("assignedUserId", e.target.value)}
                  >
                    <option value="">All Salespeople</option>
                    <option value="unassigned">Unassigned</option>
                    {assignableUsers?.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </Select>
                </div>}

                {adminMode && <div>
                  <label id="leads-filter-follow-up-label" htmlFor="leads-filter-follow-up" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Follow-up
                  </label>
                  <Select
                    id="leads-filter-follow-up"
                    aria-labelledby="leads-filter-follow-up-label"
                    value={followUp}
                    onChange={(e) => setFilter("followUp", e.target.value)}
                  >
                    <option value="">Any Follow-up</option>
                    <option value="overdue">Overdue</option>
                    <option value="today">Today</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="new">No Follow-up Yet</option>
                  </Select>
                </div>}

                {/* Admin can also filter lead creation dates; custom activity dates use the same server range. */}
                {(adminMode || query.filters.activityDate === "custom") && (
                  <>
                    <div>
                      <label htmlFor="leads-filter-date-from" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                        {adminMode && query.filters.activityDate !== "custom" ? "Created From" : "From"}
                      </label>
                      <input
                        id="leads-filter-date-from"
                        type="date"
                        value={dateToInput(query.dateFrom)}
                        onChange={(e) => handleDateChange("dateFrom", e.target.value)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 h-10 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label htmlFor="leads-filter-date-to" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                        {adminMode && query.filters.activityDate !== "custom" ? "Created To" : "To"}
                      </label>
                      <input
                        id="leads-filter-date-to"
                        type="date"
                        value={dateToInput(query.dateTo)}
                        onChange={(e) => handleDateChange("dateTo", e.target.value)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 h-10 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          </FilterPopover>
        </div>
        </div>
      </div>

      {/* Quick-filter row: SegmentedControl + Active Filters + Pagination */}
      <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {adminMode && <SegmentedControl
            ariaLabel="Lead assignment"
            options={[{ value: "", label: "All Leads" }, { value: "unassigned", label: "Unassigned" }]}
            value={assignedQuickFilter}
            onChange={(value) => {
              const next = { ...query.filters };
              if (value) next.assignedUserId = value;
              else delete next.assignedUserId;
              query.update({ filters: next, page: 1 });
            }}
          />}
          {!adminMode && <SegmentedControl
            ariaLabel="Follow-up date"
            options={FOLLOW_UP_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            value={followUp}
            onChange={handleFollowUpChange}
          />}
        </div>
        {pagination && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-muted)] whitespace-nowrap">
              {pagination.total === 0 ? "Showing 0 of 0" : `Showing ${(pagination.page - 1) * pagination.pageSize + 1}\u2013${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}`}
            </span>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => query.update({ page: pagination.page - 1 })}
                  aria-label="Previous page"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </Button>
                <span className="text-sm text-[var(--color-muted)] tabular-nums">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => query.update({ page: pagination.page + 1 })}
                  aria-label="Next page"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      {activeFilterLabels.length > 0 && <div className="flex flex-wrap items-center gap-2">
        {activeFilterLabels.map((filter) => <FilterChip key={filter.key} label={filter.label} onRemove={() => removeFilter(filter.key)} />)}
        <Button variant="ghost" size="sm" onClick={resetAll} className="shrink-0">
          <RotateCcw size={12} /> Reset
        </Button>
      </div>}
      </div>
    </div>
  );
}
