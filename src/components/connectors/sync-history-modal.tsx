"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { DateTimeCell } from "@/components/ui/date-time-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ExportButton } from "@/components/shared/export-button";
import { ErrorState } from "@/components/ui/error-state";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import { sanitizeSyncErrorDiagnostic } from "@/lib/sync-error";

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

const PAGE_SIZE = 100;

export function SyncHistoryModal({
  connectorId,
  onClose,
}: {
  connectorId: string | null;
  onClose: () => void;
}) {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("");
  const [errorOutcome, setErrorOutcome] = useState<"any" | "with-error" | "without-error">("any");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loadedRequest, setLoadedRequest] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const filterParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (connectorId) params.connectorId = connectorId;
    if (status) params.status = status;
    if (errorOutcome !== "any") params.errorOutcome = errorOutcome;
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return params;
  }, [connectorId, status, errorOutcome, fromDate, toDate]);

  const filterKey = useMemo(() => new URLSearchParams(filterParams).toString(), [filterParams]);
  const requestKey = connectorId ? `${filterKey}:${reloadKey}` : null;
  const dateRangeInvalid = Boolean(fromDate && toDate && toDate < fromDate);
  const loading = requestKey !== null && !dateRangeInvalid && loadedRequest !== requestKey;
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open: !!connectorId, onClose });

  useEffect(() => {
    if (!connectorId || dateRangeInvalid) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ ...filterParams, limit: String(PAGE_SIZE), offset: "0" });
    axios
      .get(`/api/providers/sync-runs?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        const payload = res.data as { data?: SyncRun[]; total?: number; hasMore?: boolean };
        setRuns(payload.data ?? []);
        setTotal(typeof payload.total === "number" ? payload.total : (payload.data?.length ?? 0));
        setHasMore(Boolean(payload.hasMore));
        setError(null);
        setLoadedRequest(requestKey);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setRuns([]);
        setTotal(0);
        setHasMore(false);
        setError("Could not load sync history.");
        setLoadedRequest(requestKey);
      });
    return () => controller.abort();
  }, [connectorId, dateRangeInvalid, filterParams, requestKey]);

  async function handleLoadMore() {
    if (!connectorId || loadingMore || !hasMore || dateRangeInvalid) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ ...filterParams, limit: String(PAGE_SIZE), offset: String(runs.length) });
      const res = await axios.get(`/api/providers/sync-runs?${params.toString()}`);
      const payload = res.data as { data?: SyncRun[]; total?: number; hasMore?: boolean };
      const next = payload.data ?? [];
      setRuns((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...next.filter((item) => !seen.has(item.id))];
      });
      if (typeof payload.total === "number") setTotal(payload.total);
      setHasMore(Boolean(payload.hasMore));
    } catch {
      setError("Could not load additional sync runs.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (!connectorId) return null;

  const summaryText = hasMore
    ? `Showing latest ${runs.length.toLocaleString()} of ${total.toLocaleString()} matching runs`
    : `Showing ${runs.length.toLocaleString()} of ${total.toLocaleString()} matching runs`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div ref={dialogRef} data-accessible-dialog tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sync-history-title" className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
          <div>
            <h2 id="sync-history-title" className="text-lg font-semibold text-[var(--color-ink)]">
              Sync History
            </h2>
            {!loading && !error && !dateRangeInvalid && (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{summaryText}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton type="sync-history" label="Export matching runs" params={filterParams} disabledReason={dateRangeInvalid ? "The end date must not precede the start date." : undefined} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)] transition"
              aria-label="Close sync history"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]/40 px-5 py-3 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="sync-modal-status" className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Status</label>
              <Select id="sync-modal-status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 text-xs">
                <option value="">All statuses</option>
                <option value="ACTIVE">Success</option>
                <option value="ERROR">Failed</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
            <div>
              <label htmlFor="sync-modal-error-outcome" className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Error outcome</label>
              <Select id="sync-modal-error-outcome" value={errorOutcome} onChange={(e) => setErrorOutcome(e.target.value as "any" | "with-error" | "without-error")} className="h-9 text-xs">
                <option value="any">All runs</option>
                <option value="with-error">With error</option>
                <option value="without-error">Without error</option>
              </Select>
            </div>
            <div>
              <label htmlFor="sync-modal-from" className="mb-1 block text-xs font-medium text-[var(--color-muted)]">From (UTC)</label>
              <Input id="sync-modal-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <label htmlFor="sync-modal-to" className="mb-1 block text-xs font-medium text-[var(--color-muted)]">To (UTC)</label>
              <Input id="sync-modal-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>
          {dateRangeInvalid && (
            <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">The end date must not precede the start date.</p>
          )}
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
              No sync history matches the selected filters.
            </div>
          ) : (
            <div className="space-y-4">
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
                    <th className="text-left py-2 pl-4 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Error</th>
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
                        <td className="py-3 pl-4 text-left text-xs text-[var(--color-muted)]">{sanitizeSyncErrorDiagnostic(run.errorMessage) || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
              {hasMore && (
                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                  <p className="text-xs text-[var(--color-muted)]">{summaryText}</p>
                  <Button type="button" variant="secondary" size="sm" onClick={handleLoadMore} isLoading={loadingMore}>
                    Load more runs
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
