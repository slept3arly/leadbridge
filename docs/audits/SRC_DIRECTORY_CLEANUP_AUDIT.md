# LeadBridge `src/` Directory Cleanup and Architecture Audit

**Audit date:** 2026-11-23  
**Scope:** Current filesystem under `src/`, plus read-only reference searches in tests, Prisma/configuration, package scripts, and repository tracking metadata.  
**Mode:** Read-only audit. No source, test, package, or Git changes were made. This report is the requested deliverable.

## Executive summary

The source layout mostly follows a sensible App Router / feature UI / service / connector-runtime split. The clearest actionable cleanup is `src/services/assignment.service.ts`: no reference or registration was found in source or tests, and its only behavior delegates directly to `leadService.assign`. Three zero-content barrel placeholders (`hooks/index.ts`, `jobs/index.ts`, `utils/index.ts`) also add no exports, but their removal should be treated as low-priority and checked against external tooling conventions.

The main architectural exceptions are a handful of route handlers and server pages that call Prisma directly, with connector creation/settings/deletion especially carrying business validation and secret-preservation logic in route files. The export implementation is deliberately split across `lib/export` (schemas/UI contracts) and `services/export` (querying/delivery); it is extensive but not inherently duplicate. Several UI files are large, though the larger ones are coherent feature screens and should only be split around measured responsibility boundaries.

“Confirmed unused” below means no current source/test/configuration reference or framework convention was found after searches. Absence of a reference is weaker evidence for framework entrypoints, externally consumed APIs, and runtime registration; those are kept unless independently proven dead.

## Counts and tracking facts

- **288 filesystem files:** 261 tracked handwritten source files and 27 ignored generated Prisma client files.
- **98 source directories**, including `src` itself; four empty directories occur under `src/app/api`.
- The 27 files in `src/generated/prisma/` are all ignored by `.gitignore` and none are tracked by Git. This is consistent with the Prisma generator output being recreated by `postinstall` / `db:generate`; do not edit them manually.
- `src/generated/prisma` currently contains only top-level client entrypoints, internal helpers, and model files. No handwritten source was found there.
- Git status already contained unrelated root/package/scripts/audit-report changes before this report was created; those changes were not modified.
- A pre-existing `graphify-out/graph.json` exists, but it refers to audit-log source files absent from the current filesystem. It is stale and was not used as evidence for file existence or usage.

## A. Complete source directory map

The descriptions below apply to every file found in the current `src/` tree. `[generated]` identifies ignored Prisma output. Route file names are framework entrypoints; `page`, `layout`, `loading`, and `error` retain Next.js convention-based use even if no ordinary import points to them.

### `src/app/` — pages, layouts, and API route entrypoints

