"use client";

import { FilterChip } from "@/components/ui/filter-chip";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

type ActiveFilter = {
  key: string;
  label: string;
};

export function ActiveFilters({
  filters,
  onRemove,
  onReset,
}: {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
  onReset: () => void;
}) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <FilterChip
          key={filter.key}
          label={filter.label}
          onRemove={() => onRemove(filter.key)}
        />
      ))}
      <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-xs">
        <RotateCcw size={12} />
        Reset
      </Button>
    </div>
  );
}
