# LeadBridge Repository-Wide Improvement Audit

> **Status:** Experimental, read-only source audit  
> **Audit date:** 2026-11-05  
> **Source of truth:** Current repository source and schema; canonical docs checked against implementation.

## Executive Summary

The repository has a coherent Next.js/Prisma service architecture, consistent server-side session guards on the inspected APIs, and meaningful recent hardening around lead creation, activity events, connector execution, and input validation. No critical or high-severity issue was confirmed in this static review.

Four concrete findings remain: two medium-severity data-integrity risks in activity updates and concurrent follow-up completion; a low-severity note API scheduling mismatch; and missing test discoverability plus stale canonical documentation. The two data-integrity findings should be addressed before V1.0. This audit did not change application files, tests, configuration, migrations, or canonical documentation.

## Scope Inspected

- Repository instructions, documentation map, and canonical architecture, database, backend, frontend, UI design, API, authentication, integrations, performance, and development guides.
- App Router pages and shared layouts, `src/proxy.ts`, client lead and activity flows, shared UI controls, form validation, and navigation/component directories.
- API route inventory and authorization wrapper patterns; focused traces of lead creation/update, activity patching, follow-up creation/update/completion, notes, cache invalidation, and session/permission enforcement.
- Prisma schema models, relations, delete policies, indexes, and migration directory; the current migration count agrees with `docs/database.md`'s stated count of 16.
- Existing tests and package scripts, including unit-style Node tests and PostgreSQL-gated tests.
- Existing `graphify-out/graph.json` used as an index, with all findings checked in source.

This was a static source audit. It did not execute the test suite, connect to PostgreSQL, exercise the app in a browser, or inspect deployment-host configuration and external CI settings.

## Findings

### Must Fix

No Critical or High findings were confirmed.

### Should Fix

#### 1. Concurrent follow-up completion can create duplicate completion side effects

- **Area:** Backend, data integrity
- **Status:** Confirmed concurrency risk
- **Severity:** Medium
- **Evidence:** `src/services/follow-up.service.ts`, `FollowUpService.complete()` (lines 335–358, 360–428). It reads and verifies `PENDING` before opening the transaction (lines 342–344), then performs an unconditional `tx.followUp.update({ where: { id }, ... })` inside the transaction (lines 346–358). The same transaction creates completion/activity entries and can create another follow-up (lines 360–428).
- **Problem:** Two concurrent requests can both observe `PENDING`. The database update is keyed only by ID, so the second request can also mark the row completed and append another completion event; when a next follow-up is requested, both requests may create one.
- **Impact:** Duplicate history entries and duplicate tasks can appear from a double click, retry, or concurrent client request, even though the follow-up ends in a valid completed state.
- **Recommendation:** Make the pending-to-completed transition conditional inside the transaction (for example, update only where both `id` and `status: PENDING` match), and reject/return the already-transitioned result if no row is changed. Keep event and next-follow-up writes in the same transaction.
- **Effort:** Small to Medium
- **Priority:** Before V1.0

#### 2. Partial activity PATCH requests can persist incompatible action and response values

- **Area:** Backend API, data integrity
- **Status:** Confirmed API behavior
- **Severity:** Medium
- **Evidence:** `src/app/api/activities/[id]/route.ts`, `updateActivitySchema` (lines 6–11) makes each field optional. `PATCH` loads the entry without its stored response or interest (lines 22–25). The action/response compatibility check only runs when both are supplied (lines 46–53), and the update writes only supplied fields (lines 62–65, 75–80). The interest check does not require interest for a successful response (lines 55–60).
- **Problem:** A valid partial request such as `{ "action": "WHATSAPP" }` can change a CALL entry with `PICKED_UP` response into an incompatible WHATSAPP/`PICKED_UP` record. A response-only update can likewise bypass validation against the stored action, and a successful response can be saved without the required interest.
- **Impact:** Activity history can store combinations that the interaction creation schema and UI do not permit. This makes history misleading and can break downstream displays or reporting based on response/action semantics.
- **Recommendation:** Validate the merged resulting activity state, including the existing values, before writing; alternatively require all interdependent fields in this PATCH contract. Preserve the current owner authorization and validate `interest` against the resulting response.
- **Effort:** Small
- **Priority:** Before V1.0

### Later

#### 3. Note API can report success while silently omitting a requested follow-up

- **Area:** API validation and service behavior
- **Status:** Confirmed API behavior; use by the current UI was not established
- **Severity:** Low
- **Evidence:** `src/lib/validation.ts`, `noteSchema` (lines 53–60) allows `scheduleFollowUp: true` with a missing or invalid `followUpDate`. `src/services/note.service.ts`, `NoteService.create()` (lines 72–108) creates a follow-up only when both the flag and date are truthy, otherwise it continues and commits the note/event. With a malformed date, date construction can reach `toISOString()` at line 104 and fail inside the transaction instead of producing a request-validation error.
- **Problem:** The accepted request shape does not encode the condition implied by `scheduleFollowUp`; missing date silently turns off the requested scheduling, while malformed date can become a server error.
- **Impact:** API clients can receive a successful note response despite believing a follow-up was scheduled, or receive an unhelpful server error for malformed input. No current UI exposure was confirmed during this audit.
- **Recommendation:** Add a conditional date requirement and date validation to `noteSchema` when scheduling is enabled, then have the service operate on the validated/normalized date. Keep note and follow-up persistence transactional.
- **Effort:** Small
- **Priority:** After V1.0 unless a current client uses this payload

