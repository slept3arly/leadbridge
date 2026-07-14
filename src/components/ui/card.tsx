import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-[0_18px_50px_rgba(19,36,77,0.08)]", className)}>
      {children}
    </div>
  );
}
