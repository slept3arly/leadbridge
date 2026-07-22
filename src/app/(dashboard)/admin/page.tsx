import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { Card } from "@/components/ui/card";
import { dashboardService } from "@/services/dashboard.service";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";

export default async function AdminDashboardPage() {
  const data = await dashboardService.admin();

  return (
    <>
      <Navbar title="Admin Dashboard" actions={<SignOutButton />} />
      <div className="grid gap-4 md:grid-cols-5">
        <Card><p className="text-sm text-[var(--color-muted)]">Total leads</p><p className="mt-3 text-3xl font-semibold">{data.cards.totalLeads}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Active pipeline</p><p className="mt-3 text-3xl font-semibold">{data.cards.activeLeads}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">New today</p><p className="mt-3 text-3xl font-semibold">{data.cards.newToday}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Won</p><p className="mt-3 text-3xl font-semibold">{data.cards.won}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Unassigned</p><p className="mt-3 text-3xl font-semibold">{data.cards.unassigned}</p></Card>
      </div>

      <AdminDashboardClient data={data} />
    </>
  );
}
