import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function IconActionButton({
  icon: Icon,
  label,
  onClick,
  className,
  disabled,
  isLoading,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-transparent text-sm transition",
        "h-9 w-9 p-1.5",
        "text-[var(--color-muted)] hover:border-[var(--color-border)] hover:bg-slate-100 hover:text-[var(--color-ink)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2",
        className
      )}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Icon size={16} aria-hidden="true" />
      )}
    </button>
  );
}
