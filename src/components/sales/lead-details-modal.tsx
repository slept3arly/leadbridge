"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { LeadHeader } from "@/components/sales/lead-header";
import { LeadInfoSection } from "@/components/sales/lead-info-section";
import { LeadMetadataCard } from "@/components/sales/lead-metadata-card";
import { DailyHistory } from "@/components/sales/daily-history";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { useLeadDetails, type LeadDetail, type LeadFollowUp, type ActivityEventItem } from "@/hooks/use-lead-details";
import { CheckCircle2, RotateCcw, Trash2, Plus, Pencil } from "lucide-react";
import { LogActivityModal } from "@/components/sales/log-activity-modal";
import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { formatDate, formatTime, formatTimeValue } from "@/lib/utils";

type LeftTab = "activity" | "details";

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

export function useModalState(open: boolean) {
  const onCloseRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sw > 0) document.body.style.paddingRight = `${sw}px`;
    return () => { document.body.style.overflow = prev; document.body.style.paddingRight = prevPad; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  return { onCloseRef };
}

function ScheduleFollowUpModal({
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
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [logActivity, setLogActivity] = useState(false);
  const [action, setAction] = useState("CALL");
  const [response, setResponse] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onCloseRef } = useModalState(open);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setDate("");
      setTime("");
      setLogActivity(false);
      setAction("CALL");
      setResponse("");
      setInterest("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  const responses = RESPONSE_OPTIONS[action] ?? [];
  const interestVisible = isResponded(response);
  const canSubmit = Boolean(date && (!logActivity || (response && (!interestVisible || interest))));

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const localStr = time ? `${date}T${time}` : `${date}T00:00`;
      const dueDate = new Date(localStr).toISOString();

      if (logActivity) {
        // Log activity with follow-up scheduling
        const responseLabel = response.replaceAll("_", " ");
        const interestLabel = interest ? ` (${interest.replaceAll("_", " ")})` : "";
        await axios.post(`/api/leads/${leadId}/activities`, {
          action,
          response,
          interest: interestVisible ? interest : null,
          notes: notes.trim() || null,
          scheduleFollowUp: true,
          followUpDate: dueDate,
          followUpTime: time || null,
        });
      } else {
        // Schedule follow-up only
        await axios.post(`/api/leads/${leadId}/follow-ups`, {
          title: "Follow-up",
          dueDate,
          dueTime: time || null,
          leadId,
        });
      }

      toast.success("Follow-up scheduled");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to schedule follow-up";
      setError(typeof message === "string" ? message : "Failed to schedule follow-up");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Schedule follow-up" className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[var(--color-border)] max-h-[85vh] flex flex-col">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Schedule Follow-up</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--color-muted)]">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--color-muted)]">Time</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={logActivity} onChange={(e) => setLogActivity(e.target.checked)} className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]" />
            <span className="text-sm font-medium text-[var(--color-ink)]">Also log activity</span>
          </label>

          {logActivity && (
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--color-muted)]">Action</label>
                <Select value={action} onChange={(e) => { setAction(e.target.value); setResponse(""); setInterest(""); }}>
                  {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--color-muted)]">Response</label>
                <Select value={response} onChange={(e) => { setResponse(e.target.value); if (!isResponded(e.target.value)) setInterest(""); }}>
                  <option value="">Select response</option>
                  {responses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              {interestVisible && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--color-muted)]">Interest</label>
                  <Select value={interest} onChange={(e) => setInterest(e.target.value)}>
                    <option value="">Select interest</option>
                    <option value="INTERESTED">Interested</option>
                    <option value="NOT_INTERESTED">Not Interested</option>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--color-muted)]">Notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Add notes..." className="resize-none" />
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
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompleteFollowUpModal({
  open,
  followUp,
  onClose,
  onCompleted,
}: {
  open: boolean;
  followUp: { id: string; title: string } | null;
  onClose: () => void;
  onCompleted: (data: { completedFollowUp: LeadFollowUp; nextFollowUp: LeadFollowUp | null }) => void;
}) {
  const [note, setNote] = useState("");
  const [logActivity, setLogActivity] = useState(false);
  const [action, setAction] = useState("CALL");
  const [response, setResponse] = useState("");
  const [interest, setInterest] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onCloseRef } = useModalState(open);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setNote("");
      setLogActivity(false);
      setAction("CALL");
      setResponse("");
      setInterest("");
      setActivityNotes("");
      setScheduleNext(false);
      setNextDate("");
      setNextTime("");
      setError(null);
    }
  }, [open]);

  const responses = RESPONSE_OPTIONS[action] ?? [];
  const interestVisible = isResponded(response);

  async function handleSubmit() {
    if (!followUp) return;
    setSaving(true);
    setError(null);
    try {
      let nextFollowUp: { dueDate: string; dueTime: string | null } | null = null;
      if (scheduleNext && nextDate) {
        const localStr = nextTime ? `${nextDate}T${nextTime}` : `${nextDate}T00:00`;
        nextFollowUp = {
          dueDate: new Date(localStr).toISOString(),
          dueTime: nextTime || null,
        };
      }

      const result = await axios.post(`/api/follow-ups/${followUp.id}/complete`, {
        note: note.trim() || null,
        nextFollowUp,
        activity: logActivity ? {
          action,
          response,
          interest: interestVisible ? interest : null,
          notes: activityNotes.trim() || null,
        } : null,
      });

      onCompleted(result.data);
      toast.success("Follow-up completed");
      onClose();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to complete follow-up";
      setError(typeof message === "string" ? message : "Failed to complete follow-up");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !followUp) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Complete follow-up" className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[var(--color-border)] max-h-[85vh] flex flex-col">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-ink)]">Complete Follow-up</h2>
            <p className="text-sm text-[var(--color-muted)] mt-1">{followUp.title}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]">Notes / Outcome</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? What did the customer say?" rows={3} className="resize-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={logActivity} onChange={(e) => setLogActivity(e.target.checked)} className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]" />
            <span className="text-sm font-medium text-[var(--color-ink)]">Log activity</span>
          </label>

          {logActivity && (
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--color-muted)]">Action</label>
                <Select value={action} onChange={(e) => { setAction(e.target.value); setResponse(""); setInterest(""); }}>
                  {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--color-muted)]">Response</label>
                <Select value={response} onChange={(e) => { setResponse(e.target.value); if (!isResponded(e.target.value)) setInterest(""); }}>
                  <option value="">Select response</option>
                  {responses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              {interestVisible && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--color-muted)]">Interest</label>
                  <Select value={interest} onChange={(e) => setInterest(e.target.value)}>
                    <option value="">Select interest</option>
                    <option value="INTERESTED">Interested</option>
                    <option value="NOT_INTERESTED">Not Interested</option>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--color-muted)]">Notes</label>
                <Textarea value={activityNotes} onChange={(e) => setActivityNotes(e.target.value)} rows={2} placeholder="Add notes..." className="resize-none" />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={scheduleNext} onChange={(e) => setScheduleNext(e.target.checked)} className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]" />
            <span className="text-sm font-medium text-[var(--color-ink)]">Schedule next follow-up</span>
          </label>

          {scheduleNext && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-muted)]">Date</label>
                <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--color-muted)]">Time</label>
                <Input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
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
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({
  open,
  followUp,
  onClose,
  onSaved,
}: {
  open: boolean;
  followUp: { id: string; dueDate: string | null; dueTime: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onCloseRef } = useModalState(open);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !followUp) return;
    if (followUp.dueDate) {
      const d = new Date(followUp.dueDate);
      setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    } else {
      setDate("");
    }
    setTime(followUp.dueTime ?? "");
    setError(null);
  }, [open, followUp]);

  async function handleSave() {
    if (!date || !followUp) return;
    setSaving(true);
    setError(null);
    try {
      const localStr = time ? `${date}T${time}` : `${date}T00:00`;
      const dueDate = new Date(localStr).toISOString();
      await axios.patch(`/api/follow-ups/${followUp.id}`, { dueDate, dueTime: time || null });
      toast.success("Follow-up rescheduled");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to reschedule follow-up";
      setError(typeof message === "string" ? message : "Failed to reschedule follow-up");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !followUp) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Reschedule follow-up" className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl border border-[var(--color-border)]">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Reschedule Follow-up</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--color-muted)]">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--color-muted)]">Time</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!date || saving}>
            {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditActivityModal({
  open,
  activity,
  onClose,
  onSave,
}: {
  open: boolean;
  activity: ActivityEventItem | null;
  onClose: () => void;
  onSave: (id: string, data: { action: string; response: string; interest: string | null; notes: string | null }) => Promise<void>;
}) {
  const [action, setAction] = useState("CALL");
  const [response, setResponse] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onCloseRef } = useModalState(open);
  onCloseRef.current = onClose;

  const entry = activity?.entries.find((e) => e.action);

  useEffect(() => {
    if (!open || !entry) return;
    setAction(entry.action ?? "CALL");
    setResponse(entry.response ?? "");
    setInterest(entry.interest ?? "");
    setNotes(entry.message ?? "");
    setError(null);
  }, [open, entry]);

  const interestVisible = isResponded(response);
  const canSubmit = response && (!interestVisible || interest);

  async function handleSave() {
    if (!canSubmit || !entry) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(entry.id, {
        action,
        response,
        interest: interestVisible ? interest : null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to update activity";
      setError(typeof message === "string" ? message : "Failed to update activity");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !entry) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Edit activity" className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[var(--color-border)] max-h-[85vh] flex flex-col">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Edit Activity</h2>
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
              {(RESPONSE_OPTIONS[action] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSubmit || saving}>
            {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FollowUpsColumn({
  followUps,
  currentUserId,
  onComplete,
  onReschedule,
  onDelete,
  onScheduleNew,
}: {
  followUps: LeadFollowUp[];
  currentUserId: string;
  onComplete: (id: string, title: string) => void;
  onReschedule: (id: string) => void;
  onDelete: (id: string) => void;
  onScheduleNew: () => void;
}) {
  const pending = followUps.filter((f) => f.status === "PENDING");

  const now = new Date();
  const todayStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStartUTC = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrowUTC = new Date(tomorrowStartUTC.getTime() + 24 * 60 * 60 * 1000);

  const overdue = pending.filter((f) => {
    if (!f.dueDate) return false;
    return new Date(f.dueDate) < todayStartUTC;
  });

  const today = pending.filter((f) => {
    if (!f.dueDate) return false;
    const d = new Date(f.dueDate);
    return d >= todayStartUTC && d < tomorrowStartUTC;
  });

  const tomorrow = pending.filter((f) => {
    if (!f.dueDate) return false;
    const d = new Date(f.dueDate);
    return d >= tomorrowStartUTC && d < dayAfterTomorrowUTC;
  });

  const upcoming = pending.filter((f) => {
    if (!f.dueDate) return true;
    const d = new Date(f.dueDate);
    return d >= dayAfterTomorrowUTC;
  });

  function renderGroup(label: string, items: LeadFollowUp[]) {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <h4 className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-2">{label}</h4>
        <div className="space-y-2">
          {items.map((fu) => {
            const isOverdue = fu.dueDate && new Date(fu.dueDate) < todayStartUTC;
            return (
              <div
                key={fu.id}
                className={`rounded-xl border p-3 ${isOverdue ? "border-red-200 bg-red-50" : "border-[var(--color-border)] bg-white"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {fu.dueDate && (
                      <p className="text-xs text-[var(--color-muted)]">
                        {formatDate(fu.dueDate, "-")}
                        {fu.dueTime ? ` · ${formatTime(fu.dueTime)}` : ""}
                      </p>
                    )}
                    <p className="text-sm font-medium text-[var(--color-ink)] mt-0.5">{fu.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onComplete(fu.id, fu.title)}
                    className="h-7 text-xs gap-1"
                  >
                    <CheckCircle2 size={12} />
                    Complete
                  </Button>
                  <IconActionButton
                    icon={RotateCcw}
                    label="Reschedule follow-up"
                    onClick={() => onReschedule(fu.id)}
                    className="h-7 w-7"
                  />
                  {fu.createdBy.id === currentUserId && (
                    <IconActionButton
                      icon={Trash2}
                      label="Delete follow-up"
                      onClick={() => onDelete(fu.id)}
                      className="h-7 w-7"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">Follow-ups</h3>
          <Button size="sm" variant="secondary" onClick={onScheduleNew} className="h-7 text-xs gap-1">
            <Plus size={12} />
            Follow-up
          </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {pending.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--color-muted)]">
            No upcoming follow-ups
          </div>
        ) : (
          <>
            {overdue.length > 0 && renderGroup("Overdue", overdue)}
            {today.length > 0 && renderGroup("Today", today)}
            {tomorrow.length > 0 && renderGroup("Tomorrow", tomorrow)}
            {upcoming.length > 0 && renderGroup("Upcoming", upcoming)}
          </>
        )}
      </div>
    </div>
  );
}

export function LeadDetailsModal({
  leadId,
  currentUserId,
  isAdmin,
  canArchive = false,
  canDelete = false,
  leadSources,
  onClose,
  onUpdate,
}: {
  leadId: string;
  currentUserId: string;
  isAdmin: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
  leadSources?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<LeftTab>("activity");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data, loading: detailsLoading, refresh, patchData, completeFollowUp } = useLeadDetails(leadId);
  const [leadDraft, setLeadDraft] = useState<LeadDetail | null>(null);

  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [scheduleFollowUpOpen, setScheduleFollowUpOpen] = useState(false);
  const [completionFollowUp, setCompletionFollowUp] = useState<{ id: string; title: string } | null>(null);
  const [editActivity, setEditActivity] = useState<ActivityEventItem | null>(null);
  const [rescheduleFollowUp, setRescheduleFollowUp] = useState<{ id: string; dueDate: string | null; dueTime: string | null } | null>(null);
  const [editLeadOpen, setEditLeadOpen] = useState(false);

  useEffect(() => {
    setLeadDraft(data?.lead ?? null);
  }, [data?.lead, leadId]);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setLeadDraft((prev) => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!leadDraft) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status: leadDraft.status,
        priority: leadDraft.priority,
        category: leadDraft.category || null,
      };
      await axios.patch(`/api/leads/${leadId}`, payload);
      toast.success("Lead updated");
      patchData((prev) => prev ? {
        ...prev,
        lead: { ...prev.lead, status: leadDraft.status, priority: leadDraft.priority, category: leadDraft.category },
      } : prev);
      refresh();
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Failed to update lead");
    } finally {
      setSaving(false);
    }
  }, [leadDraft, leadId, onUpdate, refresh, patchData]);

  const handleToggleArchive = useCallback(async () => {
    if (!leadDraft) return;
    setArchiving(true);
    try {
      const isCurrentlyArchived = leadDraft.isArchived as boolean;
      await axios.patch(`/api/leads/${leadId}`, { isArchived: !isCurrentlyArchived });
      await refresh();
      toast.success(isCurrentlyArchived ? "Lead unarchived" : "Lead archived");
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Failed to update archive status");
    } finally {
      setArchiving(false);
    }
  }, [leadDraft, leadId, onUpdate, refresh]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this lead permanently? This action cannot be undone.")) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/leads/${leadId}`);
      toast.success("Lead deleted");
      onClose();
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Failed to delete lead.");
    } finally {
      setDeleting(false);
    }
  }, [leadId, onClose, onUpdate]);

  const handleCompleteFollowUp = useCallback(async (_result: { completedFollowUp: LeadFollowUp; nextFollowUp: LeadFollowUp | null }) => {
    refresh();
  }, [refresh]);

  const handleEditActivity = useCallback(async (id: string, data: { action: string; response: string; interest: string | null; notes: string | null }) => {
    await axios.patch(`/api/activities/${id}`, data);
    toast.success("Activity updated");
    refresh();
  }, [refresh]);

  const handleDeleteFollowUp = useCallback(async (id: string) => {
    if (!confirm("Delete this follow-up?")) return;
    await axios.delete(`/api/follow-ups/${id}`);
    toast.success("Follow-up deleted");
    refresh();
  }, [refresh]);

  const lead = leadDraft ?? data?.lead ?? null;
  const activityEvents = data?.activityEvents ?? [];
  const allFollowUps = data?.followUps ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 mt-4 mb-4 w-[95%] max-w-6xl flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        style={{ height: "92vh", maxHeight: "92vh" }}
      >
        {detailsLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
          </div>
        ) : !lead ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-muted)]">
            Failed to load lead details.
          </div>
        ) : (
          <>
            <LeadHeader
              lead={lead}
              onClose={onClose}
              onChange={handleFieldChange}
              onUpdate={handleUpdate}
              onToggleArchive={handleToggleArchive}
              onDelete={handleDelete}
              saving={saving}
              archiving={archiving}
              deleting={deleting}
              canArchive={canArchive}
              canDelete={canDelete}
            />

            <div className="flex flex-1 overflow-hidden">
              {/* Left Column - Navigation */}
              <div className="w-[200px] shrink-0 border-r border-[var(--color-border)] flex flex-col bg-white">
                <div className="flex flex-col p-2 gap-1">
                  <button
                    onClick={() => setActiveTab("activity")}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition text-left ${
                      activeTab === "activity"
                        ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                        : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-slate-50"
                    }`}
                  >
                    Activity
                  </button>
                  <button
                    onClick={() => setActiveTab("details")}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition text-left ${
                      activeTab === "details"
                        ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                        : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-slate-50"
                    }`}
                  >
                    Details
                  </button>
                </div>
              </div>

              {/* Center Column */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {activeTab === "activity" && (
                  <div className="shrink-0 px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">History</h3>
                    <Button size="sm" variant="secondary" onClick={() => setLogActivityOpen(true)} className="h-7 text-xs gap-1">
                      <Plus size={12} />
                      Log Activity
                    </Button>
                  </div>
                )}
                {activeTab === "details" && (
                  <div className="shrink-0 px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">Lead Details</h3>
                    <Button size="sm" variant="secondary" onClick={() => setEditLeadOpen(true)} className="h-7 text-xs gap-1">
                      <Pencil size={12} />
                      Edit
                    </Button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-5">
                  {activeTab === "activity" ? (
                    <DailyHistory
                      activityEvents={activityEvents}
                      onEditActivity={(id) => {
                        const event = activityEvents.find((e) => e.entries.some((en) => en.id === id));
                        if (event) {
                          const entry = event.entries.find((en) => en.id === id);
                          if (entry && entry.action) {
                            setEditActivity(event);
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="space-y-5">
                      <LeadInfoSection lead={lead as unknown as Parameters<typeof LeadInfoSection>[0]["lead"]} />
                      <LeadMetadataCard lead={lead as unknown as Parameters<typeof LeadMetadataCard>[0]["lead"]} />
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Follow-ups (persistent) */}
              <div className="w-[300px] shrink-0 border-l border-[var(--color-border)] bg-white">
                <FollowUpsColumn
                  followUps={allFollowUps}
                  currentUserId={currentUserId}
                  onComplete={(id, title) => setCompletionFollowUp({ id, title })}
                  onReschedule={(id) => {
                    const fu = allFollowUps.find((f) => f.id === id);
                    if (fu) setRescheduleFollowUp({ id: fu.id, dueDate: fu.dueDate, dueTime: fu.dueTime });
                  }}
                  onDelete={handleDeleteFollowUp}
                  onScheduleNew={() => setScheduleFollowUpOpen(true)}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <LogActivityModal
        open={logActivityOpen}
        leadId={leadId}
        onClose={() => setLogActivityOpen(false)}
        onSaved={refresh}
      />

      <ScheduleFollowUpModal
        open={scheduleFollowUpOpen}
        leadId={leadId}
        onClose={() => setScheduleFollowUpOpen(false)}
        onSaved={refresh}
      />

      {completionFollowUp && (
        <CompleteFollowUpModal
          open={true}
          followUp={completionFollowUp}
          onClose={() => setCompletionFollowUp(null)}
          onCompleted={handleCompleteFollowUp}
        />
      )}

      <EditActivityModal
        open={!!editActivity}
        activity={editActivity}
        onClose={() => setEditActivity(null)}
        onSave={handleEditActivity}
      />

      <RescheduleModal
        open={!!rescheduleFollowUp}
        followUp={rescheduleFollowUp}
        onClose={() => setRescheduleFollowUp(null)}
        onSaved={refresh}
      />

      {lead && (
        <LeadEditModal
          open={editLeadOpen}
          onClose={() => setEditLeadOpen(false)}
          onSaved={refresh}
          lead={{
            id: lead.id,
            name: lead.displayName,
            company: lead.company as string | null,
            email: lead.email as string | null,
            phone: lead.phone as string | null,
            city: lead.city as string | null,
            state: lead.state as string | null,
            product: lead.product as string | null,
            requirement: lead.requirement as string | null,
            status: lead.status,
            priority: lead.priority,
            category: (lead.category as string | null) ?? null,
            sourceId: lead.sourceId as string | null | undefined,
            source: lead.source as { id: string; name: string } | null | undefined,
            assignedUserId: lead.assignedUserId as string | null,
          }}
          leadSources={leadSources}
          submitLabel="Save"
        />
      )}
    </div>
  );
}
