import { ExampleParser } from "./example-parser";
import { GmailParser } from "@/connectors/gmail/gmail-parser";
import type { BaseParser } from "./base-parser";
import type { ParserManifest } from "./parser-manifest";

export const parserRegistry = new Map<string, BaseParser>([
  ["example", new ExampleParser()],
  ["gmail", new GmailParser()],
]);

export function registerParser(parser: BaseParser) {
  if (parserRegistry.has(parser.key)) {
    throw new Error(`Parser ${parser.key} is already registered.`);
  }
  parserRegistry.set(parser.key, parser);
}

export function listParserManifests(): ParserManifest[] {
  return Array.from(parserRegistry.values()).map((p) => p.manifest);
}

export function findParsersByProviderType(providerType: string): ParserManifest[] {
  return listParserManifests().filter(
    (m) => m.providerTypesSupported.length === 0 || m.providerTypesSupported.includes(providerType),
  );
}

export function getParserManifest(key: string): ParserManifest | undefined {
  const parser = parserRegistry.get(key);
  return parser?.manifest;
}
