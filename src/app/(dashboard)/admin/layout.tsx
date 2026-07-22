import { AppShell } from "@/components/shared/app-shell";
import { requireSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSession("ADMIN");
  return <AppShell role="ADMIN">{children}</AppShell>;
}
