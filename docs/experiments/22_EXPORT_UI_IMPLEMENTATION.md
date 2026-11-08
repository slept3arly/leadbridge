# Export UI Implementation — Phase 4

> **Status:** Dedicated Admin and Senior Sales workspaces and contextual shortcuts are implemented over the existing streamed `GET /api/export` endpoint.
> **Date:** 2026-11-07
> **Contracts:** [19_EXPORT_SYSTEM_CONTRACTS.md](./19_EXPORT_SYSTEM_CONTRACTS.md)
> **Backend queries:** [20_EXPORT_QUERY_ARCHITECTURE.md](./20_EXPORT_QUERY_ARCHITECTURE.md)
> **Delivery:** [21_EXPORT_DELIVERY_RELIABILITY.md](./21_EXPORT_DELIVERY_RELIABILITY.md)

## 1. Routes and Access

- `/admin/exports` is a Server Component under the existing Admin layout, which calls `requireSession("ADMIN")`. It offers all five implemented categories: Leads, Users, Providers, Sync Runs, and Reports.
- `/sales/exports` calls `requireSession("SALES")` and then checks the existing `Permission.EXPORT_LEADS`. Sales/JUNIOR is redirected to `/sales`; Senior Sales receives only Leads. The API/service authorization and server-owned owner scope remain authoritative.
- `getAvailableExportCategories()` in `src/lib/export/ui.ts` filters the shared registry by implemented availability and the existing export authorization policy. The page does not expose planned categories.

## 2. Workspace and Controls

`src/components/export/export-workspace.tsx` renders the compact role-aware workspace using existing `Button`, `Input`, and `Select` primitives. Changing category resets all category-specific selections. The summary shows the selected category, active filter groups, Sales record-scope explanation, fixed field layout, and date semantics. There is no preview/count API, so the page does not claim an estimated row count or percentage progress.

The UI reads the live route contract from `src/lib/export/legacy-contract.ts`, which centralizes accepted query keys and current fixed CSV field IDs. CSV headers come from the Phase 1 `EXPORT_FIELDS` metadata plus that fixed field list; no second field registry was added. `GET /api/export` currently ignores neither `columns` nor any arbitrary filters: it rejects unsupported keys. Since the live route does not accept column selection, the workspace shows the fixed compatible CSV columns and does not offer custom column checkboxes. The Report section layout is fixed.

Only filters accepted by the current route are shown:

| Category | Workspace filters | Live behavior/limitation |
|---|---|---|
| Leads | Multi-select status, source, action, response, priority, category, interest; archive state; Activity Date; search; Lead Created range; Admin-only assignee | Sales cannot select an owner; server scope remains the authenticated user's assigned, non-deleted leads. Activity values match one ActivityEntry under the same event and use ActivityEvent occurrence time. |
| Users | None | Current endpoint exports all non-deleted users, active and inactive. |
| Providers | None | Current compatibility adapter exports active providers only. |
| Sync Runs | Connector, UTC date preset/custom dates | Date filtering uses Started At. |
| Reports | UTC date preset/custom dates | Requires both custom boundaries. Date-sensitive lead report sections use Created At; the existing Activity section retains its fixed today/7/30-day metrics. |

Date presets are computed at UTC calendar boundaries using the Phase 1 resolver. Custom dates include both selected calendar dates. Lead Created and Activity Date are separate controls and are ANDed when both are set. They are translated into the current legacy route's inclusive `from`/`to` timestamp convention. The page explains each category's default date field/window.

## 3. Download Interaction

The workspace and `ExportButton` open the existing GET URL in a browser-native new tab. They do not fetch the CSV into JavaScript, create a Blob, or buffer the response, so Phase 3 response streaming remains intact. Query construction uses `URLSearchParams`; only accepted, non-empty values are emitted. The button prevents a second launch during the short initiation window, reports popup blocking and local validation errors, and never announces that a transfer completed. There is no reliable completion/progress signal for a native streamed download. HTTP validation, authorization, limit, and server failures are returned by the existing endpoint in the opened tab.

There is no new request/response API, backend query builder, download filename change, export format, or streaming change in this phase.

## 4. Contextual Shortcuts

Existing shortcuts remain in place:

- Admin Leads and Sales My Leads map URL-backed supported Lead filters (status, source, priority, category, activity action/response/interest/date, archive state, Admin assignee, search, and date bounds) to the live parameters. Pagination and sorting are omitted. If an active page filter cannot be represented, the shortcut shows an error and does not silently export a broader selection. `Unassigned` is supported for Admin only.
- Admin Users detects active search/filter/date state and blocks the shortcut when the current endpoint cannot preserve those filters. Pagination and sorting are omitted.
- Admin Providers keeps its active-provider download shortcut. Search/type/inactive filters disable it with an explanation; the button is labeled as an active-provider export.
- Admin Reports passes the current report range through the existing `from`/`to` adapter.
- The Connectors page retains its all-runs shortcut. Sync History modal adds an “Export this connector” shortcut using the current connector ID.

Context filter mapping is centralized/tested in `src/lib/export/ui.ts`. The backend still rejects unsupported/duplicate parameters and enforces role and record scope.

## 5. Navigation

Admin navigation adds Exports to the existing More drawer. Sales navigation adds Exports only when the layout's authenticated session passes `can(user, Permission.EXPORT_LEADS)`. The server page independently repeats the permission check, so a hidden navigation item is not treated as access control. Existing responsive dock/drawer behavior is reused.

## 6. Tests and Verification Boundaries

`tests/export-ui.test.ts` exercises role/category visibility, navigation inclusion, category reset defaults, fixed CSV header metadata (including legacy Product), accepted query construction, Sales assignee rejection, UTC date boundaries and validation, contextual filter propagation/blocking, omission of pagination/sort keys, planned-category rejection, and duplicate download initiation guard behavior. Existing export contract and delivery tests remain part of the full suite.

No browser automation is configured/performed in this phase. Manual verification remains for Admin and Senior Sales navigation, Junior direct-route redirect, desktop/mobile layout, popup blocking, native CSV download, browser error tab rendering, and contextual filter interactions. Unit tests verify request construction but do not verify browser download completion or responsive rendering.

## 7. Known Limitations

- The UI cannot select columns until the live API accepts the Phase 1 `columns` contract; it preserves existing fixed columns now.
- The UI cannot offer Phase 1 filters that are not accepted by the live legacy endpoint. These include most User/Provider filters, and some Lead filters such as archive, priority, category, and provider.
- Provider compatibility export always selects active providers; inactive selection is not available through the current endpoint.
- No preview/count or export-completion endpoint exists, so the UI cannot show record estimates, transfer progress, or confirmed success.
- Native downloads expose endpoint errors in the opened tab rather than routing them into the workspace. The endpoint returns its existing JSON error envelope.
- Contextual page filters implemented only in local component state cannot be serialized by the current shortcut. Provider shortcuts are disabled whenever those local filters would be lost.
- Activities, Follow-ups, Notes, and Connector Inventory remain unavailable.
