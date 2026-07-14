import type { NormalizedLead } from "@/types/lead";

export interface Connector {
  key: string;
  authenticate(): Promise<void>;
  fetch(): Promise<unknown[]>;
  normalize(record: unknown): NormalizedLead;
  sync(): Promise<{ created: number; skipped: number }>;
}

export type ConnectorStatus = "INACTIVE" | "ACTIVE" | "ERROR";
