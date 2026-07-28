"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardEmptyState } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Navbar } from "@/components/shared/navbar";
import { ResyncButton } from "@/components/shared/resync-button";
import { ExportButton } from "@/components/shared/export-button";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";
import { Users, Target, TrendingUp, BarChart3, Activity, Award, Flame, Star } from "lucide-react";

interface SummaryData {
  total: number; active: number; closed: number; won: number; lost: number; deleted: number;
  conversionRate: number; lostRate: number; openRate: number;
}

interface SourceEntry { providerId?: string | null; providerName: string; count: number; connectorId?: string | null; connectorName?: string; connectorType?: string; parserVersion?: string; }

interface AssignmentEntry { userId?: string | null; userName: string; leadCount: number; }

interface StatusEntry { status: string; count: number; }

interface TrendEntry { month: string; total: number; won: number; lost: number; }

interface Insights {
  bestSource: SourceEntry | null;
  bestSalesperson: AssignmentEntry | null;
  highestConversionMonth: TrendEntry | null;
  totalQualifiedRate: number;
}

function fetchReport(type: string, days: string, signal?: AbortSignal): Promise<{ data: unknown }> {
  const params = new URLSearchParams({ type });
  if (days !== "all") {
    const d = parseInt(days);
    const to = new Date().toISOString();
    const from = new Date(Date.now() - d * 86400000).toISOString();
    params.set("from", from);
    params.set("to", to);
  }
  return fetch(`/api/reports?${params}`, { signal }).then((r) => { if (!r.ok) throw new Error(`Failed: ${r.statusText}`); return r.json(); });
}

