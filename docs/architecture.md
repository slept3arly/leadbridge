# LeadBridge Architecture

> **Status:** Canonical
> **Last verified:** 2026-09-17
> **Source of truth:** `src/app/`, `src/services/`, `src/lib/`, `src/runtime/`, `prisma/schema.prisma`

## Overview

LeadBridge is a single-tenant, single-organization CRM built as a monolithic Next.js application. There are no microservices, no external message queues, and no separate backend service.

## Technology Stack

| Component | Version | Details |
|---|---|---|
| Framework | Next.js 16.2.10 | App Router, Server Components, Route Handlers |
| React | 19.2.4 | |
| TypeScript | ^5 | Strict mode |
| Database | PostgreSQL (Neon serverless) | |
| ORM | Prisma 7.8.0 | `@prisma/adapter-pg` driver adapter |
| Auth | better-auth 1.6.23 | Credentials-only, cookie sessions |
| Styling | Tailwind CSS v4 | |
| Validation | Zod ^4.4.3 | |
| Logging | Pino ^10.3.1 | Structured JSON |
| Package manager | pnpm | |

## Request/Data Flow

```text
Browser
  ↓
src/middleware.ts (cookie check, redirect unauthenticated)
  ↓
Next.js App Router
  ↓
Server Components (page.tsx) or Route Handlers (api/.../route.ts)
  ↓
src/lib/session.ts (requireSession / withApiAuthorization)
  ↓
src/services/*.service.ts (business logic, Prisma queries)
  ↓
src/lib/prisma.ts (PrismaClient singleton with PrismaPg adapter)
  ↓
PostgreSQL (Neon serverless, HTTP-based driver)
```

For connector/sync operations:

```text
POST /api/connectors/[id]/sync
  ↓
src/services/execution-lock.service.ts (acquire lock)
  ↓
src/runtime/connector-runtime.ts (orchestrate pipeline)
  ↓
src/connectors/ (GmailConnector or RestConnector fetches raw payloads)
  ↓
src/runtime/routing-engine.ts (match routing rules)
  ↓
src/runtime/parser-runtime.ts (parse payloads via registered parser)
  ↓
src/runtime/lead-normalizer.ts (validate and enrich)
  ↓
src/services/lead.service.ts (create lead in transaction)
  ↓
src/runtime/sync-history.ts (record ConnectorSyncRun)
  ↓
src/services/connector-health.service.ts (update health metrics)
```

## Architectural Layers

| Layer | Path | Responsibility |
|---|---|---|
| Middleware | `src/middleware.ts` | Cookie-based auth check, route protection |
| Pages (Server Components) | `src/app/(dashboard)/` | Server-rendered pages, data fetching |
| Route Handlers | `src/app/api/` | HTTP API endpoints |
| Session/Auth | `src/lib/session.ts`, `src/lib/api.ts` | Authorization guards, permission checks |
| Validation | `src/lib/validation.ts` | Zod schemas for request validation |
| Domain Services | `src/services/` | Business logic, Prisma queries, transactions |
| Connector Runtime | `src/runtime/` | Connector execution, routing, parsing, normalization |
| Integration Contracts | `src/connectors/`, `src/parsers/` | Vendor connector and parser implementations |
| Infrastructure | `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/lib/logger.ts` | Prisma client, Better Auth config, Pino logger |

## Key Architectural Decisions

1. **Server Components by default** -- All page components are async Server Components. Client components are used only for interactive UI (tables, modals, filters).

2. **No server actions** -- All mutations go through API routes (`src/app/api/`). This provides clear HTTP boundaries and makes authorization consistent.

3. **Service layer owns all business logic** -- API routes are thin wrappers that handle auth, validation, and call service methods. Services own Prisma queries and transaction boundaries.

4. **No second data-access architecture** -- All database access goes through Prisma. Do not introduce raw SQL queries outside of services, except for performance-critical aggregation queries already in `lead.service.ts` and `dashboard.service.ts`.

5. **ActivityEvent + ActivityEntry** -- The activity system uses a two-level model: `ActivityEvent` (the event header with type, actor, timestamp) and `ActivityEntry` (individual entries within an event with action, response, interest). This replaced an earlier `LeadActivity` model.

6. **Denormalized follow-up fields** -- `Lead.nextFollowUpAt` and `Lead.lastFollowUpAt` are maintained by `recalculateLeadFollowUpFields()` inside transactions. Do not bypass this mechanism.

7. **In-process connector execution** -- Connectors run synchronously in the Node.js process using database locks (`ExecutionLock`). There is no external job queue (Redis, BullMQ, etc.).

8. **Fresh reads for CRM data** -- Lead lists, details, notes, and follow-ups are NOT cached. Dashboard aggregates and settings use `unstable_cache` with tag-based invalidation.

## Route Group Structure

```text
src/app/
├── page.tsx                    # Root redirect
├── login/page.tsx              # Login page
├── (dashboard)/
│   ├── admin/                  # Admin routes (requires ADMIN role)
│   │   ├── page.tsx            # /admin - Dashboard
│   │   ├── leads/page.tsx      # /admin/leads
│   │   ├── users/page.tsx      # /admin/users
│   │   ├── providers/page.tsx  # /admin/providers
│   │   ├── connectors/page.tsx # /admin/connectors
│   │   ├── reports/page.tsx    # /admin/reports
│   │   └── settings/page.tsx   # /admin/settings
│   └── sales/                  # Sales routes (requires SALES role)
│       ├── page.tsx            # /sales - Dashboard
│       ├── my-leads/page.tsx   # /sales/my-leads
│       ├── tasks/page.tsx      # /sales/tasks (Attention Center)
│       └── profile/page.tsx    # /sales/profile
└── api/                        # API routes (see api.md)
```

## Component Organization

| Directory | Scope | Examples |
|---|---|---|
| `src/components/ui/` | Generic primitives | Button, Card, Badge, Input, Select, Pagination |
| `src/components/shared/` | Cross-feature | Navbar, BottomNavigation, DataTable, ExportButton |
| `src/components/admin/` | Admin-only | AdminDashboardClient, AdminReports, AdminSettings |
| `src/components/sales/` | Sales-only | SalesDashboardClient, AttentionCenter, LeadDetailDialog |
| `src/components/leads/` | Lead management | AdminLeadsPageContent, LeadEditModal |
| `src/components/connectors/` | Connector mgmt | ConnectorsPageContent, ConnectorEditModal |
| `src/components/providers/` | Provider mgpt | ProvidersPageContent, RoutingRulesManager |
| `src/components/users/` | User mgmt | UsersPageContent, UserEditModal |

Note: `src/components/audit/` does not exist in the current codebase. The old documentation referenced an audit log viewer component and `/api/audit-logs` endpoint, but these were removed when the `AuditLog` model was dropped in migration `20260913120000_remove_lead_activity_and_audit_log`. Activity tracking now uses `ActivityEvent` + `ActivityEntry` exclusively.
