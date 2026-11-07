# LeadBridge V1.0 — Lead Workflow and Modal Architecture Audit

> **Status:** Experimental investigation; implementation inspected 2026-11-06.  
> **Scope:** Admin and Sales lead-management UI, related API routes, services, validation, and Prisma model relationships.  
> **Change boundary:** This report records observed behavior and recommendations only. No application code, schema, endpoint, or behavior was changed for this audit.

## 1. Executive summary

The current lead workflow has one shared create/edit form, a shared lead-details modal, and a set of nested Sales interaction dialogs. The application has sound domain distinctions between a lead, an interaction history (`ActivityEvent`/`ActivityEntry`), a standalone note, and a follow-up task. Several UI paths nevertheless collect the same kinds of data and create the same records through separate implementations.

The clearest duplicated outcomes are:

- **Activity plus follow-up:** the Log Activity form can schedule a follow-up; the Schedule Follow-up dialog can optionally log an activity; and lead creation can optionally record an initial activity and schedule its follow-up.
- **Follow-up completion plus outcome:** completing from lead details can record an outcome, an interaction, and a next follow-up in one transaction. The Tasks table’s Complete action only completes the task with an empty body.
- **Notes:** activity notes are stored on activity entries; completion notes are written into a follow-up’s description and an activity entry; a separate `Note` entity supports structured notes and an optional related follow-up. No add-note or note-list UI is present in the inspected lead detail component, even though the details API loads notes.
- **Lead editing:** the shared `LeadEditModal` edits core lead attributes, while the details header also has inline status/priority/category controls that save through the same lead PATCH endpoint.

The highest-confidence architectural concern is **UI/application integration consistency**, not the core database model. The same shared details UI is used on Admin and Sales surfaces, but its activity actions are not consistently usable for Admin: activity creation is explicitly restricted to Sales, and activity editing checks that the actor is the lead’s assigned Sales user. Product decisions are also needed about whether an outcome note is an interaction note, a standalone note, or both, and whether completing a task requires an interaction record.

Recommended direction: first organize Sales work around a lead-context action flow and a consistent completion interaction, reusing existing services and preserving the domain model. In parallel, make role-specific capabilities explicit in the shared detail UI/API contract and resolve the inaccessible standalone Note workflow. Consider a new application-layer workflow service only if the cohesive UI still requires multiple non-atomic API calls or duplicated orchestration after these paths are mapped and simplified.

## 2. Complete inventory of lead-related interactions

### 2.1 Surface inventory

The following count treats **a component/interaction contract** as a surface, not every button that can open it. There are **8 distinct workflow surfaces** in the inspected Admin/Sales lead experience: lead create/edit, lead details, log activity, schedule follow-up, complete follow-up, reschedule follow-up, edit activity, and generic confirmation dialogs. Several entry points open the same surface. Inline lead-field editing and table/dashboard shortcuts are included below as additional entry interactions, not counted as modal surfaces. A standalone Note interaction is **not present in the UI**.

| Surface | Implementation | Opened from | Primary operation |
|---|---|---|---|
| Create/Edit Lead modal | `LeadEditModal` in `src/components/leads/lead-edit-modal.tsx` | Admin leads Create Lead / row Edit; Sales Create Lead / lead details Edit | Create or update lead attributes; create mode may include initial interaction and follow-up |
| Lead details modal | `LeadDetailsModal` in `src/components/sales/lead-details-modal.tsx` | Admin and Sales lead table row; Sales dashboard / Attention Center deep link | View history/details, edit lead fields, log activity, schedule/manage follow-ups, archive/delete |
| Log Activity modal | `LogActivityModal` in `src/components/sales/log-activity-modal.tsx` | Sales table row action; lead details Activity tab | Record call/WhatsApp outcome, notes, optional follow-up |
| Schedule Follow-up modal | private `ScheduleFollowUpModal` in `lead-details-modal.tsx` | Follow-ups column in lead details | Create follow-up; optionally records a new activity |
| Complete Follow-up modal | private `CompleteFollowUpModal` in `lead-details-modal.tsx` | Follow-up list in lead details | Complete task; optionally record activity, completion note, and next task |
| Reschedule Follow-up modal | private `RescheduleModal` in `lead-details-modal.tsx` | Follow-up list in lead details | Change due date/time for a pending task |
| Edit Activity modal | private `EditActivityModal` in `lead-details-modal.tsx` | Activity history entry edit control | Correct an existing CALL/WHATSAPP entry |
| Confirmation dialogs | shared `ConfirmDialog` in `src/components/ui/confirm-dialog.tsx` | Lead archive/delete; follow-up delete; task completion/cancel; Attention Center delete | Confirm destructive or state-transition actions |

Additional relevant surfaces:

- **Inline lead field controls:** `LeadHeader` renders status, priority, and category controls inside lead details and saves them via `PATCH /api/leads/[id]` (`src/components/sales/lead-header.tsx`; save handler in `LeadDetailsModal`). This overlaps the Edit Lead form.
- **Tasks table completion/cancel:** `TasksTableClient` uses `ConfirmDialog`, not the richer lead-details completion form. Completing here submits `{}`; cancelling calls DELETE and labels the action “Mark missed” in the button title (`src/components/sales/tasks-table-client.tsx`).
- **Attention Center cards:** `AttentionCenter` / `AttentionCard` offers Details, and for stale leads only Archive/Delete. Details navigates to `/sales/my-leads?leadId=...`, which opens the same `LeadDetailsModal` through `LeadDetailDialog` (`src/components/sales/attention-center.tsx`, `attention-card.tsx`, `lead-detail-dialog.tsx`). Follow-up cards do not expose complete/reschedule directly.
- **Dashboard agenda:** Sales dashboard agenda rows route to the same lead detail modal (`src/components/sales/sales-dashboard-client.tsx`). Admin dashboard follow-up KPIs route to the Admin leads list; they do not expose a separate follow-up editor (`src/components/admin/admin-dashboard-client.tsx`).
- **Standalone Note UI:** No `Add Note` or `Edit Note` component/control was found under `src/components`. `GET/POST /api/leads/[id]/notes`, `PATCH/DELETE /api/notes/[id]`, `NoteService`, and note data in the lead-details response exist. `useLeadDetails` loads the note array but the detail component does not render or act on `data.notes`.
- **Other lead record controls:** Admin table has archive/restore/delete; Sales table has permission-gated archive/delete; the detail modal has archive/restore/delete; the attention cards also archive/delete stale leads. These invoke the same lead endpoints from multiple parents.
- **Lead Source Manager modal:** `src/components/leads/lead-source-manager-modal.tsx` manages source taxonomy, not a lead record or interaction; excluded from the workflow-surface count, but Admin opens it beside the lead table.

