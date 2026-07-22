function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function FollowUpStatus({
  dueDate,
  dueTime,
  status,
}: {
  dueDate: string | null;
  dueTime: string | null;
  status: string;
}) {
  if (!dueDate) return null;

  const d = new Date(dueDate);
  const isOverdue = new Date() > d && status === "PENDING";

  const config =
    status === "COMPLETED"
      ? {
          label: "Completed",
          color: "bg-green-50 border-green-200 text-green-800",
          dot: "bg-green-500",
        }
      : isOverdue
        ? {
            label: "Overdue",
            color: "bg-red-50 border-red-200 text-red-800",
            dot: "bg-red-500",
          }
        : {
            label: "Scheduled",
            color: "bg-amber-50 border-amber-200 text-amber-800",
            dot: "bg-amber-500",
          };

  const dateStr = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className={`rounded-lg border p-3 space-y-1 ${config.color}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
        <span className="text-xs font-semibold">{config.label}</span>
      </div>
      <p className="text-sm font-medium">{dateStr}</p>
      {dueTime && <p className="text-xs opacity-75">{formatTime(dueTime)}</p>}
    </div>
  );
}
