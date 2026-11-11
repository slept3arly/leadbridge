# Phase 12 — Approved Placeholders and Defaults Implementation

> **Status:** Implemented. Placeholder copy changed; defaults, validation, catalogs, layouts, and workflow behavior retained.
> **Scope:** Approved Phase 11 recommendations from [29](./29_PLACEHOLDERS_AND_DEFAULTS_REVIEW.md).

## Implemented wording

- Lead name: `Full name`
- Company: `Company or organization`
- City: `e.g. Pune`
- District: `e.g. Andheri West`
- State: `e.g. Maharashtra`
- Phone: `10-digit phone number`
- Email: `name@example.com`
- Category dropdown blank prompt: `Select category`
- Lead Source dropdown blank prompt: `Select source`
- Interaction notes: `Add a note about the interaction`
- Shared Admin and Sales lead search: `Search by name, company, email, phone, or lead number`

The same prompts apply in Create Lead and Edit Lead. Existing saved field values remain populated in Edit Lead. The edit form no longer displays “Optional” field suffixes; required attributes and validation were not changed. Existing `Select response`, `Select interest`, and `Unassigned` prompts are unchanged.

## Defaults confirmed

- Create Lead starts with Action Call, Status New, and Priority Medium.
- Record Progress starts with Action Call and uses the current lead's Status and Priority, falling back to New and Medium.
- Edit Lead preserves saved values.
- Follow-up scheduling starts Off with blank date and time; rescheduling retains the existing due date/time.
- Follow-up Priority remains Medium in the existing service.

No required-selection behavior, enum values, labels, API contracts, layouts, keyboard navigation, or business rules changed. City and District remain separate fields.

## Verification

Focused placeholder/default assertions were added to `tests/lead-workflow-entrypoints.test.ts`.

- Focused workflow-entrypoint tests: passed (20 tests).
- Full `pnpm test`: passed (126 passed, 1 skipped, 0 failed).
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: initial run compiled but its TypeScript worker exceeded Node's default heap and aborted; `NODE_OPTIONS=--max-old-space-size=4096 pnpm build` passed, including static page generation.
- `git diff --check`: passed.
- No schema, migration, database, or record changes were made.
