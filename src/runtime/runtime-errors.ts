export class RuntimeError extends Error {
  constructor(
    message: string,
    public readonly code: string = "RUNTIME_ERROR",
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RuntimeError";
  }
}

export class ConnectorError extends RuntimeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONNECTOR_ERROR", details);
    this.name = "ConnectorError";
  }
}

export class ParserError extends RuntimeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "PARSER_ERROR", details);
    this.name = "ParserError";
  }
}

export class ValidationError extends RuntimeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class RetryableError extends RuntimeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "RETRYABLE_ERROR", details);
    this.name = "RetryableError";
  }
}

export class ConfigurationError extends RuntimeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFIGURATION_ERROR", details);
    this.name = "ConfigurationError";
  }
}
