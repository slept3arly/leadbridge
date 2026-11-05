# LeadBridge Performance, Data Freshness & Maintainability Audit

> **Status:** Experimental, read-only audit
> **Audit date:** 2026-11-05
> **Environment target:** Locally hosted Next.js application and local PostgreSQL, as specified for this audit. The current repository still contains Neon-oriented configuration and documentation.

## Executive Summary

The application uses a sound local monolithic architecture: App Router Server Components load CRM data through services, Prisma uses the PostgreSQL driver adapter, mutations pass through authenticated API handlers, and frequently changing lead/detail data is not placed in a server cache. The client refreshes the active route after many successful mutations.

The main confirmed freshness defect is that mutation invalidation targets the acting user, while some Admin operations change data belonging to another Sales user. Per-user Sales dashboard and attention caches can therefore continue showing old counts or tasks. Open tabs also have no cross-tab notification or focus revalidation, so their client state can remain old after another tab changes records.

The clearest avoidable data transfer is the inclusion of the full connector rawPayload in the normal lead detail projection and response, although the UI does not use it. Dashboard activity metrics also fetch activity rows and aggregate them in JavaScript; this is an optimization opportunity whose benefit should be measured with realistic local data. No production page, database-query, or client-bundle baseline could be established in this environment.

No application code, tests, package configuration, schema, migrations, or canonical documentation were changed. This report is the only file created for the audit.

## Environment Assumptions and Scope

The deployment target is a local Next.js process with local PostgreSQL. Repository code uses @prisma/adapter-pg (src/lib/prisma.ts), so the connection is ordinary PostgreSQL through the pg driver adapter; the code does not require Neon. The repository’s .env.example and several canonical documents still name Neon and should not be treated as the target environment configuration.

Inspected AGENTS.md, the canonical documentation index and relevant architecture, backend, frontend, database, API, authentication, UI, performance, development, and integration guides; package.json; repository-wide App Router/API/client-component inventories with targeted source inspection; cache and session helpers; service query patterns; Prisma schema and migration inventory; test files and PostgreSQL integration runner; local environment examples and startup scripts. Existing worktree changes were preserved.

## Current Baseline and Verification Limits

- pnpm test completed successfully: 23 tests passed, 1 test skipped, 0 failed (about 0.4 seconds). This is a unit-test runtime only, not an application performance measurement.
- No DATABASE_URL or LEADBRIDGE_TEST_DATABASE_URL was present in the process environment. psql and pg_isready are unavailable, so no database query plans or timings were collected. No database was opened or modified.
- Playwright is not installed in node_modules; no browser profiling or interaction testing was available.
- No production build or bundle analysis was run. There is no measured initial page load, navigation latency, JavaScript bundle size, lead-list latency, dashboard duration, or mutation-to-refresh time in this audit.
- The PostgreSQL integration test files exist, but were not run because there was no isolated test-database URL. No performance figures below are presented as measurements.

## Findings

### A. Confirmed Problems

#### A1. Admin mutations leave affected Sales dashboard caches stale

- **Area:** Data freshness / cache invalidation
- **Severity:** Medium
- **Evidence:** src/lib/cache-tags.ts, invalidateAfterMutation(), invalidates the supplied user’s dashboard and attention tags plus the global Admin dashboard tag. src/app/(dashboard)/sales/page.tsx caches dashboard data by Sales user ID with those per-user tags and no time-based revalidate; src/app/(dashboard)/sales/tasks/page.tsx does the same for attention data. src/app/api/leads/route.ts calls invalidation with the authenticated actor after creation; src/app/api/leads/[id]/assign/route.ts does so after Admin reassignment. src/services/lead.service.ts allows Admin creation/assignment to target an active Sales user.
- **Current behavior:** An Admin can create or reassign a lead for a salesperson, but those routes invalidate the Admin actor’s per-user tags, not the target (or previous) salesperson’s cache. Sales caches have tag invalidation but no expiry interval. The Admin dashboard has a 60-second TTL, but Sales dashboard/task aggregates can remain cached until the relevant Sales tag is invalidated.
- **Why it matters:** Sales KPI counts, “new” leads, follow-up counts, and attention lists may continue to show the pre-assignment state after a successful Admin change. This is a reproducible invalidation-key mismatch in code; its occurrence was not runtime-tested here.
- **Proposed improvement:** Have mutation orchestration identify affected owner IDs (including both old and new owners for reassignment) and invalidate only the relevant user dashboard/attention tags after commit. Add bounded expiry as a recovery path, not as a replacement for correct invalidation.
- **Expected benefit:** Correct Sales aggregates after cross-user Admin changes, with narrowly scoped invalidation.
- **Effort:** Medium.
- **Verification:** Warm a Sales dashboard and task cache, create/assign/unassign a lead as Admin, then request each affected Sales view. Assert data reflects the committed state and unaffected users’ caches remain valid.

