"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/shared/data-table";
import { LeadDetailDialog } from "@/components/sales/lead-detail-dialog";
import { LeadDetailsModal } from "@/components/sales/lead-details-modal";
import { LogActivityModal } from "@/components/sales/log-activity-modal";
import { SalesTableControls } from "@/components/sales/sales-table-controls";
import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Plus, Archive, Trash2, ExternalLink } from "lucide-react";
import { getStatusLabel, getPriorityLabel, getCategoryLabel } from "@/lib/lead-constants";
import { formatTimeAgo, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { TableQueryState } from "@/hooks/use-table-query";

export type SalesLeadRow = {
  id: string;
  leadNumber: string;
  name: string;
  company: string | null;
  phone: string | null;
  status: string;
  priority: string;
  category: string | null;
  source?: { id: string; name: string } | null;
  nextFollowUpAt: Date | null;
  lastActivity?: {
    occurredAt: Date;
    entries: Array<{ type: string; action: string | null; response: string | null }>;
  } | null;
  followUps?: Array<{ status: string; dueDate: Date | null; completedAt: Date | null }>;
};

const ENTRY_DISPLAY_ORDER: Record<string, number> = {
  CALL: 0,
  WHATSAPP: 0,
  FOLLOW_UP_COMPLETED: 1,
  FOLLOW_UP_SCHEDULED: 2,
  FOLLOW_UP_RESCHEDULED: 3,
  FOLLOW_UP_CANCELLED: 4,
};

const ACTION_LABELS: Record<string, string> = { CALL: "Call", WHATSAPP: "WhatsApp" };
const RESPONSE_LABELS: Record<string, string> = {
  PICKED_UP: "Picked Up",
  NO_RESPONSE: "No Response",
  INVALID_NUMBER: "Invalid Number",
  REPLIED: "Replied",
};
const FOLLOW_UP_LABELS: Record<string, string> = {
  FOLLOW_UP_SCHEDULED: "Follow-up scheduled",
  FOLLOW_UP_RESCHEDULED: "Follow-up rescheduled",
  FOLLOW_UP_COMPLETED: "Follow-up completed",
  FOLLOW_UP_CANCELLED: "Follow-up cancelled",
};

function formatLastActivityEntry(entry: { type: string; action: string | null; response: string | null }): string {
  if (entry.type === "CALL" || entry.type === "WHATSAPP") {
    const actionLabel = ACTION_LABELS[entry.type] ?? entry.type;
    const responseLabel = entry.response ? (RESPONSE_LABELS[entry.response] ?? entry.response) : null;
    return [actionLabel, responseLabel].filter(Boolean).join(" \u00B7 ");
  }
  return FOLLOW_UP_LABELS[entry.type] ?? entry.type;
}

function LastActivityCell({ lastActivity }: { lastActivity: SalesLeadRow["lastActivity"] }) {
  const [display, setDisplay] = useState<{ lines: string[]; timeAgo: string } | null>(null);

  useEffect(() => {
    if (!lastActivity || lastActivity.entries.length === 0) {
      setDisplay(null);
      return;
    }
    const sorted = [...lastActivity.entries].sort(
      (a, b) => (ENTRY_DISPLAY_ORDER[a.type] ?? 99) - (ENTRY_DISPLAY_ORDER[b.type] ?? 99),
    );
    const visible = sorted.slice(0, 2);
    const remaining = sorted.length - visible.length;
    const lines = visible.map(formatLastActivityEntry);
    if (remaining > 0) lines.push(`+${remaining} more`);
    setDisplay({ lines, timeAgo: formatTimeAgo(lastActivity.occurredAt) });
  }, [lastActivity]);

  if (display === null) {
    return <span className="text-sm text-[var(--color-muted)]">No activity</span>;
  }

  return (
    <div className="leading-tight whitespace-nowrap">
      {display.lines.map((line, i) => (
        <div key={i} className="text-sm text-[var(--color-ink)]">{line}</div>
      ))}
      <div className="text-sm text-[var(--color-muted)]">{display.timeAgo}</div>
    </div>
  );
}

function NextFollowUpCell({ nextFollowUpAt }: { nextFollowUpAt: Date | null }) {
  const [display, setDisplay] = useState<{ dateLabel: string; urgencyLabel: string; isOverdue: boolean } | null>(null);

  useEffect(() => {
    if (!nextFollowUpAt) {
      setDisplay(null);
      return;
    }
    const now = new Date();
    const due = new Date(nextFollowUpAt);
    const isOverdue = due < now;

    const dateLabel = formatDate(due, "-");

    if (isOverdue) {
      const diffMs = now.getTime() - due.getTime();
      const totalMinutes = Math.floor(diffMs / 60000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (parts.length === 0 && minutes > 0) parts.push(`${minutes}m`);

      const urgencyLabel = parts.length > 0 ? `Overdue · ${parts.join(" ")}` : "Overdue";

      setDisplay({ dateLabel, urgencyLabel, isOverdue: true });
    } else {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let dayLabel: string;
      if (diffDays === 0) dayLabel = "Today";
      else if (diffDays === 1) dayLabel = "Tomorrow";
      else {
        const month = due.toLocaleString("en-IN", { month: "short" });
        dayLabel = `${due.getDate()} ${month}`;
      }

      setDisplay({ dateLabel: dayLabel, urgencyLabel: "Pending", isOverdue: false });
    }
  }, [nextFollowUpAt]);

  if (!display) {
    return <span className="text-sm text-[var(--color-muted)]">-</span>;
  }

  return (
    <div className="leading-tight whitespace-nowrap">
      <div className="text-sm text-[var(--color-ink)]">{display.dateLabel}</div>
      <div className="flex items-center gap-1.5 mt-0.5">
        {display.isOverdue ? (
          <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
            {display.urgencyLabel}
          </span>
        ) : (
          <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            {display.urgencyLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function SalesMyLeadsPageContent({
  leads,
  initial,
  pagination,
  leadSources,
  autoOpenLeadId,
  user,
  canDelete,
  canArchive,
  canCreate,
}: {
  leads: SalesLeadRow[];
  initial: Partial<TableQueryState>;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  leadSources: Array<{ id: string; name: string }>;
  autoOpenLeadId: string | null;
  user: { id: string; role: string };
  canDelete: boolean;
  canArchive: boolean;
  canCreate: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [logActivityLeadId, setLogActivityLeadId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      const axios = (await import("axios")).default;
      await axios.patch(`/api/leads/${archiveTarget}`, { isArchived: true });
      toast.success("Lead archived");
      setArchiveTarget(null);
      router.refresh();
    } catch {
      setArchiveError("Failed to archive lead. Please try again.");
    } finally {
      setArchiving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const axios = (await import("axios")).default;
      await axios.delete(`/api/leads/${deleteTarget}`);
      toast.success("Lead deleted");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Failed to delete lead. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const startRow = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 1;
  const endRow = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : leads.length;

  const columns: Column<SalesLeadRow>[] = [
    {
      key: "number",
      header: "#",
      headerClassName: "w-12",
      className: "w-12",
      render: (_lead: SalesLeadRow, index: number) => (
        <span className="text-xs text-[var(--color-muted)] tabular-nums">{startRow + index}</span>
      ),
    },
    {
      key: "lead",
      header: "Lead",
      render: (lead: SalesLeadRow) => (
        <div className="min-w-0 max-w-[220px]">
          <p className="text-sm font-semibold truncate">{lead.name}</p>
          {lead.company && (
            <p className="text-sm text-[var(--color-muted)] truncate">{lead.company}</p>
          )}
          {lead.phone && (
            <p className="text-sm text-[var(--color-muted)] truncate">{lead.phone}</p>
          )}
        </div>
      ),
    },
    {
      key: "statusPriority",
      header: "Status / Priority",
      render: (lead: SalesLeadRow) => (
        <div className="flex flex-col gap-1 w-fit">
          <div className="flex items-center gap-1">
            <Badge label={getStatusLabel(lead.status)} toneKey={lead.status} className="text-xs w-[80px] justify-center" />
            <Badge label={getPriorityLabel(lead.priority)} toneKey={lead.priority} className="text-xs w-[76px] justify-center" />
          </div>
          {lead.category && (
            <Badge label={getCategoryLabel(lead.category)} toneKey={lead.category} className="text-xs w-[150px] justify-center" />
          )}
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (lead: SalesLeadRow) => (
        <span className="text-sm">
          {lead.source?.name ?? <span className="text-sm text-[var(--color-muted)]">-</span>}
        </span>
      ),
    },
    {
      key: "lastActivity",
      header: "Last Activity",
      render: (lead: SalesLeadRow) => <LastActivityCell lastActivity={lead.lastActivity} />,
    },
    {
      key: "nextFollowUpAt",
      header: "Next Follow-up",
      render: (lead: SalesLeadRow) => <NextFollowUpCell nextFollowUpAt={lead.nextFollowUpAt} />,
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-center",
      className: "text-center",
      render: (lead: SalesLeadRow) => (
        <div
          className="flex flex-col gap-1.5 min-w-[130px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setLogActivityLeadId(lead.id)}
              className="gap-1.5"
            >
              <Plus size={14} />
              Log Activity
            </Button>
          </div>
          <div className="flex items-center justify-center gap-1">
            {canArchive ? (
              <IconActionButton
                icon={Archive}
                label="Archive lead"
                isLoading={archiving && archiveTarget === lead.id}
                onClick={() => {
                  setArchiveError(null);
                  setArchiveTarget(lead.id);
                }}
              />
            ) : null}
            {canDelete ? (
              <IconActionButton
                icon={Trash2}
                label="Delete lead"
                isLoading={deleting && deleteTarget === lead.id}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget(lead.id);
                }}
              />
            ) : null}
            <IconActionButton
              icon={ExternalLink}
              label="View lead details"
              onClick={() => setDetailLeadId(lead.id)}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <SalesTableControls
        initial={initial}
        pagination={pagination}
        leadSources={leadSources}
        startTransition={startTransition}
        actions={
          canCreate ? (
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              Create Lead
            </Button>
          ) : null
        }
      />
      {leads.length > 0 || isPending ? (
        <DataTable
          rows={leads}
          columns={columns}
          isLoading={isPending}
          onRowClick={(row) => setDetailLeadId(row.id)}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-semibold">No leads found</h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Try adjusting your filters or create a new lead.</p>
          {canCreate && (
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(true)}
              className="mt-4 gap-1.5"
            >
              <Plus size={16} />
              Create Lead
            </Button>
          )}
        </div>
      )}
      <LeadDetailDialog
        leadId={autoOpenLeadId}
        currentUserId={user.id}
        isAdmin={user.role === "ADMIN"}
        canArchive={canArchive}
        canDelete={canDelete}
        leadSources={leadSources}
      />
      {detailLeadId && (
        <LeadDetailsModal
          leadId={detailLeadId}
          currentUserId={user.id}
          isAdmin={user.role === "ADMIN"}
          canArchive={canArchive}
          canDelete={canDelete}
          leadSources={leadSources}
          onClose={() => setDetailLeadId(null)}
          onUpdate={() => router.refresh()}
        />
      )}
      {canCreate && (
        <LeadEditModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          leadSources={leadSources}
          submitLabel="Save"
        />
      )}
      {logActivityLeadId && (
        <LogActivityModal
          open={true}
          leadId={logActivityLeadId}
          onClose={() => setLogActivityLeadId(null)}
          onSaved={() => {
            setLogActivityLeadId(null);
            router.refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive lead?"
        description="This will move the lead to Archived. You can restore it later."
        confirmLabel="Archive"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={archiving}
        error={archiveError}
        onConfirm={handleArchiveConfirm}
        onCancel={() => { setArchiveTarget(null); setArchiveError(null); }}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete lead?"
        description="This will permanently delete this lead. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
      />
    </>
  );
}
