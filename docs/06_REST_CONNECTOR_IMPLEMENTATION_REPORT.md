# REST Connector Implementation Report

> Generated July 2026. Do NOT modify code based on this report — it is a reverse-engineering reference for configuration and testing.

---

## 1. File Map

All REST connector files live under `src/connectors/rest/` and are consumed by the runtime pipeline in `src/runtime/`.

| File | Responsibility |
|---|---|
| `src/connectors/rest/rest-types.ts` | Type definitions: `RestConnectorConfig`, `RestAuthConfig`, `PaginationConfig`, `RestDocument`, enums for auth type, HTTP method, pagination strategy |
| `src/connectors/rest/rest-connector.ts` | `RestConnector` class implementing `IConnector`. Entry point for the runtime. Validates config, builds HTTP client, calls `fetchAll()`, converts raw records to `RawPayload[]`. Exposes static `testConnection()` for the admin test endpoint. |
| `src/connectors/rest/rest-client.ts` | `RestClient` class. Handles all HTTP communication: URL building, auth header injection, pagination, retry with backoff, timeout, JSON parsing. Contains `fetchAll()` (paginated fetch loop) and `testConnection()` (single-request validation). |
| `src/connectors/rest/rest-errors.ts` | Error classes: `RestAuthError`, `RestPermissionError`, `RestNotFoundError`, `RestRateLimitError`, `RestServerError`, `RestTimeoutError`, `RestNetworkError`, `RestInvalidJsonError`, `RestConfigurationError`. Each extends either `ConnectorError` (non-retryable) or `RetryableError` (retryable). Also exports `classifyRestError()` which maps HTTP status codes and error message keywords. |
| `src/connectors/registry.ts` | Static registry. Registers `"rest"` factory that creates `new RestConnector(config)` from the runtime's configuration object. |
| `src/runtime/connector-runtime.ts` | `ConnectorRuntime` — orchestrates the entire pipeline: acquires connector, fetches payloads, deduplicates, routes, parses, normalizes, creates leads, records sync history. |
| `src/runtime/connector-executor.ts` | `ConnectorExecutor` — thin wrapper that looks up the registered connector by type and calls `execute()`. |
| `src/runtime/execution-context.ts` | `createExecutionContext()` — builds the `ExecutionContext` object passed to the connector. Includes execution ID, logger, configuration, retry count. |
| `src/runtime/parser-runtime.ts` | `ParserRuntime` — resolves a parser by key from the registry and calls `parse()`. |
| `src/runtime/lead-normalizer.ts` | `LeadNormalizer` — validates (name, email, phone) and enriches (sourceId, sourceType, parserVersion, importedAt) a `NormalizedLead`. |
| `src/runtime/routing-engine.ts` | `RoutingEngine` — matches routing hints against `RoutingRule` rows. Priority-based, first match wins, fallback rules act as catch-all. |
| `src/runtime/sync-history.ts` | `SyncHistory` — records `ConnectorSyncRun` start and completion, updates connector status timestamps. |
| `src/runtime/retry-policy.ts` | `RetryPolicy` — retries `RetryableError` up to 3 times with exponential backoff (1s → 2s → 4s, max 30s). |
| `src/runtime/runtime-result.ts` | Result factories: `createSuccessResult`, `createFailedResult`, `createSkippedResult`, `createRetryResult`, `createCancelledResult`. |
| `src/runtime/runtime-errors.ts` | Base error classes: `RuntimeError`, `ConnectorError`, `ParserError`, `ValidationError`, `RetryableError`, `ConfigurationError`. |
| `src/services/lead.service.ts` | `LeadService.create()` — creates a `Lead` record in a transaction, with duplicate detection (`P2002` on unique constraint), activity logging, and audit logging. |
| `src/services/connector-health.service.ts` | `ConnectorHealthService.recordCompletion()` — updates `consecutiveFailures`, `averageDurationMs`, `healthStatus` after each run. |
| `src/services/execution-lock.service.ts` | `ExecutionLock` — prevents concurrent runs by setting `isRunning=true` on the connector row. Releases after completion. |
| `src/services/scheduler.service.ts` | `ConnectorScheduler` — discovers due connectors and runs them. Used by `POST /api/scheduler/trigger`. |
| `src/app/api/connectors/[id]/route.ts` | `DELETE` — deletes a connector record by ID. |
| `src/app/api/connectors/[id]/sync/route.ts` | `POST` — triggers manual sync. Creates runtime, acquires lock, executes, records health, updates runtime metadata. |
| `src/app/api/providers/connectors/test/route.ts` | `POST` — accepts `connectorId`, looks up connector, calls `GmailConnector.testConnection()` or `RestConnector.testConnection()`. |
| `src/parsers/example-parser.ts` | `ExampleParser` — generic parser for REST payloads. Extracts `name`, `email`, `phone`, `company` from flat JSON. |
| `src/parsers/registry.ts` | `parserRegistry` — static map: `"example" → ExampleParser`, `"gmail" → GmailParser`. |

