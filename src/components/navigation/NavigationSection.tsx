"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useNavigation } from "./NavigationProvider";
import type { NavGroup } from "@/lib/navigation";

export function NavigationSection({ group }: { group: NavGroup }) {
  const { isActive, closeMenu } = useNavigation();

  return (
    <div>
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
        {group.title}
      </h3>
      <ul className="space-y-1">
        {group.items.map((item) => {
          const active = isActive(item.href);

          return (
            <li key={item.href} data-menu-item>
              <Link
                href={item.href}
                onClick={closeMenu}
                className={cn(
                  "flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30 focus-visible:ring-offset-1 focus-visible:outline-hidden",
                  active
                    ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                    : "text-[var(--color-ink)] hover:bg-black/[0.04]",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
