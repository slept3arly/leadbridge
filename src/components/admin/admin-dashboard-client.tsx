"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardEmptyState } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatTimeAgo } from "@/lib/utils";

interface DashboardData {
  cards: { totalLeads: number; activeLeads: number; newToday: number; won: number; lost: number; unassigned: number };
  charts: {
    statusBreakdown: { status: string; count: number }[];
    leadSources: { byProvider: { providerId: string | null; providerName: string; count: number }[]; byConnector: { connectorId: string | null; connectorName: string; connectorType: string; count: number }[] };
    salespersonLoad: { userId: string | null; userName: string; leadCount: number }[];
  };
  connectorHealth: { id: string; name: string; type: string; healthStatus: string; status: string; isRunning: boolean; enabled: boolean }[];
  recentActivity: { id: string; type: string; message: string; actorName: string; leadId: string; leadName: string; leadNumber: string; createdAt: string }[];
  recentSyncs: { id: string; connectorName: string; status: string; recordsSeen: number; recordsCreated: number; startedAt: string; completedAt: string | null }[];
  pending: { parserRequests: number; unmatchedEmails: number };
  insights: {
    newToday: number;
    trend: number;
    unassigned: number;
    inactiveConnectors: number;
    recentFailedSyncs: number;
    duplicateEmails: number;
    inactiveUsers: number;
    unhealthyConnectors: number;
  };
}

const STATUS_BADGE_MAP: Record<string, string> = {
  NEW: "NEW", ON_HOLD: "ON_HOLD", CONVERTED: "CONVERTED", LOST: "LOST", SPAM: "SPAM",
};

const todayISO = new Date().toISOString().slice(0, 10);

export function AdminDashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const i = data.insights;

  return (
    <div className="space-y-8">

      {/* Insights */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--color-ink)]">Insights</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <InsightCard
            title="Today's New Leads"
            count={i.newToday}
            description={i.trend > 0 ? `+${i.trend} vs yesterday` : i.trend < 0 ? `${i.trend} vs yesterday` : "Same as yesterday"}
            href={`/admin/leads?dateFrom=${todayISO}`}
            highlight={i.newToday > 0}
          />
          <InsightCard
            title="Unassigned Leads"
            count={i.unassigned}
            description="Requiring sales assignment"
            href="/admin/leads?filter.assignedUserId=unassigned"
            highlight={i.unassigned > 0}
          />
          <InsightCard
            title="Failed Syncs"
            count={i.recentFailedSyncs}
            description="In last 24 hours"
            href={i.recentFailedSyncs > 0 ? "/admin/connectors" : undefined}
            highlight={i.recentFailedSyncs > 0}
          />
          <InsightCard
            title="Unhealthy Connectors"
            count={i.unhealthyConnectors}
            description="Requiring attention"
            href={i.unhealthyConnectors > 0 ? "/admin/connectors" : undefined}
            highlight={i.unhealthyConnectors > 0}
          />
          <InsightCard
            title="Inactive Connectors"
            count={i.inactiveConnectors}
            description="Disabled in settings"
            href={i.inactiveConnectors > 0 ? "/admin/connectors" : undefined}
            highlight={i.inactiveConnectors > 0}
          />
          <InsightCard
            title="Parser Requests"
            count={data.pending.parserRequests}
            description="Awaiting parser mapping"
            href={data.pending.parserRequests > 0 ? "/admin/providers" : undefined}
            highlight={data.pending.parserRequests > 0}
          />
          <InsightCard
            title="Unmatched Emails"
            count={data.pending.unmatchedEmails}
            description="Requiring manual review"
            href={data.pending.unmatchedEmails > 0 ? "/admin/providers" : undefined}
            highlight={data.pending.unmatchedEmails > 0}
          />
          <InsightCard
            title="Inactive Users"
            count={i.inactiveUsers}
            description="Accounts disabled"
            href={i.inactiveUsers > 0 ? "/admin/users" : undefined}
            highlight={i.inactiveUsers > 0}
          />
        </div>
      </section>

      {/* Pipeline */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Pipeline</h2>
          <Link href="/admin/leads" className="text-xs font-medium text-[var(--color-brand)] hover:underline">View All Leads</Link>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {data.charts.statusBreakdown.map((r) => (
            <Link
              key={r.status}
              href={`/admin/leads?filter.status=${r.status}`}
              className="block"
            >
              <Card className="cursor-pointer transition hover:shadow-md p-4">
                <div className="flex items-center justify-between">
                  <Badge label={STATUS_BADGE_MAP[r.status] ?? r.status} />
                  <span className="text-2xl font-semibold text-[var(--color-ink)]">{r.count}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Admin Work Queue */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--color-ink)]">Admin Work Queue</h2>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Item</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Count</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Description</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Action</th>
              </tr>
            </thead>
            <tbody>
              <WorkQueueRow
                label="Leads Awaiting Assignment"
                count={i.unassigned}
                description="Not yet assigned to a salesperson"
                href="/admin/leads?filter.assignedUserId=unassigned"
              />
              <WorkQueueRow
                label="Failed Connector Syncs"
                count={i.recentFailedSyncs}
                description="Sync runs that failed in the last 24h"
                href={i.recentFailedSyncs > 0 ? "/admin/connectors" : undefined}
              />
              <WorkQueueRow
                label="Parser Requests"
                count={data.pending.parserRequests}
                description="Incoming data awaiting parser mapping"
                href={data.pending.parserRequests > 0 ? "/admin/providers" : undefined}
              />
              <WorkQueueRow
                label="Unmatched Emails"
                count={data.pending.unmatchedEmails}
                description="Emails not linked to any lead"
                href={data.pending.unmatchedEmails > 0 ? "/admin/providers" : undefined}
              />
              <WorkQueueRow
                label="Unhealthy Connectors"
                count={i.unhealthyConnectors}
                description="Connectors with non-healthy status"
                href={i.unhealthyConnectors > 0 ? "/admin/connectors" : undefined}
              />
              <WorkQueueRow
                label="Inactive Users"
                count={i.inactiveUsers}
                description="User accounts currently disabled"
                href={i.inactiveUsers > 0 ? "/admin/users" : undefined}
              />
            </tbody>
          </table>
        </Card>
      </section>

      {/* Connector Health */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Connector Health</h2>
          {data.connectorHealth.length > 0 && (
            <Link href="/admin/connectors" className="text-xs font-medium text-[var(--color-brand)] hover:underline">View All</Link>
          )}
        </div>
        {data.connectorHealth.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.connectorHealth.map((c) => (
              <Link key={c.id} href="/admin/connectors" className="block">
                <Card className="cursor-pointer transition hover:shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-ink)]">{c.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">{c.type}</p>
                    </div>
                    <HealthBadge status={c.healthStatus} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {c.isRunning ? "Running" : c.enabled ? "Enabled" : "Disabled"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <CardEmptyState description="No connectors configured." />
        )}
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--color-ink)]">Recent Activity</h2>
        {data.recentActivity.length > 0 ? (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Time</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Actor</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Activity</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Lead</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--color-border)] transition hover:bg-slate-50/50 last:border-b-0">
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)] whitespace-nowrap">{formatTimeAgo(a.createdAt)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--color-ink)]">{a.actorName}</td>
                    <td className="px-4 py-3 text-sm text-[var(--color-ink)]">{a.message}</td>
                    <td className="px-4 py-3 text-sm text-[var(--color-muted)]">{a.leadName}{a.leadNumber ? ` (#${a.leadNumber})` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <CardEmptyState description="No recent activity." />
        )}
      </section>

      {/* Recent Syncs */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--color-ink)]">Recent Syncs</h2>
        {data.recentSyncs.length > 0 ? (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Connector</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Seen</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Created</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Started</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSyncs.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--color-border)] transition hover:bg-slate-50/50 last:border-b-0">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--color-ink)]">{s.connectorName}</td>
                    <td className="px-4 py-3"><Badge label={s.status} /></td>
                    <td className="px-4 py-3 text-sm text-[var(--color-ink)]">{s.recordsSeen}</td>
                    <td className="px-4 py-3 text-sm text-[var(--color-ink)]">{s.recordsCreated}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)] whitespace-nowrap">{formatDateTime(s.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <CardEmptyState description="No recent syncs." />
        )}
      </section>

    </div>
  );
}

