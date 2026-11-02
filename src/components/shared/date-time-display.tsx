"use client";

import { useHydrated } from "@/hooks/use-hydrated";

interface DateTimeDisplayProps {
  date: Date | string | null | undefined;
  format?: Intl.DateTimeFormatOptions;
  fallback?: string;
  className?: string;
}

const defaultFormat: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export function DateTimeDisplay({ date, format, fallback = "-", className }: DateTimeDisplayProps) {
  const hydrated = useHydrated();

  if (!date) return <span className={className}>{fallback}</span>;

  if (!hydrated) return <span className={className}>{fallback}</span>;
  const formatted = new Intl.DateTimeFormat("en-IN", format ?? defaultFormat).format(new Date(date));

  return <time className={className} dateTime={new Date(date).toISOString()}>{formatted}</time>;
}
