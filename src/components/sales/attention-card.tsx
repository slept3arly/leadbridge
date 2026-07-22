"use client";

import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Badge } from "@/components/ui/badge";
import { Archive, Trash2 } from "lucide-react";
import { formatDateShort as formatDate, formatTime } from "@/lib/utils";

type AttentionCardProps = {
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
  onDetails: (leadId: string) => void;
  onArchive?: (leadId: string) => void;
  onDelete?: (leadId: string) => void;
};

export function AttentionCard({
  leadId,
  leadName,
  customerName,
  phone,
  priority,
  category,
  dueDate,
  dueTime,
  daysOverdue,
  assignedAt,
  source,
  assignedBy,
  lastActivity,
  daysSinceActivity,
  followUpTitle,
  onDetails,
  onArchive,
  onDelete,
}: AttentionCardProps) {
  const reason =
    followUpTitle ??
    (daysSinceActivity !== undefined && daysSinceActivity > 0
      ? `No activity for ${daysSinceActivity}d`
      : null) ??
    (assignedAt ? "Recently assigned" : null);

  return (
    <div className="flex min-h-[180px] flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-xs transition hover:shadow-md">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[var(--color-ink)] truncate">{leadName}</h3>
          {customerName && (
            <p className="mt-0.5 text-sm text-[var(--color-muted)] truncate">{customerName}</p>
          )}
          {phone && <p className="mt-0.5 text-sm text-[var(--color-ink)]">{phone}</p>}
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          <Badge label={priority} />
          {category && <Badge label={category} />}
        </div>
      </div>

      {/* REASON */}
      {reason && (
        <p className="text-sm font-medium text-[var(--color-ink)]">{reason}</p>
      )}

      {/* FOOTER */}
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
            {dueDate && (
              <span>
                Due {formatDate(dueDate)}{dueTime ? ` \u2022 ${formatTime(dueTime)}` : ""}
              </span>
            )}
            {assignedAt && !dueDate && (
              <span>
                {formatDate(assignedAt)}
                {source ? ` \u2022 ${source}` : ""}
                {assignedBy ? ` \u2022 ${assignedBy}` : ""}
              </span>
            )}
            {lastActivity && !dueDate && (
              <span>
                {formatDate(lastActivity)}
                {source ? ` \u2022 ${source}` : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onArchive && (
              <IconActionButton
                icon={Archive}
                label="Archive lead"
                onClick={() => onArchive(leadId)}
              />
            )}
            {onDelete && (
              <IconActionButton
                icon={Trash2}
                label="Delete lead"
                onClick={() => onDelete(leadId)}
              />
            )}
            <Button size="sm" variant="secondary" onClick={() => onDetails(leadId)}>
              Details
            </Button>
          </div>
        </div>

        {daysOverdue !== undefined && daysOverdue > 0 && (
          <p className="text-xs font-medium text-red-600">{daysOverdue}d overdue</p>
        )}
      </div>
    </div>
  );
}
