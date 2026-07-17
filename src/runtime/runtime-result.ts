import type { ConnectorExecutionResult } from "./runtime-types";

type ResultOverrides = Partial<Omit<ConnectorExecutionResult, "status">>;

function base(overrides?: ResultOverrides): Omit<ConnectorExecutionResult, "status"> {
  return {
    durationMs: 0,
    rawPayloadCount: 0,
    leadCount: 0,
    errors: [],
    warnings: [],
    metadata: {},
    ...overrides,
  };
}

export function createSuccessResult(overrides?: ResultOverrides): ConnectorExecutionResult {
  return { ...base(overrides), status: "success" };
}

export function createFailedResult(
  error: Error,
  overrides?: ResultOverrides,
): ConnectorExecutionResult {
  return {
    ...base(overrides),
    status: "failed",
    errors: [{ message: error.message, code: "RUNTIME_ERROR" }],
  };
}

export function createSkippedResult(reason: string, overrides?: ResultOverrides): ConnectorExecutionResult {
  return { ...base(overrides), status: "skipped", warnings: [reason] };
}

export function createRetryResult(
  error: Error,
  overrides?: ResultOverrides,
): ConnectorExecutionResult {
  return {
    ...base(overrides),
    status: "retry",
    errors: [{ message: error.message, code: "RETRYABLE_ERROR" }],
  };
}

export function createCancelledResult(reason: string, overrides?: ResultOverrides): ConnectorExecutionResult {
  return { ...base(overrides), status: "cancelled", warnings: [reason] };
}
