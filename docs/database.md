# LeadBridge Database

> **Status:** Canonical
> **Last verified:** 2026-09-17
> **Source of truth:** `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/prisma.ts`

## Configuration

- **Provider:** PostgreSQL (Neon serverless)
- **ORM:** Prisma 7.8.0 with `@prisma/adapter-pg` driver adapter
- **Schema:** `prisma/schema.prisma`
- **Generated client:** `src/generated/prisma/` (custom output path)
- **Client singleton:** `src/lib/prisma.ts`
- **Migrations:** `prisma/migrations/` (16 migrations)
- **Prisma config:** `prisma.config.ts` (uses `defineConfig` from Prisma v7)

## Client Setup

```typescript
// src/lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({ connectionString });
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
```

Uses the standard Next.js singleton pattern via `globalThis` to prevent multiple instances in development.

## Enums (17)

| Enum | Values |
|---|---|
| `UserRole` | `ADMIN`, `SALES` |
| `SalesPrivilege` | `JUNIOR`, `SENIOR` |
| `LeadStatus` | `NEW`, `CONVERTED`, `LOST`, `SPAM`, `ON_HOLD` |
| `LeadPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `FollowUpStatus` | `PENDING`, `COMPLETED`, `CANCELLED` |
| `FollowUpPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `ActionType` | `CALL`, `WHATSAPP` |
| `ResponseType` | `PICKED_UP`, `NO_RESPONSE`, `INVALID_NUMBER`, `REPLIED` |
| `InterestType` | `INTERESTED`, `NOT_INTERESTED` |
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
| `Lead` | `Lead` | Core lead record with contact details, status, priority, category |
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
- **Lead:** `isDeleted` boolean + `deletedAt` timestamp + `deletedById` FK
- Queries filter on `isDeleted = false` by default
- Hard delete available for leads via `DELETE /api/leads/[id]` (requires `DELETE_LEAD` permission)

## Migrations

16 migrations from initial schema through ActivityEvent/ActivityEntry refactor. Key migrations:

1. `20260713173452_init` -- Initial schema
2. `20260714120000_phase1_crm_data_model` -- Core CRM models
3. `20260717081405_add_connector_schedule_health` -- Connector scheduling
4. `20260717164212_extend_status_priority_add_followups` -- Follow-ups engine
5. `20260718090013_simplify_status_add_notes_followups` -- Notes & follow-ups
6. `20260825171917_phase2_performance_indexes` -- Performance indexes
7. `20260913000000_add_activity_event_entry` -- ActivityEvent/ActivityEntry model
8. `20260913120000_remove_lead_activity_and_audit_log` -- Removed old LeadActivity/AuditLog
