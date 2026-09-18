# LeadBridge API Reference

> **Status:** Canonical
> **Last verified:** 2026-09-17
> **Source of truth:** `src/app/api/`

## Overview

38 API route files under `src/app/api/`. All use Next.js App Router HTTP verb exports (`GET`, `POST`, `PATCH`, `DELETE`).

## Authentication Patterns

- `withApiAuthorization(undefined)` -- any authenticated user (both ADMIN and SALES)
- `withApiAuthorization("ADMIN")` -- ADMIN role only
- `withPermissionAuthorization(Permission.X)` -- checks granular permission (ADMIN always passes; SALES requires SENIOR privilege for supported permissions)
- Public: only `/api/auth/[...all]`

## Routes (38 files, 55+ handlers)

### Authentication

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/[...all]` | ALL | Public | Better Auth authentication handlers |

### Dashboard

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/dashboard` | GET | Any authenticated | Role-derived dashboard metrics (ADMIN or SALES) |

### Leads

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/leads` | GET | Any authenticated | List leads with pagination, search, filters |
| `/api/leads` | POST | `CREATE_LEAD` permission | Create lead manually |
| `/api/leads/[id]` | GET | Any authenticated | Get lead details |
| `/api/leads/[id]` | PATCH | Any authenticated | Update lead fields |
| `/api/leads/[id]` | DELETE | `DELETE_LEAD` permission | Soft-delete lead |
| `/api/leads/[id]/assign` | POST | ADMIN | Assign lead to sales user |
| `/api/leads/[id]/activities` | GET | Any authenticated | Get lead activity timeline |
| `/api/leads/[id]/notes` | GET | Any authenticated | List lead notes |
| `/api/leads/[id]/notes` | POST | Any authenticated | Add note to lead |
| `/api/leads/[id]/follow-ups` | GET | Any authenticated | List lead follow-ups |
| `/api/leads/[id]/follow-ups` | POST | Any authenticated | Create follow-up for lead |
| `/api/leads/[id]/details` | GET | Any authenticated | Get lead with notes, follow-ups, activities |

### Lead Sources

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/lead-sources` | GET | Any authenticated | List active lead sources |
| `/api/lead-sources` | POST | ADMIN | Create lead source (reactivates if soft-deleted) |
| `/api/lead-sources/[id]` | DELETE | ADMIN | Deactivate lead source (soft delete: sets `active: false`) |

### Follow-ups

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/follow-ups/[id]` | PATCH | Any authenticated | Update or reschedule follow-up |
| `/api/follow-ups/[id]/complete` | POST | Any authenticated | Complete follow-up |
| `/api/follow-ups/[id]/delete` | DELETE | Any authenticated | Delete follow-up |

### Notes

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/notes/[id]` | PATCH | Any authenticated | Update note |
| `/api/notes/[id]` | DELETE | Any authenticated | Delete note |

### Activities

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/activities/[id]` | GET | Any authenticated | Get activity event details |

### Users

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/users` | GET | ADMIN | List users with pagination |
| `/api/users` | POST | ADMIN | Provision new user |
| `/api/users/[id]` | PATCH | ADMIN | Update user |

### Providers (Routing & Integration Management)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/providers` | GET | ADMIN | List providers with connector & routing info |
| `/api/providers` | POST | ADMIN | Create provider |
| `/api/providers/[id]` | PATCH | ADMIN | Update provider |
| `/api/providers/[id]` | DELETE | ADMIN | Delete provider |
| `/api/providers/routing-rules` | GET | ADMIN | List routing rules |
| `/api/providers/routing-rules` | POST | ADMIN | Create routing rule |
| `/api/providers/routing-rules/[id]` | PATCH | ADMIN | Update routing rule |
| `/api/providers/routing-rules/[id]` | DELETE | ADMIN | Delete routing rule |
| `/api/providers/connectors/test` | POST | ADMIN | Test connector connection |
| `/api/providers/gmail` | GET | ADMIN | List Gmail accounts from env |
| `/api/providers/unmatched` | GET | ADMIN | List unmatched emails |
| `/api/providers/unmatched` | PATCH | ADMIN | Process unmatched email |
| `/api/providers/parser-requests` | GET | ADMIN | List parser requests |
| `/api/providers/parser-requests` | PATCH | ADMIN | Update parser request status |
| `/api/providers/parsers` | GET | ADMIN | List parser catalog |
| `/api/providers/sync-runs` | GET | ADMIN | List sync run history |

### Connectors

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/connectors` | GET | ADMIN | List connector types |
| `/api/connectors` | POST | ADMIN | Create connector (accepts `configuration` for REST type) |
| `/api/connectors/[id]` | PATCH | ADMIN | Update connector |
| `/api/connectors/[id]` | DELETE | ADMIN | Delete connector |
| `/api/connectors/[id]/settings` | PATCH | ADMIN | Update connector settings (accepts `configuration` for REST type, `enabled`, `scheduleType`, `scheduleConfig`, `resetHealth`, `sourceId`) |
| `/api/connectors/[id]/sync` | POST | ADMIN | Trigger manual sync |

### Parsers

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/parsers` | GET | ADMIN | List parser manifests |
| `/api/parsers/preview` | POST | ADMIN | Preview parser on sample payload |

### Scheduler

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/scheduler/trigger` | POST | ADMIN | Trigger due connectors |

### Reports

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/reports` | GET | ADMIN | Generate analytics reports |

### Settings

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/settings` | GET | ADMIN | Get system settings |
| `/api/settings` | PATCH | ADMIN | Update system settings |

### Export

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/export` | GET | Any authenticated | Download CSV export |

### Cache / State

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/resync` | POST | Any authenticated | Revalidate cached dashboard/attention tags |

## Validation

All request bodies are validated with Zod schemas from `src/lib/validation.ts`:

- `leadSchema` -- Lead create/update
- `followUpSchema` -- Follow-up create/update
- `noteSchema` -- Note create/update
- `userSchema` -- User create/update
- `providerSchema` -- Provider create/update
- `routingRuleSchema` -- Routing rule create/update
- `assignmentSchema` -- Lead assignment
- `loginSchema` -- Login form
- `settingSchema` -- Settings update
- `restConnectorConfigSchema` -- REST connector configuration
- `unmatchedActionSchema` -- Unmatched email action

## Error Handling

API routes use `handleApiError()` from `src/lib/api.ts` which returns structured JSON errors:

```json
{ "error": "Error message", "details": "Additional context" }
```

HTTP status codes: 400 (validation), 401 (unauthenticated), 403 (forbidden), 404 (not found), 409 (conflict/duplicate), 500 (internal).

## Dead/Empty API Directories

The following directories exist but contain no `route.ts` files:

- `src/app/api/audit-logs/` -- empty (AuditLog model was removed)
- `src/app/api/mock/leads/` -- empty
- `src/app/api/sync/` -- empty
- `src/app/api/follow-ups/[id]/cancel/` -- empty
