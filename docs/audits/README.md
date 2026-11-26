# Audit and Implementation Report Index

This index covers every audit and implementation report in `docs/audits/`. Dates and status labels are taken from each document where stated; **not stated** means the report does not provide that metadata. Audits are point-in-time records and their recommendations are not approvals.

| Report | Date | Classification, scope, and purpose | Current guide |
|---|---|---|---|
| [Documentation directory cleanup audit](./DOCS_DIRECTORY_CLEANUP_AUDIT.md) | 2026-11-23 | Cleanup audit of the documentation tree; recommends freshness, navigation, and status-label improvements. | [Documentation index](../README.md) |
| [Export system end-to-end audit](./EXPORT_SYSTEM_END_TO_END_AUDIT.md) | 2026-11-26 | Read-only audit of the export UI, API route, services, queries, CSV delivery, tests, and docs; separates confirmed bugs, design weaknesses, risks, and recommendations. | [API](../api.md), [Backend](../backend.md), [Frontend](../frontend.md), [Performance](../performance.md) |
| [Mock REST API cleanup audit](./MOCK_REST_API_CLEANUP_AUDIT.md) | Not stated | Cleanup audit of `mock-rest-api/` and references; assesses fixture purpose, usage, and risks. | [REST connector testing](../rest-connector-testing.md), [Integrations](../integrations.md) |
| [My Leads UI/UX, accessibility, and data audit](./MY_LEADS_UI_UX_ACCESSIBILITY_AND_DATA_AUDIT.md) | 2026-11-17 | Historical source audit of the Sales My Leads list, filters, actions, workspace, accessibility, and data use; separates findings from recommendations and manual checks. | [Frontend](../frontend.md), [API](../api.md) |
| [Phase 1 implementation report](./PHASE_1_IMPLEMENTATION_REPORT.md) | 2026-11-17 | Completed implementation record for My Leads accessible names, URL/navigation state, row semantics, and result feedback. | [Frontend](../frontend.md) |
| [Phase 2 implementation report](./PHASE_2_IMPLEMENTATION_REPORT.md) | Not stated | Completed implementation record for My Leads text wrapping and a Go to Top control; records verification limits. | [Frontend](../frontend.md) |
| [Project directory inventory](./PROJECT_DIRECTORY_INVENTORY.md) | Not stated | Working-tree directory and file inventory; a snapshot rather than an active project specification. | [Documentation index](../README.md) |
| [Public directory cleanup audit](./PUBLIC_DIRECTORY_CLEANUP_AUDIT.md) | Not stated | Cleanup audit of public assets and repository references; records usage and retention recommendations. | [Frontend](../frontend.md) |
| [Root directory cleanup audit](./ROOT_DIRECTORY_CLEANUP_AUDIT.md) | Not stated | Cleanup audit of repository-root files and their references/dependencies. | [Development](../development.md) |
| [Scripts directory cleanup audit](./SCRIPTS_DIRECTORY_CLEANUP_AUDIT.md) | Not stated | Cleanup audit of scripts, invocation paths, dependencies, and operational risk. | [Development](../development.md), [Local Operations](../local-operations.md) |
| [Source directory cleanup audit](./SRC_DIRECTORY_CLEANUP_AUDIT.md) | 2026-11-23 | Cleanup and architecture audit of `src/`, including inventory, dependencies, and proposed staged changes. | [Architecture](../architecture.md), [Backend](../backend.md), [Integrations](../integrations.md) |
