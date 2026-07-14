"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";

type Lead = { id: string; name: string; status: string; priority: string; assignedUser?: { name: string } | null };
type User = { id: string; name: string };

export function LeadActions({ lead, assignableUsers = [], canAssign = false, canDelete = false }: { lead: Lead; assignableUsers?: User[]; canAssign?: boolean; canDelete?: boolean }) {
  const [open, setOpen] = useState<"edit" | "notes" | "activity" | null>(null);
  const [status, setStatus] = useState(lead.status);
  const [priority, setPriority] = useState(lead.priority);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [content, setContent] = useState("");
  const [items, setItems] = useState<Array<{ id: string; content?: string; message?: string; createdAt: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function updateLead() {
    setSaving(true);
    try {
      await axios.patch(`/api/leads/${lead.id}`, { status, priority });
      toast.success("Lead updated");
      window.location.reload();
    } catch {
      setError("Failed to update lead.");
    } finally {
      setSaving(false);
    }
  }

  async function assignLead() {
    setSaving(true);
    try {
      await axios.post(`/api/leads/${lead.id}/assign`, { assignedUserId: assignedUserId || null });
      toast.success("Lead assigned");
      window.location.reload();
    } catch {
      setError("Failed to assign lead.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead() {
    setDeleting(true);
    try {
      await axios.delete(`/api/leads/${lead.id}`);
      toast.success("Lead deleted");
      window.location.reload();
    } catch {
      setError("Failed to delete lead.");
      setDeleting(false);
    }
  }

  async function load(kind: "notes" | "activity") {
    setOpen(kind);
    setError(null);
    try {
      const response = await axios.get(`/api/leads/${lead.id}/${kind === "notes" ? "notes" : "activities"}`);
      setItems(response.data);
    } catch {
      setError(`Unable to load ${kind}.`);
    }
  }

  async function addNote() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await axios.post(`/api/leads/${lead.id}/notes`, { content });
      setContent("");
      await load("notes");
      toast.success("Note added");
    } catch {
      setError("Failed to add note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(open === "edit" ? null : "edit")}>Edit</Button>
        <Button variant="secondary" size="sm" onClick={() => load("notes")}>Notes</Button>
        <Button variant="secondary" size="sm" onClick={() => load("activity")}>Activity</Button>
        {canDelete ? <Button variant="danger" size="sm" isLoading={deleting} onClick={deleteLead}>Delete</Button> : null}
      </div>
      {canAssign ? (
        <div className="flex gap-2">
          <Select value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
            <option value="">Assign to...</option>
            {assignableUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </Select>
          <Button size="sm" isLoading={saving && !open} onClick={assignLead}>Assign</Button>
        </div>
      ) : null}
      {open === "edit" ? (
        <div className="flex gap-2">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>NEW</option>
            <option>CONTACTED</option>
            <option>QUALIFIED</option>
            <option>WON</option>
            <option>LOST</option>
          </Select>
          <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>HIGH</option>
            <option>URGENT</option>
          </Select>
          <Button size="sm" isLoading={saving} onClick={updateLead}>Save</Button>
        </div>
      ) : null}
      {open === "notes" ? (
        <div className="space-y-2">
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Add a follow-up note" />
          <Button size="sm" isLoading={saving} onClick={addNote}>Add note</Button>
          {items.map((item) => (
            <div key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">
              {item.content}
              <span className="block text-xs text-[var(--color-muted)]">{new Date(item.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : null}
      {open === "activity" ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">
              {item.message}
              <span className="block text-xs text-[var(--color-muted)]">{new Date(item.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