- `(dashboard)/admin/connectors/`: `error.tsx` — connector-page error boundary; `loading.tsx` — connector-page loading UI; `page.tsx` — server-rendered connector administration and safe connector data preparation.
- `(dashboard)/admin/exports/page.tsx` — admin export workspace route and initial export choices.
- `(dashboard)/admin/layout.tsx` — admin session/role gate and application shell.
- `(dashboard)/admin/leads/`: `error.tsx` — lead-page error boundary; `loading.tsx` — lead table loading UI; `page.tsx` — server-side lead list/bootstrap data.
- `(dashboard)/admin/loading.tsx` — admin-segment loading fallback.
- `(dashboard)/admin/page.tsx` — admin dashboard page and cached aggregate loading.
- `(dashboard)/admin/providers/`: `error.tsx` — provider-page error boundary; `loading.tsx` — provider-page loading UI; `page.tsx` — provider/parser administration bootstrap.
- `(dashboard)/admin/reports/`: `loading.tsx` — reports loading fallback; `page.tsx` — admin reports page.
- `(dashboard)/admin/settings/`: `loading.tsx` — settings loading fallback; `page.tsx` — admin settings page.
- `(dashboard)/admin/users/`: `error.tsx` — user-page error boundary; `loading.tsx` — user table loading UI; `page.tsx` — user list/bootstrap data.
- `(dashboard)/loading.tsx` — dashboard-group loading fallback.
- `(dashboard)/sales/exports/page.tsx` — sales export route with permission-aware access.
- `(dashboard)/sales/layout.tsx` — sales session/permission gate and application shell.
- `(dashboard)/sales/loading.tsx` — sales-group loading fallback.
- `(dashboard)/sales/my-leads/`: `loading.tsx` — assigned-leads loading UI; `page.tsx` — sales lead list/bootstrap data.
- `(dashboard)/sales/page.tsx` — sales dashboard and cached aggregate loading.
- `(dashboard)/sales/profile/page.tsx` — sales profile page; `profile/user-id-field.tsx` — copyable user identifier field.
- `(dashboard)/sales/tasks/page.tsx` — sales attention/tasks page and cached task aggregates.
- `api/activities/[id]/route.ts` — activity-event mutation endpoint.
- `api/auth/[...all]/route.ts` — Better Auth catch-all handler.
- `api/connectors/[id]/route.ts` — connector deletion endpoint.
- `api/connectors/[id]/settings/route.ts` — connector settings, schedule, source, and REST-secret update endpoint.
- `api/connectors/[id]/sync/route.ts` — manually starts a connector runtime execution with lock/fence handling.
- `api/connectors/route.ts` — lists supported connector types and creates connectors.
- `api/dashboard/route.ts` — dashboard aggregate API.
- `api/export/route.ts` — compatibility export API and streamed CSV delivery.
- `api/follow-ups/[id]/complete/route.ts` — completes a follow-up.
- `api/follow-ups/[id]/route.ts` — updates or cancels a follow-up.
- `api/health/live/route.ts` — process liveness endpoint.
- `api/health/ready/route.ts` — database readiness endpoint.
- `api/lead-sources/[id]/route.ts` — lead-source read/update/delete endpoint.
- `api/lead-sources/route.ts` — lead-source list/create endpoint.
- `api/leads/[id]/activities/route.ts` — lead activity-event list/create endpoint.
- `api/leads/[id]/assign/route.ts` — lead assignment endpoint.
- `api/leads/[id]/details/route.ts` — lead detail workspace data endpoint.
- `api/leads/[id]/follow-ups/route.ts` — lead-scoped follow-up endpoint.
- `api/leads/[id]/notes/route.ts` — lead-scoped notes endpoint.
- `api/leads/[id]/route.ts` — lead read/update/delete endpoint.
- `api/leads/route.ts` — lead list/create endpoint.
- `api/notes/[id]/route.ts` — note update/delete endpoint.
- `api/parsers/preview/route.ts` — parser preview endpoint.
- `api/parsers/route.ts` — parser catalog endpoint.
- `api/providers/[id]/route.ts` — provider read/update/delete endpoint.
- `api/providers/connectors/test/route.ts` — provider connector test endpoint.
- `api/providers/gmail/route.ts` — Gmail account/provider endpoint.
- `api/providers/parser-requests/route.ts` — parser request list/create endpoint.
- `api/providers/parsers/route.ts` — provider-compatible parser list endpoint.
- `api/providers/route.ts` — provider list/create endpoint.
- `api/providers/routing-rules/[id]/route.ts` — routing-rule update/delete endpoint.
- `api/providers/routing-rules/route.ts` — routing-rule list/create endpoint.
- `api/providers/sync-runs/route.ts` — connector sync history endpoint.
- `api/providers/unmatched/route.ts` — unmatched-email listing/action endpoint.
- `api/reports/route.ts` — reports data endpoint.
- `api/resync/route.ts` — authenticated cache/data refresh trigger.
- `api/scheduler/trigger/route.ts` — scheduler trigger endpoint with scheduler-secret authorization.
- `api/settings/route.ts` — settings read/update endpoint.
- `api/users/[id]/route.ts` — user read/update/delete endpoint.
- `api/users/route.ts` — user list/create endpoint.
- `favicon.ico` — application favicon.
- `globals.css` — global Tailwind/theme/application styles.
- `layout.tsx` — root document, metadata, and global providers.
- `login/page.tsx` — login route.
- `page.tsx` — root route redirect/landing behavior.

Empty API directories: `api/audit-logs/`, `api/follow-ups/[id]/cancel/`, `api/mock/leads/`, and `api/sync/`. Empty folders are not versioned by Git and currently define no routes.

### `src/components/` — shared UI and feature screens

