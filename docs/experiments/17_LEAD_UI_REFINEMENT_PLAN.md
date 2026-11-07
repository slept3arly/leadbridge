# Lead UI Refinement Plan

> **Status:** Investigation and implementation specification
> **Prepared:** 2026-11-07
> **Scope:** UI refinement Phases 1–5; this document records Phase 1 findings only.
> **Source of truth:** Current application code, Prisma schema, then canonical documentation.
> **Restriction:** No application, API, schema, migration, or data changes are part of this audit.

This document distinguishes verified implementation facts from recommendations and unresolved product or compatibility decisions. The existing worktree contains earlier workflow implementation changes; this plan does not assess those changes as committed or claim tests have been run.

## 1. Current implementation inventory

### Record Progress

**Verified** — `src/components/leads/record-progress-modal.tsx` is the shared Record Progress dialog. It posts one request to `POST /api/leads/[id]/activities`; its payload includes action, response, conditional interest, normalized notes, optional follow-up scheduling, an optional explicitly completed follow-up ID, and only changed classification fields. The modal owns these values in React state.

`src/components/sales/activity-fields.tsx` supplies the shared CALL/WHATSAPP, response, conditional-interest, notes, and (when enabled) scheduling controls. Channel-specific outcomes are declared in `src/lib/activity-options.ts`. The Activity section is currently an always-visible `<section>`. “Update lead classification” is a native `<details>/<summary>` disclosure and is initially closed. The follow-up section is an always-visible `<section>`.

The current follow-up UX in `RecordProgressModal` uses a single `Select` to choose a pending task, plus a separate checkbox that confirms completion. No task is selected by default, except when the Tasks entry point passes `initialFollowUpId`; that preselection still requires checking the completion box. The selected ID is not submitted as `completeFollowUpId` unless the confirmation checkbox is checked. Scheduling a next follow-up uses a separate checkbox and is independent of completion. The form validates through `leadProgressRequestSchema`, preserves local input on request errors, and has explicit 403 and 409 messages.

`src/hooks/use-accessible-dialog.ts` is the shared accessible-dialog behavior used by these modals. `src/lib/follow-up-form-date.ts` and `src/lib/follow-up-date.ts` support the existing follow-up date handling. Those APIs and serialization semantics are outside this refinement's scope.

### Lead Workspace

**Verified** — `src/components/sales/lead-details-modal.tsx` owns the Lead Details modal and its child dialogs/panels. It uses `useLeadDetails` from `src/hooks/use-lead-details.ts` for the detail projection, then renders a two-column desktop layout. The main column currently places the large `LeadInfoSection` customer-information card before `DailyHistory`; the supporting column contains “Ownership and timing” and `FollowUpsColumn`.

`src/components/sales/lead-header.tsx` currently shows lead identity/contact context and classification badges, with actions for Record Progress, Edit Details, Archive/Restore when allowed, Delete when allowed, and Close. Archive and Delete are conditional, so the number of visible actions depends on role and lead state.

`src/components/sales/lead-info-section.tsx` renders populated customer metadata and Created/Updated/Imported timestamps. It includes phone/email links and website links when the stored website has an HTTP(S) URL. `src/components/sales/daily-history.tsx` renders chronological activity and history items and supports the existing activity-edit path where authorized. `src/lib/lead-workspace.ts` contains presentation helpers for timeline/follow-up organization.

The ownership card in `lead-details-modal.tsx` primarily presents the assigned salesperson, but also includes first/last-contacted and closed timestamps. The follow-up panel displays multiple pending items, highlights the earliest as the next action, shows due date/time, owner, and overdue state, offers Record Progress for a selected task, and retains standalone reschedule/delete controls. Completed tasks are shown in a collapsible section (currently a bounded recent subset).

### Existing disclosure and dialog primitives

**Verified** — `src/components/ui/expandable-section.tsx` is a “show more” list component; it does not implement accordion/disclosure sections. The only observed general disclosure primitive in the reviewed workflow is native `<details>/<summary>` in `RecordProgressModal` and for completed follow-ups. `src/components/ui/confirm-dialog.tsx` handles confirmation prompts. `useAccessibleDialog` manages dialog focus/keyboard/body-scroll behavior; the app does not currently expose a general-purpose informational popup component for the proposed View Details content.

