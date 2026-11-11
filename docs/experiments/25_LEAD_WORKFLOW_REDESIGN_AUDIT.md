# Lead Workflow Redesign Audit (Phase 1)

> **Phase 5 resolution note (2026-11-09):** The backend follow-up lifecycle findings below describe the pre-Phase 5 implementation. The approved behavior is now implemented through `FollowUpService.scheduleInTransaction()`: scheduling locks the lead row, rejects multiple pending rows, completes the previous task, creates the replacement and lifecycle entries atomically, and recalculates lead dates. Create Lead, Record Progress, notes, standalone scheduling, and completion-with-next use this shared path. DELETE now soft-cancels and retains the row. A migration adds `cancelledAt`, a conflict preflight, and the partial unique index; it is **pending and unapplied**. No configured external database migration was applied. PostgreSQL locking/index integration tests could not run because `LEADBRIDGE_TEST_DATABASE_URL` is not configured.

> **Status:** Experimental audit and proposed contract. Phase 1 only.
> **Date:** 2026-11-09.
> **Scope:** Record Progress, Create Lead, lead/follow-up terminology, enum inventory, and the one-active-follow-up rule.
> **Implementation status:** No application code, UI, Prisma schema, or migration was changed. This document describes current behavior and proposes a target contract for later phases.
> **Source precedence:** Current source code and `prisma/schema.prisma` are authoritative. Where this document describes intended behavior, it is explicitly a proposal.

## 0. Evidence and limitations

### 0.1 Evidence used

- Current source: `src/components/leads/record-progress-modal.tsx`, `src/components/leads/lead-edit-modal.tsx`, `src/components/sales/lead-details-modal.tsx`, `src/components/sales/activity-fields.tsx`.
- Workflow services: `src/services/lead-workflow.service.ts`, `src/services/lead.service.ts`, `src/services/follow-up.service.ts`, `src/services/activity-event.service.ts`.
- Validation and labels: `src/lib/validation.ts`, `src/lib/activity-options.ts`, `src/lib/lead-constants.ts`, `src/lib/record-progress-follow-ups.ts`, `src/lib/follow-up-policy.ts`.
- API routes: `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/activities/route.ts`, `src/app/api/leads/[id]/follow-ups/route.ts`, `src/app/api/follow-ups/[id]/route.ts`, `src/app/api/follow-ups/[id]/complete/route.ts`, `src/app/api/leads/[id]/details/route.ts`.
- Schema: `prisma/schema.prisma`.
- Canonical docs: `docs/README.md`, `docs/architecture.md`, `docs/backend.md`, `docs/database.md`, `docs/frontend.md`, `docs/api.md`, `docs/UI_DESIGN_SYSTEM.md`.
- Prior workflow work: `docs/experiments/15_LEAD_WORKFLOW_AND_MODAL_ARCHITECTURE_AUDIT.md`, `docs/experiments/16_LEAD_WORKFLOW_CONTRACTS.md`, `docs/experiments/17_LEAD_UI_REFINEMENT_PLAN.md`.
- Read-only live database queries against the configured `DATABASE_URL` (database `neondb`) on 2026-11-09.

### 0.2 Screenshot limitation

No screenshot files (PNG, JPG, JPEG, WebP, GIF) exist in the repository outside `node_modules`, `.git`, and `.next`, and no image was supplied in the working session. The design references could not be inspected. The proposed layouts below are therefore derived from the written requirements and existing UI conventions, not from visual references. This must be resolved before UI implementation if exact spacing, ordering, or visual hierarchy matters.

### 0.3 Worktree state at audit start

- Branch: `main`.
- `git status --porcelain`: empty.
- Latest commits: `05a1916`, `824b31e`, `f6d17e8`, `2408339`.
- No staged, modified, or untracked user work was present. This audit did not reset, stash, revert, or overwrite anything.

## 1. Executive summary

1. **Record Progress is structurally different from the requested design.** It is a centered `max-w-2xl` dialog with three initially collapsed `AccordionSection`s. The requested design is a full-viewport modal with two visible columns and no collapsed sections. See §3.1 and §5.
2. **Create Lead is also accordion-based and does not match the requested field grouping.** It is a `max-w-4xl` dialog with three collapsed sections. There is no `District` field or label; the persisted/API field is `city`. There is no `Latest Requirement` label; the persisted/API field is `requirement`. See §4 and §6.
3. **The one-active-pending-follow-up rule is not enforced anywhere.** `followUpService.create()` inserts a pending row without checking for an existing pending row. Record Progress can schedule a second pending task, and the standalone follow-up endpoint can too. Current production data happens to contain zero leads with more than one pending follow-up, but that is a data accident, not a constraint. See §8.2.
4. **Scheduling a new follow-up does not auto-complete an existing one.** Record Progress only completes a task when `completeFollowUpId` is explicitly supplied. There is no implicit completion and no supersession logic. See §3.4 and §8.
5. **Automatic completion has no existing representation.** `ActivityEntryType.FOLLOW_UP_COMPLETED` exists and can carry `followUpId`, but current code only writes it for explicit completion. A new automatic-completion path must reuse that entry type and add explicit metadata; no new activity model is required. See §8.3 and §8.4.
6. **`FollowUpStatus.CANCELLED` is effectively unused.** The delete path writes a `FOLLOW_UP_CANCELLED` activity entry and then hard-deletes the `FollowUp` row. No `CANCELLED` rows exist. This conflicts with the requirement to preserve history and not silently delete historical tasks. See §8.7.
7. **No database-level guarantee exists.** `FollowUp` has indexes but no unique constraint on pending tasks. A partial unique index on `("leadId") WHERE status = 'PENDING'` is the strongest and simplest enforcement, but Prisma does not model partial indexes in `schema.prisma`, so it requires raw SQL in a migration. See §8.5.
8. **Enum values should not be renamed in Phase 1.** The database values are widely embedded in API filters, exports, dashboards, tests, and validation. The safe path is display-label improvements and, where required, additive alias handling. A database enum rename is a breaking migration with little user-visible benefit. See §7.
9. **`City` → `District` is a labeling decision, not a schema change.** Renaming the label only affects the manual form but creates inconsistency with the `city` API key, the CSV export column, and history labels. Renaming the database column/API field is a larger compatibility change. This is an unresolved decision. See §6.6 and §13.
10. **No screenshots were available.** Visual fidelity is unverified. See §0.2.

## 2. Current architecture

### 2.1 Entry points and component map

| Concern | Current component / route | Notes |
|---|---|---|
| Record Progress | `src/components/leads/record-progress-modal.tsx` (`RecordProgressModal`) | Canonical interaction modal. Opened from Lead Workspace, Tasks, and My Leads. |
| Create / Edit Lead | `src/components/leads/lead-edit-modal.tsx` (`LeadEditModal`) | Create mode and edit mode share one component; edit mode is a flat form, create mode uses accordions. |
| Lead Workspace | `src/components/sales/lead-details-modal.tsx` | Hosts the Record Progress action, follow-up list, schedule/reschedule/delete actions, and activity timeline. |
| Shared interaction fields | `src/components/sales/activity-fields.tsx` (`ActivityFormFields`) | Action, response, conditional interest, notes, optional follow-up scheduling. |
| Create lead API | `POST /api/leads` | Requires `CREATE_LEAD`; delegates to `leadWorkflowService.createLeadWithInitialActivity()`; requires `initialActivity`. |
| Record Progress API | `POST /api/leads/[id]/activities` | Delegates to `leadWorkflowService.recordLeadProgress()`. |
| Details API | `GET /api/leads/[id]/details` | Returns lead, up to 100 notes, all follow-ups, and latest 100 activity events. |
| Follow-up APIs | `POST /api/leads/[id]/follow-ups`, `PATCH /api/follow-ups/[id]`, `DELETE /api/follow-ups/[id]`, `POST /api/follow-ups/[id]/complete` | Standalone lifecycle operations. |
| Activity APIs | `POST /api/leads/[id]/activities`, `GET /api/leads/[id]/activities`, `PATCH /api/activities/[id]` | Record, list, and edit activity. |
| Auth wrappers | `withApiAuthorization`, `withPermissionAuthorization` | Server-side authorization; SALES access is scoped to assigned leads. |

### 2.2 Data model relevant to the workflow

| Model | Relevant fields | Current behavior / constraint |
|---|---|---|
| `Lead` | `displayName` (mapped from `name`), `company`, `email`, `phone`, `city`, `state`, `requirement`, `status` default `NEW`, `priority` default `MEDIUM`, `category` nullable, `sourceId`, `assignedUserId`, `nextFollowUpAt`, `lastFollowUpAt`, `updatedAt`, `isDeleted` | `nextFollowUpAt` and `lastFollowUpAt` are denormalized and maintained by `recalculateLeadFollowUpFields()`. No `district` field. |
| `FollowUp` | `title`, `description`, `dueDate`, `dueTime`, `priority` default `MEDIUM`, `status` default `PENDING`, `leadId`, `assignedUserId`, `createdById`, `completedAt` | `status` supports `PENDING`, `COMPLETED`, `CANCELLED`. No `cancelledAt`. No uniqueness on pending tasks. |
| `ActivityEvent` | `type`, `leadId`, `actorId`, `occurredAt`, `metadata`, `entries` | One event groups related entries. |
| `ActivityEntry` | `type`, `action`, `response`, `interest`, `message`, `metadata`, `followUpId` | `followUpId` links lifecycle entries to a task; `onDelete: SetNull` if the task is hard-deleted. |

Relevant indexes on `FollowUp`: `@@index([leadId, dueDate, status])`, `@@index([assignedUserId, status, dueDate])`, `@@index([leadId, createdAt])`. None prevents multiple pending rows for the same lead.

### 2.3 Service and transaction map

