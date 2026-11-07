type FollowUpCandidate = {
  id: string;
  status: string;
  leadId?: string | null;
};

export function getEligibleProgressFollowUps<T extends FollowUpCandidate>(items: T[], leadId: string): T[] {
  return items.filter((item) => item.status === "PENDING" && (!item.leadId || item.leadId === leadId));
}

export function getValidProposedFollowUpId(
  proposedId: string | null | undefined,
  pendingFollowUps: FollowUpCandidate[],
): string {
  return proposedId && pendingFollowUps.some((item) => item.id === proposedId && item.status === "PENDING")
    ? proposedId
    : "";
}

export function getCompletionFollowUpId(
  selectedId: string | null | undefined,
  pendingFollowUps: FollowUpCandidate[],
): string | undefined {
  return getValidProposedFollowUpId(selectedId, pendingFollowUps) || undefined;
}
