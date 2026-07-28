# LeadBridge Architecture Audit

> Generated July 2026 — maps the live codebase, not aspirational design.

---

## 1. Ingestion Pipeline (Data Flow)

```
Connector.execute()
        |
        | RawPayload[]
        v
ConnectorRuntime.processPayloads()
        |
        |--- Duplicate check (connectorId + sourceReferenceId)
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
        |      success -> record activity ("IMPORTED")
        |
        v
  SyncBreakdown recorded + ConnectorSyncRun persisted
```

### Execution model

- **In-process**: No queue, no worker. `POST /api/connectors/[id]/sync` runs synchronously.
- **Locked**: `execution-lock.service` sets `isRunning=true` on the connector row. Concurrent calls return 409.
- **Retry**: `RetryPolicy` retries `RetryableError` (network/rate-limit) up to 3 times with exponential backoff.
- **Health**: `ConnectorHealthService.recordCompletion()` updates `consecutiveFailures`, `averageDurationMs`, `healthStatus`. ≥3 consecutive failures → `ERROR`, ≥1 → `WARNING`, 0 → `HEALTHY`.
- **Scheduler**: `POST /api/scheduler/trigger` discovers due connectors (enabled + non-MANUAL + nextScheduledRun ≤ now) and runs each in-process sequentially.

---

## 2. Database Model Relationships

```
LeadSource (acts as "Provider" in the UI)
  |-- has many Connector (sourceId FK)
  |-- has many Lead (sourceId FK)
  |-- has many RoutingRule (providerId FK, cascade delete)
  |-- has many UnmatchedEmail (providerId FK)

Connector
  |-- belongs to LeadSource? (sourceId FK, optional)
  |-- belongs to Parser? (parserId FK, optional)
  |-- has many FieldMapping (connectorId FK, unique per sourceField)
  |-- has many Lead (connectorId FK)
  |-- has many ConnectorSyncRun (connectorId FK, cascade delete)
  |-- has many RoutingRule (connectorId FK, optional)
  |-- has many UnmatchedEmail (connectorId FK, optional)

Parser
  |-- has many Connector (parserId FK)
  |-- has many RoutingRule (parserId FK, restrict delete)

RoutingRule
  |-- belongs to LeadSource (providerId FK, cascade delete) [the "provider"]
  |-- belongs to Parser (parserId FK, restrict delete)
  |-- belongs to Connector? (connectorId FK, optional)

Lead
  |-- belongs to LeadSource? (sourceId FK, optional)
  |-- belongs to Connector? (connectorId FK, optional)
  |-- belongs to User? (assignedUserId, createdById, updatedById, deletedById)
  |-- unique constraint: (connectorId, sourceReferenceId) — duplicate detection

ConnectorSyncRun
  |-- belongs to Connector (connectorId FK, cascade delete)

UnmatchedEmail
  |-- belongs to Connector? (connectorId FK, optional)
  |-- belongs to LeadSource? (providerId FK, optional)
  |-- belongs to User? (handledById FK, optional)
  |-- belongs to ParserRequest? (parserRequestId FK)

FieldMapping
  |-- belongs to Connector (connectorId FK, optional, unique per sourceField)

AuditLog
  |-- belongs to User? (actorId FK, optional)
```

### Key design decision: `LeadSource` IS the provider

The database model calls it `LeadSource`. The UI calls it "Provider." The code service is `providerService`. They are the same entity.

---

## 3. Security Model: Secrets Never Reach the Frontend

### Verified: sensitive credentials are server-only

| Secret type | Storage | Exposed to frontend? |
|---|---|---|
| Gmail OAuth client ID | `GMAIL_<KEY>_CLIENT_ID` env var | Never |
| Gmail OAuth client secret | `GMAIL_<KEY>_CLIENT_SECRET` env var | Never |
| Gmail OAuth refresh token | `GMAIL_<KEY>_REFRESH_TOKEN` env var | Never |
| REST API key / bearer token | `Connector.configuration` JSON (DB) | Not serialized by page.tsx |
| Better Auth session secret | `BETTER_AUTH_SECRET` env var | Never |
| DB connection string | `DATABASE_URL` env var | Never |

### How it works

1. **Gmail**: Environment variables are discovered by `src/connectors/environment.ts` (`discoverGmailAccounts()`). This function only reports whether credentials are present (`"READY"` vs `"INCOMPLETE"` + list of missing fields). The actual credential values are never read into client-visible code paths. The `GmailConnector` reads env vars directly at execution time.