| Operation | Service method | Transaction boundary |
|---|---|---|
| Create lead with initial interaction | `LeadWorkflowService.createLeadWithInitialActivity()` → `LeadService.prepareCreate()` + `LeadService.createInTransaction()` | One `prisma.$transaction`. Lead, `SYSTEM/CREATED`, `INTERACTION`, and optional `FollowUp` commit together. |
| Record Progress | `LeadWorkflowService.recordLeadProgress()` | One `prisma.$transaction`. Optional completion, lead-field changes, optional new task, activity event, and recalculation commit together. |
| Schedule follow-up (standalone) | `FollowUpService.create()` | Single create plus optional lifecycle event and recalculation. The caller may supply a transaction; the API route does not. |
| Complete follow-up | `FollowUpService.complete()` | One transaction. Conditional `PENDING`→`COMPLETED`, optional activity/note, optional next task, event, recalculation. |
| Reschedule follow-up | `FollowUpService.reschedule()` | One transaction. Pending-only guard, update, `FOLLOW_UP_RESCHEDULED` event, recalculation. |
| Delete/cancel follow-up | `FollowUpService.remove()` | One transaction. Writes `FOLLOW_UP_CANCELLED` for pending rows, then hard-deletes the row and recalculates. |
| Recalculate denormalized dates | `FollowUpService.recalculateLeadFollowUpFields()` | Runs inside the caller's transaction; uses optimistic retry on `Lead.nextFollowUpAt`/`lastFollowUpAt`. |

## 3. Record Progress audit

### 3.1 Current modal structure and dimensions

Source: `src/components/leads/record-progress-modal.tsx`.

- Overlay: `fixed inset-0 z-[60] flex items-center justify-center p-4` (line 258).
- Dialog: `relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border ... bg-white shadow-xl` (line 260).
- Body: scrollable `flex-1 space-y-5 overflow-y-auto p-6` (line 262).
- Footer: fixed `border-t` with Cancel and Record Progress buttons (lines 415–420).
- Sections: three `AccordionSection`s, all initialized collapsed (lines 100–104):
  - `Customer Interaction` — status “Required”.
  - `Update Lead Classification` — status “Optional”.
  - `Manage Follow-ups` — status “Optional”.
