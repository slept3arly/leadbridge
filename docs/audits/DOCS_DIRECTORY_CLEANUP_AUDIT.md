# LeadBridge Documentation Directory Cleanup Audit

**Audit date:** 2026-11-23  
**Scope:** All 55 Markdown documents present in `docs/` at the start of this audit (14 root documents, 6 archived documents, 9 audit reports, and 26 experiments). Creating this report brings the directory total to 56.  
**Mode:** Read-only audit; this report is the only file created. No existing documentation, source, configuration, or Git state was modified.

## 1. Executive summary

The documentation system has a useful source-of-truth hierarchy and a sensible distinction between canonical guides, dated experiments, completed audits, and archived references. The material should be preserved. The main issue is discoverability and freshness: `docs/README.md` is dated 2026-11-05, links to only a subset of the experiments, has no audit-report index, and does not explain how to distinguish a current contract from a historical implementation snapshot.

Several canonical claims are demonstrably stale against the current checkout:

- `development.md` lists `pnpm seed:leads`, but the current `package.json` has no such script and `scripts/seed-leads.ts` is absent. (`prisma/seed.ts` and the Prisma configured seed command still exist.)
- `backend.md` lists the removed `AssignmentService` and still describes it in the service table.
- `frontend.md` says `src/hooks/index.ts` is empty, but it was removed in the approved source cleanup stage; its “Loading States (6)” list omits currently present route loading files.
- `database.md` omits `LeadStatus.OLD`, states 17 migrations where 21 directories currently exist, and presents the 2026-11-07 external Neon migration status as current. The application target is local PostgreSQL; current deployment/database migration state cannot be inferred from source and was not queried.
- `api.md` has endpoint/method mismatches: it omits `PATCH /api/activities/[id]`, documents `PATCH /api/connectors/[id]` although the route only exports `DELETE` (settings use a separate route), and omits `PATCH /api/providers/routing-rules`.
- `integrations.md` says `ConnectorRuntime` acquires/releases the execution lease; the manual API route and scheduler service own lock acquisition/release around runtime execution.
- `IMPLEMENTATION_AUDIT.md` remains a “Plan — Ready for Implementation” document even though multiple named local components are absent from current source and the dashboard now uses shared tables. It needs a status/currency review.

The archive and experiment collections are valuable as decision and implementation history. Do not remove them merely because they repeat facts that have since moved into canonical guides. Instead, add a complete index with dates, status, scope, and links to current canonical references. No document is recommended for deletion on present evidence.

## 2. Inventory and classification

Classification meanings: **KEEP** = retain as-is, with historical status honored; **UPDATE** = correct current technical content; **CONSOLIDATE** = reduce duplicate navigation/content while preserving the original record; **MOVE** = relocate a document to better match its purpose; **DELETE** = remove only with evidence that it has no historical/current value. `UPDATE` below means a future approved docs-only change, not work performed in this audit.

### Root-level documentation

