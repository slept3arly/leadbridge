"use client";

import { useMemo } from "react";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Badge } from "@/components/ui/badge";
import { Edit, Calendar, CheckCircle2, Trash2, ArrowUpRight, RefreshCw, Phone, MessageSquare } from "lucide-react";
import { formatDate, formatTimeValue, formatTime } from "@/lib/utils";
import { ACTIVITY_ACTION_LABELS, ACTIVITY_INTEREST_LABELS, ACTIVITY_RESPONSE_LABELS } from "@/lib/activity-options";
import type { ActivityEventItem, ActivityEventEntry } from "@/hooks/use-lead-details";

type DayGroup = {
  dateKey: string;
  label: string;
  events: ActivityEventItem[];
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
  const action = entry.action ?? (entry.type === "CALL" || entry.type === "WHATSAPP" ? entry.type : null);
  const actionLabel = action ? (ACTIVITY_ACTION_LABELS[action as keyof typeof ACTIVITY_ACTION_LABELS] ?? action) : null;
  const responseLabel = entry.response ? (ACTIVITY_RESPONSE_LABELS[entry.response as keyof typeof ACTIVITY_RESPONSE_LABELS] ?? entry.response) : null;
  const interestLabel = entry.interest ? ACTIVITY_INTEREST_LABELS[entry.interest as keyof typeof ACTIVITY_INTEREST_LABELS] ?? entry.interest : null;
  const isCall = action === "CALL";
  const generatedMessage = action && entry.response
    ? [`${action} - ${entry.response.replaceAll("_", " ")}`, entry.interest ? `(${entry.interest.replaceAll("_", " ")})` : ""].filter(Boolean).join(" ").toLowerCase()
    : null;
  const note = typeof entry.metadata?.notes === "string" && entry.metadata.notes.trim()
    ? entry.metadata.notes.trim()
    : entry.message && entry.message.toLowerCase() !== generatedMessage
      ? entry.message
      : null;

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
          {actionLabel && (
            <span className="text-sm font-medium text-[var(--color-ink)]">
              {actionLabel}{responseLabel ? ` · ${responseLabel}` : ""}
            </span>
          )}
          {interestLabel && (
            <span className="text-xs text-[var(--color-muted)]">· {interestLabel}</span>
          )}
        </div>
        {note && (
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-muted)]">&ldquo;{note}&rdquo;</p>
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
          <p className="whitespace-pre-wrap text-sm text-[var(--color-muted)]">&ldquo;{entry.message}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

function changedFieldSummary(entry: ActivityEventEntry): string[] {
  const changes = entry.metadata?.changes;
  if (!Array.isArray(changes)) return [];
  const labels: Record<string, string> = {
    displayName: "Name", company: "Company", email: "Email", phone: "Phone",
    city: "City", district: "District", state: "State", product: "Product", requirement: "Requirement",
    status: "Status", priority: "Priority", category: "Category", sourceId: "Lead source",
  };
  return changes.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const change = value as { field?: unknown; from?: unknown; to?: unknown };
    if (typeof change.field !== "string") return [];
    const label = labels[change.field] ?? change.field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
    const from = change.from === null || change.from === undefined || change.from === "" ? "None" : String(change.from);
    const to = change.to === null || change.to === undefined || change.to === "" ? "None" : String(change.to);
    return [`${label}: ${from} → ${to}`];
  });
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
    case "UPDATED": {
      const changes = changedFieldSummary(entry);
      return (
        <div className="min-w-0">
          <span className="text-sm font-medium text-[var(--color-ink)]">{entry.message || "Lead updated"}</span>
          {changes.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">{changes.map((change) => <li key={change}>{change}</li>)}</ul>}
        </div>
      );
    }
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
  const eventLabel = event.type === "INTERACTION" ? "Customer contact"
    : event.type === "SYSTEM" ? "Lead history"
      : event.type === "FOLLOW_UP" ? "Follow-up history"
        : event.type === "NOTE" ? "Legacy note"
          : event.type.replaceAll("_", " ").toLowerCase();

  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        <span className="text-xs text-[var(--color-muted)] tabular-nums pt-0.5 w-16 shrink-0">{time}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge label={eventLabel} variant="square" className="text-[10px]" />
            {event.actor?.name ? <span className="text-xs text-[var(--color-muted)]">{event.actor.name}</span> : <span className="text-xs text-[var(--color-muted)]">System</span>}
          </div>
          {event.entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2">
              <EntryRow entry={entry} />
              {onEditActivity && (entry.type === "CALL" || entry.type === "WHATSAPP") && (
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
