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

No formal test framework is configured. Manual testing via:

1. **Parser preview:** `POST /api/parsers/preview`
2. **Connector test:** `POST /api/providers/connectors/test`
3. **Manual sync:** `POST /api/connectors/[id]/sync`
4. **Type checking:** `pnpm typecheck`
5. **Linting:** `pnpm lint`
6. **Smoke scripts:** `scripts/phase2-smoke.ts`, `scripts/phase3a-smoke.ts`

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
POST /api/scheduler/trigger
```

Configure Vercel Cron, system crontab, or GitHub Actions to call this endpoint at the desired interval.

**Note:** The repository contains no cron configuration (no `vercel.json`, no GitHub Actions workflow, no system crontab). The scheduler endpoint exists but must be triggered externally.

## Known Codebase Issues

These are verified implementation gaps, not architecture decisions:

1. **Dead audit code:** `src/lib/audit-export-params.ts` exports an empty object. Related to the removed `AuditLog` model. Should be deleted.

2. **Empty API directories:** `src/app/api/audit-logs/`, `src/app/api/mock/leads/`, `src/app/api/sync/`, `src/app/api/follow-ups/[id]/cancel/` contain no route files. Should be removed.

3. **Empty barrel files:** `src/hooks/index.ts` and `src/jobs/index.ts` export nothing. Consider removing or populating.

4. **No automated test framework:** No jest, vitest, or other test runner configured. No test files exist. Smoke scripts (`scripts/phase2-smoke.ts`, `scripts/phase3a-smoke.ts`) are manual integration tests.

5. **No CI/CD:** No GitHub Actions, GitLab CI, or other pipeline configuration.

6. **Redundant database index:** `@@index([connectorId, sourceReferenceId])` on Lead is redundant with `@@unique([connectorId, sourceReferenceId])`. The unique constraint already provides the index.

7. **No Vercel Cron configuration:** Scheduler endpoint exists but no cron trigger is configured in the repository. `.vercel` is gitignored but no `vercel.json` exists.
