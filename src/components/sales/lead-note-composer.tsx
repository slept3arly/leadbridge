"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";

type Action = "CALL" | "WHATSAPP";
type Response = "PICKED_UP" | "NO_RESPONSE" | "INVALID_NUMBER" | "REPLIED";
type Interest = "INTERESTED" | "NOT_INTERESTED";

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

export function LeadNoteComposer({ leadId, onCreated }: { leadId: string; onCreated: (activity: Record<string, unknown>, formMeta: { action: string; response: string; interest: string | null; scheduleFollowUp: boolean; followUpDate: string | null; followUpTime: string | null }) => void }) {
  const [action, setAction] = useState<Action>("CALL");
  const [response, setResponse] = useState<Response | "">("");
  const [interest, setInterest] = useState<Interest | "">("");
  const [notes, setNotes] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const responses = responseOptions[action];
  const interestVisible = isResponded(response);
  const canSubmit = Boolean(response && (!interestVisible || interest) && (!scheduleFollowUp || followUpDate));

  function reset() {
    setAction("CALL");
    setResponse("");
    setInterest("");
    setNotes("");
    setScheduleFollowUp(false);
    setFollowUpDate("");
    setFollowUpTime("");
    setOpen(false);
  }

  async function submit() {
    if (!response || (interestVisible && !interest) || (scheduleFollowUp && !followUpDate)) return;
    setSaving(true);
    try {
      // Combine date + time into a full local-datetime string so the browser
      // interprets it in the user's local timezone before converting to UTC.
      // e.g. "2026-09-05" + "16:30" → new Date("2026-09-05T16:30") in IST
      //   → .toISOString() → "2026-09-05T11:00:00.000Z"  (correct UTC moment)
      // Sending the date-only string "2026-09-05" would make the server treat
      // it as UTC midnight, causing a +5:30 shift visible in every view.
      let resolvedFollowUpDate: string | null = null;
      if (followUpDate) {
        const localStr = followUpTime ? `${followUpDate}T${followUpTime}` : `${followUpDate}T00:00`;
        resolvedFollowUpDate = new Date(localStr).toISOString();
      }
      const res = await axios.post<Record<string, unknown>>(`/api/leads/${leadId}/activities`, {
        action,
        response,
        interest: interestVisible ? interest : null,
        notes: notes.trim() || null,
        scheduleFollowUp,
        followUpDate: resolvedFollowUpDate,
        followUpTime: followUpTime || null,
      });
      toast.success("Activity logged");
      reset();
      onCreated(res.data, {
        action,
        response,
        interest: interestVisible ? interest : null,
        scheduleFollowUp,
        followUpDate: resolvedFollowUpDate,
        followUpTime: followUpTime || null,
      });
    } catch {
      toast.error("Failed to log activity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus size={14} className="mr-1" />Log Activity</Button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby="structured-activity-title" className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-2xl">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 space-y-3">
      <h3 id="structured-activity-title" className="text-sm font-semibold text-[var(--color-ink)]">Activity</h3>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--color-muted)]">Action</label>
        <Select value={action} onChange={(event) => { setAction(event.target.value as Action); setResponse(""); setInterest(""); }}>
          <option value="CALL">Call</option>
          <option value="WHATSAPP">WhatsApp</option>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--color-muted)]">Response</label>
        <Select value={response} onChange={(event) => { setResponse(event.target.value as Response | ""); setInterest(""); }}>
          <option value="">Select response</option>
          {responses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </div>

      {interestVisible && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--color-muted)]">Interest</label>
          <Select value={interest} onChange={(event) => setInterest(event.target.value as Interest | "")}>
            <option value="">Select interest</option>
            <option value="INTERESTED">Interested</option>
            <option value="NOT_INTERESTED">Not Interested</option>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--color-muted)]">Notes</label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Add notes about this interaction..." className="resize-none" />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={scheduleFollowUp} onChange={(event) => setScheduleFollowUp(event.target.checked)} className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]" />
        <span className="text-sm font-medium text-[var(--color-ink)]">Schedule Follow Up?</span>
      </label>

      {scheduleFollowUp && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><label className="text-xs font-medium text-[var(--color-muted)]">Date</label><Input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-[var(--color-muted)]">Time</label><Input type="time" value={followUpTime} onChange={(event) => setFollowUpTime(event.target.value)} /></div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" isLoading={saving} onClick={submit} disabled={!canSubmit}>Log Activity</Button>
        <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>
      </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
