import { DataTable } from "@/components/data-table";
import { LeadDeleteButton } from "@/components/lead-delete-button";
import { LeadForm } from "@/components/lead-form";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { leadService } from "@/services/lead.service";

export default async function AdminLeadsPage() {
  const leads = await leadService.list();

  return (
    <>
      <Navbar title="Lead Management" />
      <Card>
        <h2 className="text-xl font-semibold">Create lead</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Version 1 ships with manual lead entry and CRUD foundations for future ingestion pipelines.</p>
        <div className="mt-6"><LeadForm /></div>
      </Card>
      {leads.length ? (
        <DataTable
          rows={leads}
          columns={[
            { key: "name", header: "Lead", render: (lead) => <div><p className="font-semibold">{lead.name}</p><p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p></div> },
            { key: "contact", header: "Contact", render: (lead) => <div><p>{lead.email ?? "-"}</p><p className="text-xs text-[var(--color-muted)]">{lead.phone ?? "-"}</p></div> },
            { key: "status", header: "Status", render: (lead) => <div className="flex gap-2"><Badge label={lead.status} /><Badge label={lead.priority} /></div> },
            { key: "owner", header: "Assigned", render: (lead) => lead.assignedUser?.name ?? "Unassigned" },
            { key: "createdAt", header: "Created", render: (lead) => formatDate(lead.createdAt) },
            { key: "actions", header: "Actions", render: (lead) => <LeadDeleteButton leadId={lead.id} /> },
          ]}
        />
      ) : (
        <EmptyState title="No leads yet" description="Create your first lead to initialize the CRM workflow." />
      )}
    </>
  );
}