**Recommendation** — Build a small reusable controlled disclosure/accordion section in the existing UI layer, or a narrowly scoped component used by all three Record Progress sections. Use a full-width `<button>` header with `aria-expanded` and `aria-controls`, and a separately rendered content panel. This makes the entire header rectangle the toggle target while ensuring clicks in content do not toggle the disclosure. Keep the form values in `RecordProgressModal`, outside the disclosure component, so unmounting/collapsing content cannot erase values. No dependency is needed.

### Project conventions relevant to the plan

**Verified** — The app is a Next.js App Router monolith; mutations go through API routes, business operations reside in services, and the cache/cross-tab conventions are documented in `docs/frontend.md`, `docs/backend.md`, and `docs/api.md`. The Record Progress API contract is documented in `docs/experiments/16_LEAD_WORKFLOW_CONTRACTS.md`. The existing shared component and API are the integration points to preserve across UI phases.

## 2. Record Progress accordion specification

### Target sections and initial state

1. **Customer Interaction** — mandatory; CALL/WHATSAPP, channel-specific response, interest only for PICKED_UP/REPLIED, optional activity notes.
2. **Update Lead Classification** — optional; Status, Priority, Category.
3. **Manage Follow-ups** — optional; pending tasks, explicit completion selection, and independent next-follow-up scheduling.

**Confirmed behavior** — All three sections start collapsed. The Customer Interaction section remains required even while collapsed; submit validation must validate its fields. A collapsed section must not disable or omit its values from submission.

### Interaction and validation behavior

**Recommendation** — Put a concise required/optional cue and current validation state in each header. Clicking anywhere on the header rectangle toggles only that section. The content panel is not nested inside the header button, so controls and labels inside it cannot toggle the section. Preserve state in the parent modal while collapsed/reopened.

When validation finds an error in a collapsed section, expand that section and retain its inline field errors. The required Customer Interaction section should be auto-expanded on a failed submission if any of its fields are invalid. Classification and follow-up sections should also auto-expand if their own inputs contain validation errors. Do not clear unrelated errors merely because a user collapses a section. When a field is corrected, clear only the corresponding error using the existing form behavior.

For usability, after expansion on submit failure, focus or announce the first invalid field where practical; preserve the current field-level error text and alert semantics. The dialog submit action remains available regardless of which sections are open.

**Contract boundary** — This is presentation-only. Keep `RecordProgressModal` props and the existing single POST request, conditional payload behavior, response validation, and `completeFollowUpId` semantics unchanged. Do not move orchestration into the accordion primitive.

## 3. Pending follow-up interaction specification

### Target interaction

**Recommendation** — Replace the task dropdown plus completion checkbox with a compact list of individually selectable task rows. Each row should expose a single-selection control (radio semantics are appropriate because at most one task can be completed per Record Progress submission), plus the task title and enough identifying information to distinguish it: due date/time and overdue indication where available. Provide a clear selected state and short explanatory copy such as “Selected task will be completed when you record this interaction.”

- No task is selected by default when Record Progress opens normally.
- A task opened from Tasks may be preselected as a proposal; present that selection clearly and require the user to submit Record Progress to complete it.
- Selecting or changing the selection makes no request and changes no task state.
- Submitting with no selection omits `completeFollowUpId`; all pending tasks remain unchanged.
- Submitting with one selected task includes only that task's ID as `completeFollowUpId`; completion happens with the interaction in the existing backend transaction.
- Other pending tasks are untouched, including when multiple tasks exist.
- Scheduling another follow-up remains a separate optional control and may be enabled with or without a selected completion.
- With no pending tasks, show a compact empty state while keeping scheduling available.

Do not add per-row complete buttons, a second confirmation checkbox, task title/description/priority editing, or a separate completion request. Visually indicate “proposed for completion” without suggesting that selection itself completed the task. Preserve existing selected-task validation when a task is no longer pending and preserve the existing API payload contract.

## 4. Lead Workspace target layout

### Main information hierarchy

**Recommendation** — Retain the existing modal and common Admin/Sales workspace implementation. Restructure its body into a dominant Activity and History area and a supporting area:

- **Header:** customer name and compact identity context; primary Record Progress action; secondary View Details; permitted Archive/Restore and Delete; Close.
- **Main area:** Activity and History timeline is the dominant content and first major section. Preserve chronological ordering, interaction channel/outcome/notes, field changes, follow-up events, legacy records, and authorized activity editing. Do not invent fields for older activity entries.
- **Supporting area:** current Status/Priority/Category, Lead owner, and all pending follow-ups. Show multiple pending tasks without hiding or implicitly selecting any. Keep the next required action apparent and preserve the task-specific Record Progress context.
- **Responsive behavior:** on narrow screens, stack the supporting summary and history in a deliberate order that leaves Record Progress easy to reach and does not create a nested scroll trap. Reuse current modal sizing, design tokens, focus behavior, and responsive breakpoints rather than creating another layout system.

