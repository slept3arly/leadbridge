"use client";

import { Pencil, X } from "lucide-react";
import { LeadInfoSection } from "@/components/sales/lead-info-section";
import { Button } from "@/components/ui/button";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";

type LeadCustomer = Parameters<typeof LeadInfoSection>[0]["lead"];

export function LeadDetailsPopup({
  open,
  lead,
  onClose,
  onEdit,
}: {
  open: boolean;
  lead: LeadCustomer;
  onClose: () => void;
  onEdit: () => void;
}) {
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open, onClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        data-accessible-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-view-details-title"
        tabIndex={-1}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-6">
          <div>
            <h2 id="lead-view-details-title" className="text-lg font-semibold text-[var(--color-ink)]">View Details</h2>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">{lead.displayName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close lead details">
            <X size={18} aria-hidden="true" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-3 sm:p-5">
          <LeadInfoSection lead={lead} />
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:px-6">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="black" onClick={onEdit} data-autofocus>
            <Pencil size={15} aria-hidden="true" />Edit Details
          </Button>
        </footer>
      </div>
    </div>
  );
}
