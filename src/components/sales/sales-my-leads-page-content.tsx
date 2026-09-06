"use client";

import { useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { LeadActions } from "@/components/shared/lead-actions";
import { LeadDetailDialog } from "@/components/sales/lead-detail-dialog";
import { SalesTableControls } from "@/components/sales/sales-table-controls";
import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DateTimeCell } from "@/components/ui/date-time-cell";
import { Plus } from "lucide-react";
import { getStatusLabel, getPriorityLabel, getCategoryLabel } from "@/lib/lead-constants";
import type { TableQueryState } from "@/hooks/use-table-query";

export type SalesLeadRow = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  priority: string;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastFollowUpAt: Date | null;
  nextFollowUpAt: Date | null;
  followUps?: Array<{ status: string; dueDate: Date | null; completedAt: Date | null }>;
};

export function SalesMyLeadsPageContent({
  leads,
  initial,
  pagination,
  leadSources,
  autoOpenLeadId,
  user,
  canDelete,
  canArchive,
  canCreate,
}: {
  leads: SalesLeadRow[];
  initial: Partial<TableQueryState>;
  pagination?: { page: number; totalPages: number };
  leadSources: Array<{ id: string; name: string }>;
  autoOpenLeadId: string | null;
  user: { id: string; role: string };
  canDelete: boolean;
  canArchive: boolean;
  canCreate: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <SalesTableControls
        initial={initial}
        pagination={pagination}
        leadSources={leadSources}
        actions={
          canCreate ? (
            <Button variant="secondary" onClick={() => setCreateOpen(true)} className="h-10">
              <Plus size={16} />
              Create Lead
            </Button>
          ) : null
        }
      />
      {leads.length ? (
        <DataTable
          rows={leads}
          columns={[
            {
              key: "lead",
              header: "Lead",
              render: (lead: SalesLeadRow) => (
                <div>
                  <p className="font-semibold">{lead.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p>
                </div>
              ),
            },
            {
              key: "contact",
              header: "Contact",
              render: (lead: SalesLeadRow) => lead.phone ?? lead.email ?? "-",
            },
            {
              key: "status",
              header: "Status",
              render: (lead: SalesLeadRow) => <Badge label={getStatusLabel(lead.status)} toneKey={lead.status} />,
            },
            {
              key: "priority",
              header: "Priority",
              render: (lead: SalesLeadRow) => <Badge label={getPriorityLabel(lead.priority)} toneKey={lead.priority} />,
            },
            {
              key: "category",
              header: "Category",
              render: (lead: SalesLeadRow) =>
                lead.category ? <Badge label={getCategoryLabel(lead.category)} toneKey={lead.category} /> : <span className="text-xs text-[var(--color-muted)]">-</span>,
            },
            {
              key: "updatedAt",
              header: "Last Updated",
              render: (lead: SalesLeadRow) => <DateTimeCell value={lead.updatedAt} />,
            },
            {
              key: "lastFollowUpAt",
              header: "Last Follow Up",
              render: (lead: SalesLeadRow) => {
                if (!lead.lastFollowUpAt) return <span className="text-xs text-[var(--color-muted)]">-</span>;
                const lastFu = lead.followUps?.find((f) => f.status === "COMPLETED");
                const wasOverdue = lastFu?.dueDate && lastFu.completedAt && new Date(lastFu.dueDate) < new Date(lastFu.completedAt);
                return (
                  <div className="flex items-center gap-1.5">
                    <DateTimeCell value={lead.lastFollowUpAt} />
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${
                        wasOverdue ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}
                    >
                      {wasOverdue ? "Overdue" : "Done"}
                    </span>
                  </div>
                );
              },
            },
            {
              key: "nextFollowUpAt",
              header: "Next Follow Up",
              render: (lead: SalesLeadRow) => {
                if (!lead.nextFollowUpAt) return <span className="text-xs text-[var(--color-muted)]">-</span>;
                const isOverdue = new Date(lead.nextFollowUpAt) < new Date();
                return (
                  <div className="flex items-center gap-1.5">
                    <DateTimeCell value={lead.nextFollowUpAt} overdue={isOverdue} />
                    {isOverdue ? (
                      <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 shrink-0">
                        Overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
                        Pending
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "actions",
              header: "Actions",
              render: (lead: SalesLeadRow) => (
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
        <EmptyState title="No leads found" description="Try adjusting your filters or create a new lead." />
      )}
      <LeadDetailDialog
        leadId={autoOpenLeadId}
        currentUserId={user.id}
        isAdmin={user.role === "ADMIN"}
        canArchive={canArchive}
        canDelete={canDelete}
      />
      {canCreate && (
        <LeadEditModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          leadSources={leadSources}
          submitLabel="Save"
        />
      )}
    </>
  );
}
