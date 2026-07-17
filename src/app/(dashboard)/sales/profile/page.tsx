import { Navbar } from "@/components/navbar";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/session";

export default async function SalesProfilePage() {
  const { user } = await requireSession("SALES");

  return (
    <>
      <Navbar title="Profile" showResync />
      <Card>
        <p className="text-sm text-[var(--color-muted)]">Name</p>
        <p className="mt-2 text-xl font-semibold">{user.name}</p>
        <p className="mt-6 text-sm text-[var(--color-muted)]">Email</p>
        <p className="mt-2 text-lg">{user.email}</p>
        <p className="mt-6 text-sm text-[var(--color-muted)]">Role</p>
        <p className="mt-2 text-lg">{user.role}</p>
      </Card>
    </>
  );
}
