"use client";

import { formatDate, formatTimeValue } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";

export function InteractionHeader({
  name,
  createdAt,
}: {
  name: string;
  createdAt: string;
}) {
  const hydrated = useHydrated();
  const timeZone = hydrated ? undefined : "UTC";

  return (
    <div>
      <p className="text-sm font-bold text-[var(--color-ink)]">{name}</p>
      <p className="text-xs text-[var(--color-muted)]">
        {formatDate(createdAt, "-", timeZone)} · {formatTimeValue(createdAt, "-", timeZone)}
      </p>
    </div>
  );
}
