import type { ExecutionContext, RawPayload, IConnector } from "@/runtime/runtime-types";
import type { RestConnectorConfig, RestDocument, RestMethod } from "./rest-types";
import { RestClient } from "./rest-client";
import { classifyRestError, RestConfigurationError } from "./rest-errors";

const CONNECTOR_TYPE = "rest";

function validateConfig(config: unknown): RestConnectorConfig {
  if (!config || typeof config !== "object") {
    throw new RestConfigurationError("REST connector requires a configuration object");
  }
  const c = config as Record<string, unknown>;

  if (!c.baseUrl || typeof c.baseUrl !== "string") {
    throw new RestConfigurationError("REST connector requires a baseUrl");
  }
  if (!c.endpoint || typeof c.endpoint !== "string") {
    throw new RestConfigurationError("REST connector requires an endpoint");
  }

  return {
    baseUrl: c.baseUrl as string,
    endpoint: c.endpoint as string,
    method: (c.method as RestMethod) ?? "GET",
    headers: (c.headers as Record<string, string>) ?? {},
    queryParams: (c.queryParams as Record<string, string>) ?? {},
    body: c.body as string | undefined,
    auth: (c.auth as RestConnectorConfig["auth"]) ?? { type: "NONE" },
    pagination: (c.pagination as RestConnectorConfig["pagination"]) ?? { strategy: "PAGE_NUMBER", pageSize: 50 },
    leadArrayPath: (c.leadArrayPath as string) ?? "data",
    timeout: (c.timeout as number) ?? 30000,
    retryCount: (c.retryCount as number) ?? 3,
    rateLimitDelayMs: (c.rateLimitDelayMs as number) ?? 200,
  };
}

function buildRoutingHints(record: Record<string, unknown>): Record<string, unknown> {
  return {
    senderEmail: (record.email as string) ?? (record.Email as string) ?? (record.senderEmail as string) ?? (record["sender-email"] as string),
    senderDomain: record.domain as string | undefined,
    subject: record.subject as string | undefined,
    recipientGmailAccount: record.recipient as string | undefined,
  };
}

function toRawPayload(record: Record<string, unknown>, connectorId: string, sourceDocument?: RestDocument): RawPayload {
  return {
    _routing: buildRoutingHints(record),
    _duplicateKey: String(record.id ?? record.ID ?? record.leadId ?? record.externalId ?? `${connectorId}-${JSON.stringify(record).length}`),
    name: String(record.name ?? record.Name ?? record.company ?? record.Company ?? record.fullName ?? record.full_name ?? ""),
    company: String(record.company ?? record.Company ?? record.business ?? record.organization ?? ""),
    email: String(record.email ?? record.Email ?? record.emailAddress ?? record.email_address ?? ""),
    phone: String(record.phone ?? record.Phone ?? record.phoneNumber ?? record.phone_number ?? ""),
    subject: String(record.subject ?? record.Subject ?? record.title ?? ""),
    sourceType: CONNECTOR_TYPE,
    connectorId,
    receivedAt: new Date().toISOString(),
    providerMetadata: {
      connectorType: CONNECTOR_TYPE,
      connectorId,
      rest: {
        statusCode: sourceDocument?.statusCode,
        url: sourceDocument?.url,
        method: sourceDocument?.method,
        recordKeys: Object.keys(record),
      },
    },
  };
}

export class RestConnector implements IConnector {
  readonly key: string;
  private readonly config: RestConnectorConfig;

  constructor(config: Record<string, unknown>) {
    this.config = validateConfig(config);
    this.key = `rest_${this.config.baseUrl.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }

  async execute(context: ExecutionContext): Promise<RawPayload[]> {
    context.logger.info("REST connector execution started", {
      baseUrl: this.config.baseUrl,
      endpoint: this.config.endpoint,
      method: this.config.method,
      authType: this.config.auth.type,
    });

    const client = new RestClient(this.config);

    try {
      const { records, documents } = await client.fetchAll(context.logger);

      context.logger.info("REST connector fetch completed", {
        totalRecords: records.length,
        totalRequests: documents.length,
      });

      const lastDocument = documents[documents.length - 1];
      return records.map((record) => toRawPayload(record, context.connectorId, lastDocument));
    } catch (error) {
      throw classifyRestError(error);
    }
  }

  static async testConnection(config: Record<string, unknown>): Promise<{
    success: boolean;
    statusCode?: number;
    error?: string;
    details?: Record<string, unknown>;
  }> {
    try {
      const validated = validateConfig(config);
      const client = new RestClient(validated);
      return client.testConnection();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getConfig(): RestConnectorConfig {
    return this.config;
  }
}
