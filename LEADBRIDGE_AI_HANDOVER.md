# LeadBridge — AI Project Handover

> **Purpose:** Working context for AI assistants continuing LeadBridge development.
> **Prepared:** 2026-11-24
> **Scope:** Repository-level orientation, current implementation, approved constraints, and known verification limits.

## How to read this handover

Implementation claims below describe the checked-out repository inspected for this handover. Current source is authoritative; this document and other documentation do not override source, Prisma schema, or runtime configuration. Historical audits and implementation reports describe snapshots, not active requirements.

Labels used below:

- **Current implementation** — observed in current source/configuration.
- **Approved requirement** — repository or user-authored instruction that governs changes.
- **Historical decision** — a past decision or implementation record; useful context, not necessarily current behavior.
- **Proposed, unapproved** — a suggestion that must not be implemented without approval.
- **Unresolved** — current evidence does not establish a decision or state.

## 1. Project overview and objectives

**Current implementation:** LeadBridge is an internal, single-tenant CRM for one organization. It supports lead capture and ownership, sales activity tracking, follow-up work, provider/routing configuration, connector-based imports, and reporting. It is a monolithic Next.js application with a PostgreSQL database; it is not a collection of microservices.

**Intended operating model:** The repository describes a locally hosted application connected to a local PostgreSQL instance. This describes project intent, not a verified live deployment. Do not infer the location, health, or migration state of any configured or production database from documentation.

## 2. Technology stack

**Current implementation/configuration:**

- Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5 in strict mode.
- pnpm; package version `0.1.0`.
- PostgreSQL with Prisma 7.8.0 and `@prisma/adapter-pg` / `PrismaPg`.
- Better Auth 1.6.23, credentials login, cookie sessions; Zod 4 validation.
- Tailwind CSS v4, Lucide React, Radix UI components, Axios/fetch, Pino logging, GSAP.
- TypeScript alias `@/*` maps to `src/*`.

Prisma's schema generator writes to `src/generated/prisma`. That directory is ignored by Git; regenerate it with `pnpm db:generate` rather than editing generated code.

## 3. Repository structure

- `src/app/` — App Router pages, layouts, loading/error boundaries, and HTTP route handlers.
- `src/components/` — feature-level and shared UI, including `ui/` primitives.
- `src/connectors/` — Gmail/REST implementations and connector registry; integrations return raw payloads.
- `src/parsers/` — deterministic parser implementations, manifests, and parser registry.
- `src/runtime/` — connector execution pipeline, routing, parsing coordination, normalization, retry, history, and execution context.
- `src/services/` — CRM business logic, transactions, database operations, scheduler/lock/health, and export services.
- `src/lib/` — auth, Prisma client, request validation, permissions, cache invalidation, export contracts/helpers, and UI/domain helpers.
- `src/hooks/` — client-side state/freshness hooks.
- `src/types/` — shared application/domain types; `src/generated/prisma/` is generated.
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` — data model, checked-in migration history, and configured seed.
- `tests/` — Node test-runner unit/contract tests and opt-in PostgreSQL integration tests.
- `scripts/` — current smoke and integration-test helper scripts.
- `mock-rest-api/` — separate local REST fixture service used for connector testing.
- `docs/` — canonical guides, audits, and two retained experiment reports. The former `docs/archive/` directory was removed.

## 4. System architecture

**Current request flow:** Browser requests pass through `src/proxy.ts`, which provides cookie-presence redirects for page navigation only. It is not an authentication boundary. Server Components and API route handlers then use server-side session/authorization helpers. Pages can call services directly for server-rendered reads; browser mutations use API routes. Services use the shared Prisma client in `src/lib/prisma.ts` and PostgreSQL.

```text
Browser → Next.js proxy (UX redirect only) → App Router page/API handler
        → server session/permission check → domain service → Prisma → PostgreSQL