| Document | Purpose | Classification | Evidence / rationale |
|---|---|---|---|
| `docs/README.md` | Canonical documentation map and reading order. | UPDATE / CONSOLIDATE | Last verified 2026-11-05; omits the `audits/` collection and most experiments (13–25), and labels the implementation plan as an active guide. Add links to concise audits/experiments indexes and refresh verification date. |
| `docs/architecture.md` | Current system stack, request/data flow, architectural rules, routes, and component areas. | UPDATE | Strong concise overview, but its unconditional “service layer owns all business logic” description does not reflect direct Prisma/business logic currently in connector API routes. Align “intended rule” vs “current exception” with source. |
| `docs/database.md` | Prisma config, schema inventory, relations, indexes, delete behavior, migration notes. | UPDATE | Current schema has `OLD`; actual migration directory has 21 entries, not the stated 17. Historical external-Neon migration claims need an explicit as-of snapshot; current DB application state is unknown. |
| `docs/backend.md` | Service catalog, domain workflows, validation, cache and data-access conventions. | UPDATE | `AssignmentService` was deleted; direct service count/list is stale. Other lifecycle detail is substantial and should be retained after a reference check. Migration status text is snapshot-specific. |
| `docs/frontend.md` | Current routes, data fetching, workflow UI, navigation, components, hooks, and loading states. | UPDATE | `hooks/index.ts` was removed; current loading route files exceed the listed six. Preserve workflow behavior details but regenerate inventories from current source. |
| `docs/UI_DESIGN_SYSTEM.md` | UI tokens, primitives, implementation rules, component catalog, accessibility guidance, and technical-debt notes. | UPDATE | Useful canonical design contract, but the 732-line file mixes stable rules with changing component inventory/current gaps. Status/priority tables omit `OLD`/`COLD`; portions of the “Current Gaps” section are now resolved or need re-verification. Split stable rules from dated implementation notes if desired. |
| `docs/api.md` | API route/method/authentication reference. | UPDATE | Current `route.ts` exports show missing `PATCH /api/activities/[id]` and `/api/providers/routing-rules`, and a nonexistent `PATCH /api/connectors/[id]`; verify the full table against the 40 route files. |
| `docs/authentication.md` | Better Auth config, role/permission rules, proxy and secret handling. | KEEP | Last verified 2026-09-17, older than other canonical guides, but the core distinctions match current auth structure. Schedule a targeted review of auth field configuration and serialized REST secret handling before changing it. |
| `docs/integrations.md` | Connector/parser/runtime/routing/scheduler reference. | UPDATE | Runtime flow is useful; lease ownership is assigned to runtime incorrectly. Registry examples use a `factoryRegistry.set` idiom rather than the current private `Map` plus `register()` helper. Recheck retry, lock, scheduler, and destination-policy figures against current modules. |
| `docs/performance.md` | Current query/cache architecture and measured-vs-estimated bottlenecks. | UPDATE | Good separation of current code and theoretical estimates; refresh source-derived query counts and avoid categorical claims such as “PostgreSQL handles it trivially.” No live performance measurements were made in this audit. |
| `docs/development.md` | Setup, commands, environment, conventions, verification, deployment, scheduler. | UPDATE | `pnpm seed:leads` is absent from current scripts and its script file was removed. “Empty barrel files” section is stale after the source cleanup. Retain `prisma db seed` instructions after confirming generated client/env prerequisites. |
| `docs/local-operations.md` | Local PostgreSQL migration, backup/restore, readiness, and scheduler runbook. | KEEP | Clear local-host scope and appropriately distinguishes untested restore examples from verified behavior. Keep external database history out of this operational runbook. |
| `docs/rest-connector-testing.md` | Canonical manual REST connector walkthrough using the standalone mock. | KEEP | The 354-line procedure is specific and distinguishes prior manual observations from automated coverage and unverified cases. Keep as the single full end-to-end walkthrough; link the mock README for package startup. |
| `docs/IMPLEMENTATION_AUDIT.md` | Admin dashboard improvement inventory and implementation plan. | MOVE / UPDATE | It calls itself “Plan — Ready for Implementation.” Current source no longer contains named `KpiStat`, `InsightCard`, `HealthBadge`, or `WorkQueueRow` functions; several recommendations appear implemented. Move under `audits/` and mark status/resolution after confirming exact completion evidence. |

### `docs/archive/` — superseded records

| Document | Purpose | Classification | Evidence / rationale |
|---|---|---|---|
| `archive/01_PROJECT_OVERVIEW.md` | Early project overview, roles, repository map, and related files. | KEEP / UPDATE links | Clearly historical, but describes removed audit-log UI/service and outdated tree. Eleven relative links to source/schema paths are broken from this directory; one points to nonexistent `src/services/audit.service.ts`. Preserve as history; repair only if archive links are expected to remain navigable. |
| `archive/02_ARCHITECTURE.md` | Earlier architecture/data-flow/API/design reference. | KEEP | Explicitly superseded by current canonical docs; contains removed audit-log flow and older API behavior. Its archive marker is sufficient protection against use as current guidance. |
| `archive/03_DEVELOPMENT_GUIDELINES.md` | Earlier development and extension guide. | KEEP / UPDATE links | Marked superseded, but contains 6 broken relative links (`../src/...` from `docs/archive/` resolves incorrectly). Retain its historic examples and correct links only if useful. |
| `archive/04_ADMINISTRATION_AND_OPERATIONS.md` | Earlier Admin workflows and deployment/operations guide. | KEEP | Contains removed Audit Logs page and old workflow paths. Clearly archived; retain as historical UI/operational snapshot rather than current runbook. |
| `archive/05_ARCHITECTURE_AUDIT.md` | Earlier architecture/security audit and API inventory. | KEEP | A dated audit record, not an active implementation guide. Its route and security claims are from an earlier code state. Preserve for decision history. |
| `archive/06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md` | Detailed early REST connector implementation report. | KEEP | Large historical reference (809 lines) with setup/API assumptions that have since changed. The current source of truth is `integrations.md` plus `rest-connector-testing.md`; keep the archive banner and avoid using the report to configure current connectors. |

