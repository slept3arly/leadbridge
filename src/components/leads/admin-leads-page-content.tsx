"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { DataTable } from "@/components/shared/data-table";
import { LeadTableControls } from "@/components/leads/lead-table-controls";
import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DateTimeCell } from "@/components/ui/date-time-cell";
import { Archive, Trash2 } from "lucide-react";
import { Plus } from "lucide-react";
import { getStatusLabel, getPriorityLabel, getCategoryLabel } from "@/lib/lead-constants";
import { toast } from "@/lib/toast";
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
  createdAt: string;
  updatedAt: string;
  assignedUser: { id: string; name: string } | null;
  source: { id: string; name: string } | null;
};

export function AdminLeadsPageContent({
  leads,
  initial,
  pagination,
  leadSources,
  assignableUsers,
}: {
  leads: SerializedLead[];
  initial: Partial<TableQueryState>;
  pagination: { page: number; totalPages: number };
  leadSources: Array<{ id: string; name: string }>;
  assignableUsers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<SerializedLead | null>(null);
  const [editMode, setEditMode] = useState<"create" | "edit">("create");

  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleArchive = useCallback(async (leadId: string) => {
    if (!confirm("Archive this lead? It will be hidden from the main view.")) return;
    setArchivingId(leadId);
    try {
      await axios.patch(`/api/leads/${leadId}`, { isArchived: true });
      toast.success("Lead archived");
      router.refresh();
    } catch {
      toast.error("Failed to archive lead.");
    } finally {
      setArchivingId(null);
    }
  }, [router]);

  const handleDelete = useCallback(async (leadId: string) => {
    if (!confirm("Delete this lead permanently? This action cannot be undone.")) return;
    setDeletingId(leadId);
    try {
      await axios.delete(`/api/leads/${leadId}`);
      toast.success("Lead deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete lead.");
    } finally {
      setDeletingId(null);
    }
  }, [router]);

  return (
    <>
      <LeadTableControls
        initial={initial}
        pagination={pagination}
        leadSources={leadSources}
        assignableUsers={assignableUsers}
        actions={
          <Button variant="secondary" onClick={openCreate} className="h-10">
            <Plus size={16} />
            Create Lead
          </Button>
        }
      />
      {leads.length ? (
        <DataTable
          rows={leads}
          columns={[
            {
              key: "lead",
              header: "Name",
              render: (lead: SerializedLead) => (
                <div>
                  <p className="font-semibold">{lead.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">{lead.company ?? "No company"}</p>
                </div>
              ),
            },
            {
              key: "contact",
              header: "Phone",
              render: (lead: SerializedLead) => lead.phone ?? lead.email ?? "-",
            },
            {
              key: "status",
              header: "Status",
              render: (lead: SerializedLead) => <Badge label={getStatusLabel(lead.status)} toneKey={lead.status} />,
            },
            {
              key: "priority",
              header: "Priority",
              render: (lead: SerializedLead) => <Badge label={getPriorityLabel(lead.priority)} toneKey={lead.priority} />,
            },
            {
              key: "category",
              header: "Category",
              render: (lead: SerializedLead) =>
                lead.category ? <Badge label={getCategoryLabel(lead.category)} toneKey={lead.category} /> : <span className="text-xs text-[var(--color-muted)]">-</span>,
            },
            {
              key: "owner",
              header: "Assigned To",
              render: (lead: SerializedLead) => lead.assignedUser?.name ?? "Unassigned",
            },
            {
              key: "source",
              header: "Source",
              render: (lead: SerializedLead) => lead.source?.name ?? "-",
            },
            {
              key: "createdAt",
              header: "Created",
              render: (lead: SerializedLead) => <DateTimeCell value={lead.createdAt} />,
            },
            {
              key: "updatedAt",
              header: "Last Updated",
              render: (lead: SerializedLead) => <DateTimeCell value={lead.updatedAt} />,
            },
            {
              key: "actions",
              header: "Actions",
              className: "whitespace-nowrap",
              render: (lead: SerializedLead) => (
                <div className="flex flex-col gap-1 min-w-[130px]">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => openEdit(lead)}
                  >
                    Edit
                  </Button>
                  <div className="grid grid-cols-2 gap-1">
                    <IconActionButton
                      icon={Archive}
                      label="Archive lead"
                      onClick={() => handleArchive(lead.id)}
                      isLoading={archivingId === lead.id}
                      className="w-full"
                    />
                    <IconActionButton
                      icon={Trash2}
                      label="Delete lead"
                      onClick={() => handleDelete(lead.id)}
                      isLoading={deletingId === lead.id}
                      className="w-full"
                    />
                  </div>
                </div>
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

      <LeadEditModal
        open={editOpen}
        onClose={closeEdit}
        assignableUsers={assignableUsers}
        lead={editMode === "edit" && selectedLead ? {
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
          assignedUserId: selectedLead.assignedUser?.id ?? null,
        } : null}
      />
    </>
  );
}
