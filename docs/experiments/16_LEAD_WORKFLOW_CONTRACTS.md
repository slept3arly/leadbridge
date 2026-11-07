# Lead Workflow Contracts

> **Status:** Experimental specification; current implementation inspected 2026-11-07.
> **Scope:** Functional contracts for Add Lead and Record Progress. This document specifies intended behavior; it does not implement it.
> **Source precedence:** Current implementation and Prisma schema were inspected alongside canonical documentation and experiment 15. Where this contract changes current behavior, the difference is identified below.

## Add Lead contract

Add Lead creates one prospect and records one genuine initial customer interaction in the same atomic operation. The interaction is mandatory; the optional part of the form is scheduling a follow-up, not whether an interaction record exists.

### Lead fields

| Field | Required | Contract / validation |
|---|---|---|
| Name | Yes | Trimmed; 2–120 characters. Persisted as `Lead.displayName` (API/UI currently call it `name`). |
| Email | Conditionally | Optional individually; when supplied it must be a valid email. At least one of email or phone is required. Blank normalizes to null. |
| Phone | Conditionally | Optional individually; when supplied it must be exactly 10 digits under current validation. At least one of email or phone is required. Blank normalizes to null. |
| Company | No | Trimmed, up to 120 characters. |
| City | No | Trimmed, up to 80 characters. |
| State | No | Trimmed, up to 80 characters. |
| Product | No | Trimmed, up to 120 characters. |
| Requirement | No | Trimmed, up to 2,000 characters. |
| Status | No | `NEW`, `CONVERTED`, `LOST`, `SPAM`, or `ON_HOLD`; defaults to `NEW`. |
| Priority | No | `LOW`, `MEDIUM`, `HIGH`, or `URGENT`; defaults to `MEDIUM`. |
| Category | No | Null or one of the current `LeadCategory` values. |
| Source | No | Existing `LeadSource` selected by `sourceId`, or null. |
| Assigned salesperson | No | Admin-only selection. SALES-created leads are assigned to the creating salesperson; SALES may not assign another user. |

The list above is the intended interactive Add Lead form, matching the currently rendered lead modal. Import metadata and other fields accepted by the broad `leadSchema` (for example campaign, connector, raw payload, budget, and custom fields) are not interactive Add Lead fields; connector ingestion remains a separate entry path. Lead number, creator, timestamps, follow-up denormalizations, and deletion/archive flags are server-managed.

### Mandatory initial interaction

The form always collects one initial interaction. It uses the Record Progress interaction fields and rules below: action, action-specific response, conditional interest, and optional activity notes. The action and response must describe what actually occurred. `NO_RESPONSE` and `INVALID_NUMBER` are valid outcomes and do not require the salesperson to claim a customer conversation. Activity notes are optional and belong to the activity entry.

The initial activity is created with the lead in one transaction. If lead insertion, initial activity creation, or requested follow-up creation fails, none of those records is committed. The service also records the existing `SYSTEM/CREATED` event. A created lead therefore has at least that system event and exactly one initial `INTERACTION` event with one CALL or WHATSAPP entry, plus a follow-up-scheduled entry only if requested.

### Optional initial follow-up

`Schedule follow-up` defaults off. When enabled, due date is required and must be a valid date; time is optional. Whether past dates are allowed and how a date without time maps to an instant must follow the agreed date/time-zone policy (see unresolved decisions). The new task is pending and assigned to the lead's responsible salesperson. Scheduling is in the same transaction as lead and initial interaction creation.

The follow-up title may be generated from the action (as today, e.g. “Call follow-up”); users do not enter a separate title, priority, or task description in this workflow. The interaction's notes remain on the activity; they must not be copied into a standalone `Note`. Whether the current convenience copy into `FollowUp.description` is retained is an unresolved presentation/data policy (see below).

## Record Progress contract

Record Progress records one real customer interaction against an existing, accessible lead. Every successful submission creates a distinct interaction record, even when it has the same action, response, and notes as an earlier genuine interaction. Content similarity is not a deduplication key.

