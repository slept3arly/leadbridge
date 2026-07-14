import type { NormalizedLead } from "@/types/lead";
import { BaseParser } from "./base-parser";

export class ExampleParser extends BaseParser<Record<string, unknown>> {
  key = "example";

  parse(input: Record<string, unknown>): NormalizedLead {
    return {
      name: String(input.name ?? "Unknown Lead"),
      email: typeof input.email === "string" ? input.email : undefined,
      phone: typeof input.phone === "string" ? input.phone : undefined,
      company: typeof input.company === "string" ? input.company : undefined,
    };
  }
}