---

## 2. Complete Execution Flow

```
Admin clicks "Manual Sync" on Connector row
        |
        v
ConnectorsPageContent.handleManualSync(connector)
  -> axios.post(`/api/connectors/${connector.id}/sync`)
        |
        v
POST /api/connectors/[id]/sync/route.ts
  1. Lookup connector from DB (id, type, configuration, runtimeMetadata, environmentKey)
  2. Generate executionId via randomUUID()
  3. executionLock.acquire(connectorId, executionId)
     -> Prisma: UPDATE connector SET isRunning=true, lockedAt=now, lockedBy=executionId
        WHERE id=connectorId AND isRunning=false
     -> If count === 0: return 409 "Connector is already running"
        |
        v
  4. Build connectorRegistry:
     {
       get(type) { return createConnector(type, config) }
     }
     -> registry.ts: registered "rest" factory
        -> new RestConnector(config)
           -> validateConfig(config) — parses baseUrl, endpoint, method, headers, auth, pagination, etc.
           -> sets this.key = "rest_<sanitized_baseUrl>"
        |
        v
  5. Build parserRegistryAdapter:
     { get(key) { return parserRegistry.get(key) } }
        |
        v
  6. new ConnectorRuntime({ connectorRegistry, parserRegistry })
        |
        v
  7. runtime.execute(connectorId, "rest", actor, { configuration: config })
        |
        v
        7a. createExecutionContext({ connectorId, connectorType: "rest", configuration })
            -> executionId = randomUUID()
            -> startedAt = new Date()
            -> DefaultLogger (console-based)
            -> RuntimeConfig: maxPayloadSize=10MB, timeoutMs=300s, logLevel=info
        
        7b. syncHistory.recordStart(context)
            -> INSERT INTO connector_sync_run (connectorId, status="ACTIVE", startedAt, ...)
            -> returns syncRunId
        
        7c. retryPolicy.execute(async (attempt) => { ... })
            -> Max 3 retries for RetryableError (RestRateLimitError, RestServerError, RestTimeoutError, RestNetworkError)
            -> Backoff: 1s, 2s, 4s
            |
            v
            
            7c-i. connectorExecutor.execute(context)
                  -> registry.get("rest") => RestConnector
                  -> connector.execute(context)
                     |
                     v
                     RestConnector.execute(context):
                       1. new RestClient(this.config)
                       2. client.fetchAll(logger)
                          |
                          v
                          RestClient.fetchAll():
                            -> maxPages = 50 (default)
                            -> page = 1, cursor = null, nextUrl = null, token = null
                            -> retryCount = config.retryCount ?? 3
                            -> rateLimitDelay = config.rateLimitDelayMs ?? 200
                            |
                            while page <= maxPages:
                              |
                              getPageParams(strategy, page, cursor, nextUrl, token, config)
                                -> PAGE_NUMBER: { page: "1", per_page: "50" }
                                -> OFFSET: { offset: "0", limit: "50" }
                                -> CURSOR: { cursor: "<value>", limit: "50" }
                                -> NEXT_URL: { url: "next_url_string" }
                                -> TOKEN: { pageToken: "<value>", limit: "50" }
                              |
                              buildUrl(baseUrl, endpoint)
                                -> e.g. "https://api.example.com/leads"
                              |
                              buildQueryString(config, pageParams)
                                -> adds query params from config.queryParams + pageParams
                              |
                              addApiKeyQueryParam(url, config)
                                -> for API_KEY auth with in="query": appends ?apiKey=value
                              |
                              applyAuth(headers, config)
                                -> adds auth headers based on config.auth.type
                                -> also adds content-type: application/json + accept: application/json
                              |
                              fetchWithTimeout({ url, method, headers, body, timeoutMs })
                                -> native fetch with AbortController
                                -> timeout = config.timeout ?? 30000 (30s)
                                -> returns { status, headers, body: string }
                              |
                              tryParseJson(body) -> Record<string, unknown> | null
                              |
                              extractArray(parsedBody, leadArrayPath)
                                -> led by config.leadArrayPath (default "data")
                                -> navigates dot-path: e.g. "data.items" or "data"
                                -> returns Record<string, unknown>[]
                              |
                              extractPaginationValue(body, cursorPath/nextUrlPath/tokenPath)
                                -> navigates dot-path for pagination cursors
                              |
                              If 2xx: collect records, break retry loop
                              If 429: wait retry-after header or rateLimitDelay * attempt, retry
                              If 5xx: wait rateLimitDelay * attempt, retry
                              Other: classifyRestError() and throw typed error
                              |
                              If cursor/nextUrl/token present: page++, continue loop
                              If none: break (end of pagination)
                            |
                            return { records: [...all records], documents: [...all responses] }
                       3. Map records -> RawPayload[] via toRawPayload(record, connectorId, lastDocument)
                          |
                          For each record, builds:
                            _routing: { senderEmail, senderDomain, subject, recipientGmailAccount }
                            _duplicateKey: record.id ?? record.ID ?? record.leadId ?? record.externalId ?? "<connectorId>-<json_length>"
                            name, company, email, phone, subject (from case-insensitive field names)
                            sourceType: "rest"
                            connectorId
                            receivedAt: now
                            providerMetadata: { connectorType, connectorId, rest: { statusCode, url, method, recordKeys } }
                       4. Return RawPayload[]
                  |
                  v
            7c-ii. processPayloads(payloads, context, actor):
                    For each payload:
                      |
                      isDuplicate(payload, context):
                        -> Prisma: find lead WHERE connectorId + sourceReferenceId === _duplicateKey
                        -> If exists: skip, increment breakdown.duplicatesSkipped
                      |
                      resolveRouting(payload, context):
                        -> Extract _routing hints from payload
                        -> RoutingEngine.route(hints, payload, connectorId):
                           1. Query all active RoutingRules, ordered by fallback ASC, priority ASC
                           2. For each rule, check match on:
                              - recipientGmailAccount (if set)
                              - senderEmail (case-insensitive)
                              - senderDomain (endsWith)
                              - subjectContains (includes)
                              - gmailLabel
                           3. Rules with fallback=true match everything (catch-all)
                           4. First match wins
                           5. No match + senderEmail present: create UnmatchedEmail record
                           6. No match + no senderEmail: return null
                      |
                      If no match: skip, increment breakdown.routingFailures
                      |
                      Get parserId from routing match or context:
                        -> match.parserId ?? context.parserId
                        -> If no parserId: skip, increment breakdown.parserFailures
                      |
                      ParserRuntime.parse(payload, parserId, context):
                        -> registry.get(parserId):
                           "example" -> ExampleParser.parse(payload)
                             Returns: { name, email?, phone?, company? } as NormalizedLead
                           "gmail" -> GmailParser.parse(payload)
                             Returns: { name, email?, company?, requirement?, sourceReferenceId?, receivedAt?, rawPayload? }
                        -> If parser not found: throw ConfigurationError
                        -> If parser throws: throw ParserError
                      |
                      LeadNormalizer.validate(lead):
                        -> Check: name not empty, email format, phone format
                        -> Returns { lead, warnings[] }
                      |
                      LeadNormalizer.enrich(validatedLead, { sourceId, sourceType: "rest", parserVersion: "1.0" }):
                        -> Sets parserVersion, sourceType, sourceId, importedAt
                      |
                      toLeadInput(enrichedLead):
                        -> Maps NormalizedLead fields to LeadInput shape
                        -> Sets null for: industry, website, jobTitle, budget, expectedValue, currency,
                           campaign, campaignId, nextFollowUpAt, lostReason, wonAmount (not populated by parser)
                      |
                      LeadService.create(leadInput, actor):
                        -> assertAssignableUser (checks assigned user is active SALES, if set)
                        -> duplicateService.findPotentialDuplicates (email/phone matching)
                        -> Prisma transaction:
                           1. INSERT INTO lead (...)
                              - displayName = lead.name
                              - rawPayload = input.rawPayload (contains original REST response data)
                              - connectorId set to connector id
                              - sourceReferenceId = _duplicateKey
                              - sourceId from routing match provider
                              - status defaults to "NEW"
                              - priority defaults to "MEDIUM"
                              - createdById = system (since actor is SYSTEM_ACTOR for scheduler) 
                                or actual admin for manual sync
                           2. On P2002 (unique constraint violation): throw 409
                                -> Caught by runtime -> increment breakdown.duplicatesSkipped
                           3. activityService.record: "IMPORTED"
                           4. auditService.log: "lead.created"
                      |
                      Return created lead id
                  |
                  v
            7c-iii. Return createSuccessResult({ rawPayloadCount, leadCount, durationMs, metadata })
        |
        v
    7d. syncHistory.recordCompletion(syncRunId, connectorId, result, breakdown)
        -> UPDATE connector_sync_run SET
             status = "ACTIVE" (if success/skipped) or "ERROR" (if failed)
             completedAt = now
             recordsSeen = rawPayloadCount
             recordsCreated = leadCount
             recordsSkipped = warnings.length
             errorMessage = first error if failed
             metadata = { breakdown, durationMs, leadIds, ... }
        -> UPDATE connector SET
             lastSyncedAt = now
             lastSuccessAt = now (if success) / lastFailureAt = now (if failed)
             lastError = ... (if failed)
             status = "ACTIVE" (if success) / "ERROR" (if failed)
    
    7e. Return ConnectorExecutionResult to API handler
    
    v
  API handler continues:
    connectorHealthService.recordCompletion(id, result.status, durationMs, error)
      -> Read current connector state
      -> Compute new consecutiveFailures (0 if success, ++ if failed)
      -> Compute new healthStatus:
           consecutiveFailures >= 3  -> "ERROR"
           consecutiveFailures >= 1  -> "WARNING"
           else                      -> "HEALTHY"
      -> Compute new averageDurationMs (simple average of old avg and new duration)
      -> UPDATE connector SET consecutiveFailures, averageDurationMs, lastDurationMs, healthStatus
    -> Update runtimeMetadata on connector (lastSyncResult, lastSyncAt, lead count, errors, warnings)
    -> Return { data: result }

  Finally:
    executionLock.release(connectorId, executionId)
      -> UPDATE connector SET isRunning=false, lockedAt=null, lockedBy=null
         WHERE id=connectorId AND lockedBy=executionId

  Frontend:
    toast.success("Sync completed")
    router.refresh() -- refetches the page, showing updated KPI, last sync, health
```

