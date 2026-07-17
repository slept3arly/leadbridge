import { parserRegistry, listParserManifests, findParsersByProviderType, getParserManifest } from "@/parsers/registry";
import { prisma } from "@/lib/prisma";
import type { ParserManifest } from "@/parsers/parser-manifest";

export class ParserService {
  get(key: string) {
    return parserRegistry.get(key);
  }

  list(): ParserManifest[] {
    return listParserManifests();
  }

  findByProviderType(providerType: string): ParserManifest[] {
    return findParsersByProviderType(providerType);
  }

  getManifest(key: string): ParserManifest | undefined {
    return getParserManifest(key);
  }

  async listForManagement() {
    for (const parser of parserRegistry.values()) {
      const m = parser.manifest;
      await prisma.parser.upsert({
        where: { name: parser.key },
        update: {
          type: parser.constructor.name,
          version: m.version,
          description: m.description,
          active: m.enabled,
        },
        create: {
          name: parser.key,
          type: parser.constructor.name,
          version: m.version,
          description: m.description,
          active: m.enabled,
        },
      });
    }
    return prisma.parser.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        version: true,
        description: true,
      },
    });
  }
}

export const parserService = new ParserService();