- `admin/admin-dashboard-client.tsx` — admin dashboard client view; `admin/admin-reports.tsx` — report filters/results; `admin/admin-settings.tsx` — settings editor.
- `connectors/connector-edit-modal.tsx` — connector create/edit form; `connectors/connectors-page-content.tsx` — connector administration table/page; `connectors/sync-history-modal.tsx` — sync-run history dialog.
- `export/export-workspace.tsx` — export category/filter/download workspace.
- `leads/admin-leads-page-content.tsx` — admin leads list UI; `leads/lead-edit-modal.tsx` — lead create/edit form; `leads/lead-source-manager-modal.tsx` — lead-source management dialog; `leads/lead-status-priority-cell.tsx` — lead status/priority cell controls; `leads/record-progress-modal.tsx` — lead progress/activity/follow-up dialog.
- `login-form.tsx` — login form.
- `providers/provider-edit-modal.tsx` — provider editor; `providers/providers-page-content.tsx` — provider administration page; `providers/routing-rules-manager.tsx` — routing-rule editor/list.
- `sales/activity-fields.tsx` — activity input fields; `sales/attention-card.tsx` — individual attention item; `sales/attention-center.tsx` — task/attention list; `sales/daily-history.tsx` — daily lead event history; `sales/follow-up-dropdown.tsx` — follow-up action dropdown; `sales/go-to-top-button.tsx` — scroll-to-top control; `sales/lead-action-bar.tsx` — lead action controls; `sales/lead-action-panel.tsx` — lead action panel; `sales/lead-detail-dialog.tsx` — lead detail dialog wrapper; `sales/lead-details-modal.tsx` — lead details and activity dialog; `sales/lead-details-popup.tsx` — lead details popup variant; `sales/lead-header.tsx` — lead title/header; `sales/lead-info-section.tsx` — lead information section; `sales/sales-dashboard-client.tsx` — sales dashboard client view; `sales/sales-my-leads-page-content.tsx` — assigned leads page UI; `sales/sales-table-controls.tsx` — sales table filters/query controls; `sales/tasks-table-client.tsx` — task table client UI.
- `shared/active-filters.tsx` — active-filter chips; `shared/app-shell.tsx` — authenticated shell/sidebar framing; `shared/blueprint-background.tsx` — decorative background; `shared/data-table.tsx` — reusable data table; `shared/date-range-picker.tsx` — date-range filter control; `shared/date-time-display.tsx` — hydration-safe date/time text; `shared/export-button.tsx` — shared export action; `shared/kpi-card.tsx` — KPI display card; `shared/lead-actions.tsx` — shared lead action controls; `shared/navbar.tsx` — application navigation header; `shared/navigation/BottomNavigation.tsx` — bottom navigation container; `BottomNavigationItem.tsx` — one bottom navigation item; `BottomNavigationMenu.tsx` — bottom menu; `NavigationProvider.tsx` — navigation state/context; `NavigationSection.tsx` — grouped navigation section; `shared/resync-button.tsx` — refresh/resync control; `shared/search-toolbar.tsx` — search toolbar; `shared/sign-out-button.tsx` — sign-out action; `shared/table-controls.tsx` — shared pagination/table controls.
- `ui/accordion-section.tsx` — collapsible accordion section; `animated-reveal.tsx` — reveal animation wrapper; `badge.tsx` — badge primitive; `button.tsx` — button primitive; `card.tsx` — card primitives; `confirm-dialog.tsx` — confirmation dialog; `date-time-cell.tsx` — hydration-safe date/time cell; `empty-state.tsx` — empty-state view; `error-state.tsx` — error-state view; `expandable-section.tsx` — expandable section; `filter-chip.tsx` — filter chip; `filter-popover.tsx` — filter popover; `form-field.tsx` — labeled form field wrapper; `icon-action-button.tsx` — icon-only action control; `input.tsx` — input primitive; `label.tsx` — label primitive; `loading.tsx` — page/table/skeleton loading primitives; `pagination.tsx` — pagination control; `segmented-control.tsx` — segmented choice control; `select.tsx` — Radix select wrapper; `textarea.tsx` — textarea primitive.
- `users/user-edit-modal.tsx` — user editor; `users/user-table-controls.tsx` — user-list query controls; `users/users-page-content.tsx` — user administration list.

### `src/connectors/` — external-system boundaries

- `environment.ts` — Gmail environment/account discovery.
- `gmail/gmail-batch.ts` — batched Gmail message retrieval; `gmail-client.ts` — Gmail API client/auth setup; `gmail-connector.ts` — Gmail connector implementation; `gmail-errors.ts` — Gmail-specific errors; `gmail-parser.ts` — Gmail message parser; `gmail-types.ts` — Gmail API/domain types.
- `registry.ts` — connector factories and supported connector registration.
- `rest/rest-client.ts` — REST pagination/request execution; `rest-connector.ts` — REST connector implementation; `rest-errors.ts` — REST errors; `rest-security.ts` — outbound URL/SSRF protections; `rest-types.ts` — REST configuration and payload types.
- `types.ts` — connector-facing contracts.

### `src/generated/prisma/` — generated code, ignored by Git

- `browser.ts` — browser-safe generated Prisma exports; `client.ts` — generated Prisma client entrypoint; `commonInputTypes.ts` — generated shared input types; `enums.ts` — generated enums; `models.ts` — generated model exports.
- `internal/class.ts` — generated client class internals; `internal/prismaNamespace.ts` — generated Prisma namespace; `internal/prismaNamespaceBrowser.ts` — browser namespace variant.
- `models/Account.ts`, `ActivityEntry.ts`, `ActivityEvent.ts`, `Attachment.ts`, `Connector.ts`, `ConnectorSyncRun.ts`, `FieldMapping.ts`, `FollowUp.ts`, `Lead.ts`, `LeadSource.ts`, `Note.ts`, `Parser.ts`, `ParserRequest.ts`, `RoutingRule.ts`, `Session.ts`, `Setting.ts`, `UnmatchedEmail.ts`, `User.ts`, `Verification.ts` — generated model-specific types and operations.

### `src/hooks/` — reusable React hooks

- `index.ts` — empty module placeholder, exports nothing.
- `use-accessible-dialog.ts` — dialog focus/keyboard behavior; `use-crm-sync.ts` — CRM mutation refresh subscription; `use-hydrated.ts` — client hydration state; `use-lead-details.ts` — fetch/manage lead detail state; `use-table-query.ts` — URL-backed table query parsing and updates.

### `src/jobs/`

- `index.ts` — empty module placeholder; no job implementations or registration are present in this directory.

### `src/lib/` — shared server/client helpers and contracts

