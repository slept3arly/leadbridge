import { prisma } from "@/lib/prisma";
import type { RawPayload } from "./runtime-types";

export interface RoutingHints {
  recipientGmailAccount?: string;
  senderEmail?: string;
  senderDomain?: string;
  subject?: string;
  gmailLabel?: string;
}

export interface RoutingMatch {
  parserId: string;
  providerId: string;
  ruleId: string;
}

export interface RoutingResult {
  match: RoutingMatch | null;
  unmatchedId?: string;
}

export class RoutingEngine {
  async route(
    hints: RoutingHints,
    payload?: RawPayload,
    connectorId?: string,
  ): Promise<RoutingResult> {
    const rules = await prisma.routingRule.findMany({
      where: { active: true },
      orderBy: [{ fallback: "asc" }, { priority: "asc" }],
    });

    for (const rule of rules) {
      if (rule.fallback) {
        return { match: this.toMatch(rule) };
      }
      if (
        (!rule.recipientGmailAccount ||
          rule.recipientGmailAccount === hints.recipientGmailAccount) &&
        (!rule.senderEmail ||
          rule.senderEmail.toLowerCase() ===
            hints.senderEmail?.toLowerCase()) &&
        (!rule.senderDomain ||
          hints.senderEmail
            ?.toLowerCase()
            .endsWith(`@${rule.senderDomain.toLowerCase()}`)) &&
        (!rule.subjectContains ||
          hints.subject
            ?.toLowerCase()
            .includes(rule.subjectContains.toLowerCase())) &&
        (!rule.gmailLabel || rule.gmailLabel === hints.gmailLabel)
      ) {
        return { match: this.toMatch(rule) };
      }
    }

    if (payload && hints.senderEmail) {
      const unmatchedId = await this.recordUnmatched(hints, payload, connectorId);
      return { match: null, unmatchedId };
    }

    return { match: null };
  }

  private async recordUnmatched(
    hints: RoutingHints,
    payload: RawPayload,
    connectorId?: string,
  ): Promise<string> {
    const rawPreview = [
      hints.subject,
      typeof payload.snippet === "string" ? payload.snippet.slice(0, 300) : undefined,
      typeof payload.plainText === "string" ? payload.plainText.slice(0, 300) : undefined,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 500);

    const record = await prisma.unmatchedEmail.create({
      data: {
        senderEmail: hints.senderEmail ?? "",
        subject: hints.subject ?? null,
        receivedAt: new Date(),
        rawPreview,
        status: "UNMATCHED",
        connectorId,
        rawPayload: payload as object,
      },
    });

    return record.id;
  }

  private toMatch(
    rule: { id: string; parserId: string; providerId: string },
  ): RoutingMatch {
    return {
      parserId: rule.parserId,
      providerId: rule.providerId,
      ruleId: rule.id,
    };
  }
}
