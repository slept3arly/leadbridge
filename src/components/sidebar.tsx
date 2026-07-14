"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigation, salesNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({ role }: { role: "ADMIN" | "SALES" }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const groups = role === "ADMIN" ? adminNavigation : salesNavigation;

  function isActive(href: string) {
    if (href === "/admin" || href === "/sales") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "relative w-full rounded-3xl bg-[linear-gradient(180deg,#16213f_0%,#213468_100%)] text-white transition-all duration-300",
        "md:min-h-[calc(100vh-48px)]",
        collapsed ? "md:w-20" : "md:w-72",
      )}
    >
      <div className="p-5">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-blue-100/80">
                Internal CRM
              </p>
              {!collapsed && (
                <h2 className="mt-2 text-2xl font-semibold">LeadBridge</h2>
              )}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-blue-100/80 hover:bg-white/20 transition"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
          {!collapsed && (
            <p className="mt-2 text-sm text-blue-100/75">
              A lean foundation for internal lead operations and future source aggregation.
            </p>
          )}
        </div>
        <nav className="mt-8 space-y-6" role="navigation" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.15em] text-blue-200/60">
                  {group.title}
                </p>
              )}
              <ul className="space-y-1" role="list">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-150",
                          active
                            ? "bg-white text-[var(--color-ink)] shadow-sm"
                            : "text-blue-50 hover:bg-white/10",
                          collapsed && "justify-center px-3"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
