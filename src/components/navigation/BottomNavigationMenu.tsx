"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import gsap from "gsap";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigation } from "./NavigationProvider";
import { NavigationSection } from "./NavigationSection";
import { adminPrimaryOrder, salesPrimaryOrder } from "@/lib/navigation";

/**
 * SSR-safe media query hook.
 *
 * Contract:
 *  - Server render:  useState(true)           → isDesktop = true
 *  - Client hydrate:  useState(true)           → isDesktop = true  (matches server)
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

export function BottomNavigationMenu() {
  const { menuOpen, closeMenu, groups, role } = useNavigation();
  const isDesktop = useIsDesktop();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const primaryOrder = role === "ADMIN" ? adminPrimaryOrder : salesPrimaryOrder;
  const visibleCount = isDesktop ? 5 : 3;
  const visibleHrefs = new Set(primaryOrder.slice(0, visibleCount));

  const filteredGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !visibleHrefs.has(item.href)),
    }))
    .filter((g) => g.items.length > 0);

  useEffect(() => {
    if (!panelRef.current || !overlayRef.current) return;

    if (menuOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";

      const ctx = gsap.context(() => {
        const tl = gsap.timeline();

        // Fade in the backdrop
        tl.fromTo(
          overlayRef.current,
          {
            opacity: 0,
          },
          {
            opacity: 1,
            duration: 0.3,
            ease: "power2.out",
          }
        );

        // Then bring in the menu, slightly overlapping the backdrop fade
        tl.fromTo(
          panelRef.current,
          {
            opacity: 0,
            y: 6,
            scale: 0.985,
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.42,
            ease: "power4.out",
            overwrite: "auto",
          },
          "-=0.18"
        );
      });

      requestAnimationFrame(() => {
        const first = panelRef.current?.querySelector<HTMLElement>("a, button");
        first?.focus();
      });

      return () => ctx.revert();
    } else {
      document.body.style.overflow = "";
      const ctx = gsap.context(() => {
        gsap.to(overlayRef.current, { opacity: 0, duration: 0.12 });
        gsap.to(panelRef.current, {
          opacity: 0,
          y: 8,
          scale: 0.99,
          duration: 0.28,
          ease: "power3.in",
          overwrite: "auto",
        });
      });
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return () => ctx.revert();
    }
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll<HTMLElement>("a, button");
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [closeMenu],
  );

  return (
    <div
      ref={overlayRef}
      className={
        menuOpen
          ? "fixed inset-0 z-50 flex items-end justify-center bg-black/[0.06] backdrop-blur-sm p-3"
          : "hidden"
      }
      onClick={(e) => {
        if (e.target === overlayRef.current) closeMenu();
      }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      <div
        ref={panelRef}
        className={cn(
          "relative w-full max-w-md max-h-[60vh] overflow-y-auto border border-white/40 bg-white/85 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04)]",
          "rounded-[28px] px-5 pb-6 pt-5 md:px-6 md:pb-8",
        )}
        style={{
          transform: "translateY(16px) scale(0.94)",
          transformOrigin: "bottom right",
        }}
      >
        <button
          onClick={closeMenu}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-black/[0.04] hover:text-[var(--color-ink)] transition-all duration-200"
          aria-label="Close menu"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
        {filteredGroups.length > 0 ? (
          <div className="space-y-6">
            {filteredGroups.map((group) => (
              <NavigationSection key={group.title} group={group} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-[var(--color-muted)]">
              All items are already visible in the dock.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