2. **REST**: The `RestConnectorConfig` has an `auth` property supporting `NONE`, `BASIC`, `BEARER`, `API_KEY`. This configuration is stored in `Connector.configuration` (a JSON column). However, the **current page.tsx does NOT serialize `configuration`** — it only serializes `runtimeMetadata`. So REST auth configs are never sent to the frontend.

3. **The `Connector.configuration` field**: Stored in the database but deliberately excluded from the serialization layer in `page.tsx`. The server-side API handlers (`POST /api/connectors`, `PATCH /api/connectors/[id]/settings`) accept configuration data but the frontend never requests it. The admin UI *cannot* view or edit REST API keys through the browser — this is intentional.

### What the admin CAN see

- Connector name, type, status, health status
- Schedule configuration (scheduleType — no secrets)
- Runtime metadata (last sync timestamps, counters, durations)
- Error messages (which should never contain secrets)

### What the admin CANNOT see

- Gmail OAuth credentials (entirely env-var-managed)
- REST API keys, bearer tokens, or basic auth passwords (stored in `configuration` but not serialized)

**Conclusion**: The security model is sound. Secrets are intentionally abstracted away from the admin UI. Connectors are references to secure backend configurations — the admin creates a named entry that the runtime uses to look up credentials.

---

## 4. Two Connector Interfaces (Legacy + Current)

The codebase has two parallel connector interfaces:

### Old interface (`src/connectors/types.ts`)

```typescript
interface Connector {
  key: string;
  authenticate(): Promise<void>;
  fetch(): Promise<unknown[]>;
  normalize(record: unknown): NormalizedLead;
  sync(): Promise<{ created: number; skipped: number }>;
}
```

Used by:
- `connectorService.sync()` — marked "Legacy compatibility"
- `connectorService.testConnection()` — delegates to `createGmailRuntime()`/`createConfiguredRuntime()`
- `src/connectors/runtime.ts` — `EnvironmentConnectorRuntime` base class

### Current interface (`src/runtime/runtime-types.ts`)

```typescript
interface IConnector {
  readonly key: string;
  execute(context: ExecutionContext): Promise<RawPayload[]>;
}
```

Used by:
- `ConnectorRuntime.execute()` — the actual runtime pipeline
- `src/connectors/registry.ts` — both `GmailConnector` and `RestConnector` implement this

### Bridge

The registry creates `GmailConnector` or `RestConnector` (both implement `IConnector`) when the runtime requests a connector by type. The old `Connector` interface persists in `connector.service.ts` for the test connection and sync helper, using `createGmailRuntime()`/`createConfiguredRuntime()` which wrap the `EnvironmentConnectorRuntime` abstract class.

---

