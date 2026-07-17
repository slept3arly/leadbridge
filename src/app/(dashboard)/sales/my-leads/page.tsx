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
import type { LeadPriority, LeadStatus } from "@/generated/prisma/client";

type LeadRow = {
  id: string; name: string; company: string | null; email: string | null;
  phone: string | null; status: LeadStatus; priority: LeadPriority;
  createdAt: Date; updatedAt: Date;
};

const statusOptions = [
  { value: "NEW", label: "New" },
  { value: "OPEN", label: "Open" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "ATTEMPTED_CONTACT", label: "Attempted Contact" },
  { value: "FOLLOW_UP_SCHEDULED", label: "Follow Up Scheduled" },
  { value: "INTERESTED", label: "Interested" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WAITING_FOR_CUSTOMER", label: "Waiting for Customer" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "DISQUALIFIED", label: "Disqualified" },
  { value: "SPAM", label: "Spam" },
  { value: "ARCHIVED", label: "Archived" },
];

const priorityOptions = [
  { value: "VERY_LOW", label: "Very Low" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "VERY_HIGH", label: "Very High" },
  { value: "URGENT", label: "Urgent" },
  { value: "CRITICAL", label: "Critical" },
];

export default async function SalesMyLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireSession("SALES");
  const query = parseListQuery(toSearchParams(await searchParams));
  const result = await leadService.listPage(query, user);
  const leads = result.data;

  return (
    <>
      <Navbar title="My Leads" showResync />
      <ServerTableControls
        initial={{
          search: query.search ?? "",
          page: query.page,
          pageSize: query.pageSize,
          sortBy: query.sortBy,
          sortDirection: query.sortDirection,
          filters: Object.fromEntries(
            Object.entries(query.filters).map(([key, value]) => [key, value.join(",")])
          ),
        }}
        pagination={result.pagination}
        filters={[
          { key: "status", label: "Status", options: statusOptions },
          { key: "priority", label: "Priority", options: priorityOptions },
          { key: "archived", label: "View", options: [{ value: "true", label: "Archived" }] },
        ]}
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
              key: "createdAt",
              header: "Created",
              render: (lead: LeadRow) => formatDate(lead.createdAt),
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
          title="No assigned leads"
          description="Assigned leads will appear here for the sales team."
        />
      )}
    </>
  );
}
