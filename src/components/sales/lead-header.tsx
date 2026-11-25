"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, X } from "lucide-react";
import { getCategoryLabel, getPriorityLabel, getStatusLabel } from "@/lib/lead-constants";
import { getLeadDisplayName } from "@/lib/lead-display";

type LeadWorkspaceHeaderProps = {
  lead: {
    id: string;
    leadNumber?: string;
    displayName: string | null;
    company: string | null;
    phone?: string | null;
    alternatePhone?: string | null;
    email?: string | null;
    status: string;
    priority: string;
    category?: string | null;
    isArchived?: boolean;
    assignedUser?: { id: string; name: string } | null;
  };
  onClose: () => void;
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
  onViewDetails,
  onToggleArchive,
  onDelete,
  archiving,
  deleting = false,
  canArchive = false,
  canDelete = false,
}: LeadWorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-[var(--color-border)] bg-white/95 px-4 py-2 backdrop-blur sm:px-6">
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 xl:flex-nowrap">
          <div className="flex min-w-0 max-w-full flex-col justify-center xl:max-w-[26%]">
            <h2 id="lead-workspace-title" className="truncate text-lg font-semibold leading-6 text-[var(--color-ink)]">{getLeadDisplayName(lead.displayName)}</h2>
            {lead.company && <span className="truncate text-sm leading-5 text-[var(--color-muted)]">{lead.company}</span>}
          </div>
          {lead.phone && <span className="inline-flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap text-sm text-[var(--color-muted)] xl:max-w-[16%]" aria-label={`Phone ${lead.phone}`}><Phone size={13} className="shrink-0" aria-hidden="true" /><span className="truncate">{lead.phone}</span></span>}
          {lead.alternatePhone && <span className="inline-flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap text-sm text-[var(--color-muted)] xl:max-w-[16%]" aria-label={`Alternate phone ${lead.alternatePhone}`}><Phone size={13} className="shrink-0" aria-hidden="true" /><span className="truncate">Alternate: {lead.alternatePhone}</span></span>}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Badge label={getStatusLabel(lead.status)} toneKey={lead.status} />
            <Badge label={getPriorityLabel(lead.priority)} toneKey={lead.priority} />
            {lead.category && <Badge label={getCategoryLabel(lead.category)} toneKey={lead.category} />}
            {lead.isArchived && <Badge label="Archived" />}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 xl:flex-nowrap">
          <Button size="sm" variant="secondary" onClick={onViewDetails} className="min-h-10">View Details</Button>
          {canArchive && <Button size="sm" variant="ghost" isLoading={archiving} onClick={onToggleArchive} className="min-h-10">{lead.isArchived ? "Restore" : "Archive"}</Button>}
          {canDelete && onDelete && <Button size="sm" variant="ghost" isLoading={deleting} onClick={onDelete} className="min-h-10 text-red-600 hover:bg-red-50 hover:text-red-700">Delete</Button>}
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close lead workspace" className="min-h-10 min-w-10 px-2"><X size={18} /></Button>
        </div>
      </div>
    </header>
  );
}