---

## 3. Configuration Reference

All fields are stored in `Connector.configuration` (JSON column in the PostgreSQL `connector` table). They are written when the connector is created (via the `POST /api/connectors` body) and can be updated via `PATCH /api/connectors/[id]/settings` but the current UI only allows changing `enabled` and `scheduleType`. The configuration is never serialized to the frontend.

| Field | Type | Required | Default | Purpose | Editable by Admin |
|---|---|---|---|---|---|
| `baseUrl` | string | **Yes** | — | Base URL of the REST API, e.g. `https://api.example.com`. Trailing slashes stripped. | Via API only (not UI) |
| `endpoint` | string | **Yes** | — | Path relative to baseUrl, e.g. `/v1/leads` or `v1/leads`. Leading slash added if missing. | Via API only |
| `method` | `"GET" \| "POST" \| "PUT" \| "PATCH" \| "DELETE"` | No | `"GET"` | HTTP method for the request. | Via API only |
| `headers` | `Record<string, string>` | No | `{}` | Additional HTTP headers to send. `content-type` and `accept` are auto-set to `application/json`. | Via API only |
| `queryParams` | `Record<string, string>` | No | `{}` | Static query parameters appended to every request URL. | Via API only |
| `body` | string | No | undefined | Request body string for non-GET methods. Passed as-is to fetch. | Via API only |
| `auth` | `RestAuthConfig` (see Section 4) | No | `{ type: "NONE" }` | Authentication configuration. | Via API only |
| `pagination` | `PaginationConfig` (see below) | No | `{ strategy: "PAGE_NUMBER", pageSize: 50 }` | Pagination strategy. | Via API only |
| `leadArrayPath` | string | No | `"data"` | Dotted path to the array of lead records in the JSON response. | Via API only |
| `timeout` | number | No | `30000` | Request timeout in milliseconds. | Via API only |
| `retryCount` | number | No | `3` | Number of retry attempts per page on retryable errors. | Via API only |
| `rateLimitDelayMs` | number | No | `200` | Base delay between retries in milliseconds. | Via API only |

