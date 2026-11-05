# LeadBridge Development Guide

> **Status:** Canonical
> **Last verified:** 2026-09-17
> **Source of truth:** `package.json`, project conventions

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Generate Prisma Client
pnpm db:generate

# 3. Apply database migrations
pnpm db:migrate

# 4. Seed initial admin account
pnpm prisma db seed

# 5. Start development server
pnpm dev
```

## Available Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start Next.js development server |
| `pnpm build` | Build production bundle |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript compiler checks |
| `pnpm test` | Run database-independent Node.js tests |
| `pnpm test:integration` | Run PostgreSQL integration tests; requires `LEADBRIDGE_TEST_DATABASE_URL` |
| `pnpm db:generate` | Generate Prisma Client |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:push` | Push schema changes without migration |
| `pnpm seed:leads` | Seed 25 test leads (refuses to run in production) |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Better Auth session secret |
| `BETTER_AUTH_URL` | Yes | Canonical app URL |
| `NEXT_PUBLIC_APP_URL` | Yes | Client-side base URL |
| `ADMIN_NAME` | Yes | Initial admin name (seed) |
| `ADMIN_EMAIL` | Yes | Initial admin email (seed) |
| `ADMIN_PASSWORD` | Yes | Initial admin password (seed) |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |
| `LEADBRIDGE_TEST_DATABASE_URL` | Integration tests | Connection URL for an isolated PostgreSQL test database; database name must contain `test` |
| `GMAIL_<KEY>_CLIENT_ID` | Conditional | Gmail OAuth credentials |
| `GMAIL_<KEY>_CLIENT_SECRET` | Conditional | Gmail OAuth credentials |
| `GMAIL_<KEY>_REFRESH_TOKEN` | Conditional | Gmail OAuth credentials |

## Conventions

| Concern | Convention | Example |
|---|---|---|
| Files | `kebab-case` | `lead-edit-modal.tsx` |
| Components | `PascalCase` | `LeadEditModal` |
| Services | `src/services/<domain>.service.ts` | Export class + singleton |
| Route handlers | `src/app/api/.../route.ts` | HTTP verb exports |
| Imports | `@/` alias for `src/` | `import { prisma } from "@/lib/prisma"` |

## Non-Negotiable Principles

1. **Extend existing architecture** -- Retain service boundaries, runtime pipelines, component structure.
2. **Isolate integrations** -- Connector/parsers stay isolated from core CRM and UI.
3. **Deterministic parsers** -- Parsers are side-effect free, no database access.
4. **Server-enforced authorization** -- Client UI is for UX only. Security on server via `requireSession`, `withApiAuthorization`, `withPermissionAuthorization`.
5. **Disabled public signup** -- Users provisioned by admins only.
6. **Design system consistency** -- Conform to surface hierarchy and design tokens.

## Adding a New Connector

1. Implement `IConnector` in `src/connectors/<type>/`
2. Register in `src/connectors/registry.ts`: `factoryRegistry.set("type", (config) => new MyConnector(config))`
3. Do NOT call Prisma or modify DB inside connector code
4. Throw typed runtime errors on failure

## Adding a New Parser

1. Extend `BaseParser` in `src/parsers/`
2. Register in `src/parsers/registry.ts`: `parserRegistry.set("key", new MyParser())`
3. Keep parsers side-effect free and deterministic

## Testing

Tests use Node's built-in test runner through the existing `tsx` dependency. Ordinary tests do not connect to a database:

```bash
pnpm test
```

PostgreSQL integration tests are run separately. They require `LEADBRIDGE_TEST_DATABASE_URL`; the integration command fails if it is missing, malformed, non-PostgreSQL, or names a database without `test` in its name. The integration tests also retain their own database-name safeguards.

Provision a **dedicated isolated PostgreSQL test database**, apply the repository migrations to it, and set `LEADBRIDGE_TEST_DATABASE_URL` to its connection URL before running:

```bash
pnpm test:integration
```

The integration test files set `DATABASE_URL` from `LEADBRIDGE_TEST_DATABASE_URL` before initializing Prisma. Never point this variable at a development or production database. The suite creates uniquely named fixtures and cleans them up when tests finish.

Routine development verification:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Before release, also run `pnpm build` and run `pnpm test:integration` when the isolated test database is available.

## Production Deployment

```bash
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm build
pnpm start
```

## Scheduler Setup

The scheduler requires an external cron trigger:

```bash
curl -X POST "$LEADBRIDGE_URL/api/scheduler/trigger" \
  -H "Authorization: Bearer $SCHEDULER_TRIGGER_SECRET"
```

Set a long random `SCHEDULER_TRIGGER_SECRET` in the server environment and configure Vercel Cron, system crontab, or another trusted scheduler to send it as a bearer token. Keep the secret in the scheduler's secret store. Admins can also call the endpoint using their authenticated session.

**Note:** The repository contains no cron configuration (no `vercel.json`, no GitHub Actions workflow, no system crontab). The scheduler endpoint exists but must be triggered externally.

## Known Codebase Issues

These are verified implementation gaps, not architecture decisions:

1. **Dead audit code:** `src/lib/audit-export-params.ts` exports an empty object. Related to the removed `AuditLog` model. Should be deleted.

2. **Empty API directories:** `src/app/api/audit-logs/`, `src/app/api/mock/leads/`, `src/app/api/sync/`, `src/app/api/follow-ups/[id]/cancel/` contain no route files. Should be removed.

3. **Empty barrel files:** `src/hooks/index.ts` and `src/jobs/index.ts` export nothing. Consider removing or populating.

4. **No CI/CD:** No GitHub Actions, GitLab CI, or other pipeline configuration.

5. **Redundant database index:** `@@index([connectorId, sourceReferenceId])` on Lead is redundant with `@@unique([connectorId, sourceReferenceId])`. The unique constraint already provides the index.

6. **No Vercel Cron configuration:** Scheduler endpoint exists but no cron trigger is configured in the repository. `.vercel` is gitignored but no `vercel.json` exists.
