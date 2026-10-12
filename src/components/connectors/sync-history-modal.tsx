"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { DateTimeCell } from "@/components/ui/date-time-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";

type SyncRun = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  recordsSeen: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage: string | null;
};

const RUN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Success",
  INACTIVE: "Inactive",
  ERROR: "Failed",
};

const RUN_STATUS_TONES: Record<string, string> = {
  ACTIVE: "CONVERTED",
  INACTIVE: "INACTIVE",
  ERROR: "LOST",
};

export function SyncHistoryModal({
  connectorId,
  onClose,
}: {
  connectorId: string | null;
  onClose: () => void;
}) {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open: !!connectorId, onClose });

  useEffect(() => {
    if (!connectorId) return;
    setLoading(true);
    setError(null);
    axios
      .get(`/api/providers/sync-runs?connectorId=${connectorId}`)
      .then((res) => setRuns(res.data.data ?? []))
      .catch(() => { setRuns([]); setError("Could not load sync history."); })
      .finally(() => setLoading(false));
  }, [connectorId, reloadKey]);

  if (!connectorId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div ref={dialogRef} data-accessible-dialog tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sync-history-title" className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
          <h2 id="sync-history-title" className="text-lg font-semibold text-[var(--color-ink)]">
            Sync History
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)] transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--color-muted)]">
              Loading...
            </div>
          ) : error ? (
            <div className="space-y-3"><ErrorState message={error} /><Button variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>Try again</Button></div>
          ) : runs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--color-muted)]">
              No sync history available.
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Started</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Finished</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Duration</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Seen</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Created</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Updated</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Skipped</th>
                  <th className="text-left py-2 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const started = new Date(run.startedAt);
                  const completed = run.completedAt ? new Date(run.completedAt) : null;
                  const durationMs = completed ? completed.getTime() - started.getTime() : null;

                  return (
                    <tr key={run.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-3 pr-4">
                        <DateTimeCell value={run.startedAt} fallback="-" />
                      </td>
                      <td className="py-3 pr-4">
                        {run.completedAt ? <DateTimeCell value={run.completedAt} fallback="-" /> : <span className="text-[var(--color-muted)]">In progress</span>}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">
                        {durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : "-"}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">{run.recordsSeen}</td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">{run.recordsCreated}</td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">{run.recordsUpdated}</td>
                      <td className="py-3 pr-4 text-right font-mono text-xs">{run.recordsSkipped}</td>
                      <td className="py-3 text-left">
                        <Badge
                          label={RUN_STATUS_LABELS[run.status] ?? run.status}
                          toneKey={RUN_STATUS_TONES[run.status] ?? "INACTIVE"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}
