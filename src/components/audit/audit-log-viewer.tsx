"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/ui/pagination";
import { LoadingSpinner } from "@/components/ui/loading";
import { DateTimeDisplay } from "@/components/shared/date-time-display";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  actorId: string | null;
  actor: { id: string; name: string; email: string } | null;
  createdAt: string;
};

export function AuditLogViewer() {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "50");
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entityType", entityFilter);
      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error("Failed to load audit logs");
      const json = await res.json();
      setData(json.data);
      setTotalPages(json.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns: Column<AuditEntry>[] = [
    { key: "timestamp", header: "Timestamp", render: (entry) => <DateTimeDisplay date={entry.createdAt} /> },
    { key: "action", header: "Action", render: (entry) => <Badge label={entry.action} /> },
    { key: "entityType", header: "Entity", render: (entry) => entry.entityType },
    { key: "entityId", header: "Entity ID", render: (entry) => entry.entityId ?? "—" },
    { key: "actor", header: "Actor", render: (entry) => entry.actor?.name ?? "System" },
    { key: "metadata", header: "Details", render: (entry) => entry.metadata ? JSON.stringify(entry.metadata).slice(0, 80) : "—" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search actions, entities, actors..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
          <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
            <option value="">All actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="restored">Restored</option>
            <option value="assigned">Assigned</option>
          </Select>
          <Select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}>
            <option value="">All entities</option>
            <option value="lead">Lead</option>
            <option value="note">Note</option>
            <option value="provider">Provider</option>
            <option value="routing_rule">Routing Rule</option>
            <option value="unmatched_email">Unmatched Email</option>
            <option value="parser_request">Parser Request</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : error ? (
        <Card><p className="text-red-600">{error}</p></Card>
      ) : (
        <>
          <DataTable rows={data} columns={columns} emptyTitle="No audit logs found" emptyDescription="Actions recorded by the system will appear here." />
          {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onChange={setPage} /> : null}
        </>
      )}
    </div>
  );
}