### PaginationConfig

| Field | Type | Default | Purpose |
|---|---|---|---|
| `strategy` | `"PAGE_NUMBER" \| "OFFSET" \| "CURSOR" \| "NEXT_URL" \| "TOKEN"` | `"PAGE_NUMBER"` | Pagination style |
| `pageSize` | number | `50` | Records per page |
| `maxPages` | number | `50` | Maximum pages to fetch (safety limit) |
| `pageParam` | string | `"page"` | Query param name for page number (PAGE_NUMBER) |
| `perPageParam` | string | `"per_page"` | Query param name for page size (PAGE_NUMBER) |
| `offsetParam` | string | `"offset"` | Query param name for offset (OFFSET) |
| `limitParam` | string | `"limit"` | Query param name for limit/count (OFFSET, CURSOR, TOKEN) |
| `cursorParam` | string | `"cursor"` | Query param name for cursor value (CURSOR) |
| `cursorPath` | string | undefined | Dotted path in JSON response to find the next cursor |
| `nextUrlPath` | string | undefined | Dotted path in JSON response to find the next page URL |
| `tokenParam` | string | `"pageToken"` | Query param name for page token (TOKEN) |
| `tokenPath` | string | undefined | Dotted path in JSON response to find the next token |

---

## 4. Authentication

### `auth.type = "NONE"`
No authentication headers added.

### `auth.type = "API_KEY"`
| Sub-field | Type | Required |
|---|---|---|
| `apiKey.name` | string | Yes |
| `apiKey.value` | string | Yes |
| `apiKey.in` | `"header" \| "query"` | Yes |

When `in: "header"`, adds header: `<name>: <value>`.
When `in: "query"`, appends `?<name>=<value>` to the URL.

### `auth.type = "BEARER"`
| Sub-field | Type | Required |
|---|---|---|
| `bearerToken` | string | Yes |

Adds header: `Authorization: Bearer <token>`.

### `auth.type = "BASIC"`
| Sub-field | Type | Required |
|---|---|---|
| `basic.username` | string | Yes |
| `basic.password` | string | Yes |

Base64-encodes `username:password` and adds header: `Authorization: Basic <base64>`.

