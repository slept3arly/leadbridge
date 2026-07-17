# LeadBridge Administration & Operations Guide

## Purpose

This document is for the small internal team that runs LeadBridge day to day.
It covers the real admin workflows in the current codebase and the operational
steps needed to deploy and recover the app.

## Scope

- Single organization
- One PostgreSQL database
- One Next.js deployment
- About 2 administrators and 8 to 10 sales users
- Internal CRM usage only

Do not use this document to plan multi-tenant, distributed, or enterprise-scale
operations. Those assumptions do not apply here.

## Administration workflows

### User management

Admins can provision internal users from the Admin dashboard and `POST /api/users`.
The backend path is:

```text
Admin UI -> /api/users -> auth.api.createUser -> Better Auth + Prisma
```

What this means in practice:

- Public signup stays disabled.
- The seed script creates the first administrator.
- Subsequent users are created by an admin.
- Roles are limited to `ADMIN` and `SALES`.

> Screenshot placeholder: Admin > Users page showing the create-user form and user table.

### Lead management

Admins can create, edit, delete, restore, and assign leads from the Admin > Leads
screen. Sales users can view assigned leads and work the leads that belong to them.

Typical lead workflows:

1. Create a lead manually when a record has not yet been imported.
2. Assign the lead to a sales user.
3. Add notes and follow-up dates as the lead progresses.
4. Restore a soft-deleted lead if it was removed in error.

Important behavior:

- `DELETE /api/leads/[id]` is admin-only and soft-deletes.
- `POST /api/leads/[id]/assign` is admin-only and validates the assignee.
- `POST /api/leads/[id]/notes` and `PATCH /api/notes/[id]` enforce lead access.
- `POST /api/leads/[id]/restore` reactivates a soft-deleted lead.

> Screenshot placeholder: Admin > Leads page with create form, table, and restore section.

### Providers and routing

The Providers area is the control center for source ownership, routing rules,
connector configuration, and sync visibility.

Current provider workflows:

- Create a provider record with a name, slug, and source type.
- Link routing rules to a provider and parser.
- Review discovered Gmail accounts from environment variables.
- Create a generic REST connector configuration.

Routing rules are evaluated in priority order. The first matching rule wins.
If a routed Gmail payload has no match, the system can record it in the
`UnmatchedEmail` queue for review.

> Screenshot placeholder: Admin > Providers page showing provider list, routing rules, connector cards, and queues.

### Connectors

The connector screen is operational, not hypothetical.

Admins can:

- Enable or disable a connector.
- Change its schedule type.
- Trigger a manual sync.
- Reset a stuck lock.
- Review health state, last sync time, and error history.

Supported runtime types in the current codebase:

- `gmail`
- `rest`

Connector status and health are persisted in the database.

### Gmail accounts

Environment discovery looks for `GMAIL_<KEY>_CLIENT_ID`,
`GMAIL_<KEY>_CLIENT_SECRET`, and `GMAIL_<KEY>_REFRESH_TOKEN`.

The Providers page lists each discovered account and shows whether it is ready.
Admin actions include:

- Test the credentials.
- Sync the associated connector.
- Review imported history and last run metadata.

### Sync history

Each connector run writes a `ConnectorSyncRun` row. The Providers page shows:

- records seen
- records created
- records updated
- records skipped
- duration
- errors
- breakdown metadata

This is the primary place to inspect what happened during a sync.

### Unmatched emails and parser requests

The app keeps two review queues:

- `UnmatchedEmail` for emails that did not route cleanly.
- `ParserRequest` for vendor samples that need a parser authored later.

Admin actions available on the Providers page:

- Assign the email to a provider.
- Create a new provider from the email.
- Mark the item ignored or spam.
- Open a parser request.

### Settings, reports, and exports

The current UI includes Settings and Reports pages, and the backing APIs are
implemented.

- `GET /api/settings` returns the current configuration and setting definitions.
- `PATCH /api/settings` validates input and updates settings atomically.
- `GET /api/reports` supports `summary`, `sources`, `assignments`, `activity`, `trends`, and `status`.
- `GET /api/export` supports CSV downloads for leads, users, providers, and sync history.
- `GET /api/dashboard` serves role-derived admin or sales metrics.

Operational notes:

- Settings writes are validated server-side before they reach Prisma.
- Reports and exports are admin-only.
- Dashboard data is derived from the authenticated session, not query parameters.

