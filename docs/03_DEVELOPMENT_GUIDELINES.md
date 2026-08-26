# LeadBridge Developer Guidelines & Extension Reference

## Purpose

This document provides developer instructions for contributing to LeadBridge. It details project conventions, component catalog, connector development, parser authoring, routing rule configuration, export engine integration, runtime validation, testing workflows, and known system limitations.

---

## Non-Negotiable Principles

1. **Extend Existing Architecture**: Retain the existing service boundaries, runtime pipelines, and component structure.
2. **Isolate Integrations**: Keep connector payload fetching and parser transformations isolated from core CRM domain services and UI code.
3. **Deterministic Parsers**: Parsers must remain side-effect free, deterministic, and isolated from database operations.
4. **Server-Enforced Authorization**: Client UI state, middleware, and navigation menus are for UX only. All data security must be enforced on the server via `requireSession`, `withApiAuthorization`, or `withPermissionAuthorization`.
5. **Disabled Public Signup**: Public account creation must remain disabled. Users are provisioned exclusively by administrators.
6. **Design System & UI Consistency**: Sales and Admin panel pages must conform to the surface hierarchy, component density, and design tokens established in [02_ARCHITECTURE.md](./02_ARCHITECTURE.md).

---

## Project Conventions & Directory Structure

| Concern | Convention | Example |
| --- | --- | --- |
| **Files** | `kebab-case` | `lead-edit-modal.tsx`, `export.service.ts` |
| **Components** | `PascalCase` | `LeadEditModal`, `KpiCard` |
| **Services** | `src/services/<domain>.service.ts` | Export one class and one singleton instance (`leadService`) |
| **Route Handlers** | `src/app/api/.../route.ts` | Use Next.js App Router HTTP verb exports (`GET`, `POST`, `PATCH`, `DELETE`) |
| **Imports** | Use `@/` alias for `src/` root | `import { prisma } from "@/lib/prisma";` |

```text
src/
├── app/                      # Next.js App Router pages and API routes
├── components/               # React components divided by domain & scope
│   ├── admin/                # Admin dashboard, reports, settings
│   ├── audit/                # Audit log viewer, human-readable actions
│   ├── connectors/           # Connector table, modal, sync history
│   ├── leads/                # Lead list, edit modal, table controls
│   ├── providers/            # Provider management, edit modal, queues
│   ├── sales/                # Sales dashboard, Attention Center, follow-ups, notes
│   ├── shared/               # Navbar, BottomNavigation, SearchToolbar, ExportButton
│   ├── ui/                   # Generic primitives (Button, Card, Badge, Input, Select)
│   └── users/                # User table, edit modal, controls
├── connectors/               # Connector contracts (IConnector), Gmail, REST, registry
├── lib/                      # Auth, Prisma client, session, navigation, validation
├── parsers/                  # BaseParser, registry, example, gmail parsers
├── runtime/                  # ConnectorRuntime, RoutingEngine, ParserRuntime, LeadNormalizer
├── services/                 # 22 business domain services
└── types/                    # Shared TypeScript types
```

---

## Shared UI Component Catalog

Always reuse existing primitives and shared components before creating custom UI elements:

| Category | Component | Path | Description |
| --- | --- | --- | --- |
| **UI Primitive** | `Button` | `src/components/ui/button.tsx` | Standard button with variant, size, and `isLoading` spinner state |
| **UI Primitive** | `Card` / `CardEmptyState` | `src/components/ui/card.tsx` | Elevated container surface adhering to surface hierarchy |
| **UI Primitive** | `Badge` | `src/components/ui/badge.tsx` | Status, priority, and channel indicator badge |
| **UI Primitive** | `Input` / `Select` / `Textarea` | `src/components/ui/` | Standardized form input primitives |
| **UI Primitive** | `Pagination` | `src/components/ui/pagination.tsx` | Page controls matching `{ page, limit, total, totalPages }` |
| **UI Primitive** | `SegmentedControl` | `src/components/ui/segmented-control.tsx` | Horizontal tab/pill toggle control |
| **UI Primitive** | `DateTimeCell` | `src/components/ui/date-time-cell.tsx` | Formatted date and time display component |
| **Shared** | `Navbar` | `src/components/shared/navbar.tsx` | Header navigation bar |
| **Shared** | `BottomNavigation` | `src/components/shared/navigation/BottomNavigation.tsx` | Fixed responsive bottom navigation bar |
| **Shared** | `BottomNavigationMenu` | `src/components/shared/navigation/BottomNavigationMenu.tsx` | Drawer menu for secondary admin links |
| **Shared** | `DataTable` | `src/components/shared/data-table.tsx` | Reusable data table with loading and empty states |
| **Shared** | `ExportButton` | `src/components/shared/export-button.tsx` | Triggers CSV exports with loading toast feedback |
| **Shared** | `DateRangePicker` | `src/components/shared/date-range-picker.tsx` | Date range selector for reports and exports |
| **Shared** | `KpiCard` | `src/components/shared/kpi-card.tsx` | Standard summary metric display card |
| **Shared** | `ResyncButton` | `src/components/shared/resync-button.tsx` | Manual UI refresh and resync action |
| **Shared** | `BlueprintBackground` | `src/components/shared/blueprint-background.tsx` | Grid backdrop for utility screens |

