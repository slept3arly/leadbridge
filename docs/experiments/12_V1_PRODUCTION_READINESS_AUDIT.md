# LeadBridge V1.0 Production Readiness Audit

**Audit date:** 2026-10-10  
**Repository:** `/home/lenovowsl/Development/Projects/leadbridge`  
**Branch:** `main` (tracking `origin/main`)  
**Assessment:** **Not ready for V1.0 sign-off.** One confirmed high-severity data-loss defect contradicts the documented delete contract. Several medium-severity access, export, ingestion, and operational weaknesses also need remediation or explicit acceptance before release.

## Executive summary

The application has a sound basic shape: App Router pages use server-side session checks, every API route in the current inventory is wrapped by an authentication/role/permission guard, lead and nested-resource reads generally scope Sales access to the assigned user, and the database has useful uniqueness constraints for lead numbers and connector source references. Public signup is disabled. The current source also avoids returning REST connector secrets in the Admin page's serialized configuration.

The main release risks are that the lead DELETE path permanently removes CRM history despite the documented soft-delete contract; Sales can redirect follow-ups to another Sales user, exposing a limited amount of an otherwise unauthorized lead in task views; lead CSV exports allow spreadsheet formulas; and the REST connector can make server-side requests to arbitrary configured and response-provided URLs. Sync execution is synchronous inside web requests, has no stale-lock recovery, and silently drops individual Gmail message-fetch failures. Scheduled connector execution has no scheduler configuration in this repository, so it depends on deployment setup that was not available to inspect.

No production database, deployment account, live connector, or hosting configuration was available. Runtime behavior such as production cookie attributes, external cron authentication, database backup/restore, alerting, function time limits, and real query plans remains unverified. No timings or capacity claims are made.

### Executive summary table

| Priority | Finding | Category | Evidence | Recommended action |
|---|---|---|---|---|
| P0 | DATA-001 — Lead DELETE permanently cascades related CRM history | Data integrity | `leadService.remove()` invokes `tx.lead.delete()`; schema cascades notes, follow-ups, events, attachments | Restore soft-delete behavior or explicitly redesign and protect permanent deletion before launch |
| P1 | SEC-001 — REST connector permits server-side requests to arbitrary/internal URLs | Security / SSRF | URL schema only checks syntax; `fetch()` follows redirects; `NEXT_URL` accepts response-provided URL | Restrict protocols/destinations, validate every page URL and redirect, and enforce network egress policy |
| P1 | SEC-002 — Sales can assign a follow-up to another user and disclose lead summary data | Authorization / privacy | Follow-up create/update accepts client `assignedUserId`; task queries expose associated lead summary | Derive/validate assignee server-side and scope task lead serialization |
| P1 | SEC-003 — CSV export is vulnerable to formula injection | Security / export | CSV quoting does not neutralize `=`, `+`, `-`, `@`, tab, or CR prefixes | Neutralize spreadsheet formulas and test every exported field type |
| P1 | REL-001 — Interrupted sync can strand a connector lock and ACTIVE run | Resilience | DB lock has no expiry/lease; unlock is only in normal request `finally`; no worker recovery | Add lease-based recovery and stale-run reconciliation; test process termination |
| P1 | OPS-001 — Scheduled sync depends on unverified external cron configuration | Operations | Endpoint exists; repository has no cron/deployment workflow | Verify and document deployed trigger, authentication, timeout, retries, and alerting before relying on schedules |
| P1 | REL-002 — Gmail fetch drops individual message errors without failing the run | Ingestion reliability | `fetchMessage()` catches every error and returns `null`; `fetchBatch()` ignores rejected/missing results | Preserve failed message IDs and make partial success visible/retryable |
| P1 | PRIV-001 — Raw connector payloads and personal data are retained and logged broadly | Privacy / operations | Unmatched messages store raw payloads; runtime logs payload previews, names, emails | Minimize payload fields, redact logs, define retention/deletion, and restrict access |
| P2 | PERF-001 — Sales dashboard derives distinct activity counts by loading matching rows into Node | Performance hypothesis | Six dashboard metrics each query `ActivityEntry.findMany()` then build a `Set` | Benchmark representative datasets, then replace with SQL distinct aggregation if material |
| P2 | PERF-002 — Exports are unbounded and assembled fully in memory | Performance / availability | Chunk loop has no row/range cap and accumulates all CSV strings before response | Measure export size/time/memory and add streaming or explicit bounds if needed |
| P2 | DATA-002 — Follow-up updates can partially bypass lifecycle/audit rules | Data integrity | Generic update permits assignee changes; some field-only update paths do not write events | Validate assignees, use compare-and-update state transitions, and audit material changes |
| P3 | DATA-003 — Lead has a redundant composite index | Database maintainability | `@@index([connectorId, sourceReferenceId])` duplicates the unique index | Remove only through a reviewed migration after validating deployed schema and query plan |

Finding details and evidence follow.

## Scope and methodology

### Baseline

- Branch and worktree were recorded before audit. The checkout is `main...origin/main` and has numerous pre-existing modified and untracked frontend, service, and documentation files. Those changes were preserved and audited as part of the current working tree; this report does not claim that the working tree matches the committed branch.
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `db:generate`, `db:migrate`, `db:push`, and `seed:leads`.
- Runtime versions found in configuration: Next.js `16.2.10`, React `19.2.4`, Prisma / `@prisma/client` `^7.8.0`, Better Auth `^1.6.23`; Node observed in the audit environment: `v24.18.0`; pnpm `12.4.2`.
- Current inventory: **38 API route modules**, **20 service modules**, **19 Prisma models**, **16 migration directories**, and **0 configured automated test files/test-runner scripts**. Two manual smoke scripts exist. `scripts/phase3a-smoke.ts` issues destructive `deleteMany` calls by name prefix, so it must only run against a disposable test database.
- CI/deployment files: no `.github` workflows, `vercel.json`, Dockerfile/Compose file, or repository scheduler configuration was found. `next.config.ts` exists. This does not prove what is configured in the hosting account.
- `.env.example` contains placeholders only. The local `.env` was not read or reproduced in this report. No committed credential value was identified in the inspected source/configuration.

### Commands and checks

