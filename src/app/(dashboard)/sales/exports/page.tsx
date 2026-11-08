import { redirect } from "next/navigation";
import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ExportWorkspace } from "@/components/export/export-workspace";
import { getAvailableExportCategories } from "@/lib/export/ui";
import { can, Permission } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function SalesExportsPage() {
  const { user } = await requireSession("SALES");
  if (!can(user, Permission.EXPORT_LEADS)) redirect("/sales");
  const sources = await prisma.leadSource.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const categories = getAvailableExportCategories(user).map(({ id, label, description, defaultDateField, columnSelection, kind }) => ({
    id, label, description, defaultDateField, columnSelection, kind,
  }));

  return (
    <>
      <Navbar title="Exports" subtitle="Download the leads assigned to you." actions={<SignOutButton />} />
      <ExportWorkspace categories={categories} role="SALES" salesPrivilege={user.salesPrivilege} sources={sources} />
    </>
  );
}