### 2.2 Form fields and submission behavior

| Interaction | Collected data and requirements | After submit |
|---|---|---|
| Create Lead | Name (min 2 chars) required. Email and phone individually optional, but at least one is required on create. Company, city, state, product, requirement, status, priority, category, source optional. Admin variant also shows assignment. Create-only optional initial activity has action, action-specific response, conditional interest, notes, optional follow-up date (required if scheduled) and time. | POST `/api/leads`; closes, router refreshes. Service transaction creates Lead and CREATED system event; optional initial interaction and follow-up are created in same transaction. Duplicate is 409. |
| Edit Lead | Same visible basic fields; name is validated by partial lead schema on edit, contact requirement is create-only. Source and assignment controls depend on props; Sales edit from details omits assignment options. Initial activity is hidden in edit mode. | PATCH `/api/leads/[id]`; closes and refreshes. Service updates Lead and creates a SYSTEM `UPDATED` or `STATUS_CHANGED` event. |
| Log Activity | CALL/WHATSAPP; response choices depend on action; interest required only for successful response (`PICKED_UP`/`REPLIED`); optional notes; optional schedule checkbox, date required when enabled, time optional. | POST `/api/leads/[id]/activities`; closes/refreshes. Transaction creates interaction event and optional follow-up plus grouped schedule entry. |
| Schedule Follow-up | Date required, time optional. Optional “Also log activity” reveals action, response, conditional interest, notes; those fields become required as appropriate. No title/priority/assignee fields. | If activity selected, calls activities endpoint (activity plus follow-up). Otherwise POST follow-ups with title “Follow-up”. Both are one server-side transaction in their respective paths. |
| Complete Follow-up (details) | Optional completion note; optional activity with action/response/conditional interest/activity notes; optional next date/time (client permits checkbox on without date; service only creates when date exists). | POST `/api/follow-ups/[id]/complete`; transaction marks task completed, optionally records activity and note entry, optionally creates next follow-up, writes grouped event, recalculates lead follow-up fields. |
| Complete Follow-up (Tasks table) | Confirmation only; no outcome/activity/note/next-task fields. | Same endpoint with `{}`. Transaction only records task completion and lifecycle event, recalculates fields. |
| Reschedule | Due date required; time optional. Existing date/time are prefilled. | PATCH `/api/follow-ups/[id]`; pending date changes route to service `reschedule`, which writes a lifecycle event and recalculates denormalized lead dates. |
| Edit Activity | Action, response, conditional interest, notes. Only CALL/WHATSAPP entries have edit controls. | PATCH `/api/activities/[id]`; direct ActivityEntry update; does not append an edit event or update parent event timestamp. |
| Add Note (API only) | Structured `whatIDid`, `whatCustomerSaid`, optional `content`; optional follow-up schedule and date/time. Date required if schedule enabled. There is no UI form. | POST notes endpoint; transaction creates Note, optionally creates linked FollowUp, creates NOTE event with NOTE_ADDED and optional FOLLOW_UP_SCHEDULED entries, recalculates lead dates. |
| Confirm archive/delete/cancel/complete | No business fields beyond confirmation. | Calls lead PATCH/DELETE, follow-up DELETE, or completion endpoint. Service/event implications vary by operation (see traces). |

## 3. Workflow responsibility matrix

