"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { LEAD_STATUSES, LEAD_PRIORITIES, LEAD_CATEGORIES } from "@/lib/lead-constants";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import { ActivityFormFields } from "@/components/sales/activity-fields";
import { AccordionSection } from "@/components/ui/accordion-section";
import { createLeadRequestSchema, leadEmailSchema, leadPhoneSchema, leadSchema } from "@/lib/validation";
import { isSuccessfulActivityResponse } from "@/lib/activity-options";
import { followUpFormDate } from "@/lib/follow-up-form-date";
import { getLeadCreateValidationTarget, type LeadCreateAccordionSection } from "@/lib/lead-create-accordion";

export type LeadFormData = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  requirement: string | null;
  status: string;
  priority: string;
  category: string | null;
  sourceId?: string | null;
  source?: { id: string; name: string } | null;
  assignedUserId: string | null;
};

export function LeadEditModal({
  open,
  onClose,
  onSaved,
  lead,
  leadSources,
  assignableUsers,
  submitLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  lead?: LeadFormData | null;
  leadSources?: Array<{ id: string; name: string }>;
  assignableUsers?: Array<{ id: string; name: string }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const isEdit = !!lead;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [requirement, setRequirement] = useState("");
  const [status, setStatus] = useState("NEW");
  const [priority, setPriority] = useState("MEDIUM");
  const [category, setCategory] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [activityAction, setActivityAction] = useState("CALL");
  const [activityResponse, setActivityResponse] = useState("");
  const [activityInterest, setActivityInterest] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [activityErrors, setActivityErrors] = useState<{ action?: string; response?: string; interest?: string; followUpDate?: string }>({});
  const [expandedSections, setExpandedSections] = useState<Record<LeadCreateAccordionSection, boolean>>({
    leadInformation: false,
    classification: false,
    interaction: false,
  });
  const focusAfterExpansion = useRef<string | null>(null);
  const [previousLead, setPreviousLead] = useState(lead);
  const [previousOpen, setPreviousOpen] = useState(open);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open, onClose, canClose: !pending });

  useEffect(() => {
    const elementId = focusAfterExpansion.current;
    if (!elementId) return;
    const element = document.getElementById(elementId);
    if (element && !element.closest("[hidden]")) element.focus();
    focusAfterExpansion.current = null;
  }, [expandedSections]);

  if (open && (!previousOpen || previousLead !== lead)) {
    setPreviousOpen(open);
    setPreviousLead(lead);
    if (lead) {
      setName(lead.name);
      setCompany(lead.company ?? "");
      setEmail(lead.email ?? "");
      setPhone(lead.phone ?? "");
      setCity(lead.city ?? "");
      setState(lead.state ?? "");
      setRequirement(lead.requirement ?? "");
      setStatus(lead.status);
      setPriority(lead.priority);
      setCategory(lead.category ?? "");
      setSourceId(lead.sourceId ?? lead.source?.id ?? "");
      setAssignedUserId(lead.assignedUserId ?? "");
    } else {
      setName("");
      setCompany("");
      setEmail("");
      setPhone("");
      setCity("");
      setState("");
      setRequirement("");
      setStatus("NEW");
      setPriority("MEDIUM");
      setCategory("");
      setSourceId("");
      setAssignedUserId("");
    }
    setError(null);
    setContactError(null);
    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setActivityAction("CALL");
    setActivityResponse("");
    setActivityInterest("");
    setActivityNotes("");
    setExpandedSections({ leadInformation: false, classification: false, interaction: false });
    setScheduleFollowUp(false);
    setFollowUpDate("");
    setFollowUpTime("");
    setActivityErrors({});
  } else if (previousOpen !== open) {
    setPreviousOpen(open);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const initialActivity = !isEdit ? {
      action: activityAction,
      response: activityResponse,
      interest: isSuccessfulActivityResponse(activityResponse) ? activityInterest || null : null,
      notes: activityNotes.trim() || null,
      scheduleFollowUp,
      followUpDate: scheduleFollowUp ? followUpFormDate(followUpDate, followUpTime) : null,
      followUpTime: scheduleFollowUp ? followUpTime || null : null,
    } : undefined;
    const payload: Record<string, unknown> = {
      name,
      company: company || null,
      email: email || null,
      phone: phone || null,
      city: city || null,
      state: state || null,
      requirement: requirement || null,
      status,
      priority,
      category: category || null,
      sourceId: sourceId || null,
    };

    if (!isEdit && initialActivity) payload.initialActivity = initialActivity;
    if (assignableUsers) payload.assignedUserId = assignedUserId || null;

    const parsed = isEdit
      ? leadSchema.partial().safeParse(payload)
      : createLeadRequestSchema.safeParse(payload);

    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setContactError(null);
    setActivityErrors({});
    setError(null);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const nameIssue = issues.find((issue) => issue.path[0] === "name");
      const emailIssue = issues.find((issue) => issue.path[0] === "email");
      const phoneIssue = issues.find((issue) => issue.path[0] === "phone");
      setNameError(nameIssue?.message ?? null);
      setEmailError(email.trim() ? emailIssue?.message ?? null : null);
      setPhoneError(phoneIssue?.message ?? null);
      if (!isEdit && !email.trim() && !phone.trim()) {
        setContactError("Provide an email address or phone number.");
      }
      const activityIssue = issues.find((issue) => issue.path[0] === "initialActivity");
      if (activityIssue) {
        const field = activityIssue.path[1];
        if (field === "action" || field === "response" || field === "interest" || field === "followUpDate") {
          setActivityErrors({ [field]: activityIssue.message });
        } else {
          setError(activityIssue.message);
        }
      }
      if (!isEdit) {
        const target = getLeadCreateValidationTarget(issues);
        setExpandedSections((current) => ({
          leadInformation: current.leadInformation || target.sections.includes("leadInformation"),
          classification: current.classification || target.sections.includes("classification"),
          interaction: current.interaction || target.sections.includes("interaction"),
        }));
        focusAfterExpansion.current = target.firstElementId;
      }
      if (!nameIssue && !emailIssue && !phoneIssue && !activityIssue) {
        setError(issues[0]?.message ?? "Review the highlighted fields.");
      }
      return;
    }

    setPending(true);

    try {
      if (isEdit) {
        await axios.patch(`/api/leads/${lead.id}`, parsed.data);
      } else {
        await axios.post("/api/leads", parsed.data);
      }

      onClose();
      router.refresh();
      if (onSaved) onSaved();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      setError(typeof message === "string" ? message : (isEdit ? "Failed to update lead." : "Unable to create the lead right now."));
    } finally {
      setPending(false);
    }
  };

  const formRef = useRef<HTMLFormElement>(null);

  const basicInformationFields = (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Basic Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Name" htmlFor="lead-name" labelSuffix="Required" error={nameError} errorId="lead-name-error">
          <Input id="lead-name" data-autofocus value={name} onChange={(e) => { setName(e.target.value); setNameError(e.target.value.trim().length >= 2 ? null : "Enter at least 2 characters."); }} required aria-invalid={!!nameError} aria-describedby={nameError ? "lead-name-error" : undefined} />
        </FormField>
        <FormField label="Company" htmlFor="lead-company" labelSuffix="Optional">
          <Input id="lead-company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </FormField>
      </div>
    </div>
  );

  const classificationFields = (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Classification &amp; Assignment</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Status" htmlFor="lead-status" labelSuffix="Optional">
          <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Priority" htmlFor="lead-priority" labelSuffix="Optional">
          <Select id="lead-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {LEAD_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Category" htmlFor="lead-category" labelSuffix="Optional">
          <Select id="lead-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">None</option>
            {LEAD_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Lead Source" htmlFor="lead-source" labelSuffix="Optional">
          <Select id="lead-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">None</option>
            {leadSources?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FormField>
        {assignableUsers && (
          <FormField label="Assigned To" htmlFor="lead-assigned" labelSuffix="Optional" className="sm:col-span-2">
            <Select id="lead-assigned" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
              <option value="">Unassigned</option>
              {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </FormField>
        )}
      </div>
    </div>
  );

  const contactFields = (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Contact Details</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Email" htmlFor="lead-email" labelSuffix="Optional" error={emailError} errorId="lead-email-error">
          <Input id="lead-email" type="email" value={email} autoComplete="email" onChange={(e) => { const value = e.target.value; const parsedEmail = leadEmailSchema.safeParse(value); setEmail(value); setEmailError(parsedEmail.success ? null : parsedEmail.error.issues[0]?.message ?? "Enter a valid email address."); if (parsedEmail.success && parsedEmail.data) setContactError(null); }} aria-invalid={!!emailError || !!contactError} aria-describedby={emailError ? "lead-email-error" : contactError ? "lead-contact-error" : undefined} />
        </FormField>
        <FormField label="Phone" htmlFor="lead-phone" labelSuffix="Optional" error={phoneError} errorId="lead-phone-error">
          <Input id="lead-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => { const value = e.target.value; const parsedPhone = leadPhoneSchema.safeParse(value); setPhone(value); setPhoneError(parsedPhone.success ? null : parsedPhone.error.issues[0]?.message ?? "Enter exactly 10 digits using numbers only."); if (parsedPhone.success && parsedPhone.data) setContactError(null); }} aria-invalid={!!phoneError || !!contactError} aria-describedby={phoneError ? "lead-phone-error" : contactError ? "lead-contact-error" : undefined} />
        </FormField>
        {contactError && <p id="lead-contact-error" className="sm:col-span-2 -mt-2 text-xs text-[var(--color-danger)]" role="alert">{contactError}</p>}
        <FormField label="City" htmlFor="lead-city" labelSuffix="Optional">
          <Input id="lead-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </FormField>
        <FormField label="State" htmlFor="lead-state" labelSuffix="Optional">
          <Input id="lead-state" value={state} onChange={(e) => setState(e.target.value)} />
        </FormField>
      </div>
    </div>
  );

  const requirementFields = (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Requirements</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Requirement" htmlFor="lead-requirement" labelSuffix="Optional" className="sm:col-span-2">
          <Textarea id="lead-requirement" value={requirement} onChange={(e) => setRequirement(e.target.value)} rows={3} />
        </FormField>
      </div>
    </div>
  );

  const initialInteractionFields = (
    <>
      <p className="mb-4 text-xs text-[var(--color-muted)]">Record the genuine call or WhatsApp interaction that led to this entry.</p>
      <div className="grid grid-cols-1 gap-4">
        <ActivityFormFields
          idPrefix="initial-activity"
          showFieldGuidance
          errors={activityErrors}
          action={activityAction}
          response={activityResponse}
          interest={activityInterest}
          notes={activityNotes}
          scheduleFollowUp={scheduleFollowUp}
          followUpDate={followUpDate}
          followUpTime={followUpTime}
          onActionChange={(value) => { setActivityAction(value); setActivityResponse(""); setActivityInterest(""); setActivityErrors({}); }}
          onResponseChange={(value) => { setActivityResponse(value); if (!isSuccessfulActivityResponse(value)) setActivityInterest(""); setActivityErrors({}); }}
          onInterestChange={(value) => { setActivityInterest(value); setActivityErrors((current) => ({ ...current, interest: undefined })); }}
          onNotesChange={setActivityNotes}
          onScheduleFollowUpChange={(value) => { setScheduleFollowUp(value); if (!value) { setFollowUpDate(""); setFollowUpTime(""); } }}
          onFollowUpDateChange={(value) => { setFollowUpDate(value); setActivityErrors((current) => ({ ...current, followUpDate: undefined })); }}
          onFollowUpTimeChange={setFollowUpTime}
        />
      </div>
    </>
  );

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 flex justify-center overflow-hidden ${isEdit ? "items-start" : "items-center p-3 sm:p-5"}`}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={pending ? undefined : onClose} />

      <div
        ref={dialogRef}
        data-accessible-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-edit-title"
        tabIndex={-1}
        className={`relative z-10 flex w-[90%] max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl ${isEdit ? "mt-6 mb-6" : "max-h-[90dvh]"}`}
        style={isEdit ? { height: "88vh", maxHeight: "88vh" } : undefined}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 shrink-0">
          <h2 id="lead-edit-title" className="text-lg font-semibold text-[var(--color-ink)]">
            {isEdit ? "Edit Lead" : "Create Lead"}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close lead form"
            disabled={pending}
            className="h-8 w-8 p-1.5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </Button>
        </div>

        <div className={`flex-1 overflow-y-auto p-6 ${isEdit ? "" : "min-h-0"}`}>
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6">
            {isEdit ? (
              <>
                {basicInformationFields}
                <hr className="border-[var(--color-border)]" />
                {classificationFields}
                <hr className="border-[var(--color-border)]" />
                {contactFields}
                <hr className="border-[var(--color-border)]" />
                {requirementFields}
              </>
            ) : (
              <div className="space-y-4">
                <AccordionSection
                  id="create-lead-information"
                  title="Lead Information"
                  status="Required"
                  expanded={expandedSections.leadInformation}
                  autoFocus
                  onToggle={() => setExpandedSections((current) => ({ ...current, leadInformation: !current.leadInformation }))}
                >
                  <div className="space-y-6">
                    {basicInformationFields}
                    <hr className="border-[var(--color-border)]" />
                    {contactFields}
                    <hr className="border-[var(--color-border)]" />
                    {requirementFields}
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="create-lead-classification"
                  title="Lead Classification"
                  status="Optional"
                  expanded={expandedSections.classification}
                  onToggle={() => setExpandedSections((current) => ({ ...current, classification: !current.classification }))}
                >
                  {classificationFields}
                </AccordionSection>

                <AccordionSection
                  id="create-lead-initial-interaction"
                  title="Initial Customer Interaction"
                  status="Required"
                  expanded={expandedSections.interaction}
                  onToggle={() => setExpandedSections((current) => ({ ...current, interaction: !current.interaction }))}
                >
                  {initialInteractionFields}
                </AccordionSection>
              </div>
            )}

            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
            ) : null}

            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)] shrink-0">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="black" isLoading={pending} onClick={() => formRef.current?.requestSubmit()}>
            {pending ? "Saving..." : isEdit ? "Save Changes" : submitLabel ?? "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
