"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Archive, X, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

type ArchivedLead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  status: string;
  priority: string;
  createdAt: string;
};

const INITIAL_DISPLAY_COUNT = 5;

export function ArchivedLeadsModal({
  onClose,
  onLeadClick,
  isAdmin,
}: {
  onClose: () => void;
  onLeadClick?: (leadId: string) => void;
  isAdmin: boolean;
}) {
  const [leads, setLeads] = useState<ArchivedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get("/api/leads?filter.archived=true&pageSize=100")
      .then((res) => {
        if (cancelled) return;
        setLeads(res.data.data ?? res.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleRestore = useCallback(
    async (leadId: string) => {
      setRestoringId(leadId);
      try {
        await axios.patch(`/api/leads/${leadId}`, { isArchived: false });
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
      } catch {
        // silently fail
      } finally {
        setRestoringId(null);
      }
    },
    []
  );

  const displayed = showAll ? leads : leads.slice(0, INITIAL_DISPLAY_COUNT);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 mt-10 mb-6 w-full max-w-2xl flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden max-h-[75vh]">
        <div className="shrink-0 border-b border-[var(--color-border)] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Archive className="h-5 w-5 text-[var(--color-muted)]" />
              <h2 className="text-lg font-bold">Archived Leads</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 hover:bg-slate-100 transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Archive className="mb-3 h-10 w-10 text-[var(--color-muted)]" />
              <p className="text-sm font-medium text-[var(--color-ink)]">No archived leads</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">Archived leads will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 transition hover:border-[var(--color-brand)]/30"
                >
                  <button
                    onClick={() => onLeadClick?.(lead.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm font-semibold truncate">{lead.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--color-muted)]">
                        {lead.company ?? "No company"}
                      </span>
                      <Badge label={lead.status} />
                      <Badge label={lead.priority} />
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-xs text-[var(--color-muted)] hidden sm:block">
                      {formatDate(lead.createdAt)}
                    </span>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={restoringId === lead.id}
                        onClick={() => handleRestore(lead.id)}
                        aria-label="Restore"
                      >
                        <RotateCcw size={14} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onLeadClick?.(lead.id)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}

              {leads.length > INITIAL_DISPLAY_COUNT && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-2.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
                >
                  {showAll ? (
                    <>
                      <ChevronUp size={14} /> Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> Show {leads.length - INITIAL_DISPLAY_COUNT} More
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