- Repository and file inventory (`git status`, `git branch`, `rg --files`, `find`, `wc`-style counts), source searches, and line-numbered reads of auth/session helpers, API handlers, services, connectors/runtime, schema/migrations, frontend pages/components, package/configuration, and canonical docs.
- Queried the existing `graphify-out/graph.json` as a navigation aid. It reports 1,215 nodes but is stale: it refers to a removed/nonexistent `audit-logs` route. All findings were validated in current source.
- `pnpm typecheck` — **passed** (`tsc --noEmit`).
- `pnpm lint` — **passed** (`eslint .`).
- Build, dependency audit, smoke scripts, database inspection, and external-service tests — **not run**. Build may write generated output outside the one permitted report file; smoke scripts access/mutate database records; no isolated database or production configuration was established. No tests exist to run through a package test command.
- No migration, seed, load test, or destructive operation was executed. No application source/configuration/dependency/lockfile/documentation other than this requested report was changed intentionally.

### Limits

This is static source/configuration review plus typecheck and lint. It does not establish production environment values, TLS termination, proxy headers, host-level network egress, database availability, actual schema drift, restore readiness, production query plans, monitoring/alert delivery, or provider API behavior. Severity is based on reachable code paths and the stated role boundaries, not an attempted attack against a live service.

## Architecture and production execution model

LeadBridge is a single Next.js App Router application. Pages call Prisma/services directly in server components; API route handlers wrap service and Prisma operations with `withApiAuthorization()` or `withPermissionAuthorization()`. Prisma uses the `pg` adapter and `DATABASE_URL`. Auth is Better Auth with a Prisma adapter and email/password credentials; public sign-up is disabled. The Prisma schema has 19 models and uses PostgreSQL relations, indexes, and enum types.

Connector runs are executed synchronously by API handlers or by `POST /api/scheduler/trigger`. `ConnectorRuntime.execute()` fetches all connector payloads, processes them serially, writes leads/events, and updates sync history. There is no durable job queue, separate worker, persisted retry queue, or shutdown recovery implementation in `src/jobs/index.ts` (empty). The scheduler endpoint must be called externally. Repository configuration does not provide that trigger.

## Authentication and session security

