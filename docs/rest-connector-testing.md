# REST Connector Developer Testing Guide

This guide describes a repeatable local REST connector test using the standalone Express fixture in [`mock-rest-api/`](../mock-rest-api/README.md). It reflects the current code in `src/connectors/rest/`, the Admin UI, and the connector runtime. For broader architecture and route references, see [Integrations](./integrations.md), [API Reference](./api.md), and [Development Guide](./development.md).

## 1. Purpose and scope

Use this procedure to configure an Admin-owned REST connector, test reachability and authentication, import the fixture's static leads, check pagination and duplicate handling, inspect sync history, and exercise upstream failure scenarios.

The mock is independent of LeadBridge. It uses a fixed JavaScript data file and has no database. LeadBridge still needs its normal development database and authentication configuration for provider, routing, connector, lead, and sync-history records. Use a dedicated development database; do not run import tests against production.

## 2. Architecture and data flow

```text
mock-rest-api Express endpoints
  -> REST client (URL policy, auth, HTTP, extraction, pagination)
  -> REST connector (raw payload and stable external ID)
  -> connector runtime and execution lock
  -> active routing rule selects provider and parser
  -> Example Parser and lead normalization
  -> lead creation with connector + external-ID duplicate protection
  -> sync history and connector health
```

**Test Connection** checks the configured request and response extraction. It does not run routing, parse records into leads, or create leads. **Manual Sync** runs the import pipeline. The Admin API routes for both actions require an authenticated Admin session.

The REST connector derives its duplicate key from a record's `id` (then `ID`, `leadId`, or `externalId` as fallbacks). The mock's stable `id` values are used with the connector identity to skip repeated imports. The `example` parser maps `name`, `email`, `phone`, and `company`; the mock's `requirement` remains in the raw payload and is not mapped to a dedicated lead field by this parser.

## 3. Prerequisites and environment setup

- Node.js **20.6 or newer** and npm for the mock (`--env-file-if-exists` is used by its scripts).
- LeadBridge dependencies installed (`pnpm install`) and its local development environment configured, including an isolated PostgreSQL database and working Admin login.
- Network access from the LeadBridge server process to the mock API.

Do not copy production database credentials into a developer environment. The mock is static; no database setup, migration, seed, or reset is required for it.

## 4. Starting the mock REST API

In a terminal, from the LeadBridge repository root:

```bash
cd mock-rest-api
npm install
cp .env.example .env
```

Edit `mock-rest-api/.env` and set a private, local-only `MOCK_API_KEY` value. Keep `.env` untracked and do not use a production credential. The current fixture defaults to port `4001` and has a built-in local fallback if `MOCK_API_KEY` is unset; override it for isolated local tests and never use that fallback outside local testing.

The local `.env` shape is:

```dotenv
PORT=4001
MOCK_API_KEY=replace-with-a-local-test-value
```

Start the service:

```bash
npm start
```

For restart-on-change during mock development, use `npm run dev`. The current `server.js` listens on `0.0.0.0:<PORT>` and logs the bind address. The service defaults to port `4001`.

From a second terminal, verify the endpoint using the address reachable from LeadBridge:

```bash
curl -i 'http://localhost:4001/api/leads?page=1'
```

Expect HTTP 200 and JSON with five entries under `data`. Use `localhost` only when LeadBridge and the mock share a network namespace where loopback reaches the mock.

## 5. Mock API endpoints and expected responses

All successful lead endpoints use the same static 18-record data set. Each response has `data` and `pagination`; pages are one-based and fixed at five records per page. Invalid page values (including zero, negative, decimal, or non-numeric values) return HTTP 400. Requests beyond the last page return an empty `data` array and pagination metadata with `hasNextPage: false`.

### `GET /api/leads`

No authentication is required.

```bash
curl -i 'http://localhost:4001/api/leads?page=1'
```

Expected response shape (record fields shown for one item):

