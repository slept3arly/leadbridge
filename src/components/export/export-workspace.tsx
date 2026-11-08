"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EXPORT_DATE_PRESETS, type ExportDatePreset } from "@/lib/export/dates";
import { beginExportDownload, buildExportQuery, createDefaultExportSelection, endExportDownload, type ExportDownloadGuard, getCurrentCsvHeaders, type ExportWorkspaceSelection } from "@/lib/export/ui";
import type { ExportCategoryId } from "@/lib/export/registry";
import { LEAD_CATEGORIES, LEAD_PRIORITIES, LEAD_STATUSES } from "@/lib/lead-constants";
import { ACTIVITY_ACTION_OPTIONS, ACTIVITY_INTEREST_OPTIONS, ACTIVITY_RESPONSE_OPTIONS } from "@/lib/activity-options";

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

function MultiSelectFilter({
  id,
  label,
  allLabel,
  options,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  allLabel: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <details className="rounded-lg border border-[var(--color-border)] bg-white">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30">
        <span className="font-medium text-[var(--color-ink)]">{label}</span>
        <span className="text-xs text-[var(--color-muted)]">{selected.length ? `${selected.length} selected` : allLabel}</span>
      </summary>
      <div className="border-t border-[var(--color-border)] p-3">
        <button type="button" className="mb-2 text-xs font-semibold text-[var(--color-brand)] disabled:opacity-50" onClick={() => onChange([])} disabled={selected.length === 0}>
          Clear selection ({allLabel})
        </button>
        <fieldset id={id} className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2" aria-label={label}>
          {options.map((option) => (
            <label key={option.value} className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-[var(--color-surface)] focus-within:ring-2 focus-within:ring-[var(--color-brand)]/30">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </div>
    </details>
  );
}

const PRESET_LABELS: Record<ExportDatePreset, string> = {
  "all-time": "All time",
  today: "Today (UTC)",
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
}: {
  categories: WorkspaceCategory[];
  role: "ADMIN" | "SALES";
  salesPrivilege?: "JUNIOR" | "SENIOR" | null;
  salespeople?: LookupOption[];
  connectors?: LookupOption[];
  sources?: LookupOption[];
}) {
  const [categoryId, setCategoryId] = useState<ExportCategoryId>(categories[0]?.id ?? "leads");
  const [selection, setSelection] = useState<ExportWorkspaceSelection>(() => createDefaultExportSelection());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "status" | "error"; text: string } | null>(null);
  const pendingRef = useRef<ExportDownloadGuard>({ pending: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const csvHeaders = useMemo(() => category ? getCurrentCsvHeaders(category.id) : [], [category]);

  function update(patch: Partial<ExportWorkspaceSelection>) {
    setSelection((current) => ({ ...current, ...patch }));
    setMessage(null);
  }

  function changeCategory(next: ExportCategoryId) {
    setCategoryId(next);
    setSelection(createDefaultExportSelection());
    setMessage(null);
  }

  function handleDownload() {
    if (!category || !beginExportDownload(pendingRef.current)) return;
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

  const hasDateRange = category.id === "leads" || category.id === "sync-history" || category.id === "reports";
  const showCustomDates = hasDateRange && selection.datePreset === "custom";
  const showCustomActivityDates = category.id === "leads" && selection.activityDate === "custom";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]">
      <section className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-xs sm:p-6" aria-labelledby="export-setup-title">
        <div>
          <h2 id="export-setup-title" className="text-lg font-bold text-[var(--color-ink)]">Choose an export</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">The server applies your account’s export permissions and record scope.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="export-category" className="block text-sm font-semibold text-[var(--color-ink)]">Data category</label>
          <Select id="export-category" value={category.id} onChange={(event) => changeCategory(event.target.value as ExportCategoryId)}>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
          <p className="text-xs text-[var(--color-muted)]">{category.description}</p>
        </div>

        {category.id === "leads" && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-muted)]">Different filter groups are combined with AND. Multiple values within a filter are combined with OR.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <MultiSelectFilter id="export-status" label="Lead Status" allLabel="All statuses" options={[...LEAD_STATUSES]} selected={selection.status} onChange={(status) => update({ status })} />
              <MultiSelectFilter id="export-source" label="Lead Source" allLabel="All sources" options={sources.map(({ id, name }) => ({ value: id, label: name }))} selected={selection.sourceIds} onChange={(sourceIds) => update({ sourceIds })} />
              <MultiSelectFilter id="export-actions" label="Action" allLabel="All actions" options={[...ACTIVITY_ACTION_OPTIONS]} selected={selection.actions} onChange={(actions) => update({ actions })} />
              <MultiSelectFilter id="export-responses" label="Response" allLabel="All responses" options={[...ACTIVITY_RESPONSE_OPTIONS]} selected={selection.responses} onChange={(responses) => update({ responses })} />
              <MultiSelectFilter id="export-priority" label="Priority" allLabel="All priorities" options={[...LEAD_PRIORITIES]} selected={selection.priorities} onChange={(priorities) => update({ priorities })} />
              <MultiSelectFilter id="export-lead-category" label="Category" allLabel="All categories" options={[...LEAD_CATEGORIES]} selected={selection.categories} onChange={(categories) => update({ categories })} />
              <MultiSelectFilter id="export-interest" label="Interest" allLabel="All interests" options={[...ACTIVITY_INTEREST_OPTIONS]} selected={selection.interests} onChange={(interests) => update({ interests })} />
            </div>

            <div className="space-y-2">
              <label htmlFor="export-archived" className="block text-sm font-semibold text-[var(--color-ink)]">Archived state</label>
              <Select id="export-archived" value={selection.archived} onChange={(event) => update({ archived: event.target.value as ExportWorkspaceSelection["archived"] })}>
                <option value="both">Active and archived (current export default)</option>
                <option value="active">Hide archived</option>
                <option value="archived">Archived only</option>
              </Select>
            </div>

            {role === "ADMIN" && (
              <div className="space-y-2">
                <label htmlFor="export-assignee" className="block text-sm font-semibold text-[var(--color-ink)]">Assigned salesperson</label>
                <Select id="export-assignee" value={selection.assignedUserId} onChange={(event) => update({ assignedUserId: event.target.value })}>
                  <option value="">All assigned salespeople</option>
                  <option value="unassigned">Unassigned</option>
                  {salespeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="export-lead-search" className="block text-sm font-semibold text-[var(--color-ink)]">Search leads</label>
              <Input id="export-lead-search" value={selection.search} onChange={(event) => update({ search: event.target.value })} maxLength={200} placeholder="Name, company, email, phone, or lead number" />
            </div>
          </div>
        )}

        {category.id === "leads" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="export-activity-date" className="block text-sm font-semibold text-[var(--color-ink)]">Activity Date</label>
              <Select id="export-activity-date" value={selection.activityDate} onChange={(event) => update({ activityDate: event.target.value as ExportWorkspaceSelection["activityDate"], activityFrom: "", activityTo: "" })}>
                <option value="any">Any activity date</option>
                <option value="today">Today (UTC)</option>
                <option value="yesterday">Yesterday (UTC)</option>
                <option value="custom">Custom dates</option>
              </Select>
              <p className="text-xs text-[var(--color-muted)]">Matches ActivityEvent occurrence time. Selected Action, Response, and Interest values must match one CALL/WHATSAPP entry on that event.</p>
            </div>
            {showCustomActivityDates && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="export-activity-from" className="block text-sm font-medium">Activity from (inclusive, UTC)</label>
                  <Input id="export-activity-from" type="date" value={selection.activityFrom} onChange={(event) => update({ activityFrom: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="export-activity-to" className="block text-sm font-medium">Activity to (inclusive, UTC)</label>
                  <Input id="export-activity-to" type="date" value={selection.activityTo} onChange={(event) => update({ activityTo: event.target.value })} />
                </div>
              </div>
            )}
          </div>
        )}

        {hasDateRange && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="export-date-preset" className="block text-sm font-semibold text-[var(--color-ink)]">Date range</label>
              <Select id="export-date-preset" value={selection.datePreset} onChange={(event) => update({ datePreset: event.target.value as ExportDatePreset, dateFrom: "", dateTo: "" })}>
                {EXPORT_DATE_PRESETS.map((preset) => <option key={preset} value={preset}>{PRESET_LABELS[preset]}</option>)}
              </Select>
              <p className="text-xs text-[var(--color-muted)]">Dates are evaluated on UTC calendar boundaries. {category.id === "leads" ? "Lead exports filter by creation date." : category.id === "sync-history" ? "Sync Runs filter by start time." : "Report date-sensitive sections use lead creation date; activity totals retain their fixed today/7/30-day windows."}</p>
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

        {category.id === "sync-history" && (
          <div className="space-y-2">
            <label htmlFor="export-connector" className="block text-sm font-semibold text-[var(--color-ink)]">Connector</label>
            <Select id="export-connector" value={selection.connectorId} onChange={(event) => update({ connectorId: event.target.value })}>
              <option value="">All connectors</option>
              {connectors.map((connector) => <option key={connector.id} value={connector.id}>{connector.name}{connector.type ? ` · ${connector.type}` : ""}</option>)}
            </Select>
          </div>
        )}

        {(category.id === "users" || category.id === "providers") && (
          <p className="rounded-lg bg-[var(--color-surface)] p-3 text-sm text-[var(--color-muted)]">
            {category.id === "users"
              ? "The current endpoint exports all non-deleted users, including active and inactive accounts. It does not accept user filters."
              : "The current endpoint exports active providers only. Provider search, status, and type filters are not accepted by this download route."}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] pt-4">
          <Button type="button" onClick={handleDownload} disabled={pending} isLoading={pending} className="min-w-40">
            <Download size={16} aria-hidden="true" />
            {pending ? "Opening download…" : "Download CSV"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { setSelection(createDefaultExportSelection()); setMessage(null); }}>
            <RotateCcw size={15} aria-hidden="true" />
            Reset filters
          </Button>
        </div>
        {message && <p role={message.kind === "error" ? "alert" : "status"} aria-live="polite" className={message.kind === "error" ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-muted)]"}>{message.text}</p>}
      </section>

      <aside className="h-fit space-y-4 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-xs sm:p-6" aria-labelledby="export-summary-title">
        <div>
          <h2 id="export-summary-title" className="text-base font-bold text-[var(--color-ink)]">Export summary</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Selection is applied with AND between filter groups.</p>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-[var(--color-muted)]">Category</dt><dd className="text-right font-medium">{category.label}</dd></div>
          {category.id === "leads" && selection.status.length > 0 && <div><dt className="text-[var(--color-muted)]">Statuses (OR)</dt><dd className="font-medium">{selection.status.map((value) => LEAD_STATUSES.find((status) => status.value === value)?.label ?? value).join(", ")}</dd></div>}
          {category.id === "leads" && selection.sourceIds.length > 0 && <div><dt className="text-[var(--color-muted)]">Sources (OR)</dt><dd className="font-medium">{selection.sourceIds.map((id) => sources.find((source) => source.id === id)?.name ?? "Selected source").join(", ")}</dd></div>}
          {category.id === "leads" && selection.actions.length > 0 && <div><dt className="text-[var(--color-muted)]">Actions (OR)</dt><dd className="font-medium">{selection.actions.map((value) => ACTIVITY_ACTION_OPTIONS.find((option) => option.value === value)?.label ?? value).join(", ")}</dd></div>}
          {category.id === "leads" && selection.responses.length > 0 && <div><dt className="text-[var(--color-muted)]">Responses (OR)</dt><dd className="font-medium">{selection.responses.map((value) => ACTIVITY_RESPONSE_OPTIONS.find((option) => option.value === value)?.label ?? value).join(", ")}</dd></div>}
          {category.id === "leads" && selection.priorities.length > 0 && <div><dt className="text-[var(--color-muted)]">Priorities (OR)</dt><dd className="font-medium">{selection.priorities.map((value) => LEAD_PRIORITIES.find((option) => option.value === value)?.label ?? value).join(", ")}</dd></div>}
          {category.id === "leads" && selection.categories.length > 0 && <div><dt className="text-[var(--color-muted)]">Categories (OR)</dt><dd className="font-medium">{selection.categories.map((value) => LEAD_CATEGORIES.find((option) => option.value === value)?.label ?? value).join(", ")}</dd></div>}
          {category.id === "leads" && selection.interests.length > 0 && <div><dt className="text-[var(--color-muted)]">Interests (OR)</dt><dd className="font-medium">{selection.interests.map((value) => ACTIVITY_INTEREST_OPTIONS.find((option) => option.value === value)?.label ?? value).join(", ")}</dd></div>}
          {category.id === "leads" && selection.archived !== "both" && <div><dt className="text-[var(--color-muted)]">Archived state</dt><dd className="font-medium">{selection.archived === "active" ? "Hide archived" : "Archived only"}</dd></div>}
          {category.id === "leads" && selection.assignedUserId && <div><dt className="text-[var(--color-muted)]">Assigned salesperson</dt><dd className="font-medium">{selection.assignedUserId === "unassigned" ? "Unassigned" : salespeople.find((person) => person.id === selection.assignedUserId)?.name ?? "Selected user"}</dd></div>}
          {category.id === "leads" && selection.search.trim() && <div><dt className="text-[var(--color-muted)]">Search</dt><dd className="font-medium">Search term applied</dd></div>}
          {hasDateRange && <div><dt className="text-[var(--color-muted)]">{category.id === "leads" ? "Lead created" : "Date"}</dt><dd className="font-medium">{selection.datePreset === "custom" ? `${selection.dateFrom || "Start"} – ${selection.dateTo || "End"} (UTC)` : PRESET_LABELS[selection.datePreset]}</dd></div>}
          {category.id === "leads" && selection.activityDate !== "any" && <div><dt className="text-[var(--color-muted)]">Activity date</dt><dd className="font-medium">{selection.activityDate === "custom" ? `${selection.activityFrom || "Any start"} – ${selection.activityTo || "Any end"} (UTC)` : selection.activityDate === "today" ? "Today (UTC)" : "Yesterday (UTC)"}</dd></div>}
          {category.id === "sync-history" && selection.connectorId && <div><dt className="text-[var(--color-muted)]">Connector</dt><dd className="font-medium">{connectors.find((item) => item.id === selection.connectorId)?.name ?? "Selected connector"}</dd></div>}
          {role === "SALES" && category.id === "leads" && <div><dt className="text-[var(--color-muted)]">Record scope</dt><dd className="font-medium">Your assigned, non-deleted leads</dd></div>}
        </dl>
        <div className="border-t border-[var(--color-border)] pt-3">
          <p className="text-xs font-semibold text-[var(--color-ink)]">CSV columns</p>
          {category.kind === "aggregate" ? (
            <p className="mt-1 text-xs text-[var(--color-muted)]">Fixed report sections; custom column selection is not accepted by the current endpoint.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Current compatible column order. Custom columns are not accepted by the current endpoint.</p>
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Current CSV columns">
                {csvHeaders.map((header) => <li key={header} className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-muted)]">{header}</li>)}
              </ul>
            </>
          )}
        </div>
        <p className="border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-muted)]">The endpoint does not provide a count preview or completion percentage. The browser handles the streamed download.</p>
      </aside>
    </div>
  );
}
