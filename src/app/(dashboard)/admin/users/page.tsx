import { CreateUserForm } from "@/components/create-user-form";
import { DataTable } from "@/components/data-table";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ExportButton } from "@/components/export-button";
import { UserPrivilegeCell } from "@/components/user-privilege-cell";
import { formatDate } from "@/lib/utils";
import { userService } from "@/services/user.service";
import { ServerTableControls } from "@/components/server-table-controls";
import { parseListQuery, toSearchParams } from "@/lib/query-builder";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseListQuery(toSearchParams(await searchParams));
  const result = await userService.listPage(toSearchParams(await searchParams));
  const users = result.data;

  return (
    <>
      <Navbar title="User Administration" actions={<ExportButton type="users" />} />
      <Card>
        <h2 className="text-xl font-semibold">Create internal user</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Only admins can provision accounts. Public signup stays disabled.</p>
        <div className="mt-6"><CreateUserForm /></div>
      </Card>
      <ServerTableControls initial={{ search: query.search ?? "", page: query.page, pageSize: query.pageSize, filters: Object.fromEntries(Object.entries(query.filters).map(([key, value]) => [key, value.join(",")])) }} pagination={result.pagination} filters={[{ key: "role", label: "Role", options: [{ value: "ADMIN", label: "Admin" }, { value: "SALES", label: "Sales" }] }]} />
      <DataTable
        rows={users}
        columns={[
          { key: "name", header: "Name", render: (user) => user.name },
          { key: "email", header: "Email", render: (user) => user.email },
          { key: "role", header: "Role", render: (user) => <Badge label={user.role} /> },
          { key: "privilege", header: "Privilege", render: (user) => <UserPrivilegeCell userId={user.id} role={user.role} privilege={user.salesPrivilege} /> },
          { key: "active", header: "Status", render: (user) => (user.active ? "Active" : "Inactive") },
          { key: "createdAt", header: "Created", render: (user) => formatDate(user.createdAt) },
        ]}
      />
    </>
  );
}
