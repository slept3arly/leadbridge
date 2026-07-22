import { Navbar } from "@/components/shared/navbar";
import { ConnectorManagement } from "@/components/connectors/connector-management";
import { ExportButton } from "@/components/shared/export-button";
import { providerService } from "@/services/provider.service";
import { connectorService } from "@/services/connector.service";
import { parserRequestService } from "@/services/parser-request.service";
import { unmatchedEmailService } from "@/services/unmatched-email.service";
import { parserService } from "@/services/parser.service";
import { prisma } from "@/lib/prisma";
import { listConnectorManifests } from "@/connectors/registry";

export default async function AdminConnectorsPage() {
  const [providers, gmailAccounts, syncRuns, unmatched, parserRequests, parserRows, connectors, connectorTypes] = await Promise.all([
    providerService.list(),
    connectorService.listGmailAccounts(),
    connectorService.listSyncRuns(),
    unmatchedEmailService.list(),
    parserRequestService.list(),
    parserService.listForManagement(),
    prisma.connector.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        enabled: true,
        environmentKey: true,
        lastSyncedAt: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        lastError: true,
        runtimeMetadata: true,
        scheduleType: true,
        scheduleConfig: true,
        nextScheduledRun: true,
        consecutiveFailures: true,
        averageDurationMs: true,
        lastDurationMs: true,
        healthStatus: true,
        isRunning: true,
        lockedBy: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    Promise.resolve(listConnectorManifests()),
  ]);

  const providerRows = "data" in providers ? providers.data : providers;

  return (
    <>
      <Navbar title="Connectors" actions={<div className="flex gap-2"><ExportButton type="sync-history" label="Sync History" /></div>} />
      <ConnectorManagement
        providers={providerRows.map((provider) => ({ id: provider.id, name: provider.name }))}
        parsers={parserRows.map((parser) => ({
          key: parser.id,
          name: parser.name,
          type: parser.type,
          version: parser.version ?? "—",
          description: parser.description ?? "",
        }))}
        connectorTypes={connectorTypes}
        gmailAccounts={gmailAccounts.map((account) => ({
          ...account,
          lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
        }))}
        connectors={connectors.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          status: c.status,
          enabled: c.enabled,
          environmentKey: c.environmentKey,
          lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
          lastSuccessAt: c.lastSuccessAt?.toISOString() ?? null,
          lastFailureAt: c.lastFailureAt?.toISOString() ?? null,
          lastError: c.lastError,
          runtimeMetadata: c.runtimeMetadata as Record<string, unknown> | null,
          scheduleType: c.scheduleType,
          scheduleConfig: c.scheduleConfig as Record<string, unknown> | null,
          nextScheduledRun: c.nextScheduledRun?.toISOString() ?? null,
          consecutiveFailures: c.consecutiveFailures,
          averageDurationMs: c.averageDurationMs,
          lastDurationMs: c.lastDurationMs,
          healthStatus: c.healthStatus,
          isRunning: c.isRunning,
          lockedBy: c.lockedBy,
        }))}
        syncRuns={syncRuns.map((run) => ({
          ...run,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt?.toISOString() ?? null,
          metadata: run.metadata as Record<string, unknown> | null,
        }))}
        unmatched={unmatched.map((email) => ({ ...email, receivedAt: email.receivedAt.toISOString() }))}
        parserRequests={parserRequests.map((request) => ({
          ...request,
          requestedAt: request.requestedAt.toISOString(),
        }))}
      />
    </>
  );
}
