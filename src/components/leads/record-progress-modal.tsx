"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import { ActivityFormFields } from "@/components/sales/activity-fields";
import { AccordionSection } from "@/components/ui/accordion-section";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { LEAD_CATEGORIES, LEAD_PRIORITIES, LEAD_STATUSES } from "@/lib/lead-constants";
import { followUpFormDate } from "@/lib/follow-up-form-date";
import { isSuccessfulActivityResponse } from "@/lib/activity-options";
import { leadProgressRequestSchema } from "@/lib/validation";
import { formatDate, formatTime, startOfTodayUTC } from "@/lib/utils";
import { getCompletionFollowUpId, getEligibleProgressFollowUps, getValidProposedFollowUpId } from "@/lib/record-progress-follow-ups";

export type ProgressFollowUp = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string | null;
  dueTime: string | null;
  status: string;
  leadId?: string | null;
  assignedUser?: { id?: string; name: string } | null;
};

type LeadClassification = {
  status: string;
  priority: string;
  category?: string | null;
};

type DetailsResponse = {
  lead: LeadClassification & { displayName?: string; name?: string };
  followUps: ProgressFollowUp[];
};

type AccordionKey = "interaction" | "classification" | "followUps";
type ProgressField = "action" | "response" | "interest" | "notes" | "status" | "priority" | "category" | "scheduleFollowUp" | "followUpDate" | "followUpTime" | "completeFollowUpId";
type ProgressFieldErrors = Partial<Record<ProgressField, string>>;

const FIELD_SECTION: Record<ProgressField, AccordionKey> = {
  action: "interaction",
  response: "interaction",
  interest: "interaction",
  notes: "interaction",
  status: "classification",
  priority: "classification",
  category: "classification",
  scheduleFollowUp: "followUps",
  followUpDate: "followUps",
  followUpTime: "followUps",
  completeFollowUpId: "followUps",
};

const FIELD_ELEMENT_ID: Partial<Record<ProgressField, string>> = {
  action: "record-progress-action",
  response: "record-progress-response",
  interest: "record-progress-interest",
  notes: "record-progress-notes",
  status: "progress-status",
  priority: "progress-priority",
  category: "progress-category",
  followUpDate: "progress-follow-up-date",
  followUpTime: "progress-follow-up-time",
};

