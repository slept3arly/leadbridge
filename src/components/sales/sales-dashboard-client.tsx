"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardEmptyState } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getPriorityLabel, getCategoryLabel } from "@/lib/lead-constants";
import { formatTime } from "@/lib/utils";

interface AttentionCounts {
  todayFollowUpCount: number;
  overdueFollowUpCount: number;
  newLeadCount: number;
  needsAttentionCount: number;
}

interface PipelineItem {
  status: string;
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
  upcomingFollowUps: UpcomingFollowUp[];
  canExport: boolean;
}

const PIPELINE_STATUSES = ["NEW", "ON_HOLD", "CONVERTED", "LOST", "SPAM"];

function PipelineCard({ status, count }: { status: string; count: number }) {
  return (
    <Link href={`/sales/my-leads?filter.status=${status}`} className="block">
      <Card className="cursor-pointer transition hover:shadow-md p-4">
        <div className="flex items-center justify-between">
          <Badge label={getStatusLabel(status)} />
          <span className="text-2xl font-semibold text-[var(--color-ink)]">{count}</span>
        </div>
      </Card>
    </Link>
  );
}

function AgendaRow({ item, onOpen }: { item: UpcomingFollowUp; onOpen: (leadId: string) => void }) {
  const timeStr = item.dueTime
    ? formatTime(item.dueTime)
    : new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <tr
      className="cursor-pointer border-b border-[var(--color-border)] transition hover:bg-slate-50/50 last:border-b-0"
      onClick={() => onOpen(item.leadId)}
    >
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

      {/* Section 1: My Leads */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-[var(--color-ink)]">My Leads</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {PIPELINE_STATUSES.map((status) => {
            const item = data.pipeline.find((p) => p.status === status);
            return <PipelineCard key={status} status={status} count={item?.count ?? 0} />;
          })}
        </div>
      </section>

      {/* Section 2: Today's Follow-ups */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Today&apos;s Follow-ups</h2>
          {(data.attention.overdueFollowUpCount + data.attention.todayFollowUpCount) > 0 && (
            <Link href="/sales/tasks" className="text-xs font-medium text-[var(--color-brand)] hover:underline">
              View All
            </Link>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 mb-6">
          <KpiCard
            title="Overdue Follow-ups"
            count={data.attention.overdueFollowUpCount}
            description="Past due date requiring action."
            href={`/sales/my-leads?filter.followUp=overdue`}
          />
          <KpiCard
            title="Today&apos;s Follow-ups"
            count={data.attention.todayFollowUpCount}
            description="Scheduled follow-ups due today."
            href={`/sales/my-leads?filter.followUp=today`}
          />
        </div>
        {data.upcomingFollowUps.length > 0 ? (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
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
