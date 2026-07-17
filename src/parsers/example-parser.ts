import type { NormalizedLead } from "@/types/lead";
import { BaseParser } from "./base-parser";
import type { ParserManifest } from "./parser-manifest";

export class ExampleParser extends BaseParser<Record<string, unknown>> {
  key = "example";

  get manifest(): ParserManifest {
    return {
      key: this.key,
      name: "Example Parser",
      version: "1.0.0",
      description: "Generic parser for testing and demonstration",
      providerTypesSupported: [],
      developerNotes: "Supports name, email, phone, and company fields from flat payloads",
      supportsAttachments: false,
      enabled: true,
    };
  }

  parse(input: Record<string, unknown>): NormalizedLead {
    return {
      name: String(input.name ?? "Unknown Lead"),
      email: typeof input.email === "string" ? input.email : undefined,
      phone: typeof input.phone === "string" ? input.phone : undefined,
      company: typeof input.company === "string" ? input.company : undefined,
    };
  }
}
