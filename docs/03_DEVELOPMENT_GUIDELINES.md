# Development Guidelines

## Non-negotiable principles

1. Extend the existing architecture; do not rewrite working foundations for stylistic preference.
2. Keep implemented behavior and planned behavior clearly separate in code, UI, APIs, and docs.
3. Enforce security on the server. Client state and middleware are not authorization.
4. Prefer small, typed, reviewable changes over broad abstractions.
5. Preserve the internal-only account model: public signup must remain disabled.

## Project, naming, and folder conventions

| Concern | Convention |
| --- | --- |
| Files | kebab-case: `lead-delete-button.tsx`, `connector.service.ts`. |
| React components/classes | PascalCase: `LeadForm`, `LeadService`. |
| Functions/variables | camelCase. |
| Domain types | PascalCase; use `type` for shared data shapes unless interface extension is useful. |
| Services | Place in `src/services/<domain>.service.ts`; export one named class and one shared instance. |
| Route handlers | Place under `src/app/api/.../route.ts`; follow App Router HTTP method exports. |
| Pages/layouts | Use App Router conventions in `src/app`; use route groups for organization only. |
| UI primitives | Keep generic, reusable controls in `src/components/ui`; place domain-specific compositions beside other components. |
| Integrations | Connector contracts/implementations in `src/connectors`; parser implementations/registry entries in `src/parsers`. |

Use the `@/` alias for imports rooted at `src`. Do not edit `src/generated/prisma`; regenerate it with `pnpm prisma generate` after schema changes.

## Components and pages

- Server components are the default. Add `"use client"` only for state, events, browser APIs, or client navigation.
- Build pages by composing existing primitives (`Card`, `Button`, `Input`, `ErrorState`, etc.) before adding visual variants.
- Keep page files focused on layout and data composition. Put reusable interaction/forms in components and business work in services.
- Create a page under the correct role route group, protect it in the relevant layout or with `requireSession`, then add its navigation entry in `src/lib/navigation.ts` if it should be visible.
- Do not redesign dashboards or introduce a second styling system. Tailwind and the existing CSS custom properties are the visual baseline.
- Use stable database IDs as table keys when available; do not copy the current index-key pattern into new mutable tables.

## Services, Prisma, and database rules

- Route handlers and pages call services; services call Prisma. Do not scatter raw Prisma queries across new components.
- Add activity and audit records for material lead mutations. Follow `leadService` and `assignmentService` patterns.
- Select only fields a caller needs, especially for lists. Reuse or extend focused select objects rather than returning whole records by default.
- Keep authorization decisions near the boundary and ownership-sensitive logic in the service where it can be reused. New sales mutations must verify the lead is assigned to that sales user.
- Prisma 7 must remain adapter-based: import the generated client from `@/generated/prisma/client`, construct it with `PrismaPg`, and use the singleton from `src/lib/prisma.ts`.
- Change `prisma/schema.prisma`, create a reviewed migration, run `pnpm prisma generate`, then typecheck. Never hand-edit migrations after they have been applied to a shared environment.
- Use transactions when an operation must atomically alter a main record plus activity/audit records. Current multi-write services are a baseline, not a reason to ignore atomicity in new critical workflows.
- Add indexes only for demonstrated query patterns; inspect query plans and keep existing lead/audit indexes in mind.

## API, validation, and error conventions

- Authenticate every non-public handler with `requireSession`; pass a role for admin-only operations.
- Parse external request bodies with the appropriate Zod schema before invoking a service. Use `safeParse` and return a `400` response with useful, non-sensitive validation details.
- Derive TypeScript input types from Zod schemas where practical, as `LeadInput` does.
- Return semantic status codes: `201` for creation, `204` for successful empty deletion, `400` for invalid input, `401/403` through the auth layer, `404` for absent records, and `409` for conflicts when added.
- Never trust client-provided actor IDs, roles, ownership, or connector identity. Obtain the actor from the server session and connector identity from trusted configuration.
- Do not use `any`, `@ts-ignore`, blanket unsafe casts, or validation bypasses to make a check pass. Isolate and document an unavoidable cast narrowly.

