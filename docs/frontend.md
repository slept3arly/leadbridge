# LeadBridge Frontend

> **Status:** Canonical
> **Last verified:** 2026-09-17
> **Source of truth:** `src/app/`, `src/components/`, `src/hooks/`

## Rendering Model

- **All page components are Server Components** (async functions)
- **Client components** (`"use client"`) are used for interactive UI: tables, modals, forms, filters
- **No server actions** -- all mutations via API routes

## Pages (13)

| Route | File | Type |
|---|---|---|
| `/` | `src/app/page.tsx` | Root redirect |
| `/login` | `src/app/login/page.tsx` | Login form |
| `/admin` | `src/app/(dashboard)/admin/page.tsx` | Admin dashboard |
| `/admin/leads` | `src/app/(dashboard)/admin/leads/page.tsx` | Admin lead management |
| `/admin/users` | `src/app/(dashboard)/admin/users/page.tsx` | User administration |
| `/admin/providers` | `src/app/(dashboard)/admin/providers/page.tsx` | Provider management |
| `/admin/connectors` | `src/app/(dashboard)/admin/connectors/page.tsx` | Connector management |
| `/admin/reports` | `src/app/(dashboard)/admin/reports/page.tsx` | Analytics & reports |
| `/admin/settings` | `src/app/(dashboard)/admin/settings/page.tsx` | System settings |
| `/sales` | `src/app/(dashboard)/sales/page.tsx` | Sales dashboard |
| `/sales/my-leads` | `src/app/(dashboard)/sales/my-leads/page.tsx` | My Leads list |
| `/sales/tasks` | `src/app/(dashboard)/sales/tasks/page.tsx` | Tasks / Attention Center |
| `/sales/profile` | `src/app/(dashboard)/sales/profile/page.tsx` | User profile |

## Loading States (6)

Loading indicators at route boundaries for instant feedback during Server Component rendering:

- `(dashboard)/loading.tsx`
- `admin/loading.tsx`, `admin/leads/loading.tsx`, `admin/users/loading.tsx`
- `sales/loading.tsx`, `sales/my-leads/loading.tsx`

## Layouts (3)

| File | Scope |
|---|---|
| `src/app/layout.tsx` | Root layout (wraps everything) |
| `src/app/(dashboard)/admin/layout.tsx` | Admin dashboard group |
| `src/app/(dashboard)/sales/layout.tsx` | Sales dashboard group |

## Data Fetching Pattern

Server Components fetch data directly:

```typescript
// src/app/(dashboard)/sales/my-leads/page.tsx
export default async function MyLeadsPage({ searchParams }) {
  const user = await requireSession();
  const query = parseListQuery(await searchParams);
  const [leads, sources] = await Promise.all([
    leadService.listPage(query, user),
    prisma.leadSource.findMany({ where: { active: true } }),
  ]);
  return <SalesMyLeadsPageContent initialLeads={leads} initialSources={sources} />;
}
```

Client components receive data as props and manage interactive state via `useTableQuery` hook (URL-based state with `router.replace()`).

## Navigation Architecture

### Top Navbar (`src/components/shared/navbar.tsx`)
Header with logo, section title, search/filter triggers, resync button, user avatar, sign-out.

### Bottom Navigation (`src/components/shared/navigation/`)
Fixed bottom bar on all viewports:

- **Admin:** Dashboard, Leads, Reports, "More" drawer
- **Sales:** Dashboard, My Leads, Tasks, Profile

### "More" Drawer (`BottomNavigationMenu.tsx`)
Secondary admin links: Connectors, Users, Providers, Settings.

## Design System

### UI Primitives (`src/components/ui/`)

| Component | File | Description |
|---|---|---|
| `Button` | `button.tsx` | Variants, sizes, loading spinner |
| `Card` | `card.tsx` | Elevated surface container |
| `Badge` | `badge.tsx` | Status/priority/channel indicators |
| `Input` | `input.tsx` | Text input |
| `Select` | `select.tsx` | Dropdown select |
| `Textarea` | `textarea.tsx` | Multi-line text input |
| `Pagination` | `pagination.tsx` | Page controls |
| `SegmentedControl` | `segmented-control.tsx` | Tab/pill toggle |
| `DateTimeCell` | `date-time-cell.tsx` | Formatted date display |
| `FormField` | `form-field.tsx` | Label + input wrapper |
| `ConfirmDialog` | `confirm-dialog.tsx` | Confirmation modal |
| `EmptyState` | `empty-state.tsx` | Empty state placeholder |
| `ErrorState` | `error-state.tsx` | Error display |
| `Loading` | `loading.tsx` | Loading indicator |
| `FilterChip` | `filter-chip.tsx` | Filter chip |
| `IconActionButton` | `icon-action-button.tsx` | Icon-only button |
| `AnimatedReveal` | `animated-reveal.tsx` | GSAP-powered reveal animation |
| `ExpandableSection` | `expandable-section.tsx` | Collapsible section |
| `Label` | `label.tsx` | Form label |

### Shared Components (`src/components/shared/`)

| Component | Description |
|---|---|
| `DataTable` | Reusable table with loading/empty states |
| `ExportButton` | CSV export trigger with toast feedback |
| `DateRangePicker` | Date range selector |
| `KpiCard` | Summary metric display |
| `ResyncButton` | Manual refresh action |
| `SearchToolbar` | Search input with debounce |
| `ActiveFilters` | Active filter chips display |
| `TableControls` | Pagination + view controls |
| `LeadActions` | Lead action buttons |
| `BlueprintBackground` | Grid backdrop for utility pages |
| `AppShell` | Application shell layout |
| `SignOutButton` | Sign out trigger |

### Design Tokens

Defined in `src/app/globals.css`:

```css
:root {
  --color-surface: #f8fafc;   /* Layer 1: Canvas */
  --color-panel: #ffffff;      /* Layer 2: Cards */
  --color-border: #e2e8f0;    /* Borders */
  --color-ink: #0f172a;       /* Primary text */
  --color-muted: #64748b;     /* Secondary text */
  --color-brand: #2563eb;     /* Brand accent */
}
```

## Custom Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useTableQuery` | URL-based table state (page, search, sort, filters) |
| `useLeadDetails` | Lead detail data fetching |
| `useHydrated` | Client hydration detection |

Note: `src/hooks/index.ts` is currently empty (exports nothing).
