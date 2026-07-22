"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { UserTableControls } from "@/components/users/user-table-controls";
import { UserEditModal } from "@/components/users/user-edit-modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DateTimeDisplay } from "@/components/shared/date-time-display";
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
  pagination: { page: number; totalPages: number };
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SerializedUser | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

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
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-slate-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 h-10"
          >
            <Plus size={16} />
            Create User
          </button>
        }
      />
      {users.length ? (
        <DataTable
          rows={users}
          columns={[
            {
              key: "avatar",
              header: "",
              render: (user: SerializedUser) => (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                  {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              ),
            },
            {
              key: "name",
              header: "Name",
              render: (user: SerializedUser) => <span className="font-semibold">{user.name}</span>,
            },
            {
              key: "email",
              header: "Email",
              render: (user: SerializedUser) => user.email,
            },
            {
              key: "role",
              header: "Role",
              render: (user: SerializedUser) => <Badge label={user.role} />,
            },
            {
              key: "salesPrivilege",
              header: "Sales Privilege",
              render: (user: SerializedUser) =>
                user.role === "SALES" && user.salesPrivilege ? (
                  <Badge label={user.salesPrivilege} />
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">-</span>
                ),
            },
            {
              key: "active",
              header: "Status",
              render: (user: SerializedUser) =>
                user.active ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Active</span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Inactive</span>
                ),
            },
            {
              key: "assignedLeads",
              header: "Assigned Leads",
              render: (user: SerializedUser) => user.assignedLeads.toString(),
            },
            {
              key: "lastLoginAt",
              header: "Last Login",
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
              render: (user: SerializedUser) => formatDate(user.createdAt),
            },
            {
              key: "actions",
              header: "Actions",
              render: (user: SerializedUser) => (
                <button
                  type="button"
                  onClick={() => openEdit(user)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition hover:bg-slate-50"
                >
                  Edit
                </button>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState
          title="No users found"
          description="Try adjusting your filters or create a new user."
        />
      )}

      <UserEditModal
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
