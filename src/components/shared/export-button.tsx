"use client";

import { Download } from "lucide-react";
import { auditExportParams } from "@/lib/audit-export-params";
import { Button } from "@/components/ui/button";

export function ExportButton({ type, label, params, iconOnly }: { type: string; label?: string; params?: Record<string, string>; iconOnly?: boolean }) {
  const handleExport = () => {
    const url = new URL(`/api/export?type=${type}`, window.location.origin);
    const combined = { ...auditExportParams, ...params };
    for (const [key, value] of Object.entries(combined)) {
      if (value) url.searchParams.set(key, value);
    }
    window.open(url.toString(), "_blank");
  };

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleExport}
        title="Export"
        aria-label="Export leads"
        className="h-9 w-9 p-1.5"
      >
        <Download size={16} aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleExport}
      className="h-9"
    >
      <Download size={16} />
      {label ?? `Export ${type}`}
    </Button>
  );
}
