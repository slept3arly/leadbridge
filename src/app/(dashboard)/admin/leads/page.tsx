import { DataTable } from "@/components/shared/data-table";
import { LeadActions } from "@/components/shared/lead-actions";
import { LeadRestoreButton } from "@/components/admin/lead-restore-button";
import { ServerTableControls } from "@/components/admin/server-table-controls";
import { LeadForm } from "@/components/admin/lead-form";
import { Navbar } from "@/components/shared/navbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/shared/export-button";
import { formatDate } from "@/lib/utils";
import { LEAD_STATUSES, LEAD_PRIORITIES } from "@/lib/lead-constants";
import { leadService } from "@/services/lead.service";
import { userService } from "@/services/user.service";
import { parseListQuery, toSearchParams } from "@/lib/query-builder";

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseListQuery(toSearchParams(await searchParams));
  const [result, deletedResult, assignableUsers] = await Promise.all([
    leadService.listPage(query),
    leadService.listPage(parseListQuery(new URLSearchParams("filter.deleted=true"))),
    userService.listAssignable(),
  ]);
  const leads = result.data;

  return (
    <>
      <Navbar title="Lead Management" actions={<ExportButton type="leads" />} />
      <Card>
        <h2 className="text-xl font-semibold">Create lead</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Version 1 ships with manual lead entry and CRUD foundations for future ingestion pipelines.</p>
        <div className="mt-6"><LeadForm /></div>
      </Card>
      <ServerTableControls initial={{ search: query.search ?? "", page: query.page, pageSize: query.pageSize, sortBy: query.sortBy, sortDirection: query.sortDirection, filters: Object.fromEntries(Object.entries(query.filters).map(([key, value]) => [key, value.join(",")])) }} pagination={result.pagination} filters={[{ key: "status", label: "Status", options: LEAD_STATUSES.map((status) => ({ value: status.value, label: status.label })) }, { key: "priority", label: "Priority", options: LEAD_PRIORITIES.map((priority) => ({ value: priority.value, label: priority.label })) }]} />
      {leads.length ? (
        <DataTable
          rows={leads}
          columns={[
            { key: "name", header: "Lead", render: (lead) => <div><p className="font-semibold">{lead.name}</p><p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p></div> },
            { key: "contact", header: "Contact", render: (lead) => <div><p>{lead.email ?? "-"}</p><p className="text-xs text-[var(--color-muted)]">{lead.phone ?? "-"}</p></div> },
            { key: "status", header: "Status", render: (lead) => <div className="flex gap-2"><Badge label={lead.status} /><Badge label={lead.priority} /></div> },
            { key: "owner", header: "Assigned", render: (lead) => lead.assignedUser?.name ?? "Unassigned" },
            { key: "createdAt", header: "Created", render: (lead) => formatDate(lead.createdAt) },
            { key: "actions", header: "", render: (lead) => <LeadActions lead={lead} canDelete canArchive assignableUsers={assignableUsers} /> },
          ]}
        />
      ) : (
        <EmptyState title="No leads yet" description="Create your first lead above." />
      )}
      {deletedResult.data.length ? (
        <div className="space-y-3">
          <div className="border-t border-[var(--color-border)] pt-6"><h3 className="font-semibold">Recently deleted</h3><p className="text-sm text-[var(--color-muted)]">These leads can be restored within the retention window.</p></div>
          <DataTable rows={deletedResult.data} columns={[
            { key: "name", header: "Lead", render: (lead) => <div><p className="font-semibold">{lead.name}</p><p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p></div> },
            { key: "contact", header: "Contact", render: (lead) => lead.email ?? "-" },
            { key: "status", header: "Status", render: (lead) => <Badge label={lead.status} /> },
            { key: "actions", header: "", render: (lead) => <LeadRestoreButton leadId={lead.id} /> },
          ]} />
        </div>
      ) : null}
    </>
  );
}
