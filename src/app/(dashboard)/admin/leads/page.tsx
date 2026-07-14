import { DataTable } from "@/components/data-table";
import { LeadActions } from "@/components/lead-actions";
import { LeadRestoreButton } from "@/components/lead-restore-button";
import { ServerTableControls } from "@/components/server-table-controls";
import { LeadForm } from "@/components/lead-form";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
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
      <Navbar title="Lead Management" />
      <Card>
        <h2 className="text-xl font-semibold">Create lead</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Version 1 ships with manual lead entry and CRUD foundations for future ingestion pipelines.</p>
        <div className="mt-6"><LeadForm /></div>
      </Card>
      <ServerTableControls initial={{ search: query.search ?? "", page: query.page, pageSize: query.pageSize, sortBy: query.sortBy, sortDirection: query.sortDirection, filters: Object.fromEntries(Object.entries(query.filters).map(([key, value]) => [key, value.join(",")])) }} pagination={result.pagination} filters={[{ key: "status", label: "Status", options: ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"].map((value) => ({ value, label: value })) }, { key: "priority", label: "Priority", options: ["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => ({ value, label: value })) }]} />
      {leads.length ? (
        <DataTable
          rows={leads}
          columns={[
            { key: "name", header: "Lead", render: (lead) => <div><p className="font-semibold">{lead.name}</p><p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p></div> },
            { key: "contact", header: "Contact", render: (lead) => <div><p>{lead.email ?? "-"}</p><p className="text-xs text-[var(--color-muted)]">{lead.phone ?? "-"}</p></div> },
            { key: "status", header: "Status", render: (lead) => <div className="flex gap-2"><Badge label={lead.status} /><Badge label={lead.priority} /></div> },
            { key: "owner", header: "Assigned", render: (lead) => lead.assignedUser?.name ?? "Unassigned" },
            { key: "createdAt", header: "Created", render: (lead) => formatDate(lead.createdAt) },
            { key: "actions", header: "Actions", render: (lead) => <LeadActions lead={lead} assignableUsers={assignableUsers} canAssign canDelete /> },
          ]}
        />
      ) : (
        <EmptyState title="No leads yet" description="Create your first lead to initialize the CRM workflow." />
      )}
      {deletedResult.data.length ? <Card><h2 className="mb-3 text-lg font-semibold">Recently deleted</h2>{deletedResult.data.map((lead) => <div key={lead.id} className="flex items-center justify-between border-b py-3 last:border-0"><span>{lead.name}</span><LeadRestoreButton leadId={lead.id} /></div>)}</Card> : null}
    </>
  );
}
