"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex items-center rounded-xl bg-slate-100/80 p-1">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              isActive
                ? "bg-white text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium",
                  isActive
                    ? "bg-[var(--color-border)] text-[var(--color-muted)]"
                    : "text-[var(--color-muted)]",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
