import type { NormalizedLead } from "@/types/lead";

export interface Connector {
  key: string;
  authenticate(): Promise<void>;
  fetch(): Promise<unknown[]>;
  normalize(record: unknown): NormalizedLead;
  sync(): Promise<{ created: number; skipped: number }>;
}

export type ConnectorStatus = "INACTIVE" | "ACTIVE" | "ERROR";

export type ConnectorKind = "GMAIL" | "REST_API" | "FACEBOOK" | "CSV" | "EXCEL";

export type ConnectorValidation = {
  valid: boolean;
  reason?: string;
};

export type SyncSummary = {
  recordsSeen: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage?: string;
};

export interface ConnectorRuntime<TRecord = unknown> {
  readonly key: string;
  readonly kind: ConnectorKind;
  validate(): ConnectorValidation;
  connect(): Promise<void>;
  fetch(): Promise<TRecord[]>;
  normalize(record: TRecord): NormalizedLead;
  disconnect(): Promise<void>;
  recordSync(summary: SyncSummary): Promise<void>;
}

export type ConfiguredGmailAccount = {
  key: string;
  name: string;
  status: "READY" | "INCOMPLETE";
  missing: string[];
};
