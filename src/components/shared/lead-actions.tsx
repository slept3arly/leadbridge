"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LeadActionPanel } from "@/components/sales/lead-action-panel";
import { LeadDetailsModal } from "@/components/sales/lead-details-modal";
import { toast } from "sonner";
import axios from "axios";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Lead = { id: string; name: string; status: string; priority: string; assignedUser?: { name: string } | null };
type User = { id: string; name: string };

export function LeadActions({
  lead,
  currentUserId,
  isAdmin = false,
  assignableUsers = [],
  canAssign = false,
  canDelete = false,
  canArchive = false,
  onUpdate,
}: {
  lead: Lead;
  currentUserId?: string;
  isAdmin?: boolean;
  assignableUsers?: User[];
  canAssign?: boolean;
  canDelete?: boolean;
  canArchive?: boolean;
  onUpdate?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await axios.delete(`/api/leads/${lead.id}`);
      toast.success("Lead deleted");
      setConfirmDeleteOpen(false);
      router.refresh();
    } catch {
      setError("Failed to delete lead.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <LeadActionPanel
        onDetails={() => setOpen(true)}
        onArchive={async () => {
          setArchiving(true);
          try {
            await axios.patch(`/api/leads/${lead.id}`, { isArchived: true });
            toast.success("Lead archived");
            router.refresh();
          } catch {
            setError("Failed to archive lead.");
            setArchiving(false);
          }
        }}
        onDelete={() => setConfirmDeleteOpen(true)}
        isArchiving={archiving}
        isDeleting={deleting}
        canDelete={canDelete}
        canArchive={canArchive}
      />
      {canAssign ? (
        <div className="flex gap-2 mt-2">
          <Select value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
            <option value="">Assign to...</option>
            {assignableUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </Select>
          <Button size="sm" isLoading={saving} onClick={async () => {
            setSaving(true);
            try {
              await axios.post(`/api/leads/${lead.id}/assign`, { assignedUserId: assignedUserId || null });
              toast.success("Lead assigned");
              router.refresh();
            } catch {
              setError("Failed to assign lead.");
              setSaving(false);
            }
          }}>Assign</Button>
        </div>
      ) : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
      {open && (
        <LeadDetailsModal
          leadId={lead.id}
          currentUserId={currentUserId ?? ""}
          isAdmin={isAdmin}
          canArchive={canArchive}
          onClose={() => setOpen(false)}
          onUpdate={() => { if (onUpdate) onUpdate(); }}
        />
      )}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this lead?"
        description="This permanently deletes the lead and its CRM record."
        confirmLabel="Delete lead"
        isLoading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
