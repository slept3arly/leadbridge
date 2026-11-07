import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccordionSection({
  id,
  title,
  status,
  expanded,
  onToggle,
  children,
  autoFocus = false,
  className,
}: {
  id: string;
  title: string;
  status: "Required" | "Optional";
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  autoFocus?: boolean;
  className?: string;
}) {
  const triggerId = `${id}-trigger`;
  const panelId = `${id}-panel`;

  return (
    <section className={cn("overflow-hidden rounded-xl border border-[var(--color-border)] bg-white", className)}>
      <button
        id={triggerId}
        type="button"
        data-autofocus={autoFocus || undefined}
        aria-label={`${title}, ${status}. ${expanded ? "Collapse" : "Expand"} section`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
          "bg-slate-50/70 text-[var(--color-ink)] hover:bg-slate-100",
          "focus-visible:z-10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)]",
          expanded && "border-b border-[var(--color-border)]"
        )}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold">{title}</span>
          <span className={cn(
            "text-xs font-medium",
            status === "Required" ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"
          )}>
            {status}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          size={16}
          className={cn("shrink-0 text-[var(--color-muted)] transition-transform duration-150", expanded && "rotate-180")}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!expanded}
        className="p-4"
      >
        {children}
      </div>
    </section>
  );
}
