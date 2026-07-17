import type { ExecutionContext, RawPayload, IConnector } from "./runtime-types";
import { ConfigurationError } from "./runtime-errors";

export interface ConnectorRegistry {
  get(type: string): IConnector | undefined;
}

export class ConnectorExecutor {
  constructor(private readonly registry: ConnectorRegistry) {}

  async execute(context: ExecutionContext): Promise<RawPayload[]> {
    const connector = this.registry.get(context.connectorType);
    if (!connector) {
      throw new ConfigurationError(
        `No connector registered for type: ${context.connectorType}`,
        { connectorType: context.connectorType },
      );
    }

    context.logger.info("Connector execution started", {
      connectorType: context.connectorType,
      executionId: context.executionId,
    });

    const payloads = await connector.execute(context);

    context.logger.info("Connector execution completed", {
      payloadCount: payloads.length,
    });

    return payloads;
  }
}
