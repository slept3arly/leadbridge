import type { ReactNode } from "react";

export function LeadActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {children}
    </div>
  );
}
