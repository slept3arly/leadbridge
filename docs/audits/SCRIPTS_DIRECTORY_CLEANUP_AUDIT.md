# LeadBridge Scripts Directory Cleanup Audit

Scope is limited to the actual contents of `scripts/` (verified as four files). Scripts were read in full and were not executed. No environment values were inspected. The root PowerShell scripts were not touched.

## Script inventory

| Script | Purpose | How it is invoked | Dependencies | Current relevance | Recommendation | Risk |
|---|---|---|---|---|---|---|
| `scripts/phase2-smoke.ts` | Exercises lead creation, assignment, status/follow-up update, note create/update, search/pagination, activity event generation, hard-delete behavior, and connector sync history. It creates unique admin/sales users and test entities, then removes them on the success path. | No package script or direct invocation found. Historical references call it a manual smoke test; likely run via `tsx scripts/phase2-smoke.ts`. | `DATABASE_URL`; PostgreSQL via Prisma adapter; generated Prisma client; Better Auth password hashing/login; lead, note, connector services and query builder. | Relevant as a broad manual service/database smoke test, but it tests legacy behavior (explicitly asserts lead hard deletion). It has no automated test harness or current operational guide entry. Cleanup is only reached on successful execution, so errors can leave fixtures. | INVESTIGATE | High: writes/deletes DB records and uses `DATABASE_URL` without an isolated-database guard. |
| `scripts/phase3a-smoke.ts` | Exercises Gmail environment discovery, provider creation/routing, parser request from unmatched email, sync history write/read, and fixture cleanup. | No package script or direct invocation found; historical archive documents it. Likely run via `tsx scripts/phase3a-smoke.ts`. | `DATABASE_URL` (non-null asserted without validation); PostgreSQL/Prisma; generated client; provider, unmatched-email, connector services and Gmail env discovery. No external Gmail API call is made; environment discovery uses a supplied in-memory mock. | Still covers provider/runtime-adjacent behavior, but is phase-labeled and not in current package scripts or canonical testing instructions. Legacy service comments specifically mention smoke-script compatibility, suggesting remaining coupling. | INVESTIGATE | Very high: starts with unscoped `deleteMany` operations on shared DB records by prefixes (`Unknown Vendor`, `Phase 3A ...`, `phase3a-`); can delete matching records that predate the run. Failure before cleanup also leaves fixtures. |
| `scripts/run-postgres-integration-tests.mjs` | Validates an isolated test DB URL and launches the PostgreSQL-backed Node test suite with that URL supplied as `DATABASE_URL`. | `pnpm test:integration` in `package.json`; documented in `docs/development.md`. | Node child process; `tsx`; test files for execution fencing, follow-up lifecycle/completion, dashboard activity, lead creation/workflow, note scheduling; `LEADBRIDGE_TEST_DATABASE_URL`. No third-party external service. | Active and important guard/launcher for DB integration coverage. URL check requires PostgreSQL protocol, hostname, database name, and “test” substring. | KEEP | Medium: tests mutate database fixtures; safety depends on isolated test DB and safeguards in test files. URL-name substring is a heuristic, not proof of isolation. |
| `scripts/seed-leads.ts` | Creates 25 randomized sample leads using existing active sales users and lead sources; prints results and refuses when `NODE_ENV=production`. | `pnpm seed:leads`; documented in `docs/development.md`. | `DATABASE_URL`; dotenv; Prisma client and adapter; existing user/source rows. Direct Prisma lead inserts; no external API. | Useful for local/demo data. Separate seed command and documentation exist. Some historical performance docs describe scaling it for larger datasets, but current implementation is fixed at 25. | KEEP | Medium: writes directly to the configured database. Production guard relies only on `NODE_ENV`; no database isolation or explicit confirmation. Partial failures leave successfully created rows. |

## Additional analysis

### Package and documentation alignment

- The integration launcher and lead seeder have package scripts and canonical usage documentation in `docs/development.md`.
- Both phase smoke scripts lack package aliases and canonical documentation. Historical archive and experiment documents mention them, but those references are not a current runbook. If they remain supported, document invocation and strict database requirements; ideally give them explicit package script names.
- `pnpm test` runs a list of database-independent tests. `pnpm test:integration` is the only configured entry to the PostgreSQL tests. The phase smoke scripts are not included in either test path and have no meaningful automated test coverage of their own.

