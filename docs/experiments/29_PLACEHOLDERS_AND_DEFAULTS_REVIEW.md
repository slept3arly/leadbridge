# Phase 11 — Placeholder and Default Value Review

> **Status:** Read-only owner-decision report. No application, schema, data, validation, layout, or workflow changes were made.
> **Evidence:** Current checked-out implementation, including pre-existing worktree changes, cross-checked against Phase 9 audit [28](./28_WORKFLOW_ENUMS_AND_FORM_UX_AUDIT.md). Source code is authoritative where the audit differs.

## 1. Summary

Most text inputs have no placeholder. Dropdowns use a mix of explicit prompts ("Select response") and values such as "None" or no prompt. Create Lead and Record Progress initialize Action to Call, Status to New, and Priority to Medium; Edit Lead starts from the saved record. Follow-up scheduling is opt-in, with blank date/time. The main owner decisions are whether Status and Priority should start unselected and whether those classifications are required. Wording-only improvements are listed separately below.

Approved catalog decisions from the phase brief are respected: Lead Category, Lead Source, and Interaction Action stay as they are; CALL and WhatsApp response catalogs are Picked up, Not picked up, Invalid number, Switched off / Replied, Not replied; `NO_RESPONSE` remains historical only. Priority recommendations use Low, Medium, High, Urgent, Cold as supplied. This report does not propose enum, label, validation, or layout changes.

## 2. Current-state inventory and recommendations

“Required” refers to current UI/validation behavior. Conditional means required only when the controlling interaction or scheduling state applies. Native date/time fields do not expose text placeholders; their empty value is shown as blank.

