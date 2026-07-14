import { parserRegistry } from "@/parsers/registry";

export class ParserService {
  get(key: string) {
    return parserRegistry.get(key);
  }

  list() {
    return Array.from(parserRegistry.keys());
  }
}

export const parserService = new ParserService();
