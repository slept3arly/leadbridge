"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AttentionCard } from "@/components/sales/attention-card";
import { KpiCard } from "@/components/shared/kpi-card";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type {
  PendingFollowUpItem,
  TodayFollowUpItem,
  NewLeadItem,
  NeedsAttentionItem,
} from "@/services/attention.service";

export type SectionId = "pending" | "today" | "new" | "stale";

type AttentionCenterProps = {
  pendingFollowUps: PendingFollowUpItem[];
  todayFollowUps: TodayFollowUpItem[];
  newLeads: NewLeadItem[];
  needsAttention: NeedsAttentionItem[];
};

const FILTERS: { id: SectionId; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "today", label: "Today" },
  { id: "new", label: "New" },
  { id: "stale", label: "Attention" },
];

const EMPTY_MESSAGES: Record<SectionId, string> = {
  pending: "No pending follow-ups.",
  today: "No follow-ups scheduled today.",
  new: "No new leads to review.",
  stale: "Every lead has recent activity.",
};

export function AttentionCenter({
  pendingFollowUps,
  todayFollowUps,
  newLeads,
  needsAttention,
  initialSection,
}: AttentionCenterProps & { initialSection?: SectionId }) {
  const [activeSection, setActiveSection] = useState<SectionId | undefined>(initialSection);
  const router = useRouter();

  const handleArchive = useCallback(async (leadId: string) => {
    try {
      const axios = (await import("axios")).default;
      await axios.patch(`/api/leads/${leadId}`, { isArchived: true });
      (await import("@/lib/toast")).toast.success("Lead archived");
      router.refresh();
    } catch {
      (await import("@/lib/toast")).toast.error("Failed to archive lead.");
    }
  }, [router]);

  const handleDelete = useCallback(async (leadId: string) => {
    if (!confirm("Delete this lead permanently?")) return;
    try {
      const axios = (await import("axios")).default;
      await axios.delete(`/api/leads/${leadId}`);
      (await import("@/lib/toast")).toast.success("Lead deleted");
      router.refresh();
    } catch {
      (await import("@/lib/toast")).toast.error("Failed to delete lead.");
    }
  }, [router]);

  const handleDetails = useCallback((leadId: string) => {
    router.push(`/sales/my-leads?leadId=${leadId}`);
  }, [router]);

  const handleFilterClick = (id: SectionId) => {
    setActiveSection((prev) => (prev === id ? undefined : id));
  };

  const handleClearFilter = () => {
    setActiveSection(undefined);
  };

  const allItems = useMemo(() => {
    const items: {
      key: string;
      sectionId: SectionId;
      leadId: string;
      leadName: string;
      customerName?: string | null;
      phone?: string | null;
      priority: string;
      category?: string | null;
      dueDate?: string | null;
      dueTime?: string | null;
      daysOverdue?: number;
      assignedAt?: string | null;
      source?: string | null;
      assignedBy?: string | null;
      lastActivity?: string | null;
      daysSinceActivity?: number;
      followUpTitle?: string;
      showActions: boolean;
    }[] = [];

    for (const f of pendingFollowUps) {
      items.push({
        key: `pending-${f.followUpId}`,
        sectionId: "pending",
        leadId: f.lead.id,
        leadName: f.lead.displayName,
        customerName: f.lead.company,
        phone: f.lead.phone,
        priority: f.lead.priority,
        category: f.lead.category,
        dueDate: f.dueDate,
        dueTime: f.dueTime,
        daysOverdue: f.daysOverdue,
        followUpTitle: f.followUpTitle,
        showActions: false,
      });
    }

    for (const f of todayFollowUps) {
      items.push({
        key: `today-${f.followUpId}`,
        sectionId: "today",
        leadId: f.lead.id,
        leadName: f.lead.displayName,
        customerName: f.lead.company,
        phone: f.lead.phone,
        priority: f.lead.priority,
        category: f.lead.category,
        dueDate: f.dueDate,
        dueTime: f.dueTime,
        followUpTitle: f.followUpTitle,
        showActions: false,
      });
    }

    for (const l of newLeads) {
      items.push({
        key: `new-${l.id}`,
        sectionId: "new",
        leadId: l.id,
        leadName: l.displayName,
        customerName: l.company,
        phone: l.phone,
        priority: l.priority,
        category: l.category,
        assignedAt: l.createdAt,
        source: l.source?.name,
        assignedBy: l.createdBy?.name,
        showActions: false,
      });
    }

    for (const l of needsAttention) {
      items.push({
        key: `stale-${l.id}`,
        sectionId: "stale",
        leadId: l.id,
        leadName: l.displayName,
        customerName: l.company,
        phone: l.phone,
        priority: l.priority,
        category: l.category,
        lastActivity: l.lastActivityDate,
        daysSinceActivity: l.daysSinceActivity,
        source: l.source?.name,
        showActions: true,
      });
    }

    return items;
  }, [pendingFollowUps, todayFollowUps, newLeads, needsAttention]);

  const visibleItems = activeSection
    ? allItems.filter((i) => i.sectionId === activeSection)
    : allItems;

  const emptyMessage =
    activeSection ? EMPTY_MESSAGES[activeSection] : "No attention items to display.";

  return (
    <div className="space-y-8">
      {/* KPI Summary Cards */}
      <section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Overdue Follow-ups"
            count={pendingFollowUps.length}
            description="Past due date requiring action."
            href="/sales/my-leads?filter.followUp=overdue"
          />
          <KpiCard
            title="Today&apos;s Follow-ups"
            count={todayFollowUps.length}
            description="Scheduled follow-ups due today."
            href="/sales/my-leads?filter.followUp=today"
          />
          <KpiCard
            title="New Leads"
            count={newLeads.length}
            description="Never contacted, reach out today."
            href="/sales/tasks?tab=new"
          />
          <KpiCard
            title="Needs Attention"
            count={needsAttention.length}
            description="No activity for 7 or more days."
            href="/sales/tasks?tab=stale"
          />
        </div>
      </section>

      {/* Filter pills — matches SegmentedControl styling from My Leads */}
      <div className="flex items-center justify-center gap-1.5">
        <div className="inline-flex items-center rounded-xl bg-slate-100/80 p-1">
          {FILTERS.map((f) => {
            const isActive = activeSection === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFilterClick(f.id)}
                className={cn(
                  "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-white text-[var(--color-ink)] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Clear filter — always occupies space, never causes layout shift */}
        <div
          className={cn(
            "flex items-center justify-center transition-opacity duration-150",
            activeSection ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <button
            type="button"
            onClick={handleClearFilter}
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-slate-100 transition-colors duration-150"
            aria-label="Clear filter"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Unified card grid */}
      {visibleItems.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleItems.map((item) => (
            <AttentionCard
              key={item.key}
              leadId={item.leadId}
              leadName={item.leadName}
              customerName={item.customerName}
              phone={item.phone}
              priority={item.priority}
              category={item.category}
              dueDate={item.dueDate}
              dueTime={item.dueTime}
              daysOverdue={item.daysOverdue}
              assignedAt={item.assignedAt}
              source={item.source}
              assignedBy={item.assignedBy}
              lastActivity={item.lastActivity}
              daysSinceActivity={item.daysSinceActivity}
              followUpTitle={item.followUpTitle}
              onDetails={handleDetails}
              onArchive={item.showActions ? handleArchive : undefined}
              onDelete={item.showActions ? handleDelete : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <div className="flex min-h-[180px] w-full max-w-md flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-xs">
            <p className="text-sm font-medium text-[var(--color-muted)]">{emptyMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
