"use client";

import { useRef, memo, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useNavigation } from "./NavigationProvider";

type Props = {
  href: string;
  label: string;
  icon: ReactNode;
  hiddenUntilDesktop?: boolean;
};

export const BottomNavigationItem = memo(function BottomNavigationItem({
  href,
  label,
  icon,
  hiddenUntilDesktop = false,
}: Props) {
  const { isActive, closeMenu } = useNavigation();
  const itemRef = useRef<HTMLAnchorElement | null>(null);

  const active = isActive(href);

  return (
    <Link
      ref={itemRef}
      href={href}
      onClick={closeMenu}
      data-nav-item
      className={cn(
        "relative z-[1] flex flex-col items-center justify-center rounded-[20px] py-2.5 text-center outline-hidden",
        "px-3 md:w-20 md:px-1",
        "transition-opacity duration-200",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30 focus-visible:ring-offset-1",
        hiddenUntilDesktop && "hidden md:flex",
        active
          ? "text-[var(--color-ink)]"
          : "text-[var(--color-muted)] hover:opacity-70",
      )}
      aria-current={active ? "page" : undefined}
      aria-label={label}
    >
      <span className="relative shrink-0">{icon}</span>
      {/* Label always in DOM — CSS hidden md:block prevents FOUC */}
      <span className="relative mt-1.5 max-w-[4.5rem] truncate text-[11px] font-medium leading-tight tracking-tight hidden md:block">
        {label}
      </span>
    </Link>
  );
});