- Protected Admin and Sales layouts call `requireSession()` and verify current user role, active state, banned state, and deletion state. API authorization obtains Better Auth's session on each request and checks the same account conditions. The route guard, not the proxy, is authoritative.
- `src/proxy.ts` only checks whether a cookie with a Better Auth session-cookie name exists to redirect page navigation. It does not grant protected data access. This is acceptable as a redirect convenience because layouts and APIs validate the session.
- Better Auth is configured with `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, credentials, disabled public sign-up, and the Admin plugin. Better Auth in the installed version rejects its default/missing secret in production and enables auth rate limiting by default in production. The app does not explicitly configure cookie options, session lifetime, a production environment validator, or rate-limit storage. Library defaults therefore need to be verified in the actual hosting environment; its default rate-limit storage is per-process memory absent secondary storage.
- No direct auth bypass was found in the inspected page/API paths. Session revocation after deactivation was not demonstrated as stale: each app guard checks the user object returned by a fresh `getSession()` call, but deployed cache/database consistency was not tested.
- Password reset, self-service account registration, and email verification workflows are not present in the application flow. Admin provisioning and password changes use Better Auth APIs.

### Authentication conclusion

No confirmed authentication bypass was found. Verify production secret entropy, HTTPS/base URL, cookie flags, trusted proxy/client-IP configuration, and multi-instance rate-limit behavior in staging. Do not infer cookie behavior solely from this repository because it is delegated to Better Auth defaults and hosting URL configuration.

## API authorization matrix

All 38 route modules under `src/app/api` were enumerated. Every current handler is wrapped in an auth/role/permission helper except the Better Auth catch-all, which is the auth framework endpoint. “Sales scoped” means the handler/service filters by the current Sales user's assigned lead or owned follow-up; Admin can operate across records unless otherwise stated.

| Route | Methods | Required access | Ownership / operation summary |
|---|---|---|---|
| `/api/auth/[...all]` | Better Auth methods | Auth framework policy | Login/session lifecycle; public signup disabled in auth config |
| `/api/leads` | GET, POST | Authenticated; create requires `CREATE_LEAD` | Listing scopes Sales to assigned leads; create validates permission |
| `/api/leads/[id]` | GET, PATCH, DELETE | Authenticated; DELETE requires `DELETE_LEAD` | Service scopes Sales to assigned lead; delete is permanent (DATA-001) |
| `/api/leads/[id]/assign` | POST | ADMIN | Assign/unassign; service checks active SALES assignee |
| `/api/leads/[id]/activities` | GET, POST | Authenticated; POST SALES only | GET and POST enforce assignment for Sales |
| `/api/activities/[id]` | PATCH | Authenticated | Requires assigned lead; updates interaction entry but does not add a change event |
| `/api/leads/[id]/notes` | GET, POST | Authenticated | Note service checks assignment for Sales |
| `/api/notes/[id]` | PATCH, DELETE | Authenticated | Note service checks assignment and author/day restrictions for Sales |
| `/api/leads/[id]/follow-ups` | GET, POST | Authenticated | Lead access checked; caller-supplied assignee creates cross-user exposure (SEC-002) |
| `/api/follow-ups/[id]` | PATCH, DELETE | Authenticated | Lead access checked; PATCH accepts arbitrary assignee; delete is creator/Admin restricted |
| `/api/follow-ups/[id]/complete` | POST | Authenticated | Lead access checked; completion, optional activity and next follow-up are transactional |
| `/api/leads/[id]/details` | GET | Authenticated | Lead check is included in `Promise.all`; sibling queries run directly but their results are returned only if access succeeds |
| `/api/dashboard` | GET | ADMIN or SALES | Chooses Admin aggregate or current-user Sales aggregate from session role/id |
| `/api/export` | GET | ADMIN or Sales with export privilege for leads | Sales lead export is scoped in service; other types are Admin-only |
| `/api/reports` | GET | ADMIN | Aggregate reports |
| `/api/users` | GET, POST | ADMIN | User listing/provisioning |
| `/api/users/[id]` | PATCH | ADMIN | Role, privilege, active state, and password changes |
| `/api/providers` | GET, POST | ADMIN | Provider management |
| `/api/providers/[id]` | PATCH, DELETE | ADMIN | Provider update/deactivation |
| `/api/lead-sources` | GET, POST | Authenticated for GET; ADMIN for POST | Lead source reads expose active source metadata to Sales |
| `/api/lead-sources/[id]` | DELETE | ADMIN | Deactivates source, not lead data |
| `/api/connectors` | GET, POST | ADMIN | Connector configuration inventory/create |
| `/api/connectors/[id]` | DELETE | ADMIN | Deletes connector and cascading sync history; lead connector FK is SetNull |
| `/api/connectors/[id]/settings` | PATCH | ADMIN | Connector scheduling/configuration and health reset |
| `/api/connectors/[id]/sync` | POST | ADMIN | In-process manual sync with DB lock |
| `/api/providers/connectors/test` | POST | ADMIN | Tests stored Gmail/REST configuration; REST can target arbitrary URLs (SEC-001) |
| `/api/providers/gmail` | GET | ADMIN | Lists configured Gmail account metadata, not credentials |
| `/api/providers/parsers` | GET | ADMIN | Parser management metadata |
| `/api/parsers` | GET | ADMIN | Parser list |
| `/api/parsers/preview` | POST | ADMIN | Parses caller payload, returns parsed fields; logs exceptions server-side |
| `/api/providers/parser-requests` | GET, PATCH | ADMIN | Parser-request management; sample message data may be personal data |
| `/api/providers/routing-rules` | GET, POST, PATCH | ADMIN | Routing configuration; validates schema at route layer |
| `/api/providers/routing-rules/[id]` | DELETE | ADMIN | Deletes routing rule |
| `/api/providers/unmatched` | GET, PATCH | ADMIN | Unmatched email queue includes raw previews/payload-derived data |
| `/api/providers/sync-runs` | GET | ADMIN | Lists recent sync history, optionally connector-filtered |
| `/api/settings` | GET, PATCH | ADMIN | System settings |
| `/api/resync` | POST | Authenticated | Can request cache revalidation for caller's aggregate views |
| `/api/scheduler/trigger` | POST | ADMIN | Runs all due connectors sequentially or a selected connector |

**Cross-user conclusion:** Lead detail, notes, and activities have ownership checks. The follow-up assignee weakness (SEC-002) is the confirmed indirect disclosure path found. No Sales-to-Admin role mutation path was found in these routes. Authorization checks are not uniformly duplicated in service methods (e.g. provider services trust Admin-only callers), so new callers must preserve route guards.

## Data leakage and secret handling

- Admin connector server pages select database configuration but pass a separately constructed `SafeConnectorConfiguration` to client components. Credential values, configured headers, query params, and request body are omitted; configured booleans and limited names are sent. No direct config-secret serialization was found there.
- REST API key query values are masked when `RestDocument.url` is built, but masking is heuristic by query parameter name. Sensitive values embedded in URL path, arbitrary query names, custom headers with nonstandard secret names, request bodies, error messages, and the `Connector.configuration` database value are not intrinsically encrypted or redacted. Current admin UI/API avoids returning the config object wholesale; maintain that invariant in future endpoints.
- REST `RestDocument.responseBody` and parsed payload are materialized in memory; logs currently record selected metadata and payload previews. Runtime logs include email addresses, lead names, and up to 500 characters of connector payload in some error paths (`src/runtime/connector-runtime.ts:164-170, 179-182, 222-226, 260-263`). Those values can include personal or customer-supplied data and are copied to the configured Pino sink without a redaction hook.
- Unmatched Gmail records store sender, subject, a body/snippet preview, and full raw payload in the database (`src/runtime/routing-engine.ts:67-90`; schema `UnmatchedEmail.rawPayload`). There is no retention/cleanup job found for raw payloads, unmatched records, sync runs, or activity history. Lead detail selects `rawPayload` and `customFields` (`src/services/lead.service.ts:28-45`); whether a custom parser populates sensitive material is connector-specific.
- Sync errors are stored in `Connector.lastError` and `ConnectorSyncRun.errorMessage` and shown in Admin screens/exports. Error text can contain remote endpoint details; avoid credentials and full remote bodies in thrown messages.
- `src/app/api/providers/connectors/test/route.ts` returns diagnostic status/email and selected metadata, not REST response bodies or credentials. No production-reachable mock/debug route was found in the current route inventory.

## Input validation and attack surface

### SEC-001 — REST connector is a server-side request primitive

- **Category:** Security — SSRF and unsafe external request target
- **Severity:** Medium
- **Confidence:** Confirmed code defect; exploit scope is Admin-only and response data is not returned
- **Affected files:** [src/lib/validation.ts] (REST URL schema around lines 178–190); [src/connectors/rest/rest-client.ts] (URL construction lines 88–99; fetch lines 17–27; next URL handling around 105–116 and 240–250); [src/app/api/providers/connectors/test/route.ts] (lines 53–68); [src/app/api/connectors/[id]/sync/route.ts] (lines 17–25, 37–65)
- **Evidence:** `baseUrl` validation uses only `z.string().url()` and imposes no `https:` protocol or destination policy. REST `fetch()` has default redirect-following behavior. With `NEXT_URL` pagination, a response-provided next URL is used directly; it is not checked against the configured origin. Configurable methods include POST, PUT, PATCH, and DELETE.
- **Failure/exploit scenario:** An Admin (or a compromised Admin session) configures a connector/test to address loopback, private, link-local, or cloud metadata services, or a trusted endpoint responds with a next-page URL targeting another host. The server makes the request from its network. The test route returns limited diagnostics rather than response content, which limits direct data exfiltration, but status/size differences and non-GET methods still enable blind probing or state-changing requests. Redirects and user-controlled response pagination enlarge the target surface.
- **Impact / affected roles and data:** Availability/integrity of internal services; potential exposure of metadata or network reachability to an Admin. No unauthenticated or Sales exploit path found.
- **Recommended fix:** Require HTTPS except explicit development allowlists; parse and normalize hostnames; reject loopback, private, link-local, multicast, IPv4-mapped IPv6, and metadata destinations after DNS resolution; revalidate redirects and every `NEXT_URL`; preferably disable redirects or enforce same-origin; block unsafe methods unless specifically required; apply outbound network egress restrictions. Do not assume a one-time hostname check prevents DNS rebinding.
- **Effort:** Medium/Large.
- **Dependencies / regression risks:** Legitimate private enterprise APIs may need an explicit operator-managed allowlist; pagination APIs can use separate page hosts, so support them deliberately.
- **Verification plan:** Safe local tests for URL normalization, IPv4/IPv6/private/link-local/metadata rejection, redirect-to-private rejection, cross-origin next URL rejection, and allowed public HTTPS paging; verify with a mock server and no live internal probing.

### SEC-002 — Follow-up assignment can disclose lead summaries across Sales users

- **Category:** Authorization / privacy / data integrity
- **Severity:** Medium
- **Confidence:** Confirmed code defect
- **Affected files:** [src/lib/validation.ts] (follow-up schema lines 43–50, especially `assignedUserId`); [src/services/follow-up.service.ts] (create lines 74–103; update lines 176–247); [src/app/api/leads/[id]/follow-ups/route.ts] (POST lines 12–21); [src/services/attention.service.ts] (lines 64–101, 104–143); [src/services/follow-up.service.ts] (task listing lines 56–71)
- **Evidence:** A Sales user can create a follow-up on an assigned lead and supply another user's `assignedUserId`; create stores that ID without checking actor role or validating active Sales role. PATCH can change the assignee under the same ownership guard. Task/dashboard queries select follow-ups by `assignedUserId` and return lead name, company, phone, title, and priority. The target user need not own the lead.
- **Failure/exploit scenario:** Sales A creates/changes a follow-up on A's lead, assigning it to Sales B. B's tasks/dashboard now returns a subset of A's lead data despite the normal lead API denying B's access to the lead.
- **Impact / affected roles and data:** Horizontal disclosure of lead contact summary and unauthorized task manipulation between Sales users.
- **Recommended fix:** For Sales, force `assignedUserId` to the current actor and reject reassignment; if Admin reassignment is supported, validate the target is an active Sales user. Ensure task responses only include lead summaries when caller can access the lead, or adopt an explicit shared-follow-up policy.
- **Effort:** Small/Medium.
- **Dependencies / regression risks:** Clarify whether follow-ups are intended to be transferable across owners; preserve Admin workflows if reassignment is needed.
- **Verification plan:** API tests for Sales creating/updating a follow-up to another Sales ID, including access to task/dashboard endpoints; verify Admin behavior and invalid/deactivated assignees.

### SEC-003 — CSV exports allow spreadsheet formula injection

- **Category:** Security — exported data handling
- **Severity:** Medium
- **Confidence:** Confirmed code defect
- **Affected files:** [src/services/export.service.ts] (lines 9–19; lead fields at 70–96; other exports at 99–160); [src/app/api/export/route.ts] (authorization and response lines 6–20, 60–66)
- **Evidence:** `escapeCsv()` quotes delimiter/newline characters and escapes quotes but does not neutralize cells whose first meaningful character is `=`, `+`, `-`, `@`, tab, CR, or formula whitespace. Lead values originate from users and connector payloads. Lead export is available to Admin and Sales with `EXPORT_LEADS`; other export categories are Admin-only.
- **Failure/exploit scenario:** An attacker or untrusted connector supplies a lead name/company/requirement beginning with a spreadsheet formula. An authorized user exports and opens the CSV in spreadsheet software; the cell can execute a formula or external link depending on client policy.
- **Impact / affected roles and data:** Export recipient workstation/session context; lead and user data carried by CSV.
- **Recommended fix:** Apply a spreadsheet-safe cell encoding policy before CSV quoting (including leading control/whitespace handling), document any compatibility tradeoff, and apply it to every field, including sync error strings and report labels.
- **Effort:** Small.
- **Dependencies / regression risks:** Prefixing an apostrophe changes literal display for some consumers; define and test behavior in target spreadsheet software.
- **Verification plan:** Generate exports with each dangerous prefix, whitespace/control prefix, embedded quotes/newlines, and normal negative numeric values; verify no formula executes and CSV columns remain intact.

## Data integrity and destructive operations

### DATA-001 — Lead delete permanently removes the lead and cascaded history

- **Category:** Data integrity / accidental deletion
- **Severity:** High
- **Confidence:** Confirmed
- **Affected files:** [src/services/lead.service.ts] (lines 433–439); [prisma/schema.prisma] (Lead relations and `isDeleted` fields lines 307–324; cascade relations ActivityEvent, Note, FollowUp, Attachment lines 340–435); [src/app/api/leads/[id]/route.ts] (DELETE lines 32–41)
- **Evidence:** `remove()` authorizes a user with `DELETE_LEAD`, checks access, then calls `tx.lead.delete()`. Database relations cascade-delete activity events/entries, notes, follow-ups, and attachments. The schema's `isDeleted`, `deletedAt`, and `deletedById` fields are not set by this path. There is no restore endpoint in the API inventory.
- **Failure scenario:** An Admin or Sales Senior confirms a delete expecting the documented soft-delete behavior. The lead and audit/history records are permanently removed from the live database; restoration requires an external database backup and loses later changes.
- **Impact / affected roles/data:** Core CRM integrity and audit trail; customer contacts, notes, interactions, follow-ups, and attachment metadata.
- **Recommended fix:** Implement transactional soft deletion with actor/time metadata and a restore path, or change product contract and add a separately authorized, strongly confirmed permanent purge with retention controls. Do not call this endpoint soft delete until behavior matches.
- **Effort:** Medium.
- **Dependencies / regression risks:** Existing smoke script explicitly expects hard deletion; update that expectation only in the later implementation pass and coordinate data-retention semantics.
- **Verification plan:** Integration tests prove ordinary delete retains lead/event/note/follow-up rows and hides them from normal views; restore recovers the original relationships; permanent purge requires the explicit purge permission/process.

The database enforces unique lead numbers and a unique `(connectorId, sourceReferenceId)` pair, so concurrent connector imports with a non-null source reference are protected. `LeadService.create()` also catches Prisma P2002. The non-unique `@@index([connectorId, sourceReferenceId])` duplicates the index backing the unique constraint (DATA-003); remove only with a migration after checking the deployed schema and actual query plan. Foreign-key actions are generally explicit. User deactivation does not automatically reassign that user's leads; they remain stored but inaccessible to that inactive Sales account until an Admin reassigns them.

## Database and query performance

### Observed query paths and useful measurements

| Flow | Main code/query behavior | Main concern | Measurement to collect |
|---|---|---|---|
| Admin dashboard | 14 parallel count/groupBy/list queries in `dashboardService.admin()`; cached in Admin page for 60s | Multiple full aggregate scans and activity-entry materialization; likely acceptable only after measured | `EXPLAIN (ANALYZE, BUFFERS)` for top count/groupBy queries on anonymized staging data; dashboard DB span and total render latency |
| Sales dashboard | 15 parallel operations; six activity metrics call `findMany()` and build a JS `Set` | Rows may grow with historical activity; repeated scans and Node memory proportional to matching events | Per-query row count, duration, bytes, and heap on representative activity volume; compare SQL distinct aggregates |
| Lead listing/search | Page query + count in parallel, then up to two event/entry raw queries for page IDs; 5-field case-insensitive contains search; page size capped at 100 | `ILIKE '%term%'`/contains cannot use ordinary B-tree effectively; unbounded term length and arbitrary large page number; deep OFFSET | Staging query plans for common filters/sorts and increasing page depth; request duration and rows scanned; do not add trigram/full-text indexes without plan/latency evidence |
| Assignment/update | Ownership/user lookup then transactional update/event insert | Check-then-update can race with reassignment; transaction isolation is default | Concurrent reassignment/update test and transaction query duration |
| Reports | Several counts/groupBy queries; monthly trend uses raw SQL aggregation | Potential repeated full-history aggregation | Plans for each report query on date ranges and all-time; dashboard/report database spans |
| Connector sync | Per payload, routing rule list query, parser lookup, duplicate candidate scan, lead insert transaction, event insert; mostly serial | Repeated routing lookup per record, duplicate pre-query, and long web request | Records per run, query count, duration per stage, API duration vs host function limit, partial-failure count |
| Sync history | 100 runs per admin listing, 5 recent dashboard runs, export loops over all records | History has no cleanup/retention | Table growth, list/export duration, retention requirement |

Existing indexes generally reflect known lead filters (assignment, status/deletion, dates, follow-ups), child relations, and sync-history order. No query plan could be run because no staging database was verified; no new index is recommended from static evidence alone. The standalone `email`/`phone` B-tree indexes do not accelerate the five-field substring search, but the repository documents that current search is intended for a modest dataset. Measure first. The duplicate unique-backed source-reference index is the only clear schema redundancy.

No data retention/cleanup job was found for activity events, sync runs, unmatched raw payloads, or soft-deleted-user rows. Set a business/legal retention policy before production; avoid indiscriminate cleanup because activity records are the audit history.

## Frontend performance

- Protected data pages are primarily server components; page results are handed to client-side dashboard/table/modal components. Lead list queries are paginated at the server, with a 100 row maximum. I found no evidence of a broad client-side full-lead load.
- The lead details API returns a selected lead including `customFields` and `rawPayload`, all notes, all follow-ups, and up to 100 activity events. Notes and follow-ups are unbounded. This can serialize unnecessary history and raw connector content for each details modal; measure payload bytes and modal open time before adding pagination or narrowing fields.
- The working tree contains substantial uncommitted page/component changes and a deleted `lead-table-controls.tsx`; the impact of those UI changes cannot be attributed to the committed baseline. Typecheck/lint passed on the current working tree.
- No browser performance trace, production bundle analysis, Web Vitals data, or device-specific profiling was available. No frontend bottleneck is classified as measured. If profiling shows slow interactions, first measure modal serialized payload, client JS transferred, route render time, and repeated fetches before refactoring component boundaries.

## API/service/database performance

### PERF-001 — Sales dashboard loads activity entries into Node for distinct counts

- **Category:** Performance hypothesis
- **Severity:** Medium
- **Confidence:** High for implementation; performance impact unmeasured
- **Affected files:** [src/services/dashboard.service.ts] (lines 185–193 and 211–298)
- **Evidence:** A helper performs `activityEntry.findMany()` for each of six metrics, selects each event's lead ID, and deduplicates in a JavaScript `Set`. These queries run in parallel with the rest of the dashboard.
- **Scenario/impact:** As a user's historical activity grows, repeated matching rows are fetched and materialized on every cache miss, increasing database/network/Node memory work. User-specific cached dashboard data reduces frequency but is still invalidated after mutations.
- **Recommended action:** Benchmark with representative activity volume. If material, use SQL `COUNT(DISTINCT event.leadId)` with corresponding filters, or one grouped query that produces the metrics.
- **Effort:** Medium. Regression risk: carefully preserve the current metric semantics (one lead per activity category, not one event).
- **Verification:** Compare response values and query plans/latency/rows transferred for a fixed anonymized dataset.

### PERF-002 — Full exports accumulate without a row or byte limit

- **Category:** Performance / availability hypothesis
- **Severity:** Medium
- **Confidence:** Confirmed implementation; production impact unmeasured
- **Affected files:** [src/services/export.service.ts] (lines 21–40; route types at 70–160); [src/app/api/export/route.ts] (lines 22–67)
- **Evidence:** `exportInChunks()` fetches pages of 1,000 but appends every output line to an in-memory array and finally joins it into another complete string. There is no maximum date range, row count, byte limit, cancellation, or streaming response.
- **Scenario/impact:** Concurrent large Admin exports can consume substantial app memory and hold database connections; long exports may exceed hosting request duration.
- **Recommended action:** Measure data volumes and peak memory on staging; use a streaming response or explicit maximum/export job if the observed volume/function limits justify it. Validate date parsing and cap filters.
- **Effort:** Medium/Large. Regression risk: streaming changes affect download errors and CSV formatting.
- **Verification:** Benchmark representative and maximum allowed export volumes under the actual host's memory/time limits; verify cancellation releases database work.

## Connector, sync, and ingestion resilience

### REL-001 — Process interruption has no lock lease or sync recovery

- **Category:** Reliability / availability
- **Severity:** Medium
- **Confidence:** Confirmed code defect
- **Affected files:** [src/services/execution-lock.service.ts] (lines 10–55); [src/app/api/connectors/[id]/sync/route.ts] (lines 30–35, 91–93); [src/services/scheduler.service.ts] (lines 127–137); [src/runtime/connector-runtime.ts] (lines 68–69)
- **Evidence:** Lock acquisition sets `isRunning=true`, `lockedAt`, and `lockedBy` only when `isRunning=false`. There is no expiry or compare-and-swap reclaim on age. Release is in a `finally` block for normal manual requests; abrupt process termination skips it. A sync run is created as ACTIVE before connector work; only normal runtime completion updates it.
- **Scenario/impact:** Deployment termination, process crash, or host timeout during sync leaves the connector locked and its run ACTIVE indefinitely. Scheduled/manual retries then skip or return 409 until an Admin notices and force-releases it. Partial leads may already have been committed because records are processed one by one.
- **Impact / affected roles/data:** Connector availability, incomplete ingestion, confusing operational history; CRM records created before interruption remain.
- **Recommended fix:** Use a renewable lease with expiry and fencing token, reclaim stale ownership safely, reconcile stale ACTIVE run records, and persist progress/idempotency. Ensure host request-duration limits are lower than or compatible with work limits. A queue is not inherently required, but the current synchronous execution must be validated against the chosen host.
- **Effort:** Medium/Large.
- **Dependencies / regression risks:** Lease expiry must not allow overlapping slow runs; use fencing/ownership token and bounded connector timeouts.
- **Verification plan:** Terminate a staging sync mid-fetch and mid-write; verify automatic recovery, no overlapping execution, clear partial status, and idempotent rerun.

### REL-002 — Gmail message fetch failures are silently omitted

- **Category:** Ingestion reliability / data integrity
- **Severity:** Medium
- **Confidence:** Confirmed
- **Affected files:** [src/connectors/gmail/gmail-client.ts] (lines 197–218, 220–253); [src/connectors/gmail/gmail-connector.ts] (lines 98–143)
- **Evidence:** `fetchMessage()` catches all errors and returns `null`; `fetchBatch()` ignores both rejected results and fulfilled `null` values. The connector cannot report which IDs failed, so the top-level sync can appear successful despite incomplete fetches. Gmail profile `historyId` is read/logged, while `lastHistoryId` comes from stored connector configuration; no code found that advances that cursor after successful processing.
- **Scenario/impact:** A message that temporarily fails fetch is not represented in payloads or sync failure counts. In unread mode it may be retried while still unread, but there is no acknowledgement/reconciliation guarantee. In history mode a stale cursor can cause repeated history pages and duplicates (the lead uniqueness key mitigates duplicate lead rows where applied) and does not establish a durable checkpoint.
- **Recommended fix:** Return per-message success/failure details; count and persist failed IDs; make partial run status explicit; advance Gmail history checkpoint transactionally only after fetched messages are durably accounted for; define expired-history recovery and whether messages are marked processed.
- **Effort:** Medium/Large.
- **Dependencies / regression risks:** Gmail history cursors and message-ID idempotency must be tested with retries and expired history tokens.
- **Verification plan:** Mock transient/permanent `messages.get` failure, repeated page tokens, an expired history cursor, and process interruption; verify no silent success or lost checkpoint.

Other connector observations:

- REST timeout is configurable from 100 ms to 300,000 ms; retry count to 10; max pages to 1,000; page size to 1,000. Those independent maxima permit very long request execution and large memory accumulation. `fetchAll()` reads each entire response with `response.text()` and collects all records/documents before processing. No response body byte/record cap exists. This is a strong resource-exhaustion risk needing host-specific validation, but was not promoted to a separate release finding because only Admin can configure it and the real host limits are unknown.
- REST retries `429`/5xx/network/timeouts and Gmail retries selected quota/mailbox/transient errors. REST `Retry-After` is parsed as an integer number of seconds without a cap; a large value can create a very long wait. Gmail uses `Promise.allSettled` batches of 10, but failures are dropped as above.
- Payloads are processed serially, limiting DB bursts but increasing total run duration. A duplicate lookup and routing-rule query are repeated for each payload. A non-null connector source reference is backed by a unique constraint, protecting concurrent duplicate inserts.
- Each imported lead create and its CREATED event are transactional, then runtime writes a second IMPORTED event afterward in a separate operation. Failure of the second event can leave a created lead while the payload is counted as a processing failure; this is a consistency/audit concern to cover in transaction design.
- Manual sync and scheduler use `ConnectorRuntime`; scheduler results are executed sequentially and there is no durable work queue. No shutdown hook or cancellation propagation was found.

## Caching and invalidation

- Dashboard and attention caches use user-specific cache keys for Sales (`userId` included) and a distinct Admin key; pages call `requireSession()` before using user-specific results. No cross-user cache key leak was found.
- Admin dashboard data is cached for 60 seconds and invalidated through the Admin dashboard tag. Settings use a global settings tag. Sales dashboard/attention data are user-keyed and mutation helpers invalidate the actor's own aggregate tags plus Admin dashboard. Mutations affecting another Sales user's lead (Admin reassignment) may leave the previous/new assignee's cached aggregate stale unless the service invalidates those IDs; inspect assignment/deactivation workflows during remediation. This is a correctness concern, not a demonstrated confidentiality leak, because lead/list APIs remain uncached and ownership-checked.
- CRM lead details, notes, follow-ups, and activities are read fresh in services per `src/lib/cache-tags.ts` comments; this matches the intended freshness requirement.
- Cache invalidation failures are logged and swallowed after a warning. The response can succeed with stale aggregate views until revalidation; no durable invalidation retry exists. Verify behavior in the deployed Next.js cache backend.

## Deployment, monitoring, backups, and recovery

### OPS-001 — Scheduled connector execution requires an external trigger

- **Category:** Operations / integration availability
- **Severity:** Medium
- **Confidence:** High that source requires external trigger; actual deployment unverified
- **Affected files:** [src/app/api/scheduler/trigger/route.ts] (lines 5–33); [src/services/scheduler.service.ts] (lines 62–114); repository has no scheduler/CI deployment file
- **Evidence:** Schedules are discovered only when `POST /api/scheduler/trigger` executes; there is no process timer or background worker. The route requires an ADMIN user session. No `vercel.json`, CI workflow, or other repository scheduler configuration was found. The docs also state that an external cron must be configured.
- **Scenario/impact:** If a V1 deployment relies on scheduled imports but no external job calls this authenticated endpoint, enabled scheduled connectors never run. A cron service without valid session authentication cannot call it; a static session cookie is not a suitable scheduler credential.
- **Recommended action:** Before release, identify the actual scheduler and configure a dedicated, rotated secret or provider-native signed cron authentication; use constant-time comparison, restrict method/path, and return bounded execution work. Document timeout/retry/overlap behavior and alert on missed/failed runs. Do not expose an unauthenticated trigger.
- **Effort:** Medium.
- **Dependencies / regression risks:** Hosting platform and request-duration limit determine whether this can remain synchronous.
- **Verification plan:** In staging, prove a scheduled run fires without a user session, rejects unauthorized callers, handles overlap, survives timeout, and emits an alert on repeated failures.

- Pino emits structured logs, but there is no repository log destination, retention, access policy, alerting, or redaction configuration. Runtime personal-data logging is detailed in PRIV-001.
- No health/readiness route, deployment migration pipeline, rollback automation, backup schedule, or restore procedure was verifiable in executable repository configuration. `docs/04_ADMINISTRATION_AND_OPERATIONS.md` advises regular `pg_dump` and describes a manual stuck-lock release, but documentation is not proof these are configured or tested.
- Prisma production client uses one process-local global instance only outside production; pool sizing/max connections is not set in source. `pg` adapter pool behavior and Neon pooling configuration must be verified against the production connection string and server concurrency.
- `pnpm db:migrate` runs `prisma migrate dev`, which is a development workflow; there is no deploy script using `prisma migrate deploy`. Establish a release migration command/order and tested rollback/forward-fix procedure before deployment. Do not run `db:push` in production.
- Environment requirements are only partially represented by `.env.example`; no startup schema validates all required production variables. Better Auth's installed library validates missing/default secret in production, but entropy below its recommended threshold only warns. Verify actual `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, Gmail credentials, `NODE_ENV`, TLS, proxy headers, and `LOG_LEVEL` without printing values.