| Form / field | Current prompt or placeholder; current default | Required? | Recommendation | Reason |
|---|---|---|---|---|
| Create Lead — Name | No placeholder; blank | Yes | Keep blank; optionally use `Full name` | Clarifies the expected name without repeating the field label. Low-risk wording. |
| Create Lead — Company | No placeholder; blank | No | Keep blank; optional example `Company or organization` | Identifies acceptable organization type. |
| Create Lead — City | No placeholder; blank | No | Keep blank; optional example `e.g. Pune` | Example clarifies a city value. Keep distinct from District. |
| Create Lead — District | No placeholder; blank | No | Keep blank; optional example `e.g. Andheri West` | Clarifies district/locality entry; never treat as City. |
| Create Lead — State | No placeholder; blank | No | Keep blank; optional example `e.g. Maharashtra` | Example clarifies expected geographic level. |
| Create Lead — Phone | No placeholder; blank | Optional field; at least one contact method (email or phone) is required by validation | `10-digit phone number` | Signals current expected format without replacing validation feedback. Confirm format wording against intended deployment locale before implementation. |
| Create Lead — Email | No placeholder; blank | Optional field; at least one contact method (email or phone) is required by validation | `name@example.com` | Useful format example; does not imply email is mandatory. |
| Create Lead — Category | Current option `None`; blank default | No | Prompt `Select category (optional)` | Makes optionality explicit while preserving blank. Category catalog unchanged. |
| Create Lead — Lead Source | Current option `None`; blank default | No | Prompt `Select source (optional)` | Distinguishes source from a required classification without altering catalog. |
| Create Lead — Assigned To | Current option `Unassigned`; blank default | No | Keep `Unassigned` | It describes the actual no-assignee state more clearly than a generic prompt. |
| Create Lead — Action | No prompt; defaults to Call | Yes | **Owner decision:** keep Call or add `Select action` with blank default | Preselection can record a call that did not happen. User-approved phase context says Interaction Action remains unchanged; this default recommendation still needs explicit owner decision before any change. |
| Create Lead — Response | `Select response`; blank default | Yes | Keep `Select response` | Explicit and concise required choice. Historical `NO_RESPONSE` is not offered as a new selection. |
| Create Lead — Status | No prompt; defaults to New | Current control is optional in validation | **Owner decision:** keep New or use `Select status` (optional/required status policy also needs decision) | Status meaning/default is expressly undecided; a chosen default can imply a stage the user did not classify. |
| Create Lead — Priority | No prompt; defaults to Medium | Current control is optional in validation | **Owner decision:** keep Medium or use `Select priority` (optional/required policy also needs decision) | Avoids presenting an unchosen triage decision as explicit. If a blank default is approved, use the agreed Low/Medium/High/Urgent/Cold catalog unchanged. |
| Create Lead — Interest | `Select interest`; blank default; only shown after successful response | Yes when shown | Keep `Select interest` | Correctly signals a required conditional choice; changing the binary rule is out of scope. |
| Create Lead — Notes | `Add notes...`; blank | No | `Add a note about the interaction` | More specific and natural; optional free text. |
| Create Lead — Follow-up toggle | `Schedule a new follow-up`; Off | No | Keep Off | Scheduling should remain opt-in; no follow-up should be created accidentally. |
| Create Lead — Follow-up date/time | No placeholder; blank; date required when scheduling enabled, time optional | Conditional | Keep blank; use native date/time controls | A default date/time could create an inaccurate commitment. |
| Edit Lead — Name/contact/location/requirement | No placeholders; populated from saved lead, otherwise blank | Name required; others optional subject to contact-method validation | Same wording recommendations as Create Lead; keep current values populated | Edit should preserve existing record values. City and District remain independent. |
| Edit Lead — Status/Priority | No prompt; existing values populated | Optional | Keep existing saved values. For empty legacy data, apply the owner-approved Create policy | Avoid silently replacing existing classification. |
| Edit Lead — Category/Lead Source | `None` option; existing value or blank | Optional | `No category` / `No source` if clearer in edit context; otherwise `Select … (optional)` | `None` is understandable but less explicit. Catalogs remain unchanged. |
| Edit Lead — Assigned To | `Unassigned`; current assignee or blank | Optional | Keep `Unassigned` | Accurately names the blank state. |
| Edit Lead — initial interaction | Not shown; edit form does not create an initial activity | — | No recommendation | Avoids implying edit should record a new interaction. |
| Record Progress — Action | No prompt; defaults to Call | Yes | Same owner decision as Create Lead; keep interaction catalog unchanged | Prevents a default from inaccurately representing what happened. |
| Record Progress — Response | `Select response`; blank | Yes | Keep `Select response` | Direct required-selection prompt. Historical `NO_RESPONSE` is not a new selection. |
| Record Progress — Status/Priority | No prompt; current lead values (fallback New/Medium if no lead loaded) | Optional | Preserve current lead values; align fallback policy with owner decision for Create Lead | Same meaning should use a consistent policy, without overwriting a loaded lead's values. |
| Record Progress — Interest | `Select interest`; blank; conditional on successful response | Conditional required | Keep `Select interest` | Clear required choice in the relevant branch. |
| Record Progress — Notes | `Add notes...`; blank | No | `Add a note about the interaction` | Clarifies what the note should describe. |
| Record Progress — schedule toggle/date/time | `Schedule a new follow-up`; Off; date/time blank | Date conditional required; time optional | Keep Off and blank fields | Prevents accidental follow-up commitments. |
| Schedule Follow-up — Date / Time | No placeholder; blank | Date required; time optional | Keep blank native controls | Do not infer a due date or time. |
| Reschedule Follow-up — Date / Time | No placeholder; current due date/time prefilled | Date required; time optional | Keep existing schedule prefilled | The existing task is the correct baseline for an edit. |
| Follow-up task title / description | Scheduling creates title `Follow-up`; description absent | Title is system-provided; description optional | Keep current task title; no prompt needed unless a description input is added later | This UI does not ask for a title or description. No new controls recommended. |
| Follow-up priority | Current service default Medium; no scheduling selector | Not user-entered | No UI wording change; owner decision only if this default is revisited | The service currently assigns a value without asking. The approved priority choices do not by themselves authorize changing this behavior. |
| Record Progress — pending follow-up empty state | `No pending follow-up.` | N/A | Keep | Short and clearly scoped to pending work. |
| Sales dashboard — upcoming follow-ups empty state | `No upcoming follow-ups scheduled.` | N/A | Keep | Directly explains the empty list. |
| Attention Center — pending/today follow-ups empty states | `No pending follow-ups.` / `No follow-ups scheduled today.` | N/A | Keep | Clear status/time scope; no default change suggested. |
| Lead search (shared table controls) | `Search leads...`; blank | No | `Search by name, company, email, phone, or lead number` | Tells users what the search covers; avoids repeating only the page concept. |
| Sales lead search | `Search leads...` via shared SearchToolbar default; blank | No | Same search wording as shared table control | Consistency across lead lists. |
| Lead filters — Status/source/action/response/priority/category/interest | `All Statuses`, `All Sources`, `All Actions`, `All Responses`, `All Priorities`, `All Categories`, `All Interests`; all/unfiltered default | No (filters) | Keep; optionally standardize capitalization only | These clearly mean no restriction. They are not field-entry prompts. Catalogs and behavior unchanged. |
| Lead filters — activity/follow-up/owner/archive | `Any Activity`, `Any Follow-up`, `All Salespeople`, `Hide Archived`; current all/unfiltered or hide-archived defaults | No (filters) | Keep current semantics; do not replace with data-entry prompts | Current labels describe filter state. “Hide Archived” is a meaningful default. |
| Admin table sort/date/filter controls | `Sort`, `Date Range`, dynamic filter labels; blank/unselected | No (filters) | Keep; consider concise consistent title case | Empty state means no selected sort/date or filter-specific all-state. |
| Lead source manager — source name | `e.g. Google Ads, Referral, WhatsApp`; blank | Required for adding a source | Replace with `e.g. Referral` pending owner approval of source meaning | Examples currently mix channels and messaging methods, which could imply an unapproved definition of Lead Source. Lead Source itself remains unchanged. |
| Activity editor — action/response/interest/notes | Existing action; response and interest may be blank; `Select response`, `Select interest`, `Add notes...` | Response required; interest required when successful | Keep selection prompts; use recommended interaction note wording | Existing activity values should be preserved; `NO_RESPONSE` may appear only when editing a historical entry. |