### Interaction fields

| Field | Required | Contract / validation |
|---|---|---|
| Action | Yes | `CALL` or `WHATSAPP`. Must reflect the channel actually used. |
| Response | Yes | CALL: `PICKED_UP`, `NO_RESPONSE`, `INVALID_NUMBER`. WHATSAPP: `REPLIED`, `NO_RESPONSE`, `INVALID_NUMBER`. Must be a valid response for the action. |
| Interest | Conditional | Required for `PICKED_UP` or `REPLIED`; must be null for `NO_RESPONSE` or `INVALID_NUMBER`. Values: `INTERESTED`, `NOT_INTERESTED`. |
| Activity notes | No | Trimmed free text, up to 10,000 characters. Blank normalizes to null. Stored on the activity entry, not as a `Note`. |

The response is the result of the attempted contact. A no-response attempt is still a real interaction (an outgoing call/WhatsApp attempt), and is explicitly representable. Do not create an activity with blank action/response or one whose only content is an empty note. Server validation, not just disabled UI controls, enforces the contract.

### Optional lead-field changes

A compact, collapsed-by-default section can optionally include `status`, `priority`, and `category`. Each omitted field is unchanged. A submitted value equal to the normalized persisted value is also unchanged. These edits are committed with the interaction and any follow-up transition in one transaction. No other lead fields are editable through Record Progress.

### Optional follow-up actions

The user may leave pending follow-ups untouched, complete one selected pending follow-up, and optionally schedule a next follow-up in the same submission. Completing a follow-up is an explicit choice; recording an interaction alone never completes one.

When an existing pending follow-up is selected for completion, the transaction records the interaction, transitions that exact task from `PENDING` to `COMPLETED`, and optionally creates a replacement pending task. The new task date is required if scheduling is selected; time is optional. The interaction and lifecycle entries are grouped in one activity event and linked to the relevant follow-up where the existing model permits. If the user does not select a pending task for completion, no task is completed, even if another task is due or overdue.

The behavior named `complete_reschedule` means: record the actual unsuccessful interaction (for example `NO_RESPONSE`), complete the selected pending follow-up, and optionally schedule another. It does not mean that the activity itself is unsuccessful in persistence, nor does it automatically reschedule or complete any task. The next task remains optional.

## Activity types and outcomes

- User-recorded interaction actions are limited to `CALL` and `WHATSAPP` (`ActionType` and `ActivityEntryType`). Do not add non-contact activity types to these workflows.
- For CALL, allowed outcomes are `PICKED_UP`, `NO_RESPONSE`, `INVALID_NUMBER`.
- For WHATSAPP, allowed outcomes are `REPLIED`, `NO_RESPONSE`, `INVALID_NUMBER`.
- `INTERESTED` or `NOT_INTERESTED` is captured only when the customer picked up/replied. It is not inferred from notes or status.
- `NO_RESPONSE` and `INVALID_NUMBER` are valid genuine attempt outcomes, with no interest value.
- Activity notes are part of the activity entry (`message` and/or existing metadata conventions); the workflows do not create a `Note` model record.
- Every actual repeated contact remains a separate `ActivityEvent`/`ActivityEntry`. Do not deduplicate genuine repeated interactions. Reject empty or malformed submissions before persistence.
- System status/history entries and follow-up lifecycle entries may coexist in the timeline but are not choices in the interaction action selector.

## Follow-up rules

