# Lead Workflow Business Contracts (Phase 2)

> **Status:** Approved business contract. Phase 5 implements shared backend follow-up lifecycle behavior and adds a pending schema migration. The migration has not been applied; frontend redesign remains out of scope.
> **Date:** 2026-11-09.
> **Authority:** The decisions below are approved targets. Current code and schema remain authoritative for runtime behavior until subsequent phases ship.
> **Source audit:** [Phase 1 Lead Workflow Redesign Audit](./25_LEAD_WORKFLOW_REDESIGN_AUDIT.md).

## 1. Frozen decisions

### Phase 5 implementation status

The shared backend scheduler now locks the lead row, rejects multiple legacy pending rows, supersedes a single pending row, creates the replacement and lifecycle activity entries in the same transaction, and recalculates lead dates. Create Lead, Record Progress, note-based scheduling, standalone scheduling, and completion-with-next use this service. DELETE now performs soft cancellation with `cancelledAt`. PostgreSQL locking and the partial unique index have not been exercised against an isolated integration database in this environment. The migration `20261109100000_followup_one_pending_per_lead` includes a conflict preflight and remains unapplied. No external database was modified.

1. A lead may have at most one active follow-up. PENDING is active even with no due date.
2. Scheduling a new follow-up completes the previous pending task. This applies to Create Lead, Record Progress, standalone Workspace scheduling, completion with a next task, and every other path that creates pending work.
3. An interaction alone leaves the current task unchanged. Explicit completion without replacement remains supported. Rescheduling changes the same row.
4. Completion, history, replacement creation, and lead date recalculation are atomic. Failure rolls everything back.
5. Multiple pending rows for a lead are an integrity error. No arbitrary selection or migration cleanup.
6. DELETE /api/follow-ups/[id] becomes soft cancellation: set CANCELLED and cancelledAt; preserve the row and ActivityEntry links; record FOLLOW_UP_CANCELLED. Completed or cancelled rows cannot be cancelled again. No hard-delete path is introduced.
7. Assignment is lead.assignedUserId, falling back to the authenticated actor. Existing authorization stays in force. Actor and completion time are server-derived.
8. District is the canonical manual-workflow business/application field. Latest Requirement is a label for the existing requirement field. No requirement-history table.
9. Preserve database enum and API values. Centralize display labels. Add no enum values.

## 2. Follow-up state machine

| Current state | Command | Next state | Contract |
|---|---|---|---|
| none | schedule | PENDING | Create one task using the assignment rule. |
| one PENDING | schedule replacement | old COMPLETED; new PENDING | Atomic supersession and metadata. |
| one PENDING | explicit complete, no replacement | COMPLETED | Preserve row/history; no active task remains. |
| one PENDING | cancel | CANCELLED | Preserve row and linked activity entries; record timestamp/history. |
| one PENDING | reschedule | PENDING | Change the same task, do not create one. |
| COMPLETED or CANCELLED | cancel | reject | No duplicate event or status transition. |
| multiple PENDING | scheduling command | abort | Integrity error with no partial writes. |

Cancelled is inactive. Due-date presence does not determine activity. A no-date pending row remains active although Lead.nextFollowUpAt stays null.

## 3. Automatic completion

When a new task replaces the sole pending task:

- Capture one server-generated timestamp inside the transaction and use it as the old task's completedAt.
- Set the old row to COMPLETED; preserve the row and its activity links.
- Add FOLLOW_UP_COMPLETED linked to the old task with autoCompleted: true, completionReason: "SUPERSEDED_BY_NEW_FOLLOW_UP", and supersededByFollowUpId equal to the new task ID.
- Attribute the event to the authenticated actor who scheduled the replacement.
- Create the new PENDING task and recalculate lead follow-up dates in that transaction.
- In Record Progress, put lifecycle entries in its INTERACTION event. Standalone scheduling uses the corresponding FOLLOW_UP event. Do not fabricate an interaction or add enum values.
- Completion with nextFollowUp completes the requested row and creates its successor atomically; any other pending row in inconsistent data causes an integrity error.

Suggested metadata:

~~~json
{
  "autoCompleted": true,
  "completionReason": "SUPERSEDED_BY_NEW_FOLLOW_UP",
  "supersededByFollowUpId": "new-follow-up-id"
}
~~~