## 3. Recommended dropdown wording and default policy

### Low-risk wording recommendations

- Use `Select response` and `Select interest` for blank required dropdowns; retain both existing prompts.
- For optional blank Category and Lead Source on data-entry forms, prefer `Select category (optional)` and `Select source (optional)`. Keep the underlying catalogs unchanged.
- Keep `Unassigned` for optional assignment.
- Keep follow-up scheduling Off, and keep new due date/time blank. Keep an existing due date/time populated during rescheduling.
- Use one shared search prompt: `Search by name, company, email, phone, or lead number`.
- Replace generic note prompt `Add notes...` with `Add a note about the interaction` wherever that field means interaction notes.
- City and District must keep distinct field labels and any examples must represent their respective geographic types.

### Defaults requiring owner approval

| Decision | Current behavior | Recommended decision for approval | Why approval is needed |
|---|---|---|---|
| Create Lead Status | New selected, no prompt; optional in validation; service also defaults to New | Decide whether New is an intentional business default. If not, approve blank `Select status` and whether choosing a status is required. | This is a business classification, and Phase 11 context leaves status/default undecided. |
| Create Lead Priority | Medium selected, no prompt; optional in validation | Decide whether Medium is an intentional routine default. If not, approve blank `Select priority` and whether priority is required. | A default may be mistaken for deliberate triage. |
| Record Progress Status/Priority fallback | Current lead values, otherwise New/Medium | Preserve loaded values; decide whether blank/unavailable fallback follows the approved Create Lead policy. | Keeps meaning consistent without changing existing lead data. |
| Initial Action default | Call selected; required | Phase context says Interaction Action remains unchanged. Confirm whether that includes retaining Call as a default. If reconsidered later, approve an explicit blank prompt and required-choice behavior. | A preselected channel can create a false activity record. |
| Follow-up Priority service default | Medium assigned; no selector | No change proposed in this phase; if reconsidered, owner must decide whether priority should remain system-assigned or be user-entered. | No UI control currently presents this choice, and changing it would affect workflow behavior. |

## 4. Files inspected

- `docs/README.md`
- `docs/experiments/28_WORKFLOW_ENUMS_AND_FORM_UX_AUDIT.md`
- `prisma/schema.prisma`
- `src/components/leads/lead-edit-modal.tsx` (Create Lead and Edit Lead)
- `src/components/leads/record-progress-modal.tsx`
- `src/components/sales/activity-fields.tsx`
- `src/components/sales/lead-details-modal.tsx` (schedule/reschedule and activity edit)
- `src/components/sales/attention-center.tsx` (follow-up empty states)
- `src/components/sales/sales-dashboard-client.tsx` (upcoming follow-up empty state)
- `src/components/sales/sales-table-controls.tsx`
- `src/components/shared/table-controls.tsx`
- `src/components/shared/search-toolbar.tsx`
- `src/components/leads/lead-source-manager-modal.tsx`
- `src/services/follow-up.service.ts`
- `src/lib/lead-constants.ts`
- `src/lib/activity-options.ts`
- `src/lib/validation.ts`

The implementation of Create Lead and Edit Lead shares one component; its create branch and edit branch were reviewed separately. Existing local changes were treated as the current implementation and left intact.

## 5. Read-only verification

- Compared current prompt strings and defaults against component/service source; confirmed Create Lead and Record Progress defaults, edit hydration, conditional required fields, follow-up date/time behavior, search/filter prompts, and follow-up priority assignment.
- Consulted the existing Phase 9 workflow audit for context, then verified findings against current source rather than treating the audit as authoritative.
- Queried the existing `graphify-out/graph.json` for relevant component relationships; no graph rebuild or generated artifacts were run.
- Confirmed the only intended modifications for this phase are this report and the documentation index. No tests, build, migration, database access, or application mutation was performed.