1. **No implicit completion.** Activity creation does not change any pending follow-up unless the submission explicitly names that pending follow-up for completion.
2. **Only pending tasks complete.** Completion uses a conditional transition (`PENDING` → `COMPLETED`). If another request already changed the status, return a conflict and do not record a partial interaction, status edit, or next task.
3. **At most the selected task transitions.** Other pending tasks remain pending. The contract does not silently complete every overdue task or pick a task based only on the lead's `nextFollowUpAt`.
4. **Optional replacement.** A new task may be scheduled with or without completing an existing task. When scheduling is enabled, a valid due date is mandatory; time is optional. When disabled, stray date/time values are ignored or rejected consistently (prefer reject to avoid ambiguous payloads).
5. **Unsuccessful contact is valid completion evidence.** `NO_RESPONSE` or `INVALID_NUMBER` can accompany explicit completion under `complete_reschedule`; the outcome is saved as an interaction and the selected task is completed. Do not require a successful customer response to complete the task.
6. **Follow-up owner.** A replacement task is assigned to the responsible salesperson for the lead (the current completion path assigns to the actor). This must remain valid if an Admin records progress for a lead assigned to Sales; choose and enforce one policy consistently. The preferred workflow policy is the lead's assignee, falling back to the actor only for an unassigned lead.
7. **Denormalized dates.** Recompute `Lead.nextFollowUpAt` from the earliest remaining pending task and `Lead.lastFollowUpAt` from the latest completed task in the same transaction. Clear the next date when no pending task remains. Do not set these fields directly from the submitted date.
8. **Idempotency/concurrency.** Conditional status transition prevents duplicate completion. Lead edits compare normalized submitted values against values read in the transaction and update only changed columns. Protect writes against stale concurrent submissions using an existing concurrency token such as `updatedAt` (or an equivalent conditional update); a stale conflicting request returns 409 and must not overwrite newer values. A concurrent, independently genuine interaction is not a duplicate and may be recorded separately.
9. **Timeline grouping.** A combined submission creates one event grouping the interaction, selected follow-up completion, optional new follow-up scheduling, and actual changed lead-field history. Do not emit empty lifecycle or field-change entries.

## Lead field update rules

| Workflow | Fields allowed to change |
|---|---|
| Add Lead | Name, email, phone, company, city, state, product, requirement, status, priority, category, source; assignment by Admin only. |
| Record Progress | Status, priority, category only, each optional. |

For both workflows, submitted values are normalized before comparison (trim strings, blank optional strings to null, enum/null normalization, and canonical date/time representation). Persist only genuinely changed fields. If no lead field changes, do not issue a Lead update, do not change `updatedAt`/`updatedById`, and do not write `UPDATED`/`STATUS_CHANGED` history for that lead. If fields do change, update only those columns plus actor metadata, and record history only for the values that changed (status history includes old/new values). An unchanged lead patch must not become a write just to refresh timestamps.

This no-op rule is specific to lead-field updates. Recording a genuine interaction is still a new event even if its payload matches a previous event. Completing a pending task is a state change even if there are no lead-field changes.

## Role permissions

| Operation | ADMIN | SALES |
|---|---|---|
| Add Lead | Allowed; may choose assignee or leave unassigned. | Allowed only when `can(CREATE_LEAD)` succeeds (currently SENIOR; JUNIOR has no CREATE_LEAD privilege). Created lead is assigned to self; cannot assign another user. |
| Record Progress | Allowed on any non-deleted lead. | Allowed only on leads assigned to the current user. |
| Change status/priority/category within Record Progress | Allowed on any accessible lead. | Allowed only on own assigned lead. |
| Complete/reschedule follow-up through Record Progress | Allowed on any accessible lead/task for that lead. | Allowed only on own assigned lead; selected task must be pending and accessible. |

These permissions follow the existing model: `ADMIN` is globally allowed by `can`; Sales privileges currently grant `CREATE_LEAD` to SENIOR; service access scopes Sales to `assignedUserId`. SALES roles are not all equivalent for Add Lead. Permission checks must be enforced at the API and service boundary, not inferred from whether a control is shown.

### Current authorization mismatches