| Interaction | Business purpose | Data collected | Database entities affected | API/service | Other overlapping workflows | Role |
|---|---|---|---|---|---|---|
| Create lead | Register prospect and classify/assign it | Lead identity/contact, classification, source, optional assignee | `Lead`, `ActivityEvent`, `ActivityEntry`; optionally `FollowUp` | `POST /api/leads` → `leadService.create` → `activityEventService.createEvent`; optional `followUpService.create` | Initial activity and follow-up can be included; alternatively created later in Log Activity/Schedule Follow-up | Admin; Sales only with CREATE_LEAD privilege (Senior in `permissions.ts`) |
| Create lead with initial interaction | Record first outreach alongside new lead | Lead fields plus action, response, interest, note, optional follow-up date/time | `Lead`, two `ActivityEvent`s (CREATED system and INTERACTION), entries, optional `FollowUp` | Same POST → `leadService.create` | Same end-state can be reached by creating lead, then logging activity and scheduling follow-up in separate dialogs | Admin/Sales with create permission; no UI role-specific initial activity fields |
| Edit lead | Correct/update lead record | Name, company, email, phone, city/state, product/requirement, status/priority/category/source; Admin assignment | `Lead`, `ActivityEvent`, `ActivityEntry` | `PATCH /api/leads/[id]` → `leadService.update` | Inline status/priority/category in details uses same PATCH; assignment is separate API route | Admin all leads; Sales assigned leads. Assignment is Admin-only in service |
| Inline lead classification edit | Fast update while viewing details | Status, priority, category | `Lead`, system event/entry | Same lead PATCH → `leadService.update` | Duplicates a subset of Edit Lead | Shared details UI; availability of server authorization depends on lead access |
| Log Activity | Record an attempted/completed customer interaction | Action, result, conditional interest, notes; optional follow-up | `ActivityEvent`, `ActivityEntry`; optional `FollowUp`, additional entry; updates Lead denormalized dates | `POST /api/leads/[id]/activities`; route transaction calls `followUpService.create(..., tx, false)` and `activityEventService.createEvent` | Initial activity; Schedule Follow-up “Also log activity”; completion activity | Route explicitly allows SALES only; assigned-lead check. UI is also present in shared Admin detail modal, producing an authorization mismatch |
| Edit Activity | Correct recorded interaction fields | Action, response, interest, note | Existing `ActivityEntry` only | `PATCH /api/activities/[id]`; direct Prisma update; `validateActivityOutcomePatch` | None for note-only correction except other note channels | Route allows signed-in role but requires lead assigned to actor; effectively Sales owner only. Shared Admin detail UI shows edit control but Admin fails ownership check |
| Schedule Follow-up only | Create next task without asserting an interaction happened | Date/time; title hardcoded “Follow-up”; service defaults priority; assignee policy | `FollowUp`, `ActivityEvent`/`ActivityEntry`, Lead denormalized fields | `POST /api/leads/[id]/follow-ups` → `followUpService.create` | Schedule modal can instead record activity too; Log Activity also creates a follow-up | Admin and assigned Sales lead access; follow-up assignment resolved by policy |
| Log Activity plus Follow-up | Record interaction and next action atomically | Action, response, interest, notes, date/time | `ActivityEvent`, entries, `FollowUp`, Lead nextFollowUpAt | activities POST; followUp service inside transaction | Also available from lead create, Schedule Follow-up, and completion with activity + next follow-up | Sales only through standalone activity route; create flow per create permission |
| Add Note plus Follow-up | Persist structured note and optionally relate a task to it | What I did, customer said, content, due date/time | `Note`, linked `FollowUp` (`noteId`), `ActivityEvent`/entries, Lead dates | notes POST → `noteService.create` | Similar free text is accepted by Log Activity and Complete Follow-up, but those do not create `Note` | Admin and assigned Sales by service access. No UI entry point found |
| Complete Follow-up with outcome | Close scheduled work and capture actual contact outcome/next action | Optional completion note, optional interaction, optional next date/time | `FollowUp` updated; `ActivityEvent`/entries; optional new `FollowUp`; Lead dates | completion POST → `followUpService.complete` | Tasks table offers completion without outcome. Log Activity can be done separately before/after completion | Admin and assigned Sales; service checks lead access; route allows authenticated roles |
| Complete Follow-up from Tasks | Close task | Confirmation only | `FollowUp`, `ActivityEvent`/entry, Lead dates | Same complete endpoint with empty payload | Overlaps richer completion UI but omits outcome, notes, and next task | Admin; Sales tasks scoped by follow-up assignment/creation and lead assignment |
| Reschedule Follow-up | Change pending task date/time | Date/time only | `FollowUp`, `ActivityEvent`/entry, Lead denormalized dates | PATCH follow-ups → route dispatch to `followUpService.reschedule` | FollowUp update API can also change title/description/priority/assignee; details UI exposes only rescheduling | Admin/assigned Sales; service limits reschedule to pending |
| Delete Follow-up (details) | Remove task; pending deletion records cancellation history | Confirmation only | Pending: event/entry then hard-deleted `FollowUp`; Lead denormalized dates | DELETE follow-ups → `followUpService.remove` | Tasks table uses DELETE as “Mark missed”/cancel flow; vocabulary differs | Creator or Admin, and lead access required |
| Cancel Follow-up (Tasks table) | Cancel/miss task | Confirmation only | Same as above | Same DELETE endpoint/service | Same underlying operation as details “Delete follow-up?” but different labels and contextual framing | Creator or Admin; Sales list scope applied on listing |
| Archive/Delete Lead | Remove from active work or delete record | Confirmation only | Lead update or hard delete plus cascade effects | PATCH/DELETE `/api/leads/[id]` → `leadService.update/remove` | Repeated from Admin table, Sales table, details modal, Attention Center | Permission gated for archive/delete; Junior Sales lacks both; Admin/Senior can |

## 4. Detailed workflow traces

### 4.1 Create and edit lead

**Create path:** Admin `AdminLeadsPageContent.openCreate` or Sales `SalesMyLeadsPageContent` opens `LeadEditModal`. The same component switches modes based on the optional `lead` prop. It builds a payload and runs `createLeadRequestSchema.safeParse` (create) or `leadSchema.partial().safeParse` (edit) before sending Axios. The API validates again (`createLeadRequestSchema` in `src/app/api/leads/route.ts`; partial `leadSchema` in `src/app/api/leads/[id]/route.ts`). `POST` additionally requires `Permission.CREATE_LEAD`; `PATCH` uses authenticated access and `leadService.update` verifies lead ownership/access and Admin-only assignment.

`leadService.create` checks permission, assignment, connector/source duplicate keys and potential duplicates, then runs one Prisma transaction. It inserts `Lead`; inserts a `SYSTEM` ActivityEvent with `CREATED`; if initial activity exists, it can create a FollowUp through `followUpService.create` using the same transaction and `recordLifecycleEvent=false`, then writes one `INTERACTION` event containing the interaction and optional `FOLLOW_UP_SCHEDULED` entries. Thus the UI’s “Initial Activity” is not a separate lead-create service or API; it is an optional child operation in the lead create transaction. The service returns the lead and affected user ids. `mutateAndInvalidate` invalidates dashboard/attention aggregates, and the component closes and refreshes the route.

