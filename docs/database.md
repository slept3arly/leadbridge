# LeadBridge Database

> **Status:** Canonical
> **Last verified:** 2026-11-25
> **Source of truth:** `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/prisma.ts`

## Configuration

- **Provider:** PostgreSQL (local instance in the intended deployment)
- **ORM:** Prisma 7.8.0 with `@prisma/adapter-pg` driver adapter
- **Schema:** `prisma/schema.prisma`
- **Generated client:** `src/generated/prisma/` (custom output path)
- **Client singleton:** `src/lib/prisma.ts`
- **Migrations:** `prisma/migrations/` (23 migration directories in this checkout; this count does not indicate which migrations are applied to a database)
- **Prisma config:** `prisma.config.ts` (uses `defineConfig` from Prisma v7)
- **Connection:** `DATABASE_URL`, read by Prisma config and passed to `PrismaPg` in `src/lib/prisma.ts`; use a PostgreSQL connection URL such as `postgresql://user:password@127.0.0.1:5432/leadbridge?schema=public` locally.

## Client Setup

```typescript
// src/lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({ connectionString });
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
```

Uses the standard Next.js singleton pattern via `globalThis` to prevent multiple instances in development.

The runtime uses Prisma's `@prisma/adapter-pg` driver adapter and the Node PostgreSQL driver. For migration, backup, and recovery procedures, see [Local Operations](./local-operations.md).

## Enums (18)

| Enum | Values |
|---|---|
| `UserRole` | `ADMIN`, `SALES` |
| `SalesPrivilege` | `JUNIOR`, `SENIOR` |
| `LeadStatus` | `NEW`, `CONVERTED`, `LOST`, `SPAM`, `ON_HOLD`, `OLD` |
| `LeadPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT`, `COLD` |
| `FollowUpStatus` | `PENDING`, `COMPLETED`, `CANCELLED` |
| `FollowUpPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT`, `COLD` |
| `ActionType` | `CALL`, `WHATSAPP` |
| `ResponseType` | `PICKED_UP`, `NO_RESPONSE` (legacy), `INVALID_NUMBER`, `REPLIED`, `NOT_PICKED_UP`, `SWITCHED_OFF`, `NOT_REPLIED` |
| `InterestType` | `INTERESTED`, `NOT_INTERESTED` |
| `ActivityReason` | Existing reason values plus `COSMETIC_PRODUCTS_AND_TREATMENTS`, `TRADITIONAL_CLASSICAL_HEALTHCARE_PRODUCTS`, and `NUTRACEUTICALS_AND_DIETARY_SUPPLEMENTS` |
| `LeadCategory` | 17 values including `MEDICAL_REPRESENTATIVE`, `RETAILER`, `WHOLESALER`, etc. |
| `ConnectorStatus` | `INACTIVE`, `ACTIVE`, `ERROR` |
| `ConnectorScheduleType` | `MANUAL`, `EVERY_5_MIN`, `EVERY_15_MIN`, `EVERY_30_MIN`, `HOURLY`, `DAILY`, `CUSTOM` |
| `ConnectorHealthStatus` | `HEALTHY`, `WARNING`, `ERROR` |
| `UnmatchedEmailStatus` | `UNMATCHED`, `ASSIGNED`, `IGNORED`, `SPAM`, `PARSER_REQUESTED` |
| `ParserRequestStatus` | `OPEN`, `IN_PROGRESS`, `COMPLETED`, `DECLINED` |
| `ActivityEventType` | `INTERACTION`, `FOLLOW_UP`, `NOTE`, `SYSTEM` |
| `ActivityEntryType` | `CREATED`, `UPDATED`, `ASSIGNED`, `NOTE_ADDED`, `NOTE_EDITED`, `IMPORTED`, `STATUS_CHANGED`, `FOLLOW_UP_SCHEDULED`, `FOLLOW_UP_RESCHEDULED`, `FOLLOW_UP_COMPLETED`, `FOLLOW_UP_CANCELLED`, `DELETED`, `RESTORED`, `ATTACHMENT_ADDED`, `CALL`, `WHATSAPP` |

