# LeadBridge Architecture Audit

> Audit report reflecting live codebase implementation.

---

## 1. Ingestion Pipeline (Data Flow)

```text
Connector.execute()
        |
        | RawPayload[]
        v
ConnectorRuntime.processPayloads()
        |
        |--- Duplicate check (connectorId + _duplicateKey / sourceReferenceId)
        |      match -> skip + increment breakdown.duplicatesSkipped
        |      no match -> continue
        |
        |--- RoutingEngine.route(routingHints)
        |      match -> parserId + providerId + ruleId
        |      no match + senderEmail -> create UnmatchedEmail record
        |      no match + no senderEmail -> log warning, skip
        |
        |--- ParserRuntime.parse(payload, parserId)
        |      BaseParser.parse(input) -> NormalizedLead
        |
        |--- LeadNormalizer.validate(lead)
        |      warnings for missing name, bad email, bad phone
        |
        |--- LeadNormalizer.enrich(lead, {sourceId, sourceType, parserVersion})
        |
        |--- LeadService.create(leadInput)
        |      duplicate (409) -> skip + increment duplicatesSkipped
        |      success -> record activity ("IMPORTED") + record AuditLog ("lead.created")
        |
        v
  SyncBreakdown recorded + ConnectorSyncRun persisted
```

### Execution Model

- **In-process**: No external worker queue required. Execution is handled via `POST /api/connectors/[id]/sync` or `ConnectorScheduler`.
- **Locked**: `ExecutionLock` sets `isRunning=true` on the connector table row. Concurrent runs return HTTP 409.
- **Retry**: `RetryPolicy` retries transient `RetryableError` failures (network, timeout, rate-limit) up to 3 times with exponential backoff.
- **Health**: `ConnectorHealthService.recordCompletion()` updates `consecutiveFailures`, `averageDurationMs`, and `healthStatus` (`HEALTHY`, `WARNING`, `ERROR`).
- **Scheduler**: `POST /api/scheduler/trigger` discovers due connectors and executes them sequentially.

---

## 2. Database Model Relationships

```text
LeadSource (Provider in UI)
  ├── has many Connector (sourceId FK)
  ├── has many Lead (sourceId FK)
  ├── has many RoutingRule (providerId FK, cascade delete)
  └── has many UnmatchedEmail (providerId FK)

Connector
  ├── belongs to LeadSource? (sourceId FK, optional)
  ├── belongs to Parser? (parserId FK, optional)
  ├── has many FieldMapping (connectorId FK)
  ├── has many Lead (connectorId FK)
  ├── has many ConnectorSyncRun (connectorId FK, cascade delete)
  ├── has many RoutingRule (connectorId FK, optional)
  └── has many UnmatchedEmail (connectorId FK, optional)

Parser
  ├── has many Connector (parserId FK)
  └── has many RoutingRule (parserId FK, restrict delete)

RoutingRule
  ├── belongs to LeadSource (providerId FK, cascade delete)
  ├── belongs to Parser (parserId FK, restrict delete)
  └── belongs to Connector? (connectorId FK, optional)

Lead
  ├── belongs to LeadSource? (sourceId FK, optional)
  ├── belongs to Connector? (connectorId FK, optional)
  ├── belongs to User? (assignedUserId, createdById, updatedById, deletedById)
  ├── has many LeadActivity
  ├── has many Note
  ├── has many FollowUp
  ├── has many Attachment
  └── unique constraint: (connectorId, sourceReferenceId)

ConnectorSyncRun
  └── belongs to Connector (connectorId FK, cascade delete)

UnmatchedEmail
  ├── belongs to Connector? (connectorId FK, optional)
  ├── belongs to LeadSource? (providerId FK, optional)
  ├── belongs to User? (handledById FK, optional)
  └── belongs to ParserRequest? (parserRequestId FK)

AuditLog
  └── belongs to User? (actorId FK, optional)

Setting
  └── belongs to User? (updatedById FK, optional)
```

---

## 3. Security Model: Server-Side Secret Isolation

| Secret Type | Storage Location | Exposed to Frontend? |
| --- | --- | --- |
| Gmail OAuth Client ID | `GMAIL_<KEY>_CLIENT_ID` env var | Never |
| Gmail OAuth Client Secret | `GMAIL_<KEY>_CLIENT_SECRET` env var | Never |
| Gmail OAuth Refresh Token | `GMAIL_<KEY>_REFRESH_TOKEN` env var | Never |
| REST API Keys / Auth Tokens | `Connector.configuration` JSON (DB) | Not serialized to client |
| Better Auth Session Secret | `BETTER_AUTH_SECRET` env var | Never |
| Database Connection String | `DATABASE_URL` env var | Never |

Secrets are abstracted away from client UI state. Connectors act as operational references to secure backend configurations.

---