Remove the large Customer Information card from the main workspace only after moving its useful content to View Details. Do not remove the existing Edit Lead Details capability. Do not duplicate its form or request logic.

### Customer metadata distribution

Keep customer identity (name and, if already shown, company/contact affordances) visible in the header. Move detailed contact/customer metadata into View Details: phone, email, company, city/state, address/country, requirement, source, alternate phone, industry, job title, website, budget/expected value/currency, campaign and UTM metadata where populated, and other existing customer fields. Omit empty values. Phone/email/website affordances should match current behavior.

The confirmed Product removal policy in section 9 applies to the eventual Phase 5 UI: Product should not be surfaced as a current customer-detail field after that phase. Historical Product field-change entries may remain readable in the timeline as history, clearly marked as historical.

## 5. View Details popup specification

**Recommendation** — Replace the header's Edit Details action with View Details. This opens a read-only informational popup using the same accessible dialog conventions (`useAccessibleDialog`) and current Lead Details projection. It should display the non-empty customer metadata currently shown by `LeadInfoSection`, with clear grouping for contact details, location, requirement/source, and other available business metadata. Keep phone/email links and valid website links.

Include an **Edit Details** button inside the popup. It must open the existing `LeadEditModal` in `src/components/leads/lead-edit-modal.tsx`; do not copy its fields, validation, API calls, or mutation behavior. Avoid nested dialogs: close the View Details popup before opening the edit modal, then restore/reopen the workspace as appropriate after a successful edit. The existing Lead Details modal should remain the owner of refreshed lead data.

Do not include Product as an active displayed field after the Phase 5 Product UI removal. Preserve Product in storage and connector compatibility (section 9). The popup should continue displaying all remaining relevant customer metadata, including the fields explicitly requested in the refinement brief.

## 6. Header action organization

**Verified current actions** — `LeadHeader` provides Record Progress, Edit Details, conditional Archive/Restore, conditional Delete, and Close. Archive and Delete availability is determined by existing role/lead state logic; do not broaden it.

**Recommendation for target order and emphasis**

1. **Record Progress** — the only prominent primary action.
2. **View Details** — secondary; replaces header Edit Details.
3. **Archive** or **Restore** — secondary and shown only where currently authorized/applicable.
4. **Delete** — destructive styling/confirmation and shown only where currently authorized.
5. **Close** — standard dialog close control, not styled as a lead mutation.

Retain all existing action capabilities and confirmation behavior. Do not add a second activity-creation action or make Archive/Delete compete visually with Record Progress. Keep keyboard labels and accessible names explicit at smaller widths.

## 7. Ownership and timestamp presentation

**Recommendation** — Rename “Ownership and timing” to **Lead owner** (or “Assigned to” if that better matches the design system). Show the assigned salesperson and any existing authorized assignment context; do not put customer timestamps under this heading.

Move useful timestamps out of the ownership card. Keep created/updated/imported timestamps in the View Details popup under a compact **Record information** group. First/last contacted and closed timestamps, when present in the existing detail projection, belong in a compact **Lead activity** or **Lifecycle** metadata row near the classification summary or in Record information. Avoid repeating the same timestamp both in the timeline and metadata unless each represents distinct information.

Continue formatting dates through existing shared date/time helpers and respect their current timezone behavior. This UI audit does not authorize changing date semantics.

## 8. Complete Product field dependency inventory

This inventory is specifically about `Lead.product`, not every occurrence of the word “product.” Search covered `src`, Prisma schema/migrations, tests, scripts, and documentation.

