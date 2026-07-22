import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ExportButton } from "@/components/shared/export-button";
import { UsersPageContent, type SerializedUser } from "@/components/users/users-page-content";
import { userService } from "@/services/user.service";
import { parseListQuery, toSearchParams } from "@/lib/query-builder";
import type { TableQueryState } from "@/hooks/use-table-query";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = parseListQuery(toSearchParams(resolvedSearchParams));
  const result = await userService.listPage(toSearchParams(resolvedSearchParams));
  const users = result.data as Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    salesPrivilege: string | null;
    active: boolean;
    createdAt: Date;
    lastLoginAt: Date | null;
    lastSeenAt: Date | null;
    assignedLeads: number;
  }>;

  const tableInitial: Partial<TableQueryState> = {
    search: query.search ?? "",
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    filters: Object.fromEntries(
      Object.entries(query.filters).map(([key, value]) => [key, value.join(",")])
    ),
    dateFrom: query.dateFrom?.toISOString(),
    dateTo: query.dateTo?.toISOString(),
  };

  const serializedUsers: SerializedUser[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    salesPrivilege: u.salesPrivilege,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
    assignedLeads: u.assignedLeads,
  }));

  return (
    <>
      <Navbar
        title="User Administration"
        showResync
        actions={
          <>
            <ExportButton type="users" iconOnly />
            <SignOutButton />
          </>
        }
      />
      <UsersPageContent
        users={serializedUsers}
        initial={tableInitial}
        pagination={result.pagination}
      />
    </>
  );
}