### `docs/audits/` — dated reviews and implementation records

| Document | Purpose | Classification | Evidence / rationale |
|---|---|---|---|
| `audits/MOCK_REST_API_CLEANUP_AUDIT.md` | Audit of standalone mock package, uses and risks. | KEEP | Dated cleanup artifact that preserves rationale for retaining the fixture; useful alongside the connector test guide. |
| `audits/MY_LEADS_UI_UX_ACCESSIBILITY_AND_DATA_AUDIT.md` | Source review of My Leads UX/accessibility/data usage. | KEEP | Recommendations and code observations are explicitly distinguished; retain as a dated audit, not a current requirement list. |
| `audits/PHASE_1_IMPLEMENTATION_REPORT.md` | Completed Phase 1 My Leads implementation record. | KEEP | Historical work/results and limitations are valuable; do not merge into the current frontend guide. |
| `audits/PHASE_2_IMPLEMENTATION_REPORT.md` | Completed Phase 2 implementation record. | KEEP | Historical implementation/verification snapshot. |
| `audits/PROJECT_DIRECTORY_INVENTORY.md` | Repository directory tree and cleanup candidates. | UPDATE / KEEP snapshot | Inventory predates the source cleanup and script deletions. It should be dated/superseded when the cleanup series is reconciled; preserve its original snapshot. |
| `audits/PUBLIC_DIRECTORY_CLEANUP_AUDIT.md` | Public asset inventory and usage assessment. | KEEP | Dated report with evidence; retain until an approved implementation supersedes its recommendations. |
| `audits/ROOT_DIRECTORY_CLEANUP_AUDIT.md` | Root files/configuration audit. | KEEP | Historical audit findings; its worktree assumptions should remain attached to its date. |
| `audits/SCRIPTS_DIRECTORY_CLEANUP_AUDIT.md` | Script inventory and safety review. | UPDATE / KEEP snapshot | It records four scripts including `phase2-smoke.ts` and `seed-leads.ts`; current `scripts/` has only two files and package scripts no longer expose `seed:leads`. Preserve as a before-cleanup audit and explicitly note later changes. |
| `audits/SRC_DIRECTORY_CLEANUP_AUDIT.md` | Source directory map and architecture audit. | UPDATE / KEEP snapshot | It inventories 288 source files and recommends removing four files; the four were removed in the approved Stage 1. Preserve the audit, but add a later resolution/snapshot note when documentation changes are approved. |

### `docs/experiments/` — proposals, snapshots, implementation phases