---

## Connector Development

Connectors extract raw lead payloads from external platforms and convert them into standard `RawPayload[]` arrays.

### 1. Implement `IConnector`

Contract location: `src/runtime/runtime-types.ts`.

```typescript
export interface IConnector {
  readonly key: string;
  execute(context: ExecutionContext): Promise<RawPayload[]>;
}
```

Rules for connector implementations:
- Return source-shaped raw payloads inside `RawPayload[]`.
- Populate `_routing` hints (`senderEmail`, `senderDomain`, `subject`, `recipientGmailAccount`) whenever available.
- Populate `_duplicateKey` when an external stable reference ID is present.
- Throw typed runtime errors (`RestAuthError`, `RestNetworkError`, etc.) on failure.
- Do **not** call Prisma or modify the database inside connector code.

### 2. Register Connector Factory

Register new connector types in `src/connectors/registry.ts`:

```typescript
factoryRegistry.set("custom_type", (config) => new CustomConnector(config));
```

### 3. Current Registered Connectors

- **`gmail`** (`GmailConnector`): Uses `GMAIL_<KEY>_*` environment variables to access Gmail via OAuth2.
- **`rest`** (`RestConnector`): Uses `RestClient` to fetch endpoints supporting `PAGE_NUMBER`, `OFFSET`, `CURSOR`, `NEXT_URL`, and `TOKEN` pagination, and `BASIC`, `BEARER`, `API_KEY`, or `CUSTOM_HEADER` auth.

---

## Parser Development

Parsers accept raw payload objects and return a clean `NormalizedLead` object.

### 1. Extend `BaseParser`

Base class location: `src/parsers/base-parser.ts`.

```typescript
import { BaseParser } from "./base-parser";
import { NormalizedLead } from "@/types";

export class CustomParser extends BaseParser<Record<string, unknown>> {
  key = "custom_parser_key";

  parse(input: Record<string, unknown>): NormalizedLead {
    return {
      name: String(input.name ?? input.fullName ?? "Unknown Lead"),
      email: typeof input.email === "string" ? input.email : undefined,
      phone: typeof input.phone === "string" ? input.phone : undefined,
      company: typeof input.company === "string" ? input.company : undefined,
      requirement: typeof input.requirement === "string" ? input.requirement : undefined,
      rawPayload: input,
    };
  }
}
```

### 2. Register in Parser Registry

Add the parser instance to `parserRegistry` in `src/parsers/registry.ts`:

```typescript
parserRegistry.set("custom_parser_key", new CustomParser());
```

### 3. Parser Manifests

Manifests inform the admin UI about parser capabilities. Update `parserService.listForManagement()` in `src/services/parser.service.ts` so the manifest is synced into the `Parser` table.

---

## Adding Providers & Routing Rules

1. **Provider (`LeadSource`)**: Created via `POST /api/providers`. Providers group routing rules and connectors under a common vendor slug.
2. **Routing Rules (`RoutingRule`)**: Created via `POST /api/providers/routing-rules`. Rules match inbound payloads by:
   - `senderEmail`: Exact match (case-insensitive)
   - `senderDomain`: Domain suffix match (`@example.com`)
   - `subjectContains`: Substring match on subject line
   - `recipientGmailAccount`: Exact match on recipient email
   - `fallback`: Boolean catch-all flag matching all payloads
   - Each rule specifies a target `providerId` and `parserId`.

---

## Export System Architecture

The export system is handled by `ExportService` (`src/services/export.service.ts`):

