import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, disabled, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      disabled={disabled}
      className={cn(
        "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 h-10 text-sm text-[var(--color-ink)] transition-all placeholder-slate-400",
        "focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}
