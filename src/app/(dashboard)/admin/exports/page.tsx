import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ExportWorkspace } from "@/components/export/export-workspace";
import { getAvailableExportCategories } from "@/lib/export/ui";
import { requireSession } from "@/lib/session";
import { connectorService } from "@/services/connector.service";
import { userService } from "@/services/user.service";
import { prisma } from "@/lib/prisma";

export default async function AdminExportsPage() {
  const { user } = await requireSession("ADMIN");
  const [salespeople, connectors, sources] = await Promise.all([
    userService.listAssignable(),
    connectorService.list(),
    prisma.leadSource.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const categories = getAvailableExportCategories(user).map(({ id, label, description, defaultDateField, columnSelection, kind }) => ({
    id, label, description, defaultDateField, columnSelection, kind,
  }));

  return (
    <>
      <Navbar title="Exports" subtitle="Download approved CRM and administration data." actions={<SignOutButton />} />
      <ExportWorkspace
        categories={categories}
        role="ADMIN"
        salespeople={salespeople}
        connectors={connectors.map(({ id, name, type }) => ({ id, name, type }))}
        sources={sources}
      />
    </>
  );
}
