"use client";

import { useMemo } from "react";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Edit, Calendar, CheckCircle2, Trash2, ArrowUpRight, RefreshCw, Phone, MessageSquare } from "lucide-react";
import { formatDate, formatTimeValue, formatTime } from "@/lib/utils";
import type { ActivityEventItem, ActivityEventEntry } from "@/hooks/use-lead-details";

type DayGroup = {
  dateKey: string;
  label: string;
  events: ActivityEventItem[];
};

const ACTION_LABELS: Record<string, string> = { CALL: "Call", WHATSAPP: "WhatsApp" };
const RESPONSE_LABELS: Record<string, string> = {
  PICKED_UP: "Picked Up",
  NO_RESPONSE: "No Response",
  INVALID_NUMBER: "Invalid Number",
  REPLIED: "Replied",
};
const INTEREST_LABELS: Record<string, string> = {
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not Interested",
};

function groupByDay(events: ActivityEventItem[]): DayGroup[] {
  const map = new Map<string, ActivityEventItem[]>();

  for (const event of events) {
    const d = new Date(event.occurredAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }

  const groups: DayGroup[] = [];
  for (const [dateKey, dayEvents] of map) {
    const d = new Date(dateKey + "T00:00:00");
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
    dayEvents.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    groups.push({ dateKey, label, events: dayEvents });
  }

  groups.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return groups;
}

function InteractionEntry({ entry }: { entry: ActivityEventEntry }) {
  const actionLabel = entry.action ? (ACTION_LABELS[entry.action] ?? entry.action) : null;
  const responseLabel = entry.response ? (RESPONSE_LABELS[entry.response] ?? entry.response) : null;
  const interestLabel = entry.interest ? INTEREST_LABELS[entry.interest] ?? entry.interest : null;
  const isCall = entry.action === "CALL";

  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">
        {isCall ? (
          <Phone size={14} className="text-blue-600" />
        ) : (
          <MessageSquare size={14} className="text-green-600" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {actionLabel && responseLabel && (
            <span className="text-sm font-medium text-[var(--color-ink)]">
              {actionLabel} · {responseLabel}
            </span>
          )}
          {interestLabel && (
            <span className="text-xs text-[var(--color-muted)]">· {interestLabel}</span>
          )}
        </div>
        {entry.message && entry.message !== `${entry.action} - ${responseLabel}${interestLabel ? ` ${interestLabel}` : ""}` && (
          <p className="text-sm text-[var(--color-muted)] mt-0.5">&ldquo;{entry.message}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

function FollowUpEntry({ entry }: { entry: ActivityEventEntry }) {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;

  switch (entry.type) {
    case "FOLLOW_UP_SCHEDULED": {
      const dueDate = meta.dueDate ? formatDate(meta.dueDate as string, "-") : "";
      const dueTime = meta.dueTime ? formatTime(meta.dueTime as string) : "";
      return (
        <div className="flex items-start gap-2">
          <ArrowUpRight size={14} className="text-blue-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-[var(--color-ink)]">Follow-up scheduled</span>
            {dueDate && (
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                <Calendar size={10} className="inline mr-1" />
                {dueDate}{dueTime ? ` · ${dueTime}` : ""}
              </p>
            )}
          </div>
        </div>
      );
    }

    case "FOLLOW_UP_RESCHEDULED": {
      const prevDate = meta.previousDueDate ? formatDate(meta.previousDueDate as string, "-") : "";
      const prevTime = meta.previousDueTime ? formatTime(meta.previousDueTime as string) : "";
      const newDate = meta.newDueDate ? formatDate(meta.newDueDate as string, "-") : "";
      const newTime = meta.newDueTime ? formatTime(meta.newDueTime as string) : "";
      return (
        <div className="flex items-start gap-2">
          <RefreshCw size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-[var(--color-ink)]">Follow-up rescheduled</span>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {prevDate}{prevTime ? ` ${prevTime}` : ""} → {newDate}{newTime ? ` ${newTime}` : ""}
            </p>
          </div>
        </div>
      );
    }

    case "FOLLOW_UP_COMPLETED": {
      const scheduledDate = meta.scheduledDate ? formatDate(meta.scheduledDate as string, "-") : "";
      const scheduledTime = meta.scheduledTime ? formatTime(meta.scheduledTime as string) : "";
      return (
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="text-green-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-[var(--color-ink)]">Follow-up completed</span>
            {scheduledDate && (
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Was scheduled for: {scheduledDate}{scheduledTime ? ` · ${scheduledTime}` : ""}
              </p>
            )}
          </div>
        </div>
      );
    }

    case "FOLLOW_UP_CANCELLED": {
      const scheduledDate = meta.scheduledDate ? formatDate(meta.scheduledDate as string, "-") : "";
      const scheduledTime = meta.scheduledTime ? formatTime(meta.scheduledTime as string) : "";
      return (
        <div className="flex items-start gap-2">
          <Trash2 size={14} className="text-red-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-[var(--color-ink)]">Follow-up cancelled</span>
            {scheduledDate && (
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Was scheduled for: {scheduledDate}{scheduledTime ? ` · ${scheduledTime}` : ""}
              </p>
            )}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

function NoteEntry({ entry }: { entry: ActivityEventEntry }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0">
        {entry.message && (
          <p className="text-sm text-[var(--color-muted)]">&ldquo;{entry.message}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

function EntryRow({ entry }: { entry: ActivityEventEntry }) {
  switch (entry.type) {
    case "CALL":
    case "WHATSAPP":
      return <InteractionEntry entry={entry} />;
    case "FOLLOW_UP_SCHEDULED":
    case "FOLLOW_UP_RESCHEDULED":
    case "FOLLOW_UP_COMPLETED":
    case "FOLLOW_UP_CANCELLED":
      return <FollowUpEntry entry={entry} />;
    case "NOTE_ADDED":
      return <NoteEntry entry={entry} />;
    case "CREATED":
      return <span className="text-sm text-[var(--color-muted)]">Lead created</span>;
    case "STATUS_CHANGED":
      return <span className="text-sm text-[var(--color-muted)]">{entry.message}</span>;
    case "UPDATED":
      return <span className="text-sm text-[var(--color-muted)]">{entry.message || "Updated"}</span>;
    default:
      return <span className="text-sm text-[var(--color-muted)]">{entry.message || entry.type}</span>;
  }
}

function ActivityEventGroup({
  event,
  onEditActivity,
}: {
  event: ActivityEventItem;
  onEditActivity?: (entryId: string) => void;
}) {
  const time = formatTimeValue(event.occurredAt, "");

  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        <span className="text-xs text-[var(--color-muted)] tabular-nums pt-0.5 w-16 shrink-0">{time}</span>
        <div className="flex-1 min-w-0 space-y-1.5">
          {event.entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2">
              <EntryRow entry={entry} />
              {onEditActivity && entry.type === "CALL" && (
                <IconActionButton
                  icon={Edit}
                  label="Edit activity"
                  onClick={() => onEditActivity(entry.id)}
                  className="h-5 w-5 shrink-0 mt-0.5"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DailyHistory({
  activityEvents,
  onEditActivity,
}: {
  activityEvents: ActivityEventItem[];
  onEditActivity?: (entryId: string) => void;
}) {
  const groups = useMemo(() => groupByDay(activityEvents), [activityEvents]);

  if (groups.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-[var(--color-muted)]">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.dateKey}>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">
              {group.label}
            </h3>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {group.events.map((event) => (
              <ActivityEventGroup
                key={event.id}
                event={event}
                onEditActivity={onEditActivity}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
