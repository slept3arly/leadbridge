import { formatDateTime } from "@/lib/utils";

export function DateTimeCell({
  value,
  overdue,
  fallback = "-",
}: {
  value: Date | string | null | undefined;
  overdue?: boolean;
  fallback?: string;
}) {
  if (!value) return <span className="text-xs text-[var(--color-muted)]">{fallback}</span>;
  const formatted = formatDateTime(value);
  const date = formatted.split(",")[0];
  const time = formatted.split(",")[1]?.trim();
  return (
    <div className="leading-tight whitespace-nowrap">
      <div className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-[var(--color-ink)]"}`}>{date}</div>
      {time && <div className="text-xs text-[var(--color-muted)]">{time}</div>}
    </div>
  );
}
