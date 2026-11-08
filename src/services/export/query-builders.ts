import type { Prisma } from "@/generated/prisma/client";
import {
  resolveExportDateRange,
  type ExportDateRangeInput,
  type ResolvedExportDateRange,
} from "@/lib/export/dates";
import type {
  LeadExportFilters,
  ProviderExportFilters,
  ReportExportFilters,
  SyncHistoryExportFilters,
  UserExportFilters,
} from "@/lib/export/filters";
import type { ExportActor } from "@/lib/export/policy";
import { buildExportLeadScope } from "@/services/export/scope";

export type ExportDateBounds = ResolvedExportDateRange;

function resolvedBounds(range?: ExportDateRangeInput, legacyBounds?: ExportDateBounds): ExportDateBounds | undefined {
  if (legacyBounds) return legacyBounds;
  if (!range) return undefined;
  return resolveExportDateRange(range);
}

function searchClauses(search: string | undefined, fields: string[]) {
  if (!search) return [];
  return [{ OR: fields.map((field) => ({ [field]: { contains: search, mode: "insensitive" as const } })) }];
}

function dateTimeFilter(bounds?: ExportDateBounds) {
  return bounds ? {
    ...(bounds.from ? { gte: bounds.from } : {}),
    ...(bounds.toExclusive ? { lt: bounds.toExclusive } : {}),
  } : undefined;
}

function leadDateClause(field: LeadExportFilters["dateField"], bounds?: ExportDateBounds): Prisma.LeadWhereInput | undefined {
  const dateFilter = dateTimeFilter(bounds);
  if (!dateFilter) return undefined;
  switch (field) {
    case "createdAt": return { createdAt: dateFilter };
    case "lastContactedAt": return { lastContactedAt: dateFilter };
    case "closedAt": return { closedAt: dateFilter };
    case "nextFollowUpAt": return { nextFollowUpAt: dateFilter };
  }
}

function leadActivityDateBounds(filters: LeadExportFilters): ExportDateBounds | undefined {
  if (filters.activityDate === "today" || filters.activityDate === "yesterday") {
    return resolveExportDateRange({ preset: filters.activityDate });
  }
  if (filters.activityDate !== "custom") return undefined;

  const dateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const from = filters.activityFrom
    ? dateOnly(filters.activityFrom)
      ? new Date(`${filters.activityFrom}T00:00:00.000Z`)
      : new Date(filters.activityFrom)
    : undefined;
  let toExclusive: Date | undefined;
  if (filters.activityTo) {
    if (dateOnly(filters.activityTo)) {
      toExclusive = new Date(`${filters.activityTo}T00:00:00.000Z`);
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    } else {
      // The Leads table treats its custom end timestamp as inclusive.
      toExclusive = new Date(new Date(filters.activityTo).getTime() + 1);
    }
  }
  return { ...(from ? { from } : {}), ...(toExclusive ? { toExclusive } : {}) };
}

export function buildLeadExportWhere(
  filters: LeadExportFilters,
  actor: ExportActor,
  legacyBounds?: ExportDateBounds,
): Prisma.LeadWhereInput {
  const clauses: Prisma.LeadWhereInput[] = [buildExportLeadScope(actor)];
  const bounds = resolvedBounds(filters.dateRange, legacyBounds);
  const dateClause = leadDateClause(filters.dateField, bounds);
  if (dateClause) clauses.push(dateClause);
  if (filters.status?.length) clauses.push({ status: { in: filters.status } });
  if (filters.priority?.length) clauses.push({ priority: { in: filters.priority } });
  if (filters.category?.length) clauses.push({ category: { in: filters.category } });
  if (filters.sourceIds?.length) clauses.push({ sourceId: { in: filters.sourceIds } });
  if (filters.assignedUserIds?.length) clauses.push({ assignedUserId: { in: filters.assignedUserIds } });
  if (filters.assignedUnassigned) clauses.push({ assignedUserId: null });
  if (filters.city) clauses.push({ city: { contains: filters.city, mode: "insensitive" } });
  if (filters.state) clauses.push({ state: { contains: filters.state, mode: "insensitive" } });
  if (filters.country) clauses.push({ country: { contains: filters.country, mode: "insensitive" } });
  if (filters.archived === "active") clauses.push({ isArchived: false });
  if (filters.archived === "archived") clauses.push({ isArchived: true });
  const activityBounds = leadActivityDateBounds(filters);
  if (activityBounds || filters.actions?.length || filters.responses?.length || filters.interests?.length) {
    const occurredAt = dateTimeFilter(activityBounds);
    clauses.push({
      activityEvents: {
        some: {
          ...(occurredAt ? { occurredAt } : {}),
          entries: {
            some: {
              type: { in: ["CALL", "WHATSAPP"] },
              ...(filters.actions?.length ? { action: { in: filters.actions } } : {}),
              ...(filters.responses?.length ? { response: { in: filters.responses } } : {}),
              ...(filters.interests?.length ? { interest: { in: filters.interests } } : {}),
            },
          },
        },
      },
    });
  }
  clauses.push(...searchClauses(filters.search, ["displayName", "company", "email", "phone", "leadNumber"]));
  return { AND: clauses };
}

