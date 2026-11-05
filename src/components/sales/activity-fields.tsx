"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITY_ACTION_OPTIONS, getActivityResponseOptions, isSuccessfulActivityResponse } from "@/lib/activity-options";

export function ActivityFormFields({
  idPrefix,
  autoFocusAction = false,
  showFieldGuidance = false,
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
  errors?: { response?: string; interest?: string; followUpDate?: string };
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

  return (
    <>
      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-action`} className="text-sm font-medium text-[var(--color-ink)]">Action{guidance("Required")}</label>
        <Select id={`${idPrefix}-action`} data-autofocus={autoFocusAction || undefined} value={action} onChange={(e) => onActionChange(e.target.value)}>
          {ACTIVITY_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </div>

      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-response`} className="text-sm font-medium text-[var(--color-ink)]">Response{guidance("Required")}</label>
        <Select id={`${idPrefix}-response`} value={response} onChange={(e) => onResponseChange(e.target.value)} required aria-invalid={!!errors.response} aria-describedby={errors.response ? `${idPrefix}-response-error` : undefined}>
          <option value="">Select response</option>
          {responseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        {errors.response && <p id={`${idPrefix}-response-error`} className="text-xs text-[var(--color-danger)]" role="alert">{errors.response}</p>}
      </div>

      {interestVisible && (
        <div className="space-y-2">
          <label htmlFor={`${idPrefix}-interest`} className="text-sm font-medium text-[var(--color-ink)]">Interest{guidance("Required")}</label>
          <Select id={`${idPrefix}-interest`} value={interest} onChange={(e) => onInterestChange(e.target.value)} required aria-invalid={!!errors.interest} aria-describedby={errors.interest ? `${idPrefix}-interest-error` : undefined}>
            <option value="">Select interest</option>
            <option value="INTERESTED">Interested</option>
            <option value="NOT_INTERESTED">Not Interested</option>
          </Select>
          {errors.interest && <p id={`${idPrefix}-interest-error`} className="text-xs text-[var(--color-danger)]" role="alert">{errors.interest}</p>}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-notes`} className="text-sm font-medium text-[var(--color-ink)]">Notes{guidance("Optional")}</label>
        <Textarea id={`${idPrefix}-notes`} value={notes} onChange={(e) => onNotesChange(e.target.value)} rows={3} placeholder="Add notes..." className="resize-none" />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={scheduleFollowUp}
          onChange={(e) => onScheduleFollowUpChange(e.target.checked)}
          className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
        />
        <span className="text-sm font-medium text-[var(--color-ink)]">Schedule follow-up</span>
      </label>

      {scheduleFollowUp && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor={`${idPrefix}-follow-up-date`} className="text-xs font-medium text-[var(--color-muted)]">Date{guidance("Required")}</label>
            <Input id={`${idPrefix}-follow-up-date`} type="date" value={followUpDate} onChange={(e) => onFollowUpDateChange(e.target.value)} required aria-invalid={!!errors.followUpDate} aria-describedby={errors.followUpDate ? `${idPrefix}-follow-up-date-error` : undefined} />
            {errors.followUpDate && <p id={`${idPrefix}-follow-up-date-error`} className="text-xs text-[var(--color-danger)]" role="alert">{errors.followUpDate}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor={`${idPrefix}-follow-up-time`} className="text-xs font-medium text-[var(--color-muted)]">Time{guidance("Optional")}</label>
            <Input id={`${idPrefix}-follow-up-time`} type="time" value={followUpTime} onChange={(e) => onFollowUpTimeChange(e.target.value)} />
          </div>
        </div>
      )}
    </>
  );
}