- `activity-options.ts` — activity options and labels; `api.ts` — API authorization wrappers/error responses; `auth-client.ts` — browser Better Auth client; `auth.ts` — server Better Auth configuration; `cache-tags.ts` — cache tags and mutation invalidation; `create-lead-enter-navigation.ts` — create-form Enter-key navigation; `crm-sync.ts` — client sync event names/notifications; `csv.ts` — CSV escaping/row serialization; `database-readiness.ts` — injected DB readiness helper; `follow-up-date.ts` — follow-up date parsing/validation; `follow-up-form-date.ts` — browser date/time form conversion; `get-error-message.ts` — client-safe error message extraction; `lead-constants.ts` — lead/follow-up enumerations and labels; `lead-create-accordion.ts` — map validation errors to form accordion section; `lead-workspace.ts` — combine activity/note/follow-up workspace items; `logger.ts` — Pino logger; `navigation.tsx` — role-aware navigation configuration; `permissions.ts` — permission matrix; `prisma.ts` — Prisma client/adapter singleton; `query-builder.ts` — list query parsing and Prisma pagination/search helpers; `record-progress-follow-ups.ts` — progress-dialog follow-up selection helpers; `scheduler-auth.ts` — scheduler secret validation; `scheduler-schedule.ts` — schedule interval/next-run calculations; `service-errors.ts` — service error type; `session.ts` — session retrieval/requirement; `utils.ts` — class merging, date/time formatting helpers; `validation.ts` — Zod request/input schemas.
- `export/dates.ts` — date preset/range contract; `fields.ts` — exportable field catalog and column selection; `filters.ts` — category-specific export filters; `index.ts` — export contract barrel; `legacy-compatibility.ts` — legacy query parsing adapter; `legacy-contract.ts` — legacy parameter/column contract; `output.ts` — export request/result schemas and limits; `policy.ts` — export authorization/scope policy; `registry.ts` — export category registry; `ui.ts` — client export query/selection helpers.

### `src/parsers/`

- `base-parser.ts` — parser interface/base class; `example-parser.ts` — generic example/test parser, actively registered under `example`; `parser-manifest.ts` — parser metadata contract; `registry.ts` — static parser registry and lookup/manifest helpers.

### `src/runtime/`

- `connector-executor.ts` — invoke connector contract; `connector-runtime.ts` — end-to-end sync orchestration; `execution-context.ts` — create execution context/logger/config; `lead-normalizer.ts` — validate/enrich parsed leads; `parser-runtime.ts` — parser lookup and execution; `retry-policy.ts` — retry behavior; `routing-engine.ts` — resolve payload provider/parser routing; `runtime-errors.ts` — runtime error types; `runtime-result.ts` — standardized execution result constructors; `runtime-types.ts` — shared connector/runtime types; `sync-history.ts` — persist sync start/completion history.

### `src/services/`

- `activity-event.service.ts` — activity-event and entry operations; `assignment.service.ts` — thin delegate to lead assignment, no callers found; `attention.service.ts` — sales attention/task aggregates; `connector-health.service.ts` — connector health/completion updates; `connector.service.ts` — connector listing and sync-history operations; `dashboard.service.ts` — dashboard aggregates; `duplicate.service.ts` — duplicate lead matching; `execution-fence.ts` — fenced execution transaction helper; `execution-lock.service.ts` — connector execution lock/heartbeat; `export.service.ts` — export service facade; `follow-up-policy.ts` — follow-up lifecycle policy; `follow-up.service.ts` — follow-up business operations; `lead-workflow.service.ts` — lead/activity/follow-up transactional workflow; `lead.service.ts` — lead operations; `note.service.ts` — note operations; `parser-request.service.ts` — parser request operations; `parser.service.ts` — parser registry/catalog operations; `provider.service.ts` — providers/routing rules; `report.service.ts` — reports; `scheduler.service.ts` — scheduled connector execution; `settings.service.ts` — settings operations; `unmatched-email.service.ts` — unmatched email operations; `user.service.ts` — user operations.
- `export/authorization.ts` — authorize export categories; `csv-serialization.ts` — serialize queried records; `csv-stream.ts` — deadline/limit-aware stream; `deadline.ts` — export deadline control; `keyset.ts` — cursor/keyset pagination helpers; `limits.ts` — export limits; `operation-log.ts` — export audit/operation logging; `projections.ts` — Prisma export projections; `query-builders.ts` — category query predicates; `query.service.ts` — open category export queries; `scope.ts` — actor-dependent data scope.

### `src/types/`, `src/utils/`, and root source entrypoint

- `types/lead.ts` — normalized lead/status/priority types used by connector parsing/runtime.
- `utils/index.ts` — empty module placeholder, exports nothing.
- `proxy.ts` — Next.js request proxy for route/session handling.

## B. Architecture overview and interaction flow

