import type { ReactNode } from "react";
import { NavigationProvider } from "@/components/shared/navigation/NavigationProvider";
import { BottomNavigation } from "@/components/shared/navigation/BottomNavigation";

export function AppShell({
  children,
  role,
  surfaceClassName,
}: {
  children: ReactNode;
  role: "ADMIN" | "SALES";
  surfaceClassName?: string;
}) {
  return (
    <NavigationProvider role={role}>
      <div className={`min-h-screen p-4 pb-24 md:p-6 md:pb-24 ${surfaceClassName ?? ""}`}>
        <div className="mx-auto max-w-7xl">
          <main className="space-y-6">{children}</main>
        </div>
        <BottomNavigation />
      </div>
    </NavigationProvider>
  );
}
