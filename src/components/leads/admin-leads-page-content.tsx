"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { DataTable } from "@/components/shared/data-table";
import { SalesTableControls } from "@/components/sales/sales-table-controls";
import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { LeadSourceManagerModal } from "@/components/leads/lead-source-manager-modal";
import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Badge } from "@/components/ui/badge";
import { DateTimeCell } from "@/components/ui/date-time-cell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LeadDetailsModal } from "@/components/sales/lead-details-modal";
import { Archive, Trash2, Plus, RotateCcw } from "lucide-react";
import { getStatusLabel, getPriorityLabel, getCategoryLabel } from "@/lib/lead-constants";
import { toast } from "sonner";
import type { TableQueryState } from "@/hooks/use-table-query";

export type SerializedLead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  product: string | null;
  requirement: string | null;
  status: string;
  priority: string;
  category: string | null;
  isArchived: boolean;
  lastActivity: { occurredAt: string; entries: Array<{ type: string; action: string | null; response: string | null }> } | null;
  assignedUser: { id: string; name: string } | null;
  source: { id: string; name: string } | null;
};

export function AdminLeadsPageContent({
  leads,
  initial,
  pagination,
  leadSources,
  assignableUsers,
  currentUserId,
}: {
  leads: SerializedLead[];
  initial: Partial<TableQueryState>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  leadSources: Array<{ id: string; name: string }>;
  assignableUsers: Array<{ id: string; name: string }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<SerializedLead | null>(null);
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [detailsLeadId, setDetailsLeadId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; kind: "archive" | "restore" | "delete" } | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const openCreate = () => {
    setSelectedLead(null);
    setEditMode("create");
    setEditOpen(true);
  };

  const openEdit = (lead: SerializedLead) => {
    setSelectedLead(lead);
    setEditMode("edit");
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setSelectedLead(null);
  };

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    const { id, kind } = confirmAction;
    setMutating(true);
    setMutationError(null);
    try {
      if (kind === "delete") await axios.delete(`/api/leads/${id}`);
      else await axios.patch(`/api/leads/${id}`, { isArchived: kind === "archive" });
      toast.success(kind === "delete" ? "Lead deleted" : kind === "restore" ? "Lead restored" : "Lead archived");
      setConfirmAction(null);
      router.refresh();
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
      setMutationError(typeof message === "string" ? message : `Failed to ${kind} lead.`);
    } finally {
      setMutating(false);
    }
  }, [confirmAction, router]);

  return (
    <>
      <SalesTableControls
        initial={initial}
        pagination={pagination}
        leadSources={leadSources}
        assignableUsers={assignableUsers}
        adminMode
        startTransition={startTransition}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={openCreate} className="h-10">
              <Plus size={16} />
              Create Lead
            </Button>
            <Button variant="secondary" onClick={() => setSourceModalOpen(true)} className="h-10">
              <Plus size={16} />
              Lead Source
            </Button>
          </div>
        }
      />
      <DataTable
          rows={leads}
          compact
          tableClassName="w-full min-w-[1090px]"
          isLoading={isPending}
          emptyTitle="No leads found"
          emptyDescription="Try changing your search or filters."
          rowKey={(lead: SerializedLead) => lead.id}
          onRowClick={(lead: SerializedLead) => setDetailsLeadId(lead.id)}
          columns={[
            {
              key: "number",
              header: "#",
              headerClassName: "w-16",
              className: "w-16 whitespace-nowrap text-xs tabular-nums text-[var(--color-muted)]",
              render: (_lead: SerializedLead, index: number) =>
                (pagination.page - 1) * pagination.pageSize + index + 1,
            },
            {
              key: "lead",
              header: "Lead",
              headerClassName: "w-[250px]",
              className: "w-[250px]",
              render: (lead: SerializedLead) => (
                <div className="min-w-0 max-w-[250px]" title={[lead.name, lead.company, lead.phone, lead.email].filter(Boolean).join(" · ")}>
                  <p className="truncate text-sm font-semibold">{lead.name}</p>
                  {lead.company && <p className="truncate text-sm text-[var(--color-muted)]">{lead.company}</p>}
                  {(lead.phone || lead.email) && <p className="whitespace-nowrap truncate text-sm text-[var(--color-muted)]">{lead.phone ?? lead.email}</p>}
                </div>
              ),
            },
            {
              key: "statusPriority",
              header: "Status / Priority",
              headerClassName: "w-[190px]",
              className: "w-[190px]",
              render: (lead: SerializedLead) => <div className="flex w-fit flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Badge label={getStatusLabel(lead.status)} toneKey={lead.status} className="w-[82px] whitespace-nowrap px-1.5 py-1 text-[11px]" />
                  <Badge label={getPriorityLabel(lead.priority)} toneKey={lead.priority} className="w-[72px] whitespace-nowrap px-1.5 py-1 text-[11px]" />
                </div>
                {lead.category && <Badge label={getCategoryLabel(lead.category)} toneKey={lead.category} className="w-[158px] whitespace-nowrap px-1.5 py-1 text-[11px]" />}
              </div>,
            },
            {
              key: "source",
              header: "Source",
              headerClassName: "w-[140px]",
              className: "w-[140px]",
              render: (lead: SerializedLead) =>
                lead.source ? (
                  <span className="block truncate text-sm font-medium text-[var(--color-ink)]" title={lead.source.name}>{lead.source.name}</span>
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">-</span>
                ),
            },
            {
              key: "assignedUser",
              header: "Assigned To",
              headerClassName: "w-[155px]",
              className: "w-[155px]",
              render: (lead: SerializedLead) =>
                lead.assignedUser ? (
                  <span className="block truncate text-sm text-[var(--color-ink)]" title={lead.assignedUser.name}>{lead.assignedUser.name}</span>
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">Unassigned</span>
                ),
            },
            {
              key: "lastActivity",
              header: "Last Activity",
              headerClassName: "w-[160px]",
              className: "w-[160px] whitespace-nowrap",
              render: (lead: SerializedLead) => lead.lastActivity ? <DateTimeCell value={lead.lastActivity.occurredAt} /> : <span className="text-xs text-[var(--color-muted)]">No activity</span>,
            },
            {
              key: "actions",
              header: "Actions",
              headerClassName: "w-[130px] text-center",
              className: "w-[130px] text-center",
              render: (lead: SerializedLead) => (
                <div className="flex min-w-[112px] items-center justify-center gap-1" onClick={(event) => event.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openEdit(lead)}>
                    Edit
                  </Button>
                  {!lead.isArchived && <div className="w-8 shrink-0">
                    <IconActionButton
                      icon={Archive}
                      label="Archive lead"
                      onClick={() => { setMutationError(null); setConfirmAction({ id: lead.id, kind: "archive" }); }}
                      className="w-full"
                    />
                  </div>}
                  {lead.isArchived && <div className="w-8 shrink-0"><IconActionButton icon={RotateCcw} label="Restore lead" onClick={() => { setMutationError(null); setConfirmAction({ id: lead.id, kind: "restore" }); }} className="w-full" /></div>}
                  <div className="w-8 shrink-0">
                    <IconActionButton
                      icon={Trash2}
                      label="Delete lead"
                      onClick={() => { setMutationError(null); setConfirmAction({ id: lead.id, kind: "delete" }); }}
                      className="w-full"
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />

      <LeadEditModal
        open={editOpen}
        onClose={closeEdit}
        leadSources={leadSources}
        assignableUsers={assignableUsers}
        lead={
          editMode === "edit" && selectedLead
            ? {
                id: selectedLead.id,
                name: selectedLead.name,
                company: selectedLead.company,
                email: selectedLead.email,
                phone: selectedLead.phone,
                city: selectedLead.city,
                state: selectedLead.state,
                product: selectedLead.product,
                requirement: selectedLead.requirement,
                status: selectedLead.status,
                priority: selectedLead.priority,
                category: selectedLead.category,
                sourceId: selectedLead.source?.id ?? null,
                assignedUserId: selectedLead.assignedUser?.id ?? null,
              }
            : null
        }
      />

      <LeadSourceManagerModal
        open={sourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        sources={leadSources}
      />
      {detailsLeadId && <LeadDetailsModal
        leadId={detailsLeadId}
        currentUserId={currentUserId}
        isAdmin
        canArchive
        canDelete
        leadSources={leadSources}
        onClose={() => setDetailsLeadId(null)}
        onUpdate={() => router.refresh()}
      />}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.kind === "delete" ? "Delete this lead?" : confirmAction?.kind === "restore" ? "Restore this lead?" : "Archive this lead?"}
        description={confirmAction?.kind === "delete" ? "This permanently deletes the lead and its notes, follow-ups, activities, and attachments. This cannot be undone." : confirmAction?.kind === "restore" ? "This lead will return to the active leads list." : "This lead will be hidden from the active leads list. You can restore it later."}
        confirmLabel={confirmAction?.kind === "delete" ? "Delete lead" : confirmAction?.kind === "restore" ? "Restore lead" : "Archive lead"}
        isLoading={mutating}
        error={mutationError}
        onConfirm={handleConfirmAction}
        onCancel={() => { if (!mutating) setConfirmAction(null); }}
      />
    </>
  );
}
