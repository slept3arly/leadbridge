"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CardEmptyState } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { formatDateTime, formatTimeAgo } from "@/lib/utils";

type StatusMetric = { status: string; count: number };
type PriorityMetric = { priority: string; count: number };
type RecentActivity = {
  id: string;
  type: string;
  message: string;
  actorName: string;
  leadId: string;
  leadName: string;
  leadNumber: string;
  createdAt: string;
};
type RecentSync = {
  id: string;
  connectorName: string;
  status: string;
  recordsSeen: number;
  recordsCreated: number;
  startedAt: string;
  completedAt: string | null;
};
type SalespersonPerformance = {
  userId: string;
  name: string;
  assignedLeads: number;
  workedToday: number;
  calls: number;
  whatsapp: number;
  responses: number;
};

interface DashboardData {
  cards: { totalLeads: number; newToday: number; convertedLeads: number };
  charts: { statusBreakdown: StatusMetric[]; priorityBreakdown: PriorityMetric[] };
  workload: {
    assigned: number;
    unassigned: number;
    activeSalesUsers: number;
    pendingFollowUps: number;
    overdueFollowUps: number;
  };
  activity: { workedLeads: number; callsLogged: number; whatsappLogged: number; responseEntries: number };
  connectorHealth: { id: string; name: string; type: string; healthStatus: string; status: string; isRunning: boolean; enabled: boolean }[];
  recentActivity: RecentActivity[];
  recentSyncs: RecentSync[];
  salespersonPerformance: SalespersonPerformance[];
  renderedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  ON_HOLD: "On Hold",
  CONVERTED: "Converted",
  LOST: "Lost",
  SPAM: "Spam",
};

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const ACTIVITY_COLUMNS: Column<RecentActivity>[] = [
  {
    key: "time",
    header: "Time",
    className: "whitespace-nowrap text-xs text-[var(--color-muted)]",
    render: (row) => formatTimeAgo(row.createdAt),
  },
  {
    key: "actor",
    header: "Actor",
    className: "font-medium text-[var(--color-ink)]",
    render: (row) => row.actorName,
  },
  {
    key: "activity",
    header: "Activity",
    render: (row) => <span className="text-[var(--color-ink)]">{row.message}</span>,
  },
  {
    key: "lead",
    header: "Lead",
    className: "text-[var(--color-muted)]",
    render: (row) => `${row.leadName}${row.leadNumber ? ` (#${row.leadNumber})` : ""}`,
  },
];

const SYNC_COLUMNS: Column<RecentSync>[] = [
  { key: "connector", header: "Connector", className: "font-medium", render: (row) => row.connectorName },
  { key: "status", header: "Status", render: (row) => <Badge label={row.status} /> },
  { key: "seen", header: "Records Seen", render: (row) => row.recordsSeen },
  { key: "created", header: "Leads Added", render: (row) => row.recordsCreated },
  {
    key: "started",
    header: "Started",
    className: "whitespace-nowrap text-xs text-[var(--color-muted)]",
    render: (row) => formatDateTime(row.startedAt),
  },
];

const SALESPERFORMANCE_COLUMNS: Column<SalespersonPerformance>[] = [
  { key: "salesperson", header: "Salesperson", className: "whitespace-nowrap font-medium text-[var(--color-ink)]", render: (row) => row.name },
  { key: "assignedLeads", header: "Assigned Leads", className: "whitespace-nowrap", render: (row) => row.assignedLeads },
  { key: "workedToday", header: "Worked Today", className: "whitespace-nowrap", render: (row) => row.workedToday },
  { key: "calls", header: "Calls", className: "whitespace-nowrap", render: (row) => row.calls },
  { key: "whatsapp", header: "WhatsApp", className: "whitespace-nowrap", render: (row) => row.whatsapp },
  { key: "responses", header: "Responses", className: "whitespace-nowrap", render: (row) => row.responses },
  {
    key: "viewLeads",
    header: "View Leads",
    className: "whitespace-nowrap",
    render: (row) => (
      <Link
        href={`/admin/leads?filter.assignedUserId=${encodeURIComponent(row.userId)}`}
        className="font-medium text-[var(--color-brand)] hover:underline"
      >
        View Leads
      </Link>
    ),
  },
];

function SectionHeading({ title, description, href, linkLabel }: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className="shrink-0 text-xs font-medium text-[var(--color-brand)] hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function healthLabel(status: string) {
  if (status === "HEALTHY") return "Healthy";
  if (status === "WARNING") return "Needs attention";
  return "Unavailable";
}

export function AdminDashboardClient({ data }: { data: DashboardData }) {
  const [hydrated, setHydrated] = useState(false);
  const todayISO = data.renderedAt.slice(0, 10);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const recentActivityColumns = hydrated
    ? ACTIVITY_COLUMNS
    : ACTIVITY_COLUMNS.map((column) => column.key === "time"
      ? { ...column, render: (row: RecentActivity) => formatTimeAgo(row.createdAt, "UTC", data.renderedAt) }
      : column);
  const recentSyncColumns = hydrated
    ? SYNC_COLUMNS
    : SYNC_COLUMNS.map((column) => column.key === "started"
      ? { ...column, render: (row: RecentSync) => formatDateTime(row.startedAt, "-", "UTC") }
      : column);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading title="Lead Overview" description="Lead totals for the whole CRM." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard title="Total Leads" count={data.cards.totalLeads} description="All leads in the CRM" href="/admin/leads" />
          <KpiCard title="New Leads Today" count={data.cards.newToday} description="Leads added today" href={`/admin/leads?dateFrom=${todayISO}`} />
          <KpiCard title="Converted Leads" count={data.cards.convertedLeads} description="Leads marked as converted" href="/admin/leads?filter.status=CONVERTED" />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Lead Status and Priority"
          description="Counts include archived leads."
          href="/admin/leads"
          linkLabel="View All Leads"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.charts.statusBreakdown.map(({ status, count }) => (
            <KpiCard
              key={status}
              title={STATUS_LABELS[status] ?? status}
              count={count}
              description={status === "NEW"
                ? "Leads not yet moved to another status"
                : status === "ON_HOLD"
                  ? "Leads waiting for a decision"
                  : `Leads marked ${STATUS_LABELS[status]?.toLowerCase() ?? status.toLowerCase()}`}
              href={`/admin/leads?filter.status=${status}`}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.charts.priorityBreakdown.map(({ priority, count }) => (
            <KpiCard
              key={priority}
              title={PRIORITY_LABELS[priority] ?? priority}
              count={count}
              description={priority === "URGENT"
                ? "Leads needing quick action"
                : `${PRIORITY_LABELS[priority]} priority leads`}
              href={`/admin/leads?filter.priority=${priority}`}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title="Lead Assignments and Follow-ups" description="Assignment and follow-up counts for the whole CRM." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard title="Assigned Leads" count={data.workload.assigned} description="Leads assigned to a salesperson" href="/admin/leads" />
          <KpiCard title="Unassigned Leads" count={data.workload.unassigned} description="Leads waiting for assignment" href="/admin/leads?filter.assignedUserId=unassigned" />
          <KpiCard title="Salespeople" count={data.workload.activeSalesUsers} description="Active sales accounts" href="/admin/users" />
          <KpiCard title="Pending Follow-ups" count={data.workload.pendingFollowUps} description="Follow-ups not completed" href="/admin/leads" />
          <KpiCard title="Overdue Follow-ups" count={data.workload.overdueFollowUps} description="Follow-ups past their due time" href="/admin/leads" />
        </div>
      </section>

      <section>
        <SectionHeading title="Sales Activity Today" description="Activity for today across the CRM. Worked Leads counts different leads; the other cards count records." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard title="Leads Worked" count={data.activity.workedLeads} description="Different leads contacted today" />
          <KpiCard title="Calls" count={data.activity.callsLogged} description="Calls recorded today" />
          <KpiCard title="WhatsApp" count={data.activity.whatsappLogged} description="WhatsApp activity recorded today" />
          <KpiCard title="Responses" count={data.activity.responseEntries} description="Calls answered or WhatsApp replies" />
        </div>
      </section>

      <section>
        <SectionHeading title="Salesperson Performance" description="Lead ownership and activity for each active salesperson today." />
        <DataTable
          rows={data.salespersonPerformance}
          columns={SALESPERFORMANCE_COLUMNS}
          rowKey={(row) => row.userId}
          emptyTitle="No active salespeople"
          emptyDescription="Active sales accounts will appear here."
        />
      </section>

      <section>
        <SectionHeading
          title="Connectors and Recent Syncs"
          description="Connector status and the latest sync attempts."
          href="/admin/connectors"
          linkLabel="View Connectors"
        />
        {data.connectorHealth.length > 0 ? (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.connectorHealth.map((connector) => (
              <Link key={connector.id} href="/admin/connectors" className="block">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-xs transition hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-ink)]">{connector.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">{connector.type}</p>
                    </div>
                    <Badge label={healthLabel(connector.healthStatus)} toneKey={connector.healthStatus} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {connector.isRunning ? "Running" : connector.enabled ? "Enabled" : "Disabled"}
                    {` · ${connector.status}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]">
            <CardEmptyState description="No connectors configured." />
          </div>
        )}
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">Latest Syncs</h3>
        <DataTable
          rows={data.recentSyncs}
          columns={recentSyncColumns}
          rowKey={(row) => row.id}
          emptyTitle="No recent syncs"
          emptyDescription="Connector sync attempts will appear here."
        />
      </section>

      <section>
        <SectionHeading title="Recent Activity" description="The latest changes made to leads." />
        <DataTable
          rows={data.recentActivity}
          columns={recentActivityColumns}
          rowKey={(row) => row.id}
          emptyTitle="No recent activity"
          emptyDescription="CRM activity will appear here as users work with leads."
        />
      </section>
    </div>
  );
}
