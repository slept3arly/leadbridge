import { DataTable } from "@/components/data-table";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { requireSession } from "@/lib/session";
import { leadService } from "@/services/lead.service";

export default async function SalesMyLeadsPage() {
  const { user } = await requireSession("SALES");
  const leads = await leadService.list(user.id);

  return (
    <>
      <Navbar title="My Leads" />
      {leads.length ? (
        <DataTable
          rows={leads}
          columns={[
            { key: "lead", header: "Lead", render: (lead) => <div><p className="font-semibold">{lead.name}</p><p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p></div> },
            { key: "contact", header: "Contact", render: (lead) => lead.email ?? lead.phone ?? "-" },
            { key: "status", header: "Status", render: (lead) => <Badge label={lead.status} /> },
            { key: "priority", header: "Priority", render: (lead) => <Badge label={lead.priority} /> },
            { key: "createdAt", header: "Created", render: (lead) => formatDate(lead.createdAt) },
          ]}
        />
      ) : (
        <EmptyState title="No assigned leads" description="Assigned leads will appear here for the sales team." />
      )}
    </>
  );
}