function InsightCard({
  title,
  count,
  description,
  href,
  highlight,
}: {
  title: string;
  count: number;
  description: string;
  href?: string;
  highlight?: boolean;
}) {
  const inner = (
    <Card className={`p-4 transition ${href ? "cursor-pointer hover:shadow-md" : ""} ${highlight ? "ring-1 ring-[var(--color-brand)]/20" : ""}`}>
      <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{count}</p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{description}</p>
    </Card>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

function WorkQueueRow({
  label,
  count,
  description,
  href,
}: {
  label: string;
  count: number;
  description: string;
  href?: string;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => href && router.push(href)}
      className={`border-b border-[var(--color-border)] last:border-b-0 ${href ? "cursor-pointer transition hover:bg-slate-50/50" : ""}`}
    >
      <td className="px-4 py-3 text-sm font-medium text-[var(--color-ink)]">{label}</td>
      <td className="px-4 py-3"><span className="text-lg font-semibold text-[var(--color-ink)]">{count}</span></td>
      <td className="px-4 py-3 text-sm text-[var(--color-muted)]">{description}</td>
      <td className="px-4 py-3">
        {href ? (
          <span className="text-xs font-medium text-[var(--color-brand)] hover:underline">Resolve &rarr;</span>
        ) : (
          <span className="text-xs text-[var(--color-muted)]">No action needed</span>
        )}
      </td>
    </tr>
  );
}

function HealthBadge({ status }: { status: string }) {
  const tone = status === "HEALTHY"
    ? "bg-emerald-50 text-emerald-700"
    : status === "WARNING"
      ? "bg-amber-50 text-amber-700"
      : "bg-rose-50 text-rose-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}
