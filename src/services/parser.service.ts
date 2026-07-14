import { parserRegistry } from "@/parsers/registry";
import { prisma } from "@/lib/prisma";

export class ParserService {
  get(key: string) {
    return parserRegistry.get(key);
  }

  list() {
    return Array.from(parserRegistry.values()).map((parser) => ({ key: parser.key, name: parser.key, type: parser.constructor.name }));
  }

  async listForManagement() {
    for (const parser of parserRegistry.values()) {
      await prisma.parser.upsert({
        where: { name: parser.key },
        update: { type: parser.constructor.name, active: true },
        create: { name: parser.key, type: parser.constructor.name, active: true },
      });
    }
    return prisma.parser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, version: true } });
  }
}

export const parserService = new ParserService();