```json
{
  "data": [
    {
      "id": "mock-lead-1001",
      "name": "Avery Bennett",
      "email": "avery.bennett@example.test",
      "phone": "+1-202-555-0101",
      "company": "Northstar Analytics",
      "requirement": "Interested in consolidating sales reporting across three regional teams."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 5,
    "totalRecords": 18,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

The actual first page contains five objects. Pages 1–3 contain five records each; page 4 contains the remaining three.

### `GET /api/leads-auth`

Requires an `x-api-key` header matching `MOCK_API_KEY`. A missing or invalid key returns HTTP 401 with an `UNAUTHORIZED` JSON error. A valid key returns the same lead response envelope as `/api/leads`.

### `GET /api/leads-error`

Always returns HTTP 500 with this intentional error shape:

```json
{
  "error": {
    "code": "MOCK_UPSTREAM_FAILURE",
    "message": "This endpoint intentionally simulates an upstream server error."
  }
}
```

Use it to test failure reporting. It is not a lead-data endpoint.

## 6. Mock API authentication key setup

The mock reads `MOCK_API_KEY` from its process environment or `.env`. Set a non-production local value, restart the mock, and use the same value in the LeadBridge connector's API Key configuration. The mock accepts the key only in the `x-api-key` header; it does not accept query-string authentication.

Direct checks (replace the placeholder in your shell; do not commit it):

```bash
curl -i 'http://localhost:4001/api/leads-auth?page=1'
curl -i 'http://localhost:4001/api/leads-auth?page=1' \
  -H 'x-api-key: <deliberately-wrong-local-key>'
curl -i 'http://localhost:4001/api/leads-auth?page=1' \
  -H 'x-api-key: <the-MOCK_API_KEY-value>'
```

The first two requests should return HTTP 401; the last should return HTTP 200. Do not paste the actual key into shared documentation, screenshots, tickets, or shell history that will be shared.

## 7. Local networking and WSL

The fixture binds to `0.0.0.0`, so it listens on all IPv4 interfaces available to that process. `0.0.0.0` is a **bind address**, not a destination to enter in LeadBridge. Use a reachable host name or interface address and port `4001`.

- **Both processes in the same WSL instance:** try `http://localhost:4001` first.
- **LeadBridge in a different environment (for example, Windows, a container, or another VM):** use the mock host/address reachable from the LeadBridge server process. WSL addresses can change; do not hardcode an address into code or share it as a permanent value.
- Confirm reachability from the LeadBridge host/process environment, not only from the browser. For example, run `curl` there using the same host and port configured in the connector.
- If the mock prints a `0.0.0.0` bind message but requests fail, check port conflicts, host firewall rules, WSL/container port forwarding, and whether the expected mock process is the one actually listening.

Binding to all interfaces may make this test service reachable from other machines on the network. Keep it on a trusted development network, use a local-only API key, and stop it when testing is complete.

## 8. Development-only REST origin allowlisting

LeadBridge blocks unsafe destinations. Public HTTPS origins normally need no allowlist. Plain HTTP and private-network destinations require an exact trusted origin. In development, configure the server-side variable below for the mock origin:

```dotenv
REST_CONNECTOR_DEV_ALLOWED_ORIGINS=http://<reachable-mock-host>:4001
```

Put this in the LeadBridge **development server** environment (for example, its local `.env.local`), run the app with `pnpm dev` (which sets `NODE_ENV=development`), and restart the Next.js server. The allowed origin must exactly match the connector's Base URL origin, including scheme and port; do not include a path, query string, wildcard, or credentials. If there are multiple development origins, separate exact origins with commas.

`REST_CONNECTOR_DEV_ALLOWED_ORIGINS` is honored only when `NODE_ENV=development`. Do not use it in production. Production private-network integrations, if deliberately required, use the separate `REST_CONNECTOR_ALLOWED_ORIGINS` setting and require explicit security review. Neither setting should contain broad or user-controlled entries. DNS answers and redirects remain subject to the REST security policy; cross-origin pagination/redirects also require explicit trust.

## 9. Provider creation

Sign in as an Admin and open **Admin → Providers** (`/admin/providers`). Create a dedicated test provider, for example:

- Name: `REST Connector QA Provider`
- Slug: `rest-connector-qa`
- Source Type: `REST`
- Description: `Local mock REST connector tests`

Keep the provider active. A dedicated provider makes imported leads and connector ownership easier to identify. Do not reuse a production provider for fixture tests.

## 10. Routing-rule creation and fallback configuration

Open the Routing Rules section in **Admin → Providers** and create an active rule:

- Provider: the dedicated REST test provider.
- Parser: **Example Parser** (`example`). Its supported provider-type list is empty, so it is available for generic test payloads.
- Active: on.
- Fallback: on for a simple isolated test setup.
- Priority: `100` unless another active fallback has an earlier (lower-numbered) priority.
- Connector: select the test connector if the UI offers it; for fallback rules, current routing code treats fallback as a global catch-all and does not apply the connector scope.