## Authentication conventions

- Better Auth owns sessions and credential account handling. Keep `emailAndPassword.disableSignUp` enabled.
- Application role names are exactly `ADMIN` and `SALES`; do not introduce casing variants or raw Better Auth defaults such as `admin`/`user`.
- The only supported bootstrap path is `pnpm prisma db seed`, supplied with `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. The seed is idempotent and must remain so.
- Admin user provisioning goes through `auth.api.createUser` so credentials and Better Auth records are created correctly.
- Middleware is only an early redirect. Every server action, route, or page that reads protected data needs authoritative session enforcement.

## Adding a connector

1. Define/configure the source in the `Connector` and `LeadSource` models only if persistence is needed; create a migration first.
2. Implement the `Connector` interface with a stable, unique `key`.
3. Keep vendor HTTP/auth logic inside that connector. Validate external payloads before treating them as data.
4. Normalize each record to `NormalizedLead`; never pass raw vendor payloads into the lead service.
5. Make sync idempotent using the source reference and appropriate database constraints/lookup logic.
6. Persist or update connector sync state deliberately, emit structured logs, and record lead activity/audit information through services.
7. Add retries, rate-limit handling, and a durable job/scheduler before exposing scheduled sync. Do not use a Vercel request or in-memory process as a long-running queue.
8. Add focused tests and document required secrets/environment variables without committing values.

## Adding a parser

1. Extend `BaseParser<T>` with a stable `key` and a narrow input type.
2. Validate/guard untrusted input and return only the normalized internal lead shape.
3. Register the parser in `parserRegistry` explicitly.
4. Keep parser code deterministic and side-effect free; fetching, persistence, and retries belong to connectors/services/jobs.
5. Add fixtures/tests for normal, partial, malformed, and duplicate-prone input.

## TypeScript, performance, and deployment standards

- Keep `strict` TypeScript satisfied. Run `pnpm typecheck` before handoff.
- Use `import type` for type-only imports and avoid untyped JSON propagation.
- Keep client bundles small: do not import Prisma, Pino, secrets, or server services into client components.
- Avoid N+1 database access. Prefer Prisma relation selects, bounded lists, parallel independent reads, and pagination as lists grow.
- On Vercel, use environment variables for deployment-specific configuration and keep work within request limits. Move polling/import/automation to durable background infrastructure.
- On Neon, use the configured pooled connection URL, migrations appropriate to the target environment, and narrowly selected queries. Do not create a new Prisma client per request.
- There is no cache today. Introduce caching only with an invalidation plan for lead/user/connector mutations.

## Git and verification workflow

- Work in focused branches; inspect `git status` before editing and preserve unrelated user changes.
- Use concise conventional commits, for example `feat(leads): add assignment endpoint`, `fix(auth): enforce sales ownership`, `docs: update architecture context`.
- Keep migrations, generated-client regeneration, schema changes, and documentation changes together when they describe one behavior.
- Before a normal application handoff, run:

```bash
pnpm prisma generate
pnpm typecheck
pnpm lint
pnpm build
```

- For bootstrap changes also run `pnpm prisma db seed` twice and confirm the second run is a no-op.

## Contributors must never

- Re-enable public signup or weaken server-side role checks without an explicit security decision.
- Commit `.env` files, passwords, auth secrets, database URLs, tokens, or real connector credentials.
- Store secrets in client code, `NEXT_PUBLIC_*` variables, logs, audit metadata, or unencrypted connector configuration.
- Edit generated Prisma output or bypass the Prisma 7 adapter.
- Add a vendor-specific field directly to the core lead UI/service merely to accommodate one connector; normalize it or use documented custom fields/configuration.
- Claim a placeholder route/service is a working feature.
- Add background loops, cron-like work, or long syncs to request handlers without durable infrastructure.
- Use destructive Git commands or overwrite unrelated work without explicit authorization.
