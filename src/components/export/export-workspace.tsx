"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EXPORT_DATE_PRESETS, type ExportDatePreset } from "@/lib/export/dates";
import {
  beginExportDownload,
  buildExportQuery,
  clearLeadExportFilters,
  clearSelectableColumns,
  createDefaultExportSelection,
  endExportDownload,
  getLeadStatusGroups,
  type ExportDownloadGuard,
  type ExportWorkspaceSelection,
  isCurrentExportCountRequest,
  selectAllColumns,
  selectableColumns,
} from "@/lib/export/ui";
import { reconcileLeadActivityFilters } from "@/lib/export/lead-dependencies";
import type { ExportCategoryId } from "@/lib/export/registry";
import { LEAD_CATEGORIES, LEAD_PRIORITIES, LEAD_STATUSES } from "@/lib/lead-constants";
import {
  ACTIVITY_ACTION_OPTIONS,
  ACTIVITY_INTEREST_OPTIONS,
  ACTIVITY_RESPONSE_OPTIONS,
  LEGACY_ACTIVITY_RESPONSE_OPTIONS,
} from "@/lib/activity-options";
import { ACTIVITY_REASON_OPTIONS } from "@/lib/activity-reasons";

type WorkspaceCategory = {
  id: ExportCategoryId;
  label: string;
  description: string;
  defaultDateField: string;
  columnSelection: boolean;
  kind: "rows" | "aggregate";
};

type LookupOption = { id: string; name: string; type?: string };
type FilterOption = { value: string; label: string };
const LEAD_FILTER_GROUPS = ["Status", "Source", "Action", "Response", "Priority", "Category", "Interest", "Reason", "Archived Leads", "Activity Date", "Lead Created Date"] as const;

const ALL_RESPONSE_OPTIONS: FilterOption[] = [
  ...ACTIVITY_RESPONSE_OPTIONS,
  ...LEGACY_ACTIVITY_RESPONSE_OPTIONS,
];