Non-fallback rules are evaluated first, then fallback rules, each by ascending priority. The first matching rule wins. An active fallback can therefore affect other connector imports in this LeadBridge database. Prefer a dedicated development database; in a shared development database, review existing rules and use a connector-scoped non-fallback rule where possible. If you use a fallback, ensure it is the intended first applicable fallback and remove/deactivate it after testing.

## 11. REST connector creation and configuration

Open **Admin → Connectors** (`/admin/connectors`), choose **Add Connector**, select **REST API**, assign the test provider, and configure:

| Setting | Value for unauthenticated test |
|---|---|
| Base URL | `http://<reachable-mock-host>:4001` |
| Endpoint | `/api/leads` |
| HTTP Method | `GET` |
| Authentication | `None` |
| Lead Array Path | `data` |
| Timeout | `10000`–`30000` ms |
| Retry Count | `3` (allowed range 0–3) |
| Rate Limit Delay | `0`–`200` ms |
| Pagination strategy | `Page Number` |
| Page Parameter | `page` |
| Page Size Parameter | `per_page` |
| Page Size | `5` |
| Max Pages | `4` |
| Schedule | `Manual` during testing |

The mock fixes its page size at five and ignores the `per_page` parameter; the connector's page size also controls when page-number pagination stops. Use page size five and max pages four to fetch all 18 records as 5 + 5 + 5 + 3. The connector UI validates configuration on save. Base URL cannot include credentials, query parameters, or a fragment; endpoint must be a relative path and query parameters are configured separately.

