import type { Connector as ConnectorContract } from "@/connectors/types";
import { prisma } from "@/lib/prisma";

export class ConnectorService {
  async list() {
    return prisma.connector.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
        lastSyncedAt: true,
      },
    });
  }

  async sync(connector: ConnectorContract) {
    await connector.authenticate();
    return connector.sync();
  }
}

export const connectorService = new ConnectorService();