## 4. API Route Index

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/auth/[...all]` | ALL | Public | Better Auth authentication endpoints |
| `/api/dashboard` | GET | ADMIN, SALES | Role-derived dashboard metrics |
| `/api/leads` | GET | ADMIN, SALES | List leads with pagination, search, filters |
| `/api/leads` | POST | ADMIN, SALES | Create lead manually |
| `/api/leads/[id]` | GET | ADMIN, SALES | Get lead details |
| `/api/leads/[id]` | PATCH | ADMIN, SALES | Update lead fields |
| `/api/leads/[id]` | DELETE | DELETE_LEAD | Soft-delete lead |
| `/api/leads/[id]/assign` | POST | ADMIN | Assign lead to sales representative |
| `/api/leads/[id]/activities` | GET | ADMIN, SALES | Get lead activity timeline |
| `/api/leads/[id]/notes` | GET | ADMIN, SALES | List lead notes |
| `/api/leads/[id]/notes` | POST | ADMIN, SALES | Add note to lead |
| `/api/leads/[id]/follow-ups` | GET | ADMIN, SALES | List lead follow-up tasks |
| `/api/leads/[id]/follow-ups` | POST | ADMIN, SALES | Create follow-up task |
| `/api/follow-ups/[id]` | PATCH | ADMIN, SALES | Update follow-up status/priority |
| `/api/follow-ups/[id]` | DELETE | ADMIN, SALES | Delete follow-up task |
| `/api/notes/[id]` | PATCH | ADMIN, SALES | Update note content / pinned state |
| `/api/notes/[id]` | DELETE | ADMIN, SALES | Delete note |
| `/api/users` | GET | ADMIN | List users with pagination and search |
| `/api/users` | POST | ADMIN | Provision new user |
| `/api/users/[id]` | PATCH | ADMIN | Update user role, status, or details |
| `/api/providers` | GET | ADMIN | List providers with connectors & routing info |
| `/api/providers` | POST | ADMIN | Create new provider |
| `/api/providers/[id]` | PATCH | ADMIN | Update provider details |
| `/api/providers/[id]` | DELETE | ADMIN | Delete provider |
| `/api/providers/routing-rules` | GET | ADMIN | List routing rules |
| `/api/providers/routing-rules` | POST | ADMIN | Create routing rule |
| `/api/providers/connectors/test` | POST | ADMIN | Test Gmail or REST connection |
| `/api/providers/gmail` | GET | ADMIN | List discovered environment Gmail accounts |
| `/api/providers/unmatched` | GET | ADMIN | List unmatched email queue |
| `/api/providers/unmatched` | PATCH | ADMIN | Process unmatched email item |
| `/api/providers/parser-requests` | GET | ADMIN | List parser requests queue |
| `/api/providers/parser-requests` | PATCH | ADMIN | Update parser request status |
| `/api/providers/parsers` | GET | ADMIN | List parser catalog for management |
| `/api/providers/sync-runs` | GET | ADMIN | List connector sync run history |
| `/api/connectors` | GET | ADMIN | List supported connector types |
| `/api/connectors` | POST | ADMIN | Create new connector |
| `/api/connectors/[id]` | DELETE | ADMIN | Delete connector (Implemented in `src/app/api/connectors/[id]/route.ts`) |
| `/api/connectors/[id]/settings` | PATCH | ADMIN | Update connector enabled/schedule/health |
| `/api/connectors/[id]/sync` | POST | ADMIN | Trigger manual connector sync |
| `/api/parsers` | GET | ADMIN | List registered parser manifests |
| `/api/parsers/preview` | POST | ADMIN | Preview parser parsing on sample payload |
| `/api/scheduler/trigger` | POST | ADMIN | Trigger due connectors or specific connector |
| `/api/reports` | GET | ADMIN | Generate summary, source, activity, status reports |
| `/api/settings` | GET | ADMIN | Get system settings |
| `/api/settings` | PATCH | ADMIN | Update system settings |
| `/api/audit-logs` | GET | ADMIN | Search audit logs with filters |
| `/api/export` | GET | ADMIN, SALES | Download CSV export (leads, users, etc.) |
| `/api/resync` | POST | ADMIN, SALES | Re-sync state helper |

---

## 5. Summary of Audit Findings & Codebase Reconciliation

1. **Connector Deletion Route Verified**: `DELETE /api/connectors/[id]` is fully implemented in `src/app/api/connectors/[id]/route.ts`.
2. **Follow-ups Engine Complete**: `FollowUp` model, `follow-up.service.ts`, API handlers (`/api/leads/[id]/follow-ups`, `/api/follow-ups/[id]`), and UI components (`follow-up-panel.tsx`, `attention-center.tsx`, `tasks-table-client.tsx`) are fully operational.
3. **Audit Log System & CSV Export Operational**: Human-readable action formatting in `audit-log-viewer.tsx` and CSV export handler (`GET /api/audit-logs/export`) are active.
4. **Mock REST Endpoint Removed in Phase 1**: REST connector validation uses the authenticated connector test flow and externally supplied test fixtures rather than a public application route.
5. **Provider & Connector Security**: Authentication tokens and secrets remain isolated on the server and are never serialized to client UI states.
