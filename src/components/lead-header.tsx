"use client";

import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Archive, RotateCcw } from "lucide-react";
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
  saving: boolean;
  archiving: boolean;
};

export function LeadHeader({
  lead,
  onClose,
  onChange,
  onUpdate,
  onToggleArchive,
  saving,
  archiving,
}: LeadHeaderProps) {
  return (
    <div className="shrink-0 border-b border-[var(--color-border)] bg-white">
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold truncate">{lead.displayName}</h2>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">{lead.company ?? "No company"}</p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 ml-4 rounded-xl p-2 hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-end gap-3 px-5 pb-4">
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Status</label>
            <Select value={lead.status} onChange={(e) => onChange("status", e.target.value)} className="h-10 w-32">
              {LEAD_STATUSES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Priority</label>
            <Select value={lead.priority} onChange={(e) => onChange("priority", e.target.value)} className="h-10 w-32">
              {LEAD_PRIORITIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Category</label>
            <Select value={lead.category ?? ""} onChange={(e) => onChange("category", e.target.value)} className="h-10 w-40">
              <option value="">None</option>
              {LEAD_CATEGORIES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="secondary" isLoading={saving} onClick={onUpdate} className="h-10">
            Update
          </Button>
          <Button size="sm" variant="ghost" isLoading={archiving} onClick={onToggleArchive} className="h-10">
            {lead.isArchived ? <RotateCcw size={14} /> : <Archive size={14} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
