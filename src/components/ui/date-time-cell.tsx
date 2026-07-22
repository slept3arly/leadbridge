"use client";

import { useEffect, useState } from "react";

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
  const [display, setDisplay] = useState<{ date: string; time: string | null } | null>(null);
  const [hasValue, setHasValue] = useState(false);

  useEffect(() => {
    if (!value) {
      setHasValue(false);
      setDisplay(null);
      return;
    }
    setHasValue(true);
    const raw = dateFormatter.format(new Date(value));
    const parts = raw.split(",");
    setDisplay({
      date: parts[0],
      time: parts[1]?.trim() ?? null,
    });
  }, [value]);

  if (!hasValue) return <span className="text-xs text-[var(--color-muted)]">{fallback}</span>;
  if (!display) return <span className="text-xs text-[var(--color-muted)]">{fallback}</span>;

  return (
    <div className="leading-tight whitespace-nowrap">
      <div className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-[var(--color-ink)]"}`}>
        {display.date}
      </div>
      {display.time && <div className="text-xs text-[var(--color-muted)]">{display.time}</div>}
    </div>
  );
}
