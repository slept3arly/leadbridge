import { prisma } from "@/lib/prisma";
import { ConnectorsPageContent } from "@/components/connectors/connectors-page-content";

export type SerializedConnector = {
  id: string;
  name: string;
  type: string;
  sourceId: string | null;
  source: { id: string; name: string } | null;
  enabled: boolean;
  status: string;
  healthStatus: string;
  consecutiveFailures: number;
  lastSyncedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  nextScheduledRun: string | null;
  scheduleType: string;
  isRunning: boolean;
  averageDurationMs: number | null;
  lastDurationMs: number | null;
  runtimeMetadata: SafeConnectorRuntimeMetadata | null;
  configuration: SafeConnectorConfiguration | null;
};

export type SafeConnectorConfiguration = {
  baseUrl?: string;
  endpoint?: string;
  method?: string;
  leadArrayPath?: string;
  timeout?: number;
  retryCount?: number;
  rateLimitDelayMs?: number;
  headersConfigured: boolean;
  queryParamsConfigured: boolean;
  bodyConfigured: boolean;
  auth?: {
    type?: string;
    apiKey?: { name?: string; in?: string; configured: boolean };
    bearerTokenConfigured: boolean;
    basic?: { usernameConfigured: boolean; passwordConfigured: boolean };
    customHeader?: { name?: string; valueConfigured: boolean };
  };
  pagination?: {
    strategy?: string;
    pageSize?: number;
    maxPages?: number;
  };
};

export type SafeConnectorRuntimeMetadata = {
  lastSyncResult?: string;
  lastSyncAt?: string;
  lastSyncLeadCount?: number;
  lastSyncPayloadCount?: number;
  lastSyncWarningCount?: number;
  lastSyncErrorCount?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasValue(value: unknown): boolean {
  return typeof value === "string" ? value.length > 0 : value != null;
}

function toSafeConfiguration(value: unknown): SafeConnectorConfiguration | null {
  const config = asRecord(value);
  if (Object.keys(config).length === 0) return null;

  const auth = asRecord(config.auth);
  const apiKey = asRecord(auth.apiKey);
  const basic = asRecord(auth.basic);
  const customHeader = asRecord(auth.customHeader);
  const pagination = asRecord(config.pagination);

  return {
    ...(typeof config.baseUrl === "string" ? { baseUrl: config.baseUrl } : {}),
    ...(typeof config.endpoint === "string" ? { endpoint: config.endpoint } : {}),
    ...(typeof config.method === "string" ? { method: config.method } : {}),
    ...(typeof config.leadArrayPath === "string" ? { leadArrayPath: config.leadArrayPath } : {}),
    ...(typeof config.timeout === "number" ? { timeout: config.timeout } : {}),
    ...(typeof config.retryCount === "number" ? { retryCount: config.retryCount } : {}),
    ...(typeof config.rateLimitDelayMs === "number" ? { rateLimitDelayMs: config.rateLimitDelayMs } : {}),
    headersConfigured: hasValue(config.headers) && Object.keys(asRecord(config.headers)).length > 0,
    queryParamsConfigured: hasValue(config.queryParams) && Object.keys(asRecord(config.queryParams)).length > 0,
    bodyConfigured: hasValue(config.body),
    auth: {
      ...(typeof auth.type === "string" ? { type: auth.type } : {}),
      ...(Object.keys(apiKey).length > 0 ? {
        apiKey: {
          ...(typeof apiKey.name === "string" ? { name: apiKey.name } : {}),
          ...(typeof apiKey.in === "string" ? { in: apiKey.in } : {}),
          configured: hasValue(apiKey.value),
        },
      } : {}),
      bearerTokenConfigured: hasValue(auth.bearerToken),
      ...(Object.keys(basic).length > 0 ? {
        basic: {
          usernameConfigured: hasValue(basic.username),
          passwordConfigured: hasValue(basic.password),
        },
      } : {}),
      ...(Object.keys(customHeader).length > 0 ? {
        customHeader: {
          ...(typeof customHeader.name === "string" ? { name: customHeader.name } : {}),
          valueConfigured: hasValue(customHeader.value),
        },
      } : {}),
    },
    ...(Object.keys(pagination).length > 0 ? {
      pagination: {
        ...(typeof pagination.strategy === "string" ? { strategy: pagination.strategy } : {}),
        ...(typeof pagination.pageSize === "number" ? { pageSize: pagination.pageSize } : {}),
        ...(typeof pagination.maxPages === "number" ? { maxPages: pagination.maxPages } : {}),
      },
    } : {}),
  };
}

function toSafeRuntimeMetadata(value: unknown): SafeConnectorRuntimeMetadata | null {
  const metadata = asRecord(value);
  const safe: SafeConnectorRuntimeMetadata = {};
  if (typeof metadata.lastSyncResult === "string") safe.lastSyncResult = metadata.lastSyncResult;
  if (typeof metadata.lastSyncAt === "string") safe.lastSyncAt = metadata.lastSyncAt;
  for (const key of ["lastSyncLeadCount", "lastSyncPayloadCount", "lastSyncWarningCount", "lastSyncErrorCount"] as const) {
    if (typeof metadata[key] === "number") safe[key] = metadata[key];
  }
  return Object.keys(safe).length > 0 ? safe : null;
}

export type KpiMetrics = {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  running: number;
};

export default async function AdminConnectorsPage() {
  const [connectors, providers] = await Promise.all([
    prisma.connector.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        sourceId: true,
        enabled: true,
        status: true,
        healthStatus: true,
        consecutiveFailures: true,
        lastSyncedAt: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        lastError: true,
        nextScheduledRun: true,
        scheduleType: true,
        isRunning: true,
        averageDurationMs: true,
        lastDurationMs: true,
        runtimeMetadata: true,
        configuration: true,
        source: { select: { id: true, name: true } },
      },
    }),
    prisma.leadSource.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true },
    }),
  ]);

  const serialized: SerializedConnector[] = connectors.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    sourceId: c.sourceId,
    source: c.source ? { id: c.source.id, name: c.source.name } : null,
    enabled: c.enabled,
    status: c.status,
    healthStatus: c.healthStatus,
    consecutiveFailures: c.consecutiveFailures,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    lastSuccessAt: c.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: c.lastFailureAt?.toISOString() ?? null,
    lastError: c.lastError,
    nextScheduledRun: c.nextScheduledRun?.toISOString() ?? null,
    scheduleType: c.scheduleType,
    isRunning: c.isRunning,
    averageDurationMs: c.averageDurationMs,
    lastDurationMs: c.lastDurationMs,
    runtimeMetadata: toSafeRuntimeMetadata(c.runtimeMetadata),
    configuration: toSafeConfiguration(c.configuration),
  }));

  const serializedProviders = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    active: provider.active,
  }));

  const kpi: KpiMetrics = {
    total: connectors.length,
    healthy: connectors.filter((c) => c.healthStatus === "HEALTHY").length,
    warning: connectors.filter((c) => c.healthStatus === "WARNING").length,
    error: connectors.filter((c) => c.healthStatus === "ERROR").length,
    running: connectors.filter((c) => c.isRunning).length,
  };

  return (
    <ConnectorsPageContent
      connectors={serialized}
      kpi={kpi}
      providers={serializedProviders}
    />
  );
}
