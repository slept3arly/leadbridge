# LeadBridge API Reference

> **Status:** Canonical
> **Last verified:** 2026-11-05
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
| `/api/leads` | POST | `CREATE_LEAD` permission | Create lead and optionally its initial interaction/follow-up atomically |
| `/api/leads/[id]` | GET | Any authenticated | Get lead details |
| `/api/leads/[id]` | PATCH | Any authenticated | Update lead fields |
| `/api/leads/[id]` | DELETE | `DELETE_LEAD` permission | Permanently delete lead and cascade-deleted dependent records |
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
| `/api/scheduler/trigger` | POST | ADMIN session or `Authorization: Bearer <SCHEDULER_TRIGGER_SECRET>` | Trigger due connectors; only an Admin session can request a specific connector |

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

- `createLeadRequestSchema` -- Manual lead creation, including at least one of email or phone and optional initial activity
- `leadSchema` -- Lead update fields
- `interactionActivitySchema` -- Shared structured activity validation for standalone logging and lead creation
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

### Manual lead creation payload

`POST /api/leads` accepts the normal lead fields plus an optional `initialActivity` object. A valid request includes a Name and at least one of Email or Phone. Email is optional, whitespace is trimmed, and a non-empty value must be valid. Phone is optional, but a non-empty value must consist of exactly 10 digits. Empty or whitespace-only optional contact values normalize to null. The same email/phone shape validation is used by lead updates; the create-only at-least-one-contact rule does not prevent edits to existing contactless records. When provided, the activity requires an action (`CALL` or `WHATSAPP`), a compatible response, and Interest exactly when the response is `PICKED_UP` or `REPLIED`. Notes are optional. Follow-up scheduling is optional; when enabled, `followUpDate` is required and `followUpTime` is optional. Activity actor and follow-up assignee are derived from the authenticated session and existing follow-up policy; the payload cannot set either user ID.

```json
{
  "name": "Example Lead",
  "email": "lead@example.test",
  "initialActivity": {
    "action": "CALL",
    "response": "PICKED_UP",
    "interest": "INTERESTED",
    "notes": "Requested a product catalogue.",
    "scheduleFollowUp": true,
    "followUpDate": "2026-12-01T10:00:00.000Z",
    "followUpTime": "10:00"
  }
}
```

Lead, SYSTEM/CREATED event, optional INTERACTION event and entries, and optional follow-up are committed in one transaction. Requests without `initialActivity` remain valid. The standalone `POST /api/leads/[id]/activities` remains Sales-only.

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
