"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/data-table";
import { LoadingSpinner } from "@/components/ui/loading";

type ReportType = "summary" | "sources" | "assignments" | "activity" | "trends" | "status";

export function AdminReports() {
  const [activeTab, setActiveTab] = useState<ReportType>("summary");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("30");
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchReport = useCallback(async (type: ReportType) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({ type });
      if (dateRange !== "all") {
        const days = parseInt(dateRange);
        const to = new Date().toISOString();
        const from = new Date(Date.now() - days * 86400000).toISOString();
        params.set("from", from);
        params.set("to", to);
      }
      const res = await fetch(`/api/reports?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Failed to load report: ${res.statusText}`);
      const json = await res.json();
      if (requestId !== requestIdRef.current) return;
      setData(json.data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab, fetchReport]);

  const tabs: { key: ReportType; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "sources", label: "Sources" },
    { key: "assignments", label: "Assignments" },
    { key: "activity", label: "Activity" },
    { key: "status", label: "Status Breakdown" },
    { key: "trends", label: "Monthly Trends" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "primary" : "secondary"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
        <div className="ml-auto">
          <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="w-40">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
            <option value="all">All time</option>
          </Select>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><LoadingSpinner /></div>}
      {error && <Card><CardContent><p className="text-red-600">{error}</p></CardContent></Card>}

      {data && !loading && (
        <>
          {activeTab === "summary" && <SummaryReport data={data} />}
          {activeTab === "sources" && <SourcesReport data={data} />}
          {activeTab === "assignments" && <AssignmentsReport data={data} />}
          {activeTab === "activity" && <ActivityReport data={data} />}
          {activeTab === "status" && <StatusReport data={data} />}
          {activeTab === "trends" && <TrendsReport data={data} />}
        </>
      )}
    </div>
  );
}

function SummaryReport({ data }: { data: any }) {
  const summary = data || {};
  const cards = [
    { label: "Total Leads", value: summary.total ?? 0 },
    { label: "Active", value: summary.active ?? 0 },
    { label: "Closed", value: summary.closed ?? 0 },
    { label: "Won", value: summary.won ?? 0 },
    { label: "Lost", value: summary.lost ?? 0 },
    { label: "Deleted", value: summary.deleted ?? 0 },
    { label: "Conversion Rate", value: `${((summary.conversionRate || 0) * 100).toFixed(1)}%` },
    { label: "Lost Rate", value: `${((summary.lostRate || 0)).toFixed(1)}%` },
    { label: "Open Rate", value: `${((summary.openRate || 0)).toFixed(1)}%` },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <p className="text-sm text-[var(--color-muted)]">{card.label}</p>
          <p className="mt-2 text-2xl font-bold">{card.value}</p>
        </Card>
      ))}
    </div>
  );
}

function SourcesReport({ data }: { data: any }) {
  const sources = data || {};
  const byProvider = Array.isArray(sources.byProvider) ? sources.byProvider : [];
  const byConnector = Array.isArray(sources.byConnector) ? sources.byConnector : [];
  const byParser = Array.isArray(sources.byParser) ? sources.byParser : [];

  const byProviderColumns: Column<{ providerName: string; count: number }>[] = [
    { key: "name", header: "Source", render: (r) => r.providerName || "Unknown" },
    { key: "count", header: "Leads", render: (r) => (r.count ?? 0).toString() },
  ];
  const byConnectorColumns: Column<{ connectorName: string; count: number }>[] = [
    { key: "connector", header: "Connector", render: (r) => r.connectorName || "Unknown" },
    { key: "count", header: "Leads", render: (r) => (r.count ?? 0).toString() },
  ];
  const byParserColumns: Column<{ parserVersion: string; count: number }>[] = [
    { key: "parser", header: "Parser Version", render: (r) => r.parserVersion || "Unknown" },
    { key: "count", header: "Leads", render: (r) => (r.count ?? 0).toString() },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>By Provider</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={byProvider} columns={byProviderColumns} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>By Connector</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={byConnector} columns={byConnectorColumns} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>By Parser</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={byParser} columns={byParserColumns} />
        </CardContent>
      </Card>
    </div>
  );
}

function AssignmentsReport({ data }: { data: any }) {
  const assignments = data || {};
  const bySalesperson = Array.isArray(assignments.bySalesperson) ? assignments.bySalesperson : [];
  const unassigned = assignments.unassigned ?? 0;

  const columns: Column<{ userName: string; leadCount: number }>[] = [
    { key: "user", header: "User", render: (r) => r.userName || "Unassigned" },
    { key: "count", header: "Leads", render: (r) => (r.leadCount ?? 0).toString() },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>By Assignee</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={bySalesperson} columns={columns} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Unassigned</CardTitle></CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{unassigned}</p>
          <p className="text-sm text-[var(--color-muted)] mt-1">Leads not yet assigned</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityReport({ data }: { data: any }) {
  const activity = data || {};
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card><p className="text-sm text-[var(--color-muted)]">Today</p><p className="mt-2 text-3xl font-bold">{activity.today ?? 0}</p></Card>
      <Card><p className="text-sm text-[var(--color-muted)]">This Week</p><p className="mt-2 text-3xl font-bold">{activity.thisWeek ?? 0}</p></Card>
      <Card><p className="text-sm text-[var(--color-muted)]">This Month</p><p className="mt-2 text-3xl font-bold">{activity.thisMonth ?? 0}</p></Card>
    </div>
  );
}

function StatusReport({ data }: { data: any }) {
  // Gracefully handle if returned directly as an array or wrapped inside an object key
  const statusRows = Array.isArray(data) ? data : (data && Array.isArray(data.status) ? data.status : []);

  const columns: Column<{ status: string; count: number }>[] = [
    { key: "status", header: "Status", render: (r) => <Badge label={r.status || "Unknown"} /> },
    { key: "count", header: "Count", render: (r) => (r.count ?? 0).toString() },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Status Breakdown</CardTitle></CardHeader>
      <CardContent>
        <DataTable rows={statusRows} columns={columns} />
      </CardContent>
    </Card>
  );
}

function TrendsReport({ data }: { data: any }) {
  // Gracefully handle if returned directly as an array or wrapped inside an object key
  const trendRows = Array.isArray(data) ? data : (data && Array.isArray(data.trends) ? data.trends : []);

  const columns: Column<{ month: string; total: number; won: number; lost: number }>[] = [
    { key: "month", header: "Month", render: (r) => r.month || "Unknown" },
    { key: "total", header: "Created", render: (r) => (r.total ?? 0).toString() },
    { key: "won", header: "Won", render: (r) => (r.won ?? 0).toString() },
    { key: "lost", header: "Lost", render: (r) => (r.lost ?? 0).toString() },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Monthly Trends (Last 6 Months)</CardTitle></CardHeader>
      <CardContent>
        <DataTable rows={trendRows} columns={columns} />
      </CardContent>
    </Card>
  );
}