| Layer | Verified references | Current role / refinement treatment |
|---|---|---|
| Database model | `prisma/schema.prisma` (`Lead.product String?`) | Nullable text; existing stored values must remain. No drop/clear migration. |
| Migration history | `prisma/migrations/20260713173452_init/migration.sql` | Initial column creation only. Historical migration is immutable for this work; add no migration in audit. |
| Validation | `src/lib/validation.ts` (`leadSchema.product`) | Optional, normalized lead input. Active manual form should stop sending it after Phase 5; decide whether to retain the optional schema key for old clients/connector compatibility. |
| Shared lead input type | `src/types/lead.ts` (`product?: string`) | Used in normalized/import-compatible lead inputs. Keep optional while connector mappings accept it. |
| Lead queries/projections | `src/services/lead.service.ts` (`leadListSelect`, lead detail select) | Selects Product in list/detail data. List path passes it to Admin lead edit data; detail path feeds View Details/Edit. Remove from projections only where no remaining consumer requires it; avoid unrelated query redesign. |
| Manual Add/Edit UI and payload | `src/components/leads/lead-edit-modal.tsx` | Current shared create/edit form includes optional Product state, resets it from a lead, and sends Product in requests. Phase 5 removes the input/state/payload while preserving all other fields and validation. |
| Lead Details UI | `src/components/sales/lead-info-section.tsx`; `src/components/sales/lead-details-modal.tsx` | LeadInfoSection displays Product; edit handoff includes Product. Remove current-value display/handoff dependency once editing/display no longer needs it. |
| Client types and Admin list mapping | `src/hooks/use-lead-details.ts`; `src/app/(dashboard)/admin/leads/page.tsx`; `src/components/leads/admin-leads-page-content.tsx` | Carry Product through detail/list typing and selected edit lead. Simplify only after checking each consumer. |
| Export | `src/services/export.service.ts` | Selects Product and emits a `Product` CSV column. This is the active non-form user-facing dependency with downstream compatibility implications; decision is unresolved (section 13). |
| Connector/import | `src/runtime/connector-runtime.ts` | Maps incoming parsed `lead.product` into persisted Lead.product. Preserve this mapping so imports do not discard incoming historical/source data. Do not make manual creation depend on it. |
| Activity/history display | `src/components/sales/daily-history.tsx` | Maps historical changed-field key `product` to label “Product.” Keep this mapping so existing history remains understandable; it is not a current-value editor. |
| Validation tests | `tests/lead-creation-validation.test.ts` | Currently checks whitespace Product normalizes to null. Update Phase 5 tests to assert the manual workflow no longer requires/sends Product while old optional data remains accepted as intended. |
| Seed/smoke utilities | `scripts/seed-leads.ts`; `scripts/phase2-smoke.ts` | Seed data assigns sample Product values; smoke input explicitly supplies null. These are development utilities, not runtime workflow dependencies. Decide whether to stop generating sample Product values in Phase 5; do not alter existing database values. |
| Search, filters, sorting, dashboards | `src/lib/query-builder.ts` and relevant dashboard/list services | Search did not find Product in active search/filter/sort or dashboard aggregation. Core lead search remains over display name, company, email, phone, and lead number. No Product summary dependency was found. |
| Other terminology | `docs/integrations.md`, `docs/api.md`, seed requirements, and general prose | Mentions of “product” as ordinary language (for example “product catalogue”, production readiness, or product demo) are not `Lead.product`; do not remove unrelated content. Older experiment docs mention the field historically and should not be rewritten as part of this audit. |

No separate Product entity/model dependency was found in the audited Lead workflow paths. “Product” in unrelated application/business prose is not evidence of a Lead field dependency.

## 9. Product removal and historical-data preservation strategy

### Confirmed policy

- Remove Product from user-facing active lead workflows; it is no longer required.
- Preserve every existing `Lead.product` value in PostgreSQL.
- Do not clear, rewrite, or deduplicate historical leads.
- Do not drop the column or create a destructive migration in this refinement.
- Keep connector/import ingestion able to preserve incoming Product values without exposing Product in manual Add/Edit workflows.
- Keep historical field-change records readable; do not invent or backfill history.

### Smallest safe Phase 5 approach

1. Remove Product from the shared manual create/edit form and from its outgoing human-workflow payload, leaving other field behavior intact.
2. Remove Product from the current-value View Details/customer information UI.
3. Retain nullable database storage and connector mapping (`connector-runtime.ts`). Keep `src/types/lead.ts` optional where import normalization requires it. Keep legacy API handling optional if old clients may still send it; do not make omission an error.
4. Remove Product from query projections only after confirming no edit/export or other consumer needs the field. Keeping a selected DB column temporarily is safer than breaking an unverified consumer; projection cleanup is not required to achieve user-facing removal.
5. Preserve the `daily-history.tsx` historical label mapping.
6. Resolve CSV export compatibility before removing its Product column. If downstream consumers require a stable schema, document a deprecation or keep a compatibility export path; do not silently break consumers. No evidence of such consumers was found in repository code.
7. Adjust focused validation, export, connector, and UI tests. Optionally stop adding synthetic Product values in seed data, without editing existing records.
8. Make no schema or data migration for this work. A future column-drop proposal would require a separately approved retention/compatibility decision and proof that no connectors, exports, or historical readers need it.

