# LeadBridge Roadmap

This roadmap distinguishes repository reality from planned work. “Completed” means code exists in the current repository; it does not imply production-scale maturity.

## Completed

### Foundation

- [x] Next.js App Router, TypeScript, pnpm, Tailwind CSS, and reusable component baseline.
- [x] PostgreSQL Prisma schema, migration foundation, Prisma 7 generated client, and `PrismaPg` adapter initialization.
- [x] Neon-ready `DATABASE_URL` configuration path.
- [x] Environment-driven, idempotent initial-admin seed.
- [x] Pino logger and audit-log persistence model.

### Authentication and user management

- [x] Better Auth credentials authentication.
- [x] Public registration disabled.
- [x] `ADMIN` and `SALES` roles, protected layouts, middleware redirects, and server-side session checks.
- [x] Admin user listing and internal user-creation flow.

### Lead CRUD and core model

- [x] Manual lead creation and listing UI.
- [x] Lead create/list/update/delete API routes (deletion is admin-only).
- [x] Lead statuses, priorities, assignment relationship, sources, connector references, activity, audit, note, attachment, and custom-field schema support.
- [x] Basic exact email/phone duplicate-candidate detection during lead creation.
- [x] Admin and sales summary counts.

### Connector framework

- [x] Vendor-neutral connector interface.
- [x] Normalized lead type.
- [x] Parser base class, registry, and example parser.
- [x] Connector/parser services and connector metadata list endpoint.

## Current

The active state is **v1.0 Foundation stabilization and documentation**. Current work should prioritize correctness, authorization completeness, data integrity, tests, and deployment readiness before adding broad feature surface.

Immediate hardening priorities:

- [ ] Add ownership checks for sales lead updates and any future mutations.
- [ ] Add consistent route/service error mapping for not-found, conflict, and database failures.
- [ ] Add tests for auth, seed idempotence, lead authorization, validation, and service side effects.
- [ ] Update the deprecated Next middleware convention when adopting the supported `proxy` replacement.
- [ ] Add pagination/search/filtering before lead lists grow beyond the current bounded query.

## Next

### Lead operations

- [ ] Complete assignment UI and assignment workflow using `assignmentService`.
- [ ] Add activity timeline, notes, and attachment workflows around existing schema models.
- [ ] Surface duplicate candidates and define merge/ignore resolution rules.
- [ ] Add lead filtering, search, pagination, and focused detail views.
- [ ] Define source/reference uniqueness and import idempotency policy.

### Connector Framework operationalization

- [ ] Persist connector configuration safely and implement enable/disable management.
- [ ] Build a durable sync job model with retries, rate-limit handling, logs, and `lastSyncedAt` updates.
- [ ] Replace the sync placeholder endpoint with an authorized job trigger.
- [ ] Add mapping/transform execution using the existing `FieldMapping` model.

### First integrations

- [ ] **REST API Integration:** implement one generic, documented inbound/outbound REST connector as the reference integration.
- [ ] **Gmail Integration:** implement only after defining OAuth credential storage, email parsing, deduplication, and job scheduling.

## Future

### Acquisition and automation

- [ ] **Meta Lead Ads:** connector, webhook verification, source mapping, idempotent import, and observability.
- [ ] **Duplicate Detection:** evolve from exact lookup to configurable match policy and resolution workflow.
- [ ] **Automation Engine:** replace the current stub with event-driven rules, safe retries, and auditability.
- [ ] **Notifications:** notification preferences, delivery abstraction, and failure handling.
- [ ] **WhatsApp:** provider integration only after consent, templates, rate limits, and message audit requirements are defined.

### Reporting and API

- [ ] **Reporting:** replace reporting placeholder with source, assignment, pipeline, and conversion reporting backed by defined metrics.
- [ ] **Public API:** versioned, authenticated external API with scoped credentials, rate limits, audit logs, and documentation.
- [ ] Settings UI/API backed by the existing `Setting` model and a defined configuration ownership model.

### Product delivery

- [ ] Import/export and bulk operations with validation, preview, and idempotency.
- [ ] File storage provider integration for attachments.
- [ ] Richer roles/permissions only if the two-role model no longer fits actual operational requirements.

## Long-term

- [ ] **AI Features:** assistive lead summarization, classification, routing suggestions, and duplicate assistance—only with privacy controls, human review, cost limits, and audit trails.
- [ ] **Mobile App:** a mobile client built on stable, versioned API contracts rather than direct database coupling.
- [ ] **Plugin System:** governed extension points for connectors, automations, or UI modules after contracts, sandboxing, versioning, and permission boundaries are mature.
- [ ] Multi-tenant or organization support only after product requirements define tenant isolation, billing, roles, data ownership, and migration strategy.
- [ ] Enterprise operations: observability, backups/recovery exercises, data retention, compliance controls, and performance scaling based on real usage.

## Milestone sequencing

| Milestone | Exit condition |
| --- | --- |
| Foundation | Authentication, schema, manual leads, admin bootstrap, and verification commands are stable. |
| Secure lead operations | Ownership, error handling, tests, list scalability, and audit completeness are addressed. |
| Connector Framework | One connector runs idempotently through durable jobs with observable outcomes. |
| Integration expansion | Gmail, REST API, and Meta integrations are added one at a time with source-specific tests. |
| Automation and reporting | Events, rules, notifications, and metrics have explicit data contracts and operational safeguards. |
| Platform | Public API, mobile, AI, and plugin work build on stable security and extension boundaries. |

Do not move roadmap items to Completed merely because a model, stub, navigation item, or placeholder endpoint exists. Completion requires an integrated, authorized, tested user or operational flow.
