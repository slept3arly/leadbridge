import { AdminReports } from "@/components/admin/admin-reports";
import { resolveExportDateRange } from "@/lib/export/dates";
import { prisma } from "@/lib/prisma";
import { userService } from "@/services/user.service";

export default async function AdminReportsPage() {
  const resolved = resolveExportDateRange({ preset: "last-30-days" });
  const initialRange = {
    from: resolved.from!.toISOString(),
    to: new Date(resolved.toExclusive!.getTime() - 1).toISOString(),
  };
  const [salespeople, sources] = await Promise.all([
    userService.listAssignable(),
    prisma.leadSource.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return <AdminReports initialRange={initialRange} salespeople={salespeople} sources={sources} />;
}
