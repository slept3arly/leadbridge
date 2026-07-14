"use client";

import { useRef, useEffect, memo, useMemo, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { useNavigation } from "./NavigationProvider";

function AnimatedLabel({ text }: { text: string }) {
  const containerRef = useRef<HTMLSpanElement | null>(null);

  const chars = useMemo(() => text.split(""), [text]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const els = container.querySelectorAll<HTMLElement>("[data-lchar]");
    if (!els.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.1, stagger: 0.015, ease: "power2.out" },
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <span ref={containerRef} className="inline-flex flex-nowrap" style={{ willChange: "transform" }}>
      {chars.map((char, i) => (
        <span
          key={i}
          data-lchar
          style={{ display: "inline-block", willChange: "transform" }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
}

type Props = {
  href: string;
  label: string;
  icon: ReactNode;
  showLabel?: boolean;
};

export const BottomNavigationItem = memo(function BottomNavigationItem({
  href,
  label,
  icon,
  showLabel = true,
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
        showLabel ? "w-20" : "px-4",
        "transition-opacity duration-200",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30 focus-visible:ring-offset-1",
        active
          ? "text-[var(--color-ink)]"
          : "text-[var(--color-muted)] hover:opacity-70",
      )}
      aria-current={active ? "page" : undefined}
      aria-label={label}
    >
      <span className="relative shrink-0">{icon}</span>
      {showLabel && (
        <span className="relative mt-1.5 max-w-[4.5rem] truncate text-[11px] font-medium leading-tight tracking-tight">
          <AnimatedLabel text={label} />
        </span>
      )}
    </Link>
  );
});