- `POST /api/leads` uses `CREATE_LEAD`, so Admin and SENIOR Sales can create; the shared Admin/Sales UI entry availability must continue to reflect this. Sales-created leads are self-assigned in `LeadService.create`.
- `POST /api/leads/[id]/activities` is explicitly SALES-only and then requires the lead to be assigned to the actor. The shared `LeadDetailsModal` is also rendered from Admin leads, where its Log Activity control is visible, but the API rejects Admin. This is an API/UI mismatch for Admin.
- `POST /api/follow-ups/[id]/complete` and follow-up create/reschedule endpoints allow any authenticated role and rely on service-level lead access; this supports Admin plus assigned Sales. In the current UI, the Tasks table can complete with `{}` and therefore complete without recording an interaction. Record Progress should be the consistent completion operation and every entry point should provide its contract.
- The Admin lead detail UI also exposes activity editing, but the activity update route's ownership predicate is Sales-assignee oriented. Align or hide that control as part of the eventual role implementation.

## Validation and error behavior

- Validate and normalize on the server using shared schemas. Client validation is for prompt feedback only.
- Invalid JSON or field validation errors return 400 with field-level details. Missing name/contact, invalid phone/email, incompatible action/response, missing conditional interest, malformed date/time, or missing follow-up date when scheduling are validation errors.
- Unknown, deleted, inaccessible, or unassigned-to-actor leads should follow existing API access conventions (currently generally 404 to avoid revealing inaccessible records).
- Missing follow-up returns 404. A follow-up that is no longer `PENDING`, or a stale concurrent lead write, returns 409 with a retry/reload message and creates no partial records.
- Permission failure returns 403 where the existing wrapper/service exposes authorization failure.
- Uniqueness conflict on imported source identity remains the existing duplicate-lead 409 behavior. Do not treat repeated manual activity payloads as duplicate conflicts.
- Empty interaction (no channel/outcome) and whitespace-only notes are not persisted as activity entries. Notes may be null; the interaction itself remains valid because action and response capture the genuine attempt.
- All mutations use one Prisma transaction for the records in the workflow and existing cache invalidation after commit. Denormalized follow-up fields are recalculated inside that transaction.

## Existing API/model mapping

| Contract concept | Existing implementation |
|---|---|
| Add Lead form | `LeadEditModal` create mode; `leadSchema` and `createLeadRequestSchema` in `src/lib/validation.ts`. The initial activity UI is currently collapsed/optional and needs to become mandatory. |
| Create endpoint | `POST /api/leads`; `LeadService.create` creates Lead + SYSTEM/CREATED and optionally initial INTERACTION + FollowUp. Initial activity is currently optional in both schema and service input. |
| Lead fields | `Lead.displayName`, contact/classification/source/assignment fields in `prisma/schema.prisma`; status defaults to NEW, priority MEDIUM, category nullable. |
| Interaction/outcome | `ActivityEvent` + `ActivityEntry`; `ActionType`, `ResponseType`, `InterestType`, `ActivityEventType`. `interactionActivitySchema` and `src/lib/activity-options.ts` encode current choices. |
| Record Progress UI | `LogActivityModal` and `ActivityFormFields`; currently action/response/conditional interest/notes and optional follow-up scheduling. It has no lead-field update fields and cannot name a pending task to complete. |
| Record Progress endpoint | `POST /api/leads/[id]/activities`; currently transactionally creates interaction and optional follow-up but does not call an orchestration service and is SALES-only. |
| Completion endpoint | `POST /api/follow-ups/[id]/complete`; currently transactionally completes a pending task, optionally records an activity and note, and optionally creates another task. Activity is optional and cannot use the exact response action refinement shared by `interactionActivitySchema`; currently the route schema does not enforce compatible action/response or conditional-interest semantics. |
| Follow-up API/service | `POST /api/leads/[id]/follow-ups`, `PATCH /api/follow-ups/[id]`, `followUpService.create/reschedule/complete`; create/reschedule routes support existing standalone entry points. `complete` uses conditional `updateMany` for pending-only transition and recalculates denormalized fields. |
| Lead updates/history | `PATCH /api/leads/[id]` → `LeadService.update`; currently writes a Lead update and an event for every patch, including unchanged fields. Field-level diff/no-op and stale-write protection are required changes. |
| Permissions | `src/lib/permissions.ts` (`CREATE_LEAD`, Admin global grant, Sales privilege mapping); API wrappers plus `LeadService`/`FollowUpService` access checks. |