## Models (19)

### Identity Group

| Model | Table | Purpose |
|---|---|---|
| `User` | `users` | Internal team accounts (ADMIN/SALES roles) |
| `Session` | `sessions` | Better Auth active sessions |
| `Account` | `accounts` | Better Auth credential store |
| `Verification` | `verifications` | Auth verification tokens |

### Core CRM Group

| Model | Table | Purpose |
|---|---|---|
| `Lead` | `Lead` | Core lead record with nullable display name, primary and alternate phone, contact details, status, priority, category, nullable `city` and additive nullable `district`; nullable `product` remains for imported and historical data |
| `LeadSource` | `LeadSource` | Vendor/provider registry (e.g., "IndiaMART", "Website") |
| `Note` | `Note` | Interaction notes attached to leads |
| `FollowUp` | `FollowUp` | Scheduled follow-up tasks linked to leads |
| `Attachment` | `Attachment` | File metadata attached to leads |

### Activity Group

| Model | Table | Purpose |
|---|---|---|
| `ActivityEvent` | `ActivityEvent` | Activity event headers (type, actor, timestamp) |
| `ActivityEntry` | `ActivityEntry` | Individual entries within events (action, response, interest) |

### Integration Group

| Model | Table | Purpose |
|---|---|---|
| `Connector` | `Connector` | External integration config (type, schedule, health, lock state) |
| `ConnectorSyncRun` | `ConnectorSyncRun` | Sync execution history |
| `Parser` | `Parser` | Parser catalog (type, version, config) |
| `RoutingRule` | `RoutingRule` | Priority-based routing rules for inbound payloads |
| `FieldMapping` | `FieldMapping` | Source-to-target field mappings for connectors |

### Operational Group

| Model | Table | Purpose |
|---|---|---|
| `UnmatchedEmail` | `UnmatchedEmail` | Emails failing routing rule matches |
| `ParserRequest` | `ParserRequest` | Vendor samples requesting parser creation |
| `Setting` | `Setting` | Categorized system settings (key-value JSON) |

## City and District Data Safeguards

`Lead.city` and `Lead.district` are separate optional fields. Current API validation handles each independently; a city-only write does not infer a district, a district-only write does not replace the city, and differing values are allowed. Connector normalization continues to map its city value to `Lead.city`, and the export's City column/filter continues to use that field.

Do not bulk-copy or reinterpret existing City values as District values based on their names. Before any proposed backfill, run a fresh read-only inventory against the intended target database and have the data owner classify the exact current values or affected records. Only owner-confirmed district mappings may populate `Lead.district`; retain the original `Lead.city` values and leave ambiguous or non-district values unmapped. Historical row counts or value lists are not current deployment data and are not sufficient migration input.

## Key Relationships

```text
LeadSource (Provider)
  ├──< Lead (sourceId)
  ├──< Connector (sourceId)
  ├──< RoutingRule (providerId, cascade delete)
  └──< UnmatchedEmail (providerId)

Lead
  ├──> LeadSource? (sourceId, set null)
  ├──> Connector? (connectorId, set null)
  ├──> User? (assignedUserId, createdById, updatedById, deletedById)
  ├──< ActivityEvent (leadId, cascade delete)
  ├──< Note (leadId, cascade delete)
  ├──< FollowUp (leadId, cascade delete)
  └──< Attachment (leadId, cascade delete)

Connector
  ├──> Parser? (parserId)
  ├──< ConnectorSyncRun (connectorId, cascade delete)
  ├──< FieldMapping (connectorId)
  └──< RoutingRule (connectorId)

FollowUp
  ├──> Lead (leadId)
  ├──> User? (assignedUserId)
  ├──> User (createdById, restrict delete)
  └──> Note? (noteId)

ActivityEntry
  ├──> ActivityEvent (eventId, cascade delete)
  └──> FollowUp? (followUpId)
```

## Unique Constraints

