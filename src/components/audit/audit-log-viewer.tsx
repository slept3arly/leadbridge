"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchToolbar } from "@/components/shared/search-toolbar";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { SkeletonList } from "@/components/ui/loading";
import { auditExportParams } from "@/lib/audit-export-params";
import {
  Plus, Pencil, Trash2, Undo2, UserPlus, FileText, RefreshCw, ArrowRight,
  ChevronDown, ChevronRight, Clock, Activity,
} from "lucide-react";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  actor: { id: string; name: string; email: string } | null;
  createdAt: string;
};

type PageData = {
  data: AuditEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  filters: { actions: string[]; entityTypes: string[] };
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - date) / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const today = new Date();
  const entryDate = new Date(dateStr);
  const isToday = entryDate.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = entryDate.toDateString() === yesterday.toDateString();

  const timeStr = entryDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  if (isToday) return `Today \u2022 ${timeStr}`;
  if (isYesterday) return `Yesterday \u2022 ${timeStr}`;

  const month = entryDate.toLocaleDateString("en-US", { month: "short" });
  const day = entryDate.getDate();
  const year = entryDate.getFullYear() !== today.getFullYear() ? ` ${entryDate.getFullYear()}` : "";
  return `${day} ${month}${year} \u2022 ${timeStr}`;
}

function formatMetadata(meta: Record<string, unknown> | null): [string, string][] {
  if (!meta || Object.keys(meta).length === 0) return [];
  return Object.entries(meta).map(([key, value]) => {
    const label = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .replace(/_/g, " ");
    const display = value == null ? "\u2014" : String(value);
    return [label, display];
  });
}