- **Supported Types**: `leads`, `users`, `providers`, `sync-runs`, `audit-logs`.
- **Supported Formats**: CSV (`format=csv`).
- **Endpoint**: `GET /api/export` (and `GET /api/audit-logs/export`).
- **Implementation**: Queries Prisma records using filters (`dateRange`, `status`, `role`, etc.), sanitizes fields, builds CSV rows, and sets `Content-Type: text/csv` headers.

---

## Runtime Validation & Error Handling

Validation is performed at the route boundary using Zod schemas (`src/lib/validation.ts`) and at the runtime boundary using `LeadNormalizer` (`src/runtime/lead-normalizer.ts`).

### Runtime Error Hierarchy (`src/runtime/runtime-errors.ts`)

- `RuntimeError`: Base error class.
  - `ConfigurationError`: Invalid connector or parser configuration.
  - `ConnectorError`: Source fetching failure.
  - `ParserError`: Failure during payload parsing.
  - `ValidationError`: Lead payload failed normalization validation.
  - `RetryableError`: Transient network/rate-limit error eligible for automatic retries.

---

## Testing Workflow

1. **Parser Preview**: Test parser output against sample JSON payloads using `POST /api/parsers/preview`.
2. **Connector Connection Test**: Test Gmail or REST connector configuration using `POST /api/providers/connectors/test`.
3. **Manual Sync Execution**: Exercise end-to-end sync, duplicate detection, and lead creation using `POST /api/connectors/[id]/sync`.
4. **REST Connector Testing**: Use an externally supplied test fixture or a separately hosted local JSON endpoint; the production application does not expose mock data routes.
5. **Type Checking & Linting**:
   ```bash
   pnpm typecheck
   pnpm lint
   ```

---

## Known Limitations & Planned Enhancements

This section explicitly documents intentionally incomplete features and architectural trade-offs:

1. **Secret Management UI vs Server Environment / DB Storage**:
   - Gmail OAuth credentials are stored strictly in server environment variables (`GMAIL_<KEY>_*`).
   - REST connector auth tokens/keys are stored in `Connector.configuration` (DB JSON column) and intentionally excluded from client serialization.
   - *Future Enhancement*: Implement a encrypted secrets manager for editing REST API keys in the Admin UI.

2. **REST Configuration Form UI**:
   - Connectors can be created and toggled in the Admin UI, but REST-specific endpoints, headers, and pagination parameters must be set via direct API calls (`PATCH /api/connectors/[id]/settings`) or database seeds.
   - *Future Enhancement*: Add a form tab in `ConnectorEditModal` for editing REST endpoints and pagination settings.

3. **Routing Rules for Non-Email REST Payloads**:
   - The `RoutingRule` model is oriented toward email fields (`senderEmail`, `senderDomain`, `subjectContains`). REST payloads derive routing hints from matching record fields (`email`, `domain`, `subject`). REST payloads lacking email fields rely on catch-all fallback rules (`fallback: true`).
   - *Future Enhancement*: Expand `RoutingRule` with generic JSON payload field matching.

4. **In-Process Scheduler vs Distributed Job Queue**:
   - The scheduler (`ConnectorScheduler`) and manual syncs run synchronously in-process using database locks (`ExecutionLock`). There is no external Redis/BullMQ worker pool.
   - *Future Enhancement*: Migrate sync execution to a distributed background worker system if scale demands it.

5. **Audit Log Retention & Automated Purging**:
   - `AuditLog` records persist indefinitely in PostgreSQL. CSV exports allow archiving, but automated cron-based log purging is not currently enabled.
   - *Future Enhancement*: Add a background retention cleanup job to archive/purge audit logs older than a configurable retention period (e.g. 90 days).

6. **Lead Sync Update Matching**:
   - Sync executions create new leads when external IDs are unknown or unmatched. Re-importing existing leads with modified fields updates sync history counters, but lead field merging for existing leads is not yet implemented.
   - *Future Enhancement*: Implement field-level merge strategies for updated inbound leads.

---

## Related Files

- [`src/runtime/connector-runtime.ts`](../src/runtime/connector-runtime.ts)
- [`src/runtime/routing-engine.ts`](../src/runtime/routing-engine.ts)
- [`src/connectors/registry.ts`](../src/connectors/registry.ts)
- [`src/parsers/registry.ts`](../src/parsers/registry.ts)
- [`src/services/export.service.ts`](../src/services/export.service.ts)
- [`src/lib/validation.ts`](../src/lib/validation.ts)
