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
import { createLeadRequestSchema, leadEmailSchema, leadPhoneSchema, leadPatchSchema } from "@/lib/validation";
import { isSuccessfulActivityResponse } from "@/lib/activity-options";
import { followUpFormDate } from "@/lib/follow-up-form-date";
import { getLeadCreateValidationTarget } from "@/lib/lead-create-accordion";
import { CREATE_LEAD_FIELD_ORDER, findNextCreateLeadFieldId, isEnterNavigationInput, shouldAdvanceFromSelect } from "@/lib/create-lead-enter-navigation";

export type LeadFormData = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  district?: string | null;
  state: string | null;
  requirement: string | null;
  status: string;
  priority: string;
  category: string | null;
  sourceId?: string | null;
  source?: { id: string; name: string } | null;
  assignedUserId: string | null;
};

function isNavigableField(id: string) {
  const element = document.getElementById(id);
  if (!element) return false;
  if (element.matches(":disabled")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest("[inert]")) return false;
  if (element.getClientRects().length === 0) return false;
  return true;
}

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
  const [district, setDistrict] = useState("");
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
  const [districtError, setDistrictError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [activityAction, setActivityAction] = useState("CALL");
  const [activityResponse, setActivityResponse] = useState("");
  const [activityInterest, setActivityInterest] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [activityErrors, setActivityErrors] = useState<{ action?: string; response?: string; interest?: string; followUpDate?: string }>({});
  const focusAfterValidation = useRef<string | null>(null);
  const [previousLead, setPreviousLead] = useState(lead);
  const [previousOpen, setPreviousOpen] = useState(open);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open, onClose, canClose: !pending });

  useEffect(() => {
    const elementId = focusAfterValidation.current;
    if (!elementId) return;
    document.getElementById(elementId)?.focus();
  }, [nameError, emailError, phoneError, districtError, cityError, activityErrors]);

  if (open && (!previousOpen || previousLead !== lead)) {
    setPreviousOpen(open);
    setPreviousLead(lead);
    if (lead) {
      setName(lead.name);
      setCompany(lead.company ?? "");
      setEmail(lead.email ?? "");
      setPhone(lead.phone ?? "");
      setCity(lead.city ?? "");
      setDistrict(lead.district ?? "");
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
      setDistrict("");
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
    setDistrictError(null);
    setCityError(null);
    setActivityAction("CALL");
    setActivityResponse("");
    setActivityInterest("");
    setActivityNotes("");
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
      state: state || null,
      status,
      priority,
      category: category || null,
      sourceId: sourceId || null,
    };

    if (isEdit) {
      payload.requirement = requirement || null;
      if (city !== (lead?.city ?? "")) payload.city = city || null;
      if (district !== (lead?.district ?? "")) payload.district = district || null;
    } else {
      if (city) payload.city = city;
      if (district) payload.district = district;
    }

    if (!isEdit && initialActivity) payload.initialActivity = initialActivity;
    if (assignableUsers) payload.assignedUserId = assignedUserId || null;

    const parsed = isEdit
      ? leadPatchSchema.safeParse(payload)
      : createLeadRequestSchema.safeParse(payload);

    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setDistrictError(null);
    setCityError(null);
    setContactError(null);
    setActivityErrors({});
    setError(null);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const nameIssue = issues.find((issue) => issue.path[0] === "name");
      const emailIssue = issues.find((issue) => issue.path[0] === "email");
      const phoneIssue = issues.find((issue) => issue.path[0] === "phone");
      const districtIssue = issues.find((issue) => issue.path[0] === "district");
      const cityIssue = issues.find((issue) => issue.path[0] === "city");
      setNameError(nameIssue?.message ?? null);
      setEmailError(email.trim() ? emailIssue?.message ?? null : null);
      setPhoneError(phoneIssue?.message ?? null);
      setDistrictError(districtIssue?.message ?? null);
      setCityError(cityIssue?.message ?? null);
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
        focusAfterValidation.current = target.firstElementId;
      }
      if (!nameIssue && !emailIssue && !phoneIssue && !districtIssue && !cityIssue && !activityIssue) {
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
      const response = axios.isAxiosError(err) ? err.response : undefined;
      const message = response?.data?.error;
      if (!isEdit && response?.status === 409) {
        setError(typeof message === "string" ? message : "A lead conflict was detected. Review the lead details and try again.");
      } else if (message && typeof message === "object" && "fieldErrors" in message) {
        const fields = (message as { fieldErrors?: Record<string, unknown> }).fieldErrors ?? {};
        const fieldMessage = (key: string) => Array.isArray(fields[key]) && typeof fields[key][0] === "string" ? fields[key][0] as string : null;
        setNameError(fieldMessage("name"));
        setEmailError(fieldMessage("email"));
        setPhoneError(fieldMessage("phone"));
        setDistrictError(fieldMessage("district"));
        setCityError(fieldMessage("city"));
        const activityMessage = fieldMessage("initialActivity");
        setError(activityMessage ?? "The server rejected part of this submission. Review the highlighted fields and try again.");
        const firstInvalid = ["lead-name", "lead-email", "lead-phone", "lead-district", "lead-city"].find((id) => {
          const key = id.replace("lead-", "");
          return fieldMessage(key) !== null;
        });
        if (firstInvalid) focusAfterValidation.current = firstInvalid;
      } else {
        setError(typeof message === "string" ? message : (isEdit ? "Failed to update lead." : "Unable to create the lead right now."));
      }
    } finally {
      setPending(false);
    }
  };

  const formRef = useRef<HTMLFormElement>(null);

  const handleCreateLeadKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (isEdit || event.key !== "Enter" || event.defaultPrevented) return;
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.nativeEvent.isComposing) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.getAttribute("role") === "combobox") {
      if (!CREATE_LEAD_FIELD_ORDER.includes(target.id)) return;
      const selectionCommitted = target.getAttribute("data-select-value-committed") === "true";
      if (!shouldAdvanceFromSelect(false, selectionCommitted)) return;
      target.removeAttribute("data-select-value-committed");
      event.preventDefault();
      const nextId = findNextCreateLeadFieldId(target.id, isNavigableField);
      if (nextId) document.getElementById(nextId)?.focus();
      return;
    }

    if (!isEnterNavigationInput({ tagName: target.tagName, type: (target as HTMLInputElement).type })) return;
    if (!CREATE_LEAD_FIELD_ORDER.includes(target.id)) return;

    event.preventDefault();
    const nextId = findNextCreateLeadFieldId(target.id, isNavigableField);
    if (nextId) document.getElementById(nextId)?.focus();
  };

  const handleCreateLeadBlur = (event: React.FocusEvent<HTMLFormElement>) => {
    if (isEdit) return;
    const target = event.target;
    if (target.getAttribute("role") === "combobox") target.removeAttribute("data-select-value-committed");
  };

  const basicInformationFields = (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Basic Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Name" htmlFor="lead-name" labelSuffix="Required" error={nameError} errorId="lead-name-error">
          <Input id="lead-name" data-autofocus value={name} placeholder="Full name" onChange={(e) => { setName(e.target.value); setNameError(e.target.value.trim().length >= 2 ? null : "Enter at least 2 characters."); }} required aria-invalid={!!nameError} aria-describedby={nameError ? "lead-name-error" : undefined} />
        </FormField>
        <FormField label="Company" htmlFor="lead-company">
          <Input id="lead-company" value={company} placeholder="Company or organization" onChange={(e) => setCompany(e.target.value)} />
        </FormField>
      </div>
    </div>
  );

  const classificationFields = (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Classification &amp; Assignment</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Status" htmlFor="lead-status">
          <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Priority" htmlFor="lead-priority">
          <Select id="lead-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {LEAD_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Category" htmlFor="lead-category">
          <Select id="lead-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Select category</option>
            {LEAD_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Lead Source" htmlFor="lead-source">
          <Select id="lead-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">Select source</option>
            {leadSources?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FormField>
        {assignableUsers && (
          <FormField label="Assigned To" htmlFor="lead-assigned" className="sm:col-span-2">
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
        <FormField label="Email" htmlFor="lead-email" error={emailError} errorId="lead-email-error">
          <Input id="lead-email" type="email" value={email} placeholder="name@example.com" autoComplete="email" onChange={(e) => { const value = e.target.value; const parsedEmail = leadEmailSchema.safeParse(value); setEmail(value); setEmailError(parsedEmail.success ? null : parsedEmail.error.issues[0]?.message ?? "Enter a valid email address."); if (parsedEmail.success && parsedEmail.data) setContactError(null); }} aria-invalid={!!emailError || !!contactError} aria-describedby={emailError ? "lead-email-error" : contactError ? "lead-contact-error" : undefined} />
        </FormField>
        <FormField label="Phone" htmlFor="lead-phone" error={phoneError} errorId="lead-phone-error">
          <Input id="lead-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} placeholder="10-digit phone number" onChange={(e) => { const value = e.target.value; const parsedPhone = leadPhoneSchema.safeParse(value); setPhone(value); setPhoneError(parsedPhone.success ? null : parsedPhone.error.issues[0]?.message ?? "Enter exactly 10 digits using numbers only."); if (parsedPhone.success && parsedPhone.data) setContactError(null); }} aria-invalid={!!phoneError || !!contactError} aria-describedby={phoneError ? "lead-phone-error" : contactError ? "lead-contact-error" : undefined} />
        </FormField>
        {contactError && <p id="lead-contact-error" className="sm:col-span-2 -mt-2 text-xs text-[var(--color-danger)]" role="alert">{contactError}</p>}
        <FormField label="District" htmlFor="lead-district">
          <Input id="lead-district" value={district} placeholder="e.g. Andheri West" onChange={(e) => setDistrict(e.target.value)} />
        </FormField>
        <FormField label="City (legacy)" htmlFor="lead-city">
          <Input id="lead-city" value={city} placeholder="e.g. Pune" onChange={(e) => setCity(e.target.value)} />
        </FormField>
        <FormField label="State" htmlFor="lead-state">
          <Input id="lead-state" value={state} placeholder="e.g. Maharashtra" onChange={(e) => setState(e.target.value)} />
        </FormField>
      </div>
    </div>
  );

  const requirementFields = (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] mb-3">Requirements</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Requirement" htmlFor="lead-requirement" className="sm:col-span-2">
          <Textarea id="lead-requirement" value={requirement} onChange={(e) => setRequirement(e.target.value)} rows={3} />
        </FormField>
      </div>
    </div>
  );

  const createLeadInformationFields = (
    <section aria-labelledby="create-lead-information-title" className="space-y-4">
      <div>
        <h3 id="create-lead-information-title" className="text-base font-semibold text-[var(--color-ink)]">Lead Information</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Name" htmlFor="lead-name" error={nameError} errorId="lead-name-error">
          <Input id="lead-name" data-autofocus value={name} placeholder="Full name" onChange={(e) => { setName(e.target.value); setNameError(e.target.value.trim().length >= 2 ? null : "Enter at least 2 characters."); }} required aria-invalid={!!nameError} aria-describedby={nameError ? "lead-name-error" : undefined} />
        </FormField>
        <FormField label="Company" htmlFor="lead-company">
          <Input id="lead-company" value={company} placeholder="Company or organization" onChange={(e) => setCompany(e.target.value)} />
        </FormField>
        <FormField label="City" htmlFor="lead-city" error={cityError} errorId="lead-city-error">
          <Input id="lead-city" value={city} placeholder="e.g. Pune" onChange={(e) => { setCity(e.target.value); setCityError(null); }} aria-invalid={!!cityError} aria-describedby={cityError ? "lead-city-error" : undefined} />
        </FormField>
        <FormField label="District" htmlFor="lead-district" error={districtError} errorId="lead-district-error">
          <Input id="lead-district" value={district} placeholder="e.g. Andheri West" onChange={(e) => { setDistrict(e.target.value); setDistrictError(null); }} aria-invalid={!!districtError} aria-describedby={districtError ? "lead-district-error" : undefined} />
        </FormField>
        <FormField label="State" htmlFor="lead-state">
          <Input id="lead-state" value={state} placeholder="e.g. Maharashtra" onChange={(e) => setState(e.target.value)} />
        </FormField>
        <FormField label="Phone" htmlFor="lead-phone" error={phoneError} errorId="lead-phone-error">
          <Input id="lead-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} placeholder="10-digit phone number" onChange={(e) => { const value = e.target.value; const parsedPhone = leadPhoneSchema.safeParse(value); setPhone(value); setPhoneError(parsedPhone.success ? null : parsedPhone.error.issues[0]?.message ?? "Enter exactly 10 digits using numbers only."); if (parsedPhone.success && parsedPhone.data) setContactError(null); }} aria-invalid={!!phoneError || !!contactError} aria-describedby={phoneError ? "lead-phone-error" : contactError ? "lead-contact-error" : undefined} />
        </FormField>
        <FormField label="Email" htmlFor="lead-email" className="sm:col-span-2" error={emailError} errorId="lead-email-error">
          <Input id="lead-email" type="email" value={email} placeholder="name@example.com" autoComplete="email" onChange={(e) => { const value = e.target.value; const parsedEmail = leadEmailSchema.safeParse(value); setEmail(value); setEmailError(parsedEmail.success ? null : parsedEmail.error.issues[0]?.message ?? "Enter a valid email address."); if (parsedEmail.success && parsedEmail.data) setContactError(null); }} aria-invalid={!!emailError || !!contactError} aria-describedby={emailError ? "lead-email-error" : contactError ? "lead-contact-error" : undefined} />
        </FormField>
        {contactError && <p id="lead-contact-error" className="sm:col-span-2 -mt-2 text-xs text-[var(--color-danger)]" role="alert">{contactError}</p>}
        <FormField label="Category" htmlFor="lead-category">
          <Select id="lead-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Select category</option>
            {LEAD_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Lead Source" htmlFor="lead-source">
          <Select id="lead-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">Select source</option>
            {leadSources?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </FormField>
        {assignableUsers && <FormField label="Assigned To" htmlFor="lead-assigned" className="sm:col-span-2">
          <Select id="lead-assigned" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
            <option value="">Unassigned</option>
            {assignableUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </FormField>}
      </div>
    </section>
  );

  const createLeadInteractionFields = (
    <section aria-labelledby="create-lead-interaction-title" className="space-y-4">
      <div>
        <h3 id="create-lead-interaction-title" className="text-base font-semibold text-[var(--color-ink)]">Initial Interaction &amp; Classification</h3>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <ActivityFormFields
          idPrefix="initial-activity"
          actionResponseInline
          scheduleToggle
          compactNotes
          centralizedInterestLabels
          betweenResponseAndInterest={
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Status" htmlFor="lead-status">
                <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {LEAD_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Priority" htmlFor="lead-priority">
                <Select id="lead-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {LEAD_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </FormField>
            </div>
          }
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
    </section>
  );

  if (!open) return null;

  return (
    <div className={isEdit ? "fixed inset-0 z-50 flex items-start justify-center overflow-hidden" : "fixed inset-0 z-50"}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={pending ? undefined : onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        data-accessible-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-edit-title"
        tabIndex={-1}
        className={isEdit ? "relative z-10 mt-6 mb-6 flex h-[88vh] max-h-[88vh] w-[90%] max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl" : "absolute inset-0 z-10 flex h-[100dvh] flex-col bg-white"}
        style={isEdit ? { height: "88vh", maxHeight: "88vh" } : undefined}
      >
        <header className={`flex shrink-0 items-center justify-between border-b border-[var(--color-border)] py-4 ${isEdit ? "px-6" : "px-5 sm:px-8"}`}>
          <div>
          <h2 id="lead-edit-title" className={`${isEdit ? "text-lg" : "text-xl"} font-semibold text-[var(--color-ink)]`}>
            {isEdit ? "Edit Lead" : "Create Lead"}
          </h2>
          </div>
          <Button
            type="button"
            variant={isEdit ? "ghost" : "secondary"}
            size={isEdit ? "sm" : undefined}
            onClick={onClose}
            aria-label="Close lead form"
            disabled={pending}
            className={isEdit ? "h-8 w-8 p-1.5" : "h-9 px-3"}
          >
            {isEdit ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> : "Close"}
          </Button>
        </header>

        {!isEdit && error && <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-8" role="alert">{error}</div>}

        <div className={isEdit ? "flex-1 overflow-y-auto p-6" : "min-h-0 flex-1"}>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onKeyDown={handleCreateLeadKeyDown}
            onBlur={handleCreateLeadBlur}
            noValidate
            className={isEdit ? "space-y-6" : "flex h-full min-h-0 flex-col"}
          >
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
              <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                <div className="min-h-0 space-y-6 overflow-y-auto border-b border-[var(--color-border)] p-5 sm:p-8 lg:border-b-0 lg:border-r">
                  {createLeadInformationFields}
                </div>
                <div className="min-h-0 space-y-6 overflow-y-auto p-5 sm:p-8">
                  {createLeadInteractionFields}
                </div>
              </main>
            )}

            {isEdit && error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
            ) : null}

            {isEdit && <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />}
          </form>
        </div>

        <footer className={`flex shrink-0 items-center border-t border-[var(--color-border)] py-4 ${isEdit ? "justify-end gap-3 px-6" : "justify-between px-5 sm:px-8"}`}>
          <div className={isEdit ? "flex items-center gap-3" : "ml-auto flex items-center gap-3"}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button id={isEdit ? undefined : "create-lead-submit"} type="button" variant="black" isLoading={pending} onClick={() => formRef.current?.requestSubmit()}>
            {pending ? "Saving..." : isEdit ? "Save Changes" : submitLabel ?? "Create Lead"}
          </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