**Edit path:** The form exposes a subset of Lead fields in both roles. Admin passes source and assignable-user data from `AdminLeadsPageContent`; Sales does not pass assignable users in its create/edit calls. On update, the component sends `PATCH /api/leads/[id]`. The service transaction updates `Lead` and writes a system history event. A status change is represented as `STATUS_CHANGED`; other edits as `UPDATED`. Setting `nextFollowUpAt` directly creates an additional system `UPDATED` entry, but does not create a `FollowUp` record. That is a separate legacy-shaped field path from the task workflow; the lead edit UI does not expose it.

**Overlap:** In details, `LeadHeader` also edits status, priority, and category inline through the same PATCH endpoint. The larger Edit Lead form includes those same fields, so the UI offers two edit locations for a subset of lead data. Create mode has extra initial-contact responsibilities unavailable in edit mode; this is convenient but couples lead creation with interaction data entry.

### 4.2 Log an interaction

`LogActivityModal` is opened from the Sales table’s row action or the History tab in `LeadDetailsModal`. `ActivityFormFields` supplies the common visible fields. `interactionActivitySchema` is checked in the client and again by `POST /api/leads/[id]/activities`. The route explicitly allows `SALES`; it checks the lead is assigned to the session user. The route opens a Prisma transaction, optionally calls `followUpService.create` with lifecycle event recording disabled, then creates one `INTERACTION` event with a CALL/WHATSAPP entry and, if requested, a linked schedule entry. The activity note is stored in `ActivityEntry.message` and JSON metadata, not a `Note` row. The follow-up is assigned to the acting Sales user. The endpoint invalidates aggregate cache tags; successful Axios mutations are also broadcast cross-tab through `src/lib/crm-sync.ts`; the modal refreshes its detail data and closes.

### 4.3 Schedule follow-up

The private `ScheduleFollowUpModal` in `lead-details-modal.tsx` can schedule a task alone or offer a second activity form inline. In task-only mode it calls `POST /api/leads/[id]/follow-ups`; `followUpService.create` writes a `FollowUp`, a FOLLOW_UP event/entry when there is a due date, and recalculates `Lead.nextFollowUpAt`/`lastFollowUpAt` (inside a supplied transaction where applicable). In “Also log activity” mode it instead calls the activities endpoint, which creates a differently titled follow-up (`Call follow-up` or `WhatsApp follow-up`) and the interaction in one transaction.

There is a meaningful label and payload difference: Schedule Follow-up mode creates title “Follow-up” with no description, while activity-driven scheduling creates action-specific title and copies activity notes into the follow-up description. `FollowUp` priority defaults to MEDIUM and assignee resolves in service policy. The dialog does not expose task title, description, priority, or assignee.

### 4.4 Complete, reschedule, and delete follow-up

**Complete from details:** `CompleteFollowUpModal` posts the optional note, optional activity, and optional next date/time to `/api/follow-ups/[id]/complete`. `followUpService.complete` checks the task is pending, then uses a transaction and conditional `updateMany` to prevent duplicate completion. It writes completion timestamp/status; if supplied, the note is copied into `FollowUp.description` and emitted as a `NOTE_ADDED` entry tagged `completion_note`; optional activity is another entry; optional next task is created through `followUpService.create` without a second lifecycle event; one grouped FOLLOW_UP event captures the entries. It recalculates Lead follow-up denormalized dates unless the new task creation already recalculates. The modal refreshes detail data.

**Complete from Tasks:** `TasksTableClient` opens a generic confirmation and posts `{}` to the same API. It uses the same transaction and creates completion history, but provides no place to record what happened, an interaction, a completion note, or the next action. The task is labeled “Task completed” on success.

**Reschedule:** Details’ `RescheduleModal` sends only due date/time. The PATCH route dispatches to `followUpService.reschedule` when dueDate is truthy; the service only permits PENDING, updates the task and writes a `FOLLOW_UP_RESCHEDULED` entry with old/new date/time metadata in a transaction, then recalculates lead fields. The generic follow-up update path supports title, description, priority, assignment and date fields, but those broader edits are not exposed in this dialog. A null dueDate falls through to generic update and does not create a reschedule event.

**Cancel/delete:** In details the UI calls this “Delete follow-up?”; Tasks table calls DELETE “Mark missed” and describes the result as cancellation. `followUpService.remove` restricts deletion to the creator or Admin. For pending tasks it creates a `FOLLOW_UP_CANCELLED` historical entry, then hard-deletes the task and recalculates denormalized lead dates in one transaction. The event’s `ActivityEntry.followUpId` uses `onDelete: SetNull`, so history remains but its task relation becomes null. Completed/cancelled tasks can be hard-deleted without a new cancellation entry.

### 4.5 Edit activity

`DailyHistory` renders edit controls only for entries with type `CALL` (the logic checks `entry.type === "CALL"`, while WhatsApp entries are not given the same button). Clicking resolves the parent event, then `EditActivityModal` edits the matching action-bearing entry. The modal has local field checks, but the API is authoritative: `PATCH /api/activities/[id]` validates a Zod object and `validateActivityOutcomePatch` against the complete resulting response state. It allows only CALL/WHATSAPP entries and checks that the lead is assigned to the current actor. It updates the existing `ActivityEntry` directly with Prisma; it does not call a service, create an audit/correction ActivityEvent, or update the event’s `occurredAt`. `invalidateAfterMutation` runs; Axios response interception broadcasts activity mutation cross-tab.

**Mismatch:** the UI appears in shared Admin lead details, but the server ownership predicate `assignedUserId: session.user.id` means an Admin user is not authorized to edit a Sales-owned lead’s activity through this route. This is confirmed by route/service predicates, though no runtime request was executed as part of the investigation.

