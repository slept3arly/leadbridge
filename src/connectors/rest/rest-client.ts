import type { RestConnectorConfig, RestDocument, PaginationStrategy, RestMethod } from "./rest-types";
import { classifyRestError, RestRateLimitError, RestServerError, RestTimeoutError, RestNetworkError, RestInvalidJsonError, RestConfigurationError } from "./rest-errors";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { MAX_REST_EXECUTION_MS, MAX_REST_PAGE_SIZE, MAX_REST_PAGES, MAX_REST_RECORDS, MAX_REST_REDIRECTS, MAX_REST_REQUEST_BODY_BYTES, MAX_REST_REQUEST_TIMEOUT_MS, MAX_REST_RESPONSE_BYTES, MAX_REST_TOTAL_RESPONSE_BYTES, RestSecurityError, parseAllowedOrigins, validateRestRedirectTarget, validateRestUrl } from "./rest-security";

interface FetchOptions {
  url: string;
  method: RestMethod;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

async function fetchWithTimeout(options: FetchOptions, previousOrigin?: string, redirects = 0, trustedOrigins?: Set<string>, deadlineAt = Date.now() + MAX_REST_EXECUTION_MS): Promise<{ status: number; headers: Record<string, string>; body: string; url: string }> {
  if (options.body && Buffer.byteLength(options.body) > MAX_REST_REQUEST_BODY_BYTES) throw new RestSecurityError("REST request body exceeded the configured safety limit.");
  if (Date.now() >= deadlineAt) throw new RestTimeoutError();
  const allowedOrigins = trustedOrigins ?? parseAllowedOrigins();
  const validated = await validateRestUrl(options.url, { allowedOrigins, previousOrigin });
  const url = validated.url;
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs, MAX_REST_REQUEST_TIMEOUT_MS, deadlineAt - Date.now()));
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    const req = request(url, {
      method: options.method,
      headers: options.headers,
      timeout: timeoutMs,
      lookup: (_hostname, _opts, callback) => callback(null, validated.addresses[0].address, validated.addresses[0].family),
    }, (res) => {
      const contentLength = Number(res.headers["content-length"] ?? 0);
      if (Number.isFinite(contentLength) && contentLength > MAX_REST_RESPONSE_BYTES) {
        req.destroy(new RestSecurityError("REST response exceeded the configured safety limit."));
        res.resume();
        return;
      }
      const status = res.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        if (redirects >= MAX_REST_REDIRECTS) return reject(new RestSecurityError("REST redirect limit exceeded."));
        let destination: URL;
        try { destination = validateRestRedirectTarget(res.headers.location, url, allowedOrigins); }
        catch (error) { reject(error); return; }
        const nextMethod = status === 303 || ((status === 301 || status === 302) && options.method === "POST") ? "GET" : options.method;
        const nextHeaders = { ...options.headers };
        let nextBody = nextMethod === "GET" ? undefined : options.body;
        if (destination.origin !== url.origin) {
          for (const key of Object.keys(nextHeaders)) if (!["accept", "content-type"].includes(key.toLowerCase())) delete nextHeaders[key];
          nextBody = undefined;
        }
        void fetchWithTimeout({ ...options, url: destination.href, method: nextMethod, headers: nextHeaders, body: nextBody }, url.origin, redirects + 1, allowedOrigins, deadlineAt).then(resolve, reject);
        return;
      }
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_REST_RESPONSE_BYTES) {
          req.destroy(new RestSecurityError("REST response exceeded the configured safety limit."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) if (value !== undefined) headers[key.toLowerCase()] = Array.isArray(value) ? value.join(",") : value;
        resolve({ status, headers, body: Buffer.concat(chunks).toString("utf8"), url: url.href });
      });
      res.on("error", reject);
    });
    const hardTimeout = setTimeout(() => req.destroy(new RestTimeoutError()), timeoutMs);
    req.on("close", () => clearTimeout(hardTimeout));
    req.on("timeout", () => req.destroy(new RestTimeoutError()));
    req.on("error", reject);
    if (options.body && options.method !== "GET") req.write(options.body);
    req.end();
  });
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
    const parsed = new URL(url);
    parsed.searchParams.set(config.auth.apiKey.name, config.auth.apiKey.value);
    return parsed.href;
  }
  return url;
}

function maskSensitiveUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) url.searchParams.set(key, "***masked***");
    return url.toString();
  } catch {
    return value.replace(/([?&][^=&#]+)=([^&#\s]*)/g, "$1=***masked***");
  }
}

function getSafeTestConnectionError(error: unknown): string {
  const classified = classifyRestError(error);
  if (classified.name.startsWith("Rest")) {
    const rawCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
    const code = typeof rawCode === "string" && /^[A-Z0-9_]+$/.test(rawCode) ? ` (${rawCode})` : "";
    return `${classified.message}${code}`;
  }
  return "REST connection failed.";
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
  const size = Math.min(pc.pageSize ?? 50, 500);

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
        return { params: { [pc.cursorParam ?? "cursor"]: cursor, [pc.limitParam ?? "limit"]: String(size) } };
      }
      return { params: { [pc.cursorParam ?? "cursor"]: "", [pc.limitParam ?? "limit"]: String(size) } };
    case "NEXT_URL":
      if (nextUrl) {
        return { url: nextUrl };
      }
      return {};
    case "TOKEN":
      if (token) {
        return { params: { [pc.tokenParam ?? "pageToken"]: token, [pc.limitParam ?? "limit"]: String(size) } };
      }
      return { params: { [pc.limitParam ?? "limit"]: String(size) } };
    default:
      return {};
  }
}

function extractPaginationValue(
  body: unknown,
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

function describeJsonType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function extractArray(body: unknown, path: string): Record<string, unknown>[] {
  if (!path.trim()) {
    if (Array.isArray(body)) return body as Record<string, unknown>[];
    throw new RestConfigurationError("REST response must be an array when Lead Array Path is empty.");
  }

  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) throw new RestConfigurationError("REST response array path is invalid.");

  let current: unknown = body;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      throw new RestConfigurationError("REST response did not contain an array at the configured Lead Array Path.");
    }
  }
  if (!Array.isArray(current)) throw new RestConfigurationError("REST response did not contain an array at the configured Lead Array Path.");
  return current as Record<string, unknown>[];
}

function parseResponseBody(body: string): unknown {
  if (!body.trim()) return null;
  try {
    return JSON.parse(body);
  } catch {
    throw new RestInvalidJsonError();
  }
}

function retryDelay(rateLimitDelay: number, attempt: number): number {
  return Math.min(10_000, rateLimitDelay * 2 ** (attempt - 1));
}

