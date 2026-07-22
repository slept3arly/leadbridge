"use client";

import { Calendar } from "lucide-react";

export function FollowUpBadge({
  dueDate,
  dueTime,
  status,
}: {
  dueDate?: string | null;
  dueTime?: string | null;
  status?: string;
}) {
  if (!dueDate) return null;

  const d = new Date(dueDate);
  const dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const isOverdue = new Date() > d && status === "PENDING";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
      status === "COMPLETED" ? "bg-green-50 text-green-700" :
      isOverdue ? "bg-red-50 text-red-700" :
      "bg-amber-50 text-amber-700"
    }`}>
      <Calendar size={10} />
      {dateStr}{dueTime ? ` ${dueTime}` : ""}
      {status === "COMPLETED" && " ✓"}
    </span>
  );
}
