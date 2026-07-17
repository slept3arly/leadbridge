# LeadBridge

LeadBridge is the backend foundation for an internal CRM. The codebase focuses on a small, maintainable feature set: authentication, role-protected dashboards, lead CRUD, provider routing, connector execution, parser-driven imports, reporting, settings, exports, and Prisma-backed service boundaries.

## Stack

- Next.js App Router
- TypeScript
- pnpm
- Tailwind CSS
- GSAP
- PostgreSQL (Neon-ready)
- Prisma
- Better Auth (credentials only)
- Zod
- Axios
- Pino
- Vercel-oriented deployment model

## Current Foundation

- Credentials-only login flow with Better Auth
- Admin and Sales protected dashboards
- Admin-managed user creation
- Lead CRUD API and admin UI
- Prisma schema designed for extensibility
- Reusable services for leads, users, assignment, duplicates, providers, connectors, parsers, audit, and scheduler/queue handling
- Gmail and REST connector implementations plus a static parser registry
- Active APIs for leads, users, providers, connectors, parsers, unmatched email handling, parser requests, and sync history
- Implemented `reports`, `settings`, `export`, and the legacy `sync` compatibility route

## Getting Started

```bash
pnpm install
pnpm db:generate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: Better Auth secret
- `BETTER_AUTH_URL`: canonical app URL for auth callbacks and cookies
- `NEXT_PUBLIC_APP_URL`: client-side base URL for the auth client
- `LOG_LEVEL`: Pino logging level
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: initial admin seed values
- `GMAIL_<KEY>_CLIENT_ID`, `GMAIL_<KEY>_CLIENT_SECRET`, `GMAIL_<KEY>_REFRESH_TOKEN`: Gmail connector credentials

## Suggested First Admin

Use the admin dashboard once an admin account exists. For first-time setup, seed the initial administrator with `pnpm prisma db seed`.

## Folder Structure

- `src/app`: routes, layouts, and API handlers
- `src/components`: reusable UI and feature components
- `src/connectors`: connector contracts and concrete integrations
- `src/lib`: auth, Prisma, validation, logging, navigation, shared helpers
- `src/parsers`: parser base classes, registry, and examples
- `src/services`: business logic and data access orchestration
- `src/runtime`: connector execution, routing, normalization, retries, and sync history
- `src/types`: shared domain types
- `prisma`: schema and migrations

## Development Workflow

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Documentation

- [docs/01_PROJECT_OVERVIEW.md](docs/01_PROJECT_OVERVIEW.md)
- [docs/02_ARCHITECTURE.md](docs/02_ARCHITECTURE.md)
- [docs/03_DEVELOPMENT_GUIDELINES.md](docs/03_DEVELOPMENT_GUIDELINES.md)
- [docs/04_ADMINISTRATION_AND_OPERATIONS.md](docs/04_ADMINISTRATION_AND_OPERATIONS.md)
