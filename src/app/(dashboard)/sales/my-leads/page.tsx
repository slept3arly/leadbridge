import { DataTable } from "@/components/data-table";
import { Navbar } from "@/components/navbar";
import { LeadActions } from "@/components/lead-actions";
import { ServerTableControls } from "@/components/server-table-controls";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { requireSession } from "@/lib/session";
import { leadService } from "@/services/lead.service";
import { parseListQuery, toSearchParams } from "@/lib/query-builder";

export default async function SalesMyLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireSession("SALES");
  const query = parseListQuery(toSearchParams(await searchParams));
  const result = await leadService.listPage(query, user);
  const leads = result.data;

  return (
    <>
      <Navbar title="My Leads" />
      <ServerTableControls initial={{ search: query.search ?? "", page: query.page, pageSize: query.pageSize, sortBy: query.sortBy, sortDirection: query.sortDirection, filters: Object.fromEntries(Object.entries(query.filters).map(([key, value]) => [key, value.join(",")])) }} pagination={result.pagination} filters={[{ key: "status", label: "Status", options: ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"].map((value) => ({ value, label: value })) }, { key: "priority", label: "Priority", options: ["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => ({ value, label: value })) }]} />
      {leads.length ? (
        <DataTable
          rows={leads}
          columns={[
            { key: "lead", header: "Lead", render: (lead) => <div><p className="font-semibold">{lead.name}</p><p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p></div> },
            { key: "contact", header: "Contact", render: (lead) => lead.email ?? lead.phone ?? "-" },
            { key: "status", header: "Status", render: (lead) => <Badge label={lead.status} /> },
            { key: "priority", header: "Priority", render: (lead) => <Badge label={lead.priority} /> },
            { key: "createdAt", header: "Created", render: (lead) => formatDate(lead.createdAt) },
            { key: "actions", header: "Actions", render: (lead) => <LeadActions lead={lead} /> },
          ]}
        />
      ) : (
        <EmptyState title="No assigned leads" description="Assigned leads will appear here for the sales team." />
      )}
    </>
  );
}