### 4.6 Standalone Note

The Note API and service are implemented but no corresponding lead UI was found. `noteService.create` runs a transaction that creates a structured `Note`, optionally creates a FollowUp linked by `noteId`, recalculates the lead’s follow-up fields, and creates a NOTE event/entries. `noteService.update` updates Note content and writes a NOTE_EDITED event with old/new content metadata; `remove` hard-deletes the note in a transaction but does not write a deletion event. Sales can only access assigned leads; Admin can access all. Non-admin editing/deletion is restricted to the note author and the creation day; Admin can edit/delete any accessible note.

The details endpoint returns `notes`, and `useLeadDetails` types and stores them, but current `LeadDetailsModal` only reads `lead`, `activityEvents`, and `followUps`. Consequently notes can exist and appear indirectly in activity history but cannot be inspected/created/edited as standalone Notes through the audited UI. This is a code-path finding, not an assumption about undocumented routes or external callers.

## 5. Database and domain model relationships

The source of truth is `prisma/schema.prisma` (models at approximately lines 259–418):

- **Lead:** current CRM prospect record: identity, contact, classification, source, assignment, lifecycle status, archive/delete flags, and denormalized `nextFollowUpAt`/`lastFollowUpAt`. It owns many ActivityEvents, Notes, and FollowUps.
- **ActivityEvent:** a timestamped, actor-attributed group of history entries associated with one Lead. Event types distinguish INTERACTION, FOLLOW_UP, NOTE, and SYSTEM. It is the grouping/timeline record, not the individual call or note data itself.
- **ActivityEntry:** the specific fact or lifecycle action in an event: CALL/WHATSAPP outcome, lead-created/updated/status-changed, note-added/edited, follow-up scheduled/rescheduled/completed/cancelled, etc. It may carry action, response, interest, message, metadata, and nullable `followUpId`. Multiple entries can deliberately share one event (notably completion with result and next action). Entries cascade with their event; follow-up deletion nulls the reference.
- **Note:** standalone user-authored narrative record with structured `whatIDid` and `whatCustomerSaid`, a required Lead and author, edit timestamp, visibility/pin fields, and optional related FollowUps. It is independently editable and historically distinct from an activity entry’s free-text message.
- **FollowUp:** actionable task with title/description, due date/time, priority/status, Lead, optional Note relation, assignee, creator, and completion time. It can be related to a Note through `noteId` and to history entries through ActivityEntry.followUpId. Lead date denormalization is derived from pending and completed tasks.

**Information vs history:** Lead, Note, and FollowUp hold current business records. ActivityEvent/Entry hold the timeline/audit-like account of what happened. This separation is intentional and useful: a mutable task can have immutable lifecycle events; a Note can be edited while note-added/edited events remain; multiple facts about one interaction/completion can be grouped under a single event. The current Edit Activity exception directly mutates an entry, so that specific correction does not preserve an edit-history entry.

**Transactional multi-record operations:**

1. Lead creation + CREATED history + optional initial activity + optional follow-up (`leadService.create`).
2. Interaction + optional follow-up + schedule entry (`POST /leads/[id]/activities`).
3. Follow-up completion + optional activity/note/next task + event (`followUpService.complete`).
4. Follow-up reschedule + lifecycle entry + denormalized-field recomputation (`followUpService.reschedule`).
5. Follow-up removal/cancellation event + task delete + recomputation (`followUpService.remove`).
6. Note create + optional linked follow-up + event + recomputation (`noteService.create`).
7. Note update + NOTE_EDITED event (`noteService.update`).
8. Lead edit + system event (`leadService.update`).

**Service boundary note:** `activityEventService` is a persistence helper for creating/listing grouped events, not a complete activity workflow service. The activity POST route owns its transaction and composition; the activity PATCH route has direct Prisma access in the route. Follow-up and Note services own larger transactional workflows. The UI overlap does not imply the database entities should be merged.

## 6. Admin versus Sales comparison

| Area | Admin | Sales |
|---|---|---|
| Lead list | `AdminLeadsPageContent`; create/edit, source management, archive/restore/delete, detail modal | `SalesMyLeadsPageContent`; create gated by `canCreate`, log activity shortcut, detail, permission-gated archive/delete |
| Lead creation | Shared `LeadEditModal`; gets `leadSources` and `assignableUsers`; can assign/unassign | Same component; gets lead sources, no assignable-users prop; service auto-assigns Sales-created leads to actor if no assignee |
| Lead editing | Same fields; assignment visible; service only permits Admin assignment | Same shared form, no assignment field; server access limited to assigned leads |
| Details | Admin table opens same `LeadDetailsModal` used by Sales | Table, query-param deep link, dashboard agenda, Attention Center open same modal |
| Log activity | Shared details UI exposes Log Activity, but `POST /api/leads/[id]/activities` wrapper explicitly allows only SALES | Available from table and details, lead must be assigned to acting Sales user |
| Edit activity | Shared details timeline shows CALL edit control; activity PATCH requires lead assigned to actor, so Admin is rejected for Sales-owned lead | Assigned Sales actor may edit interaction entry; only CALL entry receives edit affordance |
| Follow-ups | Follow-up API/service permits Admin access; detail UI exposes schedule/complete/reschedule/delete | Same UI/actions for assigned lead; task listing applies follow-up assignee/creator and lead scope rules |
| Note API | Admin can access any lead; can edit/delete any note by service policy | Assigned-lead access; only author and same-day notes may be edited/deleted |
| Archive/delete | Admin permission always granted | Senior Sales has CREATE/DELETE/ARCHIVE; Junior has none (`src/lib/permissions.ts`) |
| Assignment | Admin can assign to active Sales user; clear to unassigned | Sales cannot assign another user; lead create service sets owner to self |

