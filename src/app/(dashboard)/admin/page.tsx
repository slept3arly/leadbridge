import { Navbar } from "@/components/navbar";
import { SignOutButton } from "@/components/sign-out-button";
import { Card } from "@/components/ui/card";
import { leadService } from "@/services/lead.service";
import { userService } from "@/services/user.service";

export default async function AdminDashboardPage() {
  const [leadStats, userStats] = await Promise.all([leadService.stats(), userService.stats()]);

  return (
    <>
      <Navbar title="Admin Dashboard" actions={<SignOutButton />} />
      <div className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-sm text-[var(--color-muted)]">Total leads</p><p className="mt-3 text-3xl font-semibold">{leadStats.total}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Open pipeline</p><p className="mt-3 text-3xl font-semibold">{leadStats.open}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Qualified leads</p><p className="mt-3 text-3xl font-semibold">{leadStats.qualified}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Active sales users</p><p className="mt-3 text-3xl font-semibold">{userStats.sales}</p></Card>
      </div>
    </>
  );
}
