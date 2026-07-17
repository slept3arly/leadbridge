export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface GmailMessageHeaders {
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  date?: string;
  messageId?: string;
  references?: string;
  inReplyTo?: string;
  returnPath?: string;
  received?: string;
  contentType?: string;
  mimeVersion?: string;
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  attachmentId?: string;
  contentId?: string;
}

export interface GmailRawMessage {
  id: string;
  threadId: string;
  historyId: string;
  internalDate: string;
  labelIds: string[];
  snippet: string;
  sizeEstimate: number;
  headers: GmailMessageHeaders;
  textBody?: string;
  htmlBody?: string;
  attachments: GmailAttachment[];
  raw: Record<string, unknown>;
}

export interface GmailHistoryRecord {
  historyId: string;
  messagesAdded: Array<{
    message: {
      id: string;
      threadId: string;
    };
  }>;
  messagesDeleted?: Array<{
    message: {
      id: string;
      threadId: string;
    };
  }>;
  labelsAdded?: Array<{
    message: {
      id: string;
      threadId: string;
    };
    labelIds: string[];
  }>;
  labelsRemoved?: Array<{
    message: {
      id: string;
      threadId: string;
    };
    labelIds: string[];
  }>;
}
