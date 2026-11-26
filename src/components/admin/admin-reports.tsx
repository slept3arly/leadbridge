"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardEmptyState } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Navbar } from "@/components/shared/navbar";
import { ResyncButton } from "@/components/shared/resync-button";
import { ExportButton } from "@/components/shared/export-button";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";
import { getErrorMessage } from "@/lib/get-error-message";
import { resolveExportDateRange, type ExportDatePreset } from "@/lib/export/dates";
import { getStatusLabel, LEAD_STATUSES } from "@/lib/lead-constants";
import { Users, Target, TrendingUp, BarChart3, Activity, Award, Flame, Star } from "lucide-react";

interface SummaryData {
  total: number; active: number; closed: number; won: number; lost: number; deleted: number;
  conversionRate: number; lostRate: number; openRate: number;
}

interface SourceEntry { providerId?: string | null; providerName: string; count: number; connectorId?: string | null; connectorName?: string; connectorType?: string; parserVersion?: string; }

interface AssignmentEntry { userId?: string | null; userName: string; leadCount: number; }

interface StatusEntry { status: string; count: number; }

interface TrendEntry { month: string; total: number; won: number; lost: number; }

interface OwnerRow { id: string; name: string; leadCount: number; isUnassigned?: boolean; }

interface Insights {
  bestSource: SourceEntry | null;
  bestSalesperson: AssignmentEntry | null;
  highestConversionMonth: TrendEntry | null;
}

type ReportQueryParams = {
  from?: string;
  to?: string;
  source?: string;
  owner?: string;
  status?: string;
};

type LookupOption = { id: string; name: string };

function fetchReport(type: string, queryParams: ReportQueryParams, signal?: AbortSignal): Promise<{ data: unknown }> {
  const params = new URLSearchParams({ type });
  if (queryParams.from) params.set("from", queryParams.from);
  if (queryParams.to) params.set("to", queryParams.to);
  if (queryParams.source) params.set("source", queryParams.source);
  if (queryParams.owner) params.set("owner", queryParams.owner);
  if (queryParams.status) params.set("status", queryParams.status);
  return fetch(`/api/reports?${params}`, { signal }).then((r) => { if (!r.ok) throw new Error(`Failed: ${r.statusText}`); return r.json(); });
}

function deriveInsights(
  sources: SourceEntry[],
  assignments: AssignmentEntry[],
  trends: TrendEntry[],
): Insights {
  const sortedSources = [...sources].sort((a, b) => b.count - a.count);
  const sortedAssignments = [...assignments].sort((a, b) => b.leadCount - a.leadCount);
  const sortedTrends = [...trends].sort((a, b) => (a.total ? b.won / b.total - a.won / a.total : 0));
  return {
    bestSource: sortedSources[0] ?? null,
    bestSalesperson: sortedAssignments[0] ?? null,
    highestConversionMonth: sortedTrends[0] ?? null,
  };
}

function HorizontalBar({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-xs font-medium text-[var(--color-ink)]">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 text-right text-xs font-semibold text-[var(--color-muted)] tabular-nums">{value}{suffix ?? ""}</span>
    </div>
  );
}