```

**Approved architecture rules:** Business logic belongs in `src/services/`; mutations go through `src/app/api/` (no server actions); database access uses Prisma, not a new data-access layer. Parsers must remain deterministic and side-effect free. Connector code must not access Prisma. These are constraints for new work; the audit docs identify existing exceptions rather than declaring them ideal.

**Known current exception:** Some connector API route handlers perform direct Prisma/configuration work while also orchestrating sync and execution-lock behavior. The architecture guide calls out this boundary exception. Do not expand it casually; service-boundary changes require their own approved scope.

## 5. Frontend architecture and UI conventions

**Current implementation:** App Router pages use Server Components for initial session/data fetching and pass data into client components for interaction. Admin and Sales are separate route groups/layouts. Client stateful table filters and pagination are URL-backed through `useTableQuery`; relevant successful mutations publish minimal same-origin entity notifications using `BroadcastChannel` with a storage-event fallback. Views refresh on relevant notifications and visibility/focus with a cooldown; there is no polling.

Use existing design tokens and `src/components/ui/` primitives, shared navigation, form conventions, and centralized lead/activity labels. Dialogs should use the established accessible dialog utilities. Keep server authorization authoritative; hiding a UI control is not security. Create Lead and Record Progress have intentionally distinct workflows and share activity field functionality where implemented. Avoid combining components by name alone; inspect their behavior and callers first.

## 6. Backend services and business workflows

**Current implementation:** Route handlers validate/authorize and delegate to domain services where the architecture permits. Core services include Lead, LeadWorkflow, FollowUp, ActivityEvent, Note, Dashboard, Attention, Report, Provider, Connector, Scheduler, Settings, User, Parser, and export services. `src/lib/validation.ts` holds request schemas; `src/lib/service-errors.ts` and `src/lib/api.ts` translate service/HTTP errors.

Important implemented contracts:

- Manual lead creation requires one genuine CALL or WHATSAPP interaction and creates the lead, system event, interaction event, and optional follow-up atomically. Connector/import creation remains a separate path and does not fabricate an interaction.
- Record Progress records an interaction and can update classification, complete the selected pending task, and schedule a replacement in one transaction. Interaction-only updates leave pending tasks unchanged.
- Follow-up scheduling serializes on the Lead row. Scheduling replaces a sole pending task; legacy multiple-pending conflicts produce HTTP 409 rather than automatic cleanup. The database partial unique index is a second guard in the checked-in migration. Lead follow-up denormalized dates are recalculated transactionally.
- Follow-ups for an assigned lead go to its owner; for an unassigned lead, the acting user. Sales users are scoped to their assigned leads.
- Activity history is `ActivityEvent` + `ActivityEntry`. Do not reintroduce the removed `LeadActivity` or `AuditLog` systems.
- Lead deletion is currently hard delete with database cascades. Do not describe it as soft-delete or add recovery behavior without a separate design/approval.
- City and District are independent optional Lead fields. Do not infer one from the other. A future backfill requires a fresh inventory of the intended database and owner-approved classification of exact values; keep existing City values.
- Product remains in storage/API compatibility and export, although manual lead forms omit it.

## 7. API architecture

**Current implementation:** HTTP handlers live under `src/app/api/**/route.ts`. They use Next.js verb exports and shared auth wrappers. The API guide `docs/api.md` is the route/method/authorization inventory; consult it alongside current route source before changing a contract. Notable groups include auth, dashboard, health, leads, activities, follow-ups, notes, users, providers/routing, connectors/sync, parsers, scheduler, settings, reports, and export.

`withApiAuthorization()` checks authentication, active/banned/deleted account state, and optional roles. `withPermissionAuthorization()` adds permission checks. `requireSession()` is used by protected layouts/server pages. `src/proxy.ts` only improves redirects and must never be treated as access control. API errors are normalized through shared helpers; services use `ServiceError` for expected status-bearing failures.

## 8. Database schema and migration conventions

**Current schema:** `prisma/schema.prisma` defines 19 models and 17 enums in this checkout. Important domains include users/auth sessions, leads and sources, activity events/entries, notes, follow-ups, attachments, connectors/sync runs, parsers/routing/mappings, unmatched email/parser requests, and settings. Lead has nullable `city` and `district`; `leadNumber` is a stored string identifier, not a numeric sequence.

There are 21 checked-in migration directories at handover time. This is a file count, not a claim about what has been applied to any database. Determine deployment state with `pnpm db:migrate:status` pointed at the explicitly verified intended `DATABASE_URL`. Schema changes require reviewed Prisma migrations; inspect existing constraints/indexes first. A PostgreSQL partial unique index for one pending follow-up per lead is expressed in migration SQL because Prisma cannot represent its predicate.

Never use historical row counts or snapshots as current backfill data. Before database changes, verify the target, understand backup/recovery implications, and use an isolated test database for destructive/integration testing.

## 9. Authentication and authorization

**Current implementation:** Better Auth credentials login; public signup is disabled and users are provisioned by Admin. Roles are `ADMIN` and `SALES`; SALES can be JUNIOR or SENIOR. Admin passes all current granular permissions. Senior Sales receives `CREATE_LEAD`, `DELETE_LEAD`, `ARCHIVE_LEAD`, and `EXPORT_LEADS`; Junior Sales has no additional granular permissions. Routes also apply endpoint-specific role and ownership checks.

Session checks include active, banned, and deleted user state. Server-side checks are required even when the UI hides actions. Never expose `BETTER_AUTH_SECRET`, database credentials, Gmail tokens, scheduler secrets, or connector auth material in client props, logs, documentation, or responses.

## 10. Connector and integration architecture

**Current implementation:** The connector registry in `src/connectors/registry.ts` uses a private Map and registers Gmail and REST factories. `IConnector` implementations fetch raw payloads. Parser registry currently contains Example and Gmail parsers. Runtime coordinates execution, routing, parser selection, normalization/validation, lead creation, sync history, retry, and health information. Routing rules are evaluated by priority/order and may direct unmatched email into unmatched-email records.

Manual sync route and `ConnectorScheduler` own connector lock acquisition, heartbeat, and release through `ExecutionLock`. The lease is 90 seconds with heartbeat renewals every 20 seconds. They pass `assertExecutionOwnership` and an `ExecutionFence` (connector ID, execution ID, generation) to `ConnectorRuntime`; fenced transactions check the current DB lock before protected writes. Do not move ownership into a connector implementation.

Retry defaults are 3 retries after the initial attempt, exponential backoff from 1 second to a 30-second maximum; only classified retryable errors are retried. Scheduled execution is triggered externally through `POST /api/scheduler/trigger`; the app does not run a perpetual scheduler loop. Admin session may select a connector; machine bearer auth is restricted to due connectors.

REST integration includes URL/address validation, redirect constraints, response/request/page/time bounds, and development-only exact-origin allowances for private test endpoints. Preserve these checks; do not broaden allowlists or weaken redirect/DNS protections. Gmail credentials are discovered from `GMAIL_<KEY>_*` environment variables. Do not add Prisma/database dependencies to connector or parser modules.

## 11. Export architecture and current limitations

**Current implementation:** `GET /api/export` supports five live categories: leads, users, providers, sync history, and reports. `src/lib/export/` defines category/filter/policy contracts and legacy parameter adaptation. `src/services/export/` applies authorization/scope, query builders, explicit projections, deterministic keyset iteration, CSV serialization/streaming, deadlines, and operation logging.

Exports use fixed compatible CSV columns, count filtered rows, then fetch pages of up to 250. Limits are 50,000 rows, 25,000,000 serialized bytes, and a 30-second application deadline; each DB query uses a 15-second PostgreSQL statement timeout. No consistent database snapshot spans the full download, so concurrent changes can affect membership/values. Cancelling the response stops future iteration but does not immediately cancel an in-flight Prisma query. Operation logs are best-effort Pino events, not durable audit records. There is no preview/count endpoint, selectable columns, or background export job. No production export benchmark has been established.

Admin can export all current categories; Senior Sales export access is limited to leads, scoped to their own assigned non-deleted leads. Never widen scope from client-supplied filters. Activity filter predicates must remain correlated to the same activity event/entry as implemented.

## 12. Development environment and commands

Use `.env.example` as a placeholder-only template. Keep real values in local environment files and never copy them into this handover. Core commands from `package.json`:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate             # local development migration creation/application
pnpm exec prisma db seed    # seed configured in prisma.config.ts
pnpm dev

pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration       # isolated PostgreSQL database required
pnpm db:migrate:status
pnpm db:migrate:deploy      # apply checked-in migrations after target/backup review
```