function MultiSelectFilter({
  id,
  label,
  allLabel,
  options,
  selected,
  disabled = false,
  helperText,
  onChange,
}: {
  id: string;
  label: string;
  allLabel: string;
  options: FilterOption[];
  selected: string[];
  disabled?: boolean;
  helperText?: string | null;
  onChange: (values: string[]) => void;
}) {
  return (
    <div className={`rounded-lg border border-[var(--color-border)] bg-white p-3 ${disabled ? "opacity-65" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">{selected.length ? `${selected.length} selected` : allLabel}</span>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--color-brand)] disabled:opacity-50"
            onClick={() => onChange([])}
            disabled={disabled || selected.length === 0}
          >
            Clear
          </button>
        </div>
      </div>
      <fieldset id={id} disabled={disabled} className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2" aria-label={label}>
        {options.map((option) => (
          <label key={option.value} className="flex min-h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-[var(--color-surface)] focus-within:ring-2 focus-within:ring-[var(--color-brand)]/30">
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(option.value)}
              onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </fieldset>
      {helperText && (
        <p className="mt-2 text-xs text-[var(--color-muted)]" role="status">
          {helperText}
        </p>
      )}
    </div>
  );
}

const PRESET_LABELS: Record<ExportDatePreset, string> = {
  "all-time": "All time",
  today: "Today (UTC)",
  "this-week": "This week (Mon–Today, UTC)",
  yesterday: "Yesterday (UTC)",
  "last-7-days": "Last 7 days (UTC)",
  "last-30-days": "Last 30 days (UTC)",
  "this-month": "This month (UTC)",
  "previous-month": "Previous month (UTC)",
  custom: "Custom dates",
};

export function ExportWorkspace({
  categories,
  role,
  salesPrivilege,
  salespeople = [],
  connectors = [],
  sources = [],
  providerTypes = [],
  userDesignations = [],
}: {
  categories: WorkspaceCategory[];
  role: "ADMIN" | "SALES";
  salesPrivilege?: "JUNIOR" | "SENIOR" | null;
  salespeople?: LookupOption[];
  connectors?: LookupOption[];
  sources?: LookupOption[];
  providerTypes?: string[];
  userDesignations?: string[];
}) {
  const [categoryId, setCategoryId] = useState<ExportCategoryId>(categories[0]?.id ?? "leads");
  const [selection, setSelection] = useState<ExportWorkspaceSelection>(() => createDefaultExportSelection());
  const [fieldsExpanded, setFieldsExpanded] = useState(false);
  const [activeLeadFilter, setActiveLeadFilter] = useState<(typeof LEAD_FILTER_GROUPS)[number]>("Status");
  const [dependencyNotice, setDependencyNotice] = useState<{ interest: string | null; reason: string | null }>({
    interest: null,
    reason: null,
  });
  const [countResult, setCountResult] = useState<{ key: string; count: number } | null>(null);
  const [countFailure, setCountFailure] = useState<{ key: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "status" | "error"; text: string } | null>(null);
  const pendingRef = useRef<ExportDownloadGuard>({ pending: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countSequence = useRef(0);
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const countQuery = useMemo(() => category ? buildExportQuery(category.id, selection, { role, salesPrivilege }) : null, [category, selection, role, salesPrivilege]);
  const countKey = countQuery?.ok ? countQuery.params.toString() : "";
  const count = countResult?.key === countKey ? countResult.count : null;
  const countStatus = !countQuery?.ok ? "error" : count !== null ? "ready" : countFailure?.key === countKey ? "error" : "loading";
  const countError = countQuery && !countQuery.ok ? countQuery.error : countFailure?.key === countKey ? countFailure.message : "Choose a valid export category.";

  const leadDeps = useMemo(
    () => reconcileLeadActivityFilters({
      responses: selection.responses,
      interests: selection.interests,
      reasons: selection.reasons,
    }),
    [selection.responses, selection.interests, selection.reasons],
  );

  useEffect(() => {
    if (countTimerRef.current) clearTimeout(countTimerRef.current);
    const sequence = ++countSequence.current;
    const controller = new AbortController();
    if (!countQuery || !countQuery.ok) return () => controller.abort();
    const query = countQuery;
    const requestKey = query.params.toString();
    countTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/export/count?${query.params.toString()}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as { count?: unknown; error?: string };
        if (!response.ok || typeof payload.count !== "number" || !Number.isSafeInteger(payload.count) || payload.count < 0) {
          throw new Error(typeof payload.error === "string" ? payload.error : "The matching record count could not be calculated.");
        }
        if (!isCurrentExportCountRequest(sequence, countSequence.current)) return;
        setCountResult({ key: requestKey, count: payload.count });
        setCountFailure(null);
      } catch (error) {
        if (controller.signal.aborted || !isCurrentExportCountRequest(sequence, countSequence.current)) return;
        setCountFailure({ key: requestKey, message: error instanceof Error ? error.message : "The matching record count could not be calculated." });
      }
    }, 250);
    return () => {
      if (countTimerRef.current) clearTimeout(countTimerRef.current);
      controller.abort();
    };
  }, [countQuery]);

  const availableFields = category ? selectableColumns(category.id) : [];
  const supportsFieldSelection = category?.id === "leads" || category?.id === "users" || category?.id === "providers";
  const selectedFields = category ? availableFields.filter((field) => selection.columns.includes(field.id)) : [];

  function update(patch: Partial<ExportWorkspaceSelection>) {
    setSelection((current) => ({ ...current, ...patch }));
    setMessage(null);
  }

  function updateLeadActivity(patch: { responses?: string[]; interests?: string[]; reasons?: string[] }) {
    setSelection((current) => {
      const next = reconcileLeadActivityFilters({
        responses: patch.responses ?? current.responses,
        interests: patch.interests ?? current.interests,
        reasons: patch.reasons ?? current.reasons,
      });
      setDependencyNotice({
        interest: next.clearedInterests ? next.interestMessage : null,
        reason: next.clearedReasons ? next.reasonMessage : null,
      });
      return {
        ...current,
        responses: next.responses,
        interests: next.interests,
        reasons: next.reasons,
      };
    });
    setMessage(null);
  }

  function changeCategory(next: ExportCategoryId) {
    setCategoryId(next);
    setSelection(createDefaultExportSelection(next));
    setFieldsExpanded(false);
    setDependencyNotice({ interest: null, reason: null });
    setMessage(null);
  }

  function handleDownload() {
    if (!category || countStatus !== "ready" || count === null || count < 1 || !beginExportDownload(pendingRef.current)) return;
    const result = buildExportQuery(category.id, selection, { role, salesPrivilege });
    if (!result.ok) {
      endExportDownload(pendingRef.current);
      setMessage({ kind: "error", text: result.error });
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const url = new URL("/api/export", window.location.origin);
      url.search = result.params.toString();
      const popup = window.open(url.toString(), "_blank");
      if (!popup) {
        endExportDownload(pendingRef.current);
        setPending(false);
        setMessage({ kind: "error", text: "The browser blocked the download tab. Allow pop-ups for this site and try again." });
        return;
      }
      popup.opener = null;
      setMessage({ kind: "status", text: "The browser opened the download request in a new tab. The transfer has no progress indicator; any server error will be shown in that tab." });
      timerRef.current = setTimeout(() => {
        endExportDownload(pendingRef.current);
        setPending(false);
      }, 1200);
    } catch {
      endExportDownload(pendingRef.current);
      setPending(false);
      setMessage({ kind: "error", text: "The browser could not start the download. Please try again." });
    }
  }

  if (!category || categories.length === 0) {
    return <p className="rounded-xl border border-[var(--color-border)] bg-white p-5 text-sm text-[var(--color-muted)]">There are no export categories available for this account.</p>;
  }

  const hasDateRange = category.id === "leads" || category.id === "users" || category.id === "sync-history" || category.id === "reports";
  const showCustomDates = hasDateRange && selection.datePreset === "custom";
  const showCustomActivityDates = category.id === "leads" && selection.activityDate === "custom";

  const interestHelper = dependencyNotice.interest ?? leadDeps.interestMessage;
  const reasonHelper = dependencyNotice.reason ?? leadDeps.reasonMessage;

  return (
    <div className="space-y-5">
      <section className="space-y-5" aria-labelledby="export-setup-title">
        <div>
          <h2 id="export-setup-title" className="text-lg font-bold text-[var(--color-ink)]">Choose export fields and filters</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">The server applies your account’s export permissions and record scope.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="export-category" className="block text-sm font-semibold text-[var(--color-ink)]">Data category</label>
          <Select id="export-category" value={category.id} onChange={(event) => changeCategory(event.target.value as ExportCategoryId)}>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
          <p className="text-xs text-[var(--color-muted)]">{category.description}</p>
        </div>

        <section className="rounded-xl border border-[var(--color-border)] bg-white" aria-labelledby="export-fields-title">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h3 id="export-fields-title" className="font-semibold text-[var(--color-ink)]">Choose export fields</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {supportsFieldSelection
                  ? `${selectedFields.length} of ${availableFields.length} fields selected`
                  : "This category uses a fixed CSV layout."}
              </p>
              {!fieldsExpanded && supportsFieldSelection && (
                <p className="mt-1 max-w-4xl text-xs text-[var(--color-muted)]" aria-label="Selected fields summary">
                  {selectedFields.map((field) => field.header).join(", ") || "No fields selected"}
                </p>
              )}
            </div>
            {supportsFieldSelection && (
              <button type="button" aria-expanded={fieldsExpanded} aria-controls="export-fields-panel" onClick={() => setFieldsExpanded((value) => !value)} className="rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-surface)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40">
                {fieldsExpanded ? "Hide fields" : "Choose fields"}
              </button>
            )}
          </div>
          {supportsFieldSelection && fieldsExpanded && (
            <div id="export-fields-panel" className="border-t border-[var(--color-border)] p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => update({ columns: selectAllColumns(category.id) })} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--color-surface)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40">Select all</button>
                <button type="button" onClick={() => update({ columns: clearSelectableColumns(category.id) })} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--color-surface)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40">Clear all</button>
              </div>
              <fieldset className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3" aria-label={`${category.label} CSV fields`}>
                {availableFields.map((field) => (
                  <label key={field.id} className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-[var(--color-surface)] focus-within:ring-2 focus-within:ring-[var(--color-brand)]/30">
                    <input type="checkbox" checked={selection.columns.includes(field.id)} disabled={field.mandatory} onChange={(event) => update({ columns: event.target.checked ? [...selection.columns, field.id] : selection.columns.filter((id) => id !== field.id) })} className="h-4 w-4 accent-[var(--color-brand)]" />
                    <span>{field.header}{field.mandatory ? " (required)" : ""}</span>
                  </label>
                ))}
              </fieldset>
              {category.id === "leads" && <p className="mt-2 text-xs text-[var(--color-muted)]">S.No. is always included as the first column. District is a nullable lead field; empty districts produce blank cells.</p>}
            </div>
          )}
        </section>

        <section className="space-y-5 rounded-xl border border-[var(--color-border)] bg-white p-4 sm:p-5" aria-labelledby="export-filters-title">
          <div>
            <h3 id="export-filters-title" className="font-semibold text-[var(--color-ink)]">Filters</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Count previews and CSV downloads use the exact same server filters and permissions.</p>
          </div>

          {category.id === "leads" && (() => {
            const { current: currentStatuses, legacy: legacyStatuses } = getLeadStatusGroups();
            const statusOptions = [...currentStatuses, ...legacyStatuses];
            const selectedCounts: Record<(typeof LEAD_FILTER_GROUPS)[number], number> = {
              Status: selection.status.length, Source: selection.sourceIds.length, Action: selection.actions.length,
              Response: selection.responses.length, Priority: selection.priorities.length, Category: selection.categories.length,
              Interest: selection.interests.length, Reason: selection.reasons.length,
              "Archived Leads": selection.archived === "both" ? 1 : 0,
              "Activity Date": selection.activityDate === "any" ? 0 : 1,
              "Lead Created Date": selection.datePreset === "all-time" ? 0 : 1,
            };
            const summaryItems = [
              ...selection.status.map((value) => ({ group: "Status" as const, value, label: `Status: ${statusOptions.find((item) => item.value === value)?.label ?? value}` })),
              ...selection.sourceIds.map((value) => ({ group: "Source" as const, value, label: `Source: ${sources.find((item) => item.id === value)?.name ?? value}` })),
              ...selection.actions.map((value) => ({ group: "Action" as const, value, label: `Action: ${value}` })),
              ...selection.responses.map((value) => ({ group: "Response" as const, value, label: `Response: ${ALL_RESPONSE_OPTIONS.find((item) => item.value === value)?.label ?? value}` })),
              ...selection.priorities.map((value) => ({ group: "Priority" as const, value, label: `Priority: ${value}` })),
              ...selection.categories.map((value) => ({ group: "Category" as const, value, label: `Category: ${value}` })),
              ...selection.interests.map((value) => ({ group: "Interest" as const, value, label: `Interest: ${value}` })),
              ...selection.reasons.map((value) => ({ group: "Reason" as const, value, label: `Reason: ${value}` })),
            ];
            const removeSummaryItem = (group: string, value: string) => {
              if (group === "Status") update({ status: selection.status.filter((item) => item !== value) });
              if (group === "Source") update({ sourceIds: selection.sourceIds.filter((item) => item !== value) });
              if (group === "Action") update({ actions: selection.actions.filter((item) => item !== value) });
              if (group === "Response") updateLeadActivity({ responses: selection.responses.filter((item) => item !== value) });
              if (group === "Priority") update({ priorities: selection.priorities.filter((item) => item !== value) });
              if (group === "Category") update({ categories: selection.categories.filter((item) => item !== value) });
              if (group === "Interest") updateLeadActivity({ interests: selection.interests.filter((item) => item !== value) });
              if (group === "Reason") updateLeadActivity({ reasons: selection.reasons.filter((item) => item !== value) });
            };
            const clearLeadFilters = () => {
              setSelection((current) => clearLeadExportFilters(current));
              setDependencyNotice({ interest: null, reason: null });
            };
            return <div className="space-y-4">
              <div className="rounded-lg bg-[var(--color-surface)]/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Selected filters</h4><button type="button" onClick={clearLeadFilters} className="text-xs font-semibold text-[var(--color-brand)] focus-visible:outline-hidden focus-visible:ring-2">Clear all</button></div>
                <div className="flex flex-wrap gap-2" aria-live="polite">
                  {summaryItems.map((item) => <span key={`${item.group}:${item.value}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs">{item.label}<button type="button" aria-label={`Remove ${item.label}`} onClick={() => removeSummaryItem(item.group, item.value)} className="font-bold focus-visible:outline-hidden focus-visible:ring-2">×</button></span>)}
                  {selection.archived === "both" && <span className="rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs">Including archived leads</span>}
                  {summaryItems.length === 0 && selection.archived === "active" && <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs">No filters selected</span>}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(270px,0.38fr)_minmax(0,1fr)]">
                <nav aria-label="Lead export filters" className="grid grid-cols-1 gap-1.5 min-[540px]:grid-cols-2">
                  {LEAD_FILTER_GROUPS.map((group) => <button key={group} type="button" aria-current={activeLeadFilter === group ? "step" : undefined} onClick={() => setActiveLeadFilter(group)} className={`flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 ${activeLeadFilter === group ? "bg-[var(--color-surface)] font-semibold text-[var(--color-ink)]" : "text-[var(--color-muted)] hover:bg-[var(--color-surface)]"}`}><span className="whitespace-normal break-words">{group}</span>{selectedCounts[group] > 0 && <span className="shrink-0 rounded-full bg-white px-1.5 text-xs">{selectedCounts[group]}</span>}</button>)}
                </nav>
                <div className="min-w-0 space-y-4" aria-live="polite">
                  {activeLeadFilter === "Status" && <div className="space-y-3"><MultiSelectFilter id="export-status-current" label="Current statuses" allLabel="All current statuses" options={[...currentStatuses]} selected={selection.status.filter((value) => currentStatuses.some((item) => item.value === value))} onChange={(status) => update({ status: [...selection.status.filter((value) => !currentStatuses.some((item) => item.value === value)), ...status] })} /><details className="rounded-lg border border-[var(--color-border)] p-3"><summary className="cursor-pointer text-sm font-medium">Legacy statuses <span className="text-xs text-[var(--color-muted)]">({legacyStatuses.length} historical options)</span></summary><p className="my-2 text-xs text-[var(--color-muted)]">Historical classifications retained on existing leads.</p><MultiSelectFilter id="export-status-legacy" label="Legacy statuses" allLabel="No legacy statuses" options={[...legacyStatuses]} selected={selection.status.filter((value) => legacyStatuses.some((item) => item.value === value))} onChange={(status) => update({ status: [...selection.status.filter((value) => !legacyStatuses.some((item) => item.value === value)), ...status] })} /></details></div>}
                  {activeLeadFilter === "Source" && <MultiSelectFilter id="export-source" label="Source" allLabel="All sources" options={sources.map(({ id, name }) => ({ value: id, label: name }))} selected={selection.sourceIds} onChange={(sourceIds) => update({ sourceIds })} />}
                  {activeLeadFilter === "Action" && <MultiSelectFilter id="export-actions" label="Action" allLabel="All actions" options={[...ACTIVITY_ACTION_OPTIONS]} selected={selection.actions} onChange={(actions) => update({ actions })} />}
                  {activeLeadFilter === "Response" && <MultiSelectFilter id="export-responses" label="Response" allLabel="All responses" options={ALL_RESPONSE_OPTIONS} selected={selection.responses} onChange={(responses) => updateLeadActivity({ responses })} />}
                  {activeLeadFilter === "Priority" && <MultiSelectFilter id="export-priority" label="Priority" allLabel="All priorities" options={[...LEAD_PRIORITIES]} selected={selection.priorities} onChange={(priorities) => update({ priorities })} />}
                  {activeLeadFilter === "Category" && <MultiSelectFilter id="export-lead-category" label="Category" allLabel="All categories" options={[...LEAD_CATEGORIES]} selected={selection.categories} onChange={(categories) => update({ categories })} />}
                  {activeLeadFilter === "Interest" && <MultiSelectFilter id="export-interest" label="Interest" allLabel="All interests" options={[...ACTIVITY_INTEREST_OPTIONS]} selected={selection.interests} disabled={!leadDeps.interestEnabled} helperText={interestHelper} onChange={(interests) => updateLeadActivity({ interests })} />}
                  {activeLeadFilter === "Reason" && <MultiSelectFilter id="export-reason" label="Reason" allLabel="All reasons" options={[...ACTIVITY_REASON_OPTIONS]} selected={selection.reasons} disabled={!leadDeps.reasonEnabled} helperText={reasonHelper} onChange={(reasons) => updateLeadActivity({ reasons })} />}
                  {activeLeadFilter === "Archived Leads" && <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"><input id="export-include-archived" type="checkbox" checked={selection.archived === "both"} onChange={(event) => update({ archived: event.target.checked ? "both" : "active" })} className="h-4 w-4 accent-[var(--color-brand)]" /><span>Include archived leads</span><span className="text-xs text-[var(--color-muted)]">Unchecked by default. Deleted leads remain excluded.</span></label>}
                  {activeLeadFilter === "Activity Date" && <div className="space-y-3"><label className="block space-y-2 text-sm font-semibold">Activity date<Select id="export-activity-date" value={selection.activityDate} onChange={(event) => update({ activityDate: event.target.value as ExportWorkspaceSelection["activityDate"], activityFrom: "", activityTo: "" })}><option value="any">Any activity date</option><option value="today">Today (UTC)</option><option value="yesterday">Yesterday (UTC)</option><option value="custom">Custom dates</option></Select></label>{showCustomActivityDates && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">From (UTC)<Input type="date" value={selection.activityFrom} onChange={(event) => update({ activityFrom: event.target.value })} /></label><label className="text-sm">To (UTC)<Input type="date" value={selection.activityTo} onChange={(event) => update({ activityTo: event.target.value })} /></label></div>}</div>}
                  {activeLeadFilter === "Lead Created Date" && <div className="space-y-3"><label className="block space-y-2 text-sm font-semibold">Lead created date<Select id="export-lead-created-date-preset" value={selection.datePreset} onChange={(event) => update({ datePreset: event.target.value as ExportDatePreset, dateFrom: "", dateTo: "" })}>{EXPORT_DATE_PRESETS.map((preset) => <option key={preset} value={preset}>{PRESET_LABELS[preset]}</option>)}</Select></label>{showCustomDates && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">From (UTC)<Input id="export-lead-created-date-from" type="date" value={selection.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} /></label><label className="text-sm">To (UTC)<Input id="export-lead-created-date-to" type="date" value={selection.dateTo} onChange={(event) => update({ dateTo: event.target.value })} /></label></div>}</div>}
                  {role === "ADMIN" && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Assigned salesperson<Select value={selection.assignedUserId} onChange={(event) => update({ assignedUserId: event.target.value })}><option value="">All assigned salespeople</option><option value="unassigned">Unassigned</option>{salespeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></label><label className="text-sm">Search leads<Input value={selection.search} onChange={(event) => update({ search: event.target.value })} maxLength={200} placeholder="Name, company, email, phone, or lead number" /></label></div>}
                </div>
              </div>
            </div>;
          })()}

          {category.id === "users" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="export-user-search" className="block text-sm font-semibold text-[var(--color-ink)]">Search users</label>
                <Input id="export-user-search" value={selection.search} onChange={(event) => update({ search: event.target.value })} maxLength={200} placeholder="Name, email, employee code, designation, or phone" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor="export-user-role" className="block text-sm font-medium">Role</label>
                  <Select id="export-user-role" value={selection.userRole} onChange={(event) => update({ userRole: event.target.value as ExportWorkspaceSelection["userRole"] })}>
                    <option value="">All roles</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SALES">Sales</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="export-user-active" className="block text-sm font-medium">Active state</label>
                  <Select id="export-user-active" value={selection.userActive} onChange={(event) => update({ userActive: event.target.value as ExportWorkspaceSelection["userActive"] })}>
                    <option value="all">Active and inactive (default)</option>
                    <option value="true">Active only</option>
                    <option value="false">Inactive only</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="export-user-banned" className="block text-sm font-medium">Banned state</label>
                  <Select id="export-user-banned" value={selection.userBanned} onChange={(event) => update({ userBanned: event.target.value as ExportWorkspaceSelection["userBanned"] })}>
                    <option value="all">Banned and not banned (default)</option>
                    <option value="false">Not banned</option>
                    <option value="true">Banned only</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="export-user-privilege" className="block text-sm font-medium">Sales Privilege</label>
                  <Select id="export-user-privilege" value={selection.userSalesPrivilege} onChange={(event) => update({ userSalesPrivilege: event.target.value as ExportWorkspaceSelection["userSalesPrivilege"] })}>
                    <option value="">All privileges</option>
                    <option value="JUNIOR">Junior</option>
                    <option value="SENIOR">Senior</option>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="export-user-designation" className="block text-sm font-medium">Designation</label>
                  <Select id="export-user-designation" value={selection.userDesignation} onChange={(event) => update({ userDesignation: event.target.value })}>
                    <option value="">All designations</option>
                    {userDesignations.map((designation) => <option key={designation} value={designation}>{designation}</option>)}
                  </Select>
                </div>
              </div>
            </div>
          )}

          {category.id === "providers" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="export-provider-status" className="block text-sm font-semibold text-[var(--color-ink)]">Provider status</label>
                <Select id="export-provider-status" value={selection.providerActive} onChange={(event) => update({ providerActive: event.target.value as ExportWorkspaceSelection["providerActive"] })}>
                  <option value="true">Active providers (default)</option>
                  <option value="all">All providers</option>
                  <option value="false">Inactive providers</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="export-provider-type" className="block text-sm font-semibold text-[var(--color-ink)]">Provider type</label>
                <Select id="export-provider-type" value={selection.providerType} onChange={(event) => update({ providerType: event.target.value })}>
                  <option value="">All types</option>
                  {providerTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
              </div>
            </div>
          )}

          {category.id === "sync-history" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="export-connector" className="block text-sm font-semibold text-[var(--color-ink)]">Connector</label>
                <Select id="export-connector" value={selection.connectorId} onChange={(event) => update({ connectorId: event.target.value })}>
                  <option value="">All connectors</option>
                  {connectors.map((connector) => <option key={connector.id} value={connector.id}>{connector.name}{connector.type ? ` · ${connector.type}` : ""}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="export-sync-status" className="block text-sm font-semibold text-[var(--color-ink)]">Status</label>
                <Select id="export-sync-status" value={selection.syncStatus} onChange={(event) => update({ syncStatus: event.target.value as ExportWorkspaceSelection["syncStatus"] })}>
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Success</option>
                  <option value="ERROR">Failed</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="export-sync-error" className="block text-sm font-semibold text-[var(--color-ink)]">Error outcome</label>
                <Select id="export-sync-error" value={selection.syncErrorOutcome} onChange={(event) => update({ syncErrorOutcome: event.target.value as ExportWorkspaceSelection["syncErrorOutcome"] })}>
                  <option value="any">All runs</option>
                  <option value="with-error">With error</option>
                  <option value="without-error">Without error</option>
                </Select>
              </div>
            </div>
          )}

          {category.id === "reports" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <MultiSelectFilter id="export-report-source" label="Source" allLabel="All sources" options={sources.map(({ id, name }) => ({ value: id, label: name }))} selected={selection.reportSourceIds} onChange={(reportSourceIds) => update({ reportSourceIds })} />
              <MultiSelectFilter id="export-report-owner" label="Owner" allLabel="All owners" options={salespeople.map(({ id, name }) => ({ value: id, label: name }))} selected={selection.reportOwnerIds} onChange={(reportOwnerIds) => update({ reportOwnerIds })} />
              <MultiSelectFilter id="export-report-status" label="Status" allLabel="All statuses" options={[...LEAD_STATUSES]} selected={selection.reportStatuses} onChange={(reportStatuses) => update({ reportStatuses })} />
            </div>
          )}

          {hasDateRange && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="export-date-preset" className="block text-sm font-semibold text-[var(--color-ink)]">
                  {category.id === "leads" ? "Lead Created Date range" : category.id === "users" ? "Created Date range" : "Date range"}
                </label>
                <Select id="export-date-preset" value={selection.datePreset} onChange={(event) => update({ datePreset: event.target.value as ExportDatePreset, dateFrom: "", dateTo: "" })}>
                  {EXPORT_DATE_PRESETS.map((preset) => <option key={preset} value={preset}>{PRESET_LABELS[preset]}</option>)}
                </Select>
                <p className="text-xs text-[var(--color-muted)]">
                  Dates are evaluated on UTC calendar boundaries.{" "}
                  {category.id === "leads"
                    ? "Filters Lead.createdAt independently of Activity Date."
                    : category.id === "users"
                      ? "Filters User.createdAt."
                      : category.id === "sync-history"
                        ? "Sync Runs filter by start time."
                        : "Report date-sensitive sections use lead creation date; activity totals retain their fixed today/7/30-day UTC windows."}
                </p>
              </div>
              {showCustomDates && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="export-date-from" className="block text-sm font-medium">From (inclusive, UTC)</label>
                    <Input id="export-date-from" type="date" value={selection.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="export-date-to" className="block text-sm font-medium">To (inclusive, UTC)</label>
                    <Input id="export-date-to" type="date" value={selection.dateTo} onChange={(event) => update({ dateTo: event.target.value })} />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-xs sm:p-6" aria-labelledby="export-summary-title">
        <div>
          <h2 id="export-summary-title" className="text-lg font-bold text-[var(--color-ink)]">Export summary</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Review the matching records and selected CSV fields before downloading.</p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-[var(--color-muted)]">Category</dt><dd className="font-semibold">{category.label}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Record scope</dt><dd className="font-semibold">{category.id === "leads" ? role === "SALES" ? "Your assigned, non-deleted leads" : "All non-deleted leads" : category.id === "users" ? "All non-deleted users" : category.id === "providers" ? (selection.providerActive === "all" ? "All providers" : selection.providerActive === "false" ? "Inactive providers" : "Active providers") : category.id === "sync-history" ? "Matching connector sync runs" : "Matching leads summarized"}</dd></div>
          <div><dt className="text-[var(--color-muted)]">CSV columns</dt><dd className="font-semibold">{supportsFieldSelection ? `${selectedFields.length} selected` : "Fixed layout"}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Matching records</dt><dd aria-live="polite" className="font-semibold">{countStatus === "loading" ? "Calculating…" : countStatus === "error" ? "Unavailable" : count === 0 ? "0 records" : `${count?.toLocaleString()}${category.id === "reports" ? " leads summarized" : " records"}`}</dd></div>
          <div className="sm:col-span-2 lg:col-span-3"><dt className="text-[var(--color-muted)]">Active filters</dt><dd className="font-medium">{category.id === "leads" ? [
            selection.status.length && `Status: ${selection.status.map((v) => LEAD_STATUSES.find((item) => item.value === v)?.label ?? v).join(", ")}`,
            selection.sourceIds.length && `Source: ${selection.sourceIds.map((id) => sources.find((item) => item.id === id)?.name ?? "Selected source").join(", ")}`,
            selection.actions.length && `Action: ${selection.actions.join(", ")}`,
            selection.responses.length && `Response: ${selection.responses.join(", ")}`,
            selection.priorities.length && `Priority: ${selection.priorities.join(", ")}`,
            selection.categories.length && `Category: ${selection.categories.join(", ")}`,
            selection.interests.length && `Interest: ${selection.interests.join(", ")}`,
            selection.reasons.length && `Reason: ${selection.reasons.join(", ")}`,
            selection.archived === "active" && "Archived: Excluded",
            selection.assignedUserId && `Assigned: ${selection.assignedUserId === "unassigned" ? "Unassigned" : salespeople.find((item) => item.id === selection.assignedUserId)?.name ?? "Selected user"}`,
            selection.search.trim() && "Search applied",
            selection.datePreset !== "all-time" && `Lead created: ${selection.datePreset === "custom" ? `${selection.dateFrom || "Start"} – ${selection.dateTo || "End"} UTC` : PRESET_LABELS[selection.datePreset]}`,
            selection.activityDate !== "any" && `Activity date: ${selection.activityDate === "custom" ? `${selection.activityFrom || "Any start"} – ${selection.activityTo || "Any end"} UTC` : selection.activityDate}`,
          ].filter(Boolean).join(" · ") || "None" : category.id === "users" ? [
            selection.search.trim() && "Search applied",
            selection.userRole && `Role: ${selection.userRole}`,
            selection.userActive !== "all" && `Active: ${selection.userActive}`,
            selection.userBanned !== "all" && `Banned: ${selection.userBanned}`,
            selection.userSalesPrivilege && `Privilege: ${selection.userSalesPrivilege}`,
            selection.userDesignation && `Designation: ${selection.userDesignation}`,
            selection.datePreset !== "all-time" && `Created: ${selection.datePreset === "custom" ? `${selection.dateFrom || "Start"} – ${selection.dateTo || "End"} UTC` : PRESET_LABELS[selection.datePreset]}`,
          ].filter(Boolean).join(" · ") || "None" : category.id === "providers" ? [
            `Status: ${selection.providerActive === "all" ? "All" : selection.providerActive === "false" ? "Inactive" : "Active"}`,
            selection.providerType && `Type: ${selection.providerType}`,
          ].filter(Boolean).join(" · ") : category.id === "sync-history" ? [
            selection.connectorId && `Connector: ${connectors.find((item) => item.id === selection.connectorId)?.name ?? "Selected connector"}`,
            selection.syncStatus && `Status: ${selection.syncStatus}`,
            selection.syncErrorOutcome !== "any" && `Error: ${selection.syncErrorOutcome}`,
            selection.datePreset !== "all-time" && PRESET_LABELS[selection.datePreset],
          ].filter(Boolean).join(" · ") || "None" : category.id === "reports" ? [
            selection.datePreset !== "all-time" && PRESET_LABELS[selection.datePreset],
            selection.reportSourceIds.length && `Source: ${selection.reportSourceIds.length} selected`,
            selection.reportOwnerIds.length && `Owner: ${selection.reportOwnerIds.length} selected`,
            selection.reportStatuses.length && `Status: ${selection.reportStatuses.join(", ")}`,
          ].filter(Boolean).join(" · ") || "None" : "None"}</dd></div>
        </dl>
        {supportsFieldSelection && <ul className="flex flex-wrap gap-1.5" aria-label="Selected CSV fields">{selectedFields.map((field) => <li key={field.id} className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-muted)]">{field.header}</li>)}</ul>}
        {countStatus === "error" && <p role="alert" className="text-sm text-[var(--color-danger)]">{countError}</p>}
        {countStatus === "ready" && count === 0 && <p role="status" className="text-sm text-[var(--color-muted)]">No records match the current category and filters.</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] pt-4">
          <Button type="button" onClick={handleDownload} disabled={pending || countStatus !== "ready" || count === null || count < 1} isLoading={pending} className="min-w-40">
            <Download size={16} aria-hidden="true" />
            {pending ? "Opening download…" : "Download CSV"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { const defaults = createDefaultExportSelection(category.id); setSelection((current) => ({ ...defaults, columns: current.columns })); setDependencyNotice({ interest: null, reason: null }); setMessage(null); }}>
            <RotateCcw size={15} aria-hidden="true" />
            Reset filters
          </Button>
          {message && <p role={message.kind === "error" ? "alert" : "status"} aria-live="polite" className={message.kind === "error" ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-muted)]"}>{message.text}</p>}
        </div>
        <p className="text-xs text-[var(--color-muted)]">The preview count and download are separate database requests; records may change between them. CSV is streamed.</p>
      </section>
    </div>
  );
}
