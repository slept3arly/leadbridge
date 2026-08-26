# LeadBridge Administration & Operations Guide

## Purpose

This document serves as the operational manual for LeadBridge administrators. It details all current administrative UI workflows, management tools, review queues, system monitoring, deployment instructions, and disaster recovery procedures.

---

## Administration Workflows & UI Guide

The Admin panel is accessed via `/admin` and requires an authenticated session with the `ADMIN` role.

```text
Admin Navigation Structure:
- Top Header Navbar: Global search, user profile, sign-out button
- Primary Bottom Bar:
  ├── Dashboard (/admin)
  ├── Leads (/admin/leads)
  └── Reports (/admin/reports)
- "More" Drawer Menu:
  ├── Connectors (/admin/connectors)
  ├── User Administration (/admin/users)
  ├── Providers (/admin/providers)
  ├── Audit Logs (/admin/audit-logs)
  └── Settings (/admin/settings)
```

---

### 1. Admin Dashboard (`/admin`)

The Admin Dashboard (`src/components/admin/admin-dashboard-client.tsx`) provides high-level organizational oversight:

- **Summary KPI Cards**: Total Leads, Active Connectors, Global Conversion Rate, and Monthly New Leads.
- **Priority Breakdown**: Visual distribution of leads categorized by priority (`URGENT`, `HIGH`, `MEDIUM`, `LOW`).
- **Recent Activity Feed**: Real-time log of recent lead creations, assignments, status updates, and connector syncs.
- **Quick Action Bar**: Fast shortcuts to provision users, add providers, manage connectors, and view reports.

---

### 2. Lead Management (`/admin/leads`)

Location: `src/components/leads/admin-leads-page-content.tsx`.

- **Lead Table & Toolbar**: Displays all leads across the organization with pagination, search, status filters (`NEW`, `CONVERTED`, `LOST`, `SPAM`, `ON_HOLD`), and priority filters.
- **Creating Leads**: Admins can manually create leads via the "Create Lead" modal.
- **Editing Leads**: Clicking a lead row opens `LeadEditModal`, enabling updates to contact info, company details, financial budget/expected value, currency, status, priority, and custom fields.
- **Assigning Leads**: Admins assign leads to sales representatives using `POST /api/leads/[id]/assign`.
- **Soft Deletion**: Admins can soft-delete leads (`DELETE /api/leads/[id]`). Soft-deleted records remain retained in the database for audit and retention workflows.

---

### 3. User Administration (`/admin/users`)

Location: `src/components/users/users-page-content.tsx`.

- **User Provisioning**: Admins provision internal users via `UserTableControls` and `POST /api/users`. Public registration remains disabled.
- **Role Assignment**: Assign roles (`ADMIN` or `SALES`) and sales privilege levels (`JUNIOR` or `SENIOR`).
- **User Editing**: Modify name, email, phone, employee code, designation, and active status using `UserEditModal` (`PATCH /api/users/[id]`).
- **Ban & Deactivation**: Deactivate or ban users with optional ban reasons and expiration timestamps.

---

### 4. Providers & Routing (`/admin/providers`)

Location: `src/components/providers/providers-page-content.tsx`.

- **Provider Management**: Create and edit vendor records (`LeadSource`) with unique names, slugs, and source types using `ProviderEditModal`.
- **Routing Rule Engine**: Configure priority-based routing rules (`RoutingRule`) matching sender email, domain, subject line, recipient Gmail account, or fallback catch-all rules.
- **Gmail Account Discovery**: Inspect discovered Gmail accounts configured via `GMAIL_<KEY>_*` environment variables.
- **Unmatched Email Queue**: Review inbound emails that failed routing matches (`UnmatchedEmail`). Actions include assigning to a provider, creating a new provider, marking as ignored/spam, or opening a parser request.
- **Parser Request Queue**: Review vendor sample requests (`ParserRequest`) requiring developer attention for new parser creation.

---

### 5. Connector Management (`/admin/connectors`)

Location: `src/components/connectors/connectors-page-content.tsx`.

- **Connector Controls**: Enable/disable connectors, configure polling schedule types (`MANUAL`, `EVERY_5_MIN`, `HOURLY`, etc.), and set schedule parameters via `ConnectorEditModal` (`PATCH /api/connectors/[id]/settings`).
- **Manual Sync Execution**: Trigger an immediate sync for any connector via the "Sync" action (`POST /api/connectors/[id]/sync`).
- **Execution Lock Management**: If a connector remains stuck in `isRunning=true` due to a server crash, admins can force-release the lock.
- **Connection Testing**: Test Gmail OAuth or REST configuration using the "Test Connection" action (`POST /api/providers/connectors/test`).
- **Connector Deletion**: Delete obsolete connectors (`DELETE /api/connectors/[id]`).

---

### 6. Sync History (`SyncHistoryModal`)

Location: `src/components/connectors/sync-history-modal.tsx`.

- Inspect detailed `ConnectorSyncRun` execution history for any connector (`GET /api/providers/sync-runs?connectorId=<id>`).
- View started/completed timestamps, records seen, created, updated, and skipped.
- Review error messages and JSON breakdown metadata for failed or partial sync runs.

---

### 7. Analytics & Reports (`/admin/reports`)

Location: `src/components/admin/admin-reports.tsx`.

- **Date Range Picker**: Filter report data by presets (Today, Last 7 Days, Last 30 Days, This Month, Custom Range).
- **Summary Metrics**: High-level lead generation totals, conversion rates, and average resolution times.
- **Source Distribution**: Breakdown of lead volume by provider source.
- **Assignment Analytics**: Lead distribution across sales team members.
- **Status & Activity Metrics**: Lead status funnel and daily activity volume charts.
- **Monthly Conversion Trends**: Historical monthly lead creation vs conversion trends.

