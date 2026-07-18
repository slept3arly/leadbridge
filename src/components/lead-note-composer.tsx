"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

export function LeadNoteComposer({
  leadId,
  onCreated,
}: {
  leadId: string;
  onCreated: () => void;
}) {
  const [whatIDid, setWhatIDid] = useState("");
  const [whatCustomerSaid, setWhatCustomerSaid] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function reset() {
    setWhatIDid("");
    setWhatCustomerSaid("");
    setScheduleFollowUp(false);
    setFollowUpDate("");
    setFollowUpTime("");
    setShowForm(false);
  }

  async function submit() {
    if (!whatIDid.trim() && !whatCustomerSaid.trim()) return;
    setSaving(true);
    try {
      await axios.post(`/api/leads/${leadId}/notes`, {
        whatIDid: whatIDid.trim() || null,
        whatCustomerSaid: whatCustomerSaid.trim() || null,
        scheduleFollowUp: scheduleFollowUp && !!followUpDate,
        followUpDate: followUpDate || null,
        followUpTime: followUpTime || null,
      });
      toast.success("Note added");
      reset();
      onCreated();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSaving(false);
    }
  }

  if (!showForm) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} className="w-full">
        + Add Note
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 space-y-3">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--color-muted)]">What I did</label>
        <Textarea
          value={whatIDid}
          onChange={(e) => setWhatIDid(e.target.value)}
          rows={2}
          placeholder="Describe what action you took..."
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--color-muted)]">What the customer did</label>
        <Textarea
          value={whatCustomerSaid}
          onChange={(e) => setWhatCustomerSaid(e.target.value)}
          rows={2}
          placeholder="Record what the customer shared..."
          className="resize-none"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={scheduleFollowUp}
          onChange={(e) => setScheduleFollowUp(e.target.checked)}
          className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
        />
        <span className="text-sm font-medium text-[var(--color-ink)]">Schedule Follow Up?</span>
      </label>

      {scheduleFollowUp && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-muted)]">Date</label>
            <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-muted)]">Time</label>
            <Input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" isLoading={saving} onClick={submit} disabled={!whatIDid.trim() && !whatCustomerSaid.trim()}>
          Save Note
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>
      </div>
    </div>
  );
}
