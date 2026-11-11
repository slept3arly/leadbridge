# Phase 13 — Lead Status and Custom Dropdowns

> **Status:** Implemented. Migration created but not applied to any database.

## Lead Status

The centralized catalog now contains exactly `NEW` / New, `CONVERTED` / Converted, `LOST` / Lost, `SPAM` / Junk, `ON_HOLD` / Paused, and `OLD` / Old. The existing values retain their meanings; `OLD` is additive. The existing `NEW` default and all other catalogs, including Interest, remain unchanged.

Migration: `20261111090000_add_old_lead_status`

```sql
ALTER TYPE "LeadStatus" ADD VALUE 'OLD';
```

The migration adds an enum value only. It contains no `UPDATE` or other data rewrite. It has not been applied to Neon or any other database.

## Shared custom dropdown

`src/components/ui/select.tsx` now wraps `@radix-ui/react-select` with the site's design tokens and existing option-child / `onChange(event.target.value)` API. Existing controls across the application use this shared primitive, so option order, stored values, controlled/default selections, prompts, and call sites remain unchanged. It supports controlled and uncontrolled values, option values and labels, placeholders, disabled and required states, `aria-invalid` styling, labels/descriptions, form names, and size classes. The popup uses a portal with collision-aware placement and viewport height limits. Radix supplies keyboard and screen-reader behavior.

Create Lead Enter navigation recognizes a committed Radix combobox selection so the existing sequence remains: first Enter opens, selection commits, subsequent Enter advances. Escape, arrow navigation, Tab, and Shift+Tab are managed by Radix/browser focus behavior.

## Native dropdown inventory

Every application call site now uses the custom Radix `Select` wrapper: 66 call sites across 15 component files. There are no handwritten native `<select>` controls under `src`; Radix internally renders a visually hidden native select for form integration.

Converted call-site files:

- `src/components/leads/lead-edit-modal.tsx`
- `src/components/leads/record-progress-modal.tsx`
- `src/components/sales/activity-fields.tsx`
- `src/components/sales/lead-details-modal.tsx`
- `src/components/sales/sales-table-controls.tsx`
- `src/components/shared/table-controls.tsx`
- `src/components/shared/lead-actions.tsx`
- `src/components/admin/admin-reports.tsx`
- `src/components/export/export-workspace.tsx`
- `src/components/providers/provider-edit-modal.tsx`
- `src/components/providers/providers-page-content.tsx`
- `src/components/providers/routing-rules-manager.tsx`
- `src/components/connectors/connector-edit-modal.tsx`
- `src/components/users/user-edit-modal.tsx`
- `src/components/users/user-table-controls.tsx`

## Verification

- Focused contract/UI tests: passed (37 tests).
- Full `pnpm test`: passed (129 passed, 1 skipped, 0 failed).
- `pnpm typecheck` and `pnpm lint`: passed.
- `pnpm exec prisma validate` and `pnpm exec prisma generate`: passed.
- `NODE_OPTIONS=--max-old-space-size=4096 pnpm build`: passed.
- Native-select source inventory: zero handwritten `<select>` tags; 66 shared custom dropdown usages in 15 files.
- The PostgreSQL persistence integration case was added but not run. It requires a test database with this migration applied; this phase forbids applying the migration to any database.
- `git diff --check`: passed.

The migration is intentionally not executed against a database.