function getRetryAfterMs(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(milliseconds) ? Math.min(10_000, Math.max(0, milliseconds)) : fallback;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function delayWithinDeadline(ms: number, deadlineAt: number): Promise<void> {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) throw new RestTimeoutError();
  await delay(Math.min(ms, remainingMs));
  if (Date.now() >= deadlineAt) throw new RestTimeoutError();
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
    const sensitiveKeys = ["authorization", "cookie", "set-cookie", "api-key", "token", "secret", "password", "credential", "key"];
    const masked = { ...headers };
    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        masked[key] = "***masked***";
      }
    }
    return masked;
  }

  private hasNextPage(recordsOnPage: number, cursor: string | null, nextUrl: string | null, token: string | null): boolean {
    if (recordsOnPage === 0) return false;
    switch (this.config.pagination.strategy) {
      case "PAGE_NUMBER":
      case "OFFSET":
        return recordsOnPage >= Math.min(this.config.pagination.pageSize ?? 50, MAX_REST_PAGE_SIZE);
      case "CURSOR": return Boolean(cursor);
      case "NEXT_URL": return Boolean(nextUrl);
      case "TOKEN": return Boolean(token);
    }
  }

  private continuationKey(cursor: string | null, nextUrl: string | null, token: string | null): string | null {
    switch (this.config.pagination.strategy) {
      case "CURSOR": return cursor ? `cursor:${cursor}` : null;
      case "NEXT_URL": return nextUrl ? `url:${nextUrl}` : null;
      case "TOKEN": return token ? `token:${token}` : null;
      default: return null;
    }
  }

  async fetchAll(logger: { info: (msg: string, meta?: Record<string, unknown>) => void; error: (msg: string, meta?: Record<string, unknown>) => void }): Promise<{
    records: Record<string, unknown>[];
    documents: RestDocument[];
  }> {
    const allRecords: Record<string, unknown>[] = [];
    const allDocuments: RestDocument[] = [];
    const startedAt = Date.now();
    const trustedOrigins = parseAllowedOrigins();
    const maxPages = Math.min(this.config.pagination.maxPages ?? 50, MAX_REST_PAGES);

    let page = 1;
    let cursor: string | null = null;
    let nextUrl: string | null = null;
    let token: string | null = null;
    let totalResponseBytes = 0;
    const seenContinuations = new Set<string>();
    const retryCount = Math.max(1, Math.min(this.config.retryCount ?? 3, 3));
    const rateLimitDelay = Math.min(this.config.rateLimitDelayMs ?? 200, 10_000);
    const maxAttempts = this.config.method === "POST" || this.config.method === "PATCH" ? 1 : retryCount;

    while (page <= maxPages) {
      if (Date.now() - startedAt > MAX_REST_EXECUTION_MS) throw new RestTimeoutError();
      const pageParams = getPageParams(this.config.pagination.strategy, page, cursor, nextUrl, token, this.config);
      const baseUrl = buildUrl(this.config.baseUrl, this.config.endpoint);
      const requestUrl = pageParams.url ? new URL(pageParams.url, allDocuments.at(-1)?.url ?? this.config.baseUrl).href : `${baseUrl}${buildQueryString(this.config, pageParams.params)}`;
      const sameOrigin = new URL(requestUrl).origin === new URL(this.config.baseUrl).origin;
      const url = sameOrigin ? addApiKeyQueryParam(requestUrl, this.config) : requestUrl;

      let lastError: Error | undefined;
      let responseData: { status: number; headers: Record<string, string>; body: string; url: string } | undefined;
      let recordsOnPage = 0;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          let headers = applyAuth(
            { "content-type": "application/json", accept: "application/json", ...this.config.headers },
            this.config,
          );
          if (!sameOrigin) headers = Object.fromEntries(Object.entries(headers).filter(([key]) => ["accept", "content-type"].includes(key.toLowerCase())));

          const startTime = Date.now();
          responseData = await fetchWithTimeout({
            url,
            method: this.config.method,
            headers,
            body: sameOrigin && this.config.method !== "GET" ? this.config.body : undefined,
            timeoutMs: Math.min(this.config.timeout ?? 30000, MAX_REST_REQUEST_TIMEOUT_MS),
          }, undefined, 0, trustedOrigins, startedAt + MAX_REST_EXECUTION_MS);
          const durationMs = Date.now() - startTime;
          totalResponseBytes += Buffer.byteLength(responseData.body);
          if (totalResponseBytes > MAX_REST_TOTAL_RESPONSE_BYTES) throw new RestSecurityError("REST total response limit exceeded.");

          if (responseData.status < 200 || responseData.status >= 300) {
            if (responseData.status === 429 && attempt < maxAttempts) {
              const waitMs = getRetryAfterMs(responseData.headers["retry-after"], retryDelay(rateLimitDelay, attempt));
              logger.info("Rate limited, waiting", { retryAfterMs: waitMs, attempt });
              await delayWithinDeadline(waitMs, startedAt + MAX_REST_EXECUTION_MS);
              continue;
            }
            if (responseData.status >= 500 && attempt < maxAttempts) {
              const waitMs = retryDelay(rateLimitDelay, attempt);
              logger.info("Server error, retrying", { statusCode: responseData.status, attempt, retryAfterMs: waitMs });
              await delayWithinDeadline(waitMs, startedAt + MAX_REST_EXECUTION_MS);
              continue;
            }
            throw classifyRestError(new Error(`HTTP ${responseData.status}`), responseData.status);
          }
          const parsedBody = parseResponseBody(responseData.body);
          const records = responseData.body.trim() ? extractArray(parsedBody, this.config.leadArrayPath) : [];
          recordsOnPage = records.length;

          logger.info("REST response parsed", {
            page,
            statusCode: responseData.status,
            parsedJsonType: describeJsonType(parsedBody),
            leadArrayPath: this.config.leadArrayPath,
            extractedRecordCount: records.length,
          });

          const document: RestDocument = {
            url: maskSensitiveUrl(responseData.url),
            method: this.config.method,
            statusCode: responseData.status,
            headers: this.maskSensitiveHeaders(responseData.headers),
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
          };
          allDocuments.push(document);

          allRecords.push(...records);
          if (records.length > MAX_REST_PAGE_SIZE) throw new RestSecurityError("REST page contained too many records.");
          if (allRecords.length > MAX_REST_RECORDS) throw new RestSecurityError("REST record limit exceeded.");

          cursor = extractPaginationValue(parsedBody, this.config.pagination.cursorPath);
          nextUrl = extractPaginationValue(parsedBody, this.config.pagination.nextUrlPath);
          token = extractPaginationValue(parsedBody, this.config.pagination.tokenPath);

          const hasNextPage = this.hasNextPage(records.length, cursor, nextUrl, token);
          logger.info("REST page fetched", {
            page,
            statusCode: responseData.status,
            recordsOnPage: records.length,
            totalRecords: allRecords.length,
            hasNextPage,
            durationMs,
          });

          const continuation = hasNextPage ? this.continuationKey(cursor, nextUrl, token) : null;
          if (continuation) {
            if (seenContinuations.has(continuation)) throw new RestConfigurationError("REST pagination repeated a cursor or next-page value.");
            seenContinuations.add(continuation);
          }
          break;
        } catch (error) {
          lastError = classifyRestError(error);
          if (error instanceof RestRateLimitError || error instanceof RestServerError || error instanceof RestTimeoutError || error instanceof RestNetworkError) {
            if (attempt < maxAttempts) {
              logger.info("Retryable error, retrying", { errorType: lastError.name, attempt });
              await delayWithinDeadline(retryDelay(rateLimitDelay, attempt), startedAt + MAX_REST_EXECUTION_MS);
              continue;
            }
          }
          break;
        }
      }

      if (lastError) {
        logger.error("REST page failed", { errorType: lastError.name, page });
        throw lastError;
      }

      if (!this.hasNextPage(recordsOnPage, cursor, nextUrl, token)) break;
      if (page === maxPages) throw new RestSecurityError("REST pagination page limit reached before completion.");
      if (this.config.pagination.strategy === "NEXT_URL" && nextUrl) {
        // Validate pagination before entering a retry loop or issuing the next request.
        await validateRestUrl(new URL(nextUrl, responseData?.url ?? this.config.baseUrl), { allowedOrigins: trustedOrigins, previousOrigin: new URL(responseData?.url ?? this.config.baseUrl).origin });
      }
      if (rateLimitDelay > 0) await delayWithinDeadline(rateLimitDelay, startedAt + MAX_REST_EXECUTION_MS);
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
        timeoutMs: Math.min(this.config.timeout ?? 30000, MAX_REST_REQUEST_TIMEOUT_MS),
      });

      const parsedBody = parseResponseBody(response.body);
      const records = response.body.trim() ? extractArray(parsedBody, this.config.leadArrayPath) : [];

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        error: response.status >= 200 && response.status < 300 ? undefined : `HTTP ${response.status}`,
        details: {
          method: this.config.method,
          url: maskSensitiveUrl(url),
          statusCode: response.status,
          contentType: response.headers["content-type"],
          bodySize: response.body.length,
          recordsFound: records.length,
          parsedJsonType: describeJsonType(parsedBody),
          leadArrayPath: this.config.leadArrayPath,
          authType: this.config.auth.type,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: getSafeTestConnectionError(error),
        details: {
          method: this.config.method,
          authType: this.config.auth.type,
        },
      };
    }
  }

}
