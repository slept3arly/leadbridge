# LeadBridge UI Design System

> **Status:** Canonical — Implementation Contract
> **Last verified:** 2026-09-20
> **Source of truth:** Current Sales UI (post Major Sales UI Overhaul)

---

## 1. Purpose

This document is the canonical UI reference for both the Sales and Admin interfaces. It exists to:

- Prevent Sales and Admin from developing separate visual languages
- Provide an implementation contract for the upcoming Sales + Admin overhaul
- Document the exact design tokens, components, patterns, and conventions currently in use
- Identify gaps, inconsistencies, and legacy patterns that need attention

**This is NOT a marketing/design vision document.** Every value, token, and pattern documented here is derived from the current codebase.

---

## 2. Current Reference Implementation

The current Sales UI (specifically the pages under `src/app/(dashboard)/sales/` and their associated components) is the reference implementation for all visual decisions.

### Reference Pages

| Page | Path | Establishes |
|------|------|-------------|
| Sales Dashboard | `src/app/(dashboard)/sales/page.tsx` | Dashboard layout, KPI cards, pipeline cards, inline tables, section hierarchy |
| My Leads | `src/app/(dashboard)/sales/my-leads/page.tsx` | DataTable, search/filter/sort controls, pagination, lead detail modal, empty state |
| Attention Center | `src/app/(dashboard)/sales/tasks/page.tsx` | KPI summary, segmented control filtering, attention cards, card grid |
| Profile | `src/app/(dashboard)/sales/profile/page.tsx` | Card layout, field display, badge usage, profile hero |

### Reference Components

The following components define the canonical UI language:

- `src/components/shared/app-shell.tsx` — Page shell, container, spacing
- `src/components/shared/navbar.tsx` — Page header bar
- `src/components/shared/data-table.tsx` — Data table with empty/loading states
- `src/components/shared/kpi-card.tsx` — Dashboard metric cards
- `src/components/shared/search-toolbar.tsx` — Search input with icon
- `src/components/shared/active-filters.tsx` — Active filter chips with reset
- `src/components/sales/sales-table-controls.tsx` — Full filter/sort/pagination controls
- `src/components/sales/sales-dashboard-client.tsx` — Dashboard content layout
- `src/components/sales/lead-details-modal.tsx` — Full lead detail modal (3-column)
- `src/components/sales/attention-center.tsx` — Attention center with segmented filter

---

## 3. Design Principles

Observed in the current Sales UI:

1. **Hierarchy** — Clear visual hierarchy through typography weight, size, and color.
2. **Density** — CRM-appropriate density. Tables show multiple data points per row.
3. **Consistency** — Same component for same job everywhere.
4. **Accessibility** — Focus-visible rings, aria-labels, role attributes, keyboard Escape.
5. **Responsiveness** — Mobile-first with bottom navigation. max-w-7xl container.
6. **Reuse** — Shared components in src/components/ui/ and src/components/shared/.
7. **Predictable interactions** — Loading spinners, toast notifications, confirm dialogs.

---

## 4. Technology

| Concern | Technology | Version/Details |
|---------|-----------|-----------------|
| CSS Framework | Tailwind CSS v4 | Via `@tailwindcss/postcss` |
| CSS Utilities | `cn()` from `src/lib/utils.ts` | `clsx` + `tailwind-merge` |
| Component Library | Custom (shadcn/ui-inspired) | Hand-rolled primitives, NOT shadcn CLI |
| Icons | `lucide-react` | v1.24.0 |
| Animation | `gsap` | v3.15.0 (nav indicator, reveals) |
| Toast | `sonner` | v2.0.8 |
| Font | System font stack | "Segoe UI", sans-serif |
| Form validation | `zod` | v4.4.3 |
| State management | React hooks + URL state | `useTableQuery` syncs to URL params |

**No shadcn/ui CLI config file exists.** Components are custom implementations following shadcn/ui conventions (`cn` utility, similar API surface) but are NOT the official shadcn/ui components.

---

## 5. Design Tokens

