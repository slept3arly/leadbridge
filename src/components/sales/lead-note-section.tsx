import type { ReactNode } from "react";

export function LeadNoteSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
        {title}
      </h4>
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-ink)]">
        {children}
      </div>
    </div>
  );
}
