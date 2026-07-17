"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  Circle, PenSquare, UserCheck, MessageSquare, FileEdit, Download,
  ArrowRightLeft, Calendar, Trash2, Undo2, Paperclip, Info
} from "lucide-react";
import { ExpandableSection } from "@/components/expandable-section";

type Activity = {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
};

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

export function ActivityTimeline({ leadId }: { leadId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios.get(`/api/leads/${leadId}/activities`).then((res) => {
      if (!cancelled) setActivities(res.data);
    }).catch(() => {
      // silent
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [leadId]);

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
      " at " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  function renderDetail(activity: Activity) {
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

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-1/3 rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-50" />
            </div>
          </div>
        ))}
      </div>
    );
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
                  <span className="text-xs text-[var(--color-muted)]">{formatDateTime(activity.createdAt)}</span>
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
