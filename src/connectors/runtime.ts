import type { ConnectorKind, ConnectorRuntime, ConnectorValidation, SyncSummary } from "./types";
import type { NormalizedLead } from "@/types/lead";

export abstract class EnvironmentConnectorRuntime<TRecord = unknown> implements ConnectorRuntime<TRecord> {
  abstract readonly key: string;
  abstract readonly kind: ConnectorKind;

  abstract validate(): ConnectorValidation;

  async connect() {
    const result = this.validate();
    if (!result.valid) throw new Error(result.reason ?? "Connector configuration is invalid.");
  }

  async fetch(): Promise<TRecord[]> {
    throw new Error(`${this.kind} fetching is reserved for the integration milestone.`);
  }

  normalize(record: TRecord): NormalizedLead {
    void record;
    throw new Error(`${this.kind} normalization is reserved for the integration milestone.`);
  }

  async disconnect() {}

  async recordSync(summary: SyncSummary) { void summary; }
}
