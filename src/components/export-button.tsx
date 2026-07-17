"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function ExportButton({ type, label, params }: { type: string; label?: string; params?: Record<string, string> }) {
  const handleExport = () => {
    const url = new URL(`/api/export?type=${type}`, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
      }
    }
    window.open(url.toString(), "_blank");
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download size={16} />
      {label ?? `Export ${type}`}
    </Button>
  );
}