function readableAction(action: string, entityType: string): string {
  const entity: Record<string, string> = {
    Lead: "lead", Note: "note", LeadSource: "provider", Connector: "connector",
    User: "user", RoutingRule: "routing rule", UnmatchedEmail: "unmatched email",
    ParserRequest: "parser request", Contact: "contact",
  };
  const noun = entity[entityType] ?? entityType.toLowerCase().replace(/_/g, " ");

  if (action.endsWith(".created")) return `created ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
  if (action.endsWith(".updated")) return `updated ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
  if (action.endsWith(".deleted")) return `deleted ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
  if (action.endsWith(".restored")) return `restored ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
  if (action.endsWith(".assigned")) return `assigned ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
  if (action === "connector.sync_completed") return `completed a sync for ${noun}`;
  if (action === "lead.imported") return "imported a lead";
  if (action === "user.login") return "logged in";

  const verbMatch = action.match(/\.(\w+)$/);
  const verb = verbMatch ? verbMatch[1].replace(/_/g, " ") : action;
  return `${verb} ${noun}`;
}

function actionIcon(action: string): { icon: React.ReactNode; bg: string; fg: string } {
  if (action.endsWith(".created")) return { icon: <Plus size={14} />, bg: "bg-emerald-50", fg: "text-emerald-600" };
  if (action.endsWith(".updated")) return { icon: <Pencil size={14} />, bg: "bg-blue-50", fg: "text-blue-600" };
  if (action.endsWith(".deleted")) return { icon: <Trash2 size={14} />, bg: "bg-rose-50", fg: "text-rose-600" };
  if (action.endsWith(".restored")) return { icon: <Undo2 size={14} />, bg: "bg-amber-50", fg: "text-amber-600" };
  if (action.endsWith(".assigned")) return { icon: <ArrowRight size={14} />, bg: "bg-violet-50", fg: "text-violet-600" };
  if (action.includes("sync")) return { icon: <RefreshCw size={14} />, bg: "bg-cyan-50", fg: "text-cyan-600" };
  if (action.includes("note")) return { icon: <FileText size={14} />, bg: "bg-sky-50", fg: "text-sky-600" };
  if (action.includes("user")) return { icon: <UserPlus size={14} />, bg: "bg-indigo-50", fg: "text-indigo-600" };
  return { icon: <Activity size={14} />, bg: "bg-slate-50", fg: "text-slate-600" };
}

export function AuditLogViewer() {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entityType", entityFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error("Failed to load audit logs");
      const json: PageData = await res.json();
      setPageData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, entityFilter, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtersChanged = () => {
    setPage(1);
    setExpandedId(null);
  };

  useEffect(() => {
    auditExportParams.search = search;
    auditExportParams.action = actionFilter;
    auditExportParams.entityType = entityFilter;
    auditExportParams.dateFrom = dateFrom;
    auditExportParams.dateTo = dateTo;

    return () => {
      delete auditExportParams.search;
      delete auditExportParams.action;
      delete auditExportParams.entityType;
      delete auditExportParams.dateFrom;
      delete auditExportParams.dateTo;
    };
  }, [search, actionFilter, entityFilter, dateFrom, dateTo]);

  const entries = pageData?.data ?? [];
  const pagination = pageData?.pagination;
  const filterOptions = pageData?.filters;

  return (
    <div className="space-y-4">

      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <SearchToolbar
            value={search}
            onChange={(value) => { setSearch(value); filtersChanged(); }}
            placeholder="Search activity..."
          />
        </div>
        <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); filtersChanged(); }} className="w-40 h-10 py-2.5 text-sm">
          <option value="">All actions</option>
          {filterOptions?.actions.map((a) => (
            <option key={a} value={a}>{a.replace(".", " \u2022 ")}</option>
          ))}
        </Select>
        <Select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); filtersChanged(); }} className="w-36 h-10 py-2.5 text-sm">
          <option value="">All entities</option>
          {filterOptions?.entityTypes.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); filtersChanged(); }}
          className="w-36 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 h-10 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); filtersChanged(); }}
          className="w-36 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 h-10 text-sm focus:border-[var(--color-brand)] focus:ring-3 focus:ring-[var(--color-brand)]/15 focus:outline-hidden"
        />
      </div>

      {loading ? (
        <SkeletonList items={5} />
      ) : error ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          <Clock size={32} className="text-[var(--color-muted)] mb-3" />
          <p className="text-sm font-semibold text-[var(--color-ink)]">No activity found</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">Try adjusting your filters or date range.</p>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border)] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                  <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] w-10" />
                  <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Activity</th>
                  <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] w-40">Time</th>
                  <th scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {entries.map((entry) => {
                  const icon = actionIcon(entry.action);
                  const readable = readableAction(entry.action, entry.entityType);
                  const isExpanded = expandedId === entry.id;
                  const metaPairs = formatMetadata(entry.metadata);
                  const hasDetails = metaPairs.length > 0 || entry.oldData || entry.newData;

                  return (
                    <tr key={entry.id} className="transition-colors duration-150 hover:bg-slate-50/50">
                      <td className="px-5 py-4 align-top">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${icon.bg} ${icon.fg}`}>
                          {icon.icon}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm text-[var(--color-ink)]">
                          <span className="font-medium">{entry.actor?.name ?? "System"}</span>
                          <span className="text-[var(--color-muted)]"> {readable}</span>
                        </p>
                        {isExpanded && hasDetails && (
                          <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-3">
                            {metaPairs.length > 0 && (
                              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                                {metaPairs.map(([label, value]) => (
                                  <span key={label} className="contents">
                                    <span className="font-medium text-[var(--color-muted)]">{label}</span>
                                    <span className="text-[var(--color-ink)] truncate">{value}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {(entry.oldData || entry.newData) && (
                              <div className="grid grid-cols-2 gap-4">
                                {entry.oldData && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">Previous</p>
                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                      {Object.entries(entry.oldData).map(([k, v]) => (
                                        <span key={k} className="contents">
                                          <span className="font-medium text-[var(--color-muted)]">{k}</span>
                                          <span className="text-[var(--color-ink)] truncate">{v == null ? "\u2014" : String(v)}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {entry.newData && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">New</p>
                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                      {Object.entries(entry.newData).map(([k, v]) => (
                                        <span key={k} className="contents">
                                          <span className="font-medium text-[var(--color-muted)]">{k}</span>
                                          <span className="text-[var(--color-ink)] truncate">{v == null ? "\u2014" : String(v)}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top whitespace-nowrap">
                        <span className="text-xs text-[var(--color-muted)] tabular-nums">{relativeTime(entry.createdAt)}</span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {hasDetails && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface)] transition-colors"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={setPage} />
      )}
    </div>
  );
}
