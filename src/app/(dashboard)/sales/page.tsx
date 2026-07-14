import { Navbar } from "@/components/navbar";
import { SignOutButton } from "@/components/sign-out-button";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/session";
import { leadService } from "@/services/lead.service";

export default async function SalesDashboardPage() {
  const { user } = await requireSession("SALES");
  const stats = await leadService.stats(user.id);

  return (
    <>
      <Navbar title="Sales Dashboard" actions={<SignOutButton />} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm text-[var(--color-muted)]">My leads</p><p className="mt-3 text-3xl font-semibold">{stats.total}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Open follow-ups</p><p className="mt-3 text-3xl font-semibold">{stats.open}</p></Card>
        <Card><p className="text-sm text-[var(--color-muted)]">Qualified pipeline</p><p className="mt-3 text-3xl font-semibold">{stats.qualified}</p></Card>
      </div>
    </>
  );
}