function userDateClause(field: UserExportFilters["dateField"], bounds?: ExportDateBounds): Prisma.UserWhereInput | undefined {
  const dateFilter = dateTimeFilter(bounds);
  if (!dateFilter) return undefined;
  switch (field) {
    case "createdAt": return { createdAt: dateFilter };
    case "updatedAt": return { updatedAt: dateFilter };
    case "lastLoginAt": return { lastLoginAt: dateFilter };
  }
}

export function buildUserExportWhere(filters: UserExportFilters, legacyBounds?: ExportDateBounds): Prisma.UserWhereInput {
  const clauses: Prisma.UserWhereInput[] = [{ isDeleted: false }];
  const dateClause = userDateClause(filters.dateField, resolvedBounds(filters.dateRange, legacyBounds));
  if (dateClause) clauses.push(dateClause);
  if (filters.roles?.length) clauses.push({ role: { in: filters.roles } });
  if (filters.salesPrivileges?.length) clauses.push({ salesPrivilege: { in: filters.salesPrivileges } });
  if (filters.active !== undefined) clauses.push({ active: filters.active });
  if (filters.banned !== undefined) clauses.push({ banned: filters.banned });
  if (filters.designations?.length) clauses.push({ designation: { in: filters.designations } });
  clauses.push(...searchClauses(filters.search, ["name", "email", "employeeCode"]));
  return { AND: clauses };
}

function providerDateClause(field: ProviderExportFilters["dateField"], bounds?: ExportDateBounds): Prisma.LeadSourceWhereInput | undefined {
  const dateFilter = dateTimeFilter(bounds);
  if (!dateFilter) return undefined;
  switch (field) {
    case "createdAt": return { createdAt: dateFilter };
    case "updatedAt": return { updatedAt: dateFilter };
  }
}

export function buildProviderExportWhere(filters: ProviderExportFilters, legacyBounds?: ExportDateBounds): Prisma.LeadSourceWhereInput {
  const clauses: Prisma.LeadSourceWhereInput[] = [];
  const dateClause = providerDateClause(filters.dateField, resolvedBounds(filters.dateRange, legacyBounds));
  if (dateClause) clauses.push(dateClause);
  if (filters.sourceTypes?.length) clauses.push({ sourceType: { in: filters.sourceTypes } });
  if (filters.active !== undefined) clauses.push({ active: filters.active });
  clauses.push(...searchClauses(filters.search, ["name", "slug"]));
  return clauses.length ? { AND: clauses } : {};
}

function syncDateClause(field: SyncHistoryExportFilters["dateField"], bounds?: ExportDateBounds): Prisma.ConnectorSyncRunWhereInput | undefined {
  const dateFilter = dateTimeFilter(bounds);
  if (!dateFilter) return undefined;
  switch (field) {
    case "startedAt": return { startedAt: dateFilter };
    case "completedAt": return { completedAt: dateFilter };
  }
}

