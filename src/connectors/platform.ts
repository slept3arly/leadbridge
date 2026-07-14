import { EnvironmentConnectorRuntime } from "./runtime";
import { getGmailCredentials } from "./environment";
import type { ConnectorKind, ConnectorValidation } from "./types";

class ConfiguredRuntime extends EnvironmentConnectorRuntime {
  constructor(public readonly key: string, public readonly kind: ConnectorKind, private readonly validateConfig: () => ConnectorValidation) { super(); }
  validate() { return this.validateConfig(); }
}

export function createGmailRuntime(key: string) {
  return new ConfiguredRuntime(key, "GMAIL", () => {
    const credentials = getGmailCredentials(key);
    const missing = Object.entries(credentials).filter(([, value]) => !value).map(([name]) => name);
    return missing.length ? { valid: false, reason: `Missing environment configuration: ${missing.join(", ")}.` } : { valid: true };
  });
}

export function createConfiguredRuntime(key: string, kind: ConnectorKind) {
  return new ConfiguredRuntime(key, kind, () => ({ valid: true }));
}
