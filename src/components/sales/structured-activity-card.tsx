"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { InteractionCard } from "@/components/sales/interaction-card";
import { InteractionHeader } from "@/components/sales/interaction-header";
import { InteractionSection } from "@/components/sales/interaction-section";
import { FollowUpSummary } from "@/components/sales/follow-up-summary";
import { InteractionActionGrid } from "@/components/sales/interaction-action-grid";
import { toast } from "@/lib/toast";
import { LEAD_PRIORITIES } from "@/lib/lead-constants";
import type { StructuredLeadActivity } from "@/hooks/use-lead-details";

const actionLabels = { CALL: "Called", WHATSAPP: "WhatsApp" } as const;
const responseLabels = {
  PICKED_UP: "Picked up",
  REPLIED: "Replied",
  NO_RESPONSE: "No response",
  INVALID_NUMBER: "Invalid number",
} as const;
const interestLabels = { INTERESTED: "Interested", NOT_INTERESTED: "Not interested" } as const;

export function StructuredActivityCard({
  activity,
  currentUserId,
  onChanged,
}: {
  activity: StructuredLeadActivity;
  currentUserId?: string;
  onChanged?: () => void;
}) {
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDueTime, setEditDueTime] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editSaving, setEditSaving] = useState(false);

  const notes = activity.metadata?.notes;
  const customerResponse = [
    responseLabels[activity.response],
    activity.interest ? interestLabels[activity.interest] : null,
  ].filter(Boolean).join(" — ");

  const followUp = activity.followUp;
  const hasSidebar = Boolean(followUp);

  function openEditFollowUp() {
    if (!followUp) return;
    setEditTitle(followUp.title);
    setEditDescription(followUp.description ?? "");
    if (followUp.dueDate) {
      const d = new Date(followUp.dueDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      setEditDueDate(`${year}-${month}-${day}`);
    } else {
      setEditDueDate("");
    }
    setEditDueTime(followUp.dueTime ?? "");
    setEditPriority(followUp.priority);
    setEditingFollowUp(true);
  }

  async function saveFollowUpEdit() {
    if (!followUp || !editTitle.trim()) return;
    setEditSaving(true);
    try {
      let resolvedDueDate: string | null = null;
      if (editDueDate) {
        const localStr = editDueTime ? `${editDueDate}T${editDueTime}` : `${editDueDate}T00:00`;
        resolvedDueDate = new Date(localStr).toISOString();
      }
      await axios.patch(`/api/follow-ups/${followUp.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        dueDate: resolvedDueDate,
        dueTime: editDueTime || null,
        priority: editPriority,
      });
      toast.success("Follow-up updated");
      setEditingFollowUp(false);
      onChanged?.();
    } catch {
      toast.error("Failed to update follow-up");
    } finally {
      setEditSaving(false);
    }
  }

  async function updateFollowUpStatus(newStatus: string) {
    if (!followUp) return;
    setFollowUpSaving(true);
    try {
      await axios.patch(`/api/follow-ups/${followUp.id}`, { status: newStatus });
      toast.success(newStatus === "COMPLETED" ? "Follow-up marked as complete" : "Follow-up marked as pending");
      onChanged?.();
    } catch {
      toast.error("Failed to update follow-up");
    } finally {
      setFollowUpSaving(false);
    }
  }

  async function deleteFollowUp() {
    if (!followUp || !confirm("Delete this follow-up?")) return;
    try {
      await axios.delete(`/api/follow-ups/${followUp.id}`);
      toast.success("Follow-up deleted");
      onChanged?.();
    } catch {
      toast.error("Failed to delete follow-up");
    }
  }

  const activityContent = (
    <>
      <InteractionHeader name={activity.actor?.name ?? "Sales user"} createdAt={activity.createdAt} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InteractionSection label="WHAT I DID">{actionLabels[activity.action]}</InteractionSection>
        <InteractionSection label="CUSTOMER RESPONSE">{customerResponse}</InteractionSection>
      </div>
      {typeof notes === "string" && notes.trim() && (
        <InteractionSection label="NOTES">{notes}</InteractionSection>
      )}
    </>
  );

  const followUpEditModal = editingFollowUp && followUp ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingFollowUp(false)} />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Edit Follow-up</h3>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-muted)]">Title</label>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Follow-up title" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-muted)]">Description</label>
            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} placeholder="Optional description" className="resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--color-muted)]">Date</label>
              <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--color-muted)]">Time</label>
              <Input type="time" value={editDueTime} onChange={(e) => setEditDueTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-muted)]">Priority</label>
            <Select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
              {LEAD_PRIORITIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" isLoading={editSaving} onClick={saveFollowUpEdit} disabled={!editTitle.trim()}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingFollowUp(false)}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const sidebarContent = hasSidebar && followUp ? (
    <>
      <FollowUpSummary
        status={followUp.status}
        dueDate={followUp.dueDate}
        dueTime={followUp.dueTime}
        completedAt={followUp.completedAt}
      />
      <InteractionActionGrid>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={openEditFollowUp}
        >
          Edit
        </Button>
        {currentUserId && followUp.createdBy.id === currentUserId && (
          <Button
            size="sm"
            variant="danger"
            className="w-full"
            onClick={deleteFollowUp}
          >
            Delete
          </Button>
        )}
        {followUp.status === "PENDING" && (
          <Button
            size="sm"
            variant="primary"
            className="w-full col-span-2"
            isLoading={followUpSaving}
            onClick={() => updateFollowUpStatus("COMPLETED")}
          >
            Mark Complete
          </Button>
        )}
        {followUp.status === "COMPLETED" && (
          <Button
            size="sm"
            variant="secondary"
            className="w-full col-span-2"
            isLoading={followUpSaving}
            onClick={() => updateFollowUpStatus("PENDING")}
          >
            Mark Pending
          </Button>
        )}
      </InteractionActionGrid>
    </>
  ) : undefined;

  return (
    <>
      <InteractionCard>
        {hasSidebar ? (
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
            <div className="space-y-3">{activityContent}</div>
            <div className="space-y-3">{sidebarContent}</div>
          </div>
        ) : (
          <div className="space-y-3">{activityContent}</div>
        )}
      </InteractionCard>
      {followUpEditModal}
    </>
  );
}
