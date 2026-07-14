import type { ReactNode } from "react";

export function Navbar({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/85 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-muted)]">LeadBridge</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      </div>
      {actions}
    </div>
  );
}
