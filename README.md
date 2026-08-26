# LeadBridge

LeadBridge is an internal, role-based CRM designed for single-organization lead capture, provider routing, connector execution, parser-driven imports, sales tracking, and comprehensive reporting.

The application is structured as a Next.js App Router application backed by PostgreSQL, Prisma 7, Better Auth, and a modular connector/parser runtime engine.

## Stack

- **Framework**: Next.js 16 (App Router, Server Components & Route Handlers)
- **Language**: TypeScript 5
- **Package Manager**: pnpm
- **Styling & UI**: Tailwind CSS v4, Lucide React, Custom Design System
- **Database & ORM**: PostgreSQL with Prisma 7 (`@prisma/adapter-pg` driver adapter)
- **Authentication**: Better Auth 1.6 (Credentials-only, session cookies)
- **Validation**: Zod
- **HTTP Client**: Axios & Fetch API
- **Logging**: Pino structured logger
- **Animation & Transitions**: GSAP

## Implemented Features

- **Authentication & Security**: Credentials login via Better Auth, session authorization helpers (`requireSession`, `withApiAuthorization`), role-based access control (`ADMIN` and `SALES` roles with `JUNIOR`/`SENIOR` sales privileges), server-side secret isolation.
- **Admin Dashboard**: Real-time KPI summaries (total leads, active connectors, conversion rates, priority breakdown), recent activity feed, and system health status.
- **Sales Dashboard & Panel**: Personal lead management ("My Leads"), interactive Attention Center (pending, today, needs-attention follow-ups), lead activity timeline, note composer, and salesperson profile.
- **Lead Management**: Full CRUD operations, custom field support, status transitions (`NEW`, `CONVERTED`, `LOST`, `SPAM`, `ON_HOLD`), priority classification, admin lead assignment, soft deletion and restoration.
- **Follow-ups Engine**: Scheduled follow-up tasks with date/time selectors, priority levels (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), completion tracking, and notification indicators.
- **Providers & Routing Rules**: Vendor source management (`LeadSource`), priority-based routing rule engine matching sender email, domain, subject, recipient account, or fallback catch-alls.
- **Connectors & Runtime Engine**: Static connector registry (`gmail`, `rest`), in-process execution with execution locks (`ExecutionLock`), automatic retries with exponential backoff (`RetryPolicy`), health status tracking (`ConnectorHealthService`), and sync history audit logging (`ConnectorSyncRun`).
- **REST Connector**: Configurable REST client supporting `PAGE_NUMBER`, `OFFSET`, `CURSOR`, `NEXT_URL`, and `TOKEN` pagination, multiple authentication mechanisms (`BASIC`, `BEARER`, `API_KEY`, `CUSTOM_HEADER`), array extraction via `leadArrayPath`, and error classification.
- **Parsers & Registration**: Static parser registry (`example`, `gmail`), deterministic lead normalization, validation warnings (`LeadNormalizer`), parser preview API, and admin parser catalog management.
- **Review Queues**: Operational queues for `UnmatchedEmail` (emails failing routing rules) and `ParserRequest` (vendor samples requesting parser development).
- **Audit Logging**: Structured Pino logging and durable `AuditLog` table with human-readable action formatting, JSON diff tracking, entity filtering, and dedicated CSV export.
- **Reports & Analytics**: Admin analytics API and visual reports for lead volume summaries, provider source distribution, salesperson assignment breakdowns, lead activity metrics, status distribution, and monthly conversion trends.
- **System Settings**: Categorized key-value system settings store with atomic server-side updates and type safety.
- **Data Export System**: CSV export engine supporting server-side streams/downloads for Leads, Users, Providers, Sync History, and Audit Logs.
- **Navigation System**: Header Navbar combined with responsive Bottom Navigation bar featuring a dedicated "More" drawer menu for secondary admin tools.

## Getting Started

### Local Bootstrap

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Generate Prisma Client:
   ```bash
   pnpm db:generate
   ```

3. Run database migrations:
   ```bash
   pnpm db:migrate
   ```

4. Seed the initial administrator account:
   ```bash
   pnpm prisma db seed
   ```

5. Start the development server:
   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## Environment Variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret key for Better Auth sessions |
| `BETTER_AUTH_URL` | Canonical server URL for authentication callbacks |
| `NEXT_PUBLIC_APP_URL` | Client-side base URL for the auth client |
| `ADMIN_NAME` | Initial administrator name for seed script |
| `ADMIN_EMAIL` | Initial administrator email for seed script |
| `ADMIN_PASSWORD` | Initial administrator password for seed script |
| `LOG_LEVEL` | Pino logging level (`info`, `debug`, `warn`, `error`) |
| `GMAIL_<KEY>_CLIENT_ID` | OAuth2 Client ID for a discovered Gmail account key |
| `GMAIL_<KEY>_CLIENT_SECRET` | OAuth2 Client Secret for a discovered Gmail account key |
| `GMAIL_<KEY>_REFRESH_TOKEN` | OAuth2 Refresh Token for a discovered Gmail account key |

## Folder Structure

```text
leadbridge/
├── docs/                      # Canonical project documentation
├── prisma/                    # Database schema, migrations, and seed script
├── public/                    # Static assets
├── scripts/                   # Development smoke tests and utilities
└── src/
    ├── app/                   # Next.js App Router pages, layouts, and API routes
    ├── components/            # UI components (admin, sales, shared, ui, audit, connectors, leads, providers, users)
    ├── connectors/            # Integration connector contracts, Gmail & REST implementations, and registry
    ├── generated/             # Prisma client output (auto-generated)
    ├── hooks/                 # Custom React hooks
    ├── jobs/                  # Background job definitions
    ├── lib/                   # Auth, Prisma client, session enforcement, navigation, validation, and utilities
    ├── middleware/            # Next.js edge middleware (cookie checks)
    ├── parsers/               # Parser base class, registry, and implementations
    ├── runtime/               # Connector runtime engine, routing, normalization, retries, sync history
    ├── services/              # Domain business services (22 domain services)
    ├── types/                 # Shared domain types
    └── utils/                 # General utility functions
```

## Development Commands

```bash
pnpm lint        # Run ESLint
pnpm typecheck   # Run TypeScript compiler checks
pnpm build       # Build Next.js production bundle
```

## Project Documentation

The documentation in `docs/` serves as the single source of truth for LeadBridge architecture, guidelines, and operations:

- [01_PROJECT_OVERVIEW.md](docs/01_PROJECT_OVERVIEW.md): Scope, state, objectives, role definitions, and repository map.
- [02_ARCHITECTURE.md](docs/02_ARCHITECTURE.md): System architecture, layer responsibilities, data flow diagrams, database schema, design system, and UI principles.
- [03_DEVELOPMENT_GUIDELINES.md](docs/03_DEVELOPMENT_GUIDELINES.md): Code conventions, connector/parser development, routing engine, export system, runtime validation, testing workflow, and known limitations.
- [04_ADMINISTRATION_AND_OPERATIONS.md](docs/04_ADMINISTRATION_AND_OPERATIONS.md): Administrator guide for UI workflows, system monitoring, deployment, recovery, and ops tasks.
- [05_ARCHITECTURE_AUDIT.md](docs/05_ARCHITECTURE_AUDIT.md): Architectural findings, ingestion pipeline audit, security model, and API route index.
- [06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md](docs/06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md): Deep-dive reference for REST connector configuration, client execution, pagination, auth, and error handling.