| Document | Purpose | Classification | Evidence / rationale |
|---|---|---|---|
| `experiments/07_PERFORMANCE_ARCHITECTURE_ASSESSMENT.md` | 250k-lead performance estimates under a hosted Neon/Vercel model. | KEEP | Historical estimates are not current deployment instructions; README labels experimental. Preserve as original sizing analysis, and keep estimates explicitly theoretical. |
| `experiments/08_FREE_TIER_CAPACITY_ASSESSMENT.md` | Free-tier vendor capacity/cost estimates. | KEEP / MOVE (optional) | Point-in-time prices/limits from 2026-09 are time-sensitive and no longer describe the local deployment. Preserve as research history; optionally move to archive or add “historical pricing snapshot” status. |
| `experiments/09_PERFORMANCE_BASELINE_AUDIT.md` | Code-level performance baseline without DB measurements. | KEEP | Explicitly says findings are not measured; preserve as historical baseline and prefer `performance.md` for current patterns. |
| `experiments/11_LOCAL_MAX_PERFORMANCE_AUDIT.md` | Large local deployment performance assessment. | UPDATE / MOVE (optional) | 1,700-line historical report contains technically false current-driver claims: it calls `@prisma/adapter-pg` a Neon HTTP driver, while `src/lib/prisma.ts` uses PrismaPg with the Node PostgreSQL adapter. Preserve the history, but add a prominent superseded notice or move under archive; do not delete. |
| `experiments/12_V1_PRODUCTION_READINESS_AUDIT.md` | 2026-10 release-readiness security/data review. | KEEP | Findings are historical and many were later changed (CSV formula neutralization, REST URL policy, sync fencing, follow-up lifecycle). Preserve as the contemporaneous risk record; do not present as current open findings without a disposition index. |
| `experiments/13_REPOSITORY_WIDE_IMPROVEMENT_AUDIT.md` | 2026-11-05 broad source review. | KEEP | Dated review and explicit static-audit limits; preserve. Its migration count and follow-up risks are a source snapshot, not current truth. |
| `experiments/14_PERFORMANCE_FRESHNESS_MAINTAINABILITY_AUDIT.md` | 2026-11-05 local performance/freshness audit and proposals. | KEEP | Useful audit provenance; some findings (cross-tab freshness, raw payload projection) are already superseded by current code/docs, while it refers to Neon-oriented example config. Keep dated and avoid treating recommendations as open. |
| `experiments/15_LEAD_WORKFLOW_AND_MODAL_ARCHITECTURE_AUDIT.md` | Early workflow/modal behavior and duplication review. | KEEP | Historical discovery that led to later workflow contracts; preserve its source-state limitation. |
| `experiments/16_LEAD_WORKFLOW_CONTRACTS.md` | Intended Add Lead and Record Progress contracts. | KEEP | Contract and implementation history; later phases and current source supersede it where they differ. |
| `experiments/17_LEAD_UI_REFINEMENT_PLAN.md` | UI refinement findings/specification. | KEEP | A dated investigation, not current guidance. Preserve decisions and open recommendations. |
| `experiments/18_EXPORT_SYSTEM_AUDIT.md` | Initial export source audit/specification. | KEEP | Its “implementation has not begun” status is historically true only at its audit date; phases 20–24 and current source document later delivery. Preserve chronology. |
| `experiments/19_EXPORT_SYSTEM_CONTRACTS.md` | Export metadata and contract baseline. | KEEP | Useful design decision record; current live contract is in `api.md` and `integrations`/export source. Keep as contract history. |
| `experiments/20_EXPORT_QUERY_ARCHITECTURE.md` | Export query/filter implementation phase. | KEEP | Dated implementation note; preserve details that explain design and deviations. |
| `experiments/21_EXPORT_DELIVERY_RELIABILITY.md` | Export streaming, time/size limits and logging implementation. | KEEP | Current `api.md` and source remain authoritative; report is the historical phase record. |
| `experiments/22_EXPORT_UI_IMPLEMENTATION.md` | Export workspace UI implementation phase. | KEEP | Implementation history; do not duplicate into canonical guides. |
| `experiments/23_EXPORT_SYSTEM_FINAL_REVIEW.md` | Final export integration review and test snapshot. | KEEP | Historical verification status; preserve as recorded evidence. |
| `experiments/24_EXPORT_ADVANCED_LEAD_FILTERS.md` | Advanced export filter and lead-number compatibility note. | KEEP | Dated feature record; current endpoint/filter descriptions belong in `api.md`. |
| `experiments/25_LEAD_WORKFLOW_REDESIGN_AUDIT.md` | Workflow redesign audit with Phase 5 resolution note. | KEEP | Explicitly marks pre-Phase 5 findings and resolution. Useful audit trail; database migration deployment status remains environment-dependent. |
| `experiments/26_LEAD_WORKFLOW_BUSINESS_CONTRACTS.md` | Approved workflow business rules and lifecycle implementation status. | KEEP / UPDATE status qualifier | Contract content is useful; “migration remains unapplied” and Neon database statements are 2026-11-09 environment observations, not current DB state. Preserve with as-of date. |
| `experiments/27_DISTRICT_COMPATIBILITY_ASSESSMENT.md` | District compatibility and database data inventory. | KEEP | Explicitly identifies a read-only historical database snapshot. Do not use its Neon row counts as current data facts. |
| `experiments/28_WORKFLOW_ENUMS_AND_FORM_UX_AUDIT.md` | 2026-11-10 workflow enum/default audit. | KEEP | Historical database/source snapshot; later placeholder and OLD-status implementation docs supersede parts. Preserve undecided owner decisions. |
| `experiments/29_PLACEHOLDERS_AND_DEFAULTS_REVIEW.md` | Placeholder/default recommendations. | KEEP | Its proposed wording is implemented by 30; preserve as decision record, not a live proposal. |
| `experiments/30_PLACEHOLDERS_AND_DEFAULTS_IMPLEMENTATION.md` | Implementation result for approved wording changes. | KEEP | Compact implementation record with test evidence; retain. |
| `experiments/31_LEAD_STATUS_AND_CUSTOM_DROPDOWNS.md` | OLD enum addition and Radix select conversion record. | KEEP / UPDATE environment status | Source confirms `OLD` and Radix select; “not applied to any database” is a dated deployment claim that must not be repeated as current without checking the intended database. |
| `experiments/32_EXPORT_SYSTEM_UX_AND_CAPABILITY_AUDIT.md` | 2026-11-15 export UX/capability audit. | KEEP | Most recent export audit; clearly states source review and limitations. Its unresolved metadata/product proposals are not approved requirements. |
| `experiments/HOSTING_COMPARISON_2026.md` | Vendor/platform comparison with September 2026 prices and sources. | KEEP / MOVE (optional) | Point-in-time market research conflicts with current local-host deployment if read as deployment guidance. Preserve for decision history; add “historical comparison, not current recommendation” or archive it. |