### Environment, database use, and side effects

- All four scripts access PostgreSQL, directly or through services. `phase2-smoke.ts` and `phase3a-smoke.ts` use `DATABASE_URL` and do not require a test-named database; the phase3a script even uses a non-null assertion rather than checking presence.
- `run-postgres-integration-tests.mjs` is the only script that explicitly validates a separate test URL and refuses databases without “test” in the name.
- `seed-leads.ts` loads `.env` via dotenv and blocks only when `NODE_ENV` equals `production`.
- Neither smoke script calls an external Gmail service. Phase3a tests discovery from a fabricated in-memory environment object.
- The clearest unsafe behavior is phase3a's cleanup-at-start `deleteMany` by broad name/email prefixes. Phase2 uses generated unique identifiers and cleans created records only after assertions pass. Both need isolated DB practices before manual execution.

### Duplication, architecture currency, and simplification options

- The two smoke scripts overlap in manually constructing Prisma clients, using unique fixtures, checking services, and cleaning up records. Their domain coverage differs substantially, so there is no evidence that either can simply replace the other.
- The integration test runner overlaps with smoke scripts only at the broad level of PostgreSQL/service validation; it launches actual test files with assertions and a database safeguard, whereas the phase scripts are historical end-to-end probes. Consolidation would require porting any still-needed unique assertions into tests first.
- `phase2-smoke.ts` asserts hard-delete semantics, while current architecture notes and prior audits flag deletion semantics as changed/under review. Confirm its expectation against current service/schema behavior before treating it as an authoritative smoke check.
- The provider/runtime layers remain present in current application architecture. The phase3a focus is not obviously obsolete, but source comments about smoke-script compatibility are not enough to prove that the whole script is current.
- No evidence supports removing or consolidating a script now. Simplification opportunity: establish whether the manual smoke scripts are still part of operator practice; if yes, make them safe on an isolated test DB, replace broad cleanup with exact fixture IDs, and expose/document invocation. If not used, preserve their unique behavioral checks as tests before removal.

## Recommendations requiring follow-up

No REMOVE or CONSOLIDATE recommendation is made. Before proposing either, answer:

1. Are `phase2-smoke.ts` and `phase3a-smoke.ts` still run manually by developers or operators?
2. Can they be restricted to a dedicated test database, and should they run through `LEADBRIDGE_TEST_DATABASE_URL` like integration tests?
3. Does current intended lead deletion behavior still include hard deletion, as asserted by Phase 2?
4. Is Phase 3A's prefix cleanup expected to remove old fixtures, or should it only clean rows created by the current run?
5. Is the 25-row seed size still the intended use, given older performance documentation describing much larger data generation?

## Final summary

1. **Scripts reviewed:** 4.
2. **Keep:** `run-postgres-integration-tests.mjs`, `seed-leads.ts`.
3. **Proposed for removal or consolidation:** None. The phase smoke scripts need usage and safety review before a removal decision.
4. **Unresolved questions:** See the five follow-up questions above, especially whether smoke scripts are still manually operated and what database isolation is expected.
5. **Recommended cleanup actions, in priority order:** (1) Do not run `phase3a-smoke.ts` against a shared or valuable database until its broad prefix deletions are resolved; (2) establish safe isolated-DB requirements for both smoke scripts; (3) verify Phase 2 hard-delete expectations and current script coverage; (4) verify seed size expectations against current performance needs; (5) then decide whether to document/package the smoke commands or migrate their unique assertions into automated integration tests.

No scripts or other project files were modified. This report is ready for review; implementation should wait for approval.

## Follow-up note — 2026-11-23

After this audit, approved cleanup removed `scripts/seed-leads.ts` and `scripts/phase2-smoke.ts`, and removed the `seed:leads` package command. The two remaining scripts from the original inventory, `scripts/phase3a-smoke.ts` and `scripts/run-postgres-integration-tests.mjs`, remain present. Prisma's configured seed command is separate: `prisma.config.ts` points to `tsx prisma/seed.ts`. This note records later changes and does not alter the original findings or recommendations.
