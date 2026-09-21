"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardEmptyState } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getPriorityLabel, getCategoryLabel } from "@/lib/lead-constants";
import { formatDateShort, formatTime } from "@/lib/utils";

interface AttentionCounts {
  todayFollowUpCount: number;
  overdueFollowUpCount: number;
  weekFollowUpCount: number;
  newLeadCount: number;
  needsAttentionCount: number;
}

interface PipelineItem {
  status: string;
  count: number;
}

interface PriorityItem {
  priority: string;
  count: number;
}

interface UpcomingFollowUp {
  id: string;
  title: string;
  dueDate: string;
  dueTime: string | null;
  leadId: string;
  leadName: string;
  leadNumber: string;
  company: string | null;
  priority: string;
  category: string | null;
}

interface SalesDashboardData {
  cards: { myLeads: number; myOpenLeads: number; myClosedLeads: number };
  attention: AttentionCounts;
  pipeline: PipelineItem[];
  priorities: PriorityItem[];
  upcomingFollowUps: UpcomingFollowUp[];
  canExport: boolean;
  insights: {
    workedLeads: number;
    calls: number;
    whatsapp: number;
    responded: number;
    noResponse: number;
    interested: number;
    notInterested: number;
  };
}

const PIPELINE_STATUSES = ["NEW", "ON_HOLD", "CONVERTED", "LOST", "SPAM"];

const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"];

function AgendaRow({ item, onOpen }: { item: UpcomingFollowUp; onOpen: (leadId: string) => void }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const dateStr = formatDateShort(item.dueDate, "-", hydrated ? undefined : "UTC");
  const timeStr = item.dueTime ? formatTime(item.dueTime) : "-";

  return (
    <tr
      className="cursor-pointer border-b border-[var(--color-border)] transition hover:bg-slate-50/50 last:border-b-0"
      onClick={() => onOpen(item.leadId)}
    >
      <td className="px-4 py-3 text-sm text-[var(--color-muted)] whitespace-nowrap">{dateStr}</td>
      <td className="px-4 py-3 text-sm text-[var(--color-muted)] whitespace-nowrap">{timeStr}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-[var(--color-ink)]">{item.leadName}</p>
        {item.leadNumber && <p className="text-xs text-[var(--color-muted)]">#{item.leadNumber}</p>}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-muted)]">{item.company ?? "-"}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <Badge label={getPriorityLabel(item.priority)} />
          {item.category && <Badge label={getCategoryLabel(item.category)} />}
        </div>
      </td>
    </tr>
  );
}

export function SalesDashboardClient({ data }: { data: SalesDashboardData }) {
  const router = useRouter();

  const handleOpenLead = useCallback((leadId: string) => {
    if (leadId) router.push(`/sales/my-leads?leadId=${leadId}`);
  }, [router]);

  return (
    <div className="space-y-8">

      {/* Section 1: What Needs My Attention */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--color-ink)]">What Needs My Attention</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Overdue Follow-ups"
            count={data.attention.overdueFollowUpCount}
            description="Past due and still awaiting completion."
            href="/sales/my-leads?filter.followUp=overdue"
          />
          <KpiCard
            title="Due Today"
            count={data.attention.todayFollowUpCount}
            description="Follow-ups scheduled for today."
            href="/sales/my-leads?filter.followUp=today"
          />
          <KpiCard
            title="Unworked Leads"
            count={data.attention.newLeadCount}
            description="No notes or follow-ups yet."
            href="/sales/my-leads?filter.followUp=new"
          />
          <KpiCard
            title="Stale Leads"
            count={data.attention.needsAttentionCount}
            description="No activity for 7+ days."
            href="/sales/tasks?tab=stale"
          />
        </div>
      </section>

      {/* Section 2: My Pipeline */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">My Pipeline</h2>
          <Link href="/sales/my-leads" className="text-xs font-medium text-[var(--color-brand)] hover:underline">
            View All Leads
          </Link>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {PIPELINE_STATUSES.map((status) => {
            const item = data.pipeline.find((p) => p.status === status);
            return (
              <Link key={status} href={`/sales/my-leads?filter.status=${status}`} className="block">
                <Card className="cursor-pointer transition hover:shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <Badge label={getStatusLabel(status)} />
                    <span className="text-2xl font-semibold text-[var(--color-ink)]">{item?.count ?? 0}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mt-3">
          {PRIORITY_ORDER.map((priority) => {
            const item = data.priorities.find((p) => p.priority === priority);
            return (
              <Link key={priority} href={`/sales/my-leads?filter.priority=${priority}`} className="block">
                <Card className="cursor-pointer transition hover:shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <Badge label={getPriorityLabel(priority)} />
                    <span className="text-2xl font-semibold text-[var(--color-ink)]">{item?.count ?? 0}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Section 3: Today's Activity */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--color-ink)]">Today&apos;s Activity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiCard
            title="Worked Leads"
            count={data.insights.workedLeads}
            description="Unique leads contacted today"
            href="/sales/my-leads?filter.activityDate=today"
          />
          <KpiCard
            title="Calls"
            count={data.insights.calls}
            description="Leads contacted by phone today"
            href="/sales/my-leads?filter.activityDate=today&filter.activityAction=CALL"
          />
          <KpiCard
            title="WhatsApp"
            count={data.insights.whatsapp}
            description="Leads contacted on WhatsApp today"
            href="/sales/my-leads?filter.activityDate=today&filter.activityAction=WHATSAPP"
          />
          <KpiCard
            title="Responded"
            count={data.insights.responded}
            description="Calls answered or WhatsApp replies today"
            href="/sales/my-leads?filter.activityDate=today&filter.activityResponse=PICKED_UP,REPLIED"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <KpiCard
            title="No Response"
            count={data.insights.noResponse}
            description="Calls or WhatsApp contacts with no reply today"
            href="/sales/my-leads?filter.activityDate=today&filter.activityResponse=NO_RESPONSE"
          />
          <KpiCard
            title="Interested"
            count={data.insights.interested}
            description="Leads showing interest today"
            href="/sales/my-leads?filter.activityDate=today&filter.activityInterest=INTERESTED"
          />
          <KpiCard
            title="Not Interested"
            count={data.insights.notInterested}
            description="Leads marked not interested today"
            href="/sales/my-leads?filter.activityDate=today&filter.activityInterest=NOT_INTERESTED"
          />
        </div>
      </section>

      {/* Section 4: Upcoming Follow-ups */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Upcoming Follow-ups</h2>
          {data.attention.weekFollowUpCount > 0 && (
            <Link href="/sales/tasks" className="text-xs font-medium text-[var(--color-brand)] hover:underline">
              View All ({data.attention.weekFollowUpCount} this week)
            </Link>
          )}
        </div>
        {data.upcomingFollowUps.length > 0 ? (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Time</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Lead</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Customer</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Tags</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingFollowUps.map((item) => (
                  <AgendaRow key={item.id} item={item} onOpen={handleOpenLead} />
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <CardEmptyState description="No upcoming follow-ups scheduled." />
        )}
      </section>

    </div>
  );
}
