"use client";

import { Download } from "lucide-react";

export function ExportButton({ type, label, params, iconOnly }: { type: string; label?: string; params?: Record<string, string>; iconOnly?: boolean }) {
  const handleExport = () => {
    const url = new URL(`/api/export?type=${type}`, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
      }
    }
    window.open(url.toString(), "_blank");
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleExport}
        title="Export"
        aria-label="Export leads"
        className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink)] transition hover:bg-slate-50 hover:text-[var(--color-ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 h-9 w-9 p-1.5"
      >
        <Download size={16} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition hover:bg-slate-50 hover:text-[var(--color-ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 h-9"
    >
      <Download size={16} />
      {label ?? `Export ${type}`}
    </button>
  );
}
