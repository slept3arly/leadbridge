"use client";

import { useHydrated } from "@/hooks/use-hydrated";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

export function DateTimeCell({
  value,
  overdue,
  fallback = "-",
}: {
  value: Date | string | null | undefined;
  overdue?: boolean;
  fallback?: string;
}) {
  const hydrated = useHydrated();
  if (!value || !hydrated) return <span className="text-xs text-[var(--color-muted)]">{fallback}</span>;
  const parts = dateFormatter.format(new Date(value)).split(",");
  const display = { date: parts[0], time: parts[1]?.trim() ?? null };

  return (
    <div className="leading-tight whitespace-nowrap">
      <div className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-[var(--color-ink)]"}`}>
        {display.date}
      </div>
      {display.time && <div className="text-xs text-[var(--color-muted)]">{display.time}</div>}
    </div>
  );
}
