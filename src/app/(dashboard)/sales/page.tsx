import { Navbar } from "@/components/navbar";
import { SignOutButton } from "@/components/sign-out-button";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/session";
import { dashboardService } from "@/services/dashboard.service";
import { SalesDashboardClient } from "@/components/sales-dashboard-client";

export default async function SalesDashboardPage() {
  const { user } = await requireSession("SALES");
  const data = await dashboardService.sales(user.id);

  return (
    <>
      <Navbar title="Sales Dashboard" actions={<SignOutButton />} showResync />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm text-[var(--color-muted)]">My leads</p><p className="mt-3 text-3xl font-semibold">{data.cards.myLeads}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Open leads</p><p className="mt-3 text-3xl font-semibold">{data.cards.myOpenLeads}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Closed leads</p><p className="mt-3 text-3xl font-semibold">{data.cards.myClosedLeads}</p></Card>
      </div>
      <SalesDashboardClient data={data} />
    </>
  );
}
