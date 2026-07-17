import type { NormalizedLead } from "@/types/lead";

export type ExecutionStatus = "success" | "failed" | "skipped" | "retry" | "cancelled";

export interface ConnectorExecutionResult {
  status: ExecutionStatus;
  durationMs: number;
  rawPayloadCount: number;
  leadCount: number;
  errors: Array<{ message: string; code: string; details?: Record<string, unknown> }>;
  warnings: string[];
  metadata: Record<string, unknown>;
}

export interface ExecutionContext {
  executionId: string;
  connectorId: string;
  connectorType: string;
  providerId?: string;
  parserId?: string;
  configuration: Record<string, unknown>;
  startedAt: Date;
  retryCount: number;
  logger: RuntimeLogger;
  environment: RuntimeConfig;
}

export interface RuntimeConfig {
  maxPayloadSize?: number;
  timeoutMs?: number;
  logLevel?: "debug" | "info" | "warn" | "error";
}

export interface RoutingHint {
  recipientGmailAccount?: string;
  senderEmail?: string;
  senderDomain?: string;
  subject?: string;
  gmailLabel?: string;
}

export type RawPayload = Record<string, unknown> & {
  _routing?: RoutingHint;
  _duplicateKey?: string;
};

export interface IConnector {
  readonly key: string;
  execute(context: ExecutionContext): Promise<RawPayload[]>;
}

export interface RuntimeLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface NormalizationResult {
  lead: NormalizedLead;
  warnings: string[];
}
