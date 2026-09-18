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

## Getting Started

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm prisma db seed
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

## Development Commands

```bash
pnpm lint        # Run ESLint
pnpm typecheck   # Run TypeScript compiler checks
pnpm build       # Build Next.js production bundle
```

## Documentation

Canonical documentation lives in `docs/`:

- [Architecture](docs/architecture.md) -- System design, request flow, layer responsibilities
- [Database](docs/database.md) -- Prisma schema, models, relationships, indexes
- [Backend](docs/backend.md) -- Service layer, business logic, shared libraries
- [Frontend](docs/frontend.md) -- Pages, components, design system, navigation
- [API Reference](docs/api.md) -- All API routes with methods and authorization
- [Authentication](docs/authentication.md) -- Better Auth setup, roles, permissions
- [Integrations](docs/integrations.md) -- Connectors, parsers, runtime engine
- [Performance](docs/performance.md) -- Current architecture, bottlenecks, optimization priorities
- [Development Guide](docs/development.md) -- Setup, conventions, commands

Experimental/reference documents (not canonical):

- [experiments/](docs/experiments/) -- Performance assessment, free-tier capacity analysis, hosting comparison