No new database model or enum is required for the core contracts: current models already represent CALL/WHATSAPP interactions, their outcomes, follow-up completion, and status/priority/category. `ActivityEntry.followUpId` can associate lifecycle entries with tasks. The required work is API/service/UI contract alignment. A schema change should be considered only if a later decision requires durable association of every interaction to its scheduled follow-up beyond the existing event grouping/entry link, or introduces another permitted channel/outcome; neither is assumed here.

## Compatibility and migration considerations

- Existing callers of `POST /api/leads` that omit `initialActivity` will fail once it becomes mandatory. Inventory and migrate all UI/integration callers before tightening validation. Connector imports use `LeadService.create` and should remain a distinct trusted import path; they must not fabricate a manual initial customer interaction. Confirm whether the mandatory-initial-activity rule applies only to human Add Lead or also connector-created leads. The human UI must not silently treat the system `CREATED` event as the required interaction.
- Existing callers of `POST /api/leads/[id]/activities` may continue using the current shape. Add optional lead-field changes and explicit pending-follow-up completion in a backward-compatible way where possible. Legacy payloads must retain current behavior: log interaction and optionally schedule a follow-up, without completing a task unless explicitly requested.
- Existing completion clients can still complete with `{}` under the current API. If completion becomes part of the Record Progress contract, preserve a documented legacy completion mode or update every caller (including Tasks table) before making activity mandatory for completion. Do not silently reinterpret `{}` as a fabricated contact.
- Preserve `ActivityEvent` and `ActivityEntry` history as written. Historical events with missing response/interest or legacy activity representation should remain readable; do not backfill synthetic contact outcomes.
- Preserve standalone `Note` records and endpoints for compatibility even though Add Lead/Record Progress notes are activity notes. Do not merge or duplicate historical Notes into activities.
- Preserve `FollowUp.title`, `description`, priority, assignment, and nullable date fields for existing records. New workflow defaults must not rewrite historical tasks. Decide whether notes are copied into follow-up descriptions before changing that behavior.
- Do not deduplicate historical or new interactions by matching payload fields. Multiple identical events can represent separate real contacts.
- No schema migration is currently identified. If implementation eventually alters enums/relations or adds a version token, use a Prisma migration and plan compatibility for existing database rows and clients.

## Unresolved decisions at the end of Phase 1

The following questions record the state before Phases 2–5. The final implementation status below supersedes this section where decisions were confirmed.

1. **Meaning of mandatory initial activity:** Does Add Lead require that a CALL or WHATSAPP attempt already occurred, or should it accept another genuine contact channel? The constraints prohibit non-contact activity types but current `ActionType` supports only CALL/WHATSAPP. Until clarified, this contract assumes one of those two actions genuinely happened; it does not invent an `OTHER` type. If a lead is merely entered before contact, the workflow requirements conflict and need a product decision.
2. **Response capture when there is no customer response:** Is the existing `NO_RESPONSE` outcome sufficient for an outgoing attempt with no reply? This document assumes yes. It still requires an action and an actual attempt; it never requires a successful reply.
3. **Follow-up date and time semantics:** Is date-only due time midnight/local start of day, a business default hour, or date-only stored without a time? Define the business timezone and reject/past-date policy. Current clients convert local date/time to ISO and use `00:00` when time is omitted; this is not a reliable product-level rule across timezones.
4. **When a replacement task is scheduled without completing a pending one:** This is allowed per the stated optionality, but can leave multiple pending tasks. Confirm whether that is intended. The contract does not auto-complete the previous task.
5. **Follow-up ownership for Admin action:** Should a task created by Admin for an assigned lead be assigned to the lead's Sales owner (preferred here) or Admin actor (current completion service behavior)? This needs one rule shared by create, activity scheduling, and completion.
6. **Activity note duplication into task description:** Current activity scheduling copies activity notes to `FollowUp.description`; the semantic requirement says notes belong to the activity. Confirm whether this convenience copy should stop for new records. No separate `Note` record is created by this workflow.
7. **Initial follow-up date policy:** Confirm whether past due dates are permitted at creation, and whether the initial task should be assigned to the selected salesperson or remain unassigned for Admin-created unassigned leads.
8. **Sales creation privilege:** The existing model grants `CREATE_LEAD` only to SENIOR Sales. This contract preserves that rule; confirm whether both SALES privilege levels should create leads.

