export enum Permission {
  DELETE_LEAD = "DELETE_LEAD",
  ARCHIVE_LEAD = "ARCHIVE_LEAD",
  EXPORT_LEADS = "EXPORT_LEADS",
}

export enum SalesPrivilege {
  JUNIOR = "JUNIOR",
  SENIOR = "SENIOR",
}

export type PermissionUser = {
  role: string;
  salesPrivilege?: string | null;
};

const SALES_PRIVILEGE_PERMISSIONS: Record<string, Permission[]> = {
  [SalesPrivilege.JUNIOR]: [],
  [SalesPrivilege.SENIOR]: [
    Permission.DELETE_LEAD,
    Permission.ARCHIVE_LEAD,
    Permission.EXPORT_LEADS,
  ],
};

export function can(user: PermissionUser, permission: Permission): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "SALES") {
    const privilege = user.salesPrivilege ?? SalesPrivilege.JUNIOR;
    return SALES_PRIVILEGE_PERMISSIONS[privilege]?.includes(permission) ?? false;
  }
  return false;
}
