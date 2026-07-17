import type { NormalizedLead } from "@/types/lead";
import type { ParserManifest } from "./parser-manifest";

export abstract class BaseParser<T = unknown> {
  abstract key: string;
  abstract parse(input: T): NormalizedLead;

  get manifest(): ParserManifest {
    return {
      key: this.key,
      name: this.key,
      version: "1.0.0",
      description: "",
      providerTypesSupported: [],
      developerNotes: "",
      supportsAttachments: false,
      enabled: true,
    };
  }
}
