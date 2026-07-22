"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Eye, EyeOff } from "lucide-react";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SALES");
  const [salesPrivilege, setSalesPrivilege] = useState("JUNIOR");
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setSalesPrivilege(user.salesPrivilege ?? "JUNIOR");
      setActive(user.active);
      setPassword("");
    } else {
      setName("");
      setEmail("");
      setPassword("");
      setRole("SALES");
      setSalesPrivilege("JUNIOR");
      setActive(true);
    }
    setError(null);
    setShowPassword(false);
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      onClose();
      router.refresh();
    } catch {
      setError(isEdit ? "Failed to update user." : "Unable to create the user right now.");
    } finally {
      setPending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 mt-16 mb-6 w-[90%] max-w-lg flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            {isEdit ? "Edit User" : "Create User"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)] transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Name" htmlFor="user-name" required>
              <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} required />
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

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" isLoading={pending}>
                {pending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
