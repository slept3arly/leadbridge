"use client";

import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES, LEAD_PRIORITIES, LEAD_CATEGORIES } from "@/lib/lead-constants";

type LeadHeaderProps = {
  lead: {
    displayName: string;
    company: string | null;
    status: string;
    priority: string;
    category?: string | null;
    isArchived?: boolean;
  };
  onClose: () => void;
  onChange: (field: string, value: string) => void;
  onUpdate: () => void;
  onToggleArchive: () => void;
  onDelete?: () => void;
  saving: boolean;
  archiving: boolean;
  deleting?: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
};

export function LeadHeader({
  lead,
  onClose,
  onChange,
  onUpdate,
  onToggleArchive,
  onDelete,
  saving,
  archiving,
  deleting = false,
  canArchive = false,
  canDelete = false,
}: LeadHeaderProps) {
  return (
    <div className="shrink-0 border-b border-[var(--color-border)] bg-white">
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Identity */}
        <div className="min-w-0 shrink-0">
          <h2 className="text-lg font-bold leading-tight truncate max-w-[200px]">{lead.displayName}</h2>
          <p className="text-sm text-[var(--color-muted)] leading-tight truncate max-w-[200px]">{lead.company ?? "No company"}</p>
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-[var(--color-border)] shrink-0" />

        {/* Dropdowns */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Status</label>
            <Select value={lead.status} onChange={(e) => onChange("status", e.target.value)} className="w-auto min-h-[40px] min-w-[120px] rounded-lg px-3">
              {LEAD_STATUSES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Priority</label>
            <Select value={lead.priority} onChange={(e) => onChange("priority", e.target.value)} className="w-auto min-h-[40px] min-w-[110px] rounded-lg px-3">
              {LEAD_PRIORITIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Category</label>
            <Select value={lead.category ?? ""} onChange={(e) => onChange("category", e.target.value)} className="w-auto min-h-[40px] min-w-[140px] rounded-lg px-3">
              <option value="">None</option>
              {LEAD_CATEGORIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" isLoading={saving} onClick={onUpdate} className="h-10 px-4">
            Save
          </Button>
          {canArchive && (
            <Button size="sm" variant="secondary" isLoading={archiving} onClick={onToggleArchive} className="h-10 px-4">
              {lead.isArchived ? "Restore" : "Archive"}
            </Button>
          )}
          {canDelete && onDelete && (
            <Button size="sm" variant="ghost" isLoading={deleting} onClick={onDelete} className="h-10 px-4 text-red-600 hover:text-red-700 hover:bg-red-50">
              Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} className="h-10 px-4">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
