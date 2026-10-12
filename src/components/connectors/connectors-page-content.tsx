"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ExportButton } from "@/components/shared/export-button";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { EmptyState } from "@/components/ui/empty-state";
import { DateTimeCell } from "@/components/ui/date-time-cell";
import { KpiCard } from "@/components/shared/kpi-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ConnectorEditModal } from "@/components/connectors/connector-edit-modal";
import { SyncHistoryModal } from "@/components/connectors/sync-history-modal";
import { Play, RefreshCw, Plus, Trash2, Bug, WifiOff, History } from "lucide-react";
import { toast } from "sonner";
import type { SerializedConnector, KpiMetrics } from "@/app/(dashboard)/admin/connectors/page";

const HEALTH_LABELS: Record<string, string> = {
  HEALTHY: "Healthy",
  WARNING: "Warning",
  ERROR: "Error",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ERROR: "Error",
};

const SCHEDULE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  EVERY_5_MIN: "Every 5 min",
  EVERY_15_MIN: "Every 15 min",
  EVERY_30_MIN: "Every 30 min",
  HOURLY: "Hourly",
  DAILY: "Daily",
  CUSTOM: "Custom",
};

export function ConnectorsPageContent({
  connectors,
  kpi,
  providers,
}: {
  connectors: SerializedConnector[];
  kpi: KpiMetrics;
  providers: Array<{ id: string; name: string; active: boolean }>;
}) {
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<SerializedConnector | null>(null);
  const [editMode, setEditMode] = useState<"create" | "edit">("create");

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ connectorId: string; success: boolean; message: string } | null>(null);

  const [historyConnectorId, setHistoryConnectorId] = useState<string | null>(null);
  const [deleteConnector, setDeleteConnector] = useState<SerializedConnector | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setSelectedConnector(null);
    setEditMode("create");
    setEditOpen(true);
  };

  const openEdit = (connector: SerializedConnector) => {
    setSelectedConnector(connector);
    setEditMode("edit");
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setSelectedConnector(null);
  };

  const handleTestConnection = useCallback(async (connector: SerializedConnector) => {
    setTestingId(connector.id);
    setTestResult(null);
    try {
      const res = await axios.post("/api/providers/connectors/test", {
        connectorId: connector.id,
      });
      const diagnostic = res.data.diagnostic;
      const success = res.data.success;
      const message = success
        ? `Connected — ${diagnostic.email ?? "endpoint reachable"}`
        : `${diagnostic.status}: ${diagnostic.message}`;
      setTestResult({ connectorId: connector.id, success, message });
      if (success) {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch {
      setTestResult({ connectorId: connector.id, success: false, message: "Connection test failed" });
      toast.error("Connection test failed");
    } finally {
      setTestingId(null);
    }
  }, []);

  const handleManualSync = useCallback(async (connector: SerializedConnector) => {
    setSyncingId(connector.id);
    try {
      await axios.post(`/api/connectors/${connector.id}/sync`);
      toast.success("Sync completed");
      router.refresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        toast.error("Connector is already running");
      } else {
        toast.error("Sync failed");
      }
    } finally {
      setSyncingId(null);
    }
  }, [router]);

  const handleToggleEnabled = useCallback(async (connector: SerializedConnector) => {
    try {
      await axios.patch(`/api/connectors/${connector.id}/settings`, {
        enabled: !connector.enabled,
      });
      toast.success(connector.enabled ? "Connector disabled" : "Connector enabled");
      router.refresh();
    } catch {
      toast.error("Failed to update connector");
    }
  }, [router]);

  const handleDelete = useCallback(async () => {
    if (!deleteConnector) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/connectors/${deleteConnector.id}`);
      toast.success("Connector deleted");
      setDeleteConnector(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete connector");
    } finally {
      setDeleting(false);
    }
  }, [deleteConnector, router]);

  const kpiCards = [
    { title: "Total Connectors", count: kpi.total, description: "All configured connectors" },
    { title: "Healthy", count: kpi.healthy, description: "No issues detected" },
    { title: "Warnings", count: kpi.warning, description: "Needs attention" },
    { title: "Errors", count: kpi.error, description: "Connectors with repeated failures" },
    { title: "Running Syncs", count: kpi.running, description: "Currently syncing" },
  ];

  return (
    <>
      <Navbar
        title="Connectors"
        subtitle="Manage lead imports, connection status, and sync history."
        showResync
        actions={
          <>
            <Button onClick={openCreate} className="h-10 whitespace-nowrap"><Plus size={16} />Create Connector</Button>
            <ExportButton type="sync-history" label="Sync History" />
            <SignOutButton />
          </>
        }
      />

      {kpi.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpiCards.map((card) => (
            <KpiCard key={card.title} {...card} />
          ))}
        </div>
      )}

      {connectors.length ? (
        <DataTable
          rows={connectors}
          compact
          tableClassName="w-full"
          columns={[
            {
              key: "name",
              header: "Connector",
              render: (c: SerializedConnector) => (
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">{c.type.toUpperCase()}</p>
                  <p className="text-xs text-[var(--color-muted)]">Provider: {c.source?.name ?? "Unassigned"}</p>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (c: SerializedConnector) => (
                <div className="flex flex-col gap-1">
                  <Badge label={STATUS_LABELS[c.status] ?? c.status} toneKey={c.status === "ACTIVE" ? "HEALTHY" : c.status === "ERROR" ? "ERROR" : "INACTIVE"} />
                  {c.isRunning && <Badge label="Running" toneKey="SALES" />}
                  <Badge label={c.enabled ? "Enabled" : "Disabled"} toneKey={c.enabled ? "HEALTHY" : "MEDIUM"} />
                </div>
              ),
            },
            {
              key: "health",
              header: "Health",
              render: (c: SerializedConnector) => (
                  <Badge label={HEALTH_LABELS[c.healthStatus] ?? c.healthStatus} toneKey={c.healthStatus} />
              ),
            },
            {
              key: "schedule",
              header: "Schedule",
              render: (c: SerializedConnector) => (
                <span className="text-sm text-[var(--color-ink)]">{SCHEDULE_LABELS[c.scheduleType] ?? c.scheduleType}</span>
              ),
            },
            {
              key: "lastSync",
              header: "Last Sync",
              render: (c: SerializedConnector) => <DateTimeCell value={c.lastSyncedAt} fallback="Never" />,
            },
            {
              key: "nextSync",
              header: "Next Sync",
              render: (c: SerializedConnector) => <DateTimeCell value={c.nextScheduledRun} fallback="-" />,
            },
            {
              key: "lastSuccess",
              header: "Last Success",
              render: (c: SerializedConnector) => <DateTimeCell value={c.lastSuccessAt} fallback="-" />,
            },
            {
              key: "lastFailure",
              header: "Last Failure",
              render: (c: SerializedConnector) => (
                <div>
                  <DateTimeCell value={c.lastFailureAt} fallback="-" />
                  {c.lastError && (
                    <p className="mt-0.5 max-w-[200px] truncate text-xs text-[var(--color-danger)]" title={c.lastError}>
                      {c.lastError}
                    </p>
                  )}
                </div>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              className: "whitespace-nowrap",
              render: (c: SerializedConnector) => (
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => openEdit(c)}
                  >
                    Edit
                  </Button>
                  <div className="grid grid-cols-3 gap-1">
                    <IconActionButton
                      icon={Bug}
                      label="Test connection"
                      onClick={() => handleTestConnection(c)}
                      isLoading={testingId === c.id}
                    />
                    <IconActionButton
                      icon={Play}
                      label="Manual sync"
                      onClick={() => handleManualSync(c)}
                      isLoading={syncingId === c.id}
                      disabled={c.isRunning}
                    />
                    <IconActionButton
                      icon={History}
                      label="View sync history"
                      onClick={() => setHistoryConnectorId(c.id)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <IconActionButton
                      icon={c.enabled ? WifiOff : RefreshCw}
                      label={c.enabled ? "Disable" : "Enable"}
                      onClick={() => handleToggleEnabled(c)}
                    />
                    <IconActionButton
                      icon={Trash2}
                      label="Delete connector"
                      onClick={() => setDeleteConnector(c)}
                    />
                  </div>
                  {testResult?.connectorId === c.id && (
                    <p
                      className={`mt-1 rounded px-2 py-1 text-xs ${
                        testResult.success
                          ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                          : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                      }`}
                    >
                      {testResult.success ? "\u2713 " : "\u2717 "}
                      {testResult.message}
                    </p>
                  )}
                </div>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState
          title="No connectors configured"
          description="Create your first connector to begin importing leads."
        />
      )}

      <ConnectorEditModal
        open={editOpen}
        onClose={closeEdit}
        connector={editMode === "edit" && selectedConnector ? selectedConnector : null}
        providers={providers}
      />

      <SyncHistoryModal
        connectorId={historyConnectorId}
        onClose={() => setHistoryConnectorId(null)}
      />
      <ConfirmDialog
        open={!!deleteConnector}
        title="Delete this connector?"
        description={`“${deleteConnector?.name ?? ""}” and its sync history will be permanently deleted.`}
        confirmLabel="Delete connector"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setDeleteConnector(null); }}
      />
    </>
  );
}
