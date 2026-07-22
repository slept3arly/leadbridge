import type { ReactNode } from "react";
import {
  LayoutDashboard,
  ContactRound,
  Building2,
  UserCog,
  Settings,
  BarChart3,
  ClipboardList,
  CircleUser,
} from "lucide-react";

const iconProps = { size: 22, strokeWidth: 1.5 };

export type NavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export function flattenNav(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((g) => g.items);
}

export const adminPrimaryOrder = [
  "/admin",
  "/admin/leads",
  "/admin/providers",
  "/admin/users",
  "/admin/reports",
];

export const salesPrimaryOrder = [
  "/sales",
  "/sales/my-leads",
  "/sales/tasks",
  "/sales/profile",
];

export const adminNavigation: NavGroup[] = [
  {
    title: "Dashboard",
    items: [
      { href: "/admin", label: "Dashboard", icon: <LayoutDashboard {...iconProps} /> },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/admin/leads", label: "Leads", icon: <ContactRound {...iconProps} /> },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/admin/users", label: "Users", icon: <UserCog {...iconProps} /> },
      { href: "/admin/providers", label: "Providers", icon: <Building2 {...iconProps} /> },
      { href: "/admin/settings", label: "Settings", icon: <Settings {...iconProps} /> },
    ],
  },
  {
    title: "Analytics",
    items: [
      { href: "/admin/reports", label: "Reports", icon: <BarChart3 {...iconProps} /> },
    ],
  },
];

export const salesNavigation: NavGroup[] = [
  {
    title: "Dashboard",
    items: [
      { href: "/sales", label: "Dashboard", icon: <LayoutDashboard {...iconProps} /> },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/sales/my-leads", label: "My Leads", icon: <ContactRound {...iconProps} /> },
      { href: "/sales/tasks", label: "Attention\nCenter", icon: <ClipboardList {...iconProps} /> },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/sales/profile", label: "Profile", icon: <CircleUser {...iconProps} /> },
    ],
  },
];
