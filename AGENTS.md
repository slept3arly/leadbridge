# AGENTS.md -- LeadBridge

> Instructions for AI/code agents working in this repository.

## Project

LeadBridge is an internal, single-tenant CRM built as a monolithic Next.js 16 App Router application with PostgreSQL (Neon), Prisma 7, and Better Auth.

## Source of Truth Hierarchy

When documentation conflicts with code, use this hierarchy:

1. **Current source code** (authoritative)
2. **Prisma schema** (`prisma/schema.prisma`)
3. **package.json** and runtime configuration
4. **Tests** (if any)
5. **Canonical docs** (`docs/`)
6. **Experimental docs** (`docs/experiments/`)

**Never blindly follow documentation.** If docs conflict with code, investigate and update the docs.

## Architecture Rules

- **Business logic belongs in services** (`src/services/`). API routes are thin wrappers.
- **Database access goes through Prisma** via `src/lib/prisma.ts`. Do not introduce a second data-access layer.
- **All mutations go through API routes** (`src/app/api/`). No server actions.
- **Authorization on server** via `requireSession()`, `withApiAuthorization()`, `withPermissionAuthorization()`.
- **ActivityEvent + ActivityEntry** is the activity system. Do not reintroduce `LeadActivity` or `AuditLog`.
- **Denormalized fields** (`Lead.nextFollowUpAt`, `Lead.lastFollowUpAt`) are maintained by `recalculateLeadFollowUpFields()` in transactions. Do not bypass this.
- **Connectors are isolated** from core CRM. Do not call Prisma inside connector code.
- **Parsers are deterministic** and side-effect free. No database access.

## Database Rules

- Inspect `prisma/schema.prisma` before changing models
- Understand existing indexes before adding new ones (43 `@@index` + 2 `@@unique` + 12 field-level `@unique`)
- The `@@unique([connectorId, sourceReferenceId])` constraint makes the separate `@@index([connectorId, sourceReferenceId])` redundant
- Use migrations (`pnpm db:migrate`) for schema changes
- Avoid destructive operations unless explicitly requested
- Use `EXPLAIN (ANALYZE, BUFFERS)` when investigating query performance

## Performance Rules

- Avoid N+1 queries
- Avoid loading unnecessary columns/relations
- Use SQL aggregation instead of loading rows into memory
- Preserve OFFSET pagination for now (it works at current scale)
- Search uses `ILIKE '%term%'` -- acceptable at <15k leads
- Do not add Redis, Elasticsearch, or Kafka without demonstrated need
- Dashboard uses `unstable_cache` with tag-based invalidation -- this is correct for CRM data

## Search Rules

Current search: `ILIKE '%term%'` across 5 fields (displayName, company, email, phone, leadNumber).

- Acceptable at <15k leads (~100-200ms)
- At higher scale, consider GIN trigram index or PostgreSQL full-text search
- Do not introduce a new search system unless measurements justify it

## Caching Rules

- CRM data (leads, notes, follow-ups) is NOT cached -- correct for frequently-changing data
- Dashboard aggregates and settings are cached via `unstable_cache`
- Cache invalidation via `invalidateAfterMutation()` handles all cases
- Do not blindly cache fresh CRM data

## Documentation Rules

When changing implementation:

1. Update affected canonical docs in `docs/`
2. Remove stale claims
3. Mark estimates as estimates
4. Never document code that does not exist

## Key Files

| Purpose | Path |
|---|---|
| Prisma schema | `prisma/schema.prisma` |
| Prisma client | `src/lib/prisma.ts` |
| Auth config | `src/lib/auth.ts` |
| Session helpers | `src/lib/session.ts` |
| API auth wrappers | `src/lib/api.ts` |
| Permissions | `src/lib/permissions.ts` |
| Validation schemas | `src/lib/validation.ts` |
| Query builder | `src/lib/query-builder.ts` |
| Lead service | `src/services/lead.service.ts` |
| Dashboard service | `src/services/dashboard.service.ts` |
| Activity service | `src/services/activity-event.service.ts` |
| Connector runtime | `src/runtime/connector-runtime.ts` |
| Routing engine | `src/runtime/routing-engine.ts` |
| Middleware | `src/middleware.ts` |
| Package config | `package.json` |

## Verification

Before considering changes complete:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Schema changes use migrations
- [ ] New indexes are justified by query patterns
- [ ] Authorization is enforced on server, not just client
- [ ] Activity events are recorded for mutations
- [ ] Denormalized fields are maintained in transactions