## 10. Five-phase implementation sequence

1. **Audit and finalize specifications (this phase):** document verified current state, target behavior, dependencies, risks, and unresolved decisions. No app changes.
2. **Record Progress accordion redesign:** introduce/reuse a no-dependency controlled disclosure primitive; make all three sections initially collapsed; expand on contained validation errors; preserve form state and the existing backend/API contract.
3. **Simplify pending follow-up controls:** replace dropdown plus checkbox with individually selectable, single-selection task rows. Keep the exact completion-ID request semantics, task-context proposal, independent scheduling, and no implicit task transitions.
4. **Lead Workspace redesign:** make Activity and History dominant; organize classification, owner, and pending follow-ups in the supporting area; replace header Edit Details with View Details; reuse existing LeadEditModal and accessible dialog behavior; move timestamp metadata without loss.
5. **Product deprecation and final cleanup:** remove Product from active manual and workspace UI, resolve export-column compatibility, retain the nullable column/import mapping/history compatibility, then remove only proven-unused types/projections/tests/docs. Do not delete or rewrite data.

### Cross-phase dependencies

- Phase 2 must preserve `RecordProgressModal` exports, props, task context, one-request submission, and existing lead/activity cache callbacks so Phase 3 entry points keep working.
- Phase 3 builds on Phase 2 disclosure/state architecture but must not change backend workflow contracts or make selecting a task mutate it.
- Phase 4 must reuse `useLeadDetails`, `LeadInfoSection`-derived metadata, `LeadEditModal`, `RecordProgressModal`, `DailyHistory`, follow-up actions, access rules, and cache/cross-tab conventions. Do not build parallel Admin/Sales workspaces.
- Phase 5 should follow the settled View Details layout so Product is removed once from all active lead UI, while connector and historical paths remain explicit.
- Across all phases, leave authorization, API permissions, transaction/history semantics, follow-up denormalization, mutation invalidation, and cross-tab synchronization intact.

## 11. Expected files/components per phase

These are expected touch points based on current references, not a mandate to edit every listed file.

| Phase | Likely files/components | Expected scope |
|---|---|---|
| 1 — Audit/specification | `docs/experiments/17_LEAD_UI_REFINEMENT_PLAN.md` | This document only. |
| 2 — Accordion redesign | `src/components/leads/record-progress-modal.tsx`; `src/components/sales/activity-fields.tsx` only if needed; new small `src/components/ui/*disclosure*` component if shared; `tests/lead-workflow-entrypoints.test.ts` and/or a focused UI test | Three collapsed sections, accessible full-header toggle, validation expansion, no API change. |
| 3 — Follow-up controls | `src/components/leads/record-progress-modal.tsx`; shared UI selection primitives if suitable; existing workflow/form tests | Selectable pending-task rows, task context proposal, one selected ID, scheduling independent, same POST contract. |
| 4 — Workspace | `src/components/sales/lead-details-modal.tsx`; `src/components/sales/lead-header.tsx`; `src/components/sales/lead-info-section.tsx` or a read-only View Details child; `src/components/sales/daily-history.tsx`; `src/hooks/use-lead-details.ts` only if existing projection is insufficient; `src/hooks/use-accessible-dialog.ts`; `src/lib/lead-workspace.ts`; `tests/lead-workspace.test.ts` | Timeline-first layout, owner/follow-up/classification support, accessible View Details popup, existing edit modal reuse, responsive behavior. Prefer no backend/API changes unless code inspection reveals necessary fields are absent. |
| 5 — Product deprecation | `src/components/leads/lead-edit-modal.tsx`; `src/components/sales/lead-info-section.tsx`; `src/components/sales/lead-details-modal.tsx`; `src/types/lead.ts` (only if safe); `src/lib/validation.ts` (keep compatibility optional unless evidence allows removal); `src/services/lead.service.ts`; Admin page/content types; `src/hooks/use-lead-details.ts`; `src/services/export.service.ts`; `src/runtime/connector-runtime.ts` (expected to preserve mapping); `src/components/sales/daily-history.tsx` (expected to preserve historical label); `scripts/seed-leads.ts`; tests and relevant canonical docs | Remove current UI dependency; retain DB column/import/history compatibility; resolve CSV contract; no destructive migration. |

## 12. Regression risks and test requirements

### Record Progress

