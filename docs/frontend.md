# LeadBridge Frontend

> **Status:** Canonical
> **Last verified:** 2026-11-07
> **Source of truth:** `src/app/`, `src/components/`, `src/hooks/`

## Rendering Model

- **All page components are Server Components** (async functions)
- **Client components** (`"use client"`) are used for interactive UI: tables, modals, forms, filters
- **No server actions** -- all mutations via API routes

## Pages (15)

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
| `/admin/exports` | `src/app/(dashboard)/admin/exports/page.tsx` | Role-authorized export workspace |
| `/admin/settings` | `src/app/(dashboard)/admin/settings/page.tsx` | System settings |
| `/sales` | `src/app/(dashboard)/sales/page.tsx` | Sales dashboard |
| `/sales/my-leads` | `src/app/(dashboard)/sales/my-leads/page.tsx` | My Leads list |
| `/sales/tasks` | `src/app/(dashboard)/sales/tasks/page.tsx` | Tasks / Attention Center |
| `/sales/profile` | `src/app/(dashboard)/sales/profile/page.tsx` | User profile |
| `/sales/exports` | `src/app/(dashboard)/sales/exports/page.tsx` | Senior Sales lead export workspace |

The Admin dashboard presents CRM-wide lead totals, status and priority breakdowns, assignment and pending follow-up workload, daily sales activity, salesperson performance, connector status and recent syncs, and recent activity. Its metric cards and tables reuse the shared `KpiCard`, `Badge`, and `DataTable` components.

The Admin Leads page lists CRM-wide leads with URL-backed search, assignment, status, priority, source, archive, activity, follow-up, date, sort, and pagination filters. It uses the shared `SalesTableControls` and compact table styling, with Admin assignment filters and quick links enabled. Rows open the shared lead details workflow for activity and follow-up management; create/edit, archive/restore, delete, and export use existing API routes and services. Archived leads are shown by selecting the archived filter, while the default list excludes them.

The Admin and Senior Sales export workspaces expose the currently supported Lead filters: status, source, action, response, priority, category, interest, archive state, search, lead-created date range, and activity occurrence date. Activity values must match the same CALL/WHATSAPP entry on a matching event. Admin may narrow by salesperson or unassigned state; Senior Sales sees no assignee control and remains scoped to their own assigned non-deleted leads. Export columns remain fixed for compatibility. `Lead Number` still shows the stored identifier string because the schema has no reliable numeric lead sequence.

## Create and Edit Leads

Create Lead and Edit Lead expose independent City and District inputs in their existing positions. Users can enter different values; neither input copies or changes the other. The form submits only populated location values on create and only changed values on edit. Lead list/detail API types expose both fields independently.

Sales and Admin both use `src/components/leads/lead-edit-modal.tsx` (`LeadEditModal`). Name is required; Email and Phone are individually optional, while at least one must be provided. Email is trimmed and checked for valid format. A supplied phone must contain exactly 10 digits; its input uses a numeric mobile keyboard and invalid characters or lengths remain visible with an inline error. Edit mode retains its Required/Optional labels; Create mode removes those visible tags while validation continues to enforce required fields. Classification and contact fields use responsive two-column grids; Edit mode Requirement spans the form width. Admin receives the optional Assigned User field through `assignableUsers`; Sales keeps the existing automatic self-assignment behavior.

Create mode requires an **Initial Customer Interaction**. It reuses `src/components/sales/activity-fields.tsx` for Call/WhatsApp action, action-specific response, conditional interest, activity notes, and optional initial follow-up date/time. The response starts blank, so the salesperson must record what happened. Action changes reset response and interest. Disabling follow-up scheduling clears its date and time. The section is omitted from edit mode. Manual lead creation submits the lead, exactly one initial interaction, and an optional follow-up through `POST /api/leads`; connector/import creation remains separate. The modal retains entered values after a failed request and closes/refreshes only after success.

