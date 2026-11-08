import { can, Permission, type PermissionUser } from "@/lib/permissions";

export type ExportActor = PermissionUser & { id: string };
export type ExportScopePolicy =
  | "ORGANIZATION_NON_DELETED_LEADS"
  | "ACTIVITIES_FOR_VISIBLE_LEADS"
  | "FOLLOW_UPS_FOR_VISIBLE_LEADS_ASSIGNED_TO_ACTOR"
  | "NOTES_FOR_VISIBLE_LEADS"
  | "ORGANIZATION_USERS"
  | "ORGANIZATION_PROVIDERS"
  | "SAFE_CONNECTOR_METADATA"
  | "ORGANIZATION_SYNC_RUNS"
  | "ORGANIZATION_REPORT_AGGREGATES";

export type ExportAuthorization = {
  admin: true;
  sales: "DENIED" | { permission: Permission.EXPORT_LEADS; privilege: "SENIOR" };
  scope: ExportScopePolicy;
};

export const EXPORT_AUTHORIZATION = {
  leads: {
    admin: true,
    sales: { permission: Permission.EXPORT_LEADS, privilege: "SENIOR" },
    scope: "ORGANIZATION_NON_DELETED_LEADS",
  },
  activities: {
    admin: true,
    sales: { permission: Permission.EXPORT_LEADS, privilege: "SENIOR" },
    scope: "ACTIVITIES_FOR_VISIBLE_LEADS",
  },
  "follow-ups": {
    admin: true,
    sales: { permission: Permission.EXPORT_LEADS, privilege: "SENIOR" },
    scope: "FOLLOW_UPS_FOR_VISIBLE_LEADS_ASSIGNED_TO_ACTOR",
  },
  notes: {
    admin: true,
    sales: { permission: Permission.EXPORT_LEADS, privilege: "SENIOR" },
    scope: "NOTES_FOR_VISIBLE_LEADS",
  },
  users: { admin: true, sales: "DENIED", scope: "ORGANIZATION_USERS" },
  providers: { admin: true, sales: "DENIED", scope: "ORGANIZATION_PROVIDERS" },
  connectors: { admin: true, sales: "DENIED", scope: "SAFE_CONNECTOR_METADATA" },
  "sync-history": { admin: true, sales: "DENIED", scope: "ORGANIZATION_SYNC_RUNS" },
  reports: { admin: true, sales: "DENIED", scope: "ORGANIZATION_REPORT_AGGREGATES" },
} as const satisfies Record<string, ExportAuthorization>;

export type ExportCategoryPolicyId = keyof typeof EXPORT_AUTHORIZATION;

/** Shared category authorization decision used by the export service layer. */
export function canExportCategory(actor: ExportActor, category: ExportCategoryPolicyId): boolean {
  const authorization = EXPORT_AUTHORIZATION[category];
  if (actor.role === "ADMIN") return authorization.admin;
  if (actor.role !== "SALES" || authorization.sales === "DENIED") return false;
  const privilege = actor.salesPrivilege ?? "JUNIOR";
  return privilege === authorization.sales.privilege && can(actor, authorization.sales.permission);
}

export function getExportScopePolicy(category: ExportCategoryPolicyId): ExportScopePolicy {
  return EXPORT_AUTHORIZATION[category].scope;
}

export const SALES_SCOPE_RULES = {
  leadPredicate: "assignedUserId equals authenticated actor id AND isDeleted equals false",
  unassignedLeads: "DENY",
  clientSuppliedIdentityCanWidenScope: false,
  relatedRecords: "Must join through non-deleted leads assigned to authenticated actor",
  followUps: "Related lead must be visible AND FollowUp.assignedUserId equals authenticated actor id",
  adminDeletedRecords: "Excluded by default; deleted-record export is not part of this contract",
} as const;
