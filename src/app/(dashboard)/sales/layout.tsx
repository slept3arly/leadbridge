import { AppShell } from "@/components/shared/app-shell";
import { requireSession } from "@/lib/session";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await requireSession("SALES");
  return <AppShell role="SALES">{children}</AppShell>;
}
