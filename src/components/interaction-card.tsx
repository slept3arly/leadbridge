import type { ReactNode } from "react";

export function InteractionCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white shadow-xs">
      <div className="p-4 space-y-3">
        {children}
      </div>
    </div>
  );
}