### 5.1 CSS Variables (from `src/app/globals.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-ink` | `#172033` | Primary text, headings, strong text |
| `--color-brand` | `#315cde` | Primary actions, links, focus rings, active nav |
| `--color-brand-strong` | `#203b8f` | Brand hover state (darker) |
| `--color-surface` | `#eef1f6` | Page background |
| `--color-surface-raised` | `#e2e8f0` | App shell surface background |
| `--color-panel` | `#ffffff` | Card/panel/table background |
| `--color-muted` | `#6b7485` | Secondary text, labels, placeholders |
| `--color-border` | `#d8deea` | All borders |
| `--color-success` | `#198754` | Success states |
| `--color-warning` | `#dd8c1d` | Warning states |
| `--color-danger` | `#d64545` | Destructive actions, errors |

### 5.2 Typography

| Element | Classes | Usage |
|---------|---------|-------|
| Page title | `text-2xl font-semibold` | Navbar heading |
| Section heading | `text-base font-semibold text-[var(--color-ink)]` | Dashboard sections |
| Card title | `text-lg font-bold tracking-tight text-[var(--color-ink)]` | CardHeader > CardTitle |
| Card description | `text-sm text-[var(--color-muted)]` | CardDescription |
| Body text | `text-sm text-[var(--color-ink)]` | Content, table cells |
| Muted text | `text-xs text-[var(--color-muted)]` | Labels, timestamps, metadata |
| Table header | `text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]` | `<th>` elements |
| Badge | `text-xs font-semibold` | Status/priority badges |
| KPI number | `text-3xl font-bold text-[var(--color-ink)]` | KpiCard count |
| Small label | `text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]` | Modal field labels |

### 5.3 Spacing

| Context | Value |
|---------|-------|
| Page vertical spacing | `space-y-6` |
| Section spacing | `space-y-8` |
| Card padding (standard) | `p-6` |
| Card padding (compact) | `p-4` |
| Table cell padding | `px-5 py-4` |
| Table header padding | `px-5 py-3.5` |
| Inline table padding | `px-4 py-3` |
| Form field gap | `space-y-1.5` or `space-y-2` |
| Grid gap | `gap-3` or `gap-4` |
| Flex gap | `gap-2` or `gap-3` |
| Modal body padding | `p-6` |
| Modal footer padding | `px-6 py-4` |

### 5.4 Border Radius

| Element | Radius | Classes |
|---------|--------|---------|
| Cards | `rounded-2xl` | Card, EmptyState, DataTable container |
| Modals/Dialogs | `rounded-2xl` | ConfirmDialog, LeadDetailsModal, all modals |
| Inputs | `rounded-md` | Input |
| Selects | `rounded-xl` | Select |
| Textareas | `rounded-xl` | Textarea |
| Buttons | `rounded-md` | Button |
| Icon buttons | `rounded-xl` | IconActionButton |
| Badges (default) | `rounded-full` | Badge |
| Badges (rounded) | `rounded-md` | Badge variant="rounded" |
| Filter chips | `rounded-full` | FilterChip |
| Nav dock | `rounded-[28px]` / `rounded-[24px]` md | BottomNavigation |
| Nav items | `rounded-[20px]` | BottomNavigationItem |
| Nav menu items | `rounded-[16px]` | NavigationSection links |

### 5.5 Shadows

| Context | Shadow |
|---------|--------|
| Cards (default) | `shadow-xs` |
| Cards (hover) | `shadow-md` |
| Modals | `shadow-xl` |
| Large modals | `shadow-2xl` |
| Nav dock | Multi-layer shadow (see BottomNavigation.tsx) |
| Nav menu | Multi-layer shadow (see BottomNavigationMenu.tsx) |

### 5.6 Backgrounds