Create mode uses a full-screen dialog with a responsive two-column layout and no accordions. The left column orders Name, Company, City, District, State, Phone, Email, Category, and Lead Source; the optional Admin-only Assigned To control follows. The right column orders Action and Response side by side in one equal-width row (stacking on narrow screens), then Status, Priority, conditional Interest, Notes, and Schedule follow-up. Latest Requirement is not rendered in Create mode and is omitted from the `POST /api/leads` payload; Edit mode retains its existing Requirement field and payload behavior. The action, response, conditional interest, notes, and optional follow-up date/time use centralized workflow labels and the existing validation. Create mode uses an accessible On/Off toggle labelled “Schedule a follow-up” (off by default) that reveals the date/time fields with a subtle transition; disabling it clears and omits those values. Its Notes textarea uses a compact ~60px height while remaining full-width and non-resizable, matching the existing input styling and validation. Pressing Enter in a single-line field moves focus through the defined left-then-right visual order instead of submitting; Notes keeps newline insertion, conditional fields are skipped when unavailable, and Enter on the Save button still submits. Native selects keep their picker keyboard behavior: the first Enter opens the picker, the selecting Enter commits the option, and the next Enter advances to the following logical field. A select dismissed without a selection reopens instead of advancing, and focus never moves while the picker is open. Create mode does not render section subtitles, Required/Optional tags, or the contact-method helper message; required-field and server-side validation remain active with inline field errors. City and District remain independent inputs, and the API stores each supplied field separately. Validation focuses the first invalid visible field, and API errors remain visible in the header area. The header and footer stay fixed while each column can scroll independently. Edit mode retains its existing 88vh layout.

Product is no longer shown or submitted by the manual Add/Edit Lead form, View Details popup, or Admin lead list. Existing lead data is retained in storage; historical Product field-change labels remain in Activity and History. Connector imports may still populate the legacy field, and CSV export retains its Product column and stored values for compatibility.

## Record Progress

`src/components/leads/record-progress-modal.tsx` is the canonical interaction workflow for existing leads. It uses a full-screen dialog with a responsive two-column layout: Action, Response, Status, Priority, conditional Interest, and Notes on the left; Manage Follow-ups on the right. Sections are directly visible without accordions. Lead Category and Latest Requirement are not editable here. The current pending task is displayed read-only. Scheduling a new task is an optional switch, off by default; when enabled, the modal submits date/time with the interaction in one `POST /api/leads/[id]/activities` request. The shared backend scheduler replaces the current pending task atomically. Interaction-only submissions omit schedule values and leave the task unchanged. Field validation focuses the first invalid field, and stale-task 409 responses remain visible in the dialog. Existing task completion and rescheduling controls are not part of this modal.

The shared component is used by Lead Details (including its follow-up completion action), the My Leads quick **Record Progress** action, and Tasks. Sales dashboard agenda and Attention Center actions open Lead Details, which uses the same component. Admin dashboard has no direct interaction or task-completion action; Admin lead details use the same workflow. All progress is submitted once to `POST /api/leads/[id]/activities`. The Axios mutation synchronizer publishes the successful activity response to other open tabs; the current view refreshes after success.

## Lead Workspace

`src/components/sales/lead-details-modal.tsx` owns the Lead Workspace and its single `useLeadDetails` request. The responsive layout keeps a sticky identity header with contact links, current status/priority/category badges and primary Record Progress action. Activity and History is the primary workspace content; the supporting column shows the lead owner and every pending follow-up (with the earliest due task called out, overdue state, owner, and task-specific Record Progress action), plus a collapsed list of the three most recently completed tasks. Customer information is available in the accessible `LeadDetailsPopup` opened from View Details. Its Edit Details action closes the popup and opens the existing `LeadEditModal`. Created/updated/imported and first-contacted/last-contacted/closed timestamps are shown in customer/lead metadata, not under Lead owner. Standalone scheduling/rescheduling, archive/restore and permitted delete actions remain available.

`LeadInfoSection` omits empty customer values and does not request or render `rawPayload`. `DailyHistory` distinguishes contact interactions from lifecycle/follow-up/system history, displays actual field changes when event metadata includes them, and retains activity editing for Sales users. Admin activity editing remains hidden because the existing activity PATCH endpoint only authorizes the assigned salesperson. Legacy standalone Note records are joined to their matching note event or represented as a timeline item when no event exists; their existing API and storage remain intact. No missing historical interaction outcome is inferred.

