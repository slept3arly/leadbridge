# LeadBridge Integrations

> **Status:** Canonical
> **Last verified:** 2026-09-17
> **Source of truth:** `src/connectors/`, `src/parsers/`, `src/runtime/`

## Overview

LeadBridge ingests lead data from external sources via a connector/parser/runtime pipeline. Two connector types are implemented: Gmail and REST.

## Architecture

```text
External Source
  ↓
Connector (fetches raw payloads)
  ↓
Routing Engine (matches rules to determine provider + parser)
  ↓
Parser (transforms raw payload to NormalizedLead)
  ↓
LeadNormalizer (validates and enriches)
  ↓
LeadService (creates lead in transaction)
```

## Connectors

### Interface

```typescript
// src/runtime/runtime-types.ts
interface IConnector {
  readonly key: string;
  execute(context: ExecutionContext): Promise<RawPayload[]>;
}
```

### Registry

```typescript
// src/connectors/registry.ts
factoryRegistry.set("gmail", (config) => new GmailConnector(config));
factoryRegistry.set("rest", (config) => new RestConnector(config));
```

### Gmail Connector

- **Files:** `src/connectors/gmail/`
- **Auth:** OAuth2 via environment variables (`GMAIL_<KEY>_CLIENT_ID`, `_CLIENT_SECRET`, `_REFRESH_TOKEN`)
- **Discovery:** `src/connectors/environment.ts` discovers configured Gmail accounts from env
- **Fetch:** Reads unread/history messages from Gmail API
- **Error handling:** Classified errors (auth, permission, quota, history expired, mailbox)

### REST Connector

- **Files:** `src/connectors/rest/`
- **Auth:** NONE, API_KEY, BEARER, BASIC, CUSTOM_HEADER
- **Pagination:** PAGE_NUMBER, OFFSET, CURSOR, NEXT_URL, TOKEN
- **Config:** `baseUrl`, `endpoint`, `method`, `headers`, `queryParams`, `body`, `auth`, `pagination`, `leadArrayPath`
- **Timeout:** Configurable per-request (default 30s)
- **Retries:** Configurable per-page retry with backoff

### Configuration

REST connector configuration is stored in `Connector.configuration` (JSON column). Configuration can be set through:

1. **POST `/api/connectors`** -- accepts `configuration` in the request body for REST connectors, validated against `restConnectorConfigSchema`
2. **PATCH `/api/connectors/[id]/settings`** -- accepts `configuration` for REST connectors (merges with existing config, retains secrets not provided in the update). Also accepts `enabled`, `scheduleType`, `scheduleConfig`, `resetHealth`, `sourceId`.
3. **Connector Edit UI** (`src/components/connectors/connector-edit-modal.tsx`) -- has a "Configuration" tab for REST connectors that allows editing baseUrl, endpoint, method, headers, queryParams, body, auth, and pagination settings.

Secrets (API key values, bearer tokens, basic auth passwords, custom header values) are sanitized in the UI -- shown as "configured" booleans rather than actual values. The UI sends the full config back to the API on save.

## Parsers

### Interface

```typescript
// src/parsers/base-parser.ts
abstract class BaseParser<T> {
  abstract key: string;
  abstract parse(input: T): NormalizedLead;
}
```

### Registry

```typescript
// src/parsers/registry.ts
parserRegistry.set("example", new ExampleParser());
parserRegistry.set("gmail", new GmailParser());
```

### ExampleParser

Extracts `name`, `email`, `phone`, `company` from flat JSON. Used for generic REST payloads.

### GmailParser

Extracts from email headers, MIME body, plainText, HTML. Used for Gmail payloads.

## Runtime Engine

### ConnectorRuntime (`src/runtime/connector-runtime.ts`)

Main orchestrator:

1. Acquires execution lock
2. Records sync run start
3. Executes connector (with retry policy)
4. For each payload: dedup check → routing → parsing → normalization → lead creation
5. Records sync run completion
6. Releases execution lock

### RoutingEngine (`src/runtime/routing-engine.ts`)

- Queries all active `RoutingRule` rows sorted by `fallback ASC, priority ASC`
- Matches against: `recipientGmailAccount`, `senderEmail` (case-insensitive), `senderDomain` (endsWith), `subjectContains` (includes), `gmailLabel`
- Fallback rules (`fallback: true`) match all payloads
- First match wins
- No match + sender email present → creates `UnmatchedEmail` record
- No match + no sender email → logs warning, skips

### LeadNormalizer (`src/runtime/lead-normalizer.ts`)

- Validates: name not empty, email format, phone format
- Enriches: `sourceId`, `sourceType`, `parserVersion`, `importedAt`
- Warnings do NOT block lead creation

### RetryPolicy (`src/runtime/retry-policy.ts`)

- Retries `RetryableError` subclasses (network, timeout, rate-limit)
- Max 3 retries (4 total attempts)
- Exponential backoff: 1s → 2s → 4s (capped at 30s)

### ExecutionLock (`src/services/execution-lock.service.ts`)

- `UPDATE connector SET isRunning=true WHERE id=? AND isRunning=false`
- Concurrent runs return HTTP 409
- Released in `finally` block
- `forceRelease()` available for stuck connectors

### ConnectorHealthService (`src/services/connector-health.service.ts`)

- Success: `consecutiveFailures = 0`, `healthStatus = "HEALTHY"`
- Failure: `consecutiveFailures++`, status = `WARNING` (1-2) or `ERROR` (>= 3)
- Average duration: simple moving average

### SyncHistory (`src/runtime/sync-history.ts`)

- `recordStart()`: Creates `ConnectorSyncRun` with status ACTIVE
- `recordCompletion()`: Updates with final status, counts, error, metadata

## Scheduler

`POST /api/scheduler/trigger` discovers enabled connectors with `nextScheduledRun <= now` and executes them sequentially. Must be triggered by an external cron service (Vercel Cron, system crontab, etc.).

## Parser Preview

`POST /api/parsers/preview` accepts a parser key and sample JSON payload, returns the parsed `NormalizedLead` for testing.

## Connector Test

`POST /api/providers/connectors/test` accepts a `connectorId`, looks up the connector, and calls `GmailConnector.testConnection()` or `RestConnector.testConnection()`.
