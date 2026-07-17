import type { IConnector } from "@/runtime/runtime-types";
import { GmailConnector } from "./gmail/gmail-connector";
import { RestConnector } from "./rest/rest-connector";

export type ConnectorFactory = (config: Record<string, unknown>) => IConnector;

const factories = new Map<string, ConnectorFactory>();

export interface ConnectorManifest {
  key: string;
  name: string;
  description: string;
  version: string;
}

function register(key: string, factory: ConnectorFactory): void {
  if (factories.has(key)) {
    throw new Error(`Connector ${key} is already registered.`);
  }
  factories.set(key, factory);
}

export function createConnector(type: string, config: Record<string, unknown>): IConnector {
  const factory = factories.get(type);
  if (!factory) {
    throw new Error(`No connector registered for type: ${type}`);
  }
  return factory(config);
}

export function listConnectorManifests(): ConnectorManifest[] {
  const manifests: ConnectorManifest[] = [];
  for (const [key] of factories) {
    manifests.push({
      key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      description: `${key} connector`,
      version: "1.0",
    });
  }
  return manifests;
}

export function hasConnector(type: string): boolean {
  return factories.has(type);
}

export function supportedConnectorTypes(): string[] {
  return Array.from(factories.keys());
}

register("gmail", (config: Record<string, unknown>) => {
  const environmentKey = (config.environmentKey as string) ?? "MAIN";
  return new GmailConnector(environmentKey);
});

register("rest", (config: Record<string, unknown>) => {
  return new RestConnector(config);
});
