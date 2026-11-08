"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { beginExportDownload, endExportDownload, type ExportDownloadGuard } from "@/lib/export/ui";

export function ExportButton({
  type,
  label,
  params,
  iconOnly,
  disabledReason,
}: {
  type: string;
  label?: string;
  params?: Record<string, string>;
  iconOnly?: boolean;
  disabledReason?: string;
}) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef<ExportDownloadGuard>({ pending: false });
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleExport = () => {
    if (!beginExportDownload(pendingRef.current)) return;
    if (disabledReason) {
      endExportDownload(pendingRef.current);
      toast.error(disabledReason);
      return;
    }

    const url = new URL("/api/export", window.location.origin);
    url.searchParams.set("type", type);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value?.trim()) url.searchParams.set(key, value.trim());
    }
    const popup = window.open(url.toString(), "_blank");
    if (!popup) {
      endExportDownload(pendingRef.current);
      toast.error("The browser blocked the download tab. Allow pop-ups for this site and try again.");
      return;
    }
    popup.opener = null;
    setPending(true);
    timerRef.current = window.setTimeout(() => {
      endExportDownload(pendingRef.current);
      setPending(false);
    }, 1200);
  };

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleExport}
        disabled={pending}
        title={disabledReason ?? `Export ${type}`}
        aria-label={`${label ?? `Export ${type}`}${pending ? " opening" : ""}`}
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
      disabled={pending}
      isLoading={pending}
      className="h-9"
    >
      <Download size={16} />
      {pending ? "Opening…" : label ?? `Export ${type}`}
    </Button>
  );
}
