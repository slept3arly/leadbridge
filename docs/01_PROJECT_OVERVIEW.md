# LeadBridge Project Overview

## Purpose

LeadBridge is an internal, role-based CRM for single-organization lead capture, provider routing, connector execution, parser-driven imports, sales tracking, and operational analytics.

This document serves as the entry point and high-level summary for the canonical LeadBridge documentation suite.

## Scope

- Single tenant / single organization
- Single Next.js deployment
- Single PostgreSQL database
- Internal sales team and system administrators
- No SaaS multi-tenant assumptions
- No microservices or external message queues required

The application is intentionally architected as a cohesive, maintainable monolithic Next.js CRM.

## Current Implementation State

The following core capabilities are fully implemented in the current codebase:

- **Authentication & Authorization**: Better Auth credentials-only login, cookie-based session management, session authorization helpers (`requireSession`, `withApiAuthorization`), and role separation (`ADMIN` and `SALES` roles, plus `JUNIOR`/`SENIOR` sales privileges).
- **User Administration**: Admin-managed user provisioning (`POST /api/users`), role updates (`PATCH /api/users/[id]`), active/banned status toggling, and assignment candidate listings.
- **Lead Operations**: Complete lead CRUD, pagination, multi-field filtering, full-text search, custom field JSON payloads, admin assignment (`POST /api/leads/[id]/assign`), and soft deletion (`DELETE /api/leads/[id]`).
- **Follow-ups Engine**: Scheduled follow-up tasks linked to leads and notes, date/time assignment, priority levels (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), status management (`PENDING`, `COMPLETED`, `CANCELLED`), and task list views (`/sales/tasks`).
- **Notes & Activity Tracking**: Rich note composer (`Note` model), pinned notes, customer interaction notes ("what I did" / "what customer said"), and audit activity stream (`LeadActivity` model).
- **Provider & Routing Architecture**: Provider registry (`LeadSource`), priority-based routing rule engine (`RoutingRule`) matching sender email, sender domain, subject line, recipient Gmail account, or catch-all fallback rules.
- **Connector Architecture**: Vendor-neutral `IConnector` contract, static registry (`gmail`, `rest`), in-process runtime execution (`ConnectorRuntime`), execution locking (`ExecutionLock`), backoff retry policies (`RetryPolicy`), health status tracking (`ConnectorHealthService`), and sync run history (`ConnectorSyncRun`).
- **REST Connector Implementation**: Configurable REST integration supporting multiple pagination strategies (`PAGE_NUMBER`, `OFFSET`, `CURSOR`, `NEXT_URL`, `TOKEN`), multiple authentication modes (`BASIC`, `BEARER`, `API_KEY`, `CUSTOM_HEADER`), array path extraction (`leadArrayPath`), and HTTP error classification.
- **Parser Framework**: Base parser class (`BaseParser`), static parser registry (`example`, `gmail`), deterministic lead normalization, validation warning checks (`LeadNormalizer`), parser preview API (`POST /api/parsers/preview`), and manifest tracking (`parserService.listForManagement()`).
- **Operational Review Queues**: Dedicated queues and admin workflows for `UnmatchedEmail` (emails failing routing rule matches) and `ParserRequest` (vendor lead samples requesting parser creation).
- **Audit Logging System**: Structured Pino logging and durable `AuditLog` table with human-readable action descriptions, JSON diff tracking, entity/actor filters, and dedicated CSV export (`GET /api/audit-logs/export`).
- **Analytics & Reports**: Admin analytics engine (`report.service.ts`) and visual reports UI (`/admin/reports`) for lead volume summaries, provider source distribution, salesperson assignment breakdowns, lead activity metrics, status distribution, and monthly conversion trends.
- **System Settings Engine**: Categorized system settings store (`Setting` model) with atomic server-side updates (`PATCH /api/settings`) and Zod validation.
- **Data Export Engine**: Server-side CSV generation service (`export.service.ts`) and UI components (`ExportButton`, `DateRangePicker`) supporting downloads for Leads, Users, Providers, Sync History, and Audit Logs.
- **Redesigned Dashboards**: Role-derived dashboards for Administrators (`/admin`) and Sales Representatives (`/sales`) featuring conversion rates, priority breakdowns, attention center cards, and real-time activity feeds.
- **Navigation Architecture**: Cohesive header Navbar combined with a responsive Bottom Navigation bar (`BottomNavigation`) featuring a dedicated "More" drawer menu (`BottomNavigationMenu`) for secondary administrative pages.

## Who This Is For

| Role | What They Need From The Docs |
| --- | --- |
| `ADMIN` | User provisioning, provider setup, routing rule configuration, connector management, sync history inspection, review queues, report generation, audit log inspection, system settings, and exports. |
| `SALES` | Lead ownership, working "My Leads", Attention Center follow-ups, note composition, status updates, activity tracking, and personal profile settings. |
| Developer | Architecture layers, component organization, connector development, parser development, API reference, runtime execution flow, and testing workflows. |

