import { google, type gmail_v1 } from "googleapis";
import type { GmailCredentials, GmailRawMessage, GmailMessageHeaders, GmailAttachment } from "./gmail-types";
import { classifyGmailError } from "./gmail-errors";

const MAX_RESULTS = 50;
const BATCH_SIZE = 10;
const RATE_LIMIT_DELAY_MS = 200;

function parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): GmailMessageHeaders {
  const map: Record<string, string> = {};
  for (const h of headers) {
    if (h.name && h.value) map[h.name.toLowerCase()] = h.value;
  }
  return {
    from: map.from,
    to: map.to,
    cc: map.cc,
    subject: map.subject,
    date: map.date,
    messageId: map["message-id"],
    references: map.references,
    inReplyTo: map["in-reply-to"],
    contentType: map["content-type"],
  };
}

function decodeBase64(data?: string | null): string {
  if (!data) return "";
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(part: gmail_v1.Schema$MessagePart): { textBody?: string; htmlBody?: string } {
  const result: { textBody?: string; htmlBody?: string } = {};

  if (part.mimeType === "text/plain" && part.body?.data) {
    result.textBody = decodeBase64(part.body.data);
  } else if (part.mimeType === "text/html" && part.body?.data) {
    result.htmlBody = decodeBase64(part.body.data);
  }

  if (part.parts) {
    for (const sub of part.parts) {
      const subResult = extractBody(sub);
      if (subResult.textBody) result.textBody = subResult.textBody;
      if (subResult.htmlBody) result.htmlBody = subResult.htmlBody;
    }
  }

  return result;
}

function extractAttachments(part: gmail_v1.Schema$MessagePart): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];

  if (part.filename && part.body?.attachmentId && part.mimeType) {
    const headerMap: Record<string, string> = {};
    if (part.headers) {
      for (const h of part.headers) {
        if (h.name && h.value) headerMap[h.name.toLowerCase()] = h.value;
      }
    }
    attachments.push({
      id: part.partId ?? "",
      filename: part.filename,
      mimeType: part.mimeType,
      size: Number(part.body?.size ?? 0),
      attachmentId: part.body.attachmentId,
      contentId: headerMap["content-id"],
    });
  }

  if (part.parts) {
    for (const sub of part.parts) {
      attachments.push(...extractAttachments(sub));
    }
  }

  return attachments;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GmailClient {
  private readonly gmail: gmail_v1.Gmail;

  constructor(private readonly credentials: GmailCredentials) {
    const auth = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
    );
    auth.setCredentials({ refresh_token: credentials.refreshToken });
    this.gmail = google.gmail({ version: "v1", auth });
  }

  async verifyConnection(): Promise<{
    success: boolean;
    emailAddress?: string;
    historyId?: string;
    error?: string;
  }> {
    try {
      const profile = await this.getProfile();
      return {
        success: true,
        emailAddress: profile.emailAddress,
        historyId: profile.historyId,
      };
    } catch (error) {
      const classified = classifyGmailError(error);
      return {
        success: false,
        error: classified.message,
      };
    }
  }

  async getProfile(): Promise<{ emailAddress: string; historyId: string }> {
    const res = await this.gmail.users.getProfile({ userId: "me" });
    return {
      emailAddress: res.data.emailAddress ?? "",
      historyId: res.data.historyId ?? "0",
    };
  }

  async fetchUnreadMessages(options?: {
    maxResults?: number;
    labelIds?: string[];
    subjectFilter?: string;
  }): Promise<GmailRawMessage[]> {
    const messages: GmailRawMessage[] = [];
    let nextPageToken: string | undefined;

    const queryParts = ["is:unread"];
    if (options?.subjectFilter) {
      queryParts.push(`subject:"${options.subjectFilter.replace(/"/g, '\\"')}"`);
    }

    do {
      const listRes = await this.withRetry(() =>
        this.gmail.users.messages.list({
          userId: "me",
          maxResults: options?.maxResults ?? MAX_RESULTS,
          labelIds: options?.labelIds ?? ["INBOX", "UNREAD"],
          pageToken: nextPageToken,
          q: queryParts.join(" "),
        }),
      );

      const ids = listRes.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];
      const batchMessages = await this.fetchBatch(ids);
      messages.push(...batchMessages);

      nextPageToken = listRes.data.nextPageToken ?? undefined;
    } while (nextPageToken);

    return messages;
  }

  async fetchChangesSince(historyId: string): Promise<GmailRawMessage[]> {
    const messages: GmailRawMessage[] = [];
    let nextPageToken: string | undefined;

    do {
      const historyRes = await this.withRetry(() =>
        this.gmail.users.history.list({
          userId: "me",
          startHistoryId: historyId,
          historyTypes: ["messageAdded"],
          pageToken: nextPageToken,
        }),
      );

      const history = historyRes.data.history ?? [];
      const ids: string[] = [];
      for (const record of history) {
        const added = record.messagesAdded ?? [];
        for (const entry of added) {
          if (entry.message?.id) ids.push(entry.message.id);
        }
      }

      const batchMessages = await this.fetchBatch(ids);
      messages.push(...batchMessages);

      nextPageToken = historyRes.data.nextPageToken ?? undefined;
    } while (nextPageToken);

    return messages;
  }

  private async fetchBatch(ids: string[]): Promise<GmailRawMessage[]> {
    const messages: GmailRawMessage[] = [];

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((id) => this.fetchMessage(id)),
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          messages.push(result.value);
        }
      }

      if (i + BATCH_SIZE < ids.length) {
        await delay(RATE_LIMIT_DELAY_MS);
      }
    }

    return messages;
  }

  private async fetchMessage(id: string): Promise<GmailRawMessage | null> {
    try {
      const res = await this.withRetry(() =>
        this.gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        }),
      );

      const data = res.data;
      const payload = data.payload;

      const headers: GmailMessageHeaders = parseHeaders(payload?.headers ?? []);
      const bodies = payload ? extractBody(payload) : {};
      const attachments = payload ? extractAttachments(payload) : [];

      return {
        id: data.id ?? "",
        threadId: data.threadId ?? "",
        historyId: data.historyId ?? "",
        internalDate: data.internalDate ?? "0",
        labelIds: data.labelIds ?? [],
        snippet: data.snippet ?? "",
        sizeEstimate: data.sizeEstimate ?? 0,
        headers,
        textBody: bodies.textBody,
        htmlBody: bodies.htmlBody,
        attachments,
        raw: data as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  private async withRetry<T>(
    fn: () => Promise<{ data: T }>,
    maxRetries = 3,
  ): Promise<{ data: T }> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const classified = classifyGmailError(error);

        if (attempt >= maxRetries) break;

        const isRetryable =
          classified.name === "GmailQuotaError" ||
          classified.name === "GmailMailboxError" ||
          (!classified.name.startsWith("Gmail"));

        if (!isRetryable) break;

        await delay(RATE_LIMIT_DELAY_MS * attempt);
      }
    }

    throw classifyGmailError(lastError);
  }
}
