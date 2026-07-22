import type { ReactNode } from "react";
import { ResyncButton } from "@/components/shared/resync-button";

export function Navbar({
  title,
  actions,
  showResync,
  followUpDropdown,
}: {
  title: string;
  actions?: ReactNode;
  showResync?: boolean;
  followUpDropdown?: ReactNode;
}) {
  return (
    <div className="relative z-10 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/85 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-muted)]">LeadBridge</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {showResync && <ResyncButton />}
        {followUpDropdown}
        {actions}
      </div>
    </div>
  );
}