| Model | Columns | Purpose |
|---|---|---|
| `User` | `email` | Email uniqueness |
| `User` | `employeeCode` | Employee code uniqueness |
| `Lead` | `leadNumber` | Auto-generated lead number |
| `Lead` | `(connectorId, sourceReferenceId)` | Prevent duplicate imports per connector |
| `LeadSource` | `name` | Provider name uniqueness |
| `LeadSource` | `slug` | Provider slug uniqueness |
| `Connector` | `name` | Connector name uniqueness |
| `Connector` | `environmentKey` | Environment key uniqueness |
| `Parser` | `name` | Parser name uniqueness |
| `FieldMapping` | `(connectorId, sourceField)` | Unique field mapping per connector |
| `Setting` | `key` | Setting key uniqueness |
| `Session` | `token` | Session token uniqueness |

## Indexes

Total: 43 `@@index` declarations + 2 `@@unique` declarations + 12 field-level `@unique` constraints (each generating an index). Some indexes are redundant (e.g., `@@index([connectorId, sourceReferenceId])` is covered by `@@unique([connectorId, sourceReferenceId])`).

### Lead (11 indexes + 2 unique)

| Index | Columns | Purpose |
|---|---|---|
| 1 | `(assignedUserId, status, isDeleted)` | Sales user + status filter |
| 2 | `(assignedUserId, isDeleted, updatedAt)` | Sales user + updatedAt sort |
| 3 | `(isDeleted, createdAt)` | Global list + createdAt sort |
| 4 | `(status, isArchived, isDeleted)` | Status filtering |
| 5 | `(nextFollowUpAt, isDeleted)` | Follow-up queue queries |
| 6 | `(connectorId, sourceId)` | Connector sync queries |
| 7 | `(connectorId, sourceReferenceId)` | Dedup check (note: redundant with unique constraint) |
| 8 | `(createdById, createdAt)` | Creator history |
| 9 | `email` | Email search |
| 10 | `phone` | Phone search |
| UQ | `leadNumber` | Unique lead number |
| UQ | `(connectorId, sourceReferenceId)` | Unique import constraint |

### ActivityEvent (2 indexes)

| Index | Columns | Purpose |
|---|---|---|
| 1 | `(leadId, occurredAt)` | Lead activity timeline |
| 2 | `(leadId, type, occurredAt)` | Filtered activity queries |

### ActivityEntry (3 indexes)

| Index | Columns | Purpose |
|---|---|---|
| 1 | `eventId` | Entries by event |
| 2 | `followUpId` | Entries by follow-up |
| 3 | `(type, createdAt)` | Dashboard activity counts |

### FollowUp (3 indexes)

| Index | Columns | Purpose |
|---|---|---|
| 1 | `(leadId, dueDate, status)` | Lead's follow-ups |
| 2 | `(assignedUserId, status, dueDate)` | My Tasks (per-user) |
| 3 | `(leadId, createdAt)` | Lead's follow-ups by creation |

### Other Notable Indexes

| Model | Index | Purpose |
|---|---|---|
| `User` | `(role, active, isDeleted)` | User listing filters |
| `User` | `(isDeleted, deletedAt)` | Soft delete queries |
| `Account` | `(userId, providerId)` | Auth provider lookup |
| `Verification` | `identifier` | Verification token lookup |
| `LeadSource` | `(active, priority)` | Active provider listing |
| `Connector` | `(enabled, status)` | Connector listing |
| `Connector` | `(sourceId, enabled)` | Connectors by provider |
| `Connector` | `parserId` | Connectors by parser |
| `ConnectorSyncRun` | `(connectorId, startedAt)` | Sync history by connector |
| `ConnectorSyncRun` | `(status, startedAt)` | Sync history by status |
| `Parser` | `(type, active)` | Parser listing |
| `RoutingRule` | `(active, priority)` | Active rule listing |
| `RoutingRule` | `(recipientGmailAccount, active, priority)` | Gmail-specific routing |
| `RoutingRule` | `providerId` | Rules by provider |
| `UnmatchedEmail` | `(status, receivedAt)` | Unmatched queue |
| `UnmatchedEmail` | `(connectorId, receivedAt)` | Unmatched by connector |
| `UnmatchedEmail` | `senderEmail` | Email lookup |
| `ParserRequest` | `(status, requestedAt)` | Request queue |
| `ParserRequest` | `(requestedById, requestedAt)` | Requests by user |
| `Note` | `(leadId, createdAt)` | Lead notes |
| `Note` | `(leadId, isPinned)` | Pinned notes |
| `Attachment` | `(leadId, createdAt)` | Lead attachments |
| `Attachment` | `checksum` | Duplicate file detection |
| `FieldMapping` | `(connectorId, targetField)` | Mappings by target |
| `Setting` | `category` | Settings by category |

