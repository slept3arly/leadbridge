"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FOLLOW_UP_PRIORITIES, FOLLOW_UP_STATUSES, LEAD_PRIORITIES, LEAD_STATUSES } from "@/lib/lead-constants";
import { ACTIVITY_ACTION_OPTIONS, ACTIVITY_INTEREST_OPTIONS, getActivityResponseOptions, isSuccessfulActivityResponse } from "@/lib/activity-options";
import { followUpFormDate } from "@/lib/follow-up-form-date";
import { leadProgressRequestSchema } from "@/lib/validation";
import { formatDate, formatTime, startOfTodayUTC } from "@/lib/utils";
import { getEligibleProgressFollowUps } from "@/lib/record-progress-follow-ups";

export type ProgressFollowUp = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string | null;
  dueTime: string | null;
  status: string;
  priority?: string;
  leadId?: string | null;
  assignedUser?: { id?: string; name: string } | null;
};

type LeadClassification = { status: string; priority: string };
type DetailsResponse = {
  lead: LeadClassification & { displayName?: string; name?: string };
  followUps: ProgressFollowUp[];
};
type ProgressField = "action" | "response" | "interest" | "notes" | "status" | "priority" | "followUpDate" | "followUpTime";
type ProgressFieldErrors = Partial<Record<ProgressField, string>>;

const FIELD_ELEMENT_ID: Partial<Record<ProgressField, string>> = {
  action: "record-progress-action",
  response: "record-progress-response",
  status: "progress-status",
  priority: "progress-priority",
  interest: "record-progress-interest",
  notes: "record-progress-notes",
  followUpDate: "progress-follow-up-date",
  followUpTime: "progress-follow-up-time",
};

