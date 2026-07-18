import { DataTable } from "@/components/data-table";
import { Navbar } from "@/components/navbar";
import { LeadActions } from "@/components/lead-actions";
import { SalesTableControls } from "@/components/sales-table-controls";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { requireSession } from "@/lib/session";
import { leadService } from "@/services/lead.service";
import { parseListQuery, toSearchParams } from "@/lib/query-builder";
import { getCategoryLabel } from "@/lib/lead-constants";
import type { TableQueryState } from "@/hooks/use-table-query";

type LeadRow = {
  id: string; name: string; company: string | null; email: string | null;
  phone: string | null; status: string; priority: string;
  category: string | null;
  createdAt: Date; updatedAt: Date;
  lastFollowUpAt: Date | null;
  nextFollowUpAt: Date | null;
};

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default async function SalesMyLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireSession("SALES");
  const query = parseListQuery(toSearchParams(await searchParams));
  const result = await leadService.listPage(query, user);
  const leads = result.data;

  const tableInitial: Partial<TableQueryState> = {
    search: query.search ?? "",
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    filters: Object.fromEntries(
      Object.entries(query.filters).map(([key, value]) => [key, value.join(",")])
    ),
    dateFrom: query.dateFrom?.toISOString(),
    dateTo: query.dateTo?.toISOString(),
  };

  return (
    <>
      <Navbar title="My Leads" showResync />
      <SalesTableControls
        initial={tableInitial}
        pagination={result.pagination}
        isAdmin={user.role === "ADMIN"}
        currentUserId={user.id}
      />
      {leads.length ? (
        <DataTable
          rows={leads}
          columns={[
            {
              key: "lead",
              header: "Lead",
              render: (lead: LeadRow) => (
                <div>
                  <p className="font-semibold">{lead.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p>
                </div>
              ),
            },
            {
              key: "contact",
              header: "Contact",
              render: (lead: LeadRow) => lead.email ?? lead.phone ?? "-",
            },
            {
              key: "status",
              header: "Status",
              render: (lead: LeadRow) => <Badge label={lead.status} />,
            },
            {
              key: "priority",
              header: "Priority",
              render: (lead: LeadRow) => <Badge label={lead.priority} />,
            },
            {
              key: "category",
              header: "Category",
              render: (lead: LeadRow) => lead.category ? <Badge label={getCategoryLabel(lead.category)} /> : <span className="text-xs text-[var(--color-muted)]">-</span>,
            },
            {
              key: "createdAt",
              header: "Created",
              render: (lead: LeadRow) => formatDate(lead.createdAt),
            },
            {
              key: "updatedAt",
              header: "Last Updated",
              render: (lead: LeadRow) => (
                <span className="text-xs text-[var(--color-muted)] whitespace-nowrap">{formatDateTime(lead.updatedAt)}</span>
              ),
            },
            {
              key: "lastFollowUpAt",
              header: "Last Follow Up",
              render: (lead: LeadRow) => (
                <span className="text-xs text-[var(--color-muted)] whitespace-nowrap">
                  {lead.lastFollowUpAt ? formatDateTime(lead.lastFollowUpAt) : <span className="text-[var(--color-muted)]">-</span>}
                </span>
              ),
            },
            {
              key: "nextFollowUpAt",
              header: "Next Follow Up",
              render: (lead: LeadRow) => {
                if (!lead.nextFollowUpAt) return <span className="text-xs text-[var(--color-muted)]">-</span>;
                const isOverdue = new Date(lead.nextFollowUpAt) < new Date();
                return (
                  <span className={`text-xs whitespace-nowrap ${isOverdue ? "text-red-600 font-medium" : "text-[var(--color-muted)]"}`}>
                    {formatDateTime(lead.nextFollowUpAt)}
                    {isOverdue && (
                      <span className="ml-1.5 inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Overdue</span>
                    )}
                  </span>
                );
              },
            },
            {
              key: "actions",
              header: "Actions",
              render: (lead: LeadRow) => (
                <LeadActions
                  lead={lead}
                  currentUserId={user.id}
                  isAdmin={user.role === "ADMIN"}
                />
              ),
            },
          ]}
        />
      ) : (
        <EmptyState
          title="No leads found"
          description="Try adjusting your filters or create a new lead."
        />
      )}
    </>
  );
}