## Testing and CI coverage

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- No automated test framework or test files were found; no `test`/`test:e2e` package script exists. The two manual smoke scripts are not CI coverage and may mutate data.
- Production build was not run because it writes build artifacts and the user restricted changes to the one report file. Dependency audit was not run because no existing repository command/scanner is configured; no package install/update was performed.
- Required new coverage: role/ownership matrix for every route; follow-up assignee isolation; export formula neutralization; deletion/restore cascade behavior; REST URL/redirect policy; connector interruption/lease recovery; Gmail partial failure/checkpoint progression; environment startup validation; migration deploy/rollback process.

## Documentation/code discrepancies

1. `docs/archive/04_ADMINISTRATION_AND_OPERATIONS.md:51` says lead deletion is soft and retained. Current `LeadService.remove()` hard deletes and schema cascades related CRM history. This is the most material mismatch.
2. `docs/authentication.md` and `docs/architecture.md` name `src/middleware.ts`; current implementation is `src/proxy.ts`. The current proxy only checks cookie presence; server layouts/API wrappers validate authoritative sessions.
3. `docs/development.md:125-129` describes empty audit/mock/sync/cancel directories. The current inventory has no `audit-logs` API route and does have the current `/api/follow-ups/[id]/complete` handler. Treat the existing graph/report as stale, not authoritative.
4. `docs/integrations.md` describes retry and health tracking but does not disclose that individual Gmail `fetchMessage` errors are swallowed or that the lock has no lease/recovery.
5. Documentation recommends an external cron and backups (`docs/development.md:109-119`, `docs/archive/04_ADMINISTRATION_AND_OPERATIONS.md:210-238`); no executable repository configuration or runtime verification establishes that these are deployed.
6. `docs/database.md` documents soft-delete fields/filters and `@@index([connectorId, sourceReferenceId])`; the live delete path bypasses soft deletion and the composite index duplicates the unique index.
7. The existing graphify graph lists `src/app/api/audit-logs/route.ts`, absent from the current source. It was not used as evidence.

