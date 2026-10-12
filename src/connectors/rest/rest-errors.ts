import { RetryableError, ConnectorError } from "@/runtime/runtime-errors";

export class RestAuthError extends ConnectorError {
  constructor(details?: Record<string, unknown>) {
    super("REST authentication failed — check credentials and token", details);
    this.name = "RestAuthError";
  }
}

export class RestPermissionError extends ConnectorError {
  constructor(details?: Record<string, unknown>) {
    super("REST API permission denied — the credentials may lack required scopes", details);
    this.name = "RestPermissionError";
  }
}

export class RestNotFoundError extends ConnectorError {
  constructor(details?: Record<string, unknown>) {
    super("REST endpoint not found — check the URL and endpoint path", details);
    this.name = "RestNotFoundError";
  }
}

export class RestRateLimitError extends RetryableError {
  constructor(details?: Record<string, unknown>) {
    super("REST API rate limit exceeded", details);
    this.name = "RestRateLimitError";
  }
}

export class RestServerError extends RetryableError {
  constructor(details?: Record<string, unknown>) {
    super("REST API server error", details);
    this.name = "RestServerError";
  }
}

export class RestTimeoutError extends RetryableError {
  constructor(details?: Record<string, unknown>) {
    super("REST API request timed out", details);
    this.name = "RestTimeoutError";
  }
}

export class RestNetworkError extends RetryableError {
  constructor(details?: Record<string, unknown>) {
    super("REST API network error — check connectivity", details);
    this.name = "RestNetworkError";
  }
}

export class RestInvalidJsonError extends ConnectorError {
  constructor(details?: Record<string, unknown>) {
    super("REST API returned invalid JSON", details);
    this.name = "RestInvalidJsonError";
  }
}

export class RestConfigurationError extends ConnectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = "RestConfigurationError";
  }
}

export function classifyRestError(error: unknown, statusCode?: number): Error {
  if (error instanceof Error && error.name.startsWith("Rest")) return error;

  if (statusCode) {
    if (statusCode === 401) return new RestAuthError({ httpStatus: statusCode });
    if (statusCode === 403) return new RestPermissionError({ httpStatus: statusCode });
    if (statusCode === 404) return new RestNotFoundError({ httpStatus: statusCode });
    if (statusCode === 408) return new RestTimeoutError({ httpStatus: statusCode });
    if (statusCode === 429) return new RestRateLimitError({ httpStatus: statusCode });
    if (statusCode >= 500) return new RestServerError({ httpStatus: statusCode });
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) return new RestTimeoutError();
    if (msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("network") || msg.includes("dns")) return new RestNetworkError();
    if (msg.includes("unauthorized") || msg.includes("invalid token")) return new RestAuthError();
    if (msg.includes("forbidden") || msg.includes("insufficient")) return new RestPermissionError();
    if (msg.includes("rate limit") || msg.includes("too many requests")) return new RestRateLimitError();
    if (msg.includes("not found") || msg.includes("404")) return new RestNotFoundError();
    if (msg.includes("5") && (msg.includes("server error") || msg.includes("internal"))) return new RestServerError();
  }

  return error instanceof Error ? error : new Error(String(error));
}