> Screenshot placeholder: Admin > Settings page with grouped setting sections.
> Screenshot placeholder: Admin > Reports page with filters and summary cards.
> Screenshot placeholder: Admin > Export action dropdown or modal.

## Deployment and operations

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma and the seed script. |
| `BETTER_AUTH_SECRET` | Better Auth secret for sessions and credential handling. |
| `BETTER_AUTH_URL` | Canonical server URL for Better Auth. |
| `NEXT_PUBLIC_APP_URL` | Browser-visible base URL used by the auth client. |
| `ADMIN_NAME` | Initial admin name used by `prisma db seed`. |
| `ADMIN_EMAIL` | Initial admin email used by `prisma db seed`. |
| `ADMIN_PASSWORD` | Initial admin password used by `prisma db seed`. |
| `LOG_LEVEL` | Pino logging level. |
| `GMAIL_<KEY>_CLIENT_ID` | Gmail OAuth client ID for a discovered account. |
| `GMAIL_<KEY>_CLIENT_SECRET` | Gmail OAuth client secret for a discovered account. |
| `GMAIL_<KEY>_REFRESH_TOKEN` | Gmail refresh token for a discovered account. |

Keep secrets out of Git. Use your platform environment store or a local `.env`.

### Local bootstrap

```bash
pnpm install
pnpm db:generate
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

If you change the schema:

1. Update `prisma/schema.prisma`.
2. Create or review the migration.
3. Regenerate the Prisma client.
4. Typecheck before handoff.

### Production build

```bash
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm build
```

Use the same commands in CI if you want a simple, reproducible release check.

### Scheduler and sync entry points

There are two operational sync entry points:

- `POST /api/connectors/[id]/sync` runs one connector immediately.
- `POST /api/scheduler/trigger` runs due connectors or a specific connector ID.

Important caveat:

- The scheduler is in-process and uses a database lock.
- It is not a queue worker and it is not a distributed scheduler.
- Only one execution per connector should run at a time.

### Database and backups

Current operating assumptions:

- One PostgreSQL database.
- Prisma owns schema changes.
- Connector syncs and admin edits write directly to the database.

Recommended operational baseline:

1. Back up the database regularly.
2. Verify restore procedures before you need them.
3. Keep migration history under version control.
4. Treat connector configuration as production data.

### Logging and monitoring

Logging is through Pino and the audit service:

- `src/lib/logger.ts` sets the log level.
- `auditService.log()` writes a durable audit row and a structured log entry.
- Sync runs persist counts and errors in `ConnectorSyncRun`.

Monitor at least:

- failed auth attempts
- connector health warnings
- consecutive connector failures
- stuck execution locks
- sync duration trends

### Recovery

If a connector appears stuck:

1. Check the connector status and lock state in Admin > Providers.
2. Review the last sync run and error message.
3. Use the lock reset action only if the current execution is genuinely stale.
4. Re-run the sync manually after correcting the underlying issue.

If a schema or deployment change breaks the app:

1. Revert the deployment.
2. Check the latest migration.
3. Inspect the audit log and sync run records.
4. Restore the database from backup if the change was destructive.

### Common mistakes

- Treating the `sync` compatibility route as a production workflow.
- Assuming the scheduler is a queue service.
- Forgetting to configure Gmail credentials for every discovered environment key.
- Creating connector configs without matching them to a registered connector type.
- Leaving a connector enabled without a valid parser and routing rule.

## Related files

- [docs/01_PROJECT_OVERVIEW.md](./01_PROJECT_OVERVIEW.md)
- [docs/02_ARCHITECTURE.md](./02_ARCHITECTURE.md)
- [docs/03_DEVELOPMENT_GUIDELINES.md](./03_DEVELOPMENT_GUIDELINES.md)
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`prisma/seed.ts`](../prisma/seed.ts)
- [`src/app/api/providers/route.ts`](../src/app/api/providers/route.ts)
- [`src/app/api/connectors/route.ts`](../src/app/api/connectors/route.ts)
- [`src/app/api/connectors/[id]/sync/route.ts`](../src/app/api/connectors/[id]/sync/route.ts)
- [`src/app/api/scheduler/trigger/route.ts`](../src/app/api/scheduler/trigger/route.ts)
- [`src/components/provider-management.tsx`](../src/components/provider-management.tsx)