export function RecordProgressModal({
  open,
  leadId,
  leadName,
  lead: leadProp,
  pendingFollowUps: followUpsProp,
  onClose,
  onSaved,
}: {
  open: boolean;
  leadId: string;
  leadName?: string;
  lead?: LeadClassification | null;
  pendingFollowUps?: ProgressFollowUp[];
  /** Retained for callers that open the modal from Tasks; existing tasks remain read-only here. */
  initialFollowUpId?: string;
  initialFollowUpSchedule?: { date: string; time: string } | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const initialPendingFollowUps = followUpsProp ? getEligibleProgressFollowUps(followUpsProp, leadId) : [];
  const [lead, setLead] = useState<LeadClassification | null>(leadProp ?? null);
  const [followUps, setFollowUps] = useState<ProgressFollowUp[]>(initialPendingFollowUps);
  const [loadingDetails, setLoadingDetails] = useState(!leadProp);
  const [action, setAction] = useState("CALL");
  const [response, setResponse] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(leadProp?.status ?? "NEW");
  const [priority, setPriority] = useState(leadProp?.priority ?? "MEDIUM");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProgressFieldErrors>({});
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open, onClose, canClose: !saving });

  function focusFirstInvalid(fields: ProgressField[]) {
    const elementId = fields.map((field) => FIELD_ELEMENT_ID[field]).find(Boolean);
    if (elementId) requestAnimationFrame(() => document.getElementById(elementId)?.focus());
  }

  function clearFieldErrors(fields: ProgressField[]) {
    setFieldErrors((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  useEffect(() => {
    if (!open || followUpsProp) return;
    let cancelled = false;
    axios.get<DetailsResponse>(`/api/leads/${leadId}/details`).then(({ data }) => {
      if (cancelled) return;
      setLead(data.lead);
      setStatus(data.lead.status);
      setPriority(data.lead.priority);
      setFollowUps(getEligibleProgressFollowUps(data.followUps, leadId));
    }).catch(() => {
      if (!cancelled) setError("Unable to load the latest lead and follow-up details. Close and reopen this form to retry.");
    }).finally(() => {
      if (!cancelled) setLoadingDetails(false);
    });
    return () => { cancelled = true; };
  }, [open, leadId, followUpsProp]);

  const pendingFollowUps = useMemo(() => getEligibleProgressFollowUps(followUps, leadId), [followUps, leadId]);
  const currentFollowUp = pendingFollowUps[0] ?? null;
  const responseOptions = getActivityResponseOptions(action);
  const interestVisible = isSuccessfulActivityResponse(response);

  function toggleScheduling(enabled: boolean) {
    setScheduleFollowUp(enabled);
    clearFieldErrors(["followUpDate", "followUpTime"]);
    if (!enabled) {
      setFollowUpDate("");
      setFollowUpTime("");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const payload: Record<string, unknown> = {
      action,
      response,
      interest: interestVisible ? interest || null : null,
      notes: notes.trim() || null,
      scheduleFollowUp,
      followUpDate: scheduleFollowUp ? followUpFormDate(followUpDate, followUpTime) : null,
      followUpTime: scheduleFollowUp ? followUpTime || null : null,
    };
    if (lead) {
      if (status !== lead.status) payload.status = status;
      if (priority !== lead.priority) payload.priority = priority;
    }

    const parsed = leadProgressRequestSchema.safeParse(payload);
    setError(null);
    setFieldErrors({});
    if (!parsed.success) {
      const next: ProgressFieldErrors = {};
      const invalidFields: ProgressField[] = [];
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in FIELD_ELEMENT_ID) {
          const field = key as ProgressField;
          next[field] ??= issue.message;
          invalidFields.push(field);
        }
      }
      setFieldErrors(next);
      focusFirstInvalid(invalidFields);
      if (Object.keys(next).length === 0) setError(parsed.error.issues[0]?.message ?? "Review the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`/api/leads/${leadId}/activities`, parsed.data);
      toast.success("Progress recorded");
      onClose();
      void onSaved();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError("The lead or follow-up changed while you were working. Refresh the details and try again.");
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError("You no longer have permission to record progress on this lead.");
      } else {
        const serverError = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
        if (serverError && typeof serverError === "object" && "fieldErrors" in serverError) {
          const serverFields = (serverError as { fieldErrors?: Record<string, unknown> }).fieldErrors ?? {};
          const next: ProgressFieldErrors = {};
          const invalidFields: ProgressField[] = [];
          for (const key of Object.keys(FIELD_ELEMENT_ID) as ProgressField[]) {
            const values = serverFields[key];
            if (Array.isArray(values) && typeof values[0] === "string") {
              next[key] = values[0];
              invalidFields.push(key);
            }
          }
          if (Object.keys(next).length) {
            setFieldErrors(next);
            focusFirstInvalid(invalidFields);
          } else setError("The server rejected part of this submission. Review the form and try again.");
        } else {
          setError(typeof serverError === "string" ? serverError : "Unable to record progress. Your entries are still here; please try again.");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  const todayStart = startOfTodayUTC().getTime();
  const followUpStatus = currentFollowUp ? FOLLOW_UP_STATUSES.find((item) => item.value === currentFollowUp.status)?.label ?? currentFollowUp.status : null;
  const followUpPriority = currentFollowUp?.priority ? FOLLOW_UP_PRIORITIES.find((item) => item.value === currentFollowUp.priority)?.label ?? currentFollowUp.priority : null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div ref={dialogRef} data-accessible-dialog role="dialog" aria-modal="true" aria-labelledby="record-progress-title" tabIndex={-1} className="absolute inset-0 flex h-[100dvh] flex-col bg-white">
        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4 sm:px-8">
            <div>
              <h2 id="record-progress-title" className="text-xl font-bold text-[var(--color-ink)]">Record Progress</h2>
              {leadName && <p className="mt-1 text-sm text-[var(--color-muted)]">For {leadName}</p>}
            </div>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} aria-label="Close Record Progress">Close</Button>
          </header>

          {error && <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-8" role="alert">{error}</div>}

          <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
            <div className="min-h-0 space-y-6 overflow-y-auto border-b border-[var(--color-border)] p-5 sm:p-8 lg:border-b-0 lg:border-r">
              <section aria-labelledby="progress-interaction-title" className="space-y-4">
                <h3 id="progress-interaction-title" className="text-base font-semibold text-[var(--color-ink)]">Customer Interaction</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="record-progress-action" className="text-sm font-medium text-[var(--color-ink)]">Action</label>
                    <Select id="record-progress-action" value={action} required aria-invalid={!!fieldErrors.action} aria-describedby={fieldErrors.action ? "record-progress-action-error" : undefined} onChange={(event) => { setAction(event.target.value); setResponse(""); setInterest(""); clearFieldErrors(["action", "response", "interest"]); }}>
                      {ACTIVITY_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                    {fieldErrors.action && <p id="record-progress-action-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.action}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="record-progress-response" className="text-sm font-medium text-[var(--color-ink)]">Response</label>
                    <Select id="record-progress-response" value={response} required aria-invalid={!!fieldErrors.response} aria-describedby={fieldErrors.response ? "record-progress-response-error" : undefined} onChange={(event) => { setResponse(event.target.value); if (!isSuccessfulActivityResponse(event.target.value)) setInterest(""); clearFieldErrors(["response", "interest"]); }}>
                      <option value="">Select response</option>
                      {responseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                    {fieldErrors.response && <p id="record-progress-response-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.response}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="progress-status" className="text-sm font-medium text-[var(--color-ink)]">Status</label>
                    <Select id="progress-status" value={status} aria-invalid={!!fieldErrors.status} aria-describedby={fieldErrors.status ? "progress-status-error" : undefined} onChange={(event) => { setStatus(event.target.value); clearFieldErrors(["status"]); }} disabled={!lead}>{LEAD_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
                    {fieldErrors.status && <p id="progress-status-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.status}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="progress-priority" className="text-sm font-medium text-[var(--color-ink)]">Priority</label>
                    <Select id="progress-priority" value={priority} aria-invalid={!!fieldErrors.priority} aria-describedby={fieldErrors.priority ? "progress-priority-error" : undefined} onChange={(event) => { setPriority(event.target.value); clearFieldErrors(["priority"]); }} disabled={!lead}>{LEAD_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
                    {fieldErrors.priority && <p id="progress-priority-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.priority}</p>}
                  </div>
                </div>
                {interestVisible && <div className="space-y-1.5">
                  <label htmlFor="record-progress-interest" className="text-sm font-medium text-[var(--color-ink)]">Interest</label>
                  <Select id="record-progress-interest" value={interest} required aria-invalid={!!fieldErrors.interest} aria-describedby={fieldErrors.interest ? "record-progress-interest-error" : undefined} onChange={(event) => { setInterest(event.target.value); clearFieldErrors(["interest"]); }}>
                    <option value="">Select interest</option>
                    {ACTIVITY_INTEREST_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                  {fieldErrors.interest && <p id="record-progress-interest-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.interest}</p>}
                </div>}
                <div className="space-y-2">
                  <h3 id="progress-notes-title" className="text-base font-semibold text-[var(--color-ink)]">Notes</h3>
                  <Textarea id="record-progress-notes" value={notes} onChange={(event) => { setNotes(event.target.value); clearFieldErrors(["notes"]); }} rows={2} maxLength={10000} placeholder="Add a note about the interaction" className="min-h-[60px] resize-y" aria-invalid={!!fieldErrors.notes} aria-describedby={fieldErrors.notes ? "record-progress-notes-error" : undefined} />
                  {fieldErrors.notes && <p id="record-progress-notes-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.notes}</p>}
                </div>
              </section>
            </div>

            <div className="min-h-0 space-y-6 overflow-y-auto p-5 sm:p-8">
              <section aria-labelledby="progress-follow-ups-title" className="space-y-4 border-t border-[var(--color-border)] pt-5">
                <h3 id="progress-follow-ups-title" className="text-base font-semibold text-[var(--color-ink)]">Manage Follow-ups</h3>
                {loadingDetails ? <p role="status" className="text-sm text-[var(--color-muted)]">Loading current follow-up…</p> : currentFollowUp ? (
                  <article className="rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-[var(--color-ink)]">{currentFollowUp.title}</h4>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">{followUpStatus}{followUpPriority ? ` · ${followUpPriority} priority` : ""}</p>
                      </div>
                      {currentFollowUp.dueDate && new Date(currentFollowUp.dueDate).getTime() < todayStart && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Overdue</span>}
                    </div>
                    {currentFollowUp.description?.trim() && <p className="mt-3 text-sm text-[var(--color-muted)]">{currentFollowUp.description}</p>}
                    <p className="mt-3 text-sm text-[var(--color-ink)]">Due: {currentFollowUp.dueDate ? formatDate(currentFollowUp.dueDate) : "No due date"}{currentFollowUp.dueTime ? ` · ${formatTime(currentFollowUp.dueTime)}` : ""}</p>
                    {currentFollowUp.assignedUser?.name && <p className="mt-1 text-xs text-[var(--color-muted)]">Assigned to {currentFollowUp.assignedUser.name}</p>}
                  </article>
                ) : <p className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">No pending follow-up.</p>}

                <div>
                  <button id="record-progress-schedule-toggle" type="button" role="switch" aria-checked={scheduleFollowUp} aria-controls="record-progress-schedule-fields" onClick={() => toggleScheduling(!scheduleFollowUp)} disabled={saving} className="flex w-full items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface)] focus-visible:border-[var(--color-brand)] focus-visible:ring-3 focus-visible:ring-[var(--color-brand)]/20 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-60">
                    <span className="text-sm font-medium text-[var(--color-ink)]">Schedule a new follow-up</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--color-muted)]" aria-hidden="true">{scheduleFollowUp ? "On" : "Off"}</span>
                      <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${scheduleFollowUp ? "bg-[var(--color-brand)]" : "bg-[var(--color-surface-raised)]"}`}>
                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${scheduleFollowUp ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
                      </span>
                    </span>
                  </button>
                  <div id="record-progress-schedule-fields" inert={!scheduleFollowUp} aria-hidden={!scheduleFollowUp} className={`grid transition-all duration-200 ease-out ${scheduleFollowUp ? "mt-3 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><label htmlFor="progress-follow-up-date" className="text-sm font-medium text-[var(--color-ink)]">Due date</label><Input id="progress-follow-up-date" type="date" value={followUpDate} onChange={(event) => { setFollowUpDate(event.target.value); clearFieldErrors(["followUpDate"]); }} required={scheduleFollowUp} aria-invalid={!!fieldErrors.followUpDate} aria-describedby={fieldErrors.followUpDate ? "progress-follow-up-date-error" : undefined} />{fieldErrors.followUpDate && <p id="progress-follow-up-date-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.followUpDate}</p>}</div>
                        <div className="space-y-1.5"><label htmlFor="progress-follow-up-time" className="text-sm font-medium text-[var(--color-ink)]">Time</label><Input id="progress-follow-up-time" type="time" value={followUpTime} onChange={(event) => { setFollowUpTime(event.target.value); clearFieldErrors(["followUpTime"]); }} aria-invalid={!!fieldErrors.followUpTime} aria-describedby={fieldErrors.followUpTime ? "progress-follow-up-time-error" : undefined} />{fieldErrors.followUpTime && <p id="progress-follow-up-time-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.followUpTime}</p>}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </main>

          <footer className="flex shrink-0 flex-col gap-3 border-t border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-xs text-[var(--color-muted)] sm:max-w-[60%]">Recording progress will automatically mark the existing follow-up as completed, even if you don&apos;t schedule a new follow-up.</p>
            <div className="flex shrink-0 justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="black" disabled={saving || loadingDetails || !lead}>
                {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Record Progress"}
              </Button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
