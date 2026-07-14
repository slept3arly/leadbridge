# LeadBridge: Project Overview

## Purpose

LeadBridge is an internal, role-based CRM foundation for collecting, managing, and eventually aggregating leads from multiple business sources. It is intentionally a foundation release: it establishes the authentication, data model, API, service boundaries, and extension seams needed for a durable lead-operations product without pretending that future integrations are already complete.

**Current version:** v1.0 Foundation

The product is for company-managed users only. It has no public registration flow; an initial administrator is seeded from environment variables and administrators provision subsequent internal accounts.

## Objectives and business goals

LeadBridge exists to give a sales operation one controlled place to:

- Maintain a reliable lead record and a basic sales pipeline.
- Separate administrative operations from individual sales work.
- Preserve an audit trail around lead changes and assignments.
- Prepare for ingestion from third-party sources without coupling the UI or core domain model to one vendor.
- Establish a secure, deployable base before investing in automation, reporting, or channel-specific features.

The immediate business goal is operational consistency: leads should be captured in a structured form, visible to the right role, and ready to be assigned and worked. The longer-term goal is a multi-source lead hub that reduces manual handoffs and makes source-to-outcome reporting possible.

## Intended users

| User | Current responsibilities |
| --- | --- |
| `ADMIN` | Access the administrative dashboard, manage users, manage all leads, view connector records, and use future administration capabilities. |
| `SALES` | Access a sales workspace and view assigned leads through the current sales views/API filtering. |
| System/integration | Not yet a runtime actor. Future connectors and parsers will ingest external lead records through defined contracts. |

## Current capabilities

Implemented and usable today:

- Credentials-based authentication through Better Auth.
- Seeded initial administrator using `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
- Public signup disabled; authenticated admins create internal accounts.
- Separate Admin and Sales layouts, navigation, redirects, and server-side role checks.
- Admin and Sales dashboard counts for total, open, and qualified leads (scoped to the sales user where appropriate).
- Manual lead creation, listing, update API, and admin-only deletion.
- Lead status and priority values, source and connector relations, assignment relation, and audit/activity records in the data model.
- Duplicate-candidate lookup by exact email or phone during lead creation; candidates are recorded in creation activity metadata but are not blocked or surfaced as a resolution workflow.
- Admin user listing and internal user creation.
- Reusable UI primitives and shared feature components.
- Connector and parser contracts, an example parser, and service stubs that establish future integration seams.

Present but intentionally not implemented as product functionality:

- Connector listing reads persisted connector records; no concrete external connector is registered.
- Sync, reporting, and settings API routes return explicit stub responses.
- Automation service and jobs directory are placeholders.
- Notes, attachments, activities, field mappings, settings, and parser records are modeled but do not yet have full UI/API workflows.

## Scope

### In scope for v1.0 Foundation

- Secure internal access and roles.
- A PostgreSQL-backed lead domain model.
- Manual lead workflows and user provisioning.
- Clear separation between route handlers, services, persistence, and UI.
- A Prisma 7-compatible deployment and bootstrap path.

### Out of scope today

- Production connector implementations or scheduled synchronization.
- Queue processing, notifications, messaging, and attachments storage.
- Rich reports, configurable pipelines, imports/exports, public API, mobile clients, or AI workflows.
- Fine-grained permissions beyond the two application roles.

## Design and coding philosophy

LeadBridge favors a small, explicit architecture over feature density:

- **Foundation before expansion.** Schema and interfaces may anticipate future work, but routes must not claim unimplemented behavior.
- **Internal by default.** Account creation is an administrator action, not a public funnel.
- **Server authority.** Middleware improves navigation, while `requireSession` enforces authentication and role checks where data is accessed.
- **Typed boundaries.** TypeScript, Zod, Prisma-generated types, and narrow service return selections make contracts visible.
- **Vendor isolation.** Connectors normalize outside records into the project domain instead of leaking vendor payloads throughout the application.
- **Small changes.** Preserve the existing App Router, service, and component architecture; extend it rather than replacing working code.

## Long-term vision

The intended product is a dependable lead bridge between acquisition channels and sales teams. A future LeadBridge should ingest from sources such as email, REST APIs, and lead-ad platforms; normalize and deduplicate records; route leads through automation; provide auditable outcomes and reporting; and expose carefully controlled integrations. The current codebase is the base layer for that path, not an assertion that those capabilities already exist.

## Current limitations

- Lead list queries are capped at 100 and have no pagination, search, or filtering API.
- Sales users can list only their assigned leads, but the current update endpoint does not yet enforce ownership; authorization must be strengthened before relying on it for multi-user production use.
- The connector framework has contracts only; there are no Gmail, REST, Meta, or other live integrations.
- Scheduled jobs, cache infrastructure, and background queues do not exist.
- Several data-model concepts are not exposed in the UI.
- API route error handling is currently minimal: validation failures return `400`, while database/auth errors generally use framework or Better Auth behavior.
- `src/middleware.ts` uses the current Next middleware convention, which Next 16 warns is being renamed to `proxy`.

## Repository map

| Location | Responsibility |
| --- | --- |
| `src/app` | Next.js App Router pages, layouts, and route handlers. Dashboard groups live in `(dashboard)`. |
| `src/components` | Feature components plus reusable `ui` primitives. |
| `src/services` | Business orchestration and Prisma-backed domain operations. |
| `src/lib` | Auth, session enforcement, Prisma client, validation, logging, navigation, and shared helpers. |
| `src/connectors` | Vendor-neutral connector contract. |
| `src/parsers` | Parser base class, registry, and example implementation. |
| `src/types` | Shared domain types, including normalized lead data. |
| `src/jobs` | Reserved background-job location; currently empty. |
| `prisma` | Prisma schema, migrations, configuration, and bootstrap seed. |
| `src/generated/prisma` | Generated Prisma 7 client output; never edit manually. |
| `docs` | Authoritative project context documents for developers and future AI sessions. |

Read this document first, then `02_ARCHITECTURE.md` for operational detail, `03_DEVELOPMENT_GUIDELINES.md` before making changes, and `04_ROADMAP.md` for delivery sequencing.