The details endpoint returns up to the latest 100 activity events and latest 100 saved Notes, plus the lead and follow-ups. Pending and completed follow-ups are currently returned without pagination so the workspace can show every pending task. The same-origin CRM mutation sync refreshes this view for related lead, activity, note and follow-up changes; focus/visibility revalidation remains cooldown-limited, with no polling. Dashboard lead actions continue to open the shared workspace, while Tasks and My Leads can open the same Record Progress component directly. Browser-level visual and keyboard testing is unavailable in the current test setup; pure projection behavior is covered by Node tests.

Standalone follow-up scheduling and rescheduling remain available when no interaction is being recorded; the schedule-only dialog directs users to Record Progress if they want to combine an interaction and a task. Task completion from Tasks and Lead Workspace requires Record Progress, while cancellation/deletion remains a separate task-management action. Sales users can edit their own lead's historical interaction entries; Admin activity editing is hidden because the endpoint authorizes the assigned salesperson only. Note storage and APIs remain for historical and compatibility use; this UI does not create separate Notes from interaction notes. The obsolete `LogActivityModal` and unused `LeadMetadataCard` have been removed. `ActivityFormFields` remains shared by Add Lead and Record Progress.

The Sales dashboard agenda opens the Lead Workspace for the selected lead, where Record Progress is primary. The Admin dashboard has no quick interaction or task-completion action, so no new dashboard action was added. Add Lead is available through the shared create form on the lead-management pages where `CREATE_LEAD` is granted.

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

### Fresh data across tabs

Lead, note, follow-up, and activity mutations publish a minimal same-origin message after the API request succeeds. Active lead lists, dashboards, and the Attention Center refresh their server-provided data when a relevant message arrives. An open lead detail view refetches when the message identifies its lead or one of its currently loaded note, follow-up, or activity IDs. The shared `useCrmSync` hook also revalidates a view when its tab becomes visible or focused, with a 30-second cooldown. It uses `BroadcastChannel` where available and a `storage` event fallback; messages carry entity identifiers and a timestamp only.

## Navigation Architecture

### Top Navbar (`src/components/shared/navbar.tsx`)
Header with logo, section title, search/filter triggers, resync button, user avatar, sign-out.

### Bottom Navigation (`src/components/shared/navigation/`)
Fixed bottom bar on all viewports:

- **Admin:** Dashboard, Leads, Reports, "More" drawer (including Exports)
- **Sales:** Dashboard, My Leads, Tasks, Profile; Senior Sales also receives Exports

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
| `AccordionSection` | `accordion-section.tsx` | Controlled accessible disclosure section |
| `Label` | `label.tsx` | Form label |

### Shared Components (`src/components/shared/`)

| Component | Description |
|---|---|
| `DataTable` | Reusable table with loading/empty states |
| `ExportButton` | Browser-native CSV download shortcut; passes supported URL-backed filters and blocks shortcuts when active filters cannot be represented |
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
  --color-ink: #172033;            /* Primary text */
  --color-brand: #315cde;          /* Primary actions and focus */
  --color-brand-strong: #203b8f;   /* Brand hover */
  --color-surface: #eef1f6;        /* Page background */
  --color-surface-raised: #e2e8f0; /* Raised surfaces */
  --color-panel: #ffffff;          /* Cards and panels */
  --color-muted: #6b7485;          /* Secondary text */
  --color-border: #d8deea;         /* Borders */
  --color-success: #198754;        /* Success state */
  --color-warning: #dd8c1d;        /* Warning state */
  --color-danger: #d64545;         /* Error and destructive state */
}
```

These values are defined in `src/app/globals.css` and exposed through Tailwind CSS v4's `@theme` block.

## Custom Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useTableQuery` | URL-based table state (page, search, sort, filters) |
| `useLeadDetails` | Lead detail data fetching |
| `useHydrated` | Client hydration detection |

Note: `src/hooks/index.ts` is currently empty (exports nothing).
