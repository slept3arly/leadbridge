import { AppShell } from "@/components/shared/app-shell";
import { requireSession } from "@/lib/session";
import { can, Permission } from "@/lib/permissions";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession("SALES");
  return <AppShell role="SALES" salesCanExportLeads={can(user, Permission.EXPORT_LEADS)}>{children}</AppShell>;
}