#### A2. Open tabs do not receive CRM mutation updates from another tab

- **Area:** Data freshness / client state
- **Severity:** Medium
- **Evidence:** src/components/sales/sales-my-leads-page-content.tsx and src/components/leads/admin-leads-page-content.tsx render server-provided rows as client-component props and call router.refresh() from the tab that submits a mutation. src/hooks/use-lead-details.ts stores detail data in client state, fetches when leadId changes, and refreshes it only when its caller explicitly invokes refresh(). No BroadcastChannel, storage event, polling, or visibility/focus revalidation was found in src/.
- **Current behavior:** A successful mutation refreshes the submitting tab in the implemented flows; another already-open tab has no mechanism to learn that its rendered rows or loaded lead details have changed. Navigating or manually refreshing may update it later.
- **Why it matters:** Two tabs can silently present different lead, activity, note, and follow-up state. This conflicts with the stated multi-tab freshness goal, even though fresh server requests read current database data.
- **Proposed improvement:** On successful mutations, publish a small same-origin mutation notification and have relevant open views refresh on notification or when becoming visible. Keep the event scoped to the affected lead/views and do not introduce polling for every page.
- **Expected benefit:** Other active tabs converge promptly without adding a hosted service or forcing a broad full-page reload.
- **Effort:** Medium.
- **Verification:** Open lead list and detail views in two tabs, mutate in one, and verify the other refreshes relevant data after the successful response and after returning to the tab.

#### A3. Normal lead detail responses include the full imported payload

- **Area:** Database / response size / data exposure
- **Severity:** Medium
- **Evidence:** src/services/lead.service.ts, leadDetailSelect, selects rawPayload: true; LeadService.getById() uses this projection. src/app/api/leads/[id]/details/route.ts returns the lead alongside notes, follow-ups, and activity events. The same getById() is also used by the lead resource route. Repository UI references to imported lead metadata use fields such as sourceReferenceId and parserVersion; no frontend component reads rawPayload.
- **Current behavior:** Opening a lead detail can serialize the complete connector payload into an API response even though the current UI does not render it. Payload size depends on the connector and source record.
- **Why it matters:** Large payloads increase database I/O, server serialization, response bytes, and browser memory. The payload may also contain source data that normal CRM screens do not need to expose to the assigned salesperson.
- **Proposed improvement:** Remove raw payload from the ordinary detail projection/response. If a supported diagnostic workflow needs it, return it through an explicit, permission-checked path.
- **Expected benefit:** Smaller detail responses and less unnecessary exposure of imported source data.
- **Effort:** Small.
- **Verification:** Compare detail response size before/after using representative imported records; confirm the lead details UI and connector diagnostic workflow still have the fields they require.

#### A4. Lead schema declares a duplicate connector/source-reference index

- **Area:** PostgreSQL indexes / write overhead
- **Severity:** Low
- **Evidence:** prisma/schema.prisma, Lead model, declares both @@index([connectorId, sourceReferenceId]) and @@unique([connectorId, sourceReferenceId]).
- **Current behavior:** PostgreSQL maintains a non-unique btree index and a unique btree index over the same columns. The unique index can serve lookups on that same leading key pair.
- **Why it matters:** The duplicate index consumes storage and adds index maintenance work to connector lead inserts and updates. No catalog inspection was available to check the live local database’s exact index names or whether manual drift exists.
- **Proposed improvement:** Confirm the live catalog and query usage, then remove the redundant non-unique declaration through a migration if it is present and redundant there too.
- **Expected benefit:** Reduced index storage and modestly lower write overhead.
- **Effort:** Small.
- **Verification:** Inspect pg_indexes, confirm plans use the unique index for connector/source lookups, and compare migration-generated schema before applying a migration.

#### A5. An unused legacy lead filter component remains in the source tree