### `auth.type = "CUSTOM_HEADER"`
| Sub-field | Type | Required |
|---|---|---|
| `customHeader.name` | string | Yes |
| `customHeader.value` | string | Yes |

Adds header: `<name>: <value>` (name is lowercased).

### Security
- All auth config is stored in `Connector.configuration` (DB JSON column)
- The `page.tsx` does NOT serialize `configuration` to the frontend
- The admin UI cannot view or edit auth configuration
- REST endpoint auth must be configured via direct API calls or seed data
- **There is no UI for entering REST credentials.** They must be set programmatically.

---

## 5. Request Format

### URL construction

```
baseUrl.replace(/\/+$/, "") + "/" + endpoint.replace(/^\/?/, "")
  + "?" + queryParams (URLSearchParams)
  + "&" + pageParams (from pagination strategy)
  + "&" + apiKey (if auth.type === "API_KEY" && in === "query")
```

Example:
```
baseUrl = "https://api.example.com/"
endpoint = "/v1/leads"
queryParams = { "status": "active" }
pageParams (PAGE_NUMBER, page 1): { "page": "1", "per_page": "50" }

Result: https://api.example.com/v1/leads?status=active&page=1&per_page=50
```

### Default headers

```json
{
  "content-type": "application/json",
  "accept": "application/json",
  ...config.headers,
  ...authHeaders
}
```

### Body

- For `GET` and `DELETE`: no body
- For `POST`, `PUT`, `PATCH`: `config.body` sent as string (raw)

### Timeout

Each individual HTTP request uses an `AbortController` with `config.timeout` (default 30,000ms).

---

## 6. Expected Response Format

The connector expects a **JSON object** as the response body.

### Array extraction

The `leadArrayPath` config field (default `"data"`) is a dotted path used to navigate the JSON object and extract the array of lead records.

**Example: Response JSON:**
```json
{
  "status": "ok",
  "data": {
    "items": [
      { "id": 1, "name": "John Doe", "email": "john@example.com" },
      { "id": 2, "name": "Jane Doe", "email": "jane@example.com" }
    ],
    "total": 2
  }
}
```

With `leadArrayPath: "data.items"`, the connector extracts `[{...}, {...}]`.

With the default `leadArrayPath: "data"`, it would extract an empty array (since `data` is an object, not an array).

### Record field extraction (case-insensitive fallbacks)

Each extracted record object feeds into `toRawPayload()`, which looks for:

| RawPayload field | Lookup order (first match wins) |
|---|---|
| `name` | `name` → `Name` → `company` → `Company` → `fullName` → `full_name` → "" |
| `company` | `company` → `Company` → `business` → `organization` → "" |
| `email` | `email` → `Email` → `emailAddress` → `email_address` → "" |
| `phone` | `phone` → `Phone` → `phoneNumber` → `phone_number` → "" |
| `subject` | `subject` → `Subject` → `title` → "" |
| `_duplicateKey` | `id` → `ID` → `leadId` → `externalId` → `"<connectorId>-<JSON.stringify(record).length>"` |
| `_routing.senderEmail` | `email` → `Email` → `senderEmail` → `sender-email` |
| `_routing.senderDomain` | `domain` |
| `_routing.subject` | `subject` |
| `_routing.recipientGmailAccount` | `recipient` |

### Pagination response paths

All pagination paths use the same dotted-path navigation:

- `config.pagination.cursorPath` — e.g. `"pagination.next_cursor"` → look in `response.pagination.next_cursor`
- `config.pagination.nextUrlPath` — e.g. `"links.next"` → look in `response.links.next`
- `config.pagination.tokenPath` — e.g. `"nextPageToken"` → look in `response.nextPageToken`

---

## 7. Routing for REST Payloads

### Routing hints generated by `buildRoutingHints()`

```javascript
{
  senderEmail: record.email ?? record.Email ?? record.senderEmail ?? record["sender-email"],
  senderDomain: record.domain,
  subject: record.subject,
  recipientGmailAccount: record.recipient,
}
```

These are stored in each `RawPayload._routing` field.

### How the RoutingEngine works

`RoutingEngine.route(hints, payload, connectorId)`:
1. Queries all active `RoutingRule` rows from the database
2. Sorted by `fallback ASC, priority ASC` (fallback=false first, then lowest priority number first)
3. For each rule, checks ALL of the following (if the rule field is set):

   - `rule.recipientGmailAccount` → must equal `hints.recipientGmailAccount`
   - `rule.senderEmail` → must equal `hints.senderEmail` (case-insensitive)
   - `rule.senderDomain` → `hints.senderEmail` must end with `@<rule.senderDomain>` (case-insensitive)
   - `rule.subjectContains` → `hints.subject` must include the string (case-insensitive)
   - `rule.gmailLabel` → must equal `hints.gmailLabel`
4. If `rule.fallback === true`, it matches regardless of hints
5. First match wins. Returns `{ match: { parserId, providerId, ruleId } }`

### Key problem for REST payloads