## 4. Cancellation contract

Keep the existing DELETE URL, but make it a conditional PENDING-to-CANCELLED transition. Timestamp on the server; keep completedAt null. Preserve the FollowUp row and ActivityEntry foreign keys. Repeated cancellation and cancellation of a completed task are rejected without another event. Keep current authorization. Ordinary cancellation never hard-deletes.

## 5. Assignment policy

Every scheduling path, including completion endpoint nextFollowUp, uses lead.assignedUserId ?? authenticatedActor.id. Client-supplied actor IDs and completion timestamps are rejected or ignored. Authorization remains server-enforced.

## 6. District migration and API compatibility

### Findings and assumptions

Current schema and application code use Lead.city; validation, projections, query/export builders, CSV, connector normalization, history, and APIs consume city. The Phase 1 inspected data does not prove every city value is an administrative district. The export surface is outside this phase and remains unchanged.

Only values confirmed as districts by a data owner may be backfilled. Preserve every old city value, including non-district and ambiguous values. Do not blanket-copy city to district, trim/normalize into a different meaning, or discard conflicts.

### Staged compatibility strategy

1. Add nullable Lead.district and retain Lead.city; do not rename/drop city in the first migration.
2. Inventory distinct non-empty city values and affected lead IDs/counts in the deployment target. A data owner classifies them as confirmed district, confirmed non-district, or ambiguous. Copy only confirmed values; ambiguous values remain unmapped in city and are reported.
3. Accept both API keys during a compatibility period. district is canonical. A city-only request continues to write only city and does not infer district. A district-only request writes district. Equal normalized dual values are accepted; conflicting dual values return 400. Never silently choose one.
4. Responses include district and legacy city during compatibility. district returns the canonical field; city returns preserved legacy data. Do not mirror district into city. Clients migrate to district when they need that concept.
5. Manual forms write district. District search/filter uses district. Existing city filter continues to query legacy city. Connector imports continue writing city unless an individual source mapping explicitly declares district.
6. New history labels district as District and city as City. Do not rewrite historical metadata. CSV headers/values remain unchanged.
7. After a separately declared deprecation window and consumer confirmation, a later approved change may stop accepting city. Physical column removal needs its own retention review. Confirmed district is authoritative; do not maintain two independently editable district values.

Release gates before backfill/cutover: data owner, target inventory/classification results, and legacy API deprecation window/exit criteria.

## 7. Latest Requirement

Keep Lead.requirement, database storage, and API key unchanged. Use Latest Requirement as the manual user-facing label. It remains one current value; no history table or export/API change.

## 8. Display-label catalog

Labels are display text only. Keep database/API/filter/export values. LOST remains Lost because it can include unreachable and other loss reasons; do not use Not interested for it. Every enum value has exactly one central catalog entry. Repeated words across different enum types are acceptable. No component-local maps may redefine these labels.

| Enum | Value | Display label |
|---|---|---|
| Lead Status | NEW | New |
| Lead Status | CONVERTED | Customer |
| Lead Status | LOST | Lost |
| Lead Status | SPAM | Junk |
| Lead Status | ON_HOLD | Paused |
| Lead Priority | LOW | Low |
| Lead Priority | MEDIUM | Normal |
| Lead Priority | HIGH | High |
| Lead Priority | URGENT | Do now |
| Lead Category | MEDICAL_REPRESENTATIVE | Medical Representative |
| Lead Category | RETAILER | Retailer |
| Lead Category | WHOLESALER | Wholesaler |
| Lead Category | DISTRIBUTOR | Distributor |
| Lead Category | MARKETING | Marketing |
| Lead Category | THIRD_PARTY | Third Party |
| Lead Category | DOCTOR | Doctor |
| Lead Category | FRANCHISE | Franchise |
| Lead Category | BUSINESS | Business |
| Lead Category | HOSPITAL | Hospital |
| Lead Category | CLINIC | Clinic |
| Lead Category | PHARMACY | Pharmacy |
| Lead Category | LABORATORY | Laboratory |
| Lead Category | MANUFACTURER | Manufacturer |
| Lead Category | CORPORATE | Corporate |
| Lead Category | GOVERNMENT | Government |
| Lead Category | OTHER | Other |
| Follow-up Status | PENDING | To do |
| Follow-up Status | COMPLETED | Done |
| Follow-up Status | CANCELLED | Cancelled |
| Follow-up Priority | LOW | Low |
| Follow-up Priority | MEDIUM | Normal |
| Follow-up Priority | HIGH | High |
| Follow-up Priority | URGENT | Do now |
| Customer Interaction Action | CALL | Call |
| Customer Interaction Action | WHATSAPP | WhatsApp |
| Customer Interaction Response | PICKED_UP | They answered |
| Customer Interaction Response | REPLIED | They wrote back |
| Customer Interaction Response | NO_RESPONSE | No answer |
| Customer Interaction Response | INVALID_NUMBER | Wrong number |
| Interest | INTERESTED | Interested |
| Interest | NOT_INTERESTED | Not interested |

