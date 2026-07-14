import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await requireSession("SALES");
  return <AppShell role="SALES">{children}</AppShell>;
}
