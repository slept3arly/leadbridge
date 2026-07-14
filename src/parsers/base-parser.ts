import type { NormalizedLead } from "@/types/lead";

export abstract class BaseParser<T = unknown> {
  abstract key: string;
  abstract parse(input: T): NormalizedLead;
}
