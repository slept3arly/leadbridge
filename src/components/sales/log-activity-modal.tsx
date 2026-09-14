"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useModalState } from "@/components/sales/lead-details-modal";

const ACTION_OPTIONS = [
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
] as const;

const RESPONSE_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
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

function isResponded(response: string) {
  return response === "PICKED_UP" || response === "REPLIED";
}

export function LogActivityModal({
  open,
  leadId,
  onClose,
  onSaved,
}: {
  open: boolean;
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [action, setAction] = useState("CALL");
  const [response, setResponse] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onCloseRef } = useModalState(open);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setAction("CALL");
      setResponse("");
      setInterest("");
      setNotes("");
      setScheduleFollowUp(false);
      setFollowUpDate("");
      setFollowUpTime("");
      setError(null);
    }
  }, [open]);

  const responses = RESPONSE_OPTIONS[action] ?? [];
  const interestVisible = isResponded(response);
  const canSubmit = Boolean(response && (!interestVisible || interest) && (!scheduleFollowUp || followUpDate));

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      let resolvedFollowUpDate: string | null = null;
      if (followUpDate) {
        const localStr = followUpTime ? `${followUpDate}T${followUpTime}` : `${followUpDate}T00:00`;
        resolvedFollowUpDate = new Date(localStr).toISOString();
      }
      await axios.post(`/api/leads/${leadId}/activities`, {
        action,
        response,
        interest: interestVisible ? interest : null,
        notes: notes.trim() || null,
        scheduleFollowUp,
        followUpDate: resolvedFollowUpDate,
        followUpTime: followUpTime || null,
      });
      toast.success("Activity logged");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to log activity";
      setError(typeof message === "string" ? message : "Failed to log activity");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Log activity" className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[var(--color-border)] max-h-[85vh] flex flex-col">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Log Activity</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]">Action</label>
            <Select value={action} onChange={(e) => { setAction(e.target.value); setResponse(""); setInterest(""); }}>
              {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]">Response</label>
            <Select value={response} onChange={(e) => { setResponse(e.target.value); if (!isResponded(e.target.value)) setInterest(""); }}>
              <option value="">Select response</option>
              {responses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>

          {interestVisible && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]">Interest</label>
              <Select value={interest} onChange={(e) => setInterest(e.target.value)}>
                <option value="">Select interest</option>
                <option value="INTERESTED">Interested</option>
                <option value="NOT_INTERESTED">Not Interested</option>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add notes..." className="resize-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={scheduleFollowUp} onChange={(e) => setScheduleFollowUp(e.target.checked)} className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]" />
            <span className="text-sm font-medium text-[var(--color-ink)]">Schedule follow-up</span>
          </label>

          {scheduleFollowUp && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-muted)]">Date</label>
                <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-muted)]">Time</label>
                <Input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)} />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="black" onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Log Activity"}
          </Button>
        </div>
      </div>
    </div>
  );
}