Legitimate differences are assignment, scope, elevated lead deletion/archive, and note ownership policy. Unnecessary or inconsistent duplication is primarily at the UI composition level: the same detail component renders role-incompatible activity actions; lead classification is editable both inline and via Edit; and similar activity/follow-up combinations have separate forms and payload paths. There is no duplicated Admin-specific lead form or Zod schema; both roles share `LeadEditModal` and `src/lib/validation.ts` schemas.

## 7. Identified UI complexity and overlapping responsibilities

### A. UI complexity

- A user can reach lead details from tables, Sales dashboard agenda, and Attention Center deep links. The Attention Center itself offers details rather than inline follow-up operations, so users navigate to a full modal to complete/reschedule.
- Lead details can launch separate Log Activity, Schedule Follow-up, Complete Follow-up, Reschedule, Edit Activity, and Edit Lead dialogs. These are layered above an already large details modal. Related work often means opening and closing more than one dialog.
- Tasks table completion is a confirmation-only interaction, while lead details completion is a multi-field workflow. “Complete task” can therefore mean materially different levels of recording depending on entry point.
- “Delete follow-up?” and “Mark missed”/“Cancel Task” represent the same DELETE/cancel behavior with different terms.
- The LeadEditModal create form contains classification, assignment, contact, product/requirement, initial activity, and follow-up scheduling; it is a broad form. This is intentionally useful for intake, but it merges initial outreach with prospect registration.

### B. Responsibility overlap

- Lead create’s optional initial activity, Log Activity, Schedule Follow-up’s optional activity, and Complete Follow-up’s optional activity can all record a CALL/WHATSAPP entry.
- Follow-up scheduling occurs in initial lead creation, Log Activity, Schedule Follow-up, Note creation API, and Complete Follow-up. The resulting tasks differ in title/description/Note linkage based on path.
- Activity text, completion text, and standalone Note content are three different persistence patterns presented to the user with near-identical “Notes”/“Outcome” language. Only the standalone Note is structured and independently accessible as a Note.
- Inline detail header edits status/priority/category that are also in the Edit Lead modal.
- Complete/reschedule/delete can be initiated from follow-up list inside details or task list (completion/cancel only); Attention Center follow-up cards navigate into details first.

### C. Application architecture

- Creation of activity+follow-up is composed independently in `leadService.create`, activities POST, and follow-up completion; schedule modal chooses between two endpoints depending on checkbox. The interactions use similar fields and business result but different title, description, actor/assignee, and event composition.
- Zod validation is generally shared between client and API for lead creation/activity. Some detail-only dialogs use local booleans and native `required` attributes rather than the shared activity schema, so validation rules can drift (e.g. Schedule and Complete follow-up controls implement their own checks).
- `PATCH /api/activities/[id]` directly performs database access and validation in the route. There is no activity update service/domain method; `activityEventService` covers event creation and reading only.
- `LeadDetailsModal` owns extensive state for all nested workflows and direct endpoint mutations. The parent table separately owns create/log activity/archive/delete state, and Attention Center separately owns archive/delete. `LeadEditModal` is reused, but the orchestration/state is not centralized.
- API UX consistency varies: some callers use toasts and `router.refresh`, some refresh the detail hook, and some use the cross-tab Axios mutation interceptor. The common `useCrmSync` and `crm-sync.ts` provide BroadcastChannel/localStorage synchronization and visibility/focus refresh with a 30-second cooldown. Lead detail data is not cached; aggregate dashboard/attention tags are invalidated by routes.

### D. Data model and workflow concerns

- The distinct models have distinct current purposes; UI overlap is not evidence to merge them.
- FollowUp completion note is copied to `FollowUp.description` (overwriting the previous task description when provided) and also recorded as `NOTE_ADDED` event text. If an activity is also submitted, a separate activity-notes string may capture similar information. This can cause duplication or diverging prose, depending on user input.
- Activity notes are stored in an entry message and metadata; standalone Note creation is not used by Log Activity or Complete Follow-up. Thus those pathways do not produce `Note` rows or structured what-I-did/customer-said values.
- Direct edits to ActivityEntry do not create correction history. This may be a deliberate edit policy, but it is less auditable than service operations that append NOTE_EDITED or follow-up lifecycle entries.
- `followUpService.create` recalculates lead fields if dueDate exists. Some callers pass the transaction client, others call it without an enclosing transaction (the follow-up POST invokes create with default Prisma client); the basic create path performs a sequence of writes but is not automatically wrapped in a service-owned transaction. This is an integrity risk for the FollowUp/event/denormalized date combination if an intermediate write fails. By contrast, the activities POST passes `tx`, note create and create lead are transactional, and `createScheduled` is transactional. Confirmed from call signatures and route invocation.
- `FollowUp` status is represented in the task row, while cancellation deletes the row and preserves only an event entry whose FK is nulled. The UI’s “Delete” wording can conceal that status/history behavior.

## 8. Backend/application architecture findings

### API and service map

