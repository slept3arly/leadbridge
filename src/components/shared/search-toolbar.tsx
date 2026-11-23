"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchToolbar({
  value,
  onChange,
  ariaLabel = "Search",
  placeholder = "Search by name, company, email, phone, or lead number",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const inputId = useId();

  return (
    <div className="relative w-full">
      <label htmlFor={inputId} className="sr-only">{ariaLabel}</label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
      <Input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 py-1.5"
      />
    </div>
  );
}