---

### 8. Audit Logs (`/admin/audit-logs`)

Location: `src/components/audit/audit-log-viewer.tsx`.

- **Human-Readable Action Descriptions**: Formats raw action keys into readable text (e.g. "Created lead John Doe", "Updated user role to ADMIN", "Triggered manual connector sync").
- **Filtering**: Filter logs by Activity Type, Entity Type (`Lead`, `User`, `Connector`, `Setting`), Actor, or Date Range.
- **JSON Diff Viewer**: Expandable inspector showing `oldData` vs `newData` side-by-side.
- **CSV Audit Export**: Export filtered audit logs directly to CSV via `ExportButton` (`GET /api/audit-logs/export`).

---

### 9. System Settings (`/admin/settings`)

Location: `src/components/admin/admin-settings.tsx`.

- **Categorized System Settings**: Configure system-wide parameters grouped into General, Notifications, Integrations, and Security categories.
- **Reading & Saving**: Fetched via `GET /api/settings` and updated atomically via `PATCH /api/settings`.

---

### 10. Follow-ups System

Location: `src/components/sales/follow-up-panel.tsx` & `/sales/tasks`.

- **Scheduling Follow-ups**: Schedule tasks for specific leads with due dates, due times, and priority levels (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **Status Tracking**: Transition follow-up tasks between `PENDING`, `COMPLETED`, and `CANCELLED` (`PATCH /api/follow-ups/[id]`).
- **Attention Center Grid**: View urgent, pending, and today's follow-ups in a unified filterable card grid (`attention-center.tsx`).

---

### 11. Data Export System

Location: `src/components/shared/export-button.tsx`.

- Export CSV reports for **Leads**, **Users**, **Providers**, **Sync Runs**, and **Audit Logs**.
- Triggers server-side CSV streaming (`GET /api/export?type=...&format=csv`).

---

## Operations, Deployment & Recovery

### Environment Variables

| Variable | Description | Required |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `BETTER_AUTH_SECRET` | Secret key for Better Auth sessions | Yes |
| `BETTER_AUTH_URL` | Canonical app URL for Better Auth callbacks | Yes |
| `NEXT_PUBLIC_APP_URL` | Client-side base URL for auth client | Yes |
| `ADMIN_NAME` | Initial administrator name for database seed | Yes |
| `ADMIN_EMAIL` | Initial administrator email for database seed | Yes |
| `ADMIN_PASSWORD` | Initial administrator password for database seed | Yes |
| `LOG_LEVEL` | Pino logging level (`info`, `debug`, `warn`, `error`) | No (default: `info`) |
| `GMAIL_<KEY>_CLIENT_ID` | OAuth2 Client ID for discovered Gmail account | Conditional |
| `GMAIL_<KEY>_CLIENT_SECRET` | OAuth2 Client Secret for discovered Gmail account | Conditional |
| `GMAIL_<KEY>_REFRESH_TOKEN` | OAuth2 Refresh Token for discovered Gmail account | Conditional |

---

### Local Setup & Bootstrap

```bash
# 1. Install dependencies
pnpm install

# 2. Generate Prisma Client
pnpm db:generate

# 3. Apply database migrations
pnpm db:migrate

# 4. Seed initial admin account & defaults
pnpm prisma db seed

# 5. Launch development server
pnpm dev
```

---

### Production Deployment

```bash
# 1. Generate client and typecheck
pnpm db:generate
pnpm typecheck
pnpm lint

# 2. Build production bundle
pnpm build

# 3. Start production server
pnpm start
```

---

### In-Process Scheduler

The scheduler service (`schedulerService`) discovers due connectors and executes them sequentially. It is triggered via:

```bash
POST /api/scheduler/trigger
```

Set up an external cron service (e.g. Vercel Cron, system crontab, or GitHub Actions) to call `POST /api/scheduler/trigger` at your desired interval (e.g., every 5 minutes).

---

### System Monitoring & Troubleshooting

1. **Stuck Connector Lock**:
   - Symptoms: Connector status displays `isRunning=true` indefinitely.
   - Fix: Open Admin > Connectors, click the Edit modal for the connector, and select "Force Release Lock".

2. **Connector Health Degraded (`WARNING` / `ERROR`)**:
   - Symptoms: Health badge shows `WARNING` (1-2 consecutive failures) or `ERROR` (>= 3 failures).
   - Fix: Inspect Admin > Connectors > Sync History modal for error trace. Validate credentials or API endpoint. Re-run manually.

3. **Routing Failures & Unmatched Emails**:
   - Symptoms: Connector executes successfully but 0 leads are created.
   - Fix: Open Admin > Providers > Unmatched Emails queue. Assign unmatched emails to providers or update routing rules.

4. **Database Recovery**:
   - Perform regular PostgreSQL backups (`pg_dump`).
   - Run standard Prisma migration procedures (`prisma migrate deploy`) during production releases.

---

## Related Documents

- [01_PROJECT_OVERVIEW.md](./01_PROJECT_OVERVIEW.md)
- [02_ARCHITECTURE.md](./02_ARCHITECTURE.md)
- [03_DEVELOPMENT_GUIDELINES.md](./03_DEVELOPMENT_GUIDELINES.md)
- [05_ARCHITECTURE_AUDIT.md](./05_ARCHITECTURE_AUDIT.md)
- [06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md](./06_REST_CONNECTOR_IMPLEMENTATION_REPORT.md)
