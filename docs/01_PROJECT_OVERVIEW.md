# LeadBridge Project Overview

## Purpose

LeadBridge is an internal, role-based CRM for one company. The repository now
contains the backend foundation for lead management, provider routing, connector
execution, and parser-driven imports.

This document is the entry point for the current documentation set.

## Scope

- Single tenant
- One deployment
- One PostgreSQL database
- Small internal sales team
- No SaaS assumptions
- No microservices assumptions

The app is intentionally sized for a small internal CRM, not an enterprise platform.

## Current state

Implemented today:

- Better Auth credentials login
- Admin and Sales role separation
- Admin-provisioned internal users
- Lead CRUD with pagination, filters, search, and restore
- Notes and lead activity tracking
- Provider records and routing rules
- Gmail and REST connector implementations
- Parser registry and parser preview endpoint
- Sync history, connector health, and execution locking
- Unmatched email and parser-request queues
- Audit logging and Pino logging
- Reports API for summaries, sources, assignments, activity, status, and monthly trends
- Settings API for reading and updating system configuration
- Export API for CSV downloads
- Dashboard metrics for admin and sales users
- Legacy `POST /api/sync` placeholder remains for compatibility

## Who this is for

| Role | What they need from the docs |
| --- | --- |
| `ADMIN` | How users, providers, connectors, routing, syncs, and queues work. |
| `SALES` | How lead ownership, notes, and follow-up workflows behave. |
| Developer | How to add connectors, add parsers, and deploy safely. |

## Objectives and business goals

- Keep lead records consistent.
- Preserve ownership and audit history.
- Route inbound records from supported sources.
- Keep connector behavior isolated from the core lead model.

## Documentation map

- [02_ARCHITECTURE.md](./02_ARCHITECTURE.md) explains the backend layers, runtime flow, data movement, and **Sales UI design principles** (the Design Reference for all Sales Panel pages).
- [03_DEVELOPMENT_GUIDELINES.md](./03_DEVELOPMENT_GUIDELINES.md) explains how to add connectors and parsers, and includes UI consistency requirements.
- [04_ADMINISTRATION_AND_OPERATIONS.md](./04_ADMINISTRATION_AND_OPERATIONS.md) explains the admin screens, deployment, and recovery.

Read this first if you need the current shape of the product. Read the other
documents when you need implementation detail.

## High-level summary

The product is a single-organization CRM with:

- authenticated internal users
- role-gated dashboards
- manual lead entry and editing
- provider routing and connector imports
- sync history and health tracking
- implemented reporting, settings, dashboard, and export APIs

## Repository map

| Location | Responsibility |
| --- | --- |
| `src/app` | Next.js App Router pages, layouts, and route handlers. Dashboard groups live in `(dashboard)`. |
| `src/components` | Organized into `ui/` (generic primitives), `shared/` (cross-feature business components), `admin/` (admin-only), and `sales/` (sales-only). The Sales Dashboard (`src/components/sales/sales-dashboard-client.tsx`) is the visual baseline for the Sales Panel. |
| `src/services` | Business orchestration and Prisma-backed domain operations. |
| `src/lib` | Auth, session enforcement, Prisma client, validation, logging, navigation, and shared helpers. |
| `src/connectors` | Vendor-neutral connector contract and concrete connector implementations. |
| `src/parsers` | Parser base class, registry, and parser implementations. |
| `src/runtime` | Connector execution, routing, normalization, retries, sync history, and error classes. |
| `src/types` | Shared domain types, including normalized lead data. |
| `src/jobs` | Reserved background-job location; currently empty. |
| `prisma` | Prisma schema, migrations, configuration, and bootstrap seed. |
| `src/generated/prisma` | Generated Prisma 7 client output; never edit manually. |
| `docs` | Backend-oriented documentation for developers and administrators. |

## Related files

- [`README.md`](../README.md)
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`src/lib/session.ts`](../src/lib/session.ts)
- [`src/lib/api.ts`](../src/lib/api.ts)
- [`src/services/lead.service.ts`](../src/services/lead.service.ts)
- [`src/services/provider.service.ts`](../src/services/provider.service.ts)
- [`src/services/connector.service.ts`](../src/services/connector.service.ts)
- [`src/services/parser.service.ts`](../src/services/parser.service.ts)