- There is no two-column layout.
- Because sections start collapsed, the user sees only three headings and the footer on open. `autoFocus` is placed on the first accordion.
- Accessibility: `useAccessibleDialog` provides scroll lock, focus entry/trap/restore, and Escape handling. The dialog uses `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- Error handling expands the section containing the first invalid field and focuses it via `FIELD_SECTION`, `FIELD_ELEMENT_ID`, `expandSectionsWithErrors()`, and `focusAfterExpansion` (lines 44–68, 126–138).

### 3.2 Fields, defaults, and validation

Source: `src/components/leads/record-progress-modal.tsx`, `src/lib/validation.ts` (`leadProgressRequestSchema`, `interactionActivityFields`, `refineInteraction`).

| Field | Default | Required | Validation / behavior |
|---|---|---|---|
| Action | `CALL` | Yes | `CALL` or `WHATSAPP`. Changing action clears response and interest. |
| Response | `""` | Yes | Must be valid for the action. CALL: `PICKED_UP`, `NO_RESPONSE`, `INVALID_NUMBER`. WHATSAPP: `REPLIED`, `NO_RESPONSE`, `INVALID_NUMBER`. |
| Interest | `""` | Conditional | Required when response is `PICKED_UP` or `REPLIED`; must be null otherwise. UI clears interest when the response is not successful. |
| Notes | `""` | No | Trimmed, max 10,000, blank → `null`. Stored on the activity entry, not as a `Note`. |
| Status | Current lead status | No | Optional classification change. UI only sends it when different from the loaded lead. |
| Priority | Current lead priority | No | Optional classification change. UI only sends it when different. |
| Category | Current lead category or `""` | No | Optional classification change. UI sends `null` when cleared and only when different. |
| Complete follow-up | `""` | No | `completeFollowUpId`; must identify a pending task belonging to the lead. |
| Schedule follow-up | `false` | No | When true, `followUpDate` is required and `followUpTime` is optional. When false, date/time must be absent. |
| Follow-up date | `""` | Conditional | Validated by `isValidFollowUpDate()`; date-only or ISO date-time with offset. |
| Follow-up time | `""` | No | `HH:mm` when present. |

Important distinction:

- The modal’s local `scheduleFollowUp` state is also passed to `ActivityFormFields` with `showFollowUpScheduling={false}`. The scheduling controls are rendered by the modal’s own “Manage Follow-ups” section, not by the shared fields.
- Classification fields are disabled until the lead is loaded (`disabled={!lead}`). The submit button is also disabled while `loadingDetails` is true or `lead` is null.
- The schema validates the complete payload even when sections are collapsed. The UI expands sections with errors.

### 3.3 Classification updates

- Only `status`, `priority`, and `category` are editable through Record Progress.
- The client compares each value to the loaded lead and adds only changed fields to the payload (lines 189–194).
- The server calls `LeadService.updateFieldsInTransaction()`, which normalizes and compares persisted values, updates only changed columns, and uses `updatedAt` for optimistic concurrency. A stale update returns 409.
- If no field changed, no lead update and no `UPDATED`/`STATUS_CHANGED` entries are written.
- The interaction event groups the interaction entry, optional follow-up lifecycle entries, and field-change entries (`asEntries(changes)`).
- `STATUS_CHANGED` metadata contains `{ from, to }`; other changes are grouped into a single `UPDATED` entry with `{ changes: [...] }`.

### 3.4 Follow-up scheduling and completion

- `pendingFollowUps` is derived from the `followUps` prop or the details fetch, filtered by `getEligibleProgressFollowUps()` to `status === "PENDING"` and either no `leadId` or the same `leadId`.
- The UI renders a single-select radio list:
  - “Leave all pending follow-ups unchanged” (value `""`).
  - One radio per pending follow-up.
- A task opened from Tasks is preselected only if it is still pending (`getValidProposedFollowUpId()`).
- `getCompletionFollowUpId()` converts the selection to `completeFollowUpId`; an empty selection becomes `undefined`.
- “Schedule another follow-up” is an independent checkbox. A replacement can be scheduled with or without completing a selected task.
- `recordLeadProgress()` completes only the selected task, then optionally creates a new task. Other pending tasks are untouched.
- The new task is assigned to `lead.assignedUserId ?? actor.id` (lines 132–140). The standalone completion service assigns to the actor (`assignedUserId: actor.id`) when it creates a next task.
- `recalculateLeadFollowUpFields()` runs if either a task was completed or a new task was created.
- Current code does **not** auto-complete an existing pending task when a new one is scheduled.
- Current code does **not** prevent multiple pending tasks from existing.

### 3.5 API, service, and transaction sequence

`POST /api/leads/[id]/activities`:

1. `withApiAuthorization` authenticates the request.
2. `leadProgressRequestSchema` validates the body. Invalid input returns 400 with `parsed.error.flatten()`.
3. `leadWorkflowService.recordLeadProgress(id, parsed.data, session.user)` runs one transaction:
   1. Load a non-deleted, accessible lead; SALES must be the assignee.
   2. If `completeFollowUpId` is set, call `completePendingInTransaction()`: read the task for this lead, reject non-pending with 409, conditional `updateMany where status='PENDING'`, set `completedAt`, reload.
   3. Build a patch with only supplied `status`, `priority`, `category`; call `updateFieldsInTransaction()`.
   4. If scheduling is enabled, create a new pending follow-up with title `Call follow-up` or `WhatsApp follow-up`, description `null`, assignee `lead.assignedUserId ?? actor.id`.
   5. Build entries: interaction, optional `FOLLOW_UP_COMPLETED`, optional `FOLLOW_UP_SCHEDULED`, then field changes.
   6. Create one `INTERACTION` event with all entries.
   7. Recalculate denormalized dates if a task changed.
   8. Reload the lead and interaction for the response.
4. On success, invalidate cache tags for the actor and affected users.
5. Return 201 with the interaction plus `lead`, `completedFollowUp`, and `nextFollowUp`.

### 3.6 Activity events and entries produced

For a normal submission:

- One `ActivityEvent` of type `INTERACTION`.
- One interaction entry of type `CALL` or `WHATSAPP`, with `action`, `response`, `interest`, `message`, and optional `notes` metadata.
- Optional `FOLLOW_UP_COMPLETED` entry with `followUpId`, title, scheduled date/time.
- Optional `FOLLOW_UP_SCHEDULED` entry with `followUpId`, due date/time.
- Optional `STATUS_CHANGED` and/or `UPDATED` entries for real field changes.

The `message` for the interaction is the user’s notes when present; otherwise it is a generated label such as `CALL - NO RESPONSE (INTERESTED)`.

### 3.7 Loading, error, success, and concurrency behavior

| State | Current behavior |
|---|---|
| Details loading | `axios.get('/api/leads/{id}/details')` unless `followUpsProp` was supplied. Shows “Loading current lead details…” and disables submit. |
| Details failure | Inline error: “Unable to load the latest lead and follow-up details. Close and reopen this form to retry.” |
| Client validation failure | Field errors mapped to sections; sections expand; first invalid field focused where possible. |
| Server 400 | If `error.fieldErrors` exists, map to fields; otherwise show the first message or a generic message. |
| Server 409 | “The lead or follow-up changed while you were working. Refresh the details, review the current task, and try again.” No partial records are committed because the whole operation is one transaction. |
| Server 403 | “You no longer have permission to record progress on this lead.” |
| Saving | Submit disabled, spinner, “Saving...” shown; dialog cannot be closed. |
| Success | Toast “Progress recorded”, close, `onSaved()` refresh. |

### 3.8 Record Progress findings against the requested design

| Finding | Evidence | Target |
|---|---|---|
| Centered `max-w-2xl` modal, not full viewport | line 260 | Full-viewport modal. |
| Three collapsed accordions | lines 100–104, 268–411 | Two visible columns, no collapsed sections. |
| Left/right grouping absent | entire return block | Left: Customer Interaction + Update Lead Classification. Right: Manage Follow-ups. |
| Follow-up completion is an independent radio choice | lines 337–389 | Keep explicit completion, but show that scheduling a replacement will auto-complete the active task. |
| No auto-completion on scheduling | `recordLeadProgress()` lines 131–151 | Auto-complete the prior pending task in the same transaction. |
| No one-active guard | `followUpService.create()` lines 120–136 | Enforce one `PENDING` per lead. |
| Multiple pending tasks are tolerated | `getEligibleProgressFollowUps()` returns all pending | UI and service must assume at most one active task. |

## 4. Create Lead audit

### 4.1 Current structure and dimensions

Source: `src/components/leads/lead-edit-modal.tsx`.

- Overlay: `fixed inset-0 z-50 flex justify-center overflow-hidden`; create mode centers with `items-center p-3 sm:p-5`; edit mode uses `items-start` (line 359).
- Dialog: `relative z-10 flex w-[90%] max-w-4xl flex-col overflow-hidden rounded-2xl ... bg-white shadow-2xl`.
  - Create mode: `max-h-[90dvh]`.
  - Edit mode: `mt-6 mb-6` plus inline style `{ height: "88vh", maxHeight: "88vh" }` (lines 362–370).
- Header: title “Create Lead” or “Edit Lead”, close button.
- Body: `flex-1 overflow-y-auto p-6`; create mode adds `min-h-0`.
- Footer: Cancel plus submit button.
- Create mode: three `AccordionSection`s, all initially collapsed (lines 83–87, 140):
  - `Lead Information` — “Required” (Basic Information + Contact Details + Requirements).
  - `Lead Classification` — “Optional”.
  - `Initial Customer Interaction` — “Required”.
- Edit mode: flat sections, no accordions, no initial interaction.

### 4.2 Fields, defaults, and validation

Persisted/API mapping and current UI:

| UI label | Persisted field / API key | Default | Required | Validation |
|---|---|---|---|---|
| Name | `name` → `Lead.displayName` | `""` | Yes | Trimmed, 2–120 characters. |
| Company | `company` | `""` | No | Trimmed, max 120. |
| Email | `email` | `""` | Conditionally | Valid email when supplied; at least one of email/phone required. Blank → null. |
| Phone | `phone` | `""` | Conditionally | Exactly 10 digits when supplied; at least one of email/phone required. Blank → null. |
| City | `city` | `""` | No | Trimmed, max 80. |
| State | `state` | `""` | No | Trimmed, max 80. |
| Requirement | `requirement` | `""` | No | Trimmed, max 2,000. |
| Status | `status` | `NEW` | No | `LeadStatus` enum. |
| Priority | `priority` | `MEDIUM` | No | `LeadPriority` enum. |
| Category | `category` | `""` → null | No | `LeadCategory` enum or null. |
| Lead Source | `sourceId` | `""` → null | No | Existing `LeadSource` ID. |
| Assigned To | `assignedUserId` | `""` → null | No | Only rendered when `assignableUsers` is provided (Admin). SALES are self-assigned and cannot assign another user. |
| Product | `product` | — | No | Not rendered in the manual form. Accepted by the broader schema/API for compatibility and imports. |

Validation rules:

- `createLeadRequestSchema` = `manualLeadFieldsSchema` + mandatory `initialActivity` + super-refine requiring email or phone.
- `manualLeadFieldsSchema` = `leadSchema.omit({ nextFollowUpAt: true })`.
- `leadSchema` includes many integration/import fields not shown in the manual form: alternate phone, address, country, product, industry, website, job title, budget, expected value, currency, campaign/UTM fields, lost reason, won amount, custom fields, raw payload, connector fields, etc.
- Edit mode uses `leadSchema.partial()`, so omitted fields are unchanged.
- The initial interaction uses the same conditional action/response/interest rules as Record Progress.
- Follow-up scheduling defaults off; date is required when scheduling.

### 4.3 Initial interaction

- Create mode always collects one interaction (`initialActivity`).
- The payload always includes `initialActivity` in create mode.
- `createLeadRequestSchema` makes `initialActivity` mandatory; a request without it returns 400.
- The interaction is created in the same transaction as the lead.
- The UI does not create a standalone `Note`.
- The initial follow-up is optional and is created in the same transaction when enabled.
- Connector/import creation uses `LeadService.create()` (not the manual schema) and does not fabricate an interaction.

### 4.4 API, transaction, and compatibility

- `POST /api/leads` requires `CREATE_LEAD` (Admin and SENIOR Sales today).
- `leadWorkflowService.createLeadWithInitialActivity()` validates with `createLeadRequestSchema`, calls `leadService.prepareCreate()`, then `prisma.$transaction((tx) => leadService.createInTransaction(...))`.
- `createInTransaction()`:
  - Creates the lead.
  - Creates a `SYSTEM/CREATED` event.
  - Creates one `INTERACTION` event with the interaction entry.
  - Optionally creates a pending follow-up via `followUpService.create()` with lifecycle event recording disabled (the entry is added to the interaction event instead).
  - Returns the lead, interaction event ID, and optional follow-up.
- P2002 on concurrent duplicate insert returns `{ status: "skipped" }` and the API returns 409.
- Connector/import path: `LeadService.create()` remains separate and does not require `initialActivity`.
- The response shape is the existing lead response. There is no `district` or `latestRequirement` key.
- CSV export retains `City`, `State`, `Product`, `Requirement`, and raw enum values.

### 4.5 Create Lead findings against the requested design

| Finding | Evidence | Target |
|---|---|---|
| Three collapsed accordions in create mode | lines 83–87, 402–438 | Flat two-column form, no collapsed sections. |
| `max-w-4xl`, content-sized height | lines 359–370 | Two-column layout with a stable viewport-height shell; exact width to be decided. |
| City label, not District | line 308 | Label “District”, mapped to `city` initially. |
| Category and Lead Source in “Classification” accordion | lines 259–295 | Left column. |
| Requirement label, not Latest Requirement | lines 318–327 | Right column, label “Latest Requirement”. |
| Status/Priority in same section as Category/Source | lines 259–295 | Right column. |
| Initial interaction is a separate collapsed section | lines 430–438 | Right column, visible with the rest of the form. |
| Product omitted | `docs/api.md` line 193 | Keep omitted unless product explicitly requests it. |
| Assigned To placement | line 285 | Decide: Admin-only right-column field or keep near classification. |

## 5. Proposed Record Progress layout

### 5.1 Shell

- Full viewport: `fixed inset-0 z-[60]`, dialog `h-[100dvh] w-screen max-w-none rounded-none` on mobile; if a desktop inset is desired, use `sm:h-[96dvh] sm:w-[96vw] sm:max-w-7xl sm:rounded-2xl`. The requirement says “full-viewport modal”; the simplest compliant shell is `h-[100dvh] w-screen`, with no outer padding.
- Header: title, lead name, short instruction, close button. Sticky at the top.
- Body: `flex-1 overflow-y-auto`, two-column grid at `lg` and above, single column below `lg`.
- Footer: sticky, Cancel and Record Progress. Same primary button styling as today.
- No `AccordionSection` in this workflow.
- Keep `useAccessibleDialog` for focus trap, scroll lock, Escape, and restore.
- Error summary at the bottom of the body or top of the footer, plus inline field errors.

### 5.2 Two-column content

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Record Progress · For <lead name>                                     [X]   │
├──────────────────────────────────────────┬───────────────────────────────────┤
│ LEFT COLUMN                              │ RIGHT COLUMN                      │
│                                          │                                   │
│ Customer Interaction                     │ Manage Follow-ups                 │
│  Action                                  │  Current follow-up                │
│  Response                                │   - title / due / owner / status  │
│  Interest (conditional)                  │   - “Will be completed when you   │
│  Notes                                   │      save a new follow-up.”       │
│                                          │  [ ] Complete current follow-up   │
│ Update Lead Classification               │      without scheduling a new one │
│  Status                                  │  [ ] Schedule next follow-up      │
│  Priority                                │      Date                         │
│  Category                                │      Time                         │
│                                          │                                   │
│                                          │ What will happen on save          │
│                                          │  - interaction recorded           │
│                                          │  - prior task completed (auto)    │
│                                          │  - new task scheduled             │
├──────────────────────────────────────────┴───────────────────────────────────┤
│ [Cancel]                                                     [Record Progress]│
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Field mapping and behavior

| Area | Fields | Behavior |
|---|---|---|
| Customer Interaction | Action, Response, Interest, Notes | Same schema and conditional rules as today. Keep `ActivityFormFields` with `showFollowUpScheduling={false}` or extract the interaction subset. |
| Update Lead Classification | Status, Priority, Category | Same no-op diff logic. Show current value and “Leave unchanged” semantics explicitly. |
| Manage Follow-ups | Current pending task, explicit completion, next schedule | With one active task, render at most one current task. If the user schedules a new task, show a clear notice that the current task will be automatically completed. If the user checks “complete without scheduling”, complete it and do not create a new one. |
| Save summary | Interaction + classification + follow-up effects | Read-only summary prevents accidental completion/scheduling. |

### 5.4 One-active behavior in the UI

- The current task list is no longer a multi-select radio list; it is a single “Current follow-up” card.
- If no pending task exists, show “No active follow-up” and the schedule control.
- If a pending task exists:
  - Show its title, due date/time, owner, and overdue state.
  - Provide an explicit “Mark complete without scheduling a new follow-up” checkbox.
  - Provide “Schedule next follow-up”. When checked, show the automatic-completion notice.
- If the user schedules a new task while a current task exists, the server completes the current task and creates the new one. The UI must not imply the old task remains pending.
- If a Tasks entry point opens the modal with a specific task, that task is the current task. If it is no longer pending, show the existing stale-task warning and require the user to review before submitting.
- Error mapping no longer needs section expansion. Map errors directly to fields and focus the first invalid field.

### 5.5 What does not change

- The interaction is still genuine and mandatory.
- Classification fields remain optional and no-op-safe.
- Activity notes remain on the activity entry, not on a `Note` or `FollowUp.description`.
- The modal still posts one request to `POST /api/leads/[id]/activities`.
- The response, 409, 403, and success behavior remain compatible.

## 6. Proposed Create Lead layout

### 6.1 Shell

- Keep a modal shell but make the content a flat two-column form. Suggested width: `max-w-5xl` (to be confirmed against the unavailable screenshots). Height: `max-h-[92dvh]` with a sticky footer and scrollable body. Do not use `88vh` fixed height for create mode.
- Header: “Create Lead”, close button.
- Body: `grid grid-cols-1 gap-6 lg:grid-cols-2`.
- Footer: Cancel and Save.
- No accordions in create mode. Edit mode can remain flat or converge on the same two-column grouping; that is a separate decision.
- Keep client validation and inline errors.
- Keep server validation as the authority.

### 6.2 Left column

1. Name (required)
2. Company
3. Email
4. Phone
5. District (currently `city`)
6. State
7. Category
8. Lead Source

Rationale: identity/contact and location/classification live together; Category and Lead Source move out of the current “Classification” accordion.

### 6.3 Right column

1. Status
2. Priority
3. Latest Requirement (currently `requirement`)
4. Initial Customer Interaction
   - Action
   - Response
   - Interest (conditional)
   - Notes
   - Optional follow-up schedule (or defer follow-up to Workspace)

### 6.4 Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Create Lead                                                           [X]   │
├──────────────────────────────────────────┬───────────────────────────────────┤
│ LEFT COLUMN                              │ RIGHT COLUMN                      │
│  Name *                                  │  Status                           │
│  Company                                 │  Priority                         │
│  Email                                   │  Latest Requirement               │
│  Phone                                   │                                   │
│  District                                │  Initial Customer Interaction     │
│  State                                   │   Action *                        │
│  Category                                │   Response *                      │
│  Lead Source                             │   Interest (conditional) *        │
│                                          │   Notes                           │
│                                          │   [ ] Schedule follow-up          │
│                                          │       Date * / Time               │
├──────────────────────────────────────────┴───────────────────────────────────┤
│ [Cancel]                                                              [Save] │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Field mapping and compatibility

| Proposed label | Persisted field / API key | Change type | Compatibility note |
|---|---|---|---|
| District | `city` | Label only in Phase 1 | `city` remains the API key, database column, export column, and history metadata key. A true rename is a breaking change. |
| State | `state` | No change | — |
| Category | `category` | Position change | Same enum values. |
| Lead Source | `sourceId` | Position change | Same `LeadSource` relation. |
| Status | `status` | Position change | Same enum. |
| Priority | `priority` | Position change | Same enum. |
| Latest Requirement | `requirement` | Label only | Same field; “Latest” implies the value can be updated over time. Confirm whether the field is intended to be append-only history or a single current value. |
| Initial Customer Interaction | `initialActivity` | Position change | Still mandatory; same validation. |

### 6.6 District decision

There is no `district` field in `prisma/schema.prisma`, no `district` key in `leadSchema`, and no `District` label in the UI. Options:

1. **Label-only rename (recommended for Phase 1):** show “District” in the manual form, keep `city` in the database, API, export, and history. Lowest risk. Inconsistency: export column and history label say “City”.
2. **Add `district` as an alias:** accept `district` in the API and map it to `city` (or the reverse). Requires validation/response mapping and risks two names for one concept.
3. **Rename `city` to `district` everywhere:** database migration, API breaking change, export header change, saved filters, history metadata, connector mappings, and tests. Only do this with an explicit compatibility plan.

## 7. Enum inventory

### 7.1 Scope and method

The tables below cover enums that affect the lead workflow, its labels, filters, exports, and authorization. Connector/parser enums are out of scope. Live counts are from `neondb` on 2026-11-09.

Label sources:

- `src/lib/lead-constants.ts` — lead status, priority, category.
- `src/lib/activity-options.ts` — action, response, interest.
- Local maps in `src/components/sales/sales-my-leads-page-content.tsx`, `src/components/sales/daily-history.tsx`, `src/components/admin/admin-dashboard-client.tsx`, and `src/components/ui/badge.tsx`.
- `docs/database.md` — schema reference.

“Plain-language label” is a proposed display label at roughly a fifth-grade reading level. It is not a database value. Changing a display label is not a migration.

### 7.2 LeadStatus

DB values and rows:

| DB value | Current label | Rows |
|---|---|---|
| `NEW` | New | 59 |
| `CONVERTED` | Converted | 16 |
| `LOST` | Lost | 13 |
| `SPAM` | Spam | 5 |
| `ON_HOLD` | On Hold | 22 |

Consumers: `LEAD_STATUSES` in `lead-constants.ts`; create/edit form; Record Progress; table filters; badges; dashboards; reports; export filters; `report.service.ts`; `dashboard.service.ts`; `lead.service.ts`; query/export tests; seed data.

API/integration dependencies: raw values in query strings, export filters, dashboard/report grouping, and any external client that sends `status`.

Ambiguity: “Converted” can mean “became a customer” or “changed”; “Lost” can mean “not interested” or “unreachable”; “On Hold” can mean “paused” or “waiting”; “Spam” can mean “junk” or “invalid”; “New” can mean “not contacted” or “recently created”.

Plain-language label proposal: New, Customer, Not interested, Junk, Paused.

Recommendation: keep DB values; improve display labels only. A DB rename would break filters, exports, dashboards, tests, and stored API clients.

### 7.3 LeadPriority

| DB value | Current label | Rows |
|---|---|---|
| `LOW` | Low | 24 |
| `MEDIUM` | Medium | 56 |
| `HIGH` | High | 26 |
| `URGENT` | Urgent | 9 |

Consumers: `LEAD_PRIORITIES`; create/edit; Record Progress; filters; badges; dashboards; export filters.

API/integration dependencies: raw values in filters and exports.

Ambiguity: “Medium” and “High” are subjective; “Urgent” may overlap with “High”. No data problem.

Plain-language label proposal: Low, Normal, High, Do now.

Recommendation: keep DB values; optionally improve display labels. Do not rename.

### 7.4 FollowUpStatus

| DB value | Current label | Rows |
|---|---|---|
| `PENDING` | Pending (implicit in UI) | 2 |
| `COMPLETED` | Completed (implicit in UI) | 6 |
| `CANCELLED` | Cancelled (activity label only) | 0 |

Consumers: `FollowUpService`; Tasks list; Lead Workspace; Record Progress eligibility; recalculate; completion/reschedule routes.

API/integration dependencies: status filters (`status: "PENDING"`), `listForTasks()`, and the `completeFollowUpId` precondition.

Ambiguity: `CANCELLED` is defined but never written. The delete path hard-deletes after writing `FOLLOW_UP_CANCELLED`. “Cancelled” and “deleted” are conflated.

Plain-language label proposal: To do, Done, Cancelled.

Recommendation: keep DB values; start using `CANCELLED` for soft cancellation. Consider adding `cancelledAt` (schema change) if cancellation history needs a timestamp.

### 7.5 FollowUpPriority

| DB value | Current label | Rows (follow-ups) |
|---|---|---|
| `LOW` | Low | 0 |
| `MEDIUM` | Medium | 8 |
| `HIGH` | High | 0 |
| `URGENT` | Urgent | 0 |

Consumers: `followUpSchema`, `FollowUpService`, Tasks/Workspace display. The manual Add Lead/Record Progress workflows currently always create `MEDIUM`.

API/integration dependencies: `followUpSchema.priority`, `followUpUpdateSchema`, exports/tests where follow-ups are serialized.

Ambiguity: duplicates `LeadPriority` with a separate enum type. Two enums can drift.

Plain-language label proposal: same as `LeadPriority`.

Recommendation: keep both DB enums for now; centralize label resolution so `LeadPriority` and `FollowUpPriority` cannot drift. A shared enum would be a migration and is not justified yet.

### 7.6 ActionType

| DB value | Current label | Rows (activity entries) | Consumers |
|---|---|---|---|
| `CALL` | Call | 4 | `ACTIVITY_ACTION_OPTIONS`, `ActivityFormFields`, validation, activity entries, filters, display maps |
| `WHATSAPP` | WhatsApp | 6 | same |

API/integration dependencies: `action` in `POST /api/leads`, `POST /api/leads/[id]/activities`, activity PATCH, export filters.

Ambiguity: none. Only two contact channels; adding a third requires validation, UI, entries, and filters.

Plain-language label: Call, WhatsApp.

Recommendation: keep DB values and labels.

### 7.7 ResponseType

| DB value | Current label | Valid for | Rows (activity entries) | Notes |
|---|---|---|---|---|
| `PICKED_UP` | Picked Up | CALL | 2 | Customer answered. |
| `REPLIED` | Replied | WHATSAPP | 3 | Customer wrote back. |
| `NO_RESPONSE` | No Response | CALL, WHATSAPP | 5 | Valid genuine attempt. |
| `INVALID_NUMBER` | Invalid Number | CALL, WHATSAPP | 0 | Wrong/bad number. |

Consumers: `ACTIVITY_RESPONSE_OPTIONS`, `getActivityResponseOptions()`, `ActivityFormFields`, validation, activity entries, filters, display maps, export filters.

API/integration dependencies: `response` in the three interaction payloads; raw value in filters/exports.

Ambiguity: “Picked Up” is call-specific; “Replied” is WhatsApp-specific. The database does not enforce the pairing; validation does. A future channel could make the pair ambiguous.

Plain-language label proposal: They answered, They wrote back, No answer, Wrong number.

Recommendation: keep DB values; improve display labels only. Do not merge `PICKED_UP` and `REPLIED`; they carry channel semantics.

### 7.8 InterestType

| DB value | Current label | Rows (activity entries) | Notes |
|---|---|---|---|
| `INTERESTED` | Interested | 4 | Required when the response is successful. |
| `NOT_INTERESTED` | Not Interested | 1 | Required when the response is successful. |

Consumers: `ACTIVITY_INTEREST_OPTIONS`, inline options in `ActivityFormFields`, validation, entries, filters, display maps, export filters.

API/integration dependencies: `interest` in interaction payloads; raw value in filters/exports. `null` means not captured (only for non-successful responses).

Ambiguity: binary choice may be too coarse; “maybe” is not representable. Do not add values without a product decision.

Plain-language label proposal: Wants to talk, Not interested.

Recommendation: keep DB values. If “maybe” is needed, add a new value through a migration and update all consumers; do not overload `null`.

### 7.9 LeadCategory

DB values, current labels, rows:

| DB value | Current label | Rows | Ambiguity / note |
|---|---|---|---|
| `MEDICAL_REPRESENTATIVE` | Medical Representative | 8 | Long label; role vs organization. |
| `RETAILER` | Retailer | 7 | Overlaps with Pharmacy. |
| `WHOLESALER` | Wholesaler | 2 | Overlaps with Distributor. |
| `DISTRIBUTOR` | Distributor | 6 | Overlaps with Wholesaler. |
| `MARKETING` | Marketing | 3 | Function, not organization type. |
| `THIRD_PARTY` | Third Party | 6 | Vague. |
| `DOCTOR` | Doctor | 6 | Person, not organization. |
| `FRANCHISE` | Franchise | 4 | Business model. |
| `BUSINESS` | Business | 7 | Very broad; overlaps Corporate. |
| `HOSPITAL` | Hospital | 3 | Organization. |
| `CLINIC` | Clinic | 7 | Organization. |
| `PHARMACY` | Pharmacy | 6 | Organization; overlaps Retailer. |
| `LABORATORY` | Laboratory | 3 | Organization. |
| `MANUFACTURER` | Manufacturer | 8 | Organization. |
| `CORPORATE` | Corporate | 6 | Overlaps Business. |
| `GOVERNMENT` | Government | 8 | Organization. |
| `OTHER` | Other | 5 | Catch-all. |
| `null` | None | 20 | No category. |

Consumers: `LEAD_CATEGORIES`, create/edit, Record Progress, filters, badges, dashboards, export filters, reports.

API/integration dependencies: raw values in filters/exports; connector/import may set category through the broad schema.

Ambiguity: the taxonomy mixes organization types (Hospital, Clinic, Pharmacy), roles (Doctor, Medical Representative), business models (Franchise, Distributor), and broad buckets (Business, Corporate, Other). Several pairs overlap. This is a product taxonomy problem, not a schema bug.

Plain-language label proposal: keep current labels; they are already concrete. Consider grouping in the selector (People / Places / Business types) rather than renaming values.

Recommendation: keep all 17 DB values in Phase 1. A taxonomy redesign is a separate product decision and would require a mapping table plus migration. Do not remove values with existing rows.

### 7.10 ActivityEventType

| DB value | Current label | Rows (events) | Consumers |
|---|---|---|---|
| `INTERACTION` | Interaction | 10 | `recordLeadProgress`, `createInTransaction`, timeline |
| `FOLLOW_UP` | Follow-up | 6 | `FollowUpService.create/complete/reschedule/remove` |
| `NOTE` | Note | 1 | Note service |
| `SYSTEM` | System | 41 | Lead create/update/assign/delete |

API/integration dependencies: timeline rendering, activity queries, possibly exports of activity.

Ambiguity: none. Internal grouping only; not a user selector.

Plain-language label: internal only.

Recommendation: keep DB values. Automatic completion should be a `FOLLOW_UP_COMPLETED` entry inside either the existing `INTERACTION` event (when triggered by Record Progress) or a `FOLLOW_UP` event (standalone scheduling). Do not add a new event type.

### 7.11 ActivityEntryType

| DB value | User-facing label | Rows (entries) | Consumers / meaning |
|---|---|---|---|
| `CREATED` | Lead created | 37 | System timeline |
| `UPDATED` | Lead updated | 4 | Field-change timeline |
| `ASSIGNED` | Assigned | 0 | Assignment timeline |
| `NOTE_ADDED` | Note added | 3 | Note timeline |
| `NOTE_EDITED` | Note edited | 0 | Note timeline |
| `IMPORTED` | Imported | 0 | Connector/import timeline |
| `STATUS_CHANGED` | Status changed | 0 | Status history |
| `FOLLOW_UP_SCHEDULED` | Follow-up scheduled | 8 | Scheduling |
| `FOLLOW_UP_RESCHEDULED` | Follow-up rescheduled | 0 | Rescheduling |
| `FOLLOW_UP_COMPLETED` | Follow-up completed | 6 | Explicit or automatic completion |
| `FOLLOW_UP_CANCELLED` | Follow-up cancelled | 0 | Cancellation/delete |
| `DELETED` | Deleted | 0 | Deletion |
| `RESTORED` | Restored | 0 | Restore |
| `ATTACHMENT_ADDED` | Attachment added | 0 | Attachments |
| `CALL` | Call | 4 | Interaction entry; duplicates `ActionType.CALL` |
| `WHATSAPP` | WhatsApp | 6 | Interaction entry; duplicates `ActionType.WHATSAPP` |

API/integration dependencies: activity rendering, filters, tests. `CALL`/`WHATSAPP` entries also carry `action`/`response`/`interest` columns.

Ambiguity: `CALL`/`WHATSAPP` are both entry types and action values. This duplication is intentional in the current model but must be kept consistent.

Plain-language label: mostly internal; user-facing timeline labels above are sufficient.

Recommendation: keep DB values. Add automatic-completion metadata to `FOLLOW_UP_COMPLETED` rather than a new entry type.

### 7.12 Authorization enums

| Enum | Values | Workflow relevance |
|---|---|---|
| `UserRole` | `ADMIN`, `SALES` | Admin can act on any accessible lead; Sales only on assigned leads. |
| `SalesPrivilege` | `JUNIOR`, `SENIOR` | `CREATE_LEAD` is currently granted to SENIOR Sales only. |

Recommendation: no change in Phase 1. Confirm whether both Sales levels should create leads (unresolved).

### 7.13 Enum findings and migration policy

**Findings**

- Labels are centralized for lead status/priority/category/action/response/interest, but duplicated maps exist:
  - `src/components/sales/sales-my-leads-page-content.tsx` — `ACTION_LABELS`, `RESPONSE_LABELS`, follow-up labels.
  - `src/components/sales/daily-history.tsx` — `ACTION_LABELS`, `RESPONSE_LABELS`, `INTEREST_LABELS`, field labels.
  - `src/components/admin/admin-dashboard-client.tsx` — `STATUS_LABELS`, `PRIORITY_LABELS`.
  - `src/components/ui/badge.tsx` — status tone keys.
- Dashboard/report services hardcode status arrays (`NEW`, `ON_HOLD`, `CONVERTED`, `LOST`, `SPAM`) rather than deriving from a single source.
- `admin-reports.tsx` contains legacy status names (`CONTACTED`, `QUALIFIED`) that are not in `LeadStatus`. This is dead/legacy logic and should be cleaned up in a later phase, not used as an enum source.
- The database does not enforce action/response compatibility. Validation does. Any new write path must use the shared schema.
- Export and API filters use raw DB values. Display-label changes are safe; DB-value changes are not.

**Migration policy**

- **Phase 1 recommendation: no enum value renames and no enum removals.** Use display-label improvements only.
- If a display label changes, update every label map and the export UI label list. Do not change the raw export values unless a separate data-contract decision is made.
- If a DB value must be renamed later, use the existing migration pattern:
  1. Create a new enum type.
  2. `ALTER TABLE ... ALTER COLUMN ... TYPE ... USING CASE ...`.
  3. Map every old value explicitly; never rely on an `ELSE` that silently collapses values.
  4. Drop/rename the old type.
  5. Update validation constants, filters, exports, connectors, seeds, tests, and saved API clients.
  6. Back up and verify row counts before and after.
- Historical precedent: `prisma/migrations/20260718091500_simplify_enums_consistency/migration.sql` mapped `WAITING_FOR_CUSTOMER`/`ARCHIVED` → `ON_HOLD`, `WON`/`CLOSED` → `CONVERTED`, `DISQUALIFIED` → `LOST`, and old priority values. That migration shows the risk: every mapping must be intentional and documented.
- No category values are absent from live data: all 17 values have at least 2 rows, and 20 leads have `null`.

## 8. Follow-up lifecycle, limits, and one-active invariant

### 8.1 Current lifecycle

| Operation | Current behavior | Transaction | History |
|---|---|---|---|
| Create/schedule | `FollowUpService.create()` inserts `PENDING` with optional due date/time, assignee, creator. No existing-pending check. | Caller may pass a transaction; standalone API does not. | `FOLLOW_UP_SCHEDULED` if `recordLifecycleEvent` is true and due date exists. |
| Schedule-only from Workspace | `POST /api/leads/[id]/follow-ups` → `create()`. | Single Prisma call plus event/recalc. | `FOLLOW_UP_SCHEDULED`. |
| Complete | `completePendingInTransaction()` reads the task, rejects if not `PENDING` (409), conditional `updateMany where status='PENDING'`, sets `completedAt`. | One transaction. | `FOLLOW_UP_COMPLETED`, optional interaction/note, optional next task. |
| Complete from Record Progress | Same helper, only when `completeFollowUpId` is supplied. | Same transaction as the interaction and optional new task. | `FOLLOW_UP_COMPLETED` in the interaction event. |
| Reschedule | `reschedule()` rejects non-pending with 400, updates date/time. | One transaction. | `FOLLOW_UP_RESCHEDULED` with previous/new values. |
| Cancel/delete | `remove()` writes `FOLLOW_UP_CANCELLED` if pending, then hard-deletes the row. | One transaction. | `FOLLOW_UP_CANCELLED` remains, but `ActivityEntry.followUpId` becomes null after the row is deleted. |
| Recalculate | Earliest pending due date → `Lead.nextFollowUpAt`; latest completed `completedAt` → `Lead.lastFollowUpAt`. | Inside the caller's transaction; optimistic retry. | No event. |

### 8.2 Current limits and live evidence

- No service guard prevents multiple `PENDING` rows per lead.
- `followUpService.create()` and `createScheduled()` both insert without checking.
- Record Progress can create a new pending task while another remains pending.
- The legacy completion endpoint can create a next task while other pending tasks remain.
- Live data: 8 follow-ups total (2 `PENDING`, 6 `COMPLETED`, 0 `CANCELLED`); 115 leads; **0 leads with more than one pending follow-up**.
- Both pending follow-ups have a `FOLLOW_UP_SCHEDULED` entry; there are 0 pending tasks missing that history.

Conclusion: the current dataset already satisfies the invariant, but the application does not. The invariant must be enforced before new UI exposes auto-completion, or concurrent users can create duplicates.

Additional nuance: `recalculateLeadFollowUpFields()` selects the earliest `PENDING` task with `dueDate != null`. A pending task with no due date is still active under the proposed definition but does not populate `Lead.nextFollowUpAt`, and `FollowUpService.create()` does not write a `FOLLOW_UP_SCHEDULED` entry when there is no due date. Decide whether workflow-created tasks may ever have no due date. The manual workflows currently require one when scheduling; standalone/legacy callers can omit it.

### 8.3 Proposed invariant

**Definition:** A lead has at most one “active” follow-up. An active follow-up is a `FollowUp` row with `status = 'PENDING'`. Pending tasks with a null due date still count as active; otherwise a task could be active but invisible to the one-task rule.

**Rules:**

1. **One active task per lead.** Creating or scheduling a new pending task must leave exactly one `PENDING` row for that lead after the transaction commits.
2. **Auto-complete the prior task on new scheduling.** If a `PENDING` task exists when a new task is scheduled, transition the prior task to `COMPLETED` in the same transaction, set `completedAt` to the transaction’s single `now()` value, and create the new task.
3. **The new task is the survivor.** The prior task must not remain pending, and the new task must not be silently dropped.
4. **Explicit completion still works.** `completeFollowUpId` / the completion endpoint can complete the current task without scheduling a new one.
5. **No implicit completion from recording an interaction alone.** An interaction with no scheduling and no explicit completion leaves the current task pending. This preserves the existing contract.
6. **Preserve history.** Never delete, reopen, or overwrite a completed/cancelled task to enforce the invariant. The prior task keeps its row, `completedAt`, and activity entries.
7. **Record automatic completion in the activity architecture.** Use `ActivityEntryType.FOLLOW_UP_COMPLETED` with `followUpId` and metadata that distinguishes automatic supersession. Do not invent a fake interaction.
8. **Do not invent actor or time.** Use the authenticated actor performing the scheduling and a single server-side `now()` captured inside the transaction. Do not copy a client-supplied timestamp. Do not attribute the completion to the lead owner unless the owner actually performed it.
9. **Atomicity.** Completion of the prior task, creation of the new task, activity event(s), and denormalized recalculation commit together or not at all.
10. **Concurrency safety.** Two simultaneous scheduling requests must not both leave pending rows. One may succeed; the other must either become a no-op or return 409 with no partial writes.

### 8.4 Auto-completion event contract

Recommended metadata for the automatic `FOLLOW_UP_COMPLETED` entry:

```json
{
  "followUpTitle": "Call follow-up",
  "scheduledDate": "2026-11-10T00:00:00.000Z",
  "scheduledTime": "10:30",
  "autoCompleted": true,
  "completionReason": "SUPERSEDED_BY_NEW_FOLLOW_UP",
  "supersededByFollowUpId": "cuid_of_new_task",
  "completedByActorId": "cuid_of_actor"
}
```

Notes:

- `completedAt` is stored on the `FollowUp` row; the entry metadata may include it for timeline display, but the row is authoritative.
- `actorId` belongs on the `ActivityEvent`; do not duplicate a fabricated actor in metadata unless the timeline needs it.
- If the auto-completion is recorded inside a Record Progress submission, add the entry to the existing `INTERACTION` event, before `FOLLOW_UP_SCHEDULED`, so the timeline reads “interaction → prior task completed → new task scheduled”.
- If scheduling happens from a standalone Workspace action, create a `FOLLOW_UP` event containing `FOLLOW_UP_COMPLETED` (auto) and `FOLLOW_UP_SCHEDULED`.
- Do not create a second `SYSTEM` event solely for auto-completion; the lifecycle entry is the audit record.

### 8.5 Transaction and concurrency design

Recommended service sequence for “schedule new task”:

```text
BEGIN
  SELECT lead row FOR UPDATE (serialize scheduling for this lead)
  verify lead access / non-deleted
  SELECT all PENDING follow-ups for lead (excluding a task explicitly completed in this request)
  if more than one PENDING exists:
      abort with 409 (data integrity error; do not silently pick one)
  if one PENDING exists:
      UPDATE ... SET status='COMPLETED', completedAt=now()
      create FOLLOW_UP_COMPLETED entry (autoCompleted=true, supersededByFollowUpId=newId)
  INSERT new FollowUp (status='PENDING')
  create FOLLOW_UP_SCHEDULED entry
  create/append ActivityEvent
  recalculate Lead.nextFollowUpAt / lastFollowUpAt
