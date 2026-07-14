"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigation, salesNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({ role }: { role: "ADMIN" | "SALES" }) {
  const pathname = usePathname();
  const items = role === "ADMIN" ? adminNavigation : salesNavigation;

  return (
    <aside className="w-full rounded-3xl bg-[linear-gradient(180deg,#16213f_0%,#213468_100%)] p-5 text-white md:min-h-[calc(100vh-48px)] md:w-72">
      <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-blue-100/80">Internal CRM</p>
        <h2 className="mt-2 text-2xl font-semibold">LeadBridge</h2>
        <p className="mt-2 text-sm text-blue-100/75">A lean foundation for internal lead operations and future source aggregation.</p>
      </div>
      <nav className="mt-8 space-y-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-2xl px-4 py-3 text-sm transition",
                active ? "bg-black text-slate-900" : "text-blue-50 hover:bg-white/10",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
