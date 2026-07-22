"use client";

import { useEffect, useState } from "react";

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
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setFormatted(null);
      return;
    }
    setFormatted(
      new Intl.DateTimeFormat("en-IN", format ?? defaultFormat).format(new Date(date))
    );
  }, [date, format]);

  if (!date) return <span className={className}>{fallback}</span>;

  if (!formatted) return <span className={className}>{fallback}</span>;

  return <time className={className} dateTime={new Date(date).toISOString()}>{formatted}</time>;
}
