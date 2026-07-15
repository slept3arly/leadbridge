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
 * SSR-safe media query hook — used ONLY for logical computations
 * (activeIndex, menu filtering).  Visual bifurcation (item show/hide,
 * label visibility, radii) is driven by CSS media queries to
 * eliminate FOUC.
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
  const indicatorCtx = useRef<gsap.Context | null>(null);
  const uid = useId();

  const primaryOrder = role === "ADMIN" ? adminPrimaryOrder : salesPrimaryOrder;

  // RENDER: always render all primaryOrder items — CSS handles show/hide per viewport.
  const domItems = useMemo(() => {
    const itemMap = new Map(flattened.map((i) => [i.href, i]));
    return primaryOrder
      .filter((href) => itemMap.has(href))
      .map((href) => itemMap.get(href)!);
  }, [flattened, primaryOrder]);

  // LOGICAL: viewport-aware "visible" set for active-index tracking and menu filtering.
  const visibleCount = isDesktop ? 5 : 3;
  const visible = useMemo(() => domItems.slice(0, visibleCount), [domItems, visibleCount]);
  const overflowCount = flattened.length - visible.length;

  // Items at index >= 3 are CSS-hidden on mobile (hidden md:flex).
  // The More button is always the last [data-nav-item] in the DOM.
  const moreButtonIndex = domItems.length;

  const visActiveIdx = useMemo(
    () => visible.findIndex((item) => isRouteActive(activePath, item.href)),
    [visible, activePath],
  );

  const hasOverflowActive = useMemo(
    () =>
      overflowCount > 0 &&
      visActiveIdx < 0 &&
      flattened.some((item) => isRouteActive(activePath, item.href)),
    [overflowCount, visActiveIdx, flattened, activePath],
  );

  const activeIndex = visActiveIdx >= 0 ? visActiveIdx : hasOverflowActive ? moreButtonIndex : 0;

  // Single sliding indicator — GSAP tracks active element via getBoundingClientRect.
  // Uses .kill() (not .revert()) so the current transform is preserved as the
  // starting point for the next directional tween.
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
        duration: 0.48,
        ease: "elastic.out(0.75, 0.8)",
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

  const handleMoreClick = useCallback(() => {
    openMenu();
  }, [openMenu]);

  return (
    <>
      <BottomNavigationMenu />
      <div className="fixed bottom-3 left-1/2 z-40 flex w-auto -translate-x-1/2 items-center justify-center md:bottom-4">
        {/* Dock radius is CSS-responsive — no JS conditional, no FOUC */}
        <div
          ref={dockRef}
          className={cn(
            "relative flex items-center justify-center bg-white/85 px-3 py-2 backdrop-blur-2xl",
            "shadow-[0_1px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06),0_24px_56px_rgba(0,0,0,0.08)]",
            "rounded-[28px] md:rounded-[24px]",
          )}
          role="navigation"
          aria-label="Main navigation"
        >
          {/* single sliding active indicator — inset-y matches dock py-2 */}
          <div
            ref={indicatorRef}
            className="pointer-events-none absolute inset-y-2 left-0 rounded-[20px] bg-black/[0.04]"
            aria-hidden="true"
          />

          {domItems.map((item, i) => (
            <BottomNavigationItem
              key={`${uid}-${item.href}`}
              href={item.href}
              label={item.label}
              icon={item.icon}
              // Items at index >= 3 are hidden on mobile via pure CSS —
              // no JS state dependency, no hydration mismatch, no FOUC.
              hiddenUntilDesktop={i >= 3}
            />
          ))}

          {overflowCount > 0 && (
            <button
              onClick={handleMoreClick}
              data-nav-item
              className={cn(
                "relative z-[1] flex flex-col items-center justify-center rounded-[20px] py-2.5 text-center outline-hidden",
                "px-3 md:w-20 md:px-1",
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
              {/* "More" label is CSS-hidden on mobile — no FOUC */}
              <span className="relative mt-1.5 max-w-[4.5rem] truncate text-[11px] font-medium leading-tight tracking-tight hidden md:block">
                More
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
