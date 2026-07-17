import { randomUUID } from "crypto";
import type { ExecutionContext, RuntimeConfig, RuntimeLogger } from "./runtime-types";

const defaultConfig: RuntimeConfig = {
  maxPayloadSize: 10_485_760,
  timeoutMs: 300_000,
  logLevel: "info",
};

class DefaultLogger implements RuntimeLogger {
  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(`[Runtime] ${message}`, meta ?? "");
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(`[Runtime] ${message}`, meta ?? "");
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[Runtime] ${message}`, meta ?? "");
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[Runtime] ${message}`, meta ?? "");
  }
}

export interface ContextOptions {
  connectorId: string;
  connectorType: string;
  providerId?: string;
  parserId?: string;
  configuration?: Record<string, unknown>;
  environment?: Partial<RuntimeConfig>;
  retryCount?: number;
  logger?: RuntimeLogger;
}

export function createExecutionContext(options: ContextOptions): ExecutionContext {
  return {
    executionId: randomUUID(),
    connectorId: options.connectorId,
    connectorType: options.connectorType,
    providerId: options.providerId,
    parserId: options.parserId,
    configuration: options.configuration ?? {},
    startedAt: new Date(),
    retryCount: options.retryCount ?? 0,
    logger: options.logger ?? new DefaultLogger(),
    environment: { ...defaultConfig, ...options.environment },
  };
}
