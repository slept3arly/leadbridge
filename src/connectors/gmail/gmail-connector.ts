import type { ExecutionContext, RawPayload, IConnector } from "@/runtime/runtime-types";
import { GmailClient } from "./gmail-client";
import type { GmailCredentials } from "./gmail-types";
import { classifyGmailError } from "./gmail-errors";

const CONNECTOR_TYPE = "gmail";

function getCredentials(key: string): GmailCredentials {
  const prefix = `GMAIL_${key.toUpperCase()}`;
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`] ?? "",
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] ?? "",
    refreshToken: process.env[`${prefix}_REFRESH_TOKEN`] ?? "",
  };
}

function extractDomain(email?: string): string | undefined {
  if (!email) return undefined;
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : undefined;
}

function toRoutingHints(
  headers: { from?: string; to?: string; subject?: string },
  labelIds: string[],
): Record<string, unknown> {
  const knownLabels = new Set([
    "INBOX", "UNREAD", "SENT", "IMPORTANT", "CATEGORY_PRIMARY",
    "PROCESSED", "STARRED", "DRAFT", "TRASH", "SPAM",
  ]);
  return {
    recipientGmailAccount: headers.to,
    senderEmail: headers.from,
    senderDomain: extractDomain(headers.from),
    subject: headers.subject,
    gmailLabel: labelIds.find((l) => !knownLabels.has(l)),
  };
}

function ccArray(headers: { cc?: string }): string[] {
  if (!headers.cc) return [];
  return headers.cc.split(",").map((s) => s.trim()).filter(Boolean);
}

function buildPayload(msg: {
  id: string;
  threadId: string;
  historyId: string;
  internalDate: string;
  labelIds: string[];
  snippet: string;
  sizeEstimate: number;
  headers: { from?: string; to?: string; cc?: string; subject?: string };
  textBody?: string;
  htmlBody?: string;
  attachments: Array<{ id: string; filename: string; mimeType: string; size: number; contentId?: string }>;
}, connectorId: string): RawPayload {
  return {
    _routing: toRoutingHints(msg.headers, msg.labelIds),
    _duplicateKey: msg.id,
    messageId: msg.id,
    threadId: msg.threadId,
    subject: msg.headers.subject,
    from: msg.headers.from,
    to: msg.headers.to,
    cc: ccArray({ cc: msg.headers.cc }),
    headers: msg.headers as Record<string, string>,
    plainText: msg.textBody,
    html: msg.htmlBody,
    snippet: msg.snippet,
    attachments: msg.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      contentId: a.contentId,
    })),
    internalDate: msg.internalDate,
    receivedAt: msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : new Date().toISOString(),
    providerMetadata: {
      connectorType: CONNECTOR_TYPE,
      connectorId,
      gmail: {
        historyId: msg.historyId,
        labelIds: msg.labelIds,
        sizeEstimate: msg.sizeEstimate,
      },
    },
  };
}

export class GmailConnector implements IConnector {
  readonly key: string;

  constructor(environmentKey: string) {
    this.key = `gmail_${environmentKey}`;
  }

  async execute(context: ExecutionContext): Promise<RawPayload[]> {
    const environmentKey = (context.configuration.environmentKey as string) ?? "MAIN";
    const lastHistoryId = context.configuration.lastHistoryId as string | undefined;
    const maxResults = (context.configuration.maxResults as number) ?? 50;
    const labelIds = context.configuration.labelIds as string[] | undefined;
    const subjectFilter = context.configuration.subjectFilter as string | undefined;

    const credentials = getCredentials(environmentKey);
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      context.logger.error("Missing Gmail credentials", { environmentKey });
      throw new Error(`Gmail credentials incomplete for key: ${environmentKey}`);
    }

    const client = new GmailClient(credentials);
    const profile = await client.getProfile();

    context.logger.info("Gmail connector authenticated", {
      emailAddress: profile.emailAddress,
      environmentKey,
    });

    try {
      const rawMessages = lastHistoryId
        ? await client.fetchChangesSince(lastHistoryId)
        : await client.fetchUnreadMessages({ maxResults, labelIds, subjectFilter });

      context.logger.info("Gmail messages fetched", {
        count: rawMessages.length,
        incremental: !!lastHistoryId,
        historyId: profile.historyId,
      });

      return rawMessages.map((msg) => buildPayload(msg, context.connectorId));
    } catch (error) {
      throw classifyGmailError(error);
    }
  }

  static async testConnection(
    environmentKey: string,
  ): Promise<{
    success: boolean;
    emailAddress?: string;
    historyId?: string;
    error?: string;
    details?: {
      credentialsPresent: boolean;
      authVerified: boolean;
      mailboxAccessible: boolean;
      scopes?: string[];
      tokenRefreshWorks: boolean;
    };
  }> {
    const prefix = `GMAIL_${environmentKey.toUpperCase()}`;
    const clientId = process.env[`${prefix}_CLIENT_ID`] ?? "";
    const clientSecret = process.env[`${prefix}_CLIENT_SECRET`] ?? "";
    const refreshToken = process.env[`${prefix}_REFRESH_TOKEN`] ?? "";

    const credentialsPresent = !!(clientId && clientSecret && refreshToken);
    if (!credentialsPresent) {
      const missing = [];
      if (!clientId) missing.push("CLIENT_ID");
      if (!clientSecret) missing.push("CLIENT_SECRET");
      if (!refreshToken) missing.push("REFRESH_TOKEN");
      return {
        success: false,
        error: `Missing environment variables: ${prefix}_${missing.join(`, ${prefix}_`)}`,
        details: { credentialsPresent: false, authVerified: false, mailboxAccessible: false, tokenRefreshWorks: false },
      };
    }

    const credentials = { clientId, clientSecret, refreshToken };
    const client = new GmailClient(credentials);

    const verifyResult = await client.verifyConnection();

    let mailboxAccessible = false;
    if (verifyResult.success) {
      try {
        const labelsRes = await client.verifyConnection();
        mailboxAccessible = labelsRes.success;
      } catch {
        mailboxAccessible = false;
      }
    }

    return {
      ...verifyResult,
      details: {
        credentialsPresent: true,
        authVerified: verifyResult.success,
        mailboxAccessible,
        tokenRefreshWorks: verifyResult.success,
      },
    };
  }
}
