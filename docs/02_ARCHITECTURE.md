# LeadBridge Architecture

## Overall architecture

LeadBridge is a Next.js 16 App Router application. Server-rendered pages and route handlers sit at the application edge; services contain domain and persistence orchestration; Prisma 7 accesses PostgreSQL through the `@prisma/adapter-pg` adapter; Better Auth owns credentials, sessions, and account records.

```text
Browser
  -> Next.js pages / route handlers
       -> session + Zod validation
            -> service layer
                 -> Prisma 7 client + PrismaPg adapter
                      -> PostgreSQL (Neon-ready)
```

This arrangement keeps request concerns (HTTP, redirects, validation) out of domain services, and keeps vendor-specific ingestion concerns outside the lead model.

## Folder and layer responsibilities

| Layer | Locations | Why it exists |
| --- | --- | --- |
| Presentation | `src/app`, `src/components` | App Router co-locates routes with layouts; reusable components prevent dashboard markup from diverging. |
| Application boundary | `src/app/api`, `src/lib/session.ts`, `src/lib/validation.ts` | Routes authenticate, authorize, validate, and shape HTTP responses before calling services. |
| Domain/application services | `src/services` | Encapsulates lead, user, assignment, audit, connector, duplicate, parser, and automation behavior so pages and APIs do not own persistence logic. |
| Integration contracts | `src/connectors`, `src/parsers`, `src/types` | Provides stable, vendor-neutral inputs for future ingestion. |
| Infrastructure | `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/lib/logger.ts`, `prisma` | Centralizes database, auth, logging, schema, migration, and seed configuration. |

## Routing and protected routes

The root page reads the session and redirects to `/login`, `/admin`, or `/sales`. The route group `(dashboard)` organizes dashboard source files without adding a URL segment.

- `/login` renders the credential login form and redirects an existing session to its workspace.
- `/admin/*` uses the admin layout and is protected for `ADMIN` by `requireSession` in the layout.
- `/sales/*` uses the sales layout and is protected for `SALES` by its layout.
- `/api/auth/[...all]` delegates authentication endpoints to Better Auth.
- `/api/leads`, `/api/users`, `/api/connectors`, `/api/sync`, `/api/reports`, and `/api/settings` are server route handlers.

`src/middleware.ts` performs a fast cookie-presence redirect for dashboard URLs and avoids showing login to a user who already has a session cookie. It is a navigation optimization only. The authoritative checks are `getSession` and `requireSession`, which read Better Auth session data server-side, reject inactive/banned users, and enforce the requested application role. New protected code must use `requireSession`; do not treat the middleware cookie check as authorization.

## Authentication and role-based access

Better Auth is configured with the Prisma adapter and credentials enabled. `disableSignUp: true` means accounts are administrator-provisioned. The admin plugin is explicitly configured with the application’s uppercase roles:

| Role | Current access model |
| --- | --- |
| `ADMIN` | Better Auth admin permissions; Admin dashboard/layout; full lead list; user and connector administration routes; lead deletion. |
| `SALES` | Sales dashboard/layout; leads API list is scoped to `assignedUserId`; sales stats are scoped to the current user. |

The bootstrap seed creates the initial `ADMIN` and its `credential` account. It hashes the supplied password through Better Auth’s own crypto export, matching the configured default password verifier. It exits without change if an admin already exists.

## Database and Prisma architecture

PostgreSQL is the sole datastore. The schema is in `prisma/schema.prisma`; migrations live in `prisma/migrations`; `prisma.config.ts` supplies the datasource URL, migration path, and `tsx prisma/seed.ts` seed command.

Prisma 7 generates into `src/generated/prisma`, not the legacy default generated location. `src/lib/prisma.ts` creates `PrismaPg` from `DATABASE_URL` and passes it to `new PrismaClient({ adapter })`. In development, the client is retained on `globalThis` to avoid extra instances after hot reloads. This is required Prisma 7 adapter-based initialization and must remain centralized.

Key model groups:

- **Identity:** `User`, `Session`, `Account`, `Verification`, matching Better Auth’s Prisma adapter expectations.
- **CRM core:** `Lead`, `LeadSource`, `LeadActivity`, `Note`, `Attachment`.
- **Integration configuration:** `Connector`, `Parser`, `FieldMapping`.
- **Operations:** `AuditLog`, `Setting`.

`Lead` indexes support assigned-user/status, connector/source, email, and phone queries. `LeadActivity` indexes lead history by creation time. `AuditLog` indexes entity lookup and chronology. These choices support the current queries and anticipated ingestion/audit reads without prematurely adding speculative indexes.

## Service layer

Services are small classes exported as shared instances. They are not a repository abstraction; they are the application’s business-operation boundary.

