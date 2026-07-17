import { RetryableError, ConnectorError } from "@/runtime/runtime-errors";

export class GmailAuthError extends ConnectorError {
  constructor(details?: Record<string, unknown>) {
    super("Gmail authentication failed — check credentials and refresh token", details);
    this.name = "GmailAuthError";
  }
}

export class GmailPermissionError extends ConnectorError {
  constructor(details?: Record<string, unknown>) {
    super("Gmail permission denied — the app may not have sufficient API scopes", details);
    this.name = "GmailPermissionError";
  }
}

export class GmailQuotaError extends RetryableError {
  constructor(details?: Record<string, unknown>) {
    super("Gmail API quota exceeded — rate limited", details);
    this.name = "GmailQuotaError";
  }
}

export class GmailHistoryExpiredError extends ConnectorError {
  constructor(details?: Record<string, unknown>) {
    super("Gmail history ID expired — full mailbox rescan required", details);
    this.name = "GmailHistoryExpiredError";
  }
}

export class GmailMailboxError extends ConnectorError {
  constructor(details?: Record<string, unknown>) {
    super("Gmail mailbox unavailable or inaccessible", details);
    this.name = "GmailMailboxError";
  }
}

export function classifyGmailError(error: unknown): Error {
  if (error instanceof Error) {
    const status = (error as unknown as Record<string, unknown>).code ?? (error as unknown as Record<string, unknown>).status;
    const message = error.message.toLowerCase();

    if (status === 401 || message.includes("unauthorized") || message.includes("invalid grant")) {
      return new GmailAuthError({ originalMessage: error.message });
    }
    if (status === 403 || message.includes("forbidden") || message.includes("insufficient")) {
      return new GmailPermissionError({ originalMessage: error.message });
    }
    if (
      status === 429 ||
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      return new GmailQuotaError({ originalMessage: error.message });
    }
    if (
      status === 404 ||
      message.includes("not found") ||
      message.includes("expired") ||
      message.includes("history")
    ) {
      return new GmailHistoryExpiredError({ originalMessage: error.message });
    }
    if (
      status === 503 ||
      status === 502 ||
      message.includes("unavailable") ||
      message.includes("backend error")
    ) {
      return new GmailMailboxError({ originalMessage: error.message });
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}