- **Area:** Maintainability / dead code
- **Severity:** Low
- **Evidence:** src/components/sales/lead-filters.tsx exports LeadFilters, but repository-wide reference search found no import or dynamic reference beyond that file. The active Admin and Sales lead pages use SalesTableControls; docs/UI_DESIGN_SYSTEM.md also identifies LeadFilters as superseded.
- **Current behavior:** The old component and its imported modal/filter dependencies remain buildable source but are not part of a current route’s import graph.
- **Why it matters:** It increases maintenance surface and can mislead future edits about which filter implementation is canonical. It is not evidence of a meaningful runtime performance problem.
- **Proposed improvement:** Remove the legacy component only after checking its archive-specific and detail-dialog behaviors against the active controls and pages.
- **Expected benefit:** Less dead UI code and fewer competing implementations.
- **Effort:** Small.
- **Verification:** Confirm no dynamic/file-based route reference and compare the component’s archive/detail actions with current product flows before deletion.

### B. Measurable Optimization Opportunities

#### B1. Dashboard activity metrics materialize matching entries in application memory

- **Area:** Prisma/PostgreSQL query efficiency
- **Severity:** Medium
- **Evidence:** src/services/dashboard.service.ts, DashboardService.admin(), fetches every matching Call/WhatsApp ActivityEntry for the current day (no take) and computes counts/distinct lead sets in JavaScript. DashboardService.sales() calls countDistinctLeads() seven times; each call loads matching leadId values with findMany() and constructs a JavaScript Set.
- **Current behavior:** The methods issue multiple parallel activity queries and transfer all matching IDs/rows to the Node process to compute aggregates. Existing ActivityEvent/ActivityEntry indexes support lead/event access, but no query plans or row counts were available.
- **Why it matters:** As daily activity grows, response payload and memory use grow with the number of matching activity entries. The Sales dashboard also repeats the same relation joins across seven sets of predicates.
- **Proposed improvement:** Measure query time, rows read/returned, and Node memory on representative local data. If material, use SQL aggregate queries (for example COUNT(DISTINCT leadId) and conditional aggregates) to return only metric values, preserving current definitions.
- **Expected benefit:** Potentially fewer database round trips and substantially fewer rows transferred for dashboard rendering. This is an unmeasured opportunity, not a proven user-visible slowdown.
- **Effort:** Medium.
- **Verification:** Capture baseline query count/duration and EXPLAIN (ANALYZE, BUFFERS) on an isolated local test database; compare returned rows, duration, and exact metric parity after a focused change.

#### B2. Lead detail loads all notes and follow-ups while limiting activity history

- **Area:** API response size / detail load
- **Severity:** Low
- **Evidence:** src/app/api/leads/[id]/details/route.ts queries all notes and all follow-ups for a lead without pagination or take; activityEventService.listByLead() is explicitly called with { limit: 100 }. The schema indexes Note(leadId, createdAt) and FollowUp(leadId, createdAt) support bounded retrieval.
- **Current behavior:** Detail response size grows with note and follow-up history without a cap, while activity history is capped at 100 events. The three data groups are fetched concurrently, so this is not an N+1 query finding.
- **Why it matters:** Long-lived leads can accumulate large response bodies and render work on each detail open. There is no measured lead history distribution to establish when this matters.
- **Proposed improvement:** Measure response sizes and history counts locally. If histories are material, paginate or lazily load older notes/follow-ups using the existing lead-scoped indexes and an explicit continuation contract.
- **Expected benefit:** Bounded initial detail load for high-history leads.
- **Effort:** Medium.
- **Verification:** Seed an isolated test lead with realistic and stress-level history; measure response bytes, query duration, and modal render time while verifying ordering and access scope.

#### B3. Search and deep-page costs need local query-plan baselines before index changes

- **Area:** Lead listing / PostgreSQL search and pagination
- **Severity:** Low
- **Evidence:** src/lib/query-builder.ts containsSearch() builds case-insensitive contains predicates over five fields; LeadService.listPage() applies OFFSET pagination and performs both a page query and matching count. The schema has btree indexes for email and phone, but those do not ordinarily accelerate a leading-wildcard ILIKE '%term%' predicate. Current indexes also cover several common list filters and sort keys.
- **Current behavior:** Search can require scanning matching rows; deep offsets require PostgreSQL to walk and discard earlier rows. The configured maximum page size is bounded. No dataset size, query plan, or user latency was available.
- **Why it matters:** Search and counts can become the lead-list bottleneck at sufficiently large local datasets, but adding a trigram index or replacing OFFSET without measurements would add write/storage or behavior complexity prematurely.
- **Proposed improvement:** Establish local record-count and latency targets; run representative EXPLAIN (ANALYZE, BUFFERS) for filtered, searched, sorted, and deep-page cases before considering index or pagination changes.
- **Expected benefit:** Evidence-based optimization and avoidance of unnecessary indexes or API changes.
- **Effort:** Small for baseline; Medium for any later implementation.
- **Verification:** Repeat the same query-plan and response-time captures on an isolated local dataset with representative lead distributions.