1. **Page entrypoints** in `app/(dashboard)` use layouts/session checks, load initial data, and render feature components. Client components use hooks, shared controls, and API endpoints. The separate App Router convention means page/layout files need no direct importer.
2. **API entrypoints** in `app/api` generally wrap handlers with `withApiAuthorization` or permission authorization, validate request payloads, call a service, and format responses. Authentication is handled by the Better Auth catch-all route; `proxy.ts` applies request-level routing/session behavior.
3. **Business services** in `services/` own domain operations and most Prisma access through `lib/prisma.ts`. Workflow operations coordinate transactions, activity records, cache invalidation, and lead denormalized follow-up values. A few pages/API routes still bypass this boundary for direct reads or connector writes.
4. **Prisma** is initialized once in `lib/prisma.ts`; generated client/type imports resolve through ignored `src/generated/prisma/`, generated from `prisma/schema.prisma` by Prisma tooling/postinstall.
5. **Connector sync path:** manual API route or `SchedulerService` acquires an execution lock/fence, creates a connector from `connectors/registry.ts`, and invokes `ConnectorRuntime`. Runtime calls `ConnectorExecutor` -> connector implementation (Gmail or REST) -> parser registry/runtime -> `LeadNormalizer` -> routing/duplicate and lead services -> activity/history/health persistence. Execution ownership is checked around long-running operations and mutations.
6. **Parser path:** parser definitions in `parsers/` are selected by the registry; Gmail's concrete parser lives within its connector area. This is an intentional integration between connector-specific parsing and a shared parser registry, but it couples the registry to the Gmail connector module.
7. **Export path:** UI contract/schema logic sits in `lib/export`; route validates legacy-compatible HTTP input, service/query modules apply authorization/scope/filters and stream serialization, with operation logging and deadlines. This is one feature organized across API, lib, and service layers rather than duplicated export engines.

## C. File-level audit findings

The complete per-file responsibilities are enumerated in section A. The table below records actionable or notable file-level findings; all other files were reviewed and are **KEEP** unless included in the focused findings below. `KEEP` is the default recommendation for convention-based and referenced files; generated entries are never edit targets.