## Final implementation status — Phase 5

The five-phase redesign is implemented against the contracts above. Current source code is authoritative if any earlier audit or mapping text in this experimental document differs.

### Canonical UI entry points

- **Add Lead:** `LeadEditModal` create mode on the Sales My Leads and Admin Leads pages. Manual creation requires one validated CALL or WHATSAPP initial interaction and may schedule a follow-up. Connector/import creation remains on the separate `LeadService.create()` path and records no fabricated customer interaction.
- **Record Progress:** `RecordProgressModal` is the only UI component that POSTs a new interaction. It is opened by Lead Workspace, the Tasks completion action (with the selected follow-up proposed and explicit confirmation required), and My Leads quick action. Sales dashboard follow-up rows open Lead Workspace for that lead. Admin dashboard contains no interaction or task-completion action, so none was added.
- **Lead Workspace:** The shared `LeadDetailsModal` is used by Sales and Admin lead-detail entry points. Its primary action is Record Progress and its task-specific action passes the exact follow-up ID.

### Remaining standalone and compatibility operations

- Schedule-only follow-up creation remains available from Lead Workspace. Its prompt routes interaction-plus-scheduling to Record Progress. Follow-up rescheduling and task cancellation/deletion remain separate task-management actions.
- Activity editing remains available to Sales for interactions on assigned leads. Admin edit controls are hidden; the existing activity PATCH authorization is assigned-Sales-only.
- Note models, historical Notes, and Note API routes remain. Workflow interaction notes do not create Notes. No active standalone Note editor/create UI caller was found in the audited components; the API remains for compatibility.
- The legacy `POST /api/follow-ups/[id]/complete` route remains and continues to accept `{}` without fabricating an interaction. The unused `useLeadDetails.completeFollowUp` UI helper was removed. No task-completion button in the current UI calls this compatibility route.
- The legacy Activity API remains for the canonical Record Progress operation and backward-compatible clients; it is no longer backed by `LogActivityModal`.

### Removed obsolete UI

- Removed `src/components/sales/log-activity-modal.tsx` after a repository-wide caller/import search found no active use. Its duplicated form and submission logic were replaced by `RecordProgressModal` during Phase 3.
- Removed `src/components/sales/lead-metadata-card.tsx` after confirming it had no active import; current record metadata is presented in the Lead Workspace.
- Removed the unused `completeFollowUp` method from `useLeadDetails`. Kept `ActivityFormFields`, which is still shared by Add Lead and Record Progress.
- No APIs, database models, historical rows, connector/import paths, Notes, or schema definitions were deleted or changed in Phase 5.

### Verification and known limits

Manual lead creation and Record Progress enforce role/access rules in both API and service paths. Workflow transactions, conditional follow-up completion, change-aware lead updates, denormalized follow-up recalculation, and post-commit cache invalidation remain as implemented in Phase 2. Axios cross-tab mutation notifications remain active for successful mutations. Automated tests cover workflow validation, entry-point source wiring, cache tags, CRM sync behavior, and database-backed workflows when a test database is provided.

No Prisma migration was needed. PostgreSQL integration coverage requires `LEADBRIDGE_TEST_DATABASE_URL`; browser-level UI tests are not configured in this repository. Lead Workspace history is limited to the latest 100 activity events and 100 Notes, while follow-ups are returned without pagination so every pending task can be shown. Business timezone configuration remains absent; the implemented date convention is UTC midnight for date-only input and explicit-offset ISO instants for date-time input.

