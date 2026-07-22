"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ExpandableSection({
  children,
  initialVisible = 5,
  itemCount,
  showMoreLabel = "Show More",
  showLessLabel = "Show Less",
  className,
}: {
  children: ReactNode[];
  initialVisible?: number;
  itemCount?: number;
  showMoreLabel?: string;
  showLessLabel?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = itemCount ?? children.length;
  const visible = expanded ? total : Math.min(initialVisible, total);

  return (
    <div className={cn("space-y-2", className)}>
      {children.slice(0, visible)}
      {total > initialVisible && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold text-[var(--color-brand)] hover:underline focus:outline-hidden"
        >
          {expanded ? showLessLabel : `${showMoreLabel} (${total - initialVisible} more)`}
        </button>
      )}
    </div>
  );
}
