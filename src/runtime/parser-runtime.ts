import type { BaseParser } from "@/parsers/base-parser";
import type { ExecutionContext, RawPayload } from "./runtime-types";
import type { NormalizedLead } from "@/types/lead";
import { ConfigurationError, ParserError } from "./runtime-errors";

export interface ParserRegistry {
  get(key: string): BaseParser | undefined;
}

export class ParserRuntime {
  constructor(private readonly registry: ParserRegistry) {}

  async parse(
    payload: RawPayload,
    parserKey: string,
    context: ExecutionContext,
  ): Promise<NormalizedLead> {
    const parser = this.registry.get(parserKey);
    if (!parser) {
      throw new ConfigurationError(`No parser registered for key: ${parserKey}`, { parserKey });
    }

    context.logger.debug("Parser executing", { parserKey });

    try {
      const lead = parser.parse(payload);
      context.logger.debug("Parser completed", { parserKey, leadName: lead.name });
      return lead;
    } catch (error) {
      throw new ParserError(
        `Parser '${parserKey}' failed: ${error instanceof Error ? error.message : String(error)}`,
        { parserKey },
      );
    }
  }
}
