"use client";

import { Calendar } from "lucide-react";
import { formatDateShort } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";

export function FollowUpBadge({
  dueDate,
  dueTime,
  status,
}: {
  dueDate?: string | null;
  dueTime?: string | null;
  status?: string;
}) {
  const hydrated = useHydrated();
  if (!dueDate) return null;

  const d = new Date(dueDate);
  const dateStr = formatDateShort(dueDate, "-", hydrated ? undefined : "UTC");
  const isOverdue = hydrated && new Date() > d && status === "PENDING";

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
