"use client";

import { useState, useMemo } from "react";
import { Select } from "@/components/ui/select";
import { DateRangePicker } from "@/components/date-range-picker";
import { ActiveFilters } from "@/components/active-filters";
import { ArchivedLeadsModal } from "@/components/archived-leads-modal";
import { LeadDetailsModal } from "@/components/lead-details-modal";
import { Button } from "@/components/ui/button";
import { Archive } from "lucide-react";
import { LEAD_STATUSES, LEAD_PRIORITIES, LEAD_CATEGORIES } from "@/lib/lead-constants";
import type { TableQueryState } from "@/hooks/use-table-query";

type LeadFiltersProps = {
  query: TableQueryState & { update: (next: Partial<TableQueryState>) => void };
  isAdmin: boolean;
  currentUserId: string;
  canArchive?: boolean;
};

const filterClass = "w-full sm:w-[135px]";

export function LeadFilters({ query, isAdmin, currentUserId, canArchive = false }: LeadFiltersProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  const setFilter = (key: string, value: string) => {
    if (value) {
      query.update({ filters: { ...query.filters, [key]: value }, page: 1 });
    } else {
      const next = { ...query.filters };
      delete next[key];
      query.update({ filters: next, page: 1 });
    }
  };

  const handleDateChange = ({ dateFrom, dateTo }: { dateFrom?: Date; dateTo?: Date }) => {
    query.update({
      dateFrom: dateFrom?.toISOString(),
      dateTo: dateTo?.toISOString(),
      page: 1,
    });
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
      filters: {},
      dateFrom: undefined,
      dateTo: undefined,
      page: 1,
    });
  };

  const removeFilter = (key: string) => {
    if (key === "dateFrom" || key === "dateTo") {
      query.update({ [key]: undefined, page: 1 });
    } else {
      setFilter(key, "");
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3 lg:flex-nowrap">
        <Select
          value={String(query.pageSize)}
          onChange={(event) => query.update({ pageSize: Number(event.target.value), page: 1 })}
          className={filterClass}
        >
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </Select>

        <Select
          value={query.sortBy ? `${query.sortBy}:${query.sortDirection}` : ""}
          onChange={(event) => {
            const val = event.target.value;
            if (!val) return;
            const [sortBy, sortDirection] = val.split(":");
            query.update({ sortBy, sortDirection: sortDirection as "asc" | "desc", page: 1 });
          }}
          className={filterClass}
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
          <option value="category:asc">Category (A-Z)</option>
        </Select>

        <DateRangePicker
          value={{
            dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
            dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
          }}
          onChange={handleDateChange}
        />

        <Select
          value={query.filters.status ?? ""}
          onChange={(e) => setFilter("status", e.target.value)}
          className={filterClass}
        >
          <option value="">Status</option>
          {LEAD_STATUSES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>

        <Select
          value={query.filters.priority ?? ""}
          onChange={(e) => setFilter("priority", e.target.value)}
          className={filterClass}
        >
          <option value="">Priority</option>
          {LEAD_PRIORITIES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>

        <Select
          value={query.filters.category ?? ""}
          onChange={(e) => setFilter("category", e.target.value)}
          className={filterClass}
        >
          <option value="">Category</option>
          {LEAD_CATEGORIES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>

        <Button
          variant="secondary"
          size="md"
          onClick={() => setShowArchived(true)}
          className="w-full sm:w-auto lg:ml-auto gap-2"
        >
          <Archive size={14} />
          Archived
        </Button>
      </div>

      <ActiveFilters
        filters={activeFilterLabels}
        onRemove={removeFilter}
        onReset={resetAll}
      />

      {showArchived && (
        <ArchivedLeadsModal
          isAdmin={isAdmin}
          canArchive={canArchive}
          onClose={() => setShowArchived(false)}
          onLeadClick={(leadId) => {
            setShowArchived(false);
            setDetailLeadId(leadId);
          }}
        />
      )}

      {detailLeadId && (
        <LeadDetailsModal
          leadId={detailLeadId}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          canArchive={canArchive}
          onClose={() => setDetailLeadId(null)}
        />
      )}
    </>
  );
}
