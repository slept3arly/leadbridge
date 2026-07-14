"use client";

import { useRef, useEffect, useState, useMemo, useCallback, useId } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { useNavigation } from "./NavigationProvider";
import { BottomNavigationItem } from "./BottomNavigationItem";
import { BottomNavigationMenu } from "./BottomNavigationMenu";
import { MoreHorizontal } from "lucide-react";
import { adminPrimaryOrder, salesPrimaryOrder } from "@/lib/navigation";

/**
 * SSR-safe media query hook.
 *
 * Contract:
 *  - Server render:  useState(true)           → isDesktop = true  (desktop layout)
 *  - Client hydrate:  useState(true)           → isDesktop = true  (matches server → no mismatch)
 *  - After mount:     useEffect corrects value → isDesktop = actual viewport
 */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}

function isRouteActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/sales") return pathname === href;
  return pathname.startsWith(href);
}

export function BottomNavigation() {
  const { flattened, openMenu, menuOpen, activePath, role } = useNavigation();
  const isDesktop = useIsDesktop();
  const dockRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();

  const primaryOrder = role === "ADMIN" ? adminPrimaryOrder : salesPrimaryOrder;
  const visibleCount = isDesktop ? 5 : 3;

  const visible = useMemo(() => {
    const itemMap = new Map(flattened.map((i) => [i.href, i]));
    return primaryOrder
      .filter((href) => itemMap.has(href))
      .map((href) => itemMap.get(href)!)
      .slice(0, visibleCount);
  }, [flattened, primaryOrder, visibleCount]);

  const overflowCount = flattened.length - visible.length;

  // Is the active path a visible item?
  const visActiveIdx = useMemo(
    () => visible.findIndex((item) => isRouteActive(activePath, item.href)),
    [visible, activePath],
  );

  // Is the active path an overflow (hidden) item?
  const hasOverflowActive = useMemo(
    () =>
      overflowCount > 0 &&
      visActiveIdx < 0 &&
      flattened.some((item) => isRouteActive(activePath, item.href)),
    [overflowCount, visActiveIdx, flattened, activePath],
  );

  // The index in the [data-nav-item] NodeList that the pill should track.
  // Visible items occupy indices 0 … visible.length-1.
  // The More button (if present) is always the last data-nav-item.
  const activeIndex = visActiveIdx >= 0 ? visActiveIdx : hasOverflowActive ? visible.length : 0;

  // single sliding indicator — GSAP tracks active element via getBoundingClientRect
  //
  // IMPORTANT: we use .kill() (not .revert()) when the index changes so that
  // GSAP reads the current animated transform as the starting point for the
  // next tween.  revert() would undo the transform back to x=0, making every
  // slide appear to originate from the left edge.
  const indicatorCtx = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (!indicatorRef.current || !dockRef.current) return;

    const items = dockRef.current.querySelectorAll<HTMLElement>("[data-nav-item]");
    const target = items[activeIndex];
    if (!target) return;

    const dockRect = dockRef.current.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    if (indicatorCtx.current) {
      indicatorCtx.current.kill();
    }

    indicatorCtx.current = gsap.context(() => {
      gsap.to(indicatorRef.current, {
        x: targetRect.left - dockRect.left,
        width: targetRect.width,
        duration: 0.35,
        ease: "power3.out",
        overwrite: "auto",
      });
    });

    return () => {
      if (indicatorCtx.current) {
        indicatorCtx.current.kill();
        indicatorCtx.current = null;
      }
    };
  }, [activeIndex]);

  // cascade mount on initial render only
  useEffect(() => {
    const items = dockRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]");
    if (!items?.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.2, stagger: 0.04, ease: "power2.out" },
      );
    });

    return () => ctx.revert();
  }, []);

  const handleMoreClick = useCallback(() => {
    openMenu();
  }, [openMenu]);

  return (
    <>
      <BottomNavigationMenu />
      <div className="fixed bottom-3 left-1/2 z-40 flex w-auto -translate-x-1/2 items-center justify-center md:bottom-4">
        <div
          ref={dockRef}
          className={cn(
            "relative flex items-center justify-center bg-white/85 px-3 py-2 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04)]",
            isDesktop ? "rounded-[24px]" : "rounded-[28px]",
          )}
          role="navigation"
          aria-label="Main navigation"
        >
          {/* single sliding active indicator — inset-y matches dock py-2 so it fills the content
              area perfectly; GSAP animates x + width (no CSS transform to conflict with) */}
          <div
            ref={indicatorRef}
            className="pointer-events-none absolute inset-y-2 left-0 rounded-[20px] bg-black/[0.04]"
            aria-hidden="true"
          />

          {visible.map((item) => (
            <BottomNavigationItem
              key={`${uid}-${item.href}`}
              href={item.href}
              label={item.label}
              icon={item.icon}
              showLabel={isDesktop}
            />
          ))}

          {overflowCount > 0 && (
            <button
              onClick={handleMoreClick}
              data-nav-item
              className={cn(
                "relative z-[1] flex flex-col items-center justify-center rounded-[20px] py-2.5 text-center outline-hidden",
                isDesktop ? "w-20" : "px-4",
                "focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30 focus-visible:ring-offset-1",
                menuOpen || hasOverflowActive
                  ? "text-[var(--color-ink)]"
                  : "text-[var(--color-muted)]",
              )}
              aria-label={`${overflowCount} more navigation items`}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              aria-current={hasOverflowActive ? "page" : undefined}
            >
              <span className="relative shrink-0">
                <MoreHorizontal size={20} strokeWidth={1.5} />
              </span>
              {isDesktop && (
                <span className="relative mt-1.5 max-w-[4.5rem] truncate text-[11px] font-medium leading-tight tracking-tight">
                  More
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
