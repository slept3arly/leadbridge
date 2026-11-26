import { isSuccessfulActivityResponse } from "@/lib/activity-options";

export type LeadActivityFilterState = {
  responses: string[];
  interests: string[];
  reasons: string[];
};

export type LeadActivityDependencyResolution = {
  responses: string[];
  interests: string[];
  reasons: string[];
  interestEnabled: boolean;
  reasonEnabled: boolean;
  interestMessage: string | null;
  reasonMessage: string | null;
  clearedInterests: boolean;
  clearedReasons: boolean;
};

/**
 * Contacted responses (`PICKED_UP`, `REPLIED`) are the only ones that record an
 * Interest outcome. When no response is selected, all responses are permitted.
 */
export function canFilterLeadInterest(responses: readonly string[]): boolean {
  if (responses.length === 0) return true;
  return responses.some((response) => isSuccessfulActivityResponse(response));
}

/**
 * Reason is only recorded for `NOT_INTERESTED` outcomes, and only when the
 * selected responses permit a contacted interaction.
 */
export function canFilterLeadReason(
  responses: readonly string[],
  interests: readonly string[],
): boolean {
  if (!canFilterLeadInterest(responses)) return false;
  return interests.includes("NOT_INTERESTED");
}

/**
 * Reconciles child Interest and Reason selections against parent Response and
 * Interest selections, clearing any invalid child values and explaining why.
 */
export function reconcileLeadActivityFilters(
  state: LeadActivityFilterState,
): LeadActivityDependencyResolution {
  const interestEnabled = canFilterLeadInterest(state.responses);
  const interests = interestEnabled ? state.interests : [];
  const clearedInterests = !interestEnabled && state.interests.length > 0;

  const reasonEnabled = canFilterLeadReason(state.responses, interests);
  const reasons = reasonEnabled ? state.reasons : [];
  const clearedReasons = !reasonEnabled && state.reasons.length > 0;

  let interestMessage: string | null = null;
  if (!interestEnabled) {
    interestMessage = clearedInterests
      ? "Cleared Interest because the selected responses do not include a contacted interaction (Picked up or Replied)."
      : "Disabled because the selected responses do not include a contacted interaction (Picked up or Replied).";
  }

  let reasonMessage: string | null = null;
  if (!interestEnabled) {
    reasonMessage = clearedReasons
      ? "Cleared Reason because the selected responses do not permit Interest or Reason."
      : "Disabled until a contacted response and Not Interested are selected.";
  } else if (!reasonEnabled) {
    if (interests.length === 0) {
      reasonMessage = clearedReasons
        ? "Cleared Reason because Interest no longer includes Not Interested."
        : "Select Not Interested in Interest to filter by Reason.";
    } else {
      reasonMessage = clearedReasons
        ? "Cleared Reason because Interest excludes Not Interested."
        : "Reason applies only when Interest includes Not Interested.";
    }
  } else if (interests.some((interest) => interest !== "NOT_INTERESTED")) {
    reasonMessage = "Applies only to Not Interested interactions.";
  }

  return {
    responses: state.responses,
    interests,
    reasons,
    interestEnabled,
    reasonEnabled,
    interestMessage,
    reasonMessage,
    clearedInterests,
    clearedReasons,
  };
}