The `RoutingRule` model fields (`recipientGmailAccount`, `senderEmail`, `senderDomain`, `subjectContains`, `gmailLabel`) are all oriented toward email-based routing. REST payloads derive their hints from record fields like `email`, `domain`, `subject`, `recipient`. This means:

- **To route a REST payload**, you must configure a routing rule that matches on the `email` or `domain` or `subject` field of the incoming JSON records.
- If your REST API returns records with no email-like field (e.g., just `{ "id": 1, "name": "Lead" }`), the routing hints will be empty, and the payload will either hit a fallback rule or be recorded as unmatched (if `senderEmail` is present) or silently skipped (if no routing hints at all).

### Fallback rules

If a routing rule has `fallback: true`, it matches every payload regardless of hints. This is the recommended approach for testing or when there is only one provider.

---

## 8. Parser Integration

### Parser selection

The parserId comes from the routing rule match:
```
parserId = routing.match.parserId ?? context.parserId
```

If the routing rule selected a parser, that is used. Otherwise, the context's parserId (passed at runtime initialization) is used as a fallback.

### Available parsers for REST

**`ExampleParser` (key: `"example"`)** — the most appropriate parser for generic REST payloads.

What it extracts from the raw payload (the REST record, not the full RawPayload wrapper):
```typescript
{
  name: String(input.name ?? "Unknown Lead"),
  email: typeof input.email === "string" ? input.email : undefined,
  phone: typeof input.phone === "string" ? input.phone : undefined,
  company: typeof input.company === "string" ? input.company : undefined,
}
```

Note: The parser receives the **entire `RawPayload`**, not just the original record. The RawPayload contains the extracted fields at the top level (name, email, phone, company, subject) plus the `_routing` and `_duplicateKey` fields. So the ExampleParser can access these directly.

**`GmailParser` (key: `"gmail"`)** — oriented toward email payloads. Would extract `from` header, `subject`, `plainText` etc. Not suitable for generic REST data.

### What happens if...

| Scenario | Behavior |
|---|---|
| No parser exists for the given key | `ConfigurationError` thrown → run fails with status `"failed"` |
| Parser throws | `ParserError` thrown → caught by `processPayloads`, increment `breakdown.parserFailures`, continue to next payload |
| Parser returns invalid data | `LeadNormalizer.validate()` produces warnings (empty name, bad email, bad phone) but does NOT block. The lead is still created with warnings recorded. |
| Parser returns empty name | Warning added: "Lead name is empty or missing". Lead created with empty name. |

---

## 9. Lead Creation Pipeline

### Step-by-step

1. **Duplicate detection** (runtime level, before parser):
   - `isDuplicate()` queries `lead` table for `connectorId` + `sourceReferenceId === _duplicateKey`
   - If found, the payload is skipped entirely (no parsing, no creation)
   - `breakdown.duplicatesSkipped++`

2. **Parser** transforms payload → `NormalizedLead`

3. **Validation** (`LeadNormalizer.validate`):
   - Warnings added for: missing name, invalid email format, invalid phone format
   - Warnings do not block creation

4. **Enrichment** (`LeadNormalizer.enrich`):
   - Sets `sourceId` (from routing match provider), `sourceType: "rest"`, `parserVersion: "1.0"`, `importedAt: now`

5. **Lead creation** (`LeadService.create`):
   - `duplicateService.findPotentialDuplicates()` — checks email/phone for existing leads
   - Prisma transaction:
     - Creates `Lead` record with:
       - `displayName` = lead name
       - All mapped fields (company, email, phone, etc.)
       - `sourceReferenceId` = `_duplicateKey` (for future dedup)
       - `connectorId` from context
       - `sourceId` from routing match
       - `createdById` = actor
       - `status` = `"NEW"` (default), `priority` = `"MEDIUM"` (default)
       - `rawPayload` = the enriched lead's rawPayload (which contains the original record data)
     - If `P2002` unique constraint violation (on `connectorId + sourceReferenceId`):
       - Throws `ServiceError(409)` → runtime catches → `breakdown.duplicatesSkipped++`
     - Records `activityService.record("IMPORTED", ...)`
     - Records `auditService.log("lead.created", ...)`

6. **Sync run record** (after all payloads processed):
   - `recordsSeen` = total raw payloads from connector
   - `recordsCreated` = successful lead creations
   - `recordsSkipped` = warnings count (not duplicates)
   - `errorMessage` = first error if any

### Duplicate detection summary

| Level | Check | When | Outcome |
|---|---|---|---|
| Runtime `isDuplicate()` | DB query: `connectorId + sourceReferenceId` | Before parsing | Skipped, recorded in breakdown |
| DB `UNIQUE` constraint | `@@unique([connectorId, sourceReferenceId])` | At INSERT | `P2002` → 409 → runtime catches, skipped, recorded in breakdown |
| `duplicateService.findPotentialDuplicates` | Email/phone match | Inside LeadService.create | Recorded in activity metadata but does NOT block |

---

## 10. Runtime Details

### Execution Lock

