# LeadBridge Documentation

> **Status:** Canonical documentation index
> **Last verified:** 2026-11-24

## How to use these documents

Current source code is authoritative for runtime behavior. This directory’s canonical guides describe the current system and take precedence over dated audits, implementation records, experiments, and archived snapshots. Those historical documents preserve evidence and decisions from their stated scope and date; their recommendations are not requirements unless separately approved. When a snapshot conflicts with current source or a canonical guide, follow the current source and canonical guide, and check the snapshot’s date and stated limitations.

- **Canonical guides** describe current behavior, architecture, operations, and development practices.
- **Audits** record a bounded review or cleanup inventory. They are dated snapshots, not automatically approved work.
- **Implementation records** capture completed work and its verification limits at the time of that work.
- **Experiments** contain historical assessments, investigations, proposals, contracts, and implementation records. Follow the status written in each document; an experiment or recommendation does not by itself establish current behavior.
- Archived material was removed in the approved documentation reduction; no `docs/archive/` directory remains.

See the [audit index](./audits/README.md) and [experiment index](./experiments/README.md) for complete inventories.

## Reading order

For a new contributor, start with [Development](./development.md), then read [Architecture](./architecture.md) and the relevant feature guide. Use [Local Operations](./local-operations.md) for the local PostgreSQL runbook.

## Canonical guides

| Document | Purpose |
|---|---|
| [architecture.md](./architecture.md) | System stack, request/data flow, layer responsibilities, and architectural decisions |
| [database.md](./database.md) | Prisma schema, models, relationships, indexes, enums, and migration files |
| [backend.md](./backend.md) | Services, business logic, workflows, and data-access patterns |
| [frontend.md](./frontend.md) | Pages, components, UI workflows, navigation, and loading states |
| [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md) | Design tokens, component inventory, accessibility guidance, and UI implementation contract |
| [api.md](./api.md) | API routes, methods, and authorization |
| [authentication.md](./authentication.md) | Better Auth, request proxy, roles, and permissions |
| [integrations.md](./integrations.md) | Connectors, parsers, runtime, routing, and scheduler behavior |
| [performance.md](./performance.md) | Current query/cache patterns and qualified performance estimates |
| [development.md](./development.md) | Setup, commands, conventions, and verification |
| [local-operations.md](./local-operations.md) | Local PostgreSQL migrations, backup/restore, readiness, and scheduler setup |
| [rest-connector-testing.md](./rest-connector-testing.md) | Manual REST connector setup, fixture testing, and troubleshooting |

## Other project records

| Document | Purpose and status |
|---|---|
| [IMPLEMENTATION_AUDIT.md](./IMPLEMENTATION_AUDIT.md) | Dashboard improvement plan marked “Ready for Implementation” when created in September 2026; consult current source before treating its observations or plan as current. |

## Quick Start for Agents

1. Read `AGENTS.md` (repository root) for mandatory rules.
2. Use this index to locate the relevant canonical guide.
3. Consult dated audits or experiments for historical evidence and decisions, checking their status and limitations.
4. Verify implementation claims against current source code.
