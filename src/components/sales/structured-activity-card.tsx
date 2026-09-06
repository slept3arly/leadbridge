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
import type { StructuredLeadActivity } from "@/hooks/use-lead-details";

type Action = "CALL" | "WHATSAPP";
type Response = "PICKED_UP" | "NO_RESPONSE" | "INVALID_NUMBER" | "REPLIED";
type Interest = "INTERESTED" | "NOT_INTERESTED";

const actionLabels = { CALL: "Called", WHATSAPP: "WhatsApp" } as const;
const responseLabels = {
  PICKED_UP: "Picked up",
  REPLIED: "Replied",
  NO_RESPONSE: "No response",
  INVALID_NUMBER: "Invalid number",
} as const;
const interestLabels = { INTERESTED: "Interested", NOT_INTERESTED: "Not interested" } as const;

const responseOptions: Record<Action, Array<{ value: Response; label: string }>> = {
  CALL: [
    { value: "PICKED_UP", label: "Picked Up" },
    { value: "NO_RESPONSE", label: "No Response" },
    { value: "INVALID_NUMBER", label: "Invalid Number" },
  ],
  WHATSAPP: [
    { value: "REPLIED", label: "Replied" },
    { value: "NO_RESPONSE", label: "No Response" },
    { value: "INVALID_NUMBER", label: "Invalid Number" },
  ],
};

function isResponded(response: Response | "") {
  return response === "PICKED_UP" || response === "REPLIED";
}

