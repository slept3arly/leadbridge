import { Navbar } from "@/components/navbar";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/data-table";
import { LeadActions } from "@/components/lead-actions";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { requireSession } from "@/lib/session";
import { leadService } from "@/services/lead.service";

export default async function SalesTasksPage() {
  const { user } = await requireSession("SALES");
  const leads = await leadService.listFollowUps(user);
  return (
    <>
      <Navbar title="Tasks" />
      {leads.length ? <DataTable rows={leads} columns={[{ key: "lead", header: "Lead", render: (lead) => <div><p className="font-semibold">{lead.name}</p><p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p></div> }, { key: "followUp", header: "Follow-up", render: (lead) => lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "-" }, { key: "status", header: "Status", render: (lead) => <Badge label={lead.status} /> }, { key: "actions", header: "Actions", render: (lead) => <LeadActions lead={lead} /> }]} /> : <EmptyState title="No scheduled follow-ups" description="Schedule a follow-up from an assigned lead to see it here." />}
    </>
  );
}
