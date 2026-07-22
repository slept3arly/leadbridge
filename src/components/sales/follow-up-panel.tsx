"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { LEAD_PRIORITIES } from "@/lib/lead-constants";
import { toast } from "@/lib/toast";
import { useLeadDetails } from "@/hooks/use-lead-details";

type User = { id: string; name: string };

export function FollowUpPanel({ leadId, currentUserId }: { leadId: string; currentUserId: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data, loading: detailsLoading, refresh } = useLeadDetails(leadId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedUserId, setAssignedUserId] = useState("");

  useEffect(() => {
    axios.get("/api/users")
      .then((res) => {
        setUsers(res.data);
      })
      .catch(() => {
        // leave empty on failure
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function resetForm() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setDueTime("");
    setPriority("MEDIUM");
    setAssignedUserId("");
    setShowForm(false);
  }

  async function createFollowUp() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await axios.post(`/api/leads/${leadId}/follow-ups`, {
        title,
        description: description || null,
        dueDate: dueDate || null,
        dueTime: dueTime || null,
        priority,
        assignedUserId: assignedUserId || currentUserId,
      });
      resetForm();
      toast.success("Follow-up created");
      await refresh();
    } catch {
      toast.error("Failed to create follow-up");
    } finally {
      setSaving(false);
    }
  }

  async function completeFollowUp(id: string) {
    try {
      await axios.patch(`/api/follow-ups/${id}`, { status: "COMPLETED" });
      toast.success("Follow-up completed");
      await refresh();
    } catch {
      toast.error("Failed to update follow-up");
    }
  }

  async function deleteFollowUp(id: string) {
    if (!confirm("Delete this follow-up?")) return;
    try {
      await axios.delete(`/api/follow-ups/${id}`);
      toast.success("Follow-up deleted");
      await refresh();
    } catch {
      toast.error("Failed to delete follow-up");
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  if (loading || detailsLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-muted)]">
          {(data?.followUps ?? []).filter((f) => f.status === "PENDING").length} pending
        </p>
        <Button size="sm" variant="secondary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "New Follow-up"}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 space-y-3">
          <FormField label="Title" htmlFor="fu-title" required>
            <Input id="fu-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow-up title" />
          </FormField>
          <FormField label="Description" htmlFor="fu-desc">
            <Textarea id="fu-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional description" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Due Date" htmlFor="fu-date">
              <Input id="fu-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FormField>
            <FormField label="Due Time" htmlFor="fu-time">
              <Input id="fu-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priority" htmlFor="fu-priority">
              <Select id="fu-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {LEAD_PRIORITIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Assign To" htmlFor="fu-assign">
              <Select id="fu-assign" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
                <option value="">Myself</option>
                {users.filter((u) => u.id !== currentUserId).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button size="sm" isLoading={saving} onClick={createFollowUp} disabled={!title.trim()}>
              Create
            </Button>
          </div>
        </div>
      )}

      {(data?.followUps ?? []).length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No follow-ups scheduled.</p>
      ) : (
        <div className="space-y-2">
          {(data?.followUps ?? []).map((fu) => (
            <div key={fu.id} className="rounded-xl border border-[var(--color-border)] bg-white p-3 space-y-1.5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${fu.status === "COMPLETED" ? "line-through text-[var(--color-muted)]" : ""}`}>
                      {fu.title}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      fu.priority === "URGENT" ? "bg-red-100 text-red-800" :
                      fu.priority === "HIGH" ? "bg-orange-100 text-orange-800" :
                      fu.priority === "LOW" ? "bg-sky-100 text-sky-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {fu.priority.replace("_", " ")}
                    </span>
                    {fu.status === "COMPLETED" && (
                      <span className="text-xs text-green-600 font-semibold">Completed</span>
                    )}
                  </div>
                  {fu.description && (
                    <p className="text-sm text-[var(--color-muted)] mt-0.5">{fu.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-muted)]">
                    <span>Due: {formatDate(fu.dueDate)}{fu.dueTime ? ` ${fu.dueTime}` : ""}</span>
                    {fu.assignedUser && <span>Assigned to: {fu.assignedUser.name}</span>}
                    <span>By: {fu.createdBy.name}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  {fu.status === "PENDING" && (
                    <button
                      onClick={() => completeFollowUp(fu.id)}
                      className="text-xs text-green-600 hover:text-green-800 font-semibold"
                    >
                      Complete
                    </button>
                  )}
                  {(fu.createdBy.id === currentUserId) && (
                    <button
                      onClick={() => deleteFollowUp(fu.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
