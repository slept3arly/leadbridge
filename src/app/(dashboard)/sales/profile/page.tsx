import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { DateTimeDisplay } from "@/components/shared/date-time-display";
import { UserIdField } from "./user-id-field";

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-lg font-semibold text-white select-none">
      {initials}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--color-ink)]">{value}</p>
    </div>
  );
}

export default async function SalesProfilePage() {
  const { user } = await requireSession("SALES");

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      phone: true,
      employeeCode: true,
      designation: true,
      emailVerified: true,
      lastLoginAt: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  return (
    <>
      <Navbar title="Profile" showResync actions={<SignOutButton />} />

      <div className="space-y-8">

        {/* Profile Hero */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <InitialsAvatar name={user.name} />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-[var(--color-ink)]">{user.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge label={user.role} variant="rounded" />
                {user.salesPrivilege && (
                  <Badge label={user.salesPrivilege} variant="rounded" />
                )}
                <Badge label={user.active ? "Active" : "Inactive"} variant="rounded" />
              </div>
            </div>
          </div>
        </Card>

        {/* Contact & Employment + Account */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-6">
            <CardHeader>
              <CardTitle>Contact & Employment</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2">
                <Field label="Email" value={user.email} />
              </div>
              {profile?.phone && (
                <Field label="Phone" value={profile.phone} />
              )}
              {profile?.designation && (
                <Field label="Designation" value={profile.designation} />
              )}
              {profile?.employeeCode && (
                <Field label="Employee Code" value={profile.employeeCode} />
              )}
              {profile?.createdAt && (
                <Field label="Joined" value={formatDate(profile.createdAt)} />
              )}
              {profile?.lastLoginAt && (
                <Field label="Last Login" value={<DateTimeDisplay date={profile.lastLoginAt} />} />
              )}
              {profile?.lastSeenAt && (
                <Field label="Last Seen" value={<DateTimeDisplay date={profile.lastSeenAt} />} />
              )}
            </div>
          </Card>

          <Card className="p-6">
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <UserIdField label="User ID" value={user.id} />
              {profile?.emailVerified !== undefined && (
                <Field
                  label="Email Verified"
                  value={profile.emailVerified ? "Yes" : "No"}
                />
              )}
            </div>
          </Card>
        </div>

        {/* Help & Support */}
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Help & Support</CardTitle>
          </CardHeader>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--color-ink)]">Need help with LeadBridge?</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Contact your administrator at{" "}
                <span className="font-medium text-[var(--color-ink)]">vinayaknautiyal38@gmail.com</span>
              </p>
            </div>
            <a href="mailto:vinayaknautiyal38@gmail.com" className="shrink-0">
              <Button variant="secondary" size="sm">
                Contact Administrator
              </Button>
            </a>
          </div>
        </Card>

      </div>
    </>
  );
}
