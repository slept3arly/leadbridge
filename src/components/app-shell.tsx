import type { ReactNode } from "react";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";

export function AppShell({
  children,
  role,
}: {
  children: ReactNode;
  role: "ADMIN" | "SALES";
}) {
  return (
    <NavigationProvider role={role}>
      <div className="min-h-screen p-4 pb-24 md:p-6 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <main className="space-y-6">{children}</main>
        </div>
        <BottomNavigation />
      </div>
    </NavigationProvider>
  );
}
