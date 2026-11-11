"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITY_ACTION_OPTIONS, ACTIVITY_INTEREST_OPTIONS, getActivityResponseOptions, isSuccessfulActivityResponse } from "@/lib/activity-options";

export function ActivityFormFields({
  idPrefix,
  autoFocusAction = false,
  showFieldGuidance = false,
  actionResponseInline = false,
  scheduleToggle = false,
  compactNotes = false,
  showFollowUpScheduling = true,
  centralizedInterestLabels = false,
  betweenResponseAndInterest,
  errors = {},
  action,
  response,
  interest,
  notes,
  scheduleFollowUp,
  followUpDate,
  followUpTime,
  onActionChange,
  onResponseChange,
  onInterestChange,
  onNotesChange,
  onScheduleFollowUpChange,
  onFollowUpDateChange,
  onFollowUpTimeChange,
}: {
  idPrefix: string;
  autoFocusAction?: boolean;
  showFieldGuidance?: boolean;
  actionResponseInline?: boolean;
  scheduleToggle?: boolean;
  compactNotes?: boolean;
  showFollowUpScheduling?: boolean;
  centralizedInterestLabels?: boolean;
  betweenResponseAndInterest?: ReactNode;
  errors?: { action?: string; response?: string; interest?: string; notes?: string; followUpDate?: string; followUpTime?: string };
  action: string;
  response: string;
  interest: string;
  notes: string;
  scheduleFollowUp: boolean;
  followUpDate: string;
  followUpTime: string;
  onActionChange: (value: string) => void;
  onResponseChange: (value: string) => void;
  onInterestChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onScheduleFollowUpChange: (value: boolean) => void;
  onFollowUpDateChange: (value: string) => void;
  onFollowUpTimeChange: (value: string) => void;
}) {
  const responseOptions = getActivityResponseOptions(action);
  const interestVisible = isSuccessfulActivityResponse(response);
  const guidance = (value: "Required" | "Optional") => showFieldGuidance ? (
    <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">{value}</span>
  ) : null;

  const actionField = (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-action`} className="text-sm font-medium text-[var(--color-ink)]">Action{guidance("Required")}</label>
      <Select id={`${idPrefix}-action`} data-autofocus={autoFocusAction || undefined} value={action} onChange={(e) => onActionChange(e.target.value)} required aria-invalid={!!errors.action} aria-describedby={errors.action ? `${idPrefix}-action-error` : undefined}>
        {ACTIVITY_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
      {errors.action && <p id={`${idPrefix}-action-error`} className="text-xs text-[var(--color-danger)]" role="alert">{errors.action}</p>}
    </div>
  );

  const responseField = (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-response`} className="text-sm font-medium text-[var(--color-ink)]">Response{guidance("Required")}</label>
      <Select id={`${idPrefix}-response`} value={response} onChange={(e) => onResponseChange(e.target.value)} required aria-invalid={!!errors.response} aria-describedby={errors.response ? `${idPrefix}-response-error` : undefined}>
        <option value="">Select response</option>
        {responseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
      {errors.response && <p id={`${idPrefix}-response-error`} className="text-xs text-[var(--color-danger)]" role="alert">{errors.response}</p>}
    </div>
  );

  const followUpFields = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-follow-up-date`} className="text-xs font-medium text-[var(--color-muted)]">Date{guidance("Required")}</label>
        <Input id={`${idPrefix}-follow-up-date`} type="date" value={followUpDate} onChange={(e) => onFollowUpDateChange(e.target.value)} required aria-invalid={!!errors.followUpDate} aria-describedby={errors.followUpDate ? `${idPrefix}-follow-up-date-error` : undefined} />
        {errors.followUpDate && <p id={`${idPrefix}-follow-up-date-error`} className="text-xs text-[var(--color-danger)]" role="alert">{errors.followUpDate}</p>}
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-follow-up-time`} className="text-xs font-medium text-[var(--color-muted)]">Time{guidance("Optional")}</label>
        <Input id={`${idPrefix}-follow-up-time`} type="time" value={followUpTime} onChange={(e) => onFollowUpTimeChange(e.target.value)} aria-invalid={!!errors.followUpTime} aria-describedby={errors.followUpTime ? `${idPrefix}-follow-up-time-error` : undefined} />
        {errors.followUpTime && <p id={`${idPrefix}-follow-up-time-error`} className="text-xs text-[var(--color-danger)]" role="alert">{errors.followUpTime}</p>}
      </div>
    </div>
  );

  return (
    <>
      {actionResponseInline ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          {actionField}
          {responseField}
        </div>
      ) : (
        <>
          {actionField}
          {responseField}
        </>
      )}

      {betweenResponseAndInterest}

      {interestVisible && (
        <div className="space-y-2">
          <label htmlFor={`${idPrefix}-interest`} className="text-sm font-medium text-[var(--color-ink)]">Interest{guidance("Required")}</label>
          <Select id={`${idPrefix}-interest`} value={interest} onChange={(e) => onInterestChange(e.target.value)} required aria-invalid={!!errors.interest} aria-describedby={errors.interest ? `${idPrefix}-interest-error` : undefined}>
            <option value="">Select interest</option>
            {(centralizedInterestLabels ? ACTIVITY_INTEREST_OPTIONS : [
              { value: "INTERESTED", label: "Interested" },
              { value: "NOT_INTERESTED", label: "Not Interested" },
            ]).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          {errors.interest && <p id={`${idPrefix}-interest-error`} className="text-xs text-[var(--color-danger)]" role="alert">{errors.interest}</p>}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-notes`} className="text-sm font-medium text-[var(--color-ink)]">Notes{guidance("Optional")}</label>
        <Textarea id={`${idPrefix}-notes`} value={notes} onChange={(e) => onNotesChange(e.target.value)} rows={3} placeholder="Add a note about the interaction" className={compactNotes ? "h-[60px] min-h-[60px] resize-none" : "resize-none"} aria-invalid={!!errors.notes} aria-describedby={errors.notes ? `${idPrefix}-notes-error` : undefined} />
        {errors.notes && <p id={`${idPrefix}-notes-error`} className="text-xs text-[var(--color-danger)]" role="alert">{errors.notes}</p>}
      </div>

      {showFollowUpScheduling && (scheduleToggle ? (
        <div>
          <button
            id={`${idPrefix}-schedule-toggle`}
            type="button"
            role="switch"
            aria-checked={scheduleFollowUp}
            aria-controls={`${idPrefix}-schedule-fields`}
            onClick={() => onScheduleFollowUpChange(!scheduleFollowUp)}
            className="flex w-full items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface)] focus-visible:border-[var(--color-brand)] focus-visible:ring-3 focus-visible:ring-[var(--color-brand)]/20 focus-visible:outline-hidden"
          >
            <span className="text-sm font-medium text-[var(--color-ink)]">Schedule a follow-up</span>
            <span className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-muted)]" aria-hidden="true">{scheduleFollowUp ? "On" : "Off"}</span>
              <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${scheduleFollowUp ? "bg-[var(--color-brand)]" : "bg-[var(--color-surface-raised)]"}`}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${scheduleFollowUp ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
              </span>
            </span>
          </button>

          <div
            id={`${idPrefix}-schedule-fields`}
            inert={!scheduleFollowUp}
            aria-hidden={!scheduleFollowUp}
            className={`grid transition-all duration-200 ease-out ${scheduleFollowUp ? "mt-3 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"}`}
          >
            <div className="overflow-hidden">{followUpFields}</div>
          </div>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleFollowUp}
              onChange={(e) => onScheduleFollowUpChange(e.target.checked)}
              className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
            />
            <span className="text-sm font-medium text-[var(--color-ink)]">Schedule follow-up</span>
          </label>

          {scheduleFollowUp && followUpFields}
        </>
      ))}
    </>
  );
}
