"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardEmptyState } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Navbar } from "@/components/shared/navbar";
import { ResyncButton } from "@/components/shared/resync-button";
import { ExportButton } from "@/components/shared/export-button";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";
import { getErrorMessage } from "@/lib/get-error-message";
import { getStatusLabel } from "@/lib/lead-constants";
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

type ReportRange = { from: string; to: string } | undefined;

function fetchReport(type: string, range: ReportRange, signal?: AbortSignal): Promise<{ data: unknown }> {
  const params = new URLSearchParams({ type });
  if (range) {
    params.set("from", range.from);
    params.set("to", range.to);
  }
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

export function AdminReports({ initialRange }: { initialRange: { from: string; to: string } }) {
  const [days, setDays] = useState("30");
  const [reportRange, setReportRange] = useState<ReportRange>(initialRange);
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

  const fetchAll = useCallback(async (range: ReportRange) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, sourcesRes, assignmentsRes, activityRes, statusRes, trendsRes] = await Promise.all([
        fetchReport("summary", range, controller.signal),
        fetchReport("sources", range, controller.signal),
        fetchReport("assignments", range, controller.signal),
        fetchReport("activity", range, controller.signal),
        fetchReport("status", range, controller.signal),
        fetchReport("trends", range, controller.signal),
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
    const timer = window.setTimeout(() => { void fetchAll(reportRange); }, 0);
    return () => window.clearTimeout(timer);
  }, [reportRange, fetchAll]);

  const handlePeriodChange = (value: string) => {
    setDays(value);
    if (value === "all") {
      setReportRange(undefined);
      return;
    }
    const to = new Date();
    const from = new Date(to.getTime() - Number(value) * 86400000);
    setReportRange({ from: from.toISOString(), to: to.toISOString() });
  };

  const ins = deriveInsights(sources, assignments, trends);

  const pipelineStatuses = statusBreakdown.filter((s) => ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"].includes(s.status));
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

  const exportParams = reportRange;

  const reportsHeader = (
    <Navbar
      title="Reports"
      subtitle="Lead totals use creation dates; activity uses its own time periods."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Report period" value={days} onChange={(e) => handlePeriodChange(e.target.value)} className="w-36 py-1.5 text-xs">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
            <option value="all">All time</option>
          </Select>
          <ResyncButton />
          <ExportButton type="reports" params={exportParams} iconOnly />
          <SignOutButton />
        </div>
      }
    />
  );

  if (error) {
    return (
      <>
        {reportsHeader}
        <Card><CardContent className="space-y-4"><ErrorState message={error} /><Button variant="secondary" onClick={() => void fetchAll(reportRange)}>Try again</Button></CardContent></Card>
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
