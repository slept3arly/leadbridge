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

      <AdminDashboardClient data={{ ...data, renderedAt }} />
    </>
  );
}