#### 4. Test execution and canonical architecture guidance are out of sync with the repository

- **Area:** Maintainability, documentation, test operations
- **Status:** Confirmed documentation/configuration mismatch
- **Severity:** Low
- **Evidence:** `tests/lead-creation-validation.test.ts`, `tests/phase1-hardening.test.ts`, `tests/lead-creation.postgres.test.ts`, and `tests/execution-fencing.postgres.test.ts` use Node's `node:test`. `package.json` scripts (lines 5–15) define no test command. `docs/development.md` (lines 88–97) says no formal test framework is configured and describes manual testing, without documenting these test files or a runnable command. `docs/architecture.md` (lines 31 and 74) identifies `src/middleware.ts`, which is absent; the current file is `src/proxy.ts` and exports `proxy()` (lines 6–22). The server layouts and API authorization helpers remain the authoritative access checks.
- **Problem:** Contributors following canonical docs can overlook the existing automated tests and may look in the wrong place for the request gate. There is no package-level test entry point, so ordinary typecheck/lint/build commands do not execute these tests by themselves.
- **Impact:** Regressions can pass routine verification simply because focused tests were not discovered or run; architecture changes can be made against an obsolete file path. External CI configuration was not available for verification, so this does not establish that tests are absent from hosted CI.
- **Recommendation:** Add a package script for the repository's Node tests and document the isolated-database requirement for PostgreSQL tests; update architecture/development documentation when a documentation task is authorized. Verify the hosted CI pipeline separately.
- **Effort:** Small
- **Priority:** Before V1.0 for a repeatable test command; documentation correction can follow with that change

### Not Recommended

- No broad UI redesign: the current shared component and token-based UI approach are in place, and no evidence supports another overhaul.
- No new activity subsystem or database migration: existing `ActivityEvent`/`ActivityEntry`, `FollowUp`, and `Note` models and service boundaries are appropriate for the inspected workflows.
- No search-index, cache, queue, or connector expansion recommendation: current scale decisions and deferred connector scope are consistent with repository instructions; this static audit found no measurements that justify added infrastructure.

## Existing Strengths and Areas That Do Not Need Changes

- **Authorization layering:** `src/lib/api.ts` checks the Better Auth session and active user state before invoking handlers. `src/lib/permissions.ts` centralizes role/privilege checks. The inspected lead, activity, note, and follow-up operations also enforce resource ownership or role scope in server code; page-level cookie checks are not treated as the security boundary.
- **Lead creation integrity:** `src/services/lead.service.ts` coordinates lead creation and its initial activity writes in a Prisma transaction. `tests/lead-creation.postgres.test.ts` contains coverage for creation event counts, interaction attribution, follow-up assignment, and rollback behavior, although it requires a dedicated test database.
- **Activity model:** `ActivityEvent` and `ActivityEntry` are separate, related models in `prisma/schema.prisma`; migrations remove the legacy `LeadActivity` and `AuditLog` models. This matches the stated architecture and should remain the activity system.
- **Follow-up denormalization:** The service has a transaction-aware recalculation method and uses it in key follow-up mutations. Preserve that invariant when addressing the completion race.
- **Input/security hardening:** The inspected REST connector security code and tests include URL/redirect checks, response-size limits, CSV formula neutralization, and scheduler secret validation. No confirmed injection or SSRF defect was identified in the inspected paths.
- **Query and cache approach:** CRM lead/detail/note/follow-up reads are generally fresh; dashboard/settings caching and centralized mutation invalidation are consistent with documented decisions. No measured evidence supports a new cache or search architecture.
- **Lead create validation:** Current source and `tests/lead-creation-validation.test.ts` cover exact ten-digit phone validation, optional email normalization, contact-method requirement, activity response rules, conditional interest, and follow-up input rules. These changes were present in the pre-existing working tree and were preserved.

## Testing and Verification Gaps

- The focused Node tests were inspected but not executed as part of this static audit.
- PostgreSQL integration tests are gated on `LEADBRIDGE_TEST_DATABASE_URL`; `tests/lead-creation.postgres.test.ts` additionally refuses URLs whose database path is not named as a test database. No test database was connected or modified during this audit.
- No repository-local `.github` workflow directory was present. Hosted CI configuration, if any, is external and could not be checked.
- No browser session was used, so visual/accessibility behavior and responsive interactions were not runtime-verified.
- The activity PATCH merged-state validation and concurrent follow-up completion race lack focused regression tests in the current test inventory.
- Deployment settings, production database constraints/state, and live request behavior were not inspected.

## Prioritized Recommendations

1. Make follow-up completion a conditional, atomic state transition before writing completion events or next tasks.
2. Validate the complete resulting interaction state for partial activity PATCH requests.
3. Add a repeatable package test command and document the PostgreSQL test database setup; verify external CI.
4. Align the note scheduling schema with the service's required date behavior if that API capability is supported.
5. Correct the stale `src/middleware.ts` and test guidance in canonical docs when documentation updates are in scope.

## Worktree Preservation

Pre-existing modifications and untracked files were present before the report was created, including changes under `docs/`, `src/app/api/`, `src/components/`, `src/lib/`, `src/services/`, and `tests/`. They were left untouched. This audit adds only this report.