function deriveInsights(
  summary: SummaryData | null,
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
    totalQualifiedRate: summary ? summary.conversionRate : 0,
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

export function AdminReports() {
  const [days, setDays] = useState("30");
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

  const fetchAll = useCallback(async (d: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, sourcesRes, assignmentsRes, activityRes, statusRes, trendsRes] = await Promise.all([
        fetchReport("summary", d, controller.signal),
        fetchReport("sources", d, controller.signal),
        fetchReport("assignments", d, controller.signal),
        fetchReport("activity", d, controller.signal),
        fetchReport("status", d, controller.signal),
        fetchReport("trends", d, controller.signal),
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
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(days); }, [days, fetchAll]);

  if (error) {
    return (
      <>
        <Navbar title="Reports" actions={<SignOutButton />} />
        <Card><CardContent><p className="text-red-600">{error}</p></CardContent></Card>
      </>
    );
  }

  const ins = deriveInsights(summary, sources, assignments, trends);

  const pipelineStatuses = statusBreakdown.filter((s) => ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"].includes(s.status));
  const pipelineMax = Math.max(...pipelineStatuses.map((s) => s.count), 1);

  const sortedSales = [...assignments].sort((a, b) => b.leadCount - a.leadCount);

  const activityTypes: { label: string; key: "today" | "thisWeek" | "thisMonth"; color: string }[] = [
    { label: "Today", key: "today", color: "bg-[var(--color-brand)]" },
    { label: "This Week", key: "thisWeek", color: "bg-blue-400" },
    { label: "This Month", key: "thisMonth", color: "bg-sky-300" },
  ];
  const actMax = Math.max(activity?.today ?? 0, activity?.thisWeek ?? 0, activity?.thisMonth ?? 0, 1);

  const exportParams: Record<string, string> | undefined = days !== "all"
    ? { from: new Date(Date.now() - parseInt(days) * 86400000).toISOString(), to: new Date().toISOString() }
    : undefined;

  return (
    <>
      <Navbar
        title="Reports"
        actions={
          <>
            <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-32 py-1.5 text-xs">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
              <option value="all">All time</option>
            </Select>
            <ResyncButton />
            <ExportButton type="reports" params={exportParams} iconOnly />
            <SignOutButton />
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Total Leads</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{summary?.total ?? 0}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{summary?.active ?? 0}</span> active in pipeline
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Users size={18} /></div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Qualified Rate</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{summary?.conversionRate ?? 0}%</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{summary?.won ?? 0}</span> won of {summary?.total ?? 0}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Target size={18} /></div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Conversion Rate</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{summary ? ((summary.won / Math.max(summary.closed, 1)) * 100).toFixed(1) : "0.0"}%</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{summary?.won ?? 0}</span> won of <span className="font-medium text-[var(--color-ink)]">{summary?.closed ?? 0}</span> closed
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><TrendingUp size={18} /></div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Open Rate</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{summary?.openRate ?? 0}%</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-ink)]">{summary?.active ?? 0}</span> leads currently open
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><BarChart3 size={18} /></div>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lead Acquisition Trend</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-[var(--color-brand)] opacity-70" /><span className="text-[10px] font-medium text-[var(--color-muted)]">Created</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /><span className="text-[10px] font-medium text-[var(--color-muted)]">Won</span></div>
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
              <CardHeader><CardTitle>Lead Sources</CardTitle></CardHeader>
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
              <CardHeader><CardTitle>Lead Status</CardTitle></CardHeader>
              <CardContent>
                {pipelineStatuses.length === 0
                  ? <CardEmptyState title="No status data" description="Lead status distribution will appear here once leads are created." />
                  : <div className="space-y-3">
                      {pipelineStatuses.map((s) => (
                        <HorizontalBar
                          key={s.status}
                          label={s.status}
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
                <CardTitle>Sales Performance</CardTitle>
                <span className="text-xs text-[var(--color-muted)]">Best performers first</span>
              </div>
            </CardHeader>
            <CardContent>
              {sortedSales.length === 0 && !unassigned
                ? <CardEmptyState title="No assignment data" description="Sales performance data will appear once leads are assigned to salespeople." />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border)]">
                          <th className="text-left pb-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wider">Salesperson</th>
                          <th className="text-right pb-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wider">Assigned</th>
                          <th className="text-right pb-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wider">Won</th>
                          <th className="text-right pb-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wider">Conversion %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {sortedSales.map((s, i) => {
                          const pct = s.leadCount > 0 && summary ? ((summary.won / Math.max(summary.total, 1)) * 100).toFixed(1) : "-";
                          return (
                            <tr key={s.userId ?? i} className="hover:bg-[var(--color-surface)] transition-colors">
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-bold text-[var(--color-ink)]">
                                    {s.userName.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-medium text-[var(--color-ink)]">{s.userName}</span>
                                </div>
                              </td>
                              <td className="py-3 text-right tabular-nums">{s.leadCount}</td>
                              <td className="py-3 text-right tabular-nums">{summary?.won ?? "-"}</td>
                              <td className="py-3 text-right tabular-nums">{pct}</td>
                            </tr>
                          );
                        })}
                        {unassigned > 0 && (
                          <tr className="hover:bg-[var(--color-surface)] transition-colors">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">?</div>
                                <span className="text-[var(--color-muted)] italic">Unassigned</span>
                              </div>
                            </td>
                            <td className="py-3 text-right tabular-nums">{unassigned}</td>
                            <td className="py-3 text-right tabular-nums">-</td>
                            <td className="py-3 text-right tabular-nums">-</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Activity Overview</CardTitle>
                  <Activity size={16} className="text-[var(--color-muted)]" />
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
              <CardHeader><CardTitle>Monthly Comparison</CardTitle></CardHeader>
              <CardContent>
                {trends.length === 0
                  ? <CardEmptyState title="No monthly data" description="Monthly comparison data will appear once leads span multiple months." />
                  : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)]">
                            <th className="text-left pb-2.5 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wider">Month</th>
                            <th className="text-right pb-2.5 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wider">Leads</th>
                            <th className="text-right pb-2.5 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wider">Won</th>
                            <th className="text-right pb-2.5 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wider">Conv. %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {trends.map((t) => {
                            const conv = t.total > 0 ? ((t.won / t.total) * 100).toFixed(1) : "0.0";
                            const monthLabel = t.month?.length >= 7 ? t.month.slice(0, 7) : t.month;
                            return (
                              <tr key={t.month} className="hover:bg-[var(--color-surface)] transition-colors">
                                <td className="py-2.5 pr-4 font-medium text-[var(--color-ink)]">{monthLabel}</td>
                                <td className="py-2.5 text-right tabular-nums">{t.total}</td>
                                <td className="py-2.5 text-right tabular-nums">{t.won}</td>
                                <td className="py-2.5 text-right tabular-nums">{conv}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ins.bestSource && (
              <InsightsCard icon={<Award size={16} />} label="Highest Performing Source" value={ins.bestSource.providerName} sub={`${ins.bestSource.count} leads`} />
            )}
            {ins.bestSalesperson && (
              <InsightsCard icon={<Star size={16} />} label="Best Salesperson" value={ins.bestSalesperson.userName} sub={`${ins.bestSalesperson.leadCount} assigned`} />
            )}
            {ins.highestConversionMonth && (
              <InsightsCard icon={<Flame size={16} />} label="Best Conversion Month" value={ins.highestConversionMonth.month} sub={`${((ins.highestConversionMonth.won / Math.max(ins.highestConversionMonth.total, 1)) * 100).toFixed(1)}% conversion`} />
            )}
            <InsightsCard icon={<Target size={16} />} label="Overall Qualified Rate" value={`${summary?.conversionRate ?? 0}%`} sub={`${summary?.won ?? 0} won of ${summary?.total ?? 0}`} />
          </div>
        </div>
      )}
    </>
  );
}
