"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LeadActionPanel } from "@/components/lead-action-panel";
import { LeadDetailsModal } from "@/components/lead-details-modal";

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
  const [open, setOpen] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <LeadActionPanel
        onDetails={() => setOpen(true)}
        onArchive={async () => {
          setArchiving(true);
          try {
            const axios = (await import("axios")).default;
            await axios.patch(`/api/leads/${lead.id}`, { isArchived: true });
            (await import("@/lib/toast")).toast.success("Lead archived");
            window.location.reload();
          } catch {
            setError("Failed to archive lead.");
            setArchiving(false);
          }
        }}
        onDelete={async () => {
          if (!confirm("Delete this lead permanently?")) return;
          setDeleting(true);
          try {
            const axios = (await import("axios")).default;
            await axios.delete(`/api/leads/${lead.id}`);
            (await import("@/lib/toast")).toast.success("Lead deleted");
            window.location.reload();
          } catch {
            setError("Failed to delete lead.");
            setDeleting(false);
          }
        }}
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
              const axios = (await import("axios")).default;
              await axios.post(`/api/leads/${lead.id}/assign`, { assignedUserId: assignedUserId || null });
              (await import("@/lib/toast")).toast.success("Lead assigned");
              window.location.reload();
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
    </>
  );
}
