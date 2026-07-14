# LeadBridge

LeadBridge is the Version 1.0 foundation for an internal CRM lead aggregation platform. The codebase focuses on long-term architecture instead of feature sprawl: authentication, role-protected dashboards, lead CRUD, Prisma data modeling, service boundaries, and extension points for future connectors and parsers.

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
- Admin and Sales protected dashboard shells
- Admin-managed user creation
- Lead CRUD API and admin UI
- Prisma schema designed for extensibility
- Reusable services for leads, users, assignment, duplicates, connectors, parsers, audit, and automation stubs
- Connector abstraction and parser registry for future lead ingestion pipelines
- Placeholder APIs for connectors, sync, reports, and settings

## Getting Started

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: 32+ character secret for Better Auth
- `BETTER_AUTH_URL`: canonical app URL for auth callbacks and cookies
- `NEXT_PUBLIC_APP_URL`: client-side base URL for the auth client
- `LOG_LEVEL`: Pino logging level

## Suggested First Admin

Use the admin dashboard once an admin account exists. For first-time setup, create an initial admin user via Prisma Studio or a small seed script with role `ADMIN`.

## Folder Structure

- `src/app`: routes, layouts, and API handlers
- `src/components`: reusable UI and feature components
- `src/connectors`: connector contracts and future integrations
- `src/lib`: auth, Prisma, validation, logging, navigation, shared helpers
- `src/parsers`: parser base classes, registry, and examples
- `src/services`: business logic and data access orchestration
- `src/types`: shared domain types
- `prisma`: schema and migrations

## Development Workflow

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Roadmap

- Connector implementations for source systems
- Lead import jobs and queue workers
- richer analytics and reporting
- notes, attachments, and activity UI
- custom fields and configurable pipelines
- R2-backed document storage
