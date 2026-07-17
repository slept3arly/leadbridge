import type { RestConnectorConfig, RestDocument, PaginationStrategy, RestMethod } from "./rest-types";
import { classifyRestError, RestRateLimitError, RestServerError, RestTimeoutError, RestNetworkError } from "./rest-errors";

interface FetchOptions {
  url: string;
  method: RestMethod;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

async function fetchWithTimeout(options: FetchOptions): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });

    const body = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => { responseHeaders[key.toLowerCase()] = value; });

    return {
      status: response.status,
      headers: responseHeaders,
      body,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function applyAuth(headers: Record<string, string>, config: RestConnectorConfig): Record<string, string> {
  const auth = config.auth;
  switch (auth.type) {
    case "API_KEY":
      if (auth.apiKey) {
        if (auth.apiKey.in === "header") {
          headers[auth.apiKey.name] = auth.apiKey.value;
        }
      }
      break;
    case "BEARER":
      if (auth.bearerToken) {
        headers["authorization"] = `Bearer ${auth.bearerToken}`;
      }
      break;
    case "BASIC":
      if (auth.basic) {
        const encoded = Buffer.from(`${auth.basic.username}:${auth.basic.password}`).toString("base64");
        headers["authorization"] = `Basic ${encoded}`;
      }
      break;
    case "CUSTOM_HEADER":
      if (auth.customHeader) {
        headers[auth.customHeader.name.toLowerCase()] = auth.customHeader.value;
      }
      break;
  }
  return headers;
}

function buildQueryString(config: RestConnectorConfig, pageParams?: Record<string, string>): string {
  const params = new URLSearchParams(config.queryParams ?? {});

  if (pageParams) {
    for (const [key, value] of Object.entries(pageParams)) {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function addApiKeyQueryParam(url: string, config: RestConnectorConfig): string {
  if (config.auth.type === "API_KEY" && config.auth.apiKey?.in === "query") {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${encodeURIComponent(config.auth.apiKey.name)}=${encodeURIComponent(config.auth.apiKey.value)}`;
  }
  return url;
}

function buildUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

function getPageParams(
  strategy: PaginationStrategy,
  page: number,
  cursor: string | null,
  nextUrl: string | null,
  token: string | null,
  config: RestConnectorConfig,
): { url?: string; params?: Record<string, string> } {
  const pc = config.pagination;
  const size = pc.pageSize ?? 50;

  switch (strategy) {
    case "PAGE_NUMBER":
      return {
        params: {
          [pc.pageParam ?? "page"]: String(page),
          [pc.perPageParam ?? "per_page"]: String(size),
        },
      };
    case "OFFSET":
      return {
        params: {
          [pc.offsetParam ?? "offset"]: String((page - 1) * size),
          [pc.limitParam ?? "limit"]: String(size),
        },
      };
    case "CURSOR":
      if (cursor) {
        return { params: { [pc.cursorParam ?? "cursor"]: cursor } };
      }
      return { params: { [pc.cursorParam ?? "cursor"]: "", [pc.limitParam ?? "limit"]: String(size) } };
    case "NEXT_URL":
      if (nextUrl) {
        return { url: nextUrl };
      }
      return {};
    case "TOKEN":
      if (token) {
        return { params: { [pc.tokenParam ?? "pageToken"]: token } };
      }
      return { params: { [pc.limitParam ?? "limit"]: String(size) } };
    default:
      return {};
  }
}

function extractPaginationValue(
  body: Record<string, unknown>,
  path?: string,
): string | null {
  if (!path) return null;
  const parts = path.split(".");
  let current: unknown = body;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current != null ? String(current) : null;
}

function extractArray(body: Record<string, unknown>, path: string): Record<string, unknown>[] {
  const parts = path.split(".");
  let current: unknown = body;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return [];
    }
  }
  return Array.isArray(current) ? (current as Record<string, unknown>[]) : [];
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RestFetchResult {
  documents: RestDocument[];
  nextCursor: string | null;
  nextUrl: string | null;
  nextToken: string | null;
  totalFetched: number;
}

export class RestClient {
  constructor(private readonly config: RestConnectorConfig) {}

  private maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    const sensitiveKeys = ["authorization", "x-api-key", "api-key", "token", "secret"];
    const masked = { ...headers };
    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        masked[key] = "***masked***";
      }
    }
    return masked;
  }

  async fetchAll(logger: { info: (msg: string, meta?: Record<string, unknown>) => void; error: (msg: string, meta?: Record<string, unknown>) => void }): Promise<{
    records: Record<string, unknown>[];
    documents: RestDocument[];
  }> {
    const allRecords: Record<string, unknown>[] = [];
    const allDocuments: RestDocument[] = [];
    const maxPages = this.config.pagination.maxPages ?? 50;

    let page = 1;
    let cursor: string | null = null;
    let nextUrl: string | null = null;
    let token: string | null = null;
    const retryCount = this.config.retryCount ?? 3;
    const rateLimitDelay = this.config.rateLimitDelayMs ?? 200;

    while (page <= maxPages) {
      const pageParams = getPageParams(this.config.pagination.strategy, page, cursor, nextUrl, token, this.config);
      const baseUrl = buildUrl(this.config.baseUrl, this.config.endpoint);
      const url = addApiKeyQueryParam(
        pageParams.url ?? `${baseUrl}${buildQueryString(this.config, pageParams.params)}`,
        this.config,
      );

      let lastError: Error | undefined;
      let responseData: { status: number; headers: Record<string, string>; body: string } | undefined;

      for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
          const headers = applyAuth(
            { "content-type": "application/json", accept: "application/json", ...this.config.headers },
            this.config,
          );

          const startTime = Date.now();
          responseData = await fetchWithTimeout({
            url,
            method: this.config.method,
            headers,
            body: this.config.method !== "GET" ? this.config.body : undefined,
            timeoutMs: this.config.timeout ?? 30000,
          });
          const durationMs = Date.now() - startTime;

          const parsedBody = this.tryParseJson(responseData.body);

          const document: RestDocument = {
            url,
            method: this.config.method,
            statusCode: responseData.status,
            headers: this.maskSensitiveHeaders(responseData.headers),
            responseBody: responseData.body,
            receivedAt: new Date().toISOString(),
            providerMetadata: {
              connectorType: "rest",
              statusCode: responseData.status,
              page,
              attempt,
            },
            requestMetadata: {
              attempt,
              durationMs,
            },
            rawPayload: parsedBody ?? {},
          };
          allDocuments.push(document);

          if (responseData.status >= 200 && responseData.status < 300) {
            const records = parsedBody ? extractArray(parsedBody, this.config.leadArrayPath) : [];
            allRecords.push(...records);

            cursor = extractPaginationValue(parsedBody ?? {}, this.config.pagination.cursorPath);
            nextUrl = extractPaginationValue(parsedBody ?? {}, this.config.pagination.nextUrlPath);
            token = extractPaginationValue(parsedBody ?? {}, this.config.pagination.tokenPath);

            logger.info("REST page fetched", {
              page,
              statusCode: responseData.status,
              recordsOnPage: records.length,
              totalRecords: allRecords.length,
              hasNextPage: !!(cursor || nextUrl || token),
              durationMs,
            });

            break;
          }

          if (responseData.status === 429 && attempt < retryCount) {
            const retryAfter = responseData.headers["retry-after"]
              ? parseInt(responseData.headers["retry-after"], 10) * 1000
              : rateLimitDelay * attempt;
            logger.info("Rate limited, waiting", { retryAfterMs: retryAfter, attempt });
            await delay(retryAfter);
            continue;
          }

          if (responseData.status >= 500 && attempt < retryCount) {
            logger.info("Server error, retrying", { statusCode: responseData.status, attempt });
            await delay(rateLimitDelay * attempt);
            continue;
          }

          throw classifyRestError(new Error(`HTTP ${responseData.status}: ${responseData.body.slice(0, 200)}`), responseData.status);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (error instanceof RestRateLimitError || error instanceof RestServerError || error instanceof RestTimeoutError || error instanceof RestNetworkError) {
            if (attempt < retryCount) {
              logger.info("Retryable error, retrying", { error: lastError.message, attempt });
              await delay(rateLimitDelay * attempt);
              continue;
            }
          }
          break;
        }
      }

      if (lastError) {
        logger.error("REST page failed", { error: lastError.message, page });
        throw lastError;
      }

      if (!cursor && !nextUrl && !token) break;
      page++;
    }

    return { records: allRecords, documents: allDocuments };
  }

  async testConnection(): Promise<{
    success: boolean;
    statusCode?: number;
    error?: string;
    details?: Record<string, unknown>;
  }> {
    try {
      const headers = applyAuth(
        { "content-type": "application/json", accept: "application/json", ...this.config.headers },
        this.config,
      );
      const baseUrl = buildUrl(this.config.baseUrl, this.config.endpoint);
      const url = addApiKeyQueryParam(`${baseUrl}${buildQueryString(this.config)}`, this.config);

      const response = await fetchWithTimeout({
        url,
        method: this.config.method,
        headers,
        body: this.config.method !== "GET" ? this.config.body : undefined,
        timeoutMs: this.config.timeout ?? 30000,
      });

      const parsedBody = this.tryParseJson(response.body);
      const records = parsedBody ? extractArray(parsedBody, this.config.leadArrayPath) : [];

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        error: response.status >= 200 && response.status < 300 ? undefined : `HTTP ${response.status}: ${response.body.slice(0, 200)}`,
        details: {
          method: this.config.method,
          url,
          statusCode: response.status,
          contentType: response.headers["content-type"],
          bodySize: response.body.length,
          recordsFound: records.length,
          authType: this.config.auth.type,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        details: {
          method: this.config.method,
          authType: this.config.auth.type,
        },
      };
    }
  }

  private tryParseJson(body: string): Record<string, unknown> | null {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
}
