"use client";

import {
  Circle, PenSquare, UserCheck, MessageSquare, FileEdit, Download,
  ArrowRightLeft, Calendar, Trash2, Undo2, Paperclip, Info
} from "lucide-react";
import { ExpandableSection } from "@/components/ui/expandable-section";
import { DateTimeDisplay } from "@/components/shared/date-time-display";
import type { LeadActivity } from "@/hooks/use-lead-details";

const activityConfig: Record<string, { icon: typeof Circle; label: string }> = {
  CREATED: { icon: PenSquare, label: "Created" },
  UPDATED: { icon: Info, label: "Updated" },
  ASSIGNED: { icon: UserCheck, label: "Assigned" },
  NOTE_ADDED: { icon: MessageSquare, label: "Note Added" },
  NOTE_EDITED: { icon: FileEdit, label: "Note Edited" },
  IMPORTED: { icon: Download, label: "Imported" },
  STATUS_CHANGED: { icon: ArrowRightLeft, label: "Status Changed" },
  FOLLOW_UP: { icon: Calendar, label: "Follow-up" },
  DELETED: { icon: Trash2, label: "Deleted" },
  RESTORED: { icon: Undo2, label: "Restored" },
  ATTACHMENT_ADDED: { icon: Paperclip, label: "Attachment Added" },
};

export function ActivityTimeline({ activities }: { activities: LeadActivity[] }) {

  function renderDetail(activity: LeadActivity) {
    const meta = activity.metadata;
    if (!meta) return null;

    if (activity.type === "STATUS_CHANGED" && meta.from && meta.to) {
      return (
        <span className="text-xs text-[var(--color-muted)]">
          {String(meta.from)} → {String(meta.to)}
        </span>
      );
    }

    if (activity.type === "NOTE_EDITED") {
      return (
        <details className="text-xs text-[var(--color-muted)]">
          <summary className="cursor-pointer hover:text-[var(--color-ink)]">Show previous version</summary>
          <div className="mt-1 rounded-lg bg-slate-50 p-2 whitespace-pre-wrap border border-[var(--color-border)]">
            {String(meta.oldContent ?? "")}
          </div>
        </details>
      );
    }

    return null;
  }

  if (activities.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No activity recorded yet.</p>;
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-2 bottom-2 w-px bg-[var(--color-border)]" />
      <ExpandableSection initialVisible={5} itemCount={activities.length}>
        {activities.map((activity) => {
          const config = activityConfig[activity.type] ?? { icon: Circle, label: activity.type };
          const Icon = config.icon;
          return (
            <div key={activity.id} className="relative flex gap-3 pb-4">
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-panel)] border border-[var(--color-border)]">
                <Icon size={14} className="text-[var(--color-muted)]" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[var(--color-ink)]">
                    {activity.actor?.name ?? "System"}
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">{config.label}</span>
                  <DateTimeDisplay date={activity.createdAt} className="text-xs" />
                </div>
                <p className="text-sm text-[var(--color-ink)] mt-0.5">{activity.message}</p>
                {renderDetail(activity)}
              </div>
            </div>
          );
        })}
      </ExpandableSection>
    </div>
  );
}
