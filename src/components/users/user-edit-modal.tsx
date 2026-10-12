"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Eye, EyeOff } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { toast } from "sonner";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  salesPrivilege: string | null;
  active: boolean;
};

export function UserEditModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user?: UserData | null;
}) {
  const router = useRouter();
  const isEdit = !!user;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState(user?.role ?? "SALES");
  const [salesPrivilege, setSalesPrivilege] = useState(user?.salesPrivilege ?? "JUNIOR");
  const [active, setActive] = useState(user?.active ?? true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open, onClose, canClose: !pending && !confirmOpen });

  const saveUser = async () => {
    setPending(true);
    setError(null);

    try {
      if (isEdit) {
        const payload: Record<string, unknown> = { name, role, active };
        if (role === "SALES") payload.salesPrivilege = salesPrivilege;
        if (password) payload.password = password;
        await axios.patch(`/api/users/${user.id}`, payload);
      } else {
        const payload: Record<string, unknown> = { name, email, password, role };
        if (role === "SALES") payload.salesPrivilege = salesPrivilege;
        await axios.post("/api/users", payload);
      }
      toast.success(isEdit ? "User updated" : "User created");
      onClose();
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, isEdit ? "Failed to update user." : "Unable to create the user right now."));
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && (role !== user.role || active !== user.active)) {
      setConfirmOpen(true);
      return;
    }
    void saveUser();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={pending || confirmOpen ? undefined : onClose} />

      <div ref={dialogRef} data-accessible-dialog role="dialog" aria-modal="true" aria-labelledby="user-modal-title" aria-describedby="user-modal-description" tabIndex={-1} className="relative z-10 flex h-[88dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-4">
          <div className="min-w-0">
            <h2 id="user-modal-title" className="text-lg font-semibold text-[var(--color-ink)]">
              {isEdit ? "Edit User" : "Create User"}
            </h2>
            <p id="user-modal-description" className="mt-0.5 text-sm text-[var(--color-muted)]">
              {isEdit ? "Update account details, role, or status." : "Enter the details for the new account."}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" aria-label="Close" onClick={onClose} disabled={pending} className="p-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </Button>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-6">
          <form id="user-edit-form" onSubmit={handleSubmit} className="min-w-0 space-y-5">
            <FormField label="Name" htmlFor="user-name" required>
              <Input id="user-name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} required />
            </FormField>

            {!isEdit && (
              <FormField label="Email" htmlFor="user-email" required>
                <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </FormField>
            )}

            {isEdit && (
              <FormField label="Email" htmlFor="user-email">
                <Input id="user-email" value={email} disabled className="text-[var(--color-muted)]" />
              </FormField>
            )}

            <FormField
              label={isEdit ? "New Password" : "Password"}
              htmlFor="user-password"
              required={!isEdit}
              helperText={isEdit ? "Leave blank to keep current password" : undefined}
            >
              <div className="relative">
                <Input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={isEdit ? undefined : 8}
                  required={!isEdit}
                  placeholder={isEdit ? "New password" : "Password (min 8 chars)"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>

            <FormField label="Role" htmlFor="user-role">
              <Select id="user-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="SALES">Sales</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </FormField>

            {role === "SALES" && (
              <FormField label="Sales Privilege" htmlFor="user-privilege">
                <Select id="user-privilege" value={salesPrivilege} onChange={(e) => setSalesPrivilege(e.target.value)}>
                  <option value="JUNIOR">Junior</option>
                  <option value="SENIOR">Senior</option>
                </Select>
              </FormField>
            )}

            {isEdit && (
              <FormField label="Status" htmlFor="user-active">
                <Select id="user-active" value={active ? "true" : "false"} onChange={(e) => setActive(e.target.value === "true")}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </FormField>
            )}

            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
            ) : null}

          </form>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--color-border)] bg-white px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" form="user-edit-form" variant="black" isLoading={pending} className="w-full sm:w-auto">
            {pending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={role !== user?.role ? "Change this user's role?" : "Change this account's status?"}
        description={active !== user?.active
          ? active ? "This will let the user sign in again." : "This will prevent the user from signing in."
          : `This changes the user's access from ${user?.role === "ADMIN" ? "Admin" : "Sales"} to ${role === "ADMIN" ? "Admin" : "Sales"}.`}
        confirmLabel="Confirm change"
        variant={active !== user?.active && !active ? "destructive" : "default"}
        isLoading={pending}
        onConfirm={() => { setConfirmOpen(false); void saveUser(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