#### B4. Shared dashboard navigation loads GSAP on every dashboard surface

- **Area:** Frontend bundle / initial client JavaScript
- **Severity:** Low
- **Evidence:** src/components/shared/app-shell.tsx includes BottomNavigation; that client component imports gsap, and its menu imports GSAP as well. The same shell wraps Admin and Sales pages. AnimatedReveal separately uses GSAP on the login page.
- **Current behavior:** GSAP is in the dependency graph of shared dashboard navigation. The production chunk split and compressed byte contribution were not built or measured.
- **Why it matters:** A large animation dependency in a persistent shell could contribute to JavaScript downloaded on every dashboard route, but a meaningful cost cannot be asserted without a production bundle analysis.
- **Proposed improvement:** Inspect the production client bundle and interaction profile first. If GSAP contributes materially, consider a small CSS transition for the dock indicator/menu or isolate the animation code to the opened menu.
- **Expected benefit:** Potentially less JavaScript on initial dashboard load; no benefit should be claimed until measured.
- **Effort:** Small to Medium.
- **Verification:** Build with a bundle analyzer or inspect Next client manifests, compare compressed route/shared chunks, and confirm navigation animation and reduced-motion behavior.

#### B5. Admin lead-list source lookup is serialized after independent reads

- **Area:** Frontend initial load / database round trips
- **Severity:** Low
- **Evidence:** src/app/(dashboard)/admin/leads/page.tsx awaits the lead page and assignable-user queries together, then awaits active lead sources in a later query. src/app/(dashboard)/sales/my-leads/page.tsx fetches lead rows and lead sources concurrently.
- **Current behavior:** After the cached page-size setting resolves, the Admin route cannot finish until the lead/user Promise.all completes and then the independent lead-source query completes.
- **Why it matters:** The extra sequential database round trip adds avoidable latency to the Admin lead-list first render. The size is likely modest and was not timed.
- **Proposed improvement:** Fetch the lead-source list in the same Promise.all as the lead result and assignable users.
- **Expected benefit:** Removes one serial wait from the route’s server rendering path without changing data freshness or query results.
- **Effort:** Small.
- **Verification:** Compare server trace timings for Admin lead-list rendering before and after, and confirm source options remain current.

### C. Potential Risks Requiring Runtime or Operational Verification

#### C1. Local database backup, restore, readiness, and production migration procedures are not established in this repository

- **Area:** Local deployment reliability
- **Severity:** Medium
- **Evidence:** The repository has migration files and a db:migrate script that runs prisma migrate dev, but no dedicated production migration command/script. The production section in docs/development.md lists generate, typecheck, lint, build, and start, without a migration or backup/restore procedure. docs/database.md notes hard deletion depends on a verified database backup. No backup, restore, readiness, or local process-supervision script appeared in the inspected repository files.
- **Current behavior:** The application expects DATABASE_URL at Prisma initialization and throws if it is unset (src/lib/prisma.ts). PostgreSQL start/readiness and backup operations are left to the host environment. This audit cannot establish whether the operator already maintains external local backups or a service manager.
- **Why it matters:** A local database on the application host is a single operational dependency and possibly a single data-loss domain. Hard deletion is intentional, so recovery depends on an independently tested backup. Starting the app before PostgreSQL is ready can produce request failures.
- **Proposed improvement:** Define a local operational runbook: PostgreSQL startup/readiness, a prisma migrate deploy step for production-mode startup, scheduled pg_dump backups to a separate local disk/device, retention, and a periodic restore test. Keep it local; no cloud infrastructure is implied.
- **Expected benefit:** Reproducible upgrades and verified recovery from local database loss or accidental deletion.
- **Effort:** Medium.
- **Verification:** Test a clean startup and migration against a disposable local database; restore a backup to another isolated database and verify core CRM records and activity relationships.

#### C2. Scheduled connector execution depends on an external trigger

