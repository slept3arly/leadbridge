"use client";

import { Pagination } from "@/components/pagination";
import { SearchToolbar } from "@/components/search-toolbar";
import { LeadFilters } from "@/components/lead-filters";
import { useTableQuery, type TableQueryState } from "@/hooks/use-table-query";

export function SalesTableControls({
  initial,
  pagination,
  isAdmin,
  currentUserId,
}: {
  initial: Partial<TableQueryState>;
  pagination?: { page: number; totalPages: number };
  isAdmin: boolean;
  currentUserId: string;
}) {
  const query = useTableQuery(initial);

  return (
    <div className="space-y-4">
      <SearchToolbar
        value={query.search}
        onChange={(value) => query.update({ search: value })}
      />
      <LeadFilters query={query} isAdmin={isAdmin} currentUserId={currentUserId} />
      {pagination ? (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onChange={(page) => query.update({ page })}
        />
      ) : null}
    </div>
  );
}