Keep current category labels: the category taxonomy mixes roles and organization types and needs a separate decision. Do not add categories, interests, actions, or responses without an explicit business requirement.

## 9. Interaction and classification contract

- Manual Create Lead requires exactly one genuine initial customer interaction. Record Progress requires exactly one genuine interaction. Connector/import creation remains exempt and must not fabricate one.
- Action/response compatibility: CALL permits PICKED_UP, NO_RESPONSE, INVALID_NUMBER. WHATSAPP permits REPLIED, NO_RESPONSE, INVALID_NUMBER.
- Interest is required for successful responses PICKED_UP and REPLIED, and not accepted for unsuccessful responses.
- Classification updates are optional and no-op-safe. Equal values cause neither an update nor update history. Omitted values remain unchanged. Explicit category null clears only when the stored value differs.
- Interaction notes remain on the interaction entry; do not copy them into FollowUp.description or create a Note.
- Scheduling replacement auto-completes the previous task. Explicit completion without replacement remains supported. Interaction alone leaves tasks unchanged.
- Lifecycle transitions, activity history, creation, and denormalized date recalculation are atomic. Authorization remains server-side.

## 10. Exact proposed Prisma and SQL migration

No schema or migration is changed in Phase 2. Proposed Prisma additions:

~~~prisma
model Lead {
  city     String? // retained for compatibility
  district String?
}

model FollowUp {
  completedAt DateTime?
  cancelledAt DateTime?
}
~~~

Proposed migration SQL:

~~~sql
ALTER TABLE "Lead" ADD COLUMN "district" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "cancelledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "FollowUp_one_pending_per_lead"
ON "FollowUp" ("leadId")
WHERE "status" = 'PENDING';
~~~

The current table names are quoted Lead and FollowUp; status is a PostgreSQL enum. No city-to-district backfill SQL is safe before a reviewed classification map exists. cancelledAt is nullable. Prisma cannot represent the partial predicate; do not add a misleading @@unique.

### Migration order and preflight

1. Release service code that serializes scheduling per lead, detects duplicate pending rows as integrity errors, records metadata, applies assignment policy, covers every task-creation path, and maps unique conflicts to 409.
2. Immediately before migration, run this read-only query against the actual target database:

~~~sql
SELECT "leadId", count(*) AS pending_count,
       array_agg("id" ORDER BY "createdAt", "id") AS follow_up_ids
FROM "FollowUp"
WHERE "status" = 'PENDING'
GROUP BY "leadId"
HAVING count(*) > 1;
~~~

Any result blocks migration. Preserve the report and require separately reviewed, explicitly authorized remediation. Never auto-complete/delete conflicts.
3. Inventory and classify city values. Incomplete classification blocks backfill/canonical cutover.
4. Apply one migration adding district, cancelledAt, and partial unique index. Verify pg_indexes definition, zero conflicts, and row counts.
5. Backfill only reviewed mappings in a separately reviewable step, preserving city.

### Concurrency and drift

Within every scheduling transaction, lock the Lead row first with SELECT ... FOR UPDATE, then read all pending tasks. Abort if count > 1; complete the sole task and insert its successor using the transaction's one timestamp. The partial unique index is the final race/bypass guard. Translate its unique violation to 409 and roll back. Use consistent lead-first lock order; conditional state transitions still protect completion/cancellation. ReadCommitted is sufficient with the lock and index.