export function StructuredActivityCard({
  activity,
  currentUserId,
  onChanged,
}: {
  activity: StructuredLeadActivity;
  currentUserId?: string;
  onChanged?: () => void;
}) {
  const [localFollowUp, setLocalFollowUp] = useState<StructuredLeadActivity["followUp"]>(undefined);
  const [localActivity, setLocalActivity] = useState<Pick<StructuredLeadActivity, "action" | "response" | "interest" | "message" | "metadata"> | undefined>(undefined);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState(false);
  const [editDueDate, setEditDueDate] = useState("");
  const [editDueTime, setEditDueTime] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Activity edit state
  const [editingActivity, setEditingActivity] = useState(false);
  const [editAction, setEditAction] = useState<Action>("CALL");
  const [editResponse, setEditResponse] = useState<Response | "">("");
  const [editInterest, setEditInterest] = useState<Interest | "">("");
  const [editNotes, setEditNotes] = useState("");
  const [activitySaving, setActivitySaving] = useState(false);

  const effective = localActivity ?? activity;
  const notes = effective.metadata?.notes;
  const customerResponse = [
    responseLabels[effective.response],
    effective.interest ? interestLabels[effective.interest] : null,
  ].filter(Boolean).join(" — ");

  const followUp = localFollowUp ?? activity.followUp;
  const hasSidebar = Boolean(followUp);

  function openEditActivity() {
    setEditAction(effective.action);
    setEditResponse(effective.response);
    setEditInterest(effective.interest ?? "");
    setEditNotes(typeof notes === "string" ? notes : "");
    setEditingActivity(true);
  }

  async function saveActivityEdit() {
    if (!editResponse || (isResponded(editResponse) && !editInterest)) return;
    setActivitySaving(true);
    try {
      const payload: Record<string, unknown> = {
        action: editAction,
        response: editResponse,
        interest: isResponded(editResponse) ? editInterest : null,
        notes: editNotes.trim() || null,
      };
      const res = await axios.patch(`/api/activities/${activity.id}`, payload);
      toast.success("Activity updated");
      // Optimistically update the activity display
      const updated = res.data;
      const interestVal = editResponse && isResponded(editResponse) ? editInterest : null;
      setLocalActivity({
        action: updated.action ?? editAction,
        response: updated.response ?? editResponse,
        interest: updated.interest ?? interestVal,
        message: updated.message ?? (editNotes.trim() || `${editAction} - ${(editResponse as string).replaceAll("_", " ")}${interestVal ? ` (${(interestVal as string).replaceAll("_", " ")})` : ""}`),
        metadata: {
          ...(activity.metadata ?? {}),
          notes: editNotes.trim() || null,
        },
      });
      setEditingActivity(false);
      onChanged?.();
    } catch {
      toast.error("Failed to update activity");
    } finally {
      setActivitySaving(false);
    }
  }

  function openEditFollowUp() {
    if (!followUp) return;
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
    setEditingFollowUp(true);
  }

  async function saveFollowUpEdit() {
    if (!followUp) return;
    setEditSaving(true);
    try {
      let resolvedDueDate: string | null = null;
      if (editDueDate) {
        const localStr = editDueTime ? `${editDueDate}T${editDueTime}` : `${editDueDate}T00:00`;
        resolvedDueDate = new Date(localStr).toISOString();
      }
      await axios.patch(`/api/follow-ups/${followUp.id}`, {
        dueDate: resolvedDueDate,
        dueTime: editDueTime || null,
      });
      toast.success("Follow-up rescheduled");
      // Optimistically update the follow-up so the card reflects changes immediately.
      setLocalFollowUp({
        ...followUp,
        dueDate: resolvedDueDate,
        dueTime: editDueTime || null,
      });
      setEditingFollowUp(false);
      onChanged?.();
    } catch {
      toast.error("Failed to reschedule follow-up");
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
      // Optimistically update status so the card reflects changes immediately.
      setLocalFollowUp({
        ...followUp,
        status: newStatus,
        completedAt: newStatus === "COMPLETED" ? new Date().toISOString() : null,
      });
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
      // Optimistically remove the follow-up so the card collapses immediately.
      setLocalFollowUp(undefined);
      onChanged?.();
    } catch {
      toast.error("Failed to delete follow-up");
    }
  }

  const activityContent = (
    <>
      <InteractionHeader name={activity.actor?.name ?? "Sales user"} createdAt={activity.createdAt} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InteractionSection label="WHAT I DID">{actionLabels[effective.action]}</InteractionSection>
        <InteractionSection label="CUSTOMER RESPONSE">{customerResponse}</InteractionSection>
      </div>
      {typeof notes === "string" && notes.trim() && (
        <InteractionSection label="NOTES">{notes}</InteractionSection>
      )}
      <div className="pt-1">
        <Button size="sm" variant="outline" onClick={openEditActivity}>
          Edit Activity
        </Button>
      </div>
    </>
  );

  const editActivityResponses = responseOptions[editAction];
  const editInterestVisible = isResponded(editResponse);
  const canSubmitActivity = Boolean(editResponse && (!editInterestVisible || editInterest));

  const activityEditModal = editingActivity ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingActivity(false)} />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Edit Activity</h3>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-muted)]">Action</label>
            <Select value={editAction} onChange={(e) => {
              const newAction = e.target.value as Action;
              setEditAction(newAction);
              // Clear response if it's not valid for the new action
              const validResponses = responseOptions[newAction].map((r) => r.value);
              if (editResponse && !validResponses.includes(editResponse as Response)) {
                setEditResponse("");
                setEditInterest("");
              }
            }}>
              <option value="CALL">Call</option>
              <option value="WHATSAPP">WhatsApp</option>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-muted)]">Response</label>
            <Select value={editResponse} onChange={(e) => {
              const newResponse = e.target.value as Response | "";
              setEditResponse(newResponse);
              // Clear interest if response no longer supports it
              if (newResponse && !isResponded(newResponse)) {
                setEditInterest("");
              }
            }}>
              <option value="">Select response</option>
              {editActivityResponses.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          {editInterestVisible && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--color-muted)]">Interest</label>
              <Select value={editInterest} onChange={(e) => setEditInterest(e.target.value as Interest | "")}>
                <option value="">Select interest</option>
                <option value="INTERESTED">Interested</option>
                <option value="NOT_INTERESTED">Not Interested</option>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-muted)]">Notes</label>
            <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} placeholder="Add notes about this interaction..." className="resize-none" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" isLoading={activitySaving} onClick={saveActivityEdit} disabled={!canSubmitActivity}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingActivity(false)}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const followUpEditModal = editingFollowUp && followUp ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingFollowUp(false)} />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Reschedule Follow-up</h3>
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
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" isLoading={editSaving} onClick={saveFollowUpEdit}>Save</Button>
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
          Reschedule
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
      {activityEditModal}
      {followUpEditModal}
    </>
  );
}