| Operation | Route | Validation | Service / persistence | Authorization |
|---|---|---|---|---|
| Create lead | `src/app/api/leads/route.ts` POST | `createLeadRequestSchema` | `leadService.create` | `withPermissionAuthorization(CREATE_LEAD)` plus service permission/assignment checks |
| Edit lead/archive | `src/app/api/leads/[id]/route.ts` PATCH | partial `leadSchema` | `leadService.update` | Authenticated; service checks lead scope and archive permission, assignment Admin-only |
| Delete lead | same route DELETE | — | `leadService.remove` | `DELETE_LEAD` permission |
| Lead details read | `src/app/api/leads/[id]/details/route.ts` GET | — | `leadService.getById`, direct note/follow-up reads, `activityEventService.listByLead` | Authenticated; lead scope check occurs via leadService |
| Create activity | `src/app/api/leads/[id]/activities/route.ts` POST | `interactionActivitySchema` | inline Prisma transaction, `followUpService.create`, `activityEventService.createEvent` | SALES role only and assigned lead only |
| Edit activity | `src/app/api/activities/[id]/route.ts` PATCH | local Zod schema + `validateActivityOutcomePatch` | Direct Prisma ActivityEntry update | Signed-in role but assigned lead only; CALL/WHATSAPP entries only |
| Create Note | `src/app/api/leads/[id]/notes/route.ts` POST | `createNoteSchema` | `noteService.create` | Authenticated; service lead access |
| Edit/delete Note | `src/app/api/notes/[id]/route.ts` | `noteSchema` | `noteService.update/remove` | Authenticated; service author/day/Admin rules |
| Create FollowUp | `src/app/api/leads/[id]/follow-ups/route.ts` POST | `followUpSchema` | `followUpService.create` | Authenticated; service lead/assignee checks |
| Update/reschedule/delete FollowUp | `src/app/api/follow-ups/[id]/route.ts` | `followUpUpdateSchema` | update/reschedule/remove | Authenticated; service lead/status/creator rules |
| Complete FollowUp | `src/app/api/follow-ups/[id]/complete/route.ts` POST | local completion Zod object | `followUpService.complete` | Authenticated; service lead ownership and pending-state checks |

### Validation, authorization, refresh

- `src/lib/validation.ts` centralizes `leadSchema`, `createLeadRequestSchema`, `interactionActivitySchema`, `createNoteSchema`, `followUpSchema`, and update schemas. `LeadEditModal` and `LogActivityModal` also call shared schemas on the client. Server routes parse again.
- Authorization is server-enforced via `withApiAuthorization` / `withPermissionAuthorization` and service-level access predicates. LeadService scopes SALES to `assignedUserId`; Note/FollowUp services do the same. Admin access is generally all non-deleted leads.
- Confirmed inconsistency: the shared Admin details modal renders `LogActivityModal`, but activity POST specifies `withApiAuthorization(["SALES"])`. The same modal’s activity edit control calls an endpoint whose lead predicate requires `assignedUserId === session.user.id`. Admin UI entry points are therefore not backed by matching API authorization for those two operations.
- Mutation routes invalidate dashboard and attention cached aggregate tags through `invalidateAfterMutation`/`mutateAndInvalidate`. Detail payloads are uncached. On the client, successful Axios mutations are recognized by `crmMutationFromAxiosResponse` and broadcast to same-origin tabs; `useCrmSync` filters by entity/lead ids and refreshes. Some parent flows also call `router.refresh()` directly. This means ordinary mutation synchronization exists, but callers may perform both local refresh and cross-tab-triggered refresh.

## 9. Proposed simplified workflow

Conceptual Sales workflow:

1. **Open or create a lead.** Keep lead identity/classification separate from whether first contact already happened. If intake truly includes outreach, offer a clearly optional “record first contact” section that uses the same outcome fields and operation semantics as ordinary activity logging.
2. **Record what happened.** In lead context, one concise interaction composer records channel, result, conditional interest, and a single clearly defined note/outcome field. Let the user optionally set a next action in the same context.
3. **Schedule the next action.** A contextual follow-up composer should focus on the task’s date/time and only expose title/assignment/priority when business rules require them. Whether task notes should become a structured Note should be explicit rather than implicit.
4. **Complete a follow-up.** Use the same completion outcome UI wherever completion is initiated (lead details, tasks, future attention surface). Allow “completed without contact” when appropriate; otherwise capture the interaction and optional next action in the same transaction. Make the state change and historical record understandable in the UI.
5. **Review history.** Present Interaction events, standalone Notes, and task lifecycle as distinct record types in one timeline, with contextual edit capabilities and role-correct controls. Avoid representing free text as a standalone Note unless it is actually saved as one.

This is a product workflow proposal, not a commitment to merge the persistence models. Contextual actions inside lead details can reduce dialog transitions while retaining focused panels/drawers or inline sections. The Tasks view can deep-link into the same completion workflow with the relevant follow-up selected.

## 10. Architectural alternatives and trade-offs

### Alternative A — UI composition using existing APIs/services

Keep the database and current API contracts. Consolidate entry points around the lead details context; reuse the same activity fields and validation for log, schedule-with-activity, and initial contact. Route every “complete” entry point to the existing rich completion workflow. Decide whether to expose the existing Note API via a proper UI or remove the UI expectation of standalone Notes in a later scoped change. Align role-aware controls with API capability.

**Benefits:** smallest migration; preserves transactional service behavior where already present; quickest way to test a simpler Sales experience; domain distinctions remain intact.  
**Costs:** orchestration remains split across endpoints; the follow-up-only endpoint has different transaction characteristics from activity completion; the direct activity PATCH remains a route-owned mutation; several payload semantics must be normalized at the UI level.

### Alternative B — Add a cohesive application-layer workflow operation

After product decisions, introduce a service-level workflow operation for a logged interaction with optional next follow-up (and possibly a workflow-specific completion operation), with one authoritative transaction, consistent event grouping, assignee/title policy, and shared validation. UI composers call the cohesive operation. Keep `Lead`, `ActivityEvent`/`ActivityEntry`, `Note`, and `FollowUp` as distinct records.

**Benefits:** aligns server transaction boundary and business orchestration with the Sales job; reduces duplicated composition across create, activity, and completion; provides one place for policies and cross-record consistency.  
**Costs:** requires API contract and service migration; needs clear policy for whether notes become Note records, how tasks inherit descriptions/assignees, whether activity is optional at completion, and how existing clients/integrations keep working; migration and compatibility burden is materially higher.