function TrendBarChart({ data }: { data: TrendEntry[] }) {
  if (!data.length) return <CardEmptyState title="No trend data" />;
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const barMaxHeight = 160;
  return (
    <div className="flex items-end gap-2 h-[200px] pt-4">
      {data.map((entry) => {
        const h = (entry.total / maxVal) * barMaxHeight;
        const wonPct = entry.total > 0 ? (entry.won / entry.total) * 100 : 0;
        return (
          <div key={entry.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <span className="text-[10px] font-medium text-emerald-600 tabular-nums">{entry.won}</span>
            <div className="w-full flex flex-col items-center justify-end" style={{ height: `${h}px` }}>
              <div className="w-full rounded-t-sm bg-[var(--color-brand)] opacity-70" style={{ height: `${h}px` }} />
              <div className="w-full rounded-t-sm bg-emerald-400" style={{ height: `${wonPct > 0 ? Math.max(h * wonPct / 100, 2) : 0}px`, marginTop: `-${Math.max(h * wonPct / 100, 0)}px` }} />
            </div>
            <span className="text-[10px] text-[var(--color-muted)] font-medium tabular-nums mt-1">{entry.month?.slice(5) ?? ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function InsightsCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface)] text-[var(--color-brand)]">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-muted)]">{label}</p>
        <p className="mt-0.5 text-sm font-bold text-[var(--color-ink)] truncate">{value}</p>
        {sub && <p className="text-xs text-[var(--color-muted)] mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}</div>
      <SkeletonCard className="h-72" />
      <div className="grid gap-6 md:grid-cols-2"><SkeletonCard className="h-64" /><SkeletonCard className="h-64" /></div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5"><div className="mb-4 h-5 w-56 animate-pulse rounded bg-slate-200" /><SkeletonTable rows={5} cols={2} compact /></div>
      <div className="grid gap-6 md:grid-cols-2"><SkeletonCard className="h-56" /><SkeletonCard className="h-56" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)}</div>
    </div>
  );
}

export function AdminReports({
  initialRange,
  salespeople = [],
  sources: sourceOptions = [],
}: {
  initialRange: { from: string; to: string };
  salespeople?: LookupOption[];
  sources?: LookupOption[];
}) {
  const [preset, setPreset] = useState<ExportDatePreset>("last-30-days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reportRange, setReportRange] = useState<{ from: string; to: string } | undefined>(initialRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [unassigned, setUnassigned] = useState(0);
  const [activity, setActivity] = useState<{ today: number; thisWeek: number; thisMonth: number } | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusEntry[]>([]);
  const [trends, setTrends] = useState<TrendEntry[]>([]);

  const queryParams = useMemo<ReportQueryParams>(() => ({
    ...(reportRange ? { from: reportRange.from, to: reportRange.to } : {}),
    ...(sourceId ? { source: sourceId } : {}),
    ...(ownerId ? { owner: ownerId } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  }), [reportRange, sourceId, ownerId, statusFilter]);

  const fetchAll = useCallback(async (params: ReportQueryParams) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, sourcesRes, assignmentsRes, activityRes, statusRes, trendsRes] = await Promise.all([
        fetchReport("summary", params, controller.signal),
        fetchReport("sources", params, controller.signal),
        fetchReport("assignments", params, controller.signal),
        fetchReport("activity", params, controller.signal),
        fetchReport("status", params, controller.signal),
        fetchReport("trends", params, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setSummary(summaryRes.data as SummaryData);
      setSources((sourcesRes.data as { byProvider: SourceEntry[] })?.byProvider ?? []);
      const a = assignmentsRes.data as { bySalesperson: AssignmentEntry[]; unassigned: number };
      setAssignments(a?.bySalesperson ?? []);
      setUnassigned(a?.unassigned ?? 0);
      setActivity(activityRes.data as { today: number; thisWeek: number; thisMonth: number });
      setStatusBreakdown(Array.isArray(statusRes.data) ? statusRes.data : (statusRes.data as { status: StatusEntry[] })?.status ?? []);
      setTrends(Array.isArray(trendsRes.data) ? trendsRes.data : (trendsRes.data as { trends: TrendEntry[] })?.trends ?? []);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(getErrorMessage(err, "Failed to load reports"));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (preset === "custom" && (!customFrom || !customTo || customTo < customFrom)) return;
    const timer = window.setTimeout(() => { void fetchAll(queryParams); }, 0);
    return () => window.clearTimeout(timer);
  }, [preset, customFrom, customTo, queryParams, fetchAll]);

  const handlePeriodChange = (nextPreset: ExportDatePreset) => {
    setPreset(nextPreset);
    if (nextPreset === "all-time") {
      setReportRange(undefined);
      return;
    }
    if (nextPreset === "custom") {
      if (customFrom && customTo && customTo >= customFrom) {
        const resolved = resolveExportDateRange({ preset: "custom", custom: { from: customFrom, to: customTo } });
        setReportRange({
          from: resolved.from!.toISOString(),
          to: new Date(resolved.toExclusive!.getTime() - 1).toISOString(),
        });
      }
      return;
    }
    const resolved = resolveExportDateRange({ preset: nextPreset });
    if (resolved.from && resolved.toExclusive) {
      setReportRange({
        from: resolved.from.toISOString(),
        to: new Date(resolved.toExclusive.getTime() - 1).toISOString(),
      });
    }
  };

  const handleCustomDateChange = (nextFrom: string, nextTo: string) => {
    setCustomFrom(nextFrom);
    setCustomTo(nextTo);
    if (nextFrom && nextTo && nextTo >= nextFrom) {
      const resolved = resolveExportDateRange({ preset: "custom", custom: { from: nextFrom, to: nextTo } });
      setReportRange({
        from: resolved.from!.toISOString(),
        to: new Date(resolved.toExclusive!.getTime() - 1).toISOString(),
      });
    }
  };

  const ins = deriveInsights(sources, assignments, trends);

  const pipelineStatuses = statusBreakdown.filter((s) => LEAD_STATUSES.some((status) => status.value === s.status));
  const pipelineMax = Math.max(...pipelineStatuses.map((s) => s.count), 1);

  const sortedSales = [...assignments].sort((a, b) => b.leadCount - a.leadCount);
  const ownerRows: OwnerRow[] = [
    ...sortedSales.map((entry, index) => ({ id: entry.userId ?? `${entry.userName}-${index}`, name: entry.userName, leadCount: entry.leadCount })),
    ...(unassigned > 0 ? [{ id: "unassigned", name: "Unassigned", leadCount: unassigned, isUnassigned: true }] : []),
  ];
  const ownerColumns: Column<OwnerRow>[] = [
    { key: "name", header: "Salesperson", className: "min-w-48", render: (row) => <span className={row.isUnassigned ? "text-[var(--color-muted)]" : "font-medium text-[var(--color-ink)]"}>{row.name}</span> },
    { key: "leads", header: "Leads Created in Period", headerClassName: "text-right", className: "text-right tabular-nums", render: (row) => row.leadCount },
  ];
  const monthlyColumns: Column<TrendEntry>[] = [
    { key: "month", header: "Month", className: "font-medium", render: (row) => row.month?.slice(0, 7) ?? "-" },
    { key: "total", header: "Leads", headerClassName: "text-right", className: "text-right tabular-nums", render: (row) => row.total },
    { key: "won", header: "Converted", headerClassName: "text-right", className: "text-right tabular-nums", render: (row) => row.won },
    { key: "conversion", header: "Converted / Leads", headerClassName: "text-right", className: "text-right tabular-nums", render: (row) => `${row.total > 0 ? ((row.won / row.total) * 100).toFixed(1) : "0.0"}%` },
  ];

  const activityTypes: { label: string; key: "today" | "thisWeek" | "thisMonth"; color: string }[] = [
    { label: "Today", key: "today", color: "bg-[var(--color-brand)]" },
    { label: "This Week", key: "thisWeek", color: "bg-blue-400" },
    { label: "This Month", key: "thisMonth", color: "bg-sky-300" },
  ];
  const actMax = Math.max(activity?.today ?? 0, activity?.thisWeek ?? 0, activity?.thisMonth ?? 0, 1);

  const customRangeInvalid = preset === "custom" && Boolean(customFrom && customTo && customTo < customFrom);
  const exportParams: Record<string, string> = {};
  if (queryParams.from) exportParams.from = queryParams.from;
  if (queryParams.to) exportParams.to = queryParams.to;
  if (queryParams.source) exportParams.source = queryParams.source;
  if (queryParams.owner) exportParams.owner = queryParams.owner;
  if (queryParams.status) exportParams.status = queryParams.status;

  const reportsHeader = (
    <>
      <Navbar
        title="Reports"
        subtitle="Lead totals and monthly trends use UTC creation dates; activity uses fixed UTC today/7-day/30-day windows with the selected filters."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Report period" value={preset} onChange={(e) => handlePeriodChange(e.target.value as ExportDatePreset)} className="w-40 py-1.5 text-xs">
              <option value="today">Today (UTC)</option>
              <option value="this-week">This Week (UTC)</option>
              <option value="this-month">This Month (UTC)</option>
              <option value="previous-month">Last Month (UTC)</option>
              <option value="last-7-days">Last 7 Days (UTC)</option>
              <option value="last-30-days">Last 30 Days (UTC)</option>
              <option value="all-time">All Time</option>
              <option value="custom">Custom Range</option>
            </Select>
            <Select aria-label="Filter by source" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-36 py-1.5 text-xs">
              <option value="">All sources</option>
              {sourceOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <Select aria-label="Filter by owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-40 py-1.5 text-xs">
              <option value="">All owners</option>
              {salespeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </Select>
            <Select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-32 py-1.5 text-xs">
              <option value="">All statuses</option>
              {LEAD_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <ResyncButton />
            <ExportButton type="reports" params={exportParams} disabledReason={customRangeInvalid || (preset === "custom" && (!customFrom || !customTo)) ? "Choose a valid custom date range before exporting." : undefined} iconOnly />
            <SignOutButton />
          </div>
        }
      />
      {preset === "custom" && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3">
          <div>
            <label htmlFor="report-custom-from" className="mb-1 block text-xs font-medium text-[var(--color-muted)]">From (UTC)</label>
            <Input id="report-custom-from" type="date" value={customFrom} onChange={(e) => handleCustomDateChange(e.target.value, customTo)} className="h-9 text-xs" />
          </div>
          <div>
            <label htmlFor="report-custom-to" className="mb-1 block text-xs font-medium text-[var(--color-muted)]">To (UTC)</label>
            <Input id="report-custom-to" type="date" value={customTo} onChange={(e) => handleCustomDateChange(customFrom, e.target.value)} className="h-9 text-xs" />
          </div>
          {customRangeInvalid && <p role="alert" className="text-xs text-[var(--color-danger)]">The end date must not precede the start date.</p>}
        </div>
      )}
    </>
  );

  if (error) {
    return (
      <>
        {reportsHeader}
        <Card><CardContent className="space-y-4"><ErrorState message={error} /><Button variant="secondary" onClick={() => void fetchAll(queryParams)}>Try again</Button></CardContent></Card>
      </>
    );
  }

  return (
    <>
      {reportsHeader}

      {loading ? (
        <ReportsLoading />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Leads Created</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{summary?.total ?? 0}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{summary?.active ?? 0}</span> new or on hold
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Users size={18} /></div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Converted / Leads Created</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{summary?.conversionRate ?? 0}%</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{summary?.won ?? 0}</span> converted of {summary?.total ?? 0} created
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Target size={18} /></div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Won / Closed Leads</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{summary ? ((summary.won / Math.max(summary.closed, 1)) * 100).toFixed(1) : "0.0"}%</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{summary?.won ?? 0}</span> won of <span className="font-medium text-[var(--color-ink)]">{summary?.closed ?? 0}</span> closed leads
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><TrendingUp size={18} /></div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Open / Leads Created</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{summary?.openRate ?? 0}%</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{summary?.active ?? 0}</span> new or on hold
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><BarChart3 size={18} /></div>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Lead Creation by Month</CardTitle>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">Last 6 months, regardless of the report period.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-[var(--color-brand)] opacity-70" /><span className="text-[10px] font-medium text-[var(--color-muted)]">Created</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /><span className="text-[10px] font-medium text-[var(--color-muted)]">Converted</span></div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trends.length === 0
                ? <CardEmptyState title="No trend data" description="Monthly trend data will appear here as leads are created." />
                : <TrendBarChart data={trends} />
              }
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Lead Sources in Selected Period</CardTitle></CardHeader>
              <CardContent>
                {sources.length === 0
                  ? <CardEmptyState title="No source data" description="Lead source data will appear here once leads are captured." />
                  : <div className="space-y-3">
                      {sources.slice(0, 8).map((s) => (
                        <HorizontalBar key={s.providerName} label={s.providerName} value={s.count} max={sources[0]?.count ?? 1} color="bg-[var(--color-brand)]" />
                      ))}
                    </div>
                }
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Lead Status in Selected Period</CardTitle></CardHeader>
              <CardContent>
                {pipelineStatuses.length === 0
                  ? <CardEmptyState title="No status data" description="Lead status distribution will appear here once leads are created." />
                  : <div className="space-y-3">
                      {pipelineStatuses.map((s) => (
                        <HorizontalBar
                          key={s.status}
                          label={getStatusLabel(s.status)}
                          value={s.count}
                          max={pipelineMax}
                          color={
                            s.status === "NEW" ? "bg-blue-400" :
                            s.status === "CONTACTED" ? "bg-amber-400" :
                            s.status === "QUALIFIED" ? "bg-violet-400" :
                            s.status === "CONVERTED" ? "bg-emerald-400" :
                            "bg-rose-400"
                          }
                        />
                      ))}
                    </div>
                }
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Leads by Current Owner</CardTitle>
              </div>
              <p className="text-xs text-[var(--color-muted)]">Leads created in this period, grouped by their current salesperson.</p>
            </CardHeader>
            <CardContent>
              <DataTable
                rows={ownerRows}
                columns={ownerColumns}
                rowKey={(row) => row.id}
                compact
                emptyTitle="No assignment data"
                emptyDescription="Leads created in this period will appear here by their current owner."
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Calls and WhatsApp</CardTitle>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">Activity entry counts for today, last 7 days, and last 30 days. Separate from the report period.</p>
                  </div>
                  <Activity size={16} className="shrink-0 text-[var(--color-muted)]" />
                </div>
              </CardHeader>
              <CardContent>
                {!activity
                  ? <CardEmptyState title="No activity data" description="Activity data will appear here once actions are recorded." />
                  : (
                    <div className="space-y-4">
                      {activityTypes.map((at) => (
                        <div key={at.key} className="flex items-center gap-3">
                          <span className="w-24 shrink-0 text-xs font-medium text-[var(--color-ink)]">{at.label}</span>
                          <div className="flex-1 h-3 rounded-full bg-[var(--color-surface)] overflow-hidden">
                            <div className={`h-full rounded-full ${at.color} transition-all duration-500`} style={{ width: `${(activity[at.key] / actMax) * 100}%` }} />
                          </div>
                          <span className="w-14 text-right text-sm font-bold text-[var(--color-ink)] tabular-nums">{activity[at.key]}</span>
                        </div>
                      ))}
                    </div>
                  )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Lead Results</CardTitle>
                <p className="text-xs text-[var(--color-muted)]">Last 6 months, regardless of the report period.</p>
              </CardHeader>
              <CardContent>
                {trends.length === 0
                  ? <CardEmptyState title="No monthly data" description="Monthly comparison data will appear once leads span multiple months." />
                  : <DataTable rows={trends} columns={monthlyColumns} rowKey={(row) => row.month} compact />}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ins.bestSource && (
              <InsightsCard icon={<Award size={16} />} label="Most Leads by Source" value={ins.bestSource.providerName} sub={`${ins.bestSource.count} leads created in period`} />
            )}
            {ins.bestSalesperson && (
              <InsightsCard icon={<Star size={16} />} label="Most Leads Assigned" value={ins.bestSalesperson.userName} sub={`${ins.bestSalesperson.leadCount} leads created in period`} />
            )}
            {ins.highestConversionMonth && (
              <InsightsCard icon={<Flame size={16} />} label="Highest Converted Share by Month" value={ins.highestConversionMonth.month} sub={`${((ins.highestConversionMonth.won / Math.max(ins.highestConversionMonth.total, 1)) * 100).toFixed(1)}% of leads created that month`} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