## Ranked findings

| ID | Title | Category | Severity | Confidence | Primary evidence |
|---|---|---|---|---|---|
| DATA-001 | Lead DELETE permanently removes lead and cascaded history | Data integrity | High | Confirmed | `src/services/lead.service.ts:433-439`; schema cascade relations; docs soft-delete claim |
| SEC-001 | REST connector can reach arbitrary/internal URLs and follow response URLs | Security / SSRF | Medium | Confirmed | `src/lib/validation.ts:178-190`; `src/connectors/rest/rest-client.ts:17-27, 105-116, 240-250`; test/sync routes |
| SEC-002 | Sales can assign a follow-up to another user and expose lead summary | Authorization / privacy | Medium | Confirmed | `src/lib/validation.ts:43-50`; `src/services/follow-up.service.ts:74-103,176-247`; task queries |
| SEC-003 | CSV exports do not neutralize spreadsheet formula cells | Security / export | Medium | Confirmed | `src/services/export.service.ts:9-19,70-96,140-160` |
| REL-001 | Crash can strand connector lock and ACTIVE sync run | Resilience | Medium | Confirmed | `src/services/execution-lock.service.ts:10-55`; manual sync route `finally`; runtime run creation |
| REL-002 | Gmail message-level errors are silently discarded | Resilience / ingestion | Medium | Confirmed | `src/connectors/gmail/gmail-client.ts:197-218,220-253` |
| PRIV-001 | Raw PII payloads are stored without retention and appear in logs | Privacy / operations | Medium | High | `src/runtime/routing-engine.ts:67-90`; `src/runtime/connector-runtime.ts:164-170,222-226,260-263`; schema |
| OPS-001 | Scheduled sync relies on unverified external cron | Operations | Medium | High for source; deployment unknown | `src/app/api/scheduler/trigger/route.ts:5-33`; no cron config found |
| PERF-001 | Sales dashboard materializes repeated activity rows in Node | Performance | Medium | High implementation / impact unmeasured | `src/services/dashboard.service.ts:185-193,211-298` |
| PERF-002 | Exports can use unbounded memory and request time | Performance / availability | Medium | Confirmed implementation / impact unmeasured | `src/services/export.service.ts:21-40`; export route |
| DATA-002 | Follow-up assignment/status edits bypass some validation/audit paths | Data integrity | Low | Confirmed | `src/services/follow-up.service.ts:176-247`; route schema |
| DATA-003 | Redundant Lead connector-reference index | Database maintainability | Low | Confirmed schema redundancy | `prisma/schema.prisma:332-335` |

