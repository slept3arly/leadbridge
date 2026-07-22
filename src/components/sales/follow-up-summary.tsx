function fmtDate(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(value: string | Date) {
  if (typeof value === "string" && !value.includes("T")) {
    const [h, m] = value.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const ampm = h >= 12 ? "PM" : "AM";
      return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

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
  if (!dueDate && status !== "COMPLETED") return null;

  const isOverdue =
    status === "PENDING" && !!dueDate && new Date(dueDate) < new Date();

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
              {fmtDate(dueDate)}
              {dueTime ? ` · ${fmtTime(dueTime)}` : ""}
            </span>
          </div>
        )}
        {status === "COMPLETED" && completedAt && (
          <div className="flex">
            <span className="text-xs text-[var(--color-muted)] w-24 shrink-0">
              Completed
            </span>
            <span>
              {fmtDate(completedAt)} · {fmtTime(completedAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
