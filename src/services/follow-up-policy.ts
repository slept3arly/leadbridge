import { ServiceError } from "@/lib/service-errors";

export type FollowUpActor = { id: string; role: "ADMIN" | "SALES" };

export function resolveFollowUpAssignee(actor: FollowUpActor, requestedId?: string | null): string | null {
  if (actor.role === "SALES") {
    if (requestedId != null && requestedId !== actor.id) {
      throw new ServiceError("Sales users may assign follow-ups only to themselves.", 403);
    }
    return actor.id;
  }
  return requestedId ?? actor.id;
}

export function salesFollowUpLeadScope(userId: string) {
  return { lead: { assignedUserId: userId, isDeleted: false } };
}
