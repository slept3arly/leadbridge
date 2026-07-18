"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchToolbar({
  value,
  onChange,
  placeholder = "Search leads...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full pl-10"
      />
    </div>
  );
}