## 5. API Route Map

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/connectors` | GET | ADMIN | List supported connector types |
| `/api/connectors` | POST | ADMIN | Create connector (name, type) |
| `/api/connectors/[id]/settings` | PATCH | ADMIN | Update enabled, scheduleType, resetHealth |
| `/api/connectors/[id]/sync` | POST | ADMIN | Trigger manual sync (execution lock) |
| `/api/connectors/[id]` | DELETE | — | **DOES NOT EXIST** |
| `/api/providers` | GET | ADMIN | List providers with connectors + routing rules |
| `/api/providers` | POST | ADMIN | Create provider |
| `/api/providers/routing-rules` | GET | ADMIN | List routing rules |
| `/api/providers/routing-rules` | POST | ADMIN | Create routing rule |
| `/api/providers/connectors/test` | POST | ADMIN | Test Gmail or REST connection |
| `/api/providers/unmatched` | GET | ADMIN | List unmatched emails |
| `/api/providers/unmatched` | PATCH | ADMIN | Handle unmatched email |
| `/api/providers/parser-requests` | GET | ADMIN | List parser requests |
| `/api/providers/parser-requests` | PATCH | ADMIN | Update parser request status |
| `/api/providers/sync-runs` | ? | ? | Referenced in docs but not audited |
| `/api/parsers` | GET | ADMIN | List parser manifests |
| `/api/parsers/preview` | POST | ADMIN | Preview parser output on sample payload |
| `/api/scheduler/trigger` | POST | ADMIN | Run due connectors (or specific ID) |

---

## 6. Registered Connectors and Parsers

### Connectors (static registry in `src/connectors/registry.ts`)

| Key | Class | Auth method | Secrets location |
|---|---|---|---|
| `gmail` | `GmailConnector` | OAuth2 (refresh token) | `GMAIL_<KEY>_*` env vars |
| `rest` | `RestConnector` | None/Basic/Bearer/API key | `Connector.configuration` (DB, not serialized to frontend) |

### Parsers (static registry in `src/parsers/registry.ts`)

| Key | Class | Provider types supported |
|---|---|---|
| `example` | `ExampleParser` | (all) |
| `gmail` | `GmailParser` | `["gmail"]` |

---

## 7. Responsibility Matrix

### Developer Responsibilities

| Responsibility | Details |
|---|---|
| Implement parsers | Extend `BaseParser<T>`, register in `parserRegistry` |
| Implement connectors | Implement `IConnector`, register factory in `factoryRegistry` |
| Manage Gmail OAuth secrets | Set `GMAIL_<KEY>_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN` env vars |
| Configure REST endpoints | Set API URLs and auth in code (connector implementation) |
| Write runtime services | `ConnectorRuntime`, `RoutingEngine`, `ParserRuntime`, `LeadNormalizer` |
| Handle error classification | Map source errors to `RuntimeError` subclasses |
| Deploy and maintain | Build, db:migrate, monitor, recover (see docs/04) |

### Administrator Responsibilities

| Responsibility | Details |
|---|---|
| Create provider records | Name, slug, source type via Admin > Providers |
| Configure routing rules | Match criteria (sender, domain, subject, label) + parser + priority |
| Select parsers | Choose parser from code-registered list for each routing rule |
| Enable/disable connectors | Toggle via Admin > Connectors edit modal |
| Set sync schedules | Choose schedule type (Manual/5min/15min/etc.) |
| Trigger manual syncs | Per-connector action button |
| Test connections | Validate Gmail or REST configuration |
| Review connector health | KPI cards (Healthy/Warning/Error/Running) |
| Review sync history | Per-connector run records |
| Handle unmatched emails | Assign, ignore, mark spam, or open parser request |
| Review parser requests | Track vendor samples needing parser development |
| Manage users | Provision internal users (ADMIN/SALES roles) |
| Export data | CSV exports for leads, users, providers, sync history |
| Configure system settings | Via Admin > Settings |
| Reset stuck locks | Force-release connector execution lock |

### What the Administrator Does NOT Do

- Does NOT enter API keys or OAuth credentials (server-managed)
- Does NOT configure OAuth flows (env-var-managed)
- Does NOT write parsers (code task)
- Does NOT write connectors (code task)
- Does NOT define REST endpoints in the connector config (those are connector-level, not admin-level)
- Does NOT enter database connection strings

---

## 8. Inconsistencies Between Implementation, Docs, and UI

### 8.1. Missing DELETE route

The `ConnectorsPageContent` component calls `axios.delete(\`/api/connectors/${connector.id}\`)` but there is no `DELETE` handler in `src/app/api/connectors/[id]/`. Deleting a connector from the UI will produce a 404.

### 8.2. Test connection sends wrong key

The `ConnectorsPageContent` sends `{ kind, key: connector.name }` to the test endpoint. But `GmailConnector.testConnection()` expects `key` to be the **environment key** (e.g. `"MAIN"`), not the connector name. The `environmentKey` field on the connector is stored in the database but not serialized by `page.tsx`, so the frontend has no way to send the correct key.

### 8.3. Mislabeled Advanced tab

The `ConnectorEditModal` Advanced tab shows `runtimeMetadata` under the label "Configuration (JSON)". This is misleading — `runtimeMetadata` is the sync execution metadata (lastSyncResult, lastSyncLeadCount, etc.), not the connector configuration. The actual `configuration` field (which contains REST auth config) is not exposed.

### 8.4. Provider route and service type mismatch

`providerService.list()` returns either the raw Prisma result (when no query is passed) or a `{ data, total }` paginated wrapper. The `providers/page.tsx` handles this with `"data" in providers ? providers.data : providers` — a runtime check. The type system does not reflect this dual return.

### 8.5. Routing rule model ties to Gmail

The `RoutingRule` model has fields `recipientGmailAccount`, `senderEmail`, `senderDomain`, `subjectContains`, `gmailLabel` — all oriented toward email-based routing. For REST connector payloads, the routing hints include `senderEmail`, `senderDomain`, and `subject`, but the model has no generic routing criteria. REST routing works only if the payload has email-like fields.

### 8.6. Docs reference non-existent component

`docs/04_ADMINISTRATION_AND_OPERATIONS.md` references `src/components/admin/provider-management.tsx` — this file does not exist. The actual providers page imports from `@/components/providers/provider-management` which also doesn't exist yet (the page passes props directly to `ProviderManagement`).

### 8.7. Two connector test paths

`connectorService.testConnection()` uses the old `EnvironmentConnectorRuntime` / `ConfiguredRuntime` wrappers and returns a generic validation result. But the API route `/api/providers/connectors/test` bypasses this entirely and calls `GmailConnector.testConnection()` / `RestConnector.testConnection()` directly. The service method is dead code.

### 8.8. `connectorService.sync()` is dead code

Marked "Legacy compatibility for smoke scripts" — uses the old `Connector` interface. All actual syncs go through `ConnectorRuntime.execute()`.

### 8.9. Connector `type` field naming inconsistency

The `RestConnector` has `key = "rest_<baseUrl>"` — the key is not just `"rest"`. But the `POST /api/connectors` endpoint validates that the `type` field matches `supportedConnectorTypes()`, which returns `["gmail", "rest"]`. The `type` field in the database stores the short type name (`"gmail"` or `"rest"`), while the connector key can be different. The scheduler service constructs connectors with `type` as the type and may pass `environmentKey` separately.

### 8.10. `page.tsx` lacks `environmentKey` and `configuration` serialization

The server component (`page.tsx`) does not serialize `environmentKey` or `configuration` fields. The `environmentKey` is needed for the test connection call (see 8.2), and `configuration` is intentionally excluded. However, without `environmentKey`, the test connection function has no way to distinguish which Gmail account to test.

---

## 9. Architecture Diagram

```
Developer writes code
        |
        |--- Implements IConnector (src/connectors/)
        |      Registers factory in registry.ts
        |      Gmail: reads GMAIL_<KEY>_* env vars at runtime
        |      REST: stores non-secret config in DB (configuration JSON)
        |
        |--- Implements BaseParser (src/parsers/)
        |      Registers in parserRegistry
        |      Returns NormalizedLead (no side effects)
        |
        v
Admin configures via UI
        |
        |--- Creates Provider (LeadSource)
        |      Name, slug, source type
        |
        |--- Creates RoutingRule
        |      Provider + Parser + match criteria
        |      Priority-based, first match wins
        |
        |--- Creates Connector (via Admin > Connectors)
        |      Name + Type (picks registered connector)
        |      Can toggle enabled, set schedule
        |      Cannot see/configure secrets
        |
        |--- (Optional) Creates FieldMapping
        |
        v
Runtime executes sync
        |
        |--- POST /api/connectors/[id]/sync
        |      or scheduler discovers due connector
        |
        |--- ExecutionLock.acquire()
        |      isRunning = true on connector row
        |
        |--- ConnectorRuntime.execute()
        |      createConnector(type, config) -> IConnector
        |      connector.execute(context) -> RawPayload[]
        |
        |--- For each RawPayload:
        |      Duplicate check (connectorId + _duplicateKey)
        |      RoutingEngine.route(hints)
        |      ParserRuntime.parse(payload, parserKey)
        |      LeadNormalizer.validate() + enrich()
        |      LeadService.create() -> Lead record
        |
        |--- ConnectorHealthService.recordCompletion()
        |      Updates healthStatus, consecutiveFailures, durations
        |
        |--- SyncHistory.recordCompletion()
        |      Persists ConnectorSyncRun row
        |
        |--- ExecutionLock.release()
        |      isRunning = false
        |
        v
Lead flows to CRM
        |
        |--- Assigned to sales user (admin assignment)
        |--- Tracked via LeadActivity ("IMPORTED")
        |--- Visible in Admin + Sales dashboards
```

---

## 10. Summary

The architecture is intentionally layered:

1. **Developer layer** — connectors, parsers, runtime. Code-managed, not admin-configurable.
2. **Admin configuration layer** — providers, routing rules, connector metadata, schedules. UI-managed via the Admin panel.
3. **Runtime layer** — execution, health tracking, duplicate detection, lead persistence. Server-only.

Secrets are kept at the Developer layer and never exposed to the Admin UI. This is a deliberate and correct security design. The Connectors screen is an operational dashboard showing pipeline health, not a configuration tool for authentication.