- `leadService` lists, counts, creates, updates, and deletes leads. Create/update add activity records and audit records.
- `duplicateService` looks for exact email/phone matches before creation.
- `assignmentService` assigns a lead, writes activity, and audits the change.
- `userService` lists users, lists active sales assignees, and returns role counts.
- `auditService` writes the database audit record and structured Pino event.
- `connectorService` lists persisted connector metadata and invokes a connector contract’s auth/sync methods.
- `parserService` exposes parser registry lookup/listing.
- `automationService` is explicitly a stub.

Use services from pages and route handlers instead of placing raw Prisma queries in new UI code. This protects audit behavior and gives future jobs/connectors a reusable entry point.

## Connector and parser architecture

A connector implements `Connector` in `src/connectors/types.ts`:

```ts
key; authenticate(); fetch(); normalize(record); sync();
```

It returns `NormalizedLead`, a shared internal shape rather than a vendor payload. The connector contract makes fetch/auth/sync lifecycle explicit and is designed so future vendors can be introduced without changing lead pages or the core schema.

Parsers are a complementary transformation layer. Each extends `BaseParser<T>`, has a stable `key`, and returns `NormalizedLead`. `parserRegistry` is an in-memory `Map`; it currently contains only `ExampleParser`. There is no parser persistence, dynamic loading, or job dispatch yet. The `Parser` database model is reserved for future configuration, not wired to execution.

## Reusable component strategy

`src/components/ui` contains small presentational primitives (`Button`, `Card`, `Input`, `Select`, `Textarea`, `Badge`, modal/error/loading/empty states). Feature components such as `LeadForm`, `CreateUserForm`, `DataTable`, `Sidebar`, and `Navbar` compose them. Use a server component by default; mark a component `"use client"` only when it needs browser state, event handlers, router interaction, or browser APIs.

This keeps dashboard pages focused on data composition while retaining a consistent visual language. Current client forms use Axios and reload after successful mutation; this is intentionally simple v1 behavior, not a client state-management framework.

## Validation, errors, logging, and caching

**Validation:** Zod schemas in `src/lib/validation.ts` define login, lead, user, and setting inputs. Route handlers call `safeParse`; invalid input returns a `400` JSON response containing `flatten()` output. Services assume their public API route callers validated inputs, so new external entry points must validate too.

**Errors:** No global application error taxonomy or route-level exception mapper exists. Better Auth handles authentication endpoint failures; unhandled database errors propagate through Next.js. Future work should add deliberate `404`, conflict, ownership, and operational-error handling before expanding external APIs.

**Logging:** `src/lib/logger.ts` configures Pino using `LOG_LEVEL` (default `info`). `auditService` writes structured logs and durable audit rows. Do not log passwords, tokens, raw connector credentials, or unnecessary PII.

**Caching:** There is no intentional application cache, Redis layer, or Next data-cache policy. Current server data is queried per request/render. Add caching only after identifying a read pattern and defining invalidation for mutations and connector syncs.

## Environment configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma config/client and seed. |
| `BETTER_AUTH_SECRET` | Secret for Better Auth session/security operations. |
| `BETTER_AUTH_URL` | Canonical server URL used by Better Auth. |
| `NEXT_PUBLIC_APP_URL` | Browser-visible base URL used by the Better Auth client. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Bootstrap values consumed only by `pnpm prisma db seed` when no admin exists. |
| `LOG_LEVEL` | Pino severity threshold. |

Keep real values in platform environment configuration or local `.env`; `.env.example` documents names only. Never commit secrets.

## Deployment, Neon, and scalability

The application is Vercel-oriented: Next.js can deploy pages and route handlers as managed server workloads, while Neon supplies hosted PostgreSQL through `DATABASE_URL`. Prisma’s PostgreSQL adapter is used instead of a local connection-specific workaround, making the client configuration appropriate for this deployment model. Configure production environment variables in Vercel, use the canonical production URL for both auth URL variables, and run migrations/seed as an explicit deployment/bootstrap operation rather than during ordinary request handling.

Current scalability posture is appropriate for a foundation but has boundaries:

- Serverless instances make in-process registries and job execution unsuitable for distributed background work; move sync/automation to a durable queue or scheduler when implemented.
- Connector credentials should be encrypted or delegated to a secret manager; do not place them unprotected in `Connector.configuration`.
- Add pagination, selective projections, indexes measured from real query plans, and database-level uniqueness/idempotency rules as import volume grows.
- Treat connector syncs as retryable, idempotent operations with source references and observability before enabling schedules.
- Use Vercel-friendly server rendering and avoid shipping server-only modules to client components. Optimize images/fonts and route payloads only when those assets/features are introduced.

The future connector strategy is therefore contract first, then one well-observed integration at a time: authenticate, fetch, parse/normalize, deduplicate, persist through the service layer, record activity/audit data, and update sync state.