Prisma cannot represent the partial WHERE predicate. Keep the raw CREATE UNIQUE INDEX in checked-in migration.sql and add a deployment check comparing pg_indexes.indexdef with the required predicate. Do not regenerate/baseline migrations in a way that drops it. Prisma validation checks representable fields but not this index. Review future migration/introspection changes. Never use db push.

Rollback risks: dropping the index removes the database guard; stop or constrain writers first. Dropping district loses canonical data and requires verified reverse mapping/backup. Drop cancelledAt only if cancellation timestamp retention is not required. Prefer forward fixes; rollback must retain rows and data.

## 11. Contract test matrix

| Area | Required assertions |
|---|---|
| First schedule | One pending row; owner/actor assignment; event and recalc atomic. |
| Replacement | Old row preserved/completed; exact timestamp; metadata and actor correct; new task pending; one active. |
| No replacement | Explicit completion leaves none; interaction-only leaves existing task pending. |
| Cancellation | Row and links preserved; timestamp/event set; repeated/completed cancellation rejected. |
| Null due date | Counts as active and is superseded; nextFollowUpAt remains null absent dated pending work. |
| Legacy conflicts | Multiple pending rows cause integrity error and no writes. |
| Entry points | Create Lead, Record Progress, Workspace, complete-with-next, and all pending creation paths share contract. |
| Validation | Compatibility matrix, conditional interest, initial interaction, manual date, District/city compatibility. |
| Labels | Catalog equals Prisma enum values exactly once; no local duplicates; raw values unchanged. |
| District | New write, legacy city-only, dual-key conflict, response keys, mapping, search/filter. |
| Atomicity | Failures at transition/event/insert/recalc leave no partial writes. |
| Concurrency | Concurrent schedules leave at most one pending row; unique violation maps to 409. |

Use unit/source-level tests by default. PostgreSQL integration tests require an isolated test database; never use production or development DB for destructive tests. Phase 2 adds catalog and validation tests; lifecycle assertions are release gates for implementation phases because runtime behavior is intentionally unchanged here.

## 12. Later implementation sequence

1. Classify District values and settle compatibility owners; implement additive field/API compatibility and tests without export changes.
2. Implement shared scheduling transaction logic, locks, integrity checks, auto-completion, metadata, assignment, recalculation, and error mapping.
3. Route every scheduling path through it; add isolated PostgreSQL lifecycle/concurrency coverage.
4. Implement soft cancellation and cancelledAt while preserving authorization and links.
5. Route display consumers through centralized labels and remove local duplicates.
6. Implement Record Progress/Create Lead UI redesign in a separately authorized phase; update canonical docs on implementation.
7. Apply reviewed migration only after target preflight shows zero conflicts; verify index persistence and District mapping.

## 13. Remaining release gates

- Data owner, fresh target city inventory/classification, and legacy city API deprecation window.
- Exact visual layout remains unapproved pending design references; not a business-contract blocker.
- Whether non-manual newly scheduled tasks may omit due dates is undecided; null-date PENDING still counts as active. Manual scheduling requires a date.
- Authorization changes require a separate decision.

## 14. Canonical documentation

Canonical docs continue to describe implemented behavior until each later change ships. This document is the approved target contract, not the runtime contract. Update database/API/backend/frontend guides with each implementation; no export behavior changes in this phase.

### Phase 6B migration status (2026-11-09)

The configured Neon database (`neondb`, `public`) reported both District and Follow-up Lifecycle migrations pending. Read-only preflight found no duplicate pending tasks, no District or cancelledAt columns, no partial unique index, 115 leads (94 with non-null city), eight follow-ups, and 14 activity-entry links. The configured connection identifies a Neon endpoint, but the branch name and a recovery point could not be verified because no Neon control-plane credentials or CLI are available. Neon provides point-in-time recovery branches, but no branch was created. Migration deployment was stopped before any database changes; existing city and follow-up rows remain unchanged. See the Phase 6B preflight in [the District assessment](./27_DISTRICT_COMPATIBILITY_ASSESSMENT.md).
