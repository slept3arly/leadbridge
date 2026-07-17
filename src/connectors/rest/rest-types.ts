export type RestAuthType = "NONE" | "API_KEY" | "BEARER" | "BASIC" | "CUSTOM_HEADER";

export type RestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type PaginationStrategy = "PAGE_NUMBER" | "OFFSET" | "CURSOR" | "NEXT_URL" | "TOKEN";

export interface RestAuthConfig {
  type: RestAuthType;
  apiKey?: { name: string; value: string; in: "header" | "query" };
  bearerToken?: string;
  basic?: { username: string; password: string };
  customHeader?: { name: string; value: string };
}

export interface PaginationConfig {
  strategy: PaginationStrategy;
  pageSize?: number;
  pageParam?: string;
  perPageParam?: string;
  offsetParam?: string;
  limitParam?: string;
  cursorParam?: string;
  cursorPath?: string;
  nextUrlPath?: string;
  tokenParam?: string;
  tokenPath?: string;
  maxPages?: number;
}

export interface RestConnectorConfig {
  baseUrl: string;
  endpoint: string;
  method: RestMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  auth: RestAuthConfig;
  pagination: PaginationConfig;
  leadArrayPath: string;
  timeout?: number;
  retryCount?: number;
  rateLimitDelayMs?: number;
}

export interface RestDocument {
  url: string;
  method: RestMethod;
  statusCode: number;
  headers: Record<string, string>;
  responseBody: string;
  receivedAt: string;
  providerMetadata: Record<string, unknown>;
  requestMetadata: {
    attempt: number;
    durationMs: number;
  };
  rawPayload: Record<string, unknown>;
}