- Mechanism: `UPDATE connector SET isRunning=true WHERE id=? AND isRunning=false`
- If another execution holds the lock, returns 0 rows affected → lock not acquired
- API returns 409 "Connector is already running"
- Lock released in `finally` block after execution completes or fails
- `forceRelease()` available for manual lock reset (admin tool)

### Retry Policy

- Applies to the entire connector `execute()` call
- Retries only `RetryableError` and its subclasses:
  - `RestRateLimitError`, `RestServerError`, `RestTimeoutError`, `RestNetworkError`
  - Also retries network errors: `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, socket hang up
- Max 3 retries (4 total attempts including the first)
- Exponential backoff: 1s, 2s, 4s (capped at 30s)
- Within each page fetch, RestClient has its own retry loop (configurable via `retryCount`, default 3)

### Health Updates

- Executed after sync run by `ConnectorHealthService.recordCompletion()`
- Logic:
  - Success (`"success"` or `"skipped"`): `consecutiveFailures = 0`
  - Failure: `consecutiveFailures++`
  - `healthStatus = consecutiveFailures >= 3 ? "ERROR" : consecutiveFailures >= 1 ? "WARNING" : "HEALTHY"`
- Average duration: `(oldAvg + newDuration) / 2` (simple moving average)
- Also updates `lastDurationMs`, `lastSuccessAt`/`lastFailureAt`, `lastError`

### Sync History

- `SyncHistory.recordStart()`: Creates `ConnectorSyncRun` with `status: "ACTIVE"`
- `SyncHistory.recordCompletion()`: Updates the run with final status, counts, duration, breakdown
- Sync runs viewed via `GET /api/providers/sync-runs?connectorId=<id>`

### Scheduler

- `ConnectorScheduler.discoverDue()`: Finds enabled connectors with non-MANUAL schedule type where `nextScheduledRun <= now`
- `ConnectorScheduler.runDue()`: Iterates due connectors, runs each via `ConnectorRuntime`
- `POST /api/scheduler/trigger`: Triggers all due connectors or a specific one

### Manual Sync

- `POST /api/connectors/[id]/sync`: Single-connector sync triggered by admin
- Uses `SYSTEM_ACTOR` equivalent (the user's session, not system)
- After runtime completes:
  - Updates connector `runtimeMetadata` with sync results
  - Records health via `ConnectorHealthService`
  - Returns the execution result to the frontend
- Frontend calls `router.refresh()` to reload the page with updated data

---

## 11. Existing Examples in Repository

### Smoke test (`scripts/phase3a-smoke.ts`)

This script tests the **Gmail** connector and provider/routing infrastructure. It does NOT test the REST connector.

Key operations in the script:
- Creates a Provider (`LeadSource`), Parser, Connector (type `"GMAIL"`), RoutingRule
- Tests routing, unmatched email, parser requests
- Tests `connectorService.recordSyncRun()` and `listSyncRuns()`
- Cleans up all created records

### No REST-specific tests

There are **no** REST connector tests, fixtures, sample configurations, or seed data in the repository. The REST connector has never been exercised end-to-end.

---

## 12. Manual Setup Guide

### Prerequisites

- A running REST API that returns JSON. For testing, you can use a mock or a simple endpoint.
- Admin access to the LeadBridge UI.

### Step 1: Create a Provider

In Admin > Providers, create a provider:
- Name: "My REST Provider" (or any name)
- Slug: "my-rest-provider" (unique identifier)
- Source Type: "rest" (informational, not technically validated)

### Step 2: Create a Connector

In Admin > Connectors, click "Create Connector":
- Name: "My REST Connector"
- Type: "REST API"

This creates a connector with default empty configuration. The configuration (URL, auth, etc.) cannot be set from the UI.

### Step 3: Set Connector Configuration (API call required)

You must set the configuration via a direct API call:

```
PATCH /api/connectors/<connector-id>/settings
{
  "configuration": {
    "baseUrl": "https://jsonplaceholder.typicode.com",
    "endpoint": "/todos",
    "leadArrayPath": "",
    "pagination": { "strategy": "PAGE_NUMBER", "pageSize": 5, "maxPages": 1 }
  }
}
```

**Important:** The PATCH endpoint currently only accepts `enabled`, `scheduleType`, `scheduleConfig`, and `resetHealth`. It does NOT accept `configuration`. You must update the configuration directly in the database or modify the API handler.

**Workaround:** Use Prisma directly or a SQL query:
```sql
UPDATE connector SET configuration = '{
  "baseUrl": "https://jsonplaceholder.typicode.com",
  "endpoint": "/todos",
  "leadArrayPath": "",
  "pagination": { "strategy": "PAGE_NUMBER", "pageSize": 5, "maxPages": 1 }
}' WHERE id = '<connector-id>';
```

### Step 4: Create a Parser (via code registration)

The `"example"` parser is already registered in `parserRegistry`. The admin UI needs to sync parsers by calling the parser management UI (the page calls `parserService.listForManagement()` which upserts registered parsers into the `Parser` table).

After visiting Admin > Providers, the `"example"` parser should appear in the parser list. If not, the `Parser` table needs the entry manually:

```sql
INSERT INTO parser (id, name, type, version, description, active)
VALUES (gen_random_uuid()::text, 'example', 'ExampleParser', '1.0.0', 'Generic parser for testing and demonstration', true);
```

### Step 5: Create a Routing Rule

In Admin > Providers:
1. Select your provider
2. Add routing rule:
   - Name: "Catch-all rule"
   - Parser: "example" (must exist in Parser table)
   - Fallback: true (matches all payloads)
   - Priority: 100

### Step 6: Enable the Connector

In Admin > Connectors:
- Click Edit on your connector
- Check "Enabled"
- Save

### Step 7: Trigger Manual Sync

In Admin > Connectors:
- Click the Sync button (Play icon)

### Step 8: Verify

After sync completes:

1. **Connector Health**: Check the KPI cards — healthy count should increase
2. **Sync History**: Click the History icon on the connector row
   - Should show: recordsSeen, recordsCreated
3. **Lead Creation**: Navigate to Admin > Leads
   - Should see new leads with source "My REST Provider"
   - Lead names come from the `name` field of the REST JSON records
4. **Duplicate Detection**: Run sync again
   - Sync history should show recordsSkipped > 0 (or duplicatesSkipped in breakdown)

---

## 13. Gaps Preventing End-to-End REST Test

### Critical

| # | Gap | File | Impact |
|---|---|---|---|
| 1 | **No API route to set connector `configuration`** | `src/app/api/connectors/[id]/settings/route.ts` | The PATCH handler only accepts `enabled`, `scheduleType`, `scheduleConfig`, `resetHealth`. It does NOT accept `configuration`. ADMIN must use direct DB access to set baseUrl, endpoint, auth, etc. |
| 2 | **`leadArrayPath` default `"data"` is wrong for most APIs** | `rest-types.ts:39` | Most APIs return records at the root of an array (e.g., `[{...}]`) or at a nested path (e.g., `{ "data": [...] }`). The default `"data"` expects `response.data` to be an array. For an API returning a bare array `[{...}]`, `leadArrayPath` should be empty string `""`. But there is no UI to set it. |
| 3 | **External API testing requires a test fixture or local endpoint** | REST connector configuration | External production APIs require a live URL or a separately hosted local test fixture; the production application does not expose mock data routes. |

### Recommended

| # | Gap | Impact |
|---|---|---|
| 4 | **No UI for REST configuration** | Admin cannot set baseUrl, endpoint, auth, or leadArrayPath from the UI. Requires direct DB or API calls. |
| 5 | **RoutingRule model oriented toward email** | `RoutingRule` has dedicated fields for Gmail (`recipientGmailAccount`, `gmailLabel`, `senderEmail`, `senderDomain`). REST payload routing hints use the same fields but derive them from record-level fields (`email`, `domain`, `subject`, `recipient`). If the REST API returns records without these fields, routing hints are empty and the payload cannot be routed unless a fallback rule exists. |
| 6 | **ExampleParser is minimal** | Only extracts `name`, `email`, `phone`, `company`. Does not extract `city`, `state`, `country`, `sourceReferenceId`, `rawPayload`, `requirement`, or other NormalizedLead fields. Some of these are set by enrichment (`sourceId`, `sourceType`, `parserVersion`, `importedAt`) but the richer fields from the REST payload are lost. |
| 7 | **Runtime only runs on admin session** | `POST /api/connectors/[id]/sync` uses the admin's session user as the actor. Leads are created with `createdById = admin.id`. For scheduled syncs, `SYSTEM_ACTOR` (`{ id: "system", role: "ADMIN" }`) is used. |

### Nice to Have

| # | Gap | Impact |
|---|---|---|
| 8 | Environment-managed Gmail account discovery is separate from REST | `ConfiguredGmailAccount` remains in use by the Gmail environment discovery helper; the obsolete generic environment runtime scaffolding has been removed. |
| 9 | Route handler pattern duplication | Every `[id]` route handler duplicates the `params` resolution pattern. Not a bug but adds boilerplate. |
| 10 | `recordsUpdated` always 0 | `SyncHistory.recordCompletion()` hardcodes `recordsUpdated: 0`. The runtime never updates existing leads. |

---

## Summary

The REST connector features a complete, well-structured code path from HTTP fetch to lead creation. Key implementation notes:

1. **Connector Execution Lock & Retries**: Supported via `ExecutionLock` and `RetryPolicy` with exponential backoff on retryable HTTP errors.
2. **Local Testing**: REST connector execution can be verified with an externally supplied sample JSON endpoint and the authenticated connector test flow.
3. **Configuration & Testing**: Setting custom `configuration` (baseUrl, endpoint, auth keys) is performed via database configuration updates or seed scripts, and connection testing is executed via `POST /api/providers/connectors/test`.