export function buildSyncHistoryExportWhere(filters: SyncHistoryExportFilters, legacyBounds?: ExportDateBounds): Prisma.ConnectorSyncRunWhereInput {
  const clauses: Prisma.ConnectorSyncRunWhereInput[] = [];
  const dateClause = syncDateClause(filters.dateField, resolvedBounds(filters.dateRange, legacyBounds));
  if (dateClause) clauses.push(dateClause);
  if (filters.connectorIds?.length) clauses.push({ connectorId: { in: filters.connectorIds } });
  if (filters.connectorTypes?.length) clauses.push({ connector: { is: { type: { in: filters.connectorTypes } } } });
  if (filters.statuses?.length) clauses.push({ status: { in: filters.statuses } });
  if (filters.errorOutcome === "with-error") clauses.push({ status: "ERROR" });
  if (filters.errorOutcome === "without-error") clauses.push({ status: { not: "ERROR" } });
  return clauses.length ? { AND: clauses } : {};
}

export function buildReportLeadWhere(filters: ReportExportFilters, includeDeleted = false): Prisma.LeadWhereInput {
  const clauses: Prisma.LeadWhereInput[] = [{ isDeleted: includeDeleted }];
  const bounds = resolvedBounds(filters.dateRange);
  const dateFilter = dateTimeFilter(bounds);
  if (dateFilter) clauses.push({ createdAt: dateFilter });
  if (filters.sourceIds?.length) clauses.push({ sourceId: { in: filters.sourceIds } });
  if (filters.ownerIds?.length) clauses.push({ assignedUserId: { in: filters.ownerIds } });
  if (filters.statuses?.length) clauses.push({ status: { in: filters.statuses } });
  return { AND: clauses };
}

export function buildReportActivityLeadWhere(filters: ReportExportFilters): Prisma.LeadWhereInput {
  const clauses: Prisma.LeadWhereInput[] = [{ isDeleted: false }];
  if (filters.sourceIds?.length) clauses.push({ sourceId: { in: filters.sourceIds } });
  if (filters.ownerIds?.length) clauses.push({ assignedUserId: { in: filters.ownerIds } });
  if (filters.statuses?.length) clauses.push({ status: { in: filters.statuses } });
  return { AND: clauses };
}

/** Adds aggregate-specific constraints without overwriting selected report filters. */
export function andLeadWhere(...clauses: Prisma.LeadWhereInput[]): Prisma.LeadWhereInput {
  return { AND: clauses };
}

export function buildLeadOrderBy(): Prisma.LeadOrderByWithRelationInput[] {
  return [{ createdAt: "desc" }, { id: "desc" }];
}

export function buildUserOrderBy(): Prisma.UserOrderByWithRelationInput[] {
  return [{ id: "asc" }];
}

export function buildProviderOrderBy(): Prisma.LeadSourceOrderByWithRelationInput[] {
  return [{ id: "asc" }];
}

export function buildSyncHistoryOrderBy(): Prisma.ConnectorSyncRunOrderByWithRelationInput[] {
  return [{ startedAt: "desc" }, { id: "desc" }];
}

export function buildLeadExportCursorWhere(
  where: Prisma.LeadWhereInput,
  cursor?: { createdAt: Date; id: string },
): Prisma.LeadWhereInput {
  if (!cursor) return where;
  return { AND: [where, { OR: [
    { createdAt: { lt: cursor.createdAt } },
    { createdAt: { equals: cursor.createdAt }, id: { lt: cursor.id } },
  ] }] };
}

export function buildUserExportCursorWhere(where: Prisma.UserWhereInput, cursor?: string): Prisma.UserWhereInput {
  return cursor ? { AND: [where, { id: { gt: cursor } }] } : where;
}

export function buildProviderExportCursorWhere(where: Prisma.LeadSourceWhereInput, cursor?: string): Prisma.LeadSourceWhereInput {
  return cursor ? { AND: [where, { id: { gt: cursor } }] } : where;
}

export function buildSyncHistoryExportCursorWhere(
  where: Prisma.ConnectorSyncRunWhereInput,
  cursor?: { startedAt: Date; id: string },
): Prisma.ConnectorSyncRunWhereInput {
  if (!cursor) return where;
  return { AND: [where, { OR: [
    { startedAt: { lt: cursor.startedAt } },
    { startedAt: { equals: cursor.startedAt }, id: { lt: cursor.id } },
  ] }] };
}
