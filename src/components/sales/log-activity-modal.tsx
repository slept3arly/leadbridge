"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useModalState } from "@/components/sales/lead-details-modal";
import { ActivityFormFields } from "@/components/sales/activity-fields";
import { interactionActivitySchema } from "@/lib/validation";
import { isSuccessfulActivityResponse } from "@/lib/activity-options";

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
  const dialogRef = useModalState(open, onClose, !saving);

  const canSubmit = interactionActivitySchema.safeParse({
    action,
    response,
    interest: interest || null,
    notes: notes.trim() || null,
    scheduleFollowUp,
    followUpDate: scheduleFollowUp && followUpDate ? followUpDate : null,
    followUpTime: scheduleFollowUp ? followUpTime || null : null,
  }).success;

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
        interest: isSuccessfulActivityResponse(response) ? interest : null,
        notes: notes.trim() || null,
        scheduleFollowUp,
        followUpDate: scheduleFollowUp ? resolvedFollowUpDate : null,
        followUpTime: scheduleFollowUp ? followUpTime || null : null,
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div ref={dialogRef} data-accessible-dialog role="dialog" aria-modal="true" aria-label="Log activity" tabIndex={-1} className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[var(--color-border)] max-h-[85vh] flex flex-col">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Log Activity</h2>

          <ActivityFormFields
            idPrefix="activity"
            autoFocusAction
            action={action}
            response={response}
            interest={interest}
            notes={notes}
            scheduleFollowUp={scheduleFollowUp}
            followUpDate={followUpDate}
            followUpTime={followUpTime}
            onActionChange={(value) => { setAction(value); setResponse(""); setInterest(""); }}
            onResponseChange={(value) => { setResponse(value); if (value !== "PICKED_UP" && value !== "REPLIED") setInterest(""); }}
            onInterestChange={setInterest}
            onNotesChange={setNotes}
            onScheduleFollowUpChange={setScheduleFollowUp}
            onFollowUpDateChange={setFollowUpDate}
            onFollowUpTimeChange={setFollowUpTime}
          />

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
