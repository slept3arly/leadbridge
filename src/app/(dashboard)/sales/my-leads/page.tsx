import { DataTable } from "@/components/shared/data-table";
import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { LeadActions } from "@/components/shared/lead-actions";
import { LeadDetailDialog } from "@/components/sales/lead-detail-dialog";
import { SalesTableControls } from "@/components/sales/sales-table-controls";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/shared/export-button";
import { DateTimeCell } from "@/components/ui/date-time-cell";
import { prisma } from "@/lib/prisma";

import { requireSession } from "@/lib/session";
import { leadService } from "@/services/lead.service";
import { parseListQuery, toSearchParams } from "@/lib/query-builder";
import { getStatusLabel, getPriorityLabel, getCategoryLabel } from "@/lib/lead-constants";
import { can, Permission } from "@/lib/permissions";
import type { TableQueryState } from "@/hooks/use-table-query";

type LeadRow = {
  id: string; name: string; company: string | null; email: string | null;
  phone: string | null; status: string; priority: string;
  category: string | null;
  createdAt: Date; updatedAt: Date;
  lastFollowUpAt: Date | null;
  nextFollowUpAt: Date | null;
  followUps?: Array<{ status: string; dueDate: Date | null; completedAt: Date | null }>;
};

export default async function SalesMyLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireSession("SALES");
  const resolvedSearchParams = await searchParams;
  const query = parseListQuery(toSearchParams(resolvedSearchParams));
  const result = await leadService.listPage(query, user);
  const leads = result.data;
  const autoOpenLeadId = (resolvedSearchParams.leadId as string) || null;

  const canDelete = can(user, Permission.DELETE_LEAD);
  const canArchive = can(user, Permission.ARCHIVE_LEAD);
  const canExport = can(user, Permission.EXPORT_LEADS);

  const leadSources = await prisma.leadSource.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

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
      <Navbar
        title="My Leads"
        showResync
        actions={
          <>
            {canExport && <ExportButton type="leads" iconOnly />}
            <SignOutButton />
          </>
        }
      />
      <SalesTableControls
        initial={tableInitial}
        pagination={result.pagination}
        leadSources={leadSources}
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
              render: (lead: LeadRow) => lead.phone ?? lead.email ?? "-",
            },
            {
              key: "status",
              header: "Status",
              render: (lead: LeadRow) => <Badge label={getStatusLabel(lead.status)} toneKey={lead.status} />,
            },
            {
              key: "priority",
              header: "Priority",
              render: (lead: LeadRow) => <Badge label={getPriorityLabel(lead.priority)} toneKey={lead.priority} />,
            },
            {
              key: "category",
              header: "Category",
              render: (lead: LeadRow) => lead.category ? <Badge label={getCategoryLabel(lead.category)} toneKey={lead.category} /> : <span className="text-xs text-[var(--color-muted)]">-</span>,
            },
            {
              key: "updatedAt",
              header: "Last Updated",
              render: (lead: LeadRow) => <DateTimeCell value={lead.updatedAt} />,
            },
            {
              key: "lastFollowUpAt",
              header: "Last Follow Up",
              render: (lead: LeadRow) => {
                if (!lead.lastFollowUpAt) return <span className="text-xs text-[var(--color-muted)]">-</span>;
                const lastFu = lead.followUps?.find((f) => f.status === "COMPLETED");
                const wasOverdue = lastFu?.dueDate && lastFu.completedAt && new Date(lastFu.dueDate) < new Date(lastFu.completedAt);
                return (
                  <div className="flex items-center gap-1.5">
                    <DateTimeCell value={lead.lastFollowUpAt} />
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${
                      wasOverdue
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {wasOverdue ? "Overdue" : "Done"}
                    </span>
                  </div>
                );
              },
            },
            {
              key: "nextFollowUpAt",
              header: "Next Follow Up",
              render: (lead: LeadRow) => {
                if (!lead.nextFollowUpAt) return <span className="text-xs text-[var(--color-muted)]">-</span>;
                const isOverdue = new Date(lead.nextFollowUpAt) < new Date();
                return (
                  <div className="flex items-center gap-1.5">
                    <DateTimeCell value={lead.nextFollowUpAt} overdue={isOverdue} />
                    {isOverdue ? (
                      <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 shrink-0">Overdue</span>
                    ) : (
                      <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">Pending</span>
                    )}
                  </div>
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
                  canDelete={canDelete}
                  canArchive={canArchive}
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
      <LeadDetailDialog
        leadId={autoOpenLeadId}
        currentUserId={user.id}
        isAdmin={user.role === "ADMIN"}
        canArchive={canArchive}
      />
    </>
  );
}