### Additional finding detail

**PRIV-001 — Raw payload retention and operational logs**

- **Severity/confidence:** Medium / High.
- **Evidence:** Unmatched records persist full payload plus preview (`src/runtime/routing-engine.ts:67-90`). Runtime logs raw payload excerpts and PII in several warning/error paths (`src/runtime/connector-runtime.ts:164-170, 179-182, 222-226, 260-263`). Schema has raw JSON fields for leads/unmatched email and no retention worker was found.
- **Scenario/impact:** Connector-sourced customer content is replicated into database backups and centralized logs with potentially broader operator access and longer retention than the CRM record. Unexpected parser or provider fields can include sensitive information.
- **Fix:** Define field-level minimization and retention/deletion schedule; redact body/email/name in logs by default; restrict log access and retention; classify raw payloads and ensure user deletion/retention applies consistently.
- **Effort:** Medium. Verify with synthetic secrets/PII canary values in logs, DB rows, exports, and backups.

**DATA-002 — Follow-up mutations have inconsistent validation/event recording**

- **Severity/confidence:** Low / Confirmed, with the cross-user disclosure tracked separately as SEC-002.
- **Evidence:** Generic update permits `assignedUserId` changes without validating the target role/activity. Status is accepted in the schema but rejected in service update; some update branches write directly without a lifecycle event. `complete()` checks status before the transaction, then updates by ID without a conditional `status=PENDING` predicate, so concurrent completion requests can both create event/next-follow-up side effects.
- **Impact:** Invalid assignee values can produce database errors; concurrent completion can produce duplicate lifecycle events/next follow-ups; changes are less auditable.
- **Fix:** Validate assignees and transitions; enforce pending-to-completed as an atomic conditional update; emit all lifecycle entries in the same transaction.
- **Effort:** Medium. Verify with concurrent completion and invalid/inactive assignee integration tests.

