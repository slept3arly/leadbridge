"use client";

import { Pagination } from "@/components/pagination";
import { TableControls } from "@/components/table-controls";
import { useTableQuery, type TableQueryState } from "@/hooks/use-table-query";

export function ServerTableControls({ initial, pagination, filters = [] }: { initial: Partial<TableQueryState>; pagination?: { page: number; totalPages: number }; filters?: Parameters<typeof TableControls>[0]["filters"] }) {
  const query = useTableQuery(initial);
  return <div className="space-y-3"><TableControls query={query} filters={filters} />{pagination ? <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => query.update({ page })} /> : null}</div>;
}