- **Area:** Local deployment / connector reliability
- **Severity:** Low
- **Evidence:** src/jobs/index.ts is empty; POST /api/scheduler/trigger discovers due work only when called. docs/development.md and docs/integrations.md state that an external cron must call it and mention Vercel Cron as one option.
- **Current behavior:** No scheduler process or OS cron configuration is shipped with the application. Manual/Admin trigger works, but scheduled runs will not occur unless the local host is configured to call the endpoint.
- **Why it matters:** A local-only deployment will miss scheduled connector executions if operators expect an in-app timer or use the cloud-oriented example without a cloud deployment.
- **Proposed improvement:** Document and configure the host’s native scheduler (for example systemd timer/cron or Windows Task Scheduler) to call the authenticated endpoint, including service restart and failure logging.
- **Expected benefit:** Scheduled syncs work without adding a queue or cloud service.
- **Effort:** Small to Medium.
- **Verification:** Run a local scheduled trigger against a disposable connector and verify a sync run, next-run advancement, and diagnostics after a failure.

## Dead Code, Dependency and Maintainability Review

- **Confirmed candidate:** src/components/sales/lead-filters.tsx has no import or dynamic call site in the repository; it is already marked legacy in docs/UI_DESIGN_SYSTEM.md. Review its behavior before removal because it includes archive/detail interactions, not just filter controls.
- **Not confirmed as dead:** src/lib/audit-export-params.ts exports an empty object, but src/components/shared/export-button.tsx imports and spreads it. It has no current behavior, but removing it also requires simplifying that caller. docs/backend.md and docs/development.md currently describe the file as dead code, which is imprecise.
- **Low-value empty placeholders:** src/hooks/index.ts and src/jobs/index.ts each only export {} and have no imports. The latter may be a deliberate future seam for jobs; removal would save no runtime work.
- **Dependencies:** Direct dependency search found GSAP, Axios, Lucide, Sonner, Pino, Better Auth, Google APIs, Prisma, PostgreSQL adapter, Zod, and utility dependencies in use by application or scripts. No unused runtime dependency was confirmed. Dependency byte cost in client chunks was not measured.
- **N+1 review:** The inspected lead list batches activity enrichment into one latest-event query and one entry query for the current page; lead details fetch the lead, notes, follow-ups, and bounded activity list concurrently. No confirmed N+1 pattern was found in these primary CRM paths.

## Documentation and Configuration Discrepancies

These are audit findings only; canonical docs and configuration were not edited.

#### D1. Canonical deployment and performance guidance describes a different runtime

- **Area:** Documentation / local deployment
- **Severity:** Medium
- **Evidence:** AGENTS.md, docs/architecture.md, and docs/database.md identify Neon; docs/architecture.md and docs/performance.md describe an HTTP-based Neon driver; docs/performance.md describes production Prisma as per-invocation and lists outdated dashboard query counts; .env.example targets a Neon host; docs/development.md production steps omit a production migration command and refer to Vercel Cron. Current source uses PrismaPg with a PostgreSQL connection string and a module-level PrismaClient in src/lib/prisma.ts; package.json maps db:migrate to prisma migrate dev. Specific discrepancies are enumerated below.
- **Current behavior:** Developers following the sample environment and canonical performance/deployment guides may configure a remote Neon database, assume a serverless HTTP driver/pool, or omit local production migration and scheduling setup despite the audit’s local PostgreSQL deployment target.
- **Why it matters:** Incorrect operational assumptions increase setup errors and make performance guidance, pool expectations, and release steps unreliable.
- **Proposed improvement:** Update the affected guides and .env.example to the supported local PostgreSQL adapter and chosen local operations, and recalculate source-derived query counts. Keep theoretical estimates labeled and separate from measured baselines.
- **Expected benefit:** Reproducible local setup and a trustworthy performance/operations reference.
- **Effort:** Small to Medium.
- **Verification:** Compare each changed guide and sample setting against src/lib/prisma.ts, package.json, current route/service code, and a clean local startup/migration/scheduler run.

