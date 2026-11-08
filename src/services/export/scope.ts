import type { Prisma } from "@/generated/prisma/client";
import type { ExportActor } from "@/lib/export/policy";

/** Mandatory lead visibility predicate. Client filters are always combined with this using AND. */
export function buildExportLeadScope(actor: ExportActor): Prisma.LeadWhereInput {
  if (actor.role === "SALES") {
    return { assignedUserId: actor.id, isDeleted: false };
  }
  return { isDeleted: false };
}

export function buildRelatedLeadScope(actor: ExportActor): Prisma.LeadWhereInput {
  return buildExportLeadScope(actor);
}
