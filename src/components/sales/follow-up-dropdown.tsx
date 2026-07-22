"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

const OPTIONS = [
  { label: "Overdue Follow-ups", filter: "overdue" },
  { label: "Today\u2019s Follow-ups", filter: "today" },
  { label: "Upcoming Follow-ups", filter: "upcoming" },
];

export function FollowUpDropdown() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition hover:bg-slate-50 hover:text-[var(--color-ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 h-9"
      >
        <Calendar size={16} />
        Follow-ups
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-lg">
          {OPTIONS.map((opt) => (
            <button
              key={opt.filter}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/sales/my-leads?filter.followUp=${opt.filter}`);
              }}
              className="flex w-full items-center px-4 py-2.5 text-left text-sm text-[var(--color-ink)] transition hover:bg-slate-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
