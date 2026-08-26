"use client";

import { formatDate, formatTime, formatTimeValue } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";

export function FollowUpSummary({
  status,
  dueDate,
  dueTime,
  completedAt,
}: {
  status: string;
  dueDate: string | null;
  dueTime: string | null;
  completedAt: string | null;
}) {
  const hydrated = useHydrated();
  const timeZone = hydrated ? undefined : "UTC";
  if (!dueDate && status !== "COMPLETED") return null;

  const isOverdue =
    hydrated && status === "PENDING" && !!dueDate && new Date(dueDate) < new Date();

  const displayStatus =
    status === "COMPLETED"
      ? "Completed"
      : isOverdue
        ? "Overdue"
        : "Pending";

  const statusColor =
    status === "COMPLETED"
      ? "text-green-600"
      : isOverdue
        ? "text-red-600"
        : "text-amber-600";

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
        FOLLOW-UP
      </h4>
      <div className="text-sm space-y-1">
        <div className="flex">
          <span className="text-xs text-[var(--color-muted)] w-24 shrink-0">
            Status
          </span>
          <span className={`font-medium ${statusColor}`}>{displayStatus}</span>
        </div>
        {dueDate && (
          <div className="flex">
            <span className="text-xs text-[var(--color-muted)] w-24 shrink-0">
              Scheduled
            </span>
            <span>
              {formatDate(dueDate, "-", timeZone)}
              {dueTime ? ` · ${formatTime(dueTime)}` : ""}
            </span>
          </div>
        )}
        {status === "COMPLETED" && completedAt && (
          <div className="flex">
            <span className="text-xs text-[var(--color-muted)] w-24 shrink-0">
              Completed
            </span>
            <span>
              {formatDate(completedAt, "-", timeZone)} · {formatTimeValue(completedAt, "-", timeZone)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