| File/path | Responsibility | Usage/dependencies | Finding | Recommendation | Risk |
|---|---|---|---|---|---|
| `src/services/assignment.service.ts` | Wraps `leadService.assign` | No import/reference in `src`, tests, or config; class and singleton have no callers | Confirmed unreferenced wrapper with no additional behavior | REMOVE | Low after a final repository-wide reference check; external direct imports are unknown |
| `src/hooks/index.ts` | Empty module | No exports/imports | Placeholder only | REMOVE | Very low; possible external tooling convention |
| `src/jobs/index.ts` | Empty module | No exports/imports; no jobs directory consumers | Placeholder only | REMOVE | Very low; possible future planned-job convention |
| `src/utils/index.ts` | Empty module | No exports/imports | Placeholder only | REMOVE | Very low; possible external tooling convention |
| `src/app/api/connectors/route.ts` | Connector create/catalog | Direct Prisma create/provider lookup; shared config validation | Route owns persistence and request/business rules | REFACTOR | Medium; authorization, validation, cache invalidation, connector setup could regress |
| `src/app/api/connectors/[id]/route.ts` | Connector delete | Direct Prisma lookup/delete | Route bypasses service for mutation | REFACTOR | Medium; deletion constraints/cascade behavior should be preserved |
| `src/app/api/connectors/[id]/settings/route.ts` | Connector configuration/schedule update | Direct Prisma reads/update; secret retention; schedule validation | Most complex service-boundary exception; secret merge is security-sensitive and currently local to route | REFACTOR | High; risk of losing stored credentials or weakening validation |
| `src/app/api/connectors/[id]/sync/route.ts` | Manual sync orchestration | Prisma read plus lock/fence/runtime composition | Route owns significant orchestration but serves as explicit execution entrypoint | INVESTIGATE | Medium-high; moving logic could alter lock lifetime/ownership guarantees |
| `src/app/api/lead-sources/route.ts` and `[id]/route.ts` | Provider-like lead-source CRUD | Direct Prisma calls | Confirm exact business-rule overlap with `provider.service` before deciding; no automatic consolidation recommendation | INVESTIGATE | Medium; semantics may intentionally differ |
| `src/app/api/providers/connectors/test/route.ts` | Test provider connector | Prisma + connector runtime dependency | Review whether it duplicates manual/scheduled sync setup | INVESTIGATE | Medium; test-only behavior may intentionally differ |
| `src/app/(dashboard)/admin/connectors/page.tsx` | Connector admin server page and serialization | Direct Prisma; exports large serialized types | Page has a large local mapping/serialization surface compared with service-based pages | REFACTOR | Medium; safe config redaction is critical |
| `src/app/(dashboard)/admin/exports/page.tsx`, `(dashboard)/sales/exports/page.tsx` | Export page bootstrapping | Both load roles/categories and services; sales route also enforces export permissions | Some setup overlap is plausible, but roles/data scopes differ | KEEP | Low; share only if behavior tests show identical responsibilities |
| `src/services/connector.service.ts` | Connector service | Contains `recordSyncRun` with explicit “legacy compatibility for smoke scripts” comment; runtime owns sync-history persistence | Compatibility method may be obsolete, but package scripts/tests may call indirectly; verify before removal | INVESTIGATE | Medium; impacts smoke/integration consumers and historical sync records |
| `src/services/provider.service.ts` | Provider/routing-rule service | Explicit legacy compatibility comment for routing now owned by runtime | Legacy compatibility code may be removable after checking callers and external scripts | INVESTIGATE | Medium; check invocation paths before deletion |
| `src/lib/export/legacy-compatibility.ts` | Parses old GET `/api/export` query contract | Directly used by live route and tests | Necessary adapter while endpoint remains legacy-shaped | KEEP | Low; removing changes client contract |
| `src/lib/export/legacy-contract.ts` | Legacy query/columns constants | Used by UI, route, projections and barrel | Repeated exports/re-export paths, but shared contract is intentionally centralized | KEEP | Low |
| `src/lib/export/index.ts` | Export barrel | No production direct barrel import found in examined refs; individual modules are used | Potentially redundant convenience barrel; not proof of dead module because external imports are possible | INVESTIGATE | Low |
| `src/connectors/registry.ts` | Register Gmail/REST connector factories | `createConnector` and `supportedConnectorTypes` used by sync routes/services; `listConnectorManifests` and `hasConnector` have no found callers | Two dead exports within active registry | CONSOLIDATE | Low; validate external callers before removing exports |
| `src/parsers/example-parser.ts` | Example parser | Imported and registered by `parsers/registry.ts` as key `example` | It is not dead even if only used for generic/test/demo flows | KEEP | Medium if removed: parser configurations using `example` would fail |
| `src/hooks/use-hydrated.ts` | Hydration hook | Used by task, date, sales, and user UI | Shared behavior despite repeated call sites | KEEP | Low |
| `src/components/sales/lead-details-modal.tsx`, `lead-detail-dialog.tsx`, `lead-details-popup.tsx` | Lead detail UI variants/wrappers | Inspect consumers before choosing reuse; names do not establish equivalent behavior | Possible overlap; variants may represent distinct presentation/interaction contracts | INVESTIGATE | Medium; consolidation risks modal, popup, and dialog accessibility/state behavior |
| `src/components/shared/table-controls.tsx`, `sales/sales-table-controls.tsx`, `users/user-table-controls.tsx` | General and feature-specific table query controls | Feature controls include distinct filter schemas; shared controls are lower-level | Similar naming but not confirmed duplicate UI behavior | KEEP | Low |
| `src/runtime/connector-runtime.ts` | End-to-end sync orchestration | Called from manual and scheduler entrypoints; depends on services and Prisma | Large coordinator with transaction/history/routing/error concerns; coherent central workflow | REFACTOR | High; needs focused tests for ordering, retries, fencing, and partial failures |
| `src/connectors/rest/rest-client.ts` | REST request and pagination handling | Used by REST connector | Large module with security/pagination concerns; keep together absent clear cohesive split seam | INVESTIGATE | High for behavioral changes to auth, URL validation, pagination |
| `src/lib/validation.ts` | Shared Zod schemas | Used across API routes/forms and tests | Broad schema catalog, but central validation currently avoids duplicate route schemas | KEEP | Medium if split without checking shared refinements/contracts |
| `src/lib/utils.ts` | formatting, date helpers, `cn` | Many direct UI imports | Mixed presentation utility responsibilities; extraction may improve discoverability but no duplication proven | KEEP | Low |
| `src/app/api/audit-logs/`, `api/mock/leads/`, `api/sync/`, `api/follow-ups/[id]/cancel/` | Empty directories | No route files; no route behavior | Empty placeholders only; Git does not track empty directories | REMOVE | None at runtime; do not infer a missing endpoint from the folder alone |
| `src/generated/prisma/**` (27 files) | Generated Prisma API/types | Imported by services/runtime | Correctly ignored and untracked; generated from schema | GENERATED — DO NOT EDIT | High if hand-edited; generation overwrites changes |
| All current `app/**/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `api/**/route.ts` | Next.js route convention entrypoints | Framework discovery, not ordinary imports | Must not flag as dead based on lack of direct import | KEEP | High if deleted without route verification |

## D. Duplication and overlap report

1. **Assignment wrapper vs lead service:** `assignment.service.ts` adds no behavior to `leadService.assign` and has no current callers. This is the strongest confirmed removable item.
2. **Connector execution composition:** both the manual sync API route and `SchedulerService` build a connector registry adapter, parser adapter, and `ConnectorRuntime`. They differ in trigger context, locking, schedule ownership, and health/reporting. There is composition overlap but not enough evidence to collapse them blindly. A small shared runtime factory could reduce repeated wiring if tests demonstrate identical setup requirements.
3. **Lead detail presentations:** `lead-details-modal`, `lead-detail-dialog`, and `lead-details-popup` likely overlap in domain content. Consumers and interaction behavior must be compared first; no consolidation should be based on names alone. The modal includes broad lead/activity/follow-up behavior, so preserving variant-specific state and accessibility is important.
4. **Table controls:** generic `shared/table-controls` and feature-specific sales/user controls have overlapping pagination/query concerns, while feature modules encode filters and URL semantics. Share only demonstrably common pieces; do not merge whole components solely by naming.
5. **Date/time formatting:** `lib/utils.ts`, `shared/date-time-display.tsx`, `ui/date-time-cell.tsx`, and local date-input formatters operate at distinct layers (formatting vs hydration handling vs form input). No duplicate implementation confirmed without deeper semantic comparison.
6. **Export modules:** export schemas and contracts in `lib/export`, query and streaming code in `services/export`, and the route adapter form a large but coherent feature boundary. `LEGACY_EXPORT_COLUMNS` is re-exported from multiple places, which is redundant surface area but not duplicate data. Removing a re-export is a small cleanup only after checking API consumers.
7. **CSV serialization:** `lib/csv.ts` is used by `services/export/csv-serialization.ts`, while `export.service.ts` re-exports the same helpers for compatibility. This is one implementation with a compatibility surface, not two serializers.
8. **Provider/lead-source naming:** lead sources and providers may map onto related concepts, but route/service behavior and Prisma model contracts must be compared before any merge. No finding here asserts they are duplicate models.

## E. Unused/dead code report

### Confirmed unused files

- `src/services/assignment.service.ts` — repository-wide exact symbol/path search found no importer or invocation in `src`, tests, package scripts, or configuration. Its two exports are only defined here, and the implementation delegates to `leadService.assign`.

### Confirmed empty placeholders

- `src/hooks/index.ts`, `src/jobs/index.ts`, `src/utils/index.ts` — each file contains only `export {};`, so contributes no runtime behavior or public exports. Their removal is low-risk but may affect tooling that expects conventional directory barrels; confirm before implementation.
- Empty API directories listed above contain no file and therefore no route implementation. These are not tracked by Git.

### Confirmed unused exports within active files

- `listConnectorManifests` and `hasConnector` in `src/connectors/registry.ts` have no repository references. `createConnector` and `supportedConnectorTypes` are live; keep the file. Removal of the two exports should be checked against any out-of-repository consumers.

### Suspected / requires caller confirmation

- `ConnectorService.recordSyncRun` is explicitly commented as compatibility for smoke scripts while sync history is persisted by runtime. No direct reference was identified by the sampled source usage search; check all scripts, one-off operations and external automation before deletion.
- `ProviderService` methods commented as legacy routing compatibility may be obsolete because routing belongs to runtime; inspect all method-level references before removing any.
- `src/lib/export/index.ts` may be a redundant barrel because application imports use explicit modules, but external package consumers are unknown.
- No registered parser, Next route, page, component, generated file or connector implementation is classified as unused on the available evidence.

## F. Architecture and maintainability findings (prioritized)

### High impact

1. **Connector CRUD logic is too concentrated in route handlers.** Create/delete/settings handlers use Prisma directly. The settings route also performs schedule validation and recursively meaningful secret-retention/merge behavior. These are business rules with security impact and deserve a service boundary, but any move must preserve masked/omitted credential semantics.
2. **Sync entrypoint wiring is split between routes and scheduler service.** Both construct runtime dependencies, while the manual route additionally owns locks/fencing and sync metadata. This makes it harder to ensure both entrypoints evolve consistently. First compare full behavior; only then consider a factory/execution service.
3. **Page routes do some direct database access.** Direct reads in dashboard pages can be acceptable for server-rendered bootstrap, but consistent service use would centralize projections and authorization. The admin connector page is the most involved example; avoid blanket extraction of simple reads.

### Medium impact

4. **Service boundaries are mostly good but not absolute.** Direct Prisma is found in several API endpoints, a few server pages, runtime/history components, and auth configuration. Distinguish infrastructure setup (auth/runtime locks) from domain endpoint persistence; target only business operations.
5. **`ConnectorRuntime` has broad orchestration responsibility.** It coordinates retry, parsing, normalization, routing, persistence, activity, and sync history. It is a legitimate workflow coordinator, but changes are high risk and should be accompanied by explicit contract tests.
6. **A few broad/large modules hide multiple concerns.** Largest handwritten feature files include the connector settings modal, lead details modal, lead editor, sales table controls, report UI, REST client, lead/follow-up services, and connector runtime. Size alone is not a defect; extract only clear independent policies or state machines.
7. **Parser registry imports a Gmail parser from a connector directory.** This is a mild layering inversion: parser catalog depends on a concrete connector integration. Current behavior is explicit and works, but future parser integrations could benefit from a feature-owned parser registration module or injected registration.

### Low impact

8. **Three empty barrels and one delegating service are navigation noise.** Removing confirmed dead wrappers is low-risk and immediately clarifies which directories have actual APIs.
9. **Export compatibility surface is spread across several small modules.** The separation is understandable; simplify only after the endpoint compatibility contract is intentionally retired.
10. **Four empty route directories are not useful filesystem placeholders.** They are not tracked and have no runtime impact; no action is required beyond avoiding creation of such directories without a route.

No circular dependency was proven from the reviewed import paths. No new search system/cache layer is indicated. The source follows the intended activity and follow-up workflow in service modules; this audit did not modify or independently validate business invariants.

## G. Cleanup execution plan

| Stage | Files affected | Proposed changes | Dependencies | Regression risks | Required tests | Safe / independent? |
|---|---|---|---|---|---|---|
| 1. Remove verified no-op placeholders | `services/assignment.service.ts`, `hooks/index.ts`, `jobs/index.ts`, `utils/index.ts` | Delete unreferenced delegate and empty exports after a final all-repository/path alias scan | No functional dependency found; confirm no external imports | Extremely low for empty modules; low for wrapper if external import exists | Typecheck, lint; assignment API/service tests remain on `leadService` path | Yes, separately reviewable |
| 2. Trim unused connector registry exports | `connectors/registry.ts` | Remove `listConnectorManifests` and `hasConnector` only if no external consumers | Connector catalog route currently uses `supportedConnectorTypes` | External library consumer could import exports | Typecheck and connector route tests | Yes |
| 3. Consolidate connector CRUD domain logic | connector API routes; new/updated connector service | Move reads/writes/config merge/schedule validation into service methods; keep route focused on auth, parsing, response | Agree on service boundary; preserve cache invalidation and safe credential retention | High for credential preservation, schedule semantics, and deletion behavior | Add service/route tests for omitted/empty secrets, auth type changes, schedule bounds, invalid config, missing provider, cache invalidation; typecheck/lint | Independent of stages 1–2 but medium/high risk |
| 4. Unify sync runtime construction | manual sync route, `scheduler.service.ts`, possibly a new service/helper | Extract only genuinely shared registry/parser/runtime construction; preserve caller-specific lock, schedule, health, actor behavior | Stage 3 not required; requires side-by-side flow comparison | High: fences, retries, completion metadata, duplicate runs | Unit/contract tests for manual and scheduled runs, lock contention, error/finally release, ownership loss | No; behavior-sensitive |
| 5. Resolve legacy sync/routing compatibility | `connector.service.ts`, `provider.service.ts`, scripts/tests calling them | Confirm usage; remove compatibility methods only after consumers migrate or are proven absent | Read-only review of all scripts and runtime callers | Medium; out-of-band script consumers | Search plus integration contract tests for run history/routing behavior | Decision and consumer inventory required |
| 6. Component responsibility review | lead detail variants, connector edit modal/page, REST client, runtime | Compare actual behavior; split only coherent independent policies/state, or consolidate only identical interactions | Component call-site map and product behavior knowledge | Medium/high for UI accessibility and runtime semantics | Existing component interaction tests plus focused regression tests | Independent per feature, not a broad refactor |
| 7. Revisit export barrel/compatibility after API contract change | `lib/export/index.ts`, legacy contract/parser, API route | Reduce redundant re-exports only if consumer contract is known; retire legacy adapter only with an explicit API migration | Client compatibility decision | High if old query parameters are still used | Export contract/query/delivery/UI test suites | No; needs product/API decision |

## Top 10 cleanup opportunities, ranked by value/risk

1. Remove unused `assignment.service.ts` — **high value, low risk**.
2. Remove three `export {};` placeholder files — **low-medium value, very low risk**.
3. Remove unreferenced `hasConnector` and `listConnectorManifests` exports — **low value, low risk**.
4. Move connector config/schedule validation and secret retention into a connector service — **high value, high risk**.
5. Move connector create/delete persistence from API routes into services — **medium-high value, medium risk**.
6. Compare and reduce duplicate setup between manual and scheduled sync — **high value, high risk**.
7. Audit/remove legacy compatibility methods in connector/provider services after script inventory — **medium value, medium risk**.
8. Compare lead detail modal/dialog/popup before any consolidation — **medium value, medium risk**.
9. Review the large admin connector page serialization for a safe service projection — **medium value, medium risk**.
10. Revisit the export barrel/re-exports only when external API compatibility is clear — **low value, low risk**.

## Final requested summary

1. **Total reviewed:** 98 source directories and 288 files (261 tracked handwritten, 27 ignored generated Prisma files).
2. **Confirmed unused files:** `src/services/assignment.service.ts`; plus empty placeholder files `src/hooks/index.ts`, `src/jobs/index.ts`, `src/utils/index.ts` (no exports/content). The latter are no-op files, not behavioral implementations.
3. **Potentially removable:** the four files above; `listConnectorManifests` and `hasConnector` exports; possibly the explicitly legacy sync/routing methods and export barrel after caller confirmation.
4. **Duplicate/overlapping implementations:** connector runtime wiring in manual and scheduled paths; lead detail dialog/modal/popup variants; generic vs feature table controls; repeated export re-exports. Only the assignment wrapper is clearly redundant implementation.
5. **Most important architecture problems:** connector CRUD business logic and secret merging in API routes; duplicated sync runtime composition across trigger paths; direct Prisma access in selected routes/pages; broad orchestration concentrated in `ConnectorRuntime`.
6. **Generated files/tracking:** 27 Prisma-generated files under `src/generated/prisma`, all ignored by `.gitignore` and untracked; do not edit.
7. **Top ten:** ranked above with value/risk.
8. **Recommended first stage:** Stage 1, after one final repository-wide import/reference scan; it is small, isolated, and does not alter domain behavior when the absence of external consumers is accepted.
9. **Items requiring your decision:** whether to remove the three empty placeholder files; whether any external scripts consume the legacy `recordSyncRun`/routing methods or connector registry exports; whether to prioritize moving connector secret/schedule business logic into a service; whether legacy export query compatibility remains a supported API; whether the lead-detail presentation variants are intentionally distinct.

## Evidence limitations

This is a static audit, not a runtime verification. No tests, lint, typecheck, build, database query, or generated-client command was run, in keeping with the read-only audit instructions. Search cannot prove absence of imports from external/private automation, reflection-based code, or future planned work. Recommendations marked `INVESTIGATE` should remain in place until those dependencies are checked.

## Follow-up note — 2026-11-23

The approved source cleanup stage removed `src/services/assignment.service.ts`, `src/hooks/index.ts`, `src/jobs/index.ts`, and `src/utils/index.ts`. The remaining cleanup recommendations in this audit were not implemented as part of that approved stage. The original inventory, findings, and recommendations above are preserved as the audit snapshot.
