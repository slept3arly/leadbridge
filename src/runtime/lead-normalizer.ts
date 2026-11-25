import type { NormalizedLead } from "@/types/lead";
import type { NormalizationResult } from "./runtime-types";

export class LeadNormalizer {
  validate(lead: NormalizedLead): NormalizationResult {
    const warnings: string[] = [];

    if (lead.email && !this.isValidEmail(lead.email)) {
      warnings.push(`Invalid email format: ${lead.email}`);
    }

    if (lead.phone && !this.isValidPhone(lead.phone)) {
      warnings.push(`Invalid phone format: ${lead.phone}`);
    }

    return { lead, warnings };
  }

  enrich(
    lead: NormalizedLead,
    context: {
      parserVersion?: string;
      sourceType?: string;
      sourceId?: string;
    },
  ): NormalizedLead {
    return {
      ...lead,
      name: typeof lead.name === "string" ? lead.name.trim() || null : null,
      parserVersion: context.parserVersion ?? lead.parserVersion,
      sourceType: context.sourceType ?? lead.sourceType,
      sourceId: context.sourceId ?? lead.sourceId,
      importedAt: lead.importedAt ?? new Date(),
    };
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidPhone(phone: string): boolean {
    return /^[\d\s\-+().]{7,20}$/.test(phone);
  }
}
