"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
  onUpdate,
}: {
  lead: Lead;
  currentUserId?: string;
  isAdmin?: boolean;
  assignableUsers?: User[];
  canAssign?: boolean;
  canDelete?: boolean;
  onUpdate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Details</Button>
        {canDelete ? <Button variant="danger" size="sm" isLoading={deleting} onClick={async () => {
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
        }}>Delete</Button> : null}
      </div>
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
          onClose={() => setOpen(false)}
          onUpdate={() => { if (onUpdate) onUpdate(); }}
        />
      )}
    </>
  );
}
