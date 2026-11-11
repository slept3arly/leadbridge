# LeadBridge Documentation

> **Status:** Canonical
> **Last verified:** 2026-11-05

## Documentation Map

| Document | Purpose |
|---|---|
| [architecture.md](./architecture.md) | System architecture, request flow, layer responsibilities |
| [database.md](./database.md) | Prisma schema, models, relationships, indexes, enums |
| [backend.md](./backend.md) | Service layer, business logic, data access patterns |
| [frontend.md](./frontend.md) | Pages, components, UI design system, navigation |
| [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md) | Canonical UI reference, design tokens, component inventory, implementation contract |
| [api.md](./api.md) | API route reference with methods and authorization |
| [authentication.md](./authentication.md) | Better Auth setup, request proxy, roles, permissions |
| [integrations.md](./integrations.md) | Connectors, parsers, runtime engine, routing |
| [performance.md](./performance.md) | Current performance architecture, known bottlenecks |
| [development.md](./development.md) | Developer guide, conventions, setup, commands |
| [local-operations.md](./local-operations.md) | Local PostgreSQL migrations, backup/restore, readiness, and scheduler operations |
| [IMPLEMENTATION_AUDIT.md](./IMPLEMENTATION_AUDIT.md) | File-by-file audit of Admin dashboard improvements with implementation plan |

## Testing & Reference

| Document | Purpose |
|---|---|
| [rest-connector-testing.md](./rest-connector-testing.md) | Canonical step-by-step local REST connector setup, mock API tests, and troubleshooting |

## Experimental / Reference

These documents contain useful analysis and estimates but are **NOT** canonical implementation references:

| Document | Purpose |
|---|---|
| [experiments/07_PERFORMANCE_ARCHITECTURE_ASSESSMENT.md](./experiments/07_PERFORMANCE_ARCHITECTURE_ASSESSMENT.md) | 250k leads performance analysis (EXPERIMENTAL) |
| [experiments/08_FREE_TIER_CAPACITY_ASSESSMENT.md](./experiments/08_FREE_TIER_CAPACITY_ASSESSMENT.md) | Free-tier capacity estimates (EXPERIMENTAL) |
| [experiments/09_PERFORMANCE_BASELINE_AUDIT.md](./experiments/09_PERFORMANCE_BASELINE_AUDIT.md) | Code-level performance baseline audit (EXPERIMENTAL) |
| [experiments/11_LOCAL_MAX_PERFORMANCE_AUDIT.md](./experiments/11_LOCAL_MAX_PERFORMANCE_AUDIT.md) | Local deployment performance audit (EXPERIMENTAL) |
| [experiments/12_V1_PRODUCTION_READINESS_AUDIT.md](./experiments/12_V1_PRODUCTION_READINESS_AUDIT.md) | V1 production readiness assessment (EXPERIMENTAL) |
| [experiments/26_LEAD_WORKFLOW_BUSINESS_CONTRACTS.md](./experiments/26_LEAD_WORKFLOW_BUSINESS_CONTRACTS.md) | Approved lead workflow business contracts and Phase 5 backend lifecycle status |
| [experiments/27_DISTRICT_COMPATIBILITY_ASSESSMENT.md](./experiments/27_DISTRICT_COMPATIBILITY_ASSESSMENT.md) | Read-only District compatibility and city-value assessment |
| [experiments/28_WORKFLOW_ENUMS_AND_FORM_UX_AUDIT.md](./experiments/28_WORKFLOW_ENUMS_AND_FORM_UX_AUDIT.md) | Phase 9 read-only workflow enum, dropdown, default, and form-hint audit with proposals |
| [experiments/29_PLACEHOLDERS_AND_DEFAULTS_REVIEW.md](./experiments/29_PLACEHOLDERS_AND_DEFAULTS_REVIEW.md) | Phase 11 read-only inventory and owner recommendations for lead form placeholders, prompts, and defaults |
| [experiments/30_PLACEHOLDERS_AND_DEFAULTS_IMPLEMENTATION.md](./experiments/30_PLACEHOLDERS_AND_DEFAULTS_IMPLEMENTATION.md) | Phase 12 implementation record for approved lead placeholders and retained defaults |
| [experiments/31_LEAD_STATUS_AND_CUSTOM_DROPDOWNS.md](./experiments/31_LEAD_STATUS_AND_CUSTOM_DROPDOWNS.md) | Phase 13 Lead Status OLD addition and site-wide Radix dropdown migration |
| [experiments/HOSTING_COMPARISON_2026.md](./experiments/HOSTING_COMPARISON_2026.md) | Hosting platform comparison (EXPERIMENTAL) |

## Archived (superseded by canonical docs)

Historical documents preserved for context. Do not use as implementation guidance.

| Document | Status |
|---|---|
| [archive/01_PROJECT_OVERVIEW.md](./archive/01_PROJECT_OVERVIEW.md) | Content merged into architecture.md, database.md, api.md |
| [archive/02_ARCHITECTURE.md](./archive/02_ARCHITECTURE.md) | Content split into architecture.md, database.md, api.md, integrations.md |
| [archive/03_DEVELOPMENT_GUIDELINES.md](./archive/03_DEVELOPMENT_GUIDELINES.md) | Content merged into development.md and integrations.md |
| [archive/04_ADMINISTRATION_AND_OPERATIONS.md](./archive/04_ADMINISTRATION_AND_OPERATIONS.md) | Content merged into backend.md and development.md |
| [archive/05_ARCHITECTURE_AUDIT.md](./archive/05_ARCHITECTURE_AUDIT.md) | Verified findings merged into relevant canonical docs |
| [archive/06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md](./archive/06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md) | Content merged into integrations.md |

## Quick Start for Agents

1. Read `AGENTS.md` (repository root) for mandatory rules
2. Read this `docs/README.md` to find the right canonical guide
3. Consult the relevant canonical document for your task
4. Verify against source code before making changes
