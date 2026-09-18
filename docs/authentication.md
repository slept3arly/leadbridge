# LeadBridge Authentication

> **Status:** Canonical
> **Last verified:** 2026-09-17
> **Source of truth:** `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts`, `src/lib/permissions.ts`, `src/middleware.ts`

## Overview

Authentication is handled by `better-auth` with credentials-only login (email + password). Public signup is disabled. Users are provisioned exclusively by administrators.

## Configuration

```typescript
// src/lib/auth.ts
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [
    admin({
      defaultRole: "SALES",
      adminRoles: ["ADMIN"],
      roles: { ADMIN: adminAc, SALES: userAc },
    }),
  ],
  // Session defaults: expiresIn=60*60*24*7 (7 days), updateAge=60*60*24 (1 day)
  // Not explicitly set in code; uses better-auth defaults.
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          // Updates lastLoginAt on session creation
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "SALES", input: false },
      active: { type: "boolean", required: true, defaultValue: true, input: false },
      banned: { type: "boolean", required: true, defaultValue: false, input: false },
      banReason: { type: "string", required: false, input: false },
      banExpires: { type: "date", required: false, input: false },
      salesPrivilege: { type: "string", required: false, input: true },
    },
  },
  session: {
    additionalFields: {
      impersonatedBy: { type: "string", required: false, input: false },
    },
  },
});
```

## Roles

| Role | Access |
|---|---|
| `ADMIN` | Full system access. Manages users, providers, connectors, reports, settings, leads. |
| `SALES` | Sales operations. Works assigned leads, creates notes, schedules follow-ups. |

Configured via `adminRoles: ["ADMIN"]` and `defaultRole: "SALES"` in the better-auth admin plugin.

## Sales Privileges

| Privilege | Permissions |
|---|---|
| `JUNIOR` | Standard salesperson. No special permissions beyond SALES defaults. |
| `SENIOR` | Senior salesperson. Has `CREATE_LEAD`, `DELETE_LEAD`, `ARCHIVE_LEAD`, `EXPORT_LEADS`. |

## Permissions

```typescript
// src/lib/permissions.ts
enum Permission {
  CREATE_LEAD = "CREATE_LEAD",
  DELETE_LEAD = "DELETE_LEAD",
  ARCHIVE_LEAD = "ARCHIVE_LEAD",
  EXPORT_LEADS = "EXPORT_LEADS",
}

function can(user: PermissionUser, permission: Permission): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "SALES") {
    const privilege = user.salesPrivilege ?? SalesPrivilege.JUNIOR;
    return SALES_PRIVILEGE_PERMISSIONS[privilege]?.includes(permission) ?? false;
  }
  return false;
}
```

## Session Helpers

```typescript
// src/lib/session.ts
async function getSession(): Promise<AppSession | null>  // Returns session or null
async function requireSession(): Promise<AppSession>      // Throws redirect to /login
async function canAccessProtectedSession(): Promise<boolean>
```

## API Authorization

```typescript
// src/lib/api.ts
function withApiAuthorization(allowedRoles: string[])     // Checks role
function withPermissionAuthorization(permission: Permission) // Checks granular permission
```

## Middleware

```typescript
// src/middleware.ts
// Checks for session cookie (better-auth.session_token or __Secure-...)
// Redirects:
//   - Unauthenticated: /admin/*, /sales/* → /login
//   - Authenticated: /login → /
// Matcher: /login, /admin/:path*, /sales/:path*
```

## Client-Side Auth

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/client";
export const authClient = createAuthClient({ plugins: [adminClient()] });
```

## Secret Management

| Secret | Storage | Exposed to Frontend |
|---|---|---|
| `BETTER_AUTH_SECRET` | Environment variable | Never |
| `DATABASE_URL` | Environment variable | Never |
| Gmail OAuth credentials | Environment variables (`GMAIL_<KEY>_*`) | Never |
| REST API auth keys/tokens | `Connector.configuration` JSON (DB) | Partially -- see below |

### REST Connector Secret Exposure

The connectors page (`src/app/(dashboard)/admin/connectors/page.tsx`) serializes `configuration` to the client via `toSafeConfiguration()`. This function sanitizes secrets:

- **Exposed:** `baseUrl`, `endpoint`, `method`, `leadArrayPath`, `timeout`, `retryCount`, `rateLimitDelayMs`, `auth.type`, `auth.apiKey.name`, `auth.apiKey.in`, `pagination.*`
- **Sanitized (boolean only):** `headersConfigured`, `queryParamsConfigured`, `bodyConfigured`, `auth.apiKey.configured`, `auth.bearerTokenConfigured`, `auth.basic.usernameConfigured`, `auth.basic.passwordConfigured`, `auth.customHeader.valueConfigured`
- **Never exposed:** Actual header values, query param values, body content, API key values, bearer tokens, basic auth passwords, custom header values
