import type { ExecutionContext, RawPayload, IConnector } from "@/runtime/runtime-types";
import { createHash } from "node:crypto";
import type { RestConnectorConfig, RestDocument, RestMethod } from "./rest-types";
import { RestClient } from "./rest-client";
import { classifyRestError, RestConfigurationError, RestNonRetryableError, RestRetriesExhaustedError, RestNetworkError, RestRateLimitError, RestServerError, RestTimeoutError } from "./rest-errors";
import { MAX_REST_PAGES, MAX_REST_PAGE_SIZE, MAX_REST_REQUEST_TIMEOUT_MS } from "./rest-security";

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
  let baseUrl: URL;
  try { baseUrl = new URL(c.baseUrl); } catch { throw new RestConfigurationError("REST connector baseUrl is invalid"); }
  if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new RestConfigurationError("REST connector baseUrl must use HTTP(S) and cannot contain credentials, query parameters, or a fragment.");
  }
  if (/[?#]/.test(c.endpoint) || /^[a-z][a-z\d+.-]*:\/\//i.test(c.endpoint) || c.endpoint.startsWith("//")) {
    throw new RestConfigurationError("REST connector endpoint must be a relative path without query parameters.");
  }

  return {
    baseUrl: c.baseUrl as string,
    endpoint: c.endpoint as string,
    method: (c.method as RestMethod) ?? "GET",
    headers: (c.headers as Record<string, string>) ?? {},
    queryParams: (c.queryParams as Record<string, string>) ?? {},
    body: c.body as string | undefined,
    auth: (c.auth as RestConnectorConfig["auth"]) ?? { type: "NONE" },
    pagination: (() => {
      const p = (c.pagination as RestConnectorConfig["pagination"]) ?? { strategy: "PAGE_NUMBER" as const, pageSize: 50 };
      return { ...p, pageSize: Math.min(p.pageSize ?? 50, MAX_REST_PAGE_SIZE), maxPages: Math.min(p.maxPages ?? 50, MAX_REST_PAGES) };
    })(),
    leadArrayPath: (c.leadArrayPath as string) ?? "data",
    timeout: Math.min((c.timeout as number) ?? 30000, MAX_REST_REQUEST_TIMEOUT_MS),
    retryCount: Math.min((c.retryCount as number) ?? 3, 3),
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

function toRawPayload(input: unknown, connectorId: string, sourceDocument?: RestDocument): RawPayload {
  const isRecord = typeof input === "object" && input !== null && !Array.isArray(input);
  const record = isRecord ? input as Record<string, unknown> : {};
  const recordHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return {
    _routing: buildRoutingHints(record),
    _rawPayload: isRecord ? record : { value: input },
    _duplicateKey: String(record.id ?? record.ID ?? record.leadId ?? record.externalId ?? `${connectorId}-${recordHash}`),
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
      if (error instanceof RestNetworkError || error instanceof RestRateLimitError || error instanceof RestServerError || error instanceof RestTimeoutError) {
        if (["POST", "PATCH"].includes(this.config.method)) throw new RestNonRetryableError(error.name);
        throw new RestRetriesExhaustedError(error.name);
      }
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
