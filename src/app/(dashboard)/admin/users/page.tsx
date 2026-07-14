import { CreateUserForm } from "@/components/create-user-form";
import { DataTable } from "@/components/data-table";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { userService } from "@/services/user.service";

export default async function AdminUsersPage() {
  const users = await userService.list();

  return (
    <>
      <Navbar title="User Administration" />
      <Card>
        <h2 className="text-xl font-semibold">Create internal user</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Only admins can provision accounts. Public signup stays disabled.</p>
        <div className="mt-6"><CreateUserForm /></div>
      </Card>
      <DataTable
        rows={users}
        columns={[
          { key: "name", header: "Name", render: (user) => user.name },
          { key: "email", header: "Email", render: (user) => user.email },
          { key: "role", header: "Role", render: (user) => <Badge label={user.role} /> },
          { key: "active", header: "Status", render: (user) => (user.active ? "Active" : "Inactive") },
          { key: "createdAt", header: "Created", render: (user) => formatDate(user.createdAt) },
        ]}
      />
    </>
  );
}
