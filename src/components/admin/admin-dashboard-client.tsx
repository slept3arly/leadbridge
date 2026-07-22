"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { formatDate } from "@/lib/utils";

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
}

export function AdminDashboardClient({ data }: { data: DashboardData }) {
  const healthColumns: Column<DashboardData["connectorHealth"][0]>[] = [
    { key: "name", header: "Connector", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "type", header: "Type", render: (c) => c.type },
    { key: "health", header: "Health", render: (c) => {
      const tone = c.healthStatus === "HEALTHY" ? "bg-green-100 text-green-800" : c.healthStatus === "WARNING" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";
      return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{c.healthStatus}</span>;
    }},
    { key: "status", header: "Status", render: (c) => c.isRunning ? "Running" : c.enabled ? "Enabled" : "Disabled" },
  ];

  const activityColumns: Column<DashboardData["recentActivity"][0]>[] = [
    { key: "actor", header: "Actor", render: (a) => a.actorName },
    { key: "message", header: "Activity", render: (a) => a.message },
    { key: "lead", header: "Lead", render: (a) => a.leadName },
    { key: "time", header: "Time", render: (a) => formatDate(a.createdAt) },
  ];

  const syncColumns: Column<DashboardData["recentSyncs"][0]>[] = [
    { key: "connector", header: "Connector", render: (s) => s.connectorName },
    { key: "status", header: "Status", render: (s) => <Badge label={s.status} /> },
    { key: "seen", header: "Seen", render: (s) => s.recordsSeen.toString() },
    { key: "created", header: "Created", render: (s) => s.recordsCreated.toString() },
    { key: "time", header: "Started", render: (s) => formatDate(s.startedAt) },
  ];

  const statusCols: Column<{ status: string; count: number }>[] = [
    { key: "status", header: "Status", render: (r) => <Badge label={r.status} /> },
    { key: "count", header: "Count", render: (r) => r.count.toString() },
  ];

  const sourceCols: Column<{ providerId: string | null; providerName: string; count: number }>[] = [
    { key: "name", header: "Provider", render: (r) => r.providerName },
    { key: "count", header: "Leads", render: (r) => r.count.toString() },
  ];

  const loadCols: Column<{ userId: string | null; userName: string; leadCount: number }>[] = [
    { key: "user", header: "Sales Person", render: (r) => r.userName },
    { key: "count", header: "Leads", render: (r) => r.leadCount.toString() },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <DataTable rows={data.charts.statusBreakdown} columns={statusCols} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lead Sources</CardTitle></CardHeader>
          <CardContent>
            <DataTable rows={data.charts.leadSources.byProvider} columns={sourceCols} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Salesperson Load</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={data.charts.salespersonLoad} columns={loadCols} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connector Health</CardTitle>
        </CardHeader>
        <CardContent>
          {data.connectorHealth.length ? <DataTable rows={data.connectorHealth} columns={healthColumns} /> : <p className="text-sm text-[var(--color-muted)]">No connectors configured.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <DataTable rows={data.recentActivity} columns={activityColumns} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Syncs</CardTitle></CardHeader>
          <CardContent>
            <DataTable rows={data.recentSyncs} columns={syncColumns} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pending Work</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <p className="text-sm text-[var(--color-muted)]">Parser Requests</p>
                <p className="text-2xl font-bold">{data.pending.parserRequests}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-muted)]">Unmatched Emails</p>
                <p className="text-2xl font-bold">{data.pending.unmatchedEmails}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