Save the connector configuration. To test the authenticated endpoint later, keep the same connector and change only Endpoint and Authentication as described in [API-key authentication testing](#16-api-key-authentication-testing). Blank secret inputs preserve a saved secret; switching auth type to None clears auth.

New connectors are created disabled. They can still be tested and manually synced; keep the schedule set to Manual and the connector disabled if you want to avoid automatic execution during setup.

## 12. Pagination configuration and expected page behavior

For the fixture, the REST client requests `page=1`, then advances the page number while each response contains at least the configured page size. The fixture returns:

| Page | Records | `hasNextPage` |
|---:|---:|---|
| 1 | 5 | true |
| 2 | 5 | true |
| 3 | 5 | true |
| 4 | 3 | false |

The client stops when a page is shorter than the configured size, reaches an empty page, or reaches its configured maximum. This fixture does not test cursor, token, offset, or next-URL pagination; those strategies have separate settings in the UI and require a response/API that implements their continuation metadata. A `maxPages` limit reached while the response still indicates more records fails the sync rather than silently reporting a complete import.

## 13. Connection testing

Save the connector, then click **Test connection** in the Admin Connectors table. For `/api/leads`, expect a successful reachability message and HTTP 200 diagnostic. The test performs the configured request and checks JSON/array extraction, but it does not create leads or prove routing/parser behavior; use Manual Sync for that.

The REST test route currently parses the response and attempts the configured array extraction before it reports a non-2xx status. Consequently, an error JSON body without the configured `data` array can surface as an array-path diagnostic instead of the upstream status. Use direct `curl` and the Manual Sync history for authoritative error-endpoint checks.

## 14. Initial import testing

With `/api/leads`, `data`, page size five, max pages four, the provider and active route saved:

1. Run **Manual Sync** for the connector.
2. Wait for the request to finish and refresh the Connectors page if needed.
3. Open **Sync History** for that connector.
4. Confirm `recordsSeen=18`, `recordsCreated=18`, `recordsUpdated=0`, and `recordsSkipped=0`.
5. Open Admin Leads and filter/identify records from the test provider. Confirm the records have the expected names, companies, and available contact data.

The supplied manual test record for this fixture reported 18 seen, 18 created, 0 updated, and 0 skipped across four pages (5 + 5 + 5 + 3). This is a previously observed manual result, not a result produced by this documentation change.

## 15. Duplicate detection testing

Run Manual Sync again without changing the fixture data or connector identity. The stable external `id` values are reused. The connector stores these as source references; LeadBridge checks the connector/source-reference pair and skips existing leads.

Expected for the reported repeat test: 18 seen, 0 created, 0 updated, 18 skipped. The supplied manual test reported no duplicate leads created. LeadBridge does not update an existing imported lead during this connector flow; Sync History reports `recordsUpdated=0`.

## 16. API-key authentication testing

The mock requires an API key in the `x-api-key` header. First verify the mock directly using the three requests in [Mock API authentication key setup](#6-mock-api-authentication-key-setup). Then, in Connector Edit → Configuration:

1. Set Endpoint to `/api/leads-auth`.
2. Set Authentication to **API Key**.
3. Set Key Name to `x-api-key`, Location to **Header**, and Key Value to the local `MOCK_API_KEY` value.
4. Save and run Test Connection. A correct key should reach the authenticated lead endpoint.
5. Run Manual Sync. Expected repeat results, if the same connector imported `/api/leads` earlier, are 18 seen and 18 skipped, with no new leads.
6. For missing/invalid-key checks, verify HTTP 401 directly against the mock. A LeadBridge invalid-key Test Connection result has not been verified as part of the recorded manual test; because of the response-extraction order described above, it may show an array-path diagnostic rather than a clean 401 classification. Do not mark this UI case passed without separately observing it.

The supplied manual results report that valid API-key authentication succeeded and the authenticated repeat sync saw 18, created 0, updated 0, and skipped 18. The mock's missing-key 401 was also observed directly. No invalid-key-through-LeadBridge pass is claimed.

## 17. HTTP 500 error handling

Verify the fixture directly first:

```bash
curl -i 'http://localhost:4001/api/leads-error'
```

Expect HTTP 500 and `MOCK_UPSTREAM_FAILURE` JSON. This direct response was observed in the supplied manual results; it does not prove LeadBridge's sync handling.

For a LeadBridge sync test, edit the test connector Endpoint to `/api/leads-error`, save, and run Manual Sync. The REST sync client classifies HTTP 5xx responses as retryable server failures up to the connector's configured attempt limit. If attempts are exhausted, the sync should finish in an error state; inspect Sync History and the connector health/status. This end-to-end sync outcome was not confirmed in the recorded manual testing, so treat it as a test to perform, not a verified result. Do not expect any leads to be created from the error response.

## 18. Recovery after failure

After any failure test:

1. Restore Endpoint to `/api/leads` (or `/api/leads-auth` with valid credentials).
2. Confirm Base URL, Lead Array Path, page-size/max-pages settings, and auth type/value.
3. Save, then run Test Connection.
4. Run Manual Sync and confirm it completes. Since the same stable IDs were imported already, expect existing records to be skipped rather than recreated.
5. Review Sync History and connector health/status for the latest successful run.

An upstream failure does not require resetting the static mock dataset. Restore the connector configuration before any scheduled run can reach the failure endpoint.

## 19. Sync History interpretation

Open **Sync History** from the connector row. Relevant fields are:

- **Seen:** raw payload count returned by the connector.
- **Created:** leads created during that run.
- **Updated:** currently recorded as zero; this import path creates or skips rather than updating existing leads.
- **Skipped:** duplicates plus routing, parser, validation, and per-record processing failures.
- **Status:** successful runs display as Success; failed runs display as Failed. An active run may show In progress in the completion column.
- **Error details:** the current Sync History modal does not render the stored `errorMessage` column; use the connector's status/health and run metadata/API response when diagnosing a failed run.

The detailed breakdown is also stored in run metadata, including duplicate skips, routing failures, parser failures, validation failures, and connector failures. A run can see records but create fewer leads when processing/routing rejects individual records.

## 20. Troubleshooting common errors

| Symptom | Likely cause and checks |
|---|---|
| Connection test says HTTP origin must be allowlisted | Add the exact mock origin to `REST_CONNECTOR_DEV_ALLOWED_ORIGINS` in the LeadBridge development server environment, restart LeadBridge, and ensure `NODE_ENV=development`. |
| `REST destination resolves to a prohibited network address` | Private/local destination is not trusted by the active exact-origin policy. Do not bypass this with a wildcard or production setting. Check the exact origin and development-only configuration. |
| Connection refused or unreachable | Confirm the mock is running, port 4001 is correct and reachable from the LeadBridge server, the endpoint host matches the allowlisted origin, and no other process owns the port. |
| Works with `curl` from one terminal, not LeadBridge | The connector request is server-side. Run curl from the LeadBridge process environment and use the same host/network namespace, not a browser-only reachable address. |
| `REST response did not contain an array at the configured Lead Array Path` | For successful lead endpoints, set Lead Array Path to `data`. For the error/auth failure endpoints, the error body intentionally has no `data` array; inspect direct HTTP response and sync behavior. |
| HTTP 400 from `/api/leads` | `page` must be a positive integer. Check page parameter name and value. |
| HTTP 401 from `/api/leads-auth` | Check `MOCK_API_KEY`, restart the mock after changing it, and configure exact `x-api-key` header authentication in LeadBridge. |
| Sync sees 18 but creates zero | Check the active routing rule, provider, parser selection, record validation, and whether the same connector already imported these external IDs. Review skipped count and metadata. |
| Only some records create | The fixture intentionally omits some optional contact fields. Review lead validation and per-record failure breakdown; do not assume every optional field is required. |
| Another provider receives fixture leads | Review active non-fallback rules and global fallback rules. First matching non-fallback rule wins; the first fallback by priority is a global catch-all. |
| Sync reports already running (HTTP 409) | Wait for the current sync to finish, then retry. Connector executions are protected by a lock. |
| Error endpoint gives an array-path diagnostic in Test Connection | Test Connection extracts the configured array before surfacing non-2xx status. Use `curl` for the HTTP status and Manual Sync/Sync History to test sync failure handling. |

## 21. Cleanup and reset instructions

- Stop the mock with `Ctrl+C`. The static 18-record fixture needs no reset.
- Restore the connector to `/api/leads`, set the intended auth mode, and keep its schedule Manual unless scheduling is specifically under test.
- Deactivate or remove the temporary routing rule and test connector when finished. Remove the test provider only after checking whether it is still referenced.
- For test leads, use only a dedicated development database. Admin lead deletion is permanent and removes related notes, follow-ups, activities, and attachments; identify and review each test lead before deleting it. Do not use SQL truncate/reset/seed commands for this workflow.
- Remove the development-only origin setting from the local environment when it is no longer needed, then restart LeadBridge. Never copy it to production.

## 22. Final testing checklist

### Evidence status

- **Manually observed for the standalone fixture:** the supplied results report successful REST connection after adding the development origin, an initial 18-seen/18-created import over four pages (5 + 5 + 5 + 3), no duplicates on repeat, successful valid-key authentication with 18 seen/18 skipped, a direct mock 401 without a key, and a direct mock 500 from `/api/leads-error`. These are prior manual observations, not results from the automated test command below.
- **Automated coverage:** `node --import tsx tests/phase1-hardening.test.ts` passed in this workspace with 11 passed and 1 pre-existing skipped test. Its local HTTP fixture covers REST destination policy, Test Connection to a development-allowlisted local endpoint, connection refusal reporting, API-key header/query and Bearer/Basic auth handling, response extraction, pagination, retries, and HTTP failures. It does not run a database-backed LeadBridge import against `mock-rest-api/`.
- **Not verified end to end in the recorded manual results:** invalid API key handling through LeadBridge and LeadBridge Manual Sync behavior for the mock HTTP 500 endpoint. Test these separately before marking them passed. The PostgreSQL execution-fencing integration test is a distinct test and only runs when an isolated `LEADBRIDGE_TEST_DATABASE_URL` is supplied; it is skipped otherwise.

- [ ] Mock runs on the expected port and is reachable from the LeadBridge server environment.
- [ ] Mock `MOCK_API_KEY` is local-only and not committed.
- [ ] LeadBridge uses a dedicated development database and Admin account.
- [ ] Development allowlist is an exact origin and is enabled only under `NODE_ENV=development`.
- [ ] Test provider is active and the parser is `example`.
- [ ] Active routing rule points to the test provider and is not unexpectedly shadowed or globally affecting another integration.
- [ ] Connector uses the intended Base URL, endpoint, `GET`, `data`, Page Number, page size 5, and max pages 4.
- [ ] Test Connection succeeds for `/api/leads`.
- [ ] Initial Manual Sync reports 18 seen, 18 created, 0 updated, 0 skipped.
- [ ] Repeat Manual Sync reports no newly created duplicate leads.
- [ ] Valid API-key direct request and authenticated connector sync succeed.
- [ ] Missing/invalid key returns HTTP 401 directly from the mock; LeadBridge invalid-key diagnostics are separately observed before being marked verified.
- [ ] Error endpoint returns HTTP 500 directly; LeadBridge Manual Sync failure behavior is separately observed before being marked verified.
- [ ] Connector endpoint is restored to `/api/leads` and a recovery sync completes.
- [ ] Sync History and connector health are reviewed.
- [ ] Temporary rule/configuration is disabled or removed, and the local origin allowance is removed when no longer needed.