## Soft Delete Strategy

- **User:** `isDeleted` boolean + `deletedAt` timestamp
- Leads support archival (`isArchived`) but application-level lead deletion is permanent.
- Queries filter on `isDeleted = false` by default
- `DELETE /api/leads/[id]` requires `DELETE_LEAD` permission and hard-deletes the lead. Schema `onDelete: Cascade` removes its `ActivityEvent` (and `ActivityEntry`), `Note`, `FollowUp`, and `Attachment` records. Recovery depends on a verified database backup/restore process; no in-app undelete exists.

## Migrations

The migration directories below are checked-in migration files, not a record of deployment state. Which migrations have been applied depends on the database selected by `DATABASE_URL`; inspect that database with `pnpm db:migrate:status` before planning a deployment. This document does not assert whether any migration has been applied to a particular database.

`20261109100000_followup_one_pending_per_lead` adds nullable `FollowUp.cancelledAt`, runs a preflight that aborts and reports lead IDs/counts/task IDs when multiple PENDING rows exist, then creates the PostgreSQL partial unique index `FollowUp_one_pending_per_lead` on `leadId` for PENDING rows. Prisma schema validation does not model this partial index; retain it in the raw SQL migration and verify it using `pg_indexes` after deployment. Before applying this migration to a database, run the documented conflict query and review every result; never auto-resolve conflicts.

Read-only pending-conflict preflight:

```sql
SELECT "leadId", count(*) AS pending_count,
       array_agg("id" ORDER BY "createdAt", "id") AS follow_up_ids
FROM "FollowUp"
WHERE "status" = 'PENDING'
GROUP BY "leadId"
HAVING count(*) > 1;
```

The 21 migration directories present in this checkout, in order:

1. `20260713173452_init` — Initial schema
2. `20260714120000_phase1_crm_data_model` — Core CRM models
3. `20260714143000_phase2_connector_sync_history` — Connector sync history
4. `20260715100000_phase3a_provider_management` — Provider management
5. `20260717081405_add_connector_schedule_health` — Connector scheduling and health
6. `20260717164212_extend_status_priority_add_followups` — Status, priority, and follow-ups
7. `20260717183000_add_lead_connector_source_reference_unique` — Connector source-reference uniqueness
8. `20260718081824_add_lead_category` — Lead category
9. `20260718090013_simplify_status_add_notes_followups` — Status, notes, and follow-ups
10. `20260718091500_simplify_enums_consistency` — Enum consistency
11. `20260718103934_add_completed_at_backfill` — Follow-up completion timestamp
12. `20260719122327_add_sales_privilege` — Sales privilege
13. `20260825171917_phase2_performance_indexes` — Performance indexes
14. `20260909000000_add_followup_lifecycle_events` — Follow-up lifecycle events
15. `20260913000000_add_activity_event_entry` — ActivityEvent/ActivityEntry model
16. `20260913120000_remove_lead_activity_and_audit_log` — Remove old LeadActivity/AuditLog
17. `20261010000000_add_connector_lock_generation` — Connector execution fencing
18. `20261109090000_add_lead_district` — Add Lead district
19. `20261109100000_followup_one_pending_per_lead` — Follow-up cancellation timestamp and one-pending-per-lead partial index
20. `20261110090000_add_workflow_enum_options` — Workflow enum options
21. `20261111090000_add_old_lead_status` — Add OLD lead status