**DATA-003 — Redundant index**

- **Severity/confidence:** Low / Confirmed. `@@unique([connectorId, sourceReferenceId])` creates a unique index that covers the same leading columns as `@@index([connectorId, sourceReferenceId])`. The extra index adds write/storage cost. Remove only after confirming deployed migration state; measure with catalog and query plans if migration drift exists.

## Prioritized remediation plan

### P0 — Before any production launch

1. Resolve DATA-001 against product intent. The current endpoint is irreversible and contradicts the documented soft-delete promise. Implement retained soft deletion/restore or an explicit purge policy and confirmation model before enabling destructive access.
2. Establish and prove a backup and restore procedure with a production-like database. Documentation alone is not evidence of a usable backup.
3. Verify production secrets, HTTPS/cookie behavior, and database target before admitting real data. Do not run production with placeholder or low-entropy secrets.

### P1 — Before V1.0 sign-off

1. Fix SEC-002 follow-up assignment and verify cross-Sales isolation.
2. Fix SEC-003 CSV formula injection for all export types.
3. Constrain REST destinations and redirects (SEC-001); add outbound network controls.
4. Add sync lock leases/stale-run recovery (REL-001) and make Gmail partial fetch failures/checkpoint progress observable and recoverable (REL-002).
5. Verify/configure the actual scheduled trigger, including a non-session machine authentication mechanism, bounded execution, missed-run monitoring, and overlap behavior (OPS-001).
6. Define raw payload/log retention and PII redaction (PRIV-001).
7. Add automated authorization, deletion, connector recovery, and migration tests; set release CI gates.
8. Verify production migration deployment/rollback and connection-pool limits.

