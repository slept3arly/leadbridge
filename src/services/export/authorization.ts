import { isImplementedExportCategory, type ExportCategoryId } from "@/lib/export/registry";
import { canExportCategory, type ExportActor } from "@/lib/export/policy";
import { ServiceError } from "@/lib/service-errors";
import type { LeadExportFilters } from "@/lib/export/filters";

export function authorizeExportCategory(actor: ExportActor, category: ExportCategoryId): void {
  if (!canExportCategory(actor, category)) {
    throw new ServiceError("You do not have permission to export this category.", 403);
  }
  if (!isImplementedExportCategory(category)) {
    throw new ServiceError(`Export category '${category}' is not available yet.`, 404);
  }
}

export function authorizeLeadExportFilters(actor: ExportActor, filters: LeadExportFilters): void {
  if (actor.role === "SALES" && (filters.assignedUserIds?.length || filters.assignedUnassigned)) {
    throw new ServiceError("Assigned salesperson filters are available to administrators only.", 403);
  }
}