- Verify each section starts collapsed and is toggled by clicks across its entire header, while clicks inside content do not toggle it.
- Verify entered values survive collapse/reopen, and collapsed fields remain part of validation/submission.
- Verify errors in each section automatically expand that section and remain visible; correcting one field does not erase unrelated errors.
- Verify CALL and WHATSAPP response options and interest conditional behavior remain unchanged.
- Verify pending task selection does not complete immediately; no default selection outside a task-context proposal; only the selected task ID is submitted; other tasks remain untouched.
- Verify next-follow-up scheduling works with zero, one, or multiple pending tasks and independently of completion.
- Verify success/error, duplicate-submit prevention, 409 behavior, and existing task-context entry points still work.

### Lead Workspace and View Details

- Verify customer name/contact identity stays immediately visible; empty customer fields stay omitted; links work.
- Verify timeline remains chronological, distinguishes actual interactions from history/system records, keeps notes attached, supports legacy records, and preserves authorized activity editing.
- Verify every pending task remains visible and correctly marked overdue/completed; task-to-Record-Progress context is preserved.
- Verify the primary action opens the shared Record Progress component for the correct lead; View Details opens read-only metadata; its Edit Details action opens the existing editor without nested dialogs.
- Verify Archive/Restore/Delete permissions and destructive confirmation are unchanged for Admin and Sales.
- Verify dates are not lost or duplicated and responsive/keyboard/focus behavior follows existing modal conventions.

### Product deprecation

- Verify Add/Edit no longer displays or requires Product and does not send an active-workflow Product value.
- Verify old optional API payloads and imports remain compatible as chosen; connector-import Product values persist.
- Verify stored values are unchanged by UI edits that omit Product, and no migration clears/drops the field.
- Verify historical Product field-change events render with their label.
- Verify export column behavior explicitly and test its compatibility decision.

### Infrastructure and synchronization

Use the existing test infrastructure; current tests include `tests/lead-workflow-entrypoints.test.ts`, `tests/lead-workflow-form.test.ts`, `tests/lead-workspace.test.ts`, and PostgreSQL integration tests such as `tests/lead-workflow.postgres.test.ts`. The available tests are primarily source/domain/database-oriented; inspect `package.json` before planning browser/component assertions. If there is no browser harness, report that and do not treat unit tests as visual verification.

Across phases, test API payload compatibility, existing authorization, targeted cache invalidation, cross-tab mutation synchronization, and workspace refresh after successful workflow submissions. Do not add polling or broad refetch behavior as a substitute.

## 13. Decisions unresolved at audit time

1. **CSV export compatibility:** `src/services/export.service.ts` currently selects Product and emits a named CSV column. The repository search found no internal consumer contract, but external spreadsheet/import consumers may depend on the column. Before Phase 5 removes it, decide whether to remove it immediately, announce/deprecate it, or retain a compatibility export. This is the main external compatibility question.
2. **Legacy API Product input:** Product is nullable and optional in the current validation schema and typed lead input; connector ingestion writes it. The safe default is to keep the API key accepted as optional while removing it from human forms. Confirm whether any external manual API client depends on sending it before removing API compatibility in a later change.
3. **Historical Product display:** The confirmed policy removes Product from the current user-facing application while preserving historical values. Keep historical field-change entries readable. Confirm whether historical current-value Product values should be wholly hidden (recommended) or available in an explicitly archival/admin-only view; no archival UI is specified here.
4. **Phase 2 component testing:** Existing repo tests do not establish a React/browser test harness from the audited files. Confirm available browser/component test infrastructure when implementation begins; do not add a new framework solely for this UI unless separately approved.

No unresolved decision is needed to implement the accordion or selectable pending-task behavior without changing backend contracts.

## 14. Phase 5 implementation status

**Completed:** Product is removed from the manual Add/Edit Lead form, View Details, the Admin lead-list data type/edit handoff, and active Lead list/detail projections. The Requirement field now spans the available form width. The shared Zod schema still accepts the legacy optional `product` input, and `LeadService.updateFieldsInTransaction()` only updates submitted fields, so omitting Product from an edit preserves the stored value.

The nullable `Lead.product` Prisma field and initial migration are unchanged; no data migration or database cleanup was performed. Connector parsing/import continues mapping incoming Product values. CSV export retains its existing `Product` header between `Country` and `Requirement` and exports stored values. `DailyHistory` retains the historical `product` → `Product` label.

The audit questions above are resolved for this implementation: keep the CSV column for compatibility, retain optional legacy API input, hide the current stored value from active UI, and preserve dated historical Product change entries. Development seed/smoke scripts remain able to exercise legacy Product values; they do not define the active manual workflow. No active current-value Product UI remains.
