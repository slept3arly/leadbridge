import { BaseParser } from "@/parsers/base-parser";
import type { NormalizedLead } from "@/types/lead";
import type { ParserManifest } from "@/parsers/parser-manifest";

function extractName(from?: string): string {
  if (!from) return "Unknown Sender";
  const match = from.match(/^"?(.+?)"?\s*<.*>$/);
  if (match) return match[1].trim();
  const emailMatch = from.match(/^([^@<\s]+)@/);
  if (emailMatch) return emailMatch[1];
  return from.split("@")[0] ?? "Unknown Sender";
}

function extractEmail(from?: string): string | undefined {
  if (!from) return undefined;
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1];
  if (from.includes("@")) return from;
  return undefined;
}

function extractCompany(email?: string): string | undefined {
  if (!email) return undefined;
  const domain = email.split("@")[1];
  if (!domain) return undefined;
  return domain.split(".")[0];
}

export class GmailParser extends BaseParser<Record<string, unknown>> {
  readonly key = "gmail";

  get manifest(): ParserManifest {
    return {
      key: this.key,
      name: "Gmail Email Parser",
      version: "1.1.0",
      description: "Parses generic EmailDocument payloads into normalized leads",
      providerTypesSupported: ["gmail"],
      developerNotes: "Extracts sender name, email, company from From header; uses subject as requirement",
      supportsAttachments: true,
      enabled: true,
    };
  }

  parse(input: Record<string, unknown>): NormalizedLead {
    const from = input.from as string | undefined;
    const subject = input.subject as string | undefined;
    const plainText = input.plainText as string | undefined;
    const snippet = input.snippet as string | undefined;
    const messageId = input.messageId as string | undefined;
    const internalDate = input.internalDate as string | undefined;

    return {
      name: extractName(from),
      email: extractEmail(from),
      company: extractCompany(extractEmail(from)),
      requirement: subject
        ? `Re: ${subject}`
        : plainText
          ? plainText.slice(0, 200)
          : (snippet ?? undefined),
      sourceReferenceId: messageId,
      receivedAt: internalDate
        ? new Date(Number(internalDate))
        : new Date(),
      rawPayload: input as Record<string, unknown>,
    };
  }
}
