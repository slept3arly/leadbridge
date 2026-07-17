"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/data-table";
import { formatDate } from "@/lib/utils";

interface FollowUp {
  id: string;
  leadName: string;
  leadNumber: string;
  nextFollowUpAt: string;
}

interface RecentNote {
  id: string;
  content: string;
  leadName: string;
  leadNumber: string;
  createdAt: string;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  leadName: string;
  leadNumber: string;
  createdAt: string;
}

interface SalesDashboardData {
  cards: { myLeads: number; myOpenLeads: number; myClosedLeads: number };
  todayFollowUps: FollowUp[];
  recentNotes: RecentNote[];
  myActivity: Activity[];
}

export function SalesDashboardClient({ data }: { data: SalesDashboardData }) {
  const followUpCols: Column<FollowUp>[] = [
    { key: "lead", header: "Lead", render: (f) => <span className="font-medium">{f.leadName}</span> },
    { key: "number", header: "Lead #", render: (f) => f.leadNumber },
    { key: "followUp", header: "Follow-up", render: (f) => formatDate(f.nextFollowUpAt) },
  ];

  const noteCols: Column<RecentNote>[] = [
    { key: "lead", header: "Lead", render: (n) => <span className="font-medium">{n.leadName}</span> },
    { key: "content", header: "Note", render: (n) => <p className="truncate max-w-xs">{n.content}</p> },
    { key: "created", header: "Created", render: (n) => formatDate(n.createdAt) },
  ];

  const activityCols: Column<Activity>[] = [
    { key: "message", header: "Activity", render: (a) => a.message },
    { key: "lead", header: "Lead", render: (a) => a.leadName },
    { key: "time", header: "Time", render: (a) => formatDate(a.createdAt) },
  ];

  return (
    <div className="space-y-6">
      {data.todayFollowUps.length ? (
        <Card>
          <CardHeader><CardTitle>Today&apos;s Follow-ups</CardTitle></CardHeader>
          <CardContent>
            <DataTable rows={data.todayFollowUps} columns={followUpCols} />
          </CardContent>
        </Card>
      ) : null}

      {data.recentNotes.length ? (
        <Card>
          <CardHeader><CardTitle>Recent Notes</CardTitle></CardHeader>
          <CardContent>
            <DataTable rows={data.recentNotes} columns={noteCols} />
          </CardContent>
        </Card>
      ) : null}

      {data.myActivity.length ? (
        <Card>
          <CardHeader><CardTitle>My Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <DataTable rows={data.myActivity} columns={activityCols} />
          </CardContent>
        </Card>
      ) : null}

      {!data.todayFollowUps.length && !data.recentNotes.length && !data.myActivity.length ? (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)] text-center py-6">No recent activity yet. Assign leads to get started.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