### Alternative C — Keep operation dialogs separate, improve navigation and affordances

Retain one dialog per domain operation but add contextual launch points, consistent labels, deep-link selection in Tasks/Attention Center, and remove mismatched controls. Keep service contracts unchanged.

**Benefits:** lowest backend risk; preserves operation-specific focus; can solve role mismatch and terminology quickly.  
**Costs:** leaves repeated data entry and the separate implementations of the same activity+follow-up outcome; modal count and state orchestration remain high.

## 11. Recommended direction

Proceed in two stages:

1. **Product/UI consolidation on current domain services (Alternative A, with selected C fixes):** define one Sales vocabulary for interaction note vs standalone note vs follow-up description; expose a single completion experience from all entry points; favor lead-context actions; decide whether Notes are a supported user-facing record and expose the existing Note flow consistently if so. Align Admin detail controls to actual authorized capabilities or deliberately add Admin service permissions before exposing them.
2. **Reassess a workflow service (Alternative B) from the resulting interaction spec:** if the desired “record interaction + next step” must be atomic across all contexts and still needs duplicated API orchestration, create a cohesive application service while preserving separate domain entities. Do not merge models based on modal overlap alone.

This ordering avoids redesigning backend boundaries before the product semantics are settled, while addressing the confirmed inconsistent entry-point behavior first.

## 12. Risks, dependencies, and migration considerations

- Decide what users mean by “note” and whether activity/completion notes should also create `Note` rows. Existing data has distinct representations; converting history risks duplication and requires a mapping policy.
- Decide whether task completion requires an interaction, permits a non-contact completion, and/or should require a note. The Tasks table currently completes with no outcome payload.
- Decide task title/description/priority/assignee defaults across standalone schedule, activity-linked schedule, note-linked schedule, and next-follow-up creation. Existing records have path-dependent titles and descriptions.
- Before changing shared detail UI, establish role-specific allowed actions: Admin activity creation/edit behavior currently conflicts with UI affordances; Sales archive/delete depends on privilege; follow-up/note operations use different actor rules.
- If adding service orchestration, preserve transaction atomicity and existing event semantics, then migrate each caller (initial lead creation, Log Activity, Schedule Follow-up, Complete Follow-up, Note API) deliberately. Account for API callers beyond the inspected UI before changing contracts.
- Preserve `recalculateLeadFollowUpFields()` as the source for denormalized dates. Any combined workflow must update it in the same transaction as task changes.
- Keep cache-tag invalidation and cross-tab notification behavior for all mutation paths. Cross-tab synchronization is client-side BroadcastChannel/localStorage observation of successful Axios responses, while server cache invalidation applies to aggregate resources.
- Validate historical timeline expectations for edited activities and deleted/cancelled follow-ups: ActivityEntry edits currently have no correction event; follow-up deletion leaves lifecycle history without a linked follow-up row.
- UI unification should not bypass existing server authorization or rely on hidden/disabled buttons alone.

## 13. Questions that require product decisions

1. Is a standalone structured Note a first-class Sales workflow in V1.0, or is the `Note` model/API currently retained for another consumer?
2. Should a call/WhatsApp outcome note be a separate `Note`, an ActivityEntry message, or allow both with distinct purposes?
3. When completing a follow-up, must the user report an interaction, or should “completed without contact” remain valid? Should a result or note be required?
4. Should every completion surface offer next-follow-up scheduling, and should it be presented as the default next step?
5. Should Admin users be able to create and edit activity history for any lead? The shared Admin detail UI currently implies this, but routes do not consistently authorize it.
6. Does “Delete follow-up” mean cancel and preserve historical context, or truly remove? Which wording should Tasks and details use?
7. Is inline status/priority/category editing desirable alongside the Edit Lead form, or should one be the canonical entry point?
8. Should initial activity be part of lead creation, or should creating a lead remain a short intake operation followed by a suggested first-contact action?
9. What fields should define a follow-up as a task: title, description, priority, and assignee, and which should default from a lead’s owner?

## Verification references

Primary files inspected:

- UI: `src/components/leads/admin-leads-page-content.tsx`, `src/components/leads/lead-edit-modal.tsx`, `src/components/sales/sales-my-leads-page-content.tsx`, `src/components/sales/lead-details-modal.tsx`, `src/components/sales/log-activity-modal.tsx`, `src/components/sales/activity-fields.tsx`, `src/components/sales/daily-history.tsx`, `src/components/sales/lead-detail-dialog.tsx`, `src/components/sales/attention-center.tsx`, `src/components/sales/attention-card.tsx`, `src/components/sales/tasks-table-client.tsx`, `src/components/sales/sales-dashboard-client.tsx`, `src/components/sales/lead-header.tsx`.
- API: `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts`, `src/app/api/leads/[id]/details/route.ts`, `src/app/api/leads/[id]/activities/route.ts`, `src/app/api/activities/[id]/route.ts`, `src/app/api/leads/[id]/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, `src/app/api/leads/[id]/follow-ups/route.ts`, `src/app/api/follow-ups/[id]/route.ts`, `src/app/api/follow-ups/[id]/complete/route.ts`.
- Domain/validation/synchronization: `prisma/schema.prisma`; `src/lib/validation.ts`; `src/lib/permissions.ts`; `src/services/lead.service.ts`; `src/services/activity-event.service.ts`; `src/services/note.service.ts`; `src/services/follow-up.service.ts`; `src/services/follow-up-policy.ts`; `src/lib/cache-tags.ts`; `src/lib/crm-sync.ts`; `src/hooks/use-crm-sync.ts`; `src/hooks/use-lead-details.ts`.

