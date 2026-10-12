import { RetryableError } from "@/runtime/runtime-errors";
import type { GmailRawMessage } from "./gmail-types";

export class GmailMessageFetchError extends RetryableError {
  constructor(failedMessageIds: string[]) {
    super(`Gmail failed to fetch ${failedMessageIds.length} message(s).`, {
      failedMessageIds,
      failureCount: failedMessageIds.length,
    });
    this.name = "GmailMessageFetchError";
  }
}

export function requireCompleteMessageBatch(
  batchIds: string[],
  results: PromiseSettledResult<GmailRawMessage>[],
): GmailRawMessage[] {
  const messages: GmailRawMessage[] = [];
  const failedIds: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") messages.push(result.value);
    else failedIds.push(batchIds[index]);
  });
  if (failedIds.length) {
    throw new GmailMessageFetchError(failedIds);
  }
  return messages;
}
