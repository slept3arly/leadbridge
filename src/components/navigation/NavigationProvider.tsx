"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  adminNavigation,
  salesNavigation,
  flattenNav,
  type NavItem,
  type NavGroup,
} from "@/lib/navigation";

type NavContextValue = {
  role: "ADMIN" | "SALES";
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  activePath: string;
  flattened: NavItem[];
  groups: NavGroup[];
  isActive: (href: string) => boolean;
};

const NavContext = createContext<NavContextValue | null>(null);

export function useNavigation() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider");
  return ctx;
}

export function NavigationProvider({
  role,
  children,
}: {
  role: "ADMIN" | "SALES";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const groups = useMemo(
    () => (role === "ADMIN" ? adminNavigation : salesNavigation),
    [role],
  );

  const flattened = useMemo(() => flattenNav(groups), [groups]);

  const isActive = useCallback(
    (href: string) => {
      if (href === "/admin" || href === "/sales") return pathname === href;
      return pathname.startsWith(href);
    },
    [pathname],
  );

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  const value = useMemo<NavContextValue>(
    () => ({
      role,
      menuOpen,
      openMenu,
      closeMenu,
      toggleMenu,
      activePath: pathname,
      flattened,
      groups,
      isActive,
    }),
    [role, menuOpen, openMenu, closeMenu, toggleMenu, pathname, flattened, groups, isActive],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
