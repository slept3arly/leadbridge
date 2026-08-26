"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Mode = "single" | "range";

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateForInputInTimeZone(date: Date, timeZone?: string): string {
  if (!timeZone) return formatDateForInput(date);
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

function formatDisplayDateTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${formatDisplayDate(date)} ${h12}:${minutes} ${ampm}`;
}

export type DateRangeValue = {
  dateFrom?: Date;
  dateTo?: Date;
};

export function DateRangePicker({
  value,
  onChange,
}: {
  value?: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [hydrated, setHydrated] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const startDateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);

  const hasValue = value?.dateFrom !== undefined;

  const triggerLabel = (() => {
    if (!value?.dateFrom) return "Date Range";
    const showTime = false;
    const timeZone = hydrated ? undefined : "UTC";
    const from = showTime ? formatDisplayDateTime(value.dateFrom) : formatDisplayDate(value.dateFrom, timeZone);
    if (value.dateTo) {
      const to = showTime ? formatDisplayDateTime(value.dateTo) : formatDisplayDate(value.dateTo, timeZone);
      return `${from} → ${to}`;
    }
    return from;
  })();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const apply = useCallback(() => {
    const startInput = startDateRef.current;
    if (!startInput?.value) return;

    const start = new Date(startInput.value + "T00:00:00");
    if (startTimeRef.current?.value) {
      const [h, m] = startTimeRef.current.value.split(":").map(Number);
      start.setHours(h, m, 0, 0);
    }

    let end: Date | undefined;
    if (mode === "range" && endDateRef.current?.value) {
      end = new Date(endDateRef.current.value + "T23:59:59");
      if (endTimeRef.current?.value) {
        const [h, m] = endTimeRef.current.value.split(":").map(Number);
        end.setHours(h, m, 59, 999);
      }
    }

    onChange({ dateFrom: start, dateTo: end });
    setOpen(false);
  }, [mode, onChange]);

  const clear = useCallback(() => {
    onChange({});
    setOpen(false);
  }, [onChange]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition w-full sm:w-auto ${
          hasValue
            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]"
            : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-ink)] hover:border-[var(--color-brand)]/40"
        }`}
      >
        <Calendar size={14} />
        <span>{triggerLabel}</span>
        {hasValue && (
          <X
            size={12}
            className="ml-1 cursor-pointer hover:text-[var(--color-danger)]"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
          />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-50 mt-2 w-80 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-xl"
        >
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 mb-4">
            <button
              onClick={() => setMode("single")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mode === "single"
                  ? "bg-white text-[var(--color-ink)] shadow-xs"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Single Date
            </button>
            <button
              onClick={() => setMode("range")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mode === "range"
                  ? "bg-white text-[var(--color-ink)] shadow-xs"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Date Range
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                {mode === "range" ? "Start Date" : "Date"}
              </label>
              <input
                ref={startDateRef}
                type="date"
                defaultValue={value?.dateFrom ? formatDateForInputInTimeZone(value.dateFrom, hydrated ? undefined : "UTC") : ""}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
              />
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                  Add time
                </summary>
                <input
                  ref={startTimeRef}
                  type="time"
                defaultValue={value?.dateFrom ? `${String(hydrated ? value.dateFrom.getHours() : value.dateFrom.getUTCHours()).padStart(2, "0")}:${String(hydrated ? value.dateFrom.getMinutes() : value.dateFrom.getUTCMinutes()).padStart(2, "0")}` : ""}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
                />
              </details>
            </div>

            {mode === "range" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                  End Date
                </label>
                <input
                  ref={endDateRef}
                  type="date"
                defaultValue={value?.dateTo ? formatDateForInputInTimeZone(value.dateTo, hydrated ? undefined : "UTC") : ""}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
                />
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                    Add time
                  </summary>
                  <input
                    ref={endTimeRef}
                    type="time"
                defaultValue={value?.dateTo ? `${String(hydrated ? value.dateTo.getHours() : value.dateTo.getUTCHours()).padStart(2, "0")}:${String(hydrated ? value.dateTo.getMinutes() : value.dateTo.getUTCMinutes()).padStart(2, "0")}` : ""}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
                  />
                </details>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
            <Button size="sm" variant="ghost" onClick={clear} className="flex-1">
              Clear
            </Button>
            <Button size="sm" onClick={apply} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