## 3. Specific outdated or conflicting technical claims

### Current source/config evidence

- **Routes:** 40 current `src/app/api/**/route.ts` files. The exported methods in source are authoritative. `src/app/api/activities/[id]/route.ts` has GET and PATCH; `src/app/api/providers/routing-rules/route.ts` has GET, POST, and PATCH; `src/app/api/connectors/[id]/route.ts` has DELETE only, while connector settings PATCH is `/api/connectors/[id]/settings`.
- **Schema:** `prisma/schema.prisma` defines 17 enums, 19 models, and includes `LeadStatus.OLD`, lead priority `COLD`, and nullable `FollowUp.cancelledAt`. `docs/database.md` lists 17 enums and 19 models but its LeadStatus list omits OLD.
- **Migrations:** 21 migration directories currently exist. `docs/database.md` states 17 in two places and its listed range ends at connector execution fencing. Further migrations add district, follow-up lifecycle, workflow enum options, and OLD status. This audit did not query any database; whether any migration is applied is unknown.
- **Services:** After the approved Stage 1 cleanup, `src/services/assignment.service.ts` no longer exists. `backend.md` retains the class/table row. Current direct `src/services/*.ts` file count is 21; avoid interpreting that as 21 domain services without accounting for infrastructure modules.
- **Development scripts:** Current root package scripts include dev/build/start/lint/typecheck/test, integration tests, DB operations, and Prisma generation. `seed:leads` is absent. `prisma/seed.ts` is configured in `prisma.config.ts`; `scripts/seed-leads.ts` has been removed.
- **Deployment target:** repository instructions and `docs/local-operations.md` specify a local Next.js app and local PostgreSQL. Older experiment docs preserve hosted Neon/Vercel assumptions; those are historical, not current infrastructure guidance.
- **Prisma driver:** current package includes `@prisma/adapter-pg`, and `src/lib/prisma.ts` creates `PrismaPg` from the PostgreSQL connection string. Calling this a Neon HTTP driver in experiment 11 is technically wrong for current code.
- **Lock ownership:** manual sync route and `SchedulerService` own lock/heartbeat lifecycle and pass execution ownership/fence context into `ConnectorRuntime`; `integrations.md` incorrectly describes the runtime itself as acquiring and releasing the lock.
- **UI status catalog:** current schema/catalog contains `OLD` and `COLD`; the UI design guide’s status/priority tables omit them.
- **Source cleanup:** Stage 1 removed the empty hooks/jobs/utils barrels and `AssignmentService`. Historical source/script inventory reports correctly describe their earlier snapshot but should not be read as current inventory.

