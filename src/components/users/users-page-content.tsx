"use client";

import { useState, useTransition } from "react";
import { DataTable } from "@/components/shared/data-table";
import { UserTableControls } from "@/components/users/user-table-controls";
import { UserEditModal } from "@/components/users/user-edit-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DateTimeDisplay } from "@/components/shared/date-time-display";
import { useHydrated } from "@/hooks/use-hydrated";
import type { TableQueryState } from "@/hooks/use-table-query";

export type SerializedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  salesPrivilege: string | null;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  assignedLeads: number;
};

export function UsersPageContent({
  users,
  initial,
  pagination,
}: {
  users: SerializedUser[];
  initial: Partial<TableQueryState>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}) {
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SerializedUser | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const hydrated = useHydrated();
  const timeZone = hydrated ? undefined : "UTC";

  const openCreate = () => {
    setSelectedUser(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEdit = (user: SerializedUser) => {
    setSelectedUser(user);
    setModalMode("edit");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedUser(null);
  };

  return (
    <>
      <UserTableControls
        initial={initial}
        pagination={pagination}
        actions={
          <Button variant="secondary" onClick={openCreate} className="h-10">
            <Plus size={16} />
            Create User
          </Button>
        }
        startTransition={startTransition}
      />
      <DataTable
          rows={users}
          compact
          tableClassName="min-w-[1248px] table-fixed"
          isLoading={isPending}
          emptyTitle="No users found"
          emptyDescription="Try changing the search or filters, or create a user account."
          emptyAction={<Button variant="secondary" onClick={openCreate}><Plus size={16} />Create User</Button>}
          columns={[
            {
              key: "avatar",
              header: "",
              headerClassName: "w-14",
              className: "w-14",
              render: (user: SerializedUser) => (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                  {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              ),
            },
            {
              key: "name",
              header: "Name",
              headerClassName: "w-[160px]",
              className: "w-[160px]",
              render: (user: SerializedUser) => <span className="block truncate font-semibold" title={user.name}>{user.name}</span>,
            },
            {
              key: "email",
              header: "Email",
              headerClassName: "w-[220px]",
              className: "w-[220px]",
              render: (user: SerializedUser) => <span className="block truncate" title={user.email}>{user.email}</span>,
            },
            {
              key: "role",
              header: "Role",
              headerClassName: "w-24",
              className: "w-24",
              render: (user: SerializedUser) => <Badge label={user.role === "SALES" ? "Sales" : "Admin"} toneKey={user.role} className="whitespace-nowrap" />,
            },
            {
              key: "salesPrivilege",
              header: "Sales Privilege",
              headerClassName: "w-[130px]",
              className: "w-[130px]",
              render: (user: SerializedUser) =>
                user.role === "SALES" && user.salesPrivilege ? (
                  <Badge label={user.salesPrivilege === "JUNIOR" ? "Junior" : "Senior"} toneKey={user.salesPrivilege} className="whitespace-nowrap" />
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">-</span>
                ),
            },
            {
              key: "active",
              header: "Status",
              headerClassName: "w-24",
              className: "w-24",
              render: (user: SerializedUser) =>
                <Badge label={user.active ? "Active" : "Inactive"} toneKey={user.active ? "Active" : "Inactive"} className="whitespace-nowrap" />,
            },
            {
              key: "assignedLeads",
              header: "Assigned Leads",
              headerClassName: "w-28 text-right",
              className: "w-28 text-right tabular-nums",
              render: (user: SerializedUser) => user.assignedLeads,
            },
            {
              key: "lastLoginAt",
              header: "Last Login",
              headerClassName: "w-[150px]",
              className: "w-[150px] whitespace-nowrap",
              render: (user: SerializedUser) =>
                <DateTimeDisplay
                  date={user.lastLoginAt}
                  fallback="-"
                  className="text-sm"
                />,
            },
            {
              key: "createdAt",
              header: "Created",
              headerClassName: "w-[130px]",
              className: "w-[130px] whitespace-nowrap",
              render: (user: SerializedUser) => formatDate(user.createdAt, "-", timeZone),
            },
            {
              key: "actions",
              header: "Actions",
              headerClassName: "w-24 text-center",
              className: "w-24 text-center",
              render: (user: SerializedUser) => (
                <Button variant="secondary" size="sm" onClick={() => openEdit(user)}>
                  Edit
                </Button>
              ),
            },
          ]}
        />

      <UserEditModal
        key={modalMode === "edit" && selectedUser ? selectedUser.id : "new-user"}
        open={modalOpen}
        onClose={closeModal}
        user={modalMode === "edit" && selectedUser ? {
          id: selectedUser.id,
          name: selectedUser.name,
          email: selectedUser.email,
          role: selectedUser.role,
          salesPrivilege: selectedUser.salesPrivilege,
          active: selectedUser.active,
        } : null}
      />
    </>
  );
}