| Context | Background |
|---------|-----------|
| Page | `var(--color-surface)` (#eef1f6) |
| App shell surface | `var(--color-surface-raised)` (#e2e8f0) |
| Cards/Panels | `var(--color-panel)` (#ffffff) |
| Navbar | `bg-white/85 backdrop-blur` |
| Table header | `bg-slate-50/80` |
| Modal overlay | `bg-black/40 backdrop-blur-sm` |
| Nav menu overlay | `bg-black/[0.06] backdrop-blur-sm` |
| Active nav indicator | `bg-black/[0.04]` |
| Active nav link | `bg-[var(--color-brand)]/10` |

### 5.7 Container & Layout

| Context | Value |
|---------|-------|
| Max container width | `max-w-7xl` (80rem / 1280px) |
| Page padding (mobile) | `p-4 pb-24` |
| Page padding (desktop) | `md:p-6 md:pb-24` |
| Main content spacing | `space-y-6` |

---

## 6. Component Inventory

### 6.1 UI Primitives (`src/components/ui/`)

| Component | File | Canonical? | Notes |
|-----------|------|------------|-------|
| Button | `button.tsx` | CANONICAL | 6 variants: primary, secondary, danger, ghost, outline, black. 3 sizes: sm, md, lg. Loading state. |
| Card (+ Header, Title, Description, Content, Footer, EmptyState) | `card.tsx` | CANONICAL | Composable card system with isLoading overlay. |
| Input | `input.tsx` | CANONICAL | Native input wrapper with focus ring. |
| Textarea | `textarea.tsx` | CANONICAL | Same styling as Input. |
| Select | `select.tsx` | CANONICAL | Native select wrapper. Uses rounded-xl. |
| Label | `label.tsx` | CANONICAL | text-sm font-medium. |
| FormField | `form-field.tsx` | CANONICAL | Label + children + error + helper text. |
| Badge | `badge.tsx` | CANONICAL | 30+ tone colors. 3 shape variants. |
| Pagination | `pagination.tsx` | CANONICAL | Page X of Y with ellipsis. |
| ConfirmDialog | `confirm-dialog.tsx` | CANONICAL | Destructive/default variants. Scroll lock. Escape. |
| FilterChip | `filter-chip.tsx` | CANONICAL | Removable pill with X. |
| SegmentedControl | `segmented-control.tsx` | CANONICAL | Tab-like control with optional counts. |
| EmptyState | `empty-state.tsx` | CANONICAL | Dashed border, centered text. |
| ErrorState | `error-state.tsx` | CANONICAL | Red background inline error. |
| Loading (Spinner, ButtonSpinner, Overlay, PageLoader, SkeletonCard, SkeletonTable, SkeletonList) | `loading.tsx` | CANONICAL | Full loading system. |
| DateTimeCell | `date-time-cell.tsx` | CANONICAL | Client-hydrated date+time for tables. |
| ExpandableSection | `expandable-section.tsx` | REUSABLE | Show more/less with count. |
| IconActionButton | `icon-action-button.tsx` | CANONICAL | Square icon-only button for row actions. |
| AnimatedReveal | `animated-reveal.tsx` | REUSABLE | GSAP fade-in animation. |

### 6.2 Shared Components (`src/components/shared/`)

| Component | File | Canonical? | Notes |
|-----------|------|------------|-------|
| AppShell | `app-shell.tsx` | CANONICAL | NavigationProvider + BottomNavigation wrapper. |
| Navbar | `navbar.tsx` | CANONICAL | Glass-morphism page header. |
| DataTable | `data-table.tsx` | CANONICAL | Generic table with columns, loading, empty. |
| KpiCard | `kpi-card.tsx` | CANONICAL | Metric card with title, count, description. |
| SearchToolbar | `search-toolbar.tsx` | CANONICAL | Search input with Search icon. |
| ActiveFilters | `active-filters.tsx` | CANONICAL | FilterChip list + Reset. |
| TableControls | `table-controls.tsx` | REUSABLE | Simpler filter row (Input + Select). |
| DateRangePicker | `date-range-picker.tsx` | CANONICAL | Custom single/range date picker. |
| DateTimeDisplay | `date-time-display.tsx` | CANONICAL | Client-hydrated datetime display. |
| LeadActions | `lead-actions.tsx` | REUSABLE | Lead action panel + details + assignment. |
| ExportButton | `export-button.tsx` | CANONICAL | Export with icon-only variant. |
| ResyncButton | `resync-button.tsx` | CANONICAL | Refresh/resync button. |
| SignOutButton | `sign-out-button.tsx` | CANONICAL | Icon-only sign out. |
| BlueprintBackground | `blueprint-background.tsx` | LEGACY | Decorative background. |

### 6.3 Sales Components (`src/components/sales/`)

| Component | File | Canonical? | Notes |
|-----------|------|------------|-------|
| SalesDashboardClient | `sales-dashboard-client.tsx` | CANONICAL | Dashboard layout with pipeline, KPI, agenda. |
| SalesMyLeadsPageContent | `sales-my-leads-page-content.tsx` | CANONICAL | My Leads page with DataTable + controls. |
| SalesTableControls | `sales-table-controls.tsx` | CANONICAL | Full filter panel. |
| LeadFilters | `lead-filters.tsx` | LEGACY | Older filter. Superseded by SalesTableControls. |
| LeadDetailDialog | `lead-detail-dialog.tsx` | CANONICAL | URL-driven detail dialog. |
| LeadDetailsModal | `lead-details-modal.tsx` | CANONICAL | Full 3-column detail modal. |
| LeadHeader | `lead-header.tsx` | CANONICAL | Detail header with inline dropdowns. |
| LeadInfoSection | `lead-info-section.tsx` | CANONICAL | General info key-value display. |
| LeadMetadataCard | `lead-metadata-card.tsx` | CANONICAL | Record information display. |
| DailyHistory | `daily-history.tsx` | CANONICAL | Activity timeline by day. |
| LogActivityModal | `log-activity-modal.tsx` | CANONICAL | Log call/whatsapp activity. |
| AttentionCenter | `attention-center.tsx` | CANONICAL | KPI cards + segmented filter + card grid. |
| AttentionCard | `attention-card.tsx` | CANONICAL | Attention item card. |
| TasksTableClient | `tasks-table-client.tsx` | CANONICAL | Follow-up tasks table. |
| ArchivedLeadsModal | `archived-leads-modal.tsx` | CANONICAL | Archived leads list with restore. |
| FollowUpDropdown | `follow-up-dropdown.tsx` | CANONICAL | Quick filter dropdown. |
| LeadActionBar | `lead-action-bar.tsx` | REUSABLE | Flex wrapper for actions. |
| LeadActionPanel | `lead-action-panel.tsx` | REUSABLE | Details + archive + delete grid. |

### 6.4 Navigation Components (`src/components/shared/navigation/`)

| Component | File | Canonical? |
|-----------|------|------------|
| NavigationProvider | `NavigationProvider.tsx` | CANONICAL |
| BottomNavigation | `BottomNavigation.tsx` | CANONICAL |
| BottomNavigationItem | `BottomNavigationItem.tsx` | CANONICAL |
| BottomNavigationMenu | `BottomNavigationMenu.tsx` | CANONICAL |
| NavigationSection | `NavigationSection.tsx` | CANONICAL |

### 6.5 Hooks (`src/hooks/`)

| Hook | File | Notes |
|------|------|-------|
| useTableQuery | `use-table-query.ts` | URL-synced table state. Debounced search. |
| useLeadDetails | `use-lead-details.ts` | Fetches lead detail data. |
| useHydrated | `use-hydrated.ts` | SSR-safe hydration check. |

---

## 7. Component Usage Rules

### Button

| Variant | When to use | Visual |
|---------|-------------|--------|
| `primary` (default) | Primary CTA, form submissions | Blue bg, white text |
| `secondary` | Default actions, filters, Cancel | White bg, border, dark text |
| `danger` | Destructive confirm buttons | Red bg, white text |
| `ghost` | Inline text actions, Reset, Delete in header | Transparent, hover bg |
| `outline` | Outlined CTAs | Blue border, blue text |
| `black` | Modal primary actions (Save, Log Activity) | Black bg, white text |

**Sizes:** `sm` (compact), `md` (default), `lg` (rarely used).

**Rules:**
- Use `secondary` for most table row actions
- Use `black` for modal form submit buttons
- Use `danger` only inside ConfirmDialog
- Use `ghost` for inline text-like actions
- Always set `isLoading` on async actions
- Always set `type="button"` unless it is a form submit

### Card

**Composition:** `Card` > `CardHeader` + `CardContent` or `CardFooter`.

**Rules:**
- Use `p-4` for compact cards (KPI, pipeline)
- Use `p-6` for standard cards
- Use `CardHeader` when card has a titled section with a divider
- Cards have hover shadow transition by default

### Badge

**Variants:** Default (pill), `rounded` (rounded-md), `square` (rounded-md).

**Rules:**
- Use `toneKey` prop to match status/priority to the correct color
- Default shape is pill (`rounded-full`)
- Use `variant="rounded"` in profile/compact contexts
- Badges are non-interactive

### DataTable

**Rules:**
- Always define `key`, `header`, and `render` for each column
- Use `onRowClick` for clickable rows (cursor-pointer, hover state)
- Use `SkeletonTable` for loading state (auto-shown via `isLoading`)
- Empty state uses dashed border with centered message
- Table headers are uppercase, tracked, muted

### ConfirmDialog

**Rules:**
- Use `variant="destructive"` for delete/archive/cancel actions
- Use `variant="default"` for non-destructive confirmations
- Always provide `title`, `description`, `confirmLabel`, `cancelLabel`
- Always wire `isLoading` and `error` props

### FormField

**Rules:**
- Always wrap Input/Select/Textarea in FormField when a label is needed
- Use `required` prop to show the red asterisk
- Error text appears below the input, helper text appears when no error

---

## 8. Page Layout Rules

### Page Container

Every page lives inside `AppShell` which provides:
- `max-w-7xl` centered container
- `p-4 pb-24` mobile padding, `md:p-6 md:pb-24` desktop
- `space-y-6` between children
- BottomNavigation fixed at bottom

### Page Header (Navbar)

Every page starts with `<Navbar>`:
- Glass-morphism bar: `bg-white/85 backdrop-blur rounded-2xl border border-white/60 p-5`
- Contains: "LeadBridge" uppercase label, page title (`text-2xl font-semibold`), optional subtitle, action buttons
- Responsive: stacks on mobile (`flex-col`), row on desktop (`md:flex-row`)

### Section Hierarchy

```
AppShell
  Navbar (page header)
  <section> (space-y-8 between sections)
    <h2> (text-base font-semibold — section heading)
    <grid> (cards, tables, content)
```

### Actions in Navbar

Actions go in the `actions` prop of Navbar, rendered on the right side:
- `SignOutButton` (always)
- `ExportButton` (when permitted)
- `ResyncButton` (when `showResync`)
- Custom dropdowns (e.g., `FollowUpDropdown`)

---

## 9. Tables & Data-Dense Screens

### DataTable Structure

```
<div rounded-2xl border bg-panel>
  <table>
    <thead>
      <tr bg-slate-50/80>
        <th text-xs font-semibold uppercase tracking-[0.05em] text-muted px-5 py-3.5>
    <tbody divide-y divide-border>
      <tr hover:bg-slate-50/80 px-5 py-4>
        <td>
```

### Table Row Height

- Header: `py-3.5` (32px)
- Body: `py-4` (36px)
- Compact inline tables (dashboard): `py-3` (28px)

### Column Alignment

- Text columns: left-aligned, `text-sm`
- Numeric columns: left-aligned with `tabular-nums`
- Action columns: centered (`text-center`)

### Sorting

Via `SalesTableControls` filter panel — select dropdown with predefined sort options.

### Pagination

Two patterns exist:
1. **Inline pagination** in `SalesTableControls` — simple prev/next with "Showing X-Y of Z"
2. **Full pagination** component — page buttons with ellipsis (used in older views)

### Empty State

- Dashed border: `border-dashed border-[var(--color-border)] bg-slate-50`
- Centered icon + title + description
- Optional action button below

### Loading State

- `SkeletonTable` with rows/cols matching expected layout
- Auto-shown when `DataTable` receives `isLoading`

---

## 10. Forms & Dialogs

### Modal Pattern

All modals follow this structure:
```
<div fixed inset-0 z-50 flex items-center justify-center p-4>
  <div absolute inset-0 bg-black/40 backdrop-blur-sm onClick=close />
  <div relative z-10 w-full max-w-{size} rounded-2xl bg-white shadow-xl border border-border>
    <div p-6 overflow-y-auto flex-1>  (scrollable body)
    <div flex items-center justify-end gap-3 px-6 py-4 border-t border-border>  (footer)
      <Button variant="secondary">Cancel</Button>
      <Button variant="black">Submit</Button>
```

### Modal Sizes

| Modal | Max Width |
|-------|-----------|
| ConfirmDialog | `max-w-md` |
| LogActivityModal | `max-w-lg` |
| LeadEditModal | `max-w-4xl` (90%w, 88vh) |
| LeadDetailsModal | `max-w-6xl` (95%w, 92vh) |
| ArchivedLeadsModal | `max-w-2xl` |
| Filter panel (dropdown) | `w-[90vw] sm:w-[640px] lg:w-[720px]` |

### Modal Behavior

- Body scroll lock when open (with scrollbar width compensation)
- Escape key closes
- Click overlay closes (unless loading)
- Loading state: spinner in center or `isLoading` on submit button
- Error: inline red alert box (`rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700`)

### Form Spacing

- Form sections separated by `<hr className="border-[var(--color-border)]">` or visual spacing
- Section headers: `text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]`
- Field groups: `grid grid-cols-2 gap-4`
- FormField spacing: `space-y-1.5` or `space-y-2`

---

## 11. Status / Priority / State System

### Lead Status

| Value | Label | Badge Color |
|-------|-------|-------------|
| NEW | New | `bg-blue-100 text-blue-800` |
| CONVERTED | Converted | `bg-green-100 text-green-800` |
| LOST | Lost | `bg-rose-100 text-rose-800` |
| SPAM | Spam | `bg-red-50 text-red-400` |
| ON_HOLD | On Hold | `bg-amber-100 text-amber-800` |

### Lead Priority

| Value | Label | Badge Color |
|-------|-------|-------------|
| LOW | Low | `bg-sky-100 text-sky-700` |
| MEDIUM | Medium | `bg-slate-100 text-slate-700` |
| HIGH | High | `bg-orange-100 text-orange-800` |
| URGENT | Urgent | `bg-red-100 text-red-800` |

### Lead Categories (17 total)

All defined in `src/components/ui/badge.tsx` tones map and `src/lib/lead-constants.ts`.

### User Roles

| Value | Badge Color |
|-------|-------------|
| ADMIN | `bg-slate-900 text-white` |
| SALES | `bg-blue-100 text-blue-800` |

### User Status

| Value | Badge Color |
|-------|-------------|
| Active | `bg-emerald-50 text-emerald-700` |
| Inactive | `bg-rose-50 text-rose-700` |

### Overdue Indicators

- Overdue dates: `text-red-600 font-medium` or `text-red-600 font-semibold`
- Overdue follow-up card: `border-red-200 bg-red-50`
- Overdue badge: `bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700`
- Pending badge: `bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700`

---

## 12. Feedback & Loading

### Loading States

| State | Component | Usage |
|-------|-----------|-------|
| Spinner | `LoadingSpinner` | Inline loading indicator |
| Button spinner | `ButtonSpinner` | Inside buttons during async |
| Overlay | `LoadingOverlay` | Covers a card/panel during load |
| Page loader | `PageLoader` | Full page height center loader |
| Skeleton card | `SkeletonCard` | Card placeholder |
| Skeleton table | `SkeletonTable` | Table placeholder |
| Skeleton list | `SkeletonList` | List placeholder |

### Empty States

| Type | Component | Visual |
|------|-----------|--------|
| Table empty | DataTable empty branch | Dashed border, icon, title, description |
| Card empty | `CardEmptyState` | Centered icon, title, description, optional action |
| Page empty | `EmptyState` | Dashed border, centered text |

### Error States

| Type | Component | Visual |
|------|-----------|--------|
| Inline error | `ErrorState` | `rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700` |
| Modal error | Inline div | `rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700` |
| Toast error | `toast.error()` | Sonner toast |

### Success Feedback

- Toast: `toast.success("Message")` via sonner
- No persistent success states in UI (auto-dismiss via toast)

### Disabled States

- Buttons: `disabled:cursor-not-allowed disabled:opacity-60`
- Inputs: `disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60`
- Icon buttons: `disabled:cursor-not-allowed disabled:opacity-50`

---

## 13. Responsive Rules

### Current Behavior

| Viewport | Behavior |
|----------|----------|
| Mobile (< 768px) | Bottom nav shows 3 items. Page padding p-4. Grid cols-2. |
| Desktop (>= 768px) | Bottom nav shows 5 items. Page padding md:p-6. Grid cols-3/4/5. |
| Container | Always max-w-7xl centered |

### Grid Patterns

| Context | Mobile | Desktop |
|---------|--------|---------|
| KPI cards (dashboard) | `grid-cols-2` | `sm:grid-cols-3 lg:grid-cols-5` |
| KPI cards (attention) | `grid-cols-2` | `sm:grid-cols-2 lg:grid-cols-4` |
| Profile cards | `grid-cols-1` | `sm:grid-cols-2` |
| Attention cards | `grid-cols-1` | `sm:grid-cols-2` |
| Activity cards | `grid-cols-2` | `md:grid-cols-4` |

### Table Responsive

- Tables use `overflow-x-auto` wrapper for horizontal scroll
- No column hiding — all columns visible with horizontal scroll on mobile

---

## 14. Accessibility Rules

### Focus States

- All interactive elements: `focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2`
- Brand focus ring: `focus-visible:ring-[var(--color-brand)]`
- Nav items: `focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30 focus-visible:ring-offset-1`

### Keyboard Interaction

- Escape closes all modals and menus
- Tab navigation within modals (trapped in BottomNavigationMenu)
- `aria-current="page"` on active nav items
- `aria-label` on all icon-only buttons
- `aria-modal="true"` and `role="dialog"` on all modals
- `role="alert"` on error messages
- `role="status"` on loading spinners
- `sr-only` text for screen readers ("Loading...")

### Semantic Controls

- Native `<button>`, `<input>`, `<select>`, `<textarea>`, `<label>` elements
- `<table>` with `<thead>`, `<tbody>`, `role="table"`, `scope="col"` on `<th>`
- `<time>` element with `dateTime` attribute for dates

### Destructive Confirmation

- All destructive actions go through `ConfirmDialog`
- Destructive variant uses red confirm button
- Non-destructive uses blue primary button

---

## 15. Do / Don't

### Correct vs Incorrect

**Buttons:**
- DO: Use `Button variant="secondary"` for table row actions
- DO: Use `Button variant="black"` for modal submit
- DON'T: Use `Button variant="primary"` for Cancel actions
- DON'T: Use native `<button>` with inline styles instead of Button component

**Spacing:**
- DO: Use `space-y-6` between page sections
- DO: Use `space-y-8` between dashboard sections
- DON'T: Use arbitrary pixel values for vertical spacing
- DON'T: Mix spacing conventions (e.g., space-y-4 in one place, space-y-8 in another for same-level sections)

**Tables:**
- DO: Use `DataTable` for all tabular data
- DO: Define empty state and loading state
- DON'T: Build ad-hoc tables with raw HTML
- DON'T: Skip loading/empty states

**Modals:**
- DO: Use `ConfirmDialog` for all confirmations
- DO: Use the standard modal structure (overlay + container + scrollable body + footer)
- DON'T: Build custom confirm dialogs
- DON'T: Skip scroll lock and Escape handling

**Badges:**
- DO: Use `Badge` with `toneKey` for status/priority
- DON'T: Build custom colored labels
- DON'T: Make badges interactive (use Button instead)

**Empty States:**
- DO: Show empty state when data array is empty
- DON'T: Show blank screen when no data
- DON'T: Skip empty states "because it rarely happens"

---

## 16. Sales to Admin Consistency Rules

The following MUST remain visually consistent between Sales and Admin:

| Element | Rule |
|---------|------|
| Navigation | Same BottomNavigation component, same dock style, same active indicator |
| Page headers | Same Navbar component with glass-morphism |
| Buttons | Same Button component with same variants |
| Inputs/Selects | Same Input, Select, Textarea components |
| Filters | Same FilterChip, SegmentedControl, SearchToolbar |
| Tables | Same DataTable with same header/cell/empty/loading patterns |
| Cards | Same Card with same border-radius, shadow, hover |
| Badges | Same Badge component with same tone map |
| Dialogs | Same ConfirmDialog for all confirmations |
| Empty/Loading/Error states | Same EmptyState, SkeletonTable, ErrorState |
| Typography | Same heading sizes, muted text, label styles |
| Spacing | Same space-y-6 / space-y-8 conventions |
| Interaction states | Same loading spinners, disabled states, toast notifications |

**Admin may have different information density and functionality** (e.g., more columns, admin-specific filters, different KPIs), but it MUST use the same visual language.

---

## 17. Current Gaps / Technical Debt

### Inconsistencies Found

| Issue | Category | Severity | Location |
|-------|----------|----------|----------|
| Select uses `rounded-xl` but Input uses `rounded-md` | Inconsistent pattern | cosmetic | `select.tsx` vs `input.tsx` |
| Two pagination implementations (inline in SalesTableControls vs Pagination component) | Component duplication | cosmetic | `sales-table-controls.tsx` vs `pagination.tsx` |
| LeadFilters superseded by SalesTableControls but still exists | Legacy implementation | cosmetic | `lead-filters.tsx` |
| BlueprintBackground exists but is unused/legacy | Legacy implementation | cosmetic | `blueprint-background.tsx` |
| Some modals use `variant="black"` for submit, others use `variant="primary"` | Inconsistent pattern | cosmetic | Various modals |
| `useModalState` hook is defined inside `lead-details-modal.tsx` instead of `src/hooks/` | Inconsistent pattern | cosmetic | `lead-details-modal.tsx` |
| Inline tables in dashboard don't use DataTable component | Component duplication | cosmetic | `sales-dashboard-client.tsx` |
| Admin HealthBadge is a local component not using Badge | Component duplication | cosmetic | `admin-dashboard-client.tsx` |
| Admin InsightCard duplicates KpiCard pattern | Component duplication | cosmetic | `admin-dashboard-client.tsx` |
| SignOutButton and ResyncButton use raw `<button>` instead of Button component | Inconsistent pattern | cosmetic | `sign-out-button.tsx`, `resync-button.tsx` |
| ExportButton uses raw `<button>` instead of Button component | Inconsistent pattern | cosmetic | `export-button.tsx` |
| `confirm()` browser dialog used in attention-center.tsx for delete | Accessibility | accessibility | `attention-center.tsx` |
| No focus trap in LeadDetailsModal (only in BottomNavigationMenu) | Accessibility | accessibility | `lead-details-modal.tsx` |
| Table horizontal scroll not tested on mobile | Responsive | responsive | DataTable |

---

## 18. Future UI Overhaul Rules

When overhauling Sales and Admin UIs, follow these rules:

1. **Do not introduce new design tokens.** Use existing CSS variables from `globals.css`.
2. **Do not install new UI libraries.** Extend existing components.
3. **Do not create parallel component hierarchies.** Reuse `src/components/ui/` and `src/components/shared/`.
4. **Admin must reuse Sales components.** Shared components like DataTable, Card, Button, Badge, etc. are NOT Sales-specific.
5. **Fix inconsistencies documented in Section 17** as part of the overhaul.
6. **Standardize modal submit buttons** — decide between `black` and `primary` and apply consistently.
7. **Extract `useModalState` to `src/hooks/`** for reuse.
8. **Replace inline dashboard tables with DataTable** where possible.
9. **Replace raw `<button>` in SignOutButton, ResyncButton, ExportButton** with Button component.
10. **Add focus trapping to all modals**, not just BottomNavigationMenu.
11. **Replace `confirm()` dialogs** with ConfirmDialog component.
12. **Test all new views on mobile** — ensure tables scroll horizontally, grids collapse properly.
13. **Every new page must include**: Navbar, loading state, empty state, error handling.
14. **Every new data table must include**: search, sort, pagination, filters, empty state, loading skeleton.
15. **Every destructive action must include**: ConfirmDialog with descriptive title and description.