export function RecordProgressModal({
  open,
  leadId,
  leadName,
  lead: leadProp,
  pendingFollowUps: followUpsProp,
  initialFollowUpId,
  initialFollowUpSchedule,
  onClose,
  onSaved,
}: {
  open: boolean;
  leadId: string;
  leadName?: string;
  lead?: LeadClassification | null;
  pendingFollowUps?: ProgressFollowUp[];
  /** A Tasks entry point may preselect a pending task; submitting Record Progress confirms completion. */
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
  const [expandedSections, setExpandedSections] = useState<Record<AccordionKey, boolean>>({
    interaction: false,
    classification: false,
    followUps: false,
  });
  const [status, setStatus] = useState(leadProp?.status ?? "NEW");
  const [priority, setPriority] = useState(leadProp?.priority ?? "MEDIUM");
  const [category, setCategory] = useState(leadProp?.category ?? "");
  const [selectedFollowUpId, setSelectedFollowUpId] = useState(() => getValidProposedFollowUpId(initialFollowUpId, initialPendingFollowUps));
  const [scheduleFollowUp, setScheduleFollowUp] = useState(Boolean(initialFollowUpSchedule));
  const [followUpDate, setFollowUpDate] = useState(initialFollowUpSchedule?.date ?? "");
  const [followUpTime, setFollowUpTime] = useState(initialFollowUpSchedule?.time ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProgressFieldErrors>({});
  const focusAfterExpansion = useRef<string | null>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open, onClose, canClose: !saving });

  useEffect(() => {
    const elementId = focusAfterExpansion.current;
    if (!elementId) return;
    const element = document.getElementById(elementId);
    if (element && !element.closest("[hidden]")) element.focus();
    focusAfterExpansion.current = null;
  }, [expandedSections]);

  function expandSectionsWithErrors(fields: ProgressField[]) {
    const sections = new Set(fields.map((field) => FIELD_SECTION[field]));
    if (sections.size) {
      setExpandedSections((current) => ({
        ...current,
        interaction: current.interaction || sections.has("interaction"),
        classification: current.classification || sections.has("classification"),
        followUps: current.followUps || sections.has("followUps"),
      }));
    }
    const firstField = fields.find((field) => FIELD_ELEMENT_ID[field]);
    if (firstField) focusAfterExpansion.current = FIELD_ELEMENT_ID[firstField] ?? null;
  }

  function clearFieldErrors(fields: ProgressField[]) {
    setFieldErrors((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (followUpsProp) return () => { cancelled = true; };

    axios.get<DetailsResponse>(`/api/leads/${leadId}/details`).then(({ data }) => {
      if (cancelled) return;
      setLead(data.lead);
      setStatus(data.lead.status);
      setPriority(data.lead.priority);
      setCategory(data.lead.category ?? "");
      const pending = getEligibleProgressFollowUps(data.followUps, leadId);
      setFollowUps(pending);
      setSelectedFollowUpId(getValidProposedFollowUpId(initialFollowUpId, pending));
    }).catch(() => {
      if (!cancelled) setError("Unable to load the latest lead and follow-up details. Close and reopen this form to retry.");
    }).finally(() => {
      if (!cancelled) {
        setLoadingDetails(false);
      }
    });
    return () => { cancelled = true; };
  }, [open, leadId, followUpsProp, initialFollowUpId]);

  const pendingFollowUps = useMemo(() => getEligibleProgressFollowUps(followUps, leadId), [followUps, leadId]);
  const selectedFollowUp = pendingFollowUps.find((item) => item.id === selectedFollowUpId) ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const completeFollowUpId = getCompletionFollowUpId(selectedFollowUpId, pendingFollowUps);
    const payload: Record<string, unknown> = {
      action,
      response,
      interest: isSuccessfulActivityResponse(response) ? interest || null : null,
      notes: notes.trim() || null,
      scheduleFollowUp,
      followUpDate: scheduleFollowUp ? followUpFormDate(followUpDate, followUpTime) : null,
      followUpTime: scheduleFollowUp ? followUpTime || null : null,
      ...(completeFollowUpId ? { completeFollowUpId } : {}),
    };
    if (lead) {
      if (status !== lead.status) payload.status = status;
      if (priority !== lead.priority) payload.priority = priority;
      const normalizedCategory = category || null;
      if (normalizedCategory !== (lead.category ?? null)) payload.category = normalizedCategory;
    }

    const parsed = leadProgressRequestSchema.safeParse(payload);
    setError(null);
    setFieldErrors({});
    if (!parsed.success) {
      const next: ProgressFieldErrors = {};
      const invalidFields: ProgressField[] = [];
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in FIELD_SECTION) {
          const field = key as ProgressField;
          next[field] ??= issue.message;
          invalidFields.push(field);
        }
      }
      setFieldErrors(next);
      expandSectionsWithErrors(invalidFields);
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
        setError("The lead or follow-up changed while you were working. Refresh the details, review the current task, and try again.");
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError("You no longer have permission to record progress on this lead.");
      } else {
        const serverError = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
        if (serverError && typeof serverError === "object" && "fieldErrors" in serverError) {
          const serverFields = (serverError as { fieldErrors?: Record<string, unknown> }).fieldErrors ?? {};
          const next: ProgressFieldErrors = {};
          const invalidFields: ProgressField[] = [];
          for (const key of Object.keys(FIELD_SECTION) as ProgressField[]) {
            const values = serverFields[key];
            if (Array.isArray(values) && typeof values[0] === "string") {
              next[key] = values[0];
              invalidFields.push(key);
            }
          }
          if (Object.keys(next).length) {
            setFieldErrors(next);
            expandSectionsWithErrors(invalidFields);
          }
          else setError("The server rejected part of this submission. Review the form and try again.");
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div ref={dialogRef} data-accessible-dialog role="dialog" aria-modal="true" aria-labelledby="record-progress-title" tabIndex={-1} className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-xl">
        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <div>
              <h2 id="record-progress-title" className="text-lg font-bold text-[var(--color-ink)]">Record Progress</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{leadName ? `For ${leadName}. ` : ""}Record a genuine customer interaction{loadingDetails ? " · Loading current lead details…" : ""}</p>
            </div>

            <AccordionSection
              id="progress-interaction"
              title="Customer Interaction"
              status="Required"
              expanded={expandedSections.interaction}
              autoFocus
              onToggle={() => setExpandedSections((current) => ({ ...current, interaction: !current.interaction }))}
            >
              <div className="space-y-3">
              <ActivityFormFields
                idPrefix="record-progress"
                showFieldGuidance
                showFollowUpScheduling={false}
                errors={fieldErrors}
                action={action}
                response={response}
                interest={interest}
                notes={notes}
                scheduleFollowUp={scheduleFollowUp}
                followUpDate={followUpDate}
                followUpTime={followUpTime}
                onActionChange={(value) => { setAction(value); setResponse(""); setInterest(""); clearFieldErrors(["action", "response", "interest"]); }}
                onResponseChange={(value) => { setResponse(value); if (!isSuccessfulActivityResponse(value)) setInterest(""); clearFieldErrors(["response", "interest"]); }}
                onInterestChange={setInterest}
                onNotesChange={(value) => { setNotes(value); clearFieldErrors(["notes"]); }}
                onScheduleFollowUpChange={(value) => { setScheduleFollowUp(value); clearFieldErrors(["scheduleFollowUp", "followUpDate", "followUpTime"]); if (!value) { setFollowUpDate(""); setFollowUpTime(""); } }}
                onFollowUpDateChange={(value) => { setFollowUpDate(value); setFieldErrors((old) => ({ ...old, followUpDate: undefined })); }}
                onFollowUpTimeChange={(value) => { setFollowUpTime(value); clearFieldErrors(["followUpTime"]); }}
              />
              </div>
            </AccordionSection>

            <AccordionSection
              id="progress-classification"
              title="Update Lead Classification"
              status="Optional"
              expanded={expandedSections.classification}
              onToggle={() => setExpandedSections((current) => ({ ...current, classification: !current.classification }))}
            >
              <div className="space-y-3">
              <p className="text-xs text-[var(--color-muted)]">Leave these values as shown to keep the current classification.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <div className="space-y-1.5">
                  <label htmlFor="progress-category" className="text-sm font-medium text-[var(--color-ink)]">Category</label>
                  <Select id="progress-category" value={category} aria-invalid={!!fieldErrors.category} aria-describedby={fieldErrors.category ? "progress-category-error" : undefined} onChange={(event) => { setCategory(event.target.value); clearFieldErrors(["category"]); }} disabled={!lead}><option value="">None</option>{LEAD_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
                  {fieldErrors.category && <p id="progress-category-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.category}</p>}
                </div>
              </div>
              </div>
            </AccordionSection>

            <AccordionSection
              id="progress-follow-ups"
              title="Manage Follow-ups"
              status="Optional"
              expanded={expandedSections.followUps}
              onToggle={() => setExpandedSections((current) => ({ ...current, followUps: !current.followUps }))}
            >
              <div className="space-y-3">
              {pendingFollowUps.length ? (
                <>
                  <fieldset className="space-y-2" aria-describedby="progress-follow-up-selection-help">
                    <legend className="text-sm font-medium text-[var(--color-ink)]">Choose a pending follow-up to complete (optional)</legend>
                    <p id="progress-follow-up-selection-help" className="text-xs text-[var(--color-muted)]">The selected task will be completed when you submit this interaction.</p>
                    <div className="space-y-1.5">
                      <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${selectedFollowUpId ? "border-[var(--color-border)] bg-white" : "border-[var(--color-brand)] bg-blue-50/70"}`}>
                        <input
                          type="radio"
                          name="progress-follow-up-completion"
                          value=""
                          checked={!selectedFollowUpId}
                          onChange={() => { setSelectedFollowUpId(""); clearFieldErrors(["completeFollowUpId"]); }}
                          className="shrink-0 border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                        />
                        <span>Leave all pending follow-ups unchanged</span>
                      </label>
                      {pendingFollowUps.map((item) => {
                        const overdue = Boolean(item.dueDate && new Date(item.dueDate).getTime() < todayStart);
                        const selected = selectedFollowUpId === item.id;
                        return (
                          <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${selected ? "border-[var(--color-brand)] bg-blue-50/70 ring-1 ring-[var(--color-brand)]/20" : overdue ? "border-red-200 bg-red-50/50 hover:bg-red-50" : "border-[var(--color-border)] bg-white hover:bg-slate-50"}`}>
                            <input
                              type="radio"
                              name="progress-follow-up-completion"
                              value={item.id}
                              checked={selected}
                              onChange={() => { setSelectedFollowUpId(item.id); clearFieldErrors(["completeFollowUpId"]); }}
                              className="mt-0.5 shrink-0 border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-sm font-medium text-[var(--color-ink)]">{item.title}</span>
                                {overdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Overdue</span>}
                                {selected && <span className="text-xs font-semibold text-[var(--color-brand-strong)]">Proposed for completion</span>}
                              </span>
                              {item.description?.trim() && <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--color-muted)]">{item.description}</span>}
                              <span className="mt-1 block text-xs text-[var(--color-muted)]">
                                {item.dueDate ? formatDate(item.dueDate) : "No due date"}
                                {item.dueTime ? ` · ${formatTime(item.dueTime)}` : ""}
                                {item.assignedUser?.name ? ` · ${item.assignedUser.name}` : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  {initialFollowUpId && selectedFollowUp && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">From Tasks: {selectedFollowUp.title} is proposed for completion when you submit Record Progress.</p>}
                  {fieldErrors.completeFollowUpId && <p role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.completeFollowUpId}</p>}
                </>
              ) : <p className="text-sm text-[var(--color-muted)]">{loadingDetails ? "Loading pending follow-ups…" : "No pending follow-ups."}</p>}
              {initialFollowUpId && !selectedFollowUp && !loadingDetails && <p className="text-sm text-amber-800" role="status">The task opened from Tasks is no longer pending. Review the current lead tasks before selecting one.</p>}

              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                <input type="checkbox" checked={scheduleFollowUp} onChange={(event) => { setScheduleFollowUp(event.target.checked); if (!event.target.checked) { setFollowUpDate(""); setFollowUpTime(""); } }} className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]" />
                Schedule another follow-up
              </label>
              {fieldErrors.scheduleFollowUp && <p role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.scheduleFollowUp}</p>}
              {scheduleFollowUp && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="progress-follow-up-date" className="text-sm font-medium text-[var(--color-ink)]">Due date <span className="text-[var(--color-danger)]">Required</span></label>
                    <input id="progress-follow-up-date" type="date" value={followUpDate} onChange={(event) => { setFollowUpDate(event.target.value); clearFieldErrors(["followUpDate"]); }} aria-invalid={!!fieldErrors.followUpDate} aria-describedby={fieldErrors.followUpDate ? "progress-follow-up-date-error" : undefined} className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm" />
                    {fieldErrors.followUpDate && <p id="progress-follow-up-date-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.followUpDate}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="progress-follow-up-time" className="text-sm font-medium text-[var(--color-ink)]">Time <span className="text-xs font-normal text-[var(--color-muted)]">Optional</span></label>
                    <input id="progress-follow-up-time" type="time" value={followUpTime} onChange={(event) => { setFollowUpTime(event.target.value); clearFieldErrors(["followUpTime"]); }} aria-invalid={!!fieldErrors.followUpTime} aria-describedby={fieldErrors.followUpTime ? "progress-follow-up-time-error" : undefined} className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm" />
                    {fieldErrors.followUpTime && <p id="progress-follow-up-time-error" role="alert" className="text-xs text-[var(--color-danger)]">{fieldErrors.followUpTime}</p>}
                  </div>
                </div>
              )}
              </div>
            </AccordionSection>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{error}</div>}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="black" disabled={saving || loadingDetails || !lead}>
              {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Record Progress"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
