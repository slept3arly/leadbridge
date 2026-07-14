import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ButtonSpinner } from "@/components/ui/loading";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
};

const variants = {
  primary:
    "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-strong)] focus-visible:ring-[var(--color-brand)]",
  secondary:
    "border border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:bg-slate-50 hover:text-[var(--color-ink)] focus-visible:ring-slate-500",
  danger:
    "bg-[var(--color-danger)] text-white hover:bg-red-700 focus-visible:ring-[var(--color-danger)]",
  ghost:
    "bg-transparent text-[var(--color-ink)] hover:bg-slate-100 hover:text-[var(--color-ink)] focus-visible:ring-slate-500",
  outline:
    "border-2 border-[var(--color-brand)] bg-transparent text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white focus-visible:ring-[var(--color-brand)]",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition duration-150 ease-in-out",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {isLoading && <ButtonSpinner className="text-current shrink-0" />}
      {children}
    </button>
  );
}