1. AGENTS.md, docs/architecture.md, and docs/database.md describe Neon. docs/architecture.md additionally calls the driver HTTP-based. Current src/lib/prisma.ts constructs PrismaPg with a PostgreSQL connection string; the target for this audit is local PostgreSQL.
2. .env.example defaults to your-neon-host and sslmode=require, which is not a usable local PostgreSQL example.
3. docs/performance.md calls @prisma/adapter-pg a Neon serverless HTTP driver, says pooling is handled by Neon, and describes production Prisma as per-invocation. Current source constructs the PrismaPg adapter and module-level PrismaClient; only development also stores the client on globalThis.
4. docs/performance.md lists 18 Admin and 12 Sales dashboard queries, while current service code has 14 Admin Promise.all operations and 15 Sales operations (including seven separate activity-ID aggregations). The query-count descriptions and some cache inventory claims should be refreshed from source.
5. docs/performance.md contains theoretical latency and bundle-size estimates. It labels some estimates as theoretical, but the GSAP “-166KB” claim is not backed by a measured current bundle in this audit and should not be used as a baseline.
6. docs/development.md says db:migrate is used in setup, but its production runbook omits applying pending migrations. It also lists Vercel Cron alongside local scheduling options; local-only deployment guidance should emphasize the host’s native scheduler.
7. docs/backend.md and docs/development.md call audit-export-params.ts dead although the export button imports it. This should be described as an empty placeholder or removed together with its caller.
8. docs/database.md explicitly says recovery depends on a verified database backup, but no repository procedure describes how to create, retain, restore, or validate one.

## Prioritized Recommendations

### Priority 1 — Data freshness and meaningful response reduction

1. Correct affected-user cache invalidation for Admin create/reassign/update operations, covering old and new Sales owners after commit.
2. Add same-origin cross-tab mutation notification and refresh/revalidate relevant views when a tab resumes, avoiding broad polling.
3. Stop returning unused rawPayload in ordinary lead detail responses.

### Priority 2 — Measured query and source cleanup

4. Capture local dashboard query plans, Admin lead-list render timing, and production client chunk sizes; aggregate dashboard activity, parallelize the Admin source lookup, or reduce GSAP chunks only where those measurements justify it.
5. Measure lead-detail response growth and add pagination/lazy retrieval only if note/follow-up history warrants it; inspect and remove the redundant connector/source-reference index after confirming the live catalog.
6. Remove the unused LeadFilters implementation after confirming its archive/detail behavior is represented in current flows; simplify the empty export-parameter placeholder with its caller.

### Priority 3 — Local deployment reliability

7. Establish a local migration, PostgreSQL readiness, backup, restore-test, and scheduler runbook using the host’s existing OS tools.

### Priority 4 — Documentation and maintainability

Refresh Neon/HTTP-driver assumptions and stale query counts in AGENTS.md, .env.example, docs/architecture.md, docs/database.md, docs/performance.md, and the development/scheduler guides once the local operational decisions are agreed.

### Deferred

Do not add Redis, queues, replicas, cloud hosting, full-text search, cursor pagination, or broad client/server component rewrites without a measured local bottleneck. Preserve current uncached fresh reads for lead lists, lead details, notes, follow-ups, and activities. Do not add a search index solely because search uses ILIKE; first measure local data sizes and query plans.

## Existing Strengths to Preserve

- Business logic and Prisma access are concentrated in services; API handlers remain thin and apply server authorization.
- Lead list initial data is server-rendered and paginated. Table query changes are URL-backed, debounced, and use router navigation instead of a duplicate client-side lead-list API fetch.
- CRM lead/detail data is generally read directly from PostgreSQL; stable dashboard/settings aggregates use explicit tagged caches.
- Most mutation handlers invalidate dashboard caches after service operations, and many active UI mutation flows refresh the current route.
- Primary list/detail queries use explicit projections rather than unrestricted model serialization, except for the rawPayload over-fetch noted above.
- Follow-up aggregates are maintained transactionally, and the schema has query-driven indexes for ownership, due dates, event history, and common list fields.
- Existing Node tests cover validation/security rules; PostgreSQL integration coverage exists for lead creation, follow-up completion, note scheduling, and execution fencing.
- A local monolithic deployment is well served by the current architecture; no evidence supports adding distributed infrastructure.

## Not Recommended

- Disabling all caching: fresh CRM data is already fetched from PostgreSQL; only aggregate/dashboard and settings views are cached.
- Replacing OFFSET pagination or adding GIN indexes before measuring realistic local queries.
- Consolidating all dashboard queries into a materialized view or background worker without latency evidence.
- Adding Redis, a remote queue, a read replica, cloud cron, or another data store for this single-host deployment.
- Converting interactive client components to Server Components solely to reduce use-client count; the current pages use client boundaries for tables, dialogs, forms, and navigation interactions.

