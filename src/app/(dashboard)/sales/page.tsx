import { cache } from "react";
import { unstable_cache } from "next/cache";
import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { FollowUpDropdown } from "@/components/sales/follow-up-dropdown";
import { requireSession } from "@/lib/session";
import { can, Permission } from "@/lib/permissions";
import { dashboardService } from "@/services/dashboard.service";
import { SalesDashboardClient } from "@/components/sales/sales-dashboard-client";
import { TAG } from "@/lib/cache-tags";

const getDashboardData = cache((userId: string) =>
  unstable_cache(
    async () => dashboardService.sales(userId),
    [`dashboard-sales-${userId}`],
    { tags: [TAG.DASHBOARD(userId), TAG.ATTENTION(userId)] },
  )(),
);

export default async function SalesDashboardPage() {
  const { user } = await requireSession("SALES");
  const data = await getDashboardData(user.id);
  const canExport = can(user, Permission.EXPORT_LEADS);

  return (
    <>
      <Navbar title="Sales Dashboard" followUpDropdown={<FollowUpDropdown />} actions={<SignOutButton />} showResync />
      <SalesDashboardClient data={{ ...data, canExport }} />
    </>
  );
}