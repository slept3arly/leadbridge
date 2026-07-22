import { AppShell } from "@/components/shared/app-shell";
import { requireSession } from "@/lib/session";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await requireSession("SALES");
  return <AppShell role="SALES" surfaceClassName="bg-[#e2e8f0]">{children}</AppShell>;
}
