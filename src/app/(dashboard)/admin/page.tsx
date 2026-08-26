import { unstable_cache } from "next/cache";
import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { dashboardService } from "@/services/dashboard.service";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import { TAG } from "@/lib/cache-tags";

const getDashboardData = unstable_cache(
  () => dashboardService.admin(),
  ["dashboard-admin"],
  { revalidate: 60, tags: [TAG.ADMIN_DASHBOARD] },
);

export default async function AdminDashboardPage() {
  const data = await getDashboardData();
  const renderedAt = new Date().toISOString();

  return (
    <>
      <Navbar title="Admin Dashboard" showResync actions={<SignOutButton />} />

      <div className="grid gap-4 md:grid-cols-5">
        <KpiStat label="Total Leads" value={data.cards.totalLeads} />
        <KpiStat label="Active Pipeline" value={data.cards.activeLeads} />
        <KpiStat label="New Today" value={data.cards.newToday} />
        <KpiStat label="Won" value={data.cards.won} />
        <KpiStat label="Unassigned" value={data.cards.unassigned} />
      </div>

      <AdminDashboardClient data={{ ...data, renderedAt }} />
    </>
  );
}

function KpiStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