### Canonical content that remains useful

The current request flow, authorization boundary distinction (proxy cookie checks are not authorization), workflow contracts, export delivery constraints, local backup/restore guidance, REST SSRF policy, and explicit experimental estimate labeling are valuable. Prefer targeted corrections rather than broad rewrites. Source remains authoritative where prose and implementation disagree.

## 4. Duplication, overlap, and disposition

1. **Current implementation vs phase reports:** `architecture.md`, `backend.md`, `api.md`, `integrations.md`, and `performance.md` describe current behavior. Experiments 15–32 record discovery, approval, implementation, and review over the same lead/export areas. These are different document purposes; do not merge them into a giant guide. Add phase/status/date metadata and make canonical guide precedence explicit.
2. **Performance reports:** experiments 07, 09, 11, and 14 repeat query/cache topics under different deployment assumptions. Keep the historical chain; direct readers to `performance.md` for current behavior and clearly supersede the false Neon-driver recommendation in 11.
3. **REST connector guidance:** `integrations.md` is the compact architecture reference, `rest-connector-testing.md` is the operator walkthrough, and archive 06 is the original build report. These are complementary by purpose. Keep current and archive references distinguished.
4. **Export docs:** `api.md` and `backend.md` hold the current endpoint/service contract, while experiments 18–24 are sequential audit/spec/implementation records and experiment 32 is a later capability audit. Preserve phase sequence; index by status and date.
5. **README coverage:** all root canonical files are linked, but `audits/` is not indexed and most dated experiments are absent. A short `audits/README.md` and `experiments/README.md`, linked from the main README, would reduce navigation clutter without consolidating away history.
6. **Historical duplication:** archive documents repeat current topics by design. Their explicit superseded warnings make deletion unnecessary; fixing broken relative links is the only clear maintenance need.

## 5. Links and documentation index

- A local relative-link check found **17 broken relative Markdown targets**, all in two archived documents: 11 in `archive/01_PROJECT_OVERVIEW.md` and 6 in `archive/03_DEVELOPMENT_GUIDELINES.md`. Their `../src/...` and `../prisma/...` links resolve inside `docs/` instead of the repository root; archive paths need an additional `../`. The `src/services/audit.service.ts` target in archive 01 is absent even after correcting the relative depth.
- No broken relative links were found in the current root guides, current audit reports, or experiments with this check. This result covers relative file existence; it does not validate external URLs or every heading fragment.
- `docs/README.md` has no `audits/` section and omits experiments 13–25. Experiments 26–32 are selectively listed. Readers cannot discover all dated artifacts from the official map.
- `docs/audits/` currently contains nine documents, including untracked cleanup reports from prior authorized audits. None is indexed from `docs/README.md`.
- The README states “Archived (superseded by canonical docs)” and warns not to use archive files as implementation guidance. This is effective and should remain.
- The exact API route count is current (40), but route/method rows need a source-driven review as noted above.

## 6. Recommended documentation structure

Keep current implementation guidance shallow and make historical material searchable by date/status:

```text
docs/
  README.md                     # primary map; canonical guides and index links
  architecture.md               # concise system boundaries and request flow
  api.md                        # route/method/auth reference
  authentication.md
  backend.md                    # current services and workflow invariants
  database.md                   # schema and migration directory facts; no stale live DB status
  development.md                # current commands and contributor setup
  frontend.md                   # current route/UI overview
  UI_DESIGN_SYSTEM.md           # stable visual/accessibility contract
  integrations.md               # current connector/runtime contract
  performance.md                # verified patterns and clearly labeled estimates
  local-operations.md           # local PostgreSQL runbook
  rest-connector-testing.md     # repeatable manual fixture workflow
  audits/
    README.md                   # date, scope, status, and index of reports
    ...                         # preserve source snapshots and implementation records
  experiments/
    README.md                   # topics and phase chronology (workflow, export, performance, hosting)
    ...                         # preserve phase reports and point-in-time studies
  archive/
    README.md or existing README notice
    ...                         # superseded references, explicitly non-canonical
```