COMMIT
```

Concurrency options:

1. **Partial unique index (strongest):**
   ```sql
   CREATE UNIQUE INDEX "FollowUp_one_pending_per_lead"
   ON "FollowUp" ("leadId")
   WHERE "status" = 'PENDING';
   ```
   PostgreSQL enforces the invariant even if application code is bypassed. Prisma does not model partial indexes in `schema.prisma`, so this must be added with raw SQL in a migration. Add a comment in the schema or migration README so future `prisma db pull` does not silently drop it.
2. **Row lock (recommended complement):** `SELECT id FROM "Lead" WHERE id = $1 FOR UPDATE` inside the transaction serializes concurrent scheduling for the same lead and gives deterministic behavior instead of a late unique violation.
3. **Conditional update (used today for completion):** `updateMany where status='PENDING'` is already concurrency-safe for completion. It is not sufficient for creation because it cannot prevent two inserts.
4. **Isolation level:** keep the default `ReadCommitted`; the row lock and unique index do the work. Do not raise to `Serializable` unless measurements show a need; it increases retry burden.
5. **Error mapping:** map PostgreSQL `23505` / Prisma `P2002` on the partial index to HTTP 409 with a “refresh and retry” message. Do not retry blindly with the same payload.
6. **Lock ordering:** always lock the lead row before follow-up rows to avoid deadlocks. The current completion path reads the follow-up first; the new scheduling path should standardize on lead-first for all write operations.

### 8.6 Data migration for the invariant

Current data has zero conflicts, so the migration is low-risk:

1. Run a pre-check:
   ```sql
   SELECT "leadId", count(*)
   FROM "FollowUp"
   WHERE status = 'PENDING'
   GROUP BY "leadId"
   HAVING count(*) > 1;
   ```
2. If the result is empty, add the partial unique index.
3. If the result is not empty, stop and report the rows. Do not silently auto-complete or delete historical tasks. A deterministic remediation decision must be made (e.g., pick the earliest due task and complete the rest with an explicit migration event).
4. Add the index in a migration after application code is prepared to handle 409.
5. Keep the existing non-unique indexes; the partial index is additive.

### 8.7 Cancellation versus deletion

The requirement says not to silently delete or overwrite historical tasks. Current `DELETE /api/follow-ups/[id]` hard-deletes the row, which:

- Loses the follow-up record even though `FOLLOW_UP_CANCELLED` remains in the timeline.
- Sets `ActivityEntry.followUpId` to null via `onDelete: SetNull`, so the history entry no longer links to a task.
- Makes `FollowUpStatus.CANCELLED` dead code.

Recommended target:

- `DELETE` becomes a soft cancel: `status = 'CANCELLED'`, `completedAt = null`, keep the row, write `FOLLOW_UP_CANCELLED` with `followUpId`, recalculate.
- Add `cancelledAt DateTime?` if cancellation time is needed (schema change; decide before implementation).
- Keep the endpoint path for compatibility, but change the semantics from hard delete to cancel. If hard delete must remain for a separate administrative operation, expose it separately and require explicit confirmation.
- The one-active invariant treats `CANCELLED` as inactive, so cancelling the current task frees the lead for a new one.

### 8.8 Additional concurrency gaps found

- `FollowUpService.reschedule()` reads the task, checks `status === 'PENDING'`, then updates by `id` only. A concurrent completion between the read and the update can reschedule an already-completed task. Use `updateMany({ where: { id, status: 'PENDING' } })` and treat `count !== 1` as 409.
- `FollowUpService.update()` does not guard against a concurrent status transition when only title/description/assignee changes. It is less dangerous, but a task could be edited after completion. Decide whether edits are allowed on completed tasks; if not, guard them.
- `FollowUpService.remove()` reads the task, writes a cancellation entry if it was pending, then deletes by `id`. A concurrent completion can result in deleting a completed task or in an inaccurate cancellation entry. Use a conditional delete/update based on the observed status, or move to soft cancel with a conditional transition.
- `FollowUpService.recalculateLeadFollowUpFields()` uses optimistic `updateMany` with the observed `nextFollowUpAt`/`lastFollowUpAt`, which is sound. It does not lock the lead row; the retry loop handles contention. Keep the existing behavior or replace it with the lead-row lock used by scheduling.
- `LeadService.updateFieldsInTransaction()` uses `updatedAt` as an optimistic token, which is sound for lead edits. A concurrent follow-up recalculation also updates `Lead`, so it can cause a lead edit to retry/409; this is acceptable but should be covered by tests.

## 9. Unified workflow contract

### 9.1 Comparison matrix

| Concern | Create Lead (current) | Record Progress (current) | Proposed unified rule |
|---|---|---|---|
| Interaction | Mandatory `initialActivity`; one interaction event. | Mandatory action/response; one interaction event per submission. | One genuine interaction per submission; same schema and conditional interest rules; no deduplication. |
| Classification | Status/priority/category on create; defaults `NEW`/`MEDIUM`/null. | Status/priority/category optional; only changed fields sent. | Same enum values; no-op-safe updates; history only for changed fields. |
| Scheduling | Optional initial follow-up; defaults off. | Optional next follow-up; independent of completion. | A lead may have at most one active task. Scheduling a new task auto-completes the prior active task. |
| Completion | Not applicable (new lead). | Explicit `completeFollowUpId`; only pending. | Explicit completion remains; conditional `PENDING`→`COMPLETED`; 409 on stale task. |
| Auto-completion | Not applicable. | None. | Prior active task is completed automatically when a new task is scheduled; recorded as `FOLLOW_UP_COMPLETED` with `autoCompleted: true`. |
| Rescheduling | Not applicable. | Separate PATCH reschedule; pending only. | Rescheduling keeps the same task and does not create a new pending row; still pending-only. |
| Cancellation | Not applicable. | Hard delete after `FOLLOW_UP_CANCELLED`. | Soft cancel (`status='CANCELLED'`), preserve row and history. |
| Transaction | Lead + event + interaction + optional follow-up in one transaction. | Interaction + optional completion + optional new task + event + recalc in one transaction. | All workflow records in one transaction; recalc inside it; cache invalidation after commit. |
| Authorization | `CREATE_LEAD`; Sales self-assign; Admin may assign. | Admin any accessible lead; Sales assigned lead only. | Preserve; enforce at API and service boundary. |
| Idempotency | Duplicate connector identity → 409; manual payloads are not deduplicated. | Repeated genuine interactions are allowed. | Do not deduplicate genuine interactions; completion uses conditional transitions. |

### 9.2 Shared contract rules

1. **One interaction event per submission.** A Record Progress submission creates exactly one `INTERACTION` event containing the contact entry plus lifecycle/field-change entries. Create Lead creates one `INTERACTION` event after the `SYSTEM/CREATED` event.
2. **One active follow-up per lead.** `PENDING` is the active state. Enforce in service and database.
3. **Scheduling implies supersession when an active task exists.** Complete the old task and create the new one in the same transaction.
4. **Explicit completion does not require scheduling.** The user can complete the active task and leave the lead without a next task.
5. **Recording an interaction does not complete a task by itself.** Only explicit completion or scheduling a replacement changes task status.
6. **No silent writes.** If the current task changed concurrently, return 409 and commit nothing.
7. **No-op lead updates.** Do not update `Lead` or write `UPDATED`/`STATUS_CHANGED` when the submitted values match the persisted values.
8. **Denormalized dates are derived.** Never set `nextFollowUpAt`/`lastFollowUpAt` directly from the request. Recalculate from tasks.
9. **Activity notes stay on the activity.** Do not copy them into `FollowUp.description` or create a `Note` as a side effect.
10. **Assignee policy is explicit.** New tasks are assigned to the lead’s assignee, falling back to the actor only for an unassigned lead. The current standalone completion path assigns to the actor; align it or document the exception.

### 9.3 API compatibility matrix

| Endpoint | Current contract | Proposed change | Compatibility |
|---|---|---|---|
| `POST /api/leads` | Requires `initialActivity`; accepts lead fields; returns lead. | UI grouping and labels only; keep `city`, `requirement`, and `initialActivity` keys. | Backward compatible if no field rename. |
| `POST /api/leads/[id]/activities` | Interaction + optional classification + explicit completion + optional scheduling. | Add auto-completion of the prior active task when scheduling; return the auto-completed task. | Backward compatible for clients that already send `scheduleFollowUp`; they now get one active task. Clients that relied on multiple pending tasks would change behavior, but that behavior violates the new invariant. |
| `POST /api/leads/[id]/follow-ups` | Creates a pending task; no limit. | Enforce one active task; auto-complete prior task. | Keep the new follow-up as the response body. If callers need to know what was auto-completed, add an optional `autoCompletedFollowUp` field to the body or return it from a new read endpoint; do not change the body from a follow-up object to a wrapper. |
| `POST /api/follow-ups/[id]/complete` | Completes one task; optional `nextFollowUp`; optional activity/note. | If `nextFollowUp` is present, auto-complete any other pending task (or reject if impossible). Keep `{}` behavior. | Additive; legacy `{}` remains valid. |
| `PATCH /api/follow-ups/[id]` | Update fields or reschedule pending task. | No status transitions; reschedule remains pending-only. | Unchanged. |
| `DELETE /api/follow-ups/[id]` | Hard-deletes. | Soft-cancel recommended. | Semantic change; announce and test. If kept as hard delete, it violates history preservation. |
| `GET /api/leads/[id]/details` | Returns all follow-ups (pending + completed). | No required change; UI filters to active. | Unchanged. |

### 9.4 Response and error conventions

- Validation errors: 400 with `error.flatten()`; field-level messages where possible.
- Inaccessible/deleted lead: 404 to avoid leaking existence.
- Stale lead or task: 409 with a refresh message; no partial records.
- Permission failure: 403 where the existing wrappers expose it.
- Duplicate connector identity: 409; do not treat repeated manual interactions as duplicates.
- Partial unique index conflict: 409, never 500.
- Success: 201 for create/interaction; 200 for completion/update; 204 for delete/cancel.

## 10. Data migration plan

### 10.1 Enum migration

- No enum value changes in Phase 1.
- Display-label changes are code-only.
- If a future phase renames a DB enum value, use the explicit `CASE` pattern from `20260718091500_simplify_enums_consistency`; never use a catch-all `ELSE` that hides unmapped rows.

### 10.2 Field migration

- No schema change for `District` or `Latest Requirement` if the label-only approach is chosen.
- If `District` becomes a real field:
  - Add nullable `district` column.
  - Backfill from `city` only with an explicit product decision (they may not be the same concept).
  - Keep `city` for compatibility or migrate API/export/history in a coordinated release.
  - Update `leadSchema`, `manualLeadFieldsSchema`, projections, export headers, history labels, filters, and tests.
- If `Latest Requirement` becomes a history model rather than a single field, that is a larger schema change and is out of scope for Phase 1.

### 10.3 Follow-up invariant migration

1. Pre-check duplicate pending rows (query in §8.6).
2. Add partial unique index via raw SQL migration.
3. Deploy service changes that handle 409 and perform auto-completion.
4. Guard against Prisma drift: Prisma cannot express the `WHERE status = 'PENDING'` predicate, so a later `prisma migrate dev`/`db push` may not preserve it. Keep the index in a checked-in SQL migration, add a CI check against `pg_indexes`, and document that `db push` is not an acceptable production path for this schema.
5. Verify:
   - `SELECT count(*) FROM (SELECT "leadId" FROM "FollowUp" WHERE status='PENDING' GROUP BY "leadId" HAVING count(*)>1) x;` returns 0.
   - `Lead.nextFollowUpAt` equals the earliest pending due date.
   - `Lead.lastFollowUpAt` equals the latest completed `completedAt`.
6. Rollback: drop the partial index if needed. Service code must remain compatible with multiple pending rows during a rolling deploy, or deploy during a maintenance window.

### 10.4 Cancellation migration

- No existing `CANCELLED` rows.
- If soft cancel is adopted, no backfill is needed.
- If `cancelledAt` is added, it is nullable; existing rows remain null.
- Historical hard-deleted follow-ups cannot be recovered from the application; rely on database backups if recovery is required.

### 10.5 Export compatibility

- Do not change export functionality in this phase.
- Export emits raw enum values and includes the `Product` column. A display-label change does not alter export values.
- A `District` label change would leave the CSV header as `City` unless export headers are updated. That is an unresolved compatibility decision; do not change export silently.
- The same applies to `Requirement` vs `Latest Requirement` in exports.

## 11. Testing plan

### 11.1 Unit / domain tests

- `leadProgressRequestSchema`: action/response pairing, conditional interest, schedule date required, date/time rejection when scheduling is off.
- `createLeadRequestSchema`: mandatory initial activity, email/phone requirement, phone length, optional fields.
- Follow-up helper: single active task, selection validity, stale task rejection.
- Label maps: every enum value has a label; no duplicate or missing keys.
- Display-label changes: snapshot or explicit assertions for status/priority/category/action/response/interest.

### 11.2 PostgreSQL integration tests

Use `LEADBRIDGE_TEST_DATABASE_URL`; tests skip without it.

- Create lead with initial interaction: lead + `SYSTEM/CREATED` + one `INTERACTION` + optional follow-up commit atomically.
- Record Progress: interaction + optional classification + optional completion + optional scheduling in one transaction.
- One-active invariant:
  - Scheduling a second task auto-completes the first.
  - `PENDING` count for the lead is exactly 1 after commit.
  - Old task keeps its row, `completedAt`, and `FOLLOW_UP_COMPLETED` entry.
  - New task is `PENDING`.
- Concurrency:
  - Two simultaneous scheduling requests; one succeeds, the other gets 409 or a no-op; never two pending rows.
  - Two simultaneous completions; exactly one succeeds; the other gets 409.
- Activity:
  - Auto-completion entry has `autoCompleted: true`, `completionReason`, `supersededByFollowUpId`, and the correct `actorId`.
  - The timeline order is interaction → auto-completed prior task → new scheduled task.
- Recalculation:
  - `nextFollowUpAt` is the earliest pending due date.
  - `lastFollowUpAt` is the latest completed `completedAt`.
- Cancellation:
  - Soft cancel preserves the row and `FOLLOW_UP_CANCELLED` entry; `followUpId` remains linked.
- No-op:
  - Submitting unchanged classification values does not update the lead or write `UPDATED`/`STATUS_CHANGED`.

### 11.3 Source/component wiring tests

The repository has no browser harness. Existing tests assert source patterns (e.g., `record-progress-accordion.test.ts`, `record-progress-follow-ups.test.ts`). Add or update source assertions for:

- Record Progress no longer imports/uses `AccordionSection`.
- Two-column container exists.
- “Customer Interaction” and “Update Lead Classification” are in the left column.
- “Manage Follow-ups” is in the right column.
- Create Lead no longer uses accordions and renders District/State/Category/Lead Source on the left, Status/Priority/Latest Requirement/initial interaction on the right.
- No `City` label remains in the manual create form if the label-only rename is approved.

These tests are brittle but consistent with the repository’s current approach. Prefer extracting layout data into a plain module if the assertions become too string-dependent.

### 11.4 Manual QA

- Keyboard-only: focus trap, Escape, field order, error focus, sticky footer.
- Screen reader: dialog name, section headings, field labels, error announcements.
- Small viewport: single-column collapse; no horizontal scrolling.
- Long values: long lead name, long notes, many categories, many pending tasks (should be at most one after the invariant).
- Tasks entry point: stale task warning when the task is no longer pending.
- Admin vs Sales: permissions and assignment behavior.
- Export: unchanged CSV headers/values for existing fields.

### 11.5 Commands

```bash
pnpm typecheck
pnpm lint
pnpm test            # if configured; otherwise run the relevant node tests
```

Database-backed tests require a separate test database and must never point at development/production.

## 12. Implementation sequence

Phase 1 (this document) is complete. Recommended later phases:

### Phase 2 — Contract tests and schema decision

1. Freeze the decisions in §13.
2. Add failing tests for the one-active invariant, auto-completion, soft cancel, and event metadata.
3. Decide District/Latest Requirement label vs field migration.
4. Decide whether `cancelledAt` is needed.
5. Confirm whether the one-active rule applies to all scheduling entry points or only Record Progress.

### Phase 3 — Service and database invariant

1. Add the partial unique index migration.
2. Add lead-row locking in scheduling transactions.
3. Implement `completeActiveForSupersession()` or equivalent in `FollowUpService`.
4. Wire auto-completion into:
   - `LeadWorkflowService.recordLeadProgress()`.
   - `LeadService.createInTransaction()` (no prior task on a new lead, but centralize).
   - `FollowUpService.create()` / `createScheduled()`.
   - `FollowUpService.complete()` when `nextFollowUp` is supplied.
5. Map `P2002`/`23505` to 409.
6. Change delete to soft cancel (if approved).
7. Add/update recalculation and activity event metadata.
8. Run PostgreSQL integration tests.

### Phase 4 — API compatibility

1. Keep existing request keys.
2. Return additive `completedPreviousFollowUp` or equivalent.
3. Document the changed `DELETE` semantics.
4. Update `docs/api.md`, `docs/backend.md`, `docs/database.md`, and `docs/frontend.md`.
5. Verify legacy clients: create lead, record progress, complete with `{}`, standalone schedule.

### Phase 5 — UI layouts

1. Record Progress: full-viewport two-column shell, remove accordions, single current-follow-up card, auto-completion notice, save summary.
2. Create Lead: flat two-column form, District label, Latest Requirement label, Category/Lead Source left, Status/Priority right, initial interaction right.
3. Update accessibility and keyboard behavior.
4. Update source-wiring tests.
5. Manual QA against design references (once available).

### Phase 6 — Documentation and verification

1. Update canonical docs and mark experimental status.
2. Run `pnpm typecheck` and `pnpm lint`.
3. Run the test suite and database-backed tests.
4. Confirm export output is unchanged.
5. Final worktree review.

## 13. Unresolved decisions

1. **Screenshots.** No design references were available. What exact visual layout, spacing, and column widths are expected?
2. **District semantics.** Is “District” a new label for the existing `city` field, a new field, or a replacement? Does the CSV export header change? Does history say “District” or “City”?
3. **Latest Requirement semantics.** Is this the existing `requirement` field with a new label, or a time-stamped requirement history? If history, which model stores it?
4. **One-active definition.** Does a pending task with no due date count as active? (Recommended: yes.)
5. **Auto-completion scope.** Should scheduling a new task auto-complete the prior task in every entry point (Create Lead, Record Progress, Workspace schedule-only, legacy complete-with-next), or only Record Progress?
6. **Explicit completion UX.** Should Record Progress allow “complete the current task without scheduling a new one” as a first-class option? (Recommended: yes.)
7. **Auto-completion audit.** Should the automatic completion be grouped into the interaction event when triggered by Record Progress, or always emitted as a separate `FOLLOW_UP` event? (Recommended: group into the interaction event.)
8. **Cancellation.** Should `DELETE` become soft cancel? Is `cancelledAt` required? What happens to existing hard-deleted history?
9. **Task assignment.** New tasks use `lead.assignedUserId ?? actor.id` in Record Progress, but the standalone completion path uses the actor. Which rule is canonical for Admin actions?
10. **Past dates and time zones.** Are past due dates allowed? Is date-only stored as UTC midnight (current behavior)? What is the business time zone?
11. **Product field.** Should Product remain absent from Create Lead, or return as an optional field? Export compatibility currently includes it.
12. **Assigned To placement.** In the proposed Create Lead two-column layout, where does the Admin-only Assigned To field go? Left column, right column, or below?
13. **Lead creation privilege.** Should JUNIOR Sales be able to create leads, or does `CREATE_LEAD` remain SENIOR-only?
14. **Multiple pending rows in legacy data.** Current data has none, but what is the migration policy if a future environment has conflicts? Stop and report, or deterministically complete all but one?
15. **Enum labels.** Are plain-language label changes approved? They affect dashboards, tables, filters, and history but not raw exports.
16. **Create Lead vs Edit Lead parity.** Should Edit Lead also adopt the two-column layout and District/Latest Requirement labels, or only Create Lead?

## 14. Verification and worktree status

### 14.1 Verification for Phase 1

Phase 1 changes one documentation file only. Application typecheck/lint/tests are not required to validate a Markdown-only change, but the final completion report should still record the commands run and their status.

- `git status --porcelain` before writing: empty.
- New file: `docs/experiments/25_LEAD_WORKFLOW_REDESIGN_AUDIT.md`.
- No application source, Prisma schema, migration, package, export, or UI file was modified.
- Read-only database queries were used; no rows were changed.

### 14.2 Files changed

| File | Change |
|---|---|
| `docs/experiments/25_LEAD_WORKFLOW_REDESIGN_AUDIT.md` | New Phase 1 audit/contract document. |

### 14.3 Out of scope / not changed

- No implementation of the proposed layouts.
- No changes to `RecordProgressModal`, `LeadEditModal`, `LeadDetailsModal`, or `ActivityFormFields`.
- No changes to `LeadWorkflowService`, `LeadService`, `FollowUpService`, or API routes.
- No Prisma schema or migration changes.
- No changes to export functionality or CSV output.
- No enum renames or data backfills.
- No changes to existing staged/modified/untracked work (none existed).

## Appendix A — Live database snapshot used in this audit

Read-only queries against `neondb` on 2026-11-09:

| Metric | Value |
|---|---|
| Leads | 115 |
| Follow-ups | 8 |
| Follow-up `PENDING` | 2 |
| Follow-up `COMPLETED` | 6 |
| Follow-up `CANCELLED` | 0 |
| Leads with more than one pending follow-up | 0 |
| `LeadStatus` rows | NEW 59, CONVERTED 16, LOST 13, SPAM 5, ON_HOLD 22 |
| `LeadPriority` rows | LOW 24, MEDIUM 56, HIGH 26, URGENT 9 |
| `LeadCategory` rows | 17 values, counts 2–8 each; 20 null |
| `ActivityEvent` rows | INTERACTION 10, FOLLOW_UP 6, NOTE 1, SYSTEM 41 |
| `ActivityEntry` rows | CREATED 37, UPDATED 4, NOTE_ADDED 3, FOLLOW_UP_SCHEDULED 8, FOLLOW_UP_COMPLETED 6, CALL 4, WHATSAPP 6 |
| Interaction entries by action | CALL 4, WHATSAPP 6 |
| Interaction entries by response | PICKED_UP 2, NO_RESPONSE 5, REPLIED 3, INVALID_NUMBER 0 |
| Interaction entries by interest | INTERESTED 4, NOT_INTERESTED 1 |
| Follow-up priority rows | MEDIUM 8; all others 0 |

These counts are a point-in-time snapshot and must be re-checked before any migration.

## Appendix B — Key source references

| Subject | File / lines |
|---|---|
| Record Progress modal shell | `src/components/leads/record-progress-modal.tsx:258-260` |
| Record Progress accordions | `src/components/leads/record-progress-modal.tsx:100-104, 268-411` |
| Record Progress submit payload | `src/components/leads/record-progress-modal.tsx:175-252` |
| Record Progress transaction | `src/services/lead-workflow.service.ts:81-199` |
| Create Lead accordions | `src/components/leads/lead-edit-modal.tsx:83-87, 402-438` |
| Create Lead fields | `src/components/leads/lead-edit-modal.tsx:245-354` |
| Create Lead transaction | `src/services/lead.service.ts:387-472` |
| Follow-up create (no limit) | `src/services/follow-up.service.ts:106-164` |
| Follow-up completion transition | `src/services/follow-up.service.ts:343-374` |
| Follow-up delete (hard delete) | `src/services/follow-up.service.ts:480-516` |
| Denormalized recalculation | `src/services/follow-up.service.ts:33-74` |
| Interaction validation | `src/lib/validation.ts:128-176` |
| Create Lead schema | `src/lib/validation.ts:203-211` |
| Lead labels | `src/lib/lead-constants.ts:1-50` |
| Activity labels | `src/lib/activity-options.ts:1-34` |
| Follow-up model | `prisma/schema.prisma:394-418` |
| Lead model | `prisma/schema.prisma:259-338` |
| Activity models | `prisma/schema.prisma:340-373` |
| Historical enum migration | `prisma/migrations/20260718091500_simplify_enums_consistency/migration.sql` |