### P2 — Early after launch or when measured

1. Benchmark PERF-001 with representative activity history; consolidate to SQL aggregation only if measured latency/row transfer is meaningful.
2. Benchmark PERF-002 at expected and worst-case exports; stream or bound exports if memory/time limits require it.
3. Measure lead details API payload sizes/history counts; paginate or omit raw/custom payload fields if they materially affect transfer or contain unnecessary data.
4. Capture query plans for dashboard/report/list workloads in staging; propose indexes only when the plan and workload justify them.

### P3 — Later

1. Remove DATA-003's redundant index after migration review and verify database schema drift.
2. Consider deeper search/index optimization only when current volume/query plans show the documented substring search is no longer adequate.
3. Add durable worker/queue infrastructure only if measured connector runtime and hosting constraints cannot meet the required schedule reliably with a corrected lease-based execution model.

## V1.0 release blockers

- **Confirmed blocker:** DATA-001: permanent lead deletion conflicts with the soft-delete contract and cascades audit/operational records.
- **Security sign-off blockers:** SEC-002 and SEC-003 should be fixed before real Sales access and spreadsheet exports are enabled. SEC-001 requires an explicit risk decision and destination/egress controls before REST connectors are enabled.
- **Operational blocker if scheduled ingestion is part of V1.0:** OPS-001: prove the deployed cron trigger works with machine authentication and alerting. If V1.0 is manual-sync only, document that scope clearly.
- **Reliability sign-off blockers:** REL-001 and REL-002 need recovery semantics demonstrated before relying on unattended connector ingestion.
- **Environment blocker:** backup/restore, secret values, connection pool, logging retention, monitoring, and deploy migration order must be verified in staging/production; this audit had no access to those systems.

## Performance work: measured versus hypothesized

- **Measured bottlenecks:** none. No production/staging database, browser traces, or representative benchmark data were available.
- **High-confidence hypotheses:** Sales dashboard repeated `ActivityEntry` row materialization (PERF-001), complete in-memory CSV export (PERF-002), and lead detail serialization of raw payload plus unbounded notes/follow-ups. Validate query time, rows/bytes, heap, endpoint duration, and p95 modal/export latency using anonymized production-shaped staging data.
- **Index recommendations:** no new index recommended without representative `EXPLAIN (ANALYZE, BUFFERS)` results. Existing query predicates and indexes were inspected statically; only redundant index DATA-003 is directly evidenced.

## Risks requiring staging or production verification

1. Actual `BETTER_AUTH_SECRET` entropy, `BETTER_AUTH_URL`, public URL, TLS termination, cookie flags, proxy trust, and auth rate-limiting behavior across instances.
2. External scheduler identity/authentication, run frequency, function timeout, retry schedule, missed-run detection, and alert routing.
3. Database backup schedule, point-in-time recovery, restore time, migration order, rollback/forward-fix, Neon pooling limits, and deployed schema/migration drift.
4. Real logs destination, retention, access scope, PII redaction, application error alerts, and sync failure alerts.
5. Query plans and latency for Admin/Sales dashboard, list/search, reports, exports, connector sync, and sync history at actual data volume.
6. Gmail provider quotas, message-read/acknowledgement behavior, history cursor persistence, and error/retry behavior under actual account conditions.
7. Hosting function maximum duration/memory versus REST `timeout`, `maxPages`, response size, serial processing time, and sync lock recovery.
8. Whether Admin connector/test configuration is restricted enough in production and what outbound network services the app can reach.

## Areas not assessed

- Live exploitation or probing of production/staging network services, private IPs, cloud metadata, or configured customer endpoints.
- Production credentials, secret values, current live database contents, DB plans, deployed schema drift, backups, or restore execution.
- Hosting provider settings, external cron account/configuration, firewall/egress rules, TLS/cookie behavior, alerts/log sinks, process limits, or actual rollback process.
- Gmail/REST live integrations, external provider uptime/quotas, OAuth consent/scopes, and real payload schemas.
- Browser/device performance, real user timing, bundle size analysis, accessibility conformance, and frontend Web Vitals.
- Automated behavioral/integration tests, destructive smoke scripts, production build, dependency vulnerability database results, or live load tests.
- Legal/privacy retention requirements and contractual treatment of customer data; the report identifies implementation exposure, not legal compliance.

