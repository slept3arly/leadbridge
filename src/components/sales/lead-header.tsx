"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Eye, Mail, Phone, X } from "lucide-react";
import { getCategoryLabel, getPriorityLabel, getStatusLabel } from "@/lib/lead-constants";

type LeadWorkspaceHeaderProps = {
  lead: {
    id: string;
    leadNumber?: string;
    displayName: string;
    company: string | null;
    phone?: string | null;
    email?: string | null;
    status: string;
    priority: string;
    category?: string | null;
    isArchived?: boolean;
    assignedUser?: { id: string; name: string } | null;
  };
  onClose: () => void;
  onRecordProgress: () => void;
  onViewDetails: () => void;
  onToggleArchive: () => void;
  onDelete?: () => void;
  archiving: boolean;
  deleting?: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
};

export function LeadHeader({
  lead,
  onClose,
  onRecordProgress,
  onViewDetails,
  onToggleArchive,
  onDelete,
  archiving,
  deleting = false,
  canArchive = false,
  canDelete = false,
}: LeadWorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-[var(--color-border)] bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id="lead-workspace-title" className="max-w-full truncate text-xl font-semibold text-[var(--color-ink)] sm:text-2xl">{lead.displayName}</h2>
            {lead.leadNumber && <span className="text-xs font-medium text-[var(--color-muted)]">#{lead.leadNumber}</span>}
            {lead.isArchived && <Badge label="Archived" />}
          </div>
          {lead.company && <p className="mt-0.5 text-sm text-[var(--color-muted)]">{lead.company}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {lead.phone && <a href={`tel:${lead.phone}`} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 text-sm text-[var(--color-ink)] hover:bg-slate-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]" aria-label={`Call ${lead.displayName} at ${lead.phone}`}><Phone size={14} aria-hidden="true" />{lead.phone}</a>}
            {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 text-sm text-[var(--color-ink)] hover:bg-slate-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"><Mail size={14} className="shrink-0" aria-hidden="true" /><span className="truncate">{lead.email}</span></a>}
            {!lead.phone && !lead.email && <span className="text-sm text-[var(--color-muted)]">No phone or email recorded</span>}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge label={getStatusLabel(lead.status)} toneKey={lead.status} />
            <Badge label={getPriorityLabel(lead.priority)} toneKey={lead.priority} />
            {lead.category && <Badge label={getCategoryLabel(lead.category)} toneKey={lead.category} />}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="black" onClick={onRecordProgress}><ArrowUpRight size={16} />Record Progress</Button>
          <Button variant="secondary" onClick={onViewDetails}><Eye size={15} />View Details</Button>
          {canArchive && <Button variant="ghost" isLoading={archiving} onClick={onToggleArchive}>{lead.isArchived ? "Restore" : "Archive"}</Button>}
          {canDelete && onDelete && <Button variant="ghost" isLoading={deleting} onClick={onDelete} className="text-red-600 hover:bg-red-50 hover:text-red-700">Delete</Button>}
          <Button variant="ghost" onClick={onClose} aria-label="Close lead workspace"><X size={18} /></Button>
        </div>
      </div>
    </header>
  );
}