## Objectives and Business Goals

- Maintain a canonical, consistent lead repository across all inbound channels.
- Enforce strict role-based access control and preserve complete lead ownership history.
- Route inbound lead payloads deterministically from email and REST sources to correct providers and parsers.
- Isolate external integration contracts (connectors/parsers) from core domain services and UI.
- Provide full operational visibility through durable sync history, health metrics, and audit logs.

## Documentation Map

- [01_PROJECT_OVERVIEW.md](./01_PROJECT_OVERVIEW.md): Entry point, scope, implemented feature list, role expectations, and repository map.
- [02_ARCHITECTURE.md](./02_ARCHITECTURE.md): System architecture, layer responsibilities, execution flow diagrams, database schema, design system, and UI principles.
- [03_DEVELOPMENT_GUIDELINES.md](./03_DEVELOPMENT_GUIDELINES.md): Code conventions, connector/parser development, routing engine, export system, runtime validation, testing workflow, and known limitations.
- [04_ADMINISTRATION_AND_OPERATIONS.md](./04_ADMINISTRATION_AND_OPERATIONS.md): Administrator guide for UI workflows, system monitoring, deployment, recovery, and ops tasks.
- [05_ARCHITECTURE_AUDIT.md](./05_ARCHITECTURE_AUDIT.md): Architectural findings, ingestion pipeline audit, security model, and API route index.
- [06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md](./06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md): Technical reference for REST connector configuration, client execution, pagination, auth, and error handling.

## Repository Map

| Location | Responsibility |
| --- | --- |
| `src/app` | Next.js App Router pages, layouts, and route handlers. Dashboard routes live under `(dashboard)/admin` and `(dashboard)/sales`. |
| `src/components/admin` | Admin dashboard, reports UI, and settings UI components. |
| `src/components/sales` | Sales dashboard, Attention Center, follow-up panels, note composer, lead detail modals, and sales table controls. |
| `src/components/shared` | Cross-feature business components (Navbar, Bottom Navigation, SearchToolbar, ActiveFilters, DataTable, ExportButton, KpiCard, ResyncButton, DateRangePicker). |
| `src/components/ui` | Generic design system primitives (Button, Card, Badge, Input, Select, Pagination, SegmentedControl, DateTimeCell, IconActionButton, AnimatedReveal, Toast, Loading). |
| `src/components/audit` | Audit log viewer, human-readable action formatting, JSON diff viewer, and export trigger. |
| `src/components/connectors` | Connector management content, edit modal, and sync history modal. |
| `src/components/leads` | Admin lead management table, edit modal, and controls. |
| `src/components/providers` | Provider management content, edit modal, routing rule builder, and review queue tables. |
| `src/components/users` | User administration table, edit modal, and creation controls. |
| `src/services` | 22 domain services orchestrating business logic and Prisma data access. |
| `src/connectors` | Vendor-neutral connector contract (`IConnector`), Gmail and REST implementations, environment discovery, and static registry. |
| `src/parsers` | Base parser class (`BaseParser`), parser registry, example parser, and manifest definitions. |
| `src/runtime` | Connector execution engine (`ConnectorRuntime`), routing engine (`RoutingEngine`), parser runtime (`ParserRuntime`), lead normalizer (`LeadNormalizer`), execution lock (`ExecutionLock`), retry policy (`RetryPolicy`), health service (`ConnectorHealthService`), and sync history (`SyncHistory`). |
| `src/lib` | Auth setup (`auth.ts`, `auth-client.ts`), session enforcement (`session.ts`), API wrappers (`api.ts`), validation schemas (`validation.ts`), Prisma client (`prisma.ts`), navigation configuration (`navigation.tsx`), logger (`logger.ts`), query builder (`query-builder.ts`), and helpers. |
| `src/types` | Shared TypeScript domain types and normalized lead definitions. |
| `src/jobs` | Reserved location for background job execution utilities. |
| `prisma` | Database schema (`schema.prisma`), migrations, seed script (`seed.ts`), and configuration. |
| `src/generated/prisma` | Generated Prisma 7 client output (do not edit manually). |
| `scripts` | Development smoke tests and validation scripts. |

## Related Files

- [`README.md`](../README.md)
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`src/lib/session.ts`](../src/lib/session.ts)
- [`src/lib/api.ts`](../src/lib/api.ts)
- [`src/services/lead.service.ts`](../src/services/lead.service.ts)
- [`src/services/provider.service.ts`](../src/services/provider.service.ts)
- [`src/services/connector.service.ts`](../src/services/connector.service.ts)
- [`src/services/parser.service.ts`](../src/services/parser.service.ts)
- [`src/services/follow-up.service.ts`](../src/services/follow-up.service.ts)
- [`src/services/audit.service.ts`](../src/services/audit.service.ts)
- [`src/services/export.service.ts`](../src/services/export.service.ts)
- [`src/services/report.service.ts`](../src/services/report.service.ts)