`pnpm test` runs the configured database-independent test list. PostgreSQL integration tests are separate; `scripts/run-postgres-integration-tests.mjs` enforces a dedicated test database name and uses `LEADBRIDGE_TEST_DATABASE_URL`. Do not point integration or destructive tests at development/production data. The current package still exposes `pnpm db:push`; use migration workflows for schema changes and do not treat `db:push` as a substitute for checked-in migrations.

## 13. Testing and verification procedures

Routine checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`; release preparation should also run `pnpm build`. Run `pnpm test:integration` only with a provisioned isolated PostgreSQL test database. Tests include validation, UI/workflow contracts, exports, REST policy, and PostgreSQL lifecycle/fencing coverage. A test marked skipped is not a passing integration result.

**Observed verification at handover:** the latest run after updating a stale documentation-dependent test reported 136 passed, 1 skipped, 0 failed; typecheck and lint passed; `git diff --check` passed. This does not establish a production build, browser end-to-end behavior, live database state, or deployment state; those were not verified in this handover.

## 14. Deployment and local operations

**Intended model:** local Next.js process plus local PostgreSQL, with a trusted local scheduler trigger. The scheduler endpoint is invoked by external cron/system scheduler; it is not an internal background loop. Health liveness confirms the app answers; readiness runs a minimal PostgreSQL query.

Before deploying checked-in migrations, confirm the exact target database, review migration status, and take/verify a backup. Deployment command is `pnpm db:migrate:deploy`, not the development migration command. `docs/local-operations.md` contains local backup, restore-to-separate-database, health, and scheduler procedures. Those procedures are documented; no restore drill or hosting state is claimed as verified.

## 15. Important technical and business decisions

| Status | Decision / contract |
|---|---|
| Approved requirement | Single-tenant monolith; no microservices by default. |
| Approved requirement | Prisma remains the sole DB client/access path; no second DAL. |
| Approved requirement | API routes own mutations; services own business logic. |
| Current implementation | Activity history is `ActivityEvent` + `ActivityEntry`. |
| Current implementation | Pending follow-up replacement is transactional; multiple legacy pending tasks return conflict and are not silently repaired. |
| Current implementation | City and District remain distinct; no blind City-to-District backfill. |
| Current implementation | Lead data is not generally cached; selected dashboard/attention/settings data uses `unstable_cache` and tags. |
| Approved requirement | Keep OFFSET pagination for now; optimize only from measured need. Search uses `ILIKE` substring filters; do not introduce a new search system without evidence. |
| Unresolved | Database deployment/migration state depends on the intended `DATABASE_URL`; this repo inspection cannot establish it. |
| Unresolved | Business timezone/default-hour policy for follow-up scheduling is not configured. |
| Unresolved | District value classification/backfill requires a data owner and a fresh target inventory. |

## 16. Completed features and implementation status

**Current implementation present in source:** Admin and Sales dashboards/workspaces; lead listing/filtering/editing and assignment; role-aware lead workflows; activity history; notes and follow-up scheduling/completion/cancellation; provider/routing administration; Gmail and REST connectors; parser preview and unmatched-email support; scheduled/manual connector sync with fencing; CSV export; reports/settings/user management; readiness/liveness endpoints.

This is a feature inventory, not a claim that every possible edge case or deployment environment is validated. Dated implementation reports in `docs/audits/` describe their own completed scope and verification limits. Historical experiment reports that were removed are not required for understanding current behavior; current source and canonical guides are the reference.

## 17. Repository cleanup progress and remaining cleanup

**Observed worktree at handover:** The repository has ongoing, uncommitted cleanup changes. Among them are removals of `scripts/seed-leads.ts`, `scripts/phase2-smoke.ts`, `src/services/assignment.service.ts`, and empty barrel files under hooks/jobs/utils; removal of 24 listed experiment reports and all six archived docs; canonical documentation/index updates; and a test update replacing its dependency on deleted experiment 26. Review `git status --short` and the complete diff before committing. This handover does not imply those changes are committed or that the user wants all present worktree changes in one commit.

**Known stale documentation pointers (not changed here):** root `README.md` still names experiment reports that have been removed; `AGENTS.md` still says superseded documents live in `docs/archive/`, which no longer exists. Some dated audit/inventory text intentionally records the earlier tree. Update active navigation/instructions only in a separately approved documentation pass.

**Proposed, unapproved:** `docs/audits/SRC_DIRECTORY_CLEANUP_AUDIT.md` and other cleanup audits contain additional recommendations. They are proposals until the user approves a specific stage. The retained experiment reports 28 and 32 are indexed in `docs/experiments/README.md`; neither is canonical implementation guidance.

## 18. Known limitations and outstanding tasks

- Live DB contents, migration state, backups, credentials, and hosting/deployment status were not inspected or verified here.
- The standard test command skips at least one marked integration-related test; actual PostgreSQL integration requires the isolated DB setup.
- Browser-based visual/accessibility behavior is not established by unit/contract tests alone.
- Export performance and search/query latency are not backed by production benchmarks.
- Some connector API routes remain a direct-Prisma exception to the desired service boundary.
- The root README and AGENTS archive pointers need review; other old docs may also contain historical wording. Do not treat those discrepancies as permission for broad rewrites.
- Review current status/diff before commit because the handover was created in a dirty worktree.

## 19. Rejected approaches and constraints

**Approved constraints:** Avoid unnecessary refactoring and stylistic changes; do not add Redis, Elasticsearch, Kafka, microservices, or a new DAL without demonstrated need and explicit approval. Do not bypass API authorization, use server actions, introduce database behavior in connectors/parsers, resurrect `LeadActivity`/`AuditLog`, blindly backfill District, or claim migrations are deployed without target-DB verification. Preserve existing CSV/API compatibility unless a change is explicitly approved.

Do not edit `src/generated/prisma/` manually. Do not modify secrets or environment files without approval. Do not assume historical experiments or audit recommendations remain active. Do not broaden task scope from a cleanup recommendation without approval.

## 20. AI collaboration instructions and approval workflow

**User preferences / approved workflow:**

1. Prefer concise, professional, precise responses.
2. Use an audit-first development workflow: inspect existing behavior and dependencies before proposing changes.
3. Wait for explicit approval before implementation.
4. Implement only the approved scope; do not silently expand into adjacent cleanup or refactoring.
5. Verify changes with relevant tests/checks and report exact results and limitations.
6. Avoid unnecessary refactoring and preserve existing functionality.
7. Never modify secrets or environment files without approval; never include secret values in reports.

Start with `AGENTS.md` and `docs/README.md`, but apply the source-of-truth hierarchy above if they conflict with current source or each other. Use canonical guides for current behavior, then inspect relevant source, schema, migrations, config, and tests. Clearly distinguish fact, requirement, historical context, proposal, and unresolved state in every recommendation.
