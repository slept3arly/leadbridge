"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InteractionCard } from "@/components/interaction-card";
import { InteractionHeader } from "@/components/interaction-header";
import { InteractionSection } from "@/components/interaction-section";
import { InteractionLayout } from "@/components/interaction-layout";
import { FollowUpSummary } from "@/components/follow-up-summary";
import { InteractionActionGrid } from "@/components/interaction-action-grid";
import { toast } from "@/lib/toast";

type FollowUpInfo = {
  id: string;
  dueDate: string | null;
  dueTime: string | null;
  status: string;
  completedAt: string | null;
};

type NoteCardProps = {
  note: {
    id: string;
    content: string;
    whatIDid: string | null;
    whatCustomerSaid: string | null;
    createdAt: string;
    editedAt: string;
    authorId: string;
    author: { id: string; name: string };
    followUps?: FollowUpInfo[];
  };
  currentUserId: string;
  isAdmin: boolean;
  onUpdated: () => void;
  onDeleted: (id: string) => void;
};

export function LeadNoteCard({ note, currentUserId, isAdmin, onUpdated, onDeleted }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [whatIDid, setWhatIDid] = useState(note.whatIDid ?? "");
  const [whatCustomerSaid, setWhatCustomerSaid] = useState(note.whatCustomerSaid ?? "");
  const [saving, setSaving] = useState(false);
  const [followUpSaving, setFollowUpSaving] = useState(false);

  const created = new Date(note.createdAt);
  const now = new Date();
  const isSameDay =
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate();

  const canEdit = isAdmin || (note.authorId === currentUserId && isSameDay);
  const followUp = note.followUps?.[0];
  const hasSidebar = Boolean(canEdit || followUp);

  async function saveEdit() {
    if (!whatIDid.trim() && !whatCustomerSaid.trim()) return;
    setSaving(true);
    try {
      await axios.patch(`/api/notes/${note.id}`, { whatIDid: whatIDid || null, whatCustomerSaid: whatCustomerSaid || null });
      toast.success("Note updated");
      setEditing(false);
      onUpdated();
    } catch {
      toast.error("Failed to update note");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote() {
    if (!confirm("Delete this note?")) return;
    try {
      await axios.delete(`/api/notes/${note.id}`);
      toast.success("Note deleted");
      onDeleted(note.id);
    } catch {
      toast.error("Failed to delete note");
    }
  }

  async function updateFollowUpStatus(newStatus: string) {
    if (!followUp) return;
    setFollowUpSaving(true);
    try {
      await axios.patch(`/api/follow-ups/${followUp.id}`, { status: newStatus });
      toast.success(newStatus === "COMPLETED" ? "Follow-up marked as complete" : "Follow-up marked as pending");
      onUpdated();
    } catch {
      toast.error("Failed to update follow-up status");
    } finally {
      setFollowUpSaving(false);
    }
  }

  const mainContent = (
    <>
      <InteractionHeader name={note.author.name} createdAt={note.createdAt} />
      {note.whatIDid && (
        <InteractionSection label="WHAT I DID">
          {note.whatIDid}
        </InteractionSection>
      )}
      {note.whatCustomerSaid && (
        <InteractionSection label="CUSTOMER RESPONSE">
          {note.whatCustomerSaid}
        </InteractionSection>
      )}
      {!note.whatIDid && !note.whatCustomerSaid && note.content && (
        <InteractionSection label="NOTE">
          {note.content}
        </InteractionSection>
      )}
    </>
  );

  const sidebarContent = hasSidebar ? (
    <>
      {followUp && (
        <FollowUpSummary
          status={followUp.status}
          dueDate={followUp.dueDate}
          dueTime={followUp.dueTime}
          completedAt={followUp.completedAt}
        />
      )}
      {(canEdit || followUp) && (
        <InteractionActionGrid>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => { setEditing(true); setWhatIDid(note.whatIDid ?? ""); setWhatCustomerSaid(note.whatCustomerSaid ?? ""); }}
            >
              Edit
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="danger" className="w-full" onClick={deleteNote}>
              Delete
            </Button>
          )}
          {followUp && followUp.status === "PENDING" && (
            <Button size="sm" variant="primary" className="w-full col-span-2" isLoading={followUpSaving} onClick={() => updateFollowUpStatus("COMPLETED")}>
              Mark Complete
            </Button>
          )}
          {followUp && followUp.status === "COMPLETED" && (
            <Button size="sm" variant="secondary" className="w-full col-span-2" isLoading={followUpSaving} onClick={() => updateFollowUpStatus("PENDING")}>
              Mark Pending
            </Button>
          )}
        </InteractionActionGrid>
      )}
    </>
  ) : undefined;

  if (editing) {
    return (
      <InteractionCard>
        <InteractionHeader name={note.author.name} createdAt={note.createdAt} />
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">What I did</label>
          <Textarea value={whatIDid} onChange={(e) => setWhatIDid(e.target.value)} rows={2} placeholder="What I did..." />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Customer response</label>
          <Textarea value={whatCustomerSaid} onChange={(e) => setWhatCustomerSaid(e.target.value)} rows={2} placeholder="What the customer said..." />
        </div>
        <div className="flex gap-2">
          <Button size="sm" isLoading={saving} onClick={saveEdit}>Save</Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </InteractionCard>
    );
  }

  return (
    <InteractionCard>
      <InteractionLayout main={mainContent} sidebar={sidebarContent} />
    </InteractionCard>
  );
}
