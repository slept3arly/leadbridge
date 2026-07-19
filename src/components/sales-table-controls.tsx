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
  canArchive = false,
}: {
  initial: Partial<TableQueryState>;
  pagination?: { page: number; totalPages: number };
  isAdmin: boolean;
  currentUserId: string;
  canArchive?: boolean;
}) {
  const query = useTableQuery(initial);

  return (
    <div className="space-y-4">
      <SearchToolbar
        value={query.search}
        onChange={(value) => query.update({ search: value })}
      />
      <LeadFilters query={query} isAdmin={isAdmin} currentUserId={currentUserId} canArchive={canArchive} />
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
