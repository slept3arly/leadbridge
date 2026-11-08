# Export Workspace: Advanced Lead Filters and Numeric Lead Number

> **Status:** Advanced Lead filters are implemented. Numeric Lead Number export is blocked by the current data model and remains unchanged.
> **Verified against:** current Leads list query, export compatibility route, query builder, workspace, Prisma schema, and migration history.

## Implemented Lead filters

The Lead workspace now exposes these filters in both Admin and Senior Sales workspaces:

| Filter | Query parameter | Values and behavior |
|---|---|---|
| Lead Status | `status` | Multi-select; `NEW`, `CONVERTED`, `LOST`, `SPAM`, `ON_HOLD` |
| Lead Source | `source` | Multi-select of source record IDs loaded for the workspace |
| Activity Date | `activityDate`, `activityFrom`, `activityTo` | Any (omitted), `today`, `yesterday`, or `custom`; date is `ActivityEvent.occurredAt` |
| Action | `activityAction` | Multi-select; `CALL`, `WHATSAPP` |
| Response | `activityResponse` | Multi-select; `PICKED_UP`, `REPLIED`, `NO_RESPONSE`, `INVALID_NUMBER`; All Responses omits the parameter |
| Priority | `priority` | Multi-select; `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| Category | `category` | Multi-select; `MEDICAL_REPRESENTATIVE`, `RETAILER`, `WHOLESALER`, `DISTRIBUTOR`, `MARKETING`, `THIRD_PARTY`, `DOCTOR`, `FRANCHISE`, `BUSINESS`, `HOSPITAL`, `CLINIC`, `PHARMACY`, `LABORATORY`, `MANUFACTURER`, `CORPORATE`, `GOVERNMENT`, `OTHER` |
| Interest | `activityInterest` | Multi-select; `INTERESTED`, `NOT_INTERESTED` |
| Archived state | `archived` | `false` = active, `true` = archived; omission means both for the dedicated workspace |
| Search | `search` | Search across display name, company, email, phone, and stored lead number |
| Lead created | `from`, `to` | Inclusive UTC date range on `Lead.createdAt` |
| Assigned salesperson | `assignedUserId` | ADMIN only; one user ID or `unassigned`; never changes the Sales actor scope |

Multi-value parameters are comma-separated. Values within a filter are ORed; different filter groups are ANDed. Duplicate selections are deduplicated by validation. Unknown parameters, empty list items, malformed dates, invalid enum values, repeated query keys, and incompatible date selections are rejected.

The exact lead classification values are sourced from `src/lib/lead-constants.ts` and Prisma enums. Activity values are shared from `src/lib/activity-options.ts`, which is also used by the Leads table controls. Responses include all four valid `ResponseType` enum values; no All Responses token is sent to the server.

## Activity relationship and date behavior

`LeadService.list()` in `src/services/lead.service.ts` constrains a lead through `activityEvents.some`, with the occurrence date on `ActivityEvent.occurredAt` and the selected type/action/response/interest values on an `entries.some` predicate. The export query in `src/services/export/query-builders.ts` follows that shape: selected activity properties belong to the same CALL/WHATSAPP `ActivityEntry` on the same event belonging to that lead. This avoids cross-matching Action on one entry with Response on another entry, and Prisma relation `some` does not duplicate Lead rows.

Activity preset boundaries are UTC calendar windows: Today is `[today 00:00, tomorrow 00:00)` and Yesterday is `[yesterday 00:00, today 00:00)`. Custom date-only bounds include both selected dates, implemented as start-inclusive and next-day-start-exclusive. Timestamp `activityTo` remains inclusive for compatibility with the Leads table's timestamp filter and is translated to an exclusive upper bound by advancing one millisecond. Invalid or reversed ranges are rejected.

Lead creation dates remain independent from Activity Date in the dedicated workspace. If both are selected, both constraints apply. Contextual table shortcuts preserve the table's established behavior: Activity Date presets suppress dateFrom/dateTo values that the table ignores; custom activity dates use those dates as occurrence boundaries; when dateFrom/dateTo are used without an Activity Date preset, the export follows the list service's combined creation-date and activity-date semantics when activity properties are filtered.

## Authorization and scope

- ADMIN may use the Lead filters, including assigned salesperson and `unassigned` selection.
- SALES/JUNIOR cannot access Lead export.
- SALES/SENIOR must have existing `EXPORT_LEADS` permission. Server-side scope remains `assignedUserId = authenticated session user ID` and `isDeleted = false`.
- The query service rejects client-supplied assignee narrowing for Sales; even without that rejection, all predicates are ANDed with the server-owned scope.
- No client-supplied ID can widen the Sales scope. Deleted leads remain excluded.
- The dedicated workspace defaults to active and archived leads together per export policy. Contextual Leads table shortcuts send the table's active-only default explicitly (`archived=false`) and send `archived=true` for archived-only view.

Authorization remains enforced by route and service policy. UI visibility is not the security boundary.

## Numeric Lead Number finding

The schema defines `Lead.leadNumber` as `String @unique @default(cuid())`; there is no separate integer or sequence field. The lead creation service does not generate a numeric number. Migration `prisma/migrations/20260714120000_phase1_crm_data_model/migration.sql` backfilled historical values as `'lead-' || id`, and `id` is itself a CUID. Other application code displays and searches this stored string as the lead number.

There is therefore no reliable numeric value to export. Extracting digits from a CUID or database ID would create a misleading and potentially unstable identifier, so the implementation retains the current `Lead Number` header and stored string value. A numeric number requires a product decision and a separately persisted sequence with a migration/backfill policy; this enhancement intentionally adds neither.

## Files and compatibility

- `src/lib/export/filters.ts` validates new filters with Prisma enum schemas and strict unknown-key rejection.
- `src/lib/export/legacy-contract.ts` explicitly allows only the new Lead parameters on the existing endpoint.
- `src/lib/export/legacy-compatibility.ts` parses comma-separated selections, date values, archive states, and Admin assignee selection.
- `src/services/export/query-builders.ts` adds typed Prisma predicates without changing cursor ordering or batching.
- `src/services/export/authorization.ts` rejects assignee filters for Sales; authenticated scope remains independently applied.
- `src/lib/export/ui.ts` builds workspace and contextual query strings from allowed values only.
- `src/components/export/export-workspace.tsx` renders multi-selects, Activity Date, archive selection, search, creation range, and Admin assignment.
- `src/lib/activity-options.ts` centralizes action, response, and interest option values shared by the table and export controls.

The endpoint remains `GET /api/export`. The five live categories, CSV column order, filenames, streaming batches, row/byte/time limits, cancellation handling, and CSV protections are unchanged. The Lead Number cell remains the existing stored string. No schema change was made.

## Verification and limitations

Focused export contract/query/delivery/UI tests cover the filter schemas, relation predicate shape, multi-select behavior, UTC presets, malformed values, authorization scope composition, contextual shortcut mapping, and the unchanged fixed CSV header. Automated tests use constructed Prisma where clauses and do not prove PostgreSQL relation semantics; a configured database-backed test environment is required for that.

No browser-level interaction or download test is claimed. The native streaming download behavior remains the existing implementation. Numeric Lead Number output is not implemented because the current schema/data cannot provide a reliable numeric value.
