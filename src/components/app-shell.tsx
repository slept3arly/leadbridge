import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";

export function AppShell({
  children,
  role,
}: {
  children: ReactNode;
  role: "ADMIN" | "SALES";
}) {
  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
        <Sidebar role={role} />
        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
}
