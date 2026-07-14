import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants = {
  primary: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-strong)]",
  secondary: "border border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:bg-slate-50",
  ghost: "bg-transparent text-[var(--color-ink)] hover:bg-black/60",
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
