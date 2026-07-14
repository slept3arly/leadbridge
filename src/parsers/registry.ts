import { ExampleParser } from "./example-parser";
import type { BaseParser } from "./base-parser";

export const parserRegistry = new Map<string, BaseParser>([["example", new ExampleParser()]]);

export function registerParser(parser: BaseParser) {
  if (parserRegistry.has(parser.key)) throw new Error(`Parser ${parser.key} is already registered.`);
  parserRegistry.set(parser.key, parser);
}