Do not create multiple new explanatory narratives. Index existing reports and keep one current source-of-truth guide per implementation concern. `IMPLEMENTATION_AUDIT.md` belongs with dated audits/plans once its completion status is established.

## 7. Prioritized cleanup plan

| Stage | Scope | Proposed work | Dependencies / risk | Required review | Independent? |
|---|---|---|---|---|---|
| 1. Correct proven stale canonical facts | `api.md`, `backend.md`, `database.md`, `development.md`, `frontend.md` | Fix exact route methods; remove AssignmentService row and empty barrel note; update OLD and migration count; remove nonexistent seed:leads command; refresh loading inventory. | Low risk if strictly source-derived. Do not assert live DB migration state without an authorized DB inspection. | Route export scan; package scripts; schema/migration directory counts; source route/page counts. | Yes, small docs-only changes. |
| 2. Fix integration and current performance descriptions | `integrations.md`, `architecture.md`, `performance.md`, optionally `authentication.md` | Correct lock owner/runtime diagram; verify registry example, retry limits, settings/secret behavior, and current query counts; keep estimates labeled. | Medium because security/runtime descriptions must be exact. | Targeted source/config review; no unmeasured latency claims. | Mostly independent. |
| 3. Restore navigation discoverability | `docs/README.md`; new `audits/README.md` and `experiments/README.md` if approved | Add date/status/topic index links for every report; distinguish current canonical references from snapshots. | Low; links must match exact filenames. | Automated relative-link/anchor check. | Yes. |
| 4. Annotate audit snapshots after approved cleanup stages | `PROJECT_DIRECTORY_INVENTORY.md`, `SCRIPTS_DIRECTORY_CLEANUP_AUDIT.md`, `SRC_DIRECTORY_CLEANUP_AUDIT.md` | Add concise “later changes” notes or preserve as clearly dated before-state reports. Do not rewrite old evidence. | Low, but should occur after corresponding cleanup stages are finalized. | Compare each report’s observed inventory with final repository state. | Yes, one report at a time. |
| 5. Mark long-lived proposals and implementation records | `IMPLEMENTATION_AUDIT.md`, experiment 11, 12, 18, 26, 27, 31, and hosting comparison | Add explicit current/superseded/implemented/as-of labels; move implementation plan to `audits/` only after confirming status. | Low-medium; risk is incorrectly declaring a recommendation resolved. | Confirm code evidence and preserve database observations with dates. | Yes. |
| 6. Repair archived links | `archive/01_PROJECT_OVERVIEW.md`, `archive/03_DEVELOPMENT_GUIDELINES.md` | Correct repository-root relative paths; mark permanently absent targets as removed/no current equivalent or link to the relevant history. | Low; keep content and archive status intact. | Validate links against filesystem. | Yes. |
| 7. Revisit overlaps only if future navigation shows friction | `UI_DESIGN_SYSTEM.md`, root implementation plan and phase reports | Optionally move changing inventory/current-gap material into dated audit notes; leave stable design rules in the canonical design guide. | Medium; avoid broad rewrite and loss of historical findings. | Compare current guide against components and owner preference. | Optional. |

## 8. Removal and decision summary

- **Documents recommended for deletion:** None. Historical audit reports, phase plans, and implementation records retain provenance and useful decisions.
- **Consolidation recommended:** Navigation only—add lightweight audit/experiment indexes and link from `docs/README.md`; do not merge phase reports into canonical guides.
- **Move candidate:** `IMPLEMENTATION_AUDIT.md` from the root docs map into `docs/audits/`, after its current status is confirmed. Optionally move hosted pricing/obsolete performance reports into archive, but a superseded banner may be enough.
- **Items requiring owner decision:** whether experiment 11 and hosted pricing study should remain under `experiments/` or move to `archive/`; whether the Admin dashboard implementation plan is complete and should be converted to a report; whether audit indexes should list every report or only a compact dated catalog; whether the old Neon database observations should remain in `database.md` or live only in the dated experiment record.

## Audit limitations

This review used current source/config/schema and relative-link existence checks; it did not query a database, verify external URLs/pricing, run a Markdown renderer, or validate every external anchor. Migration deployment state and external cron/hosting use remain environment-specific. Recommendations are proposals only; no documentation cleanup beyond creation of this report was performed.
