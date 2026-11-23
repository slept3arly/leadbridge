# Phase 1 — My Leads Foundation & Usability Improvements

**Date:** 2026-11-17  
**Scope:** Accessibility names, URL state/navigation, table row semantics, and result feedback. Existing page structure and visual tokens were retained.  
**Schema/API:** No changes.

## 1. Executive Summary

Phase 1 adds programmatic names to shared search and My Leads filter controls, exposes filter popup state/count, preserves all query parameters when closing a deep-linked lead, and synchronizes table controls with App Router URL changes. Debounced search uses `router.replace()`; committed filters, sort changes, and pagination use `router.push()`. Back/Forward state restoration is covered by a router-context test.

Rows remain clickable and retain Enter/Space activation, now with a lead-specific accessible row name. Lead row actions have contextual names. One polite status region announces either “Updating leads” or the settled result count, while the table wrapper exposes `aria-busy` during navigation.

No dialog-hook rewrite was made: source inspection found focus entry/trapping, Escape handling, focus restoration, scroll locking, and dialog names already in place. Actual browser/screen-reader verification is still needed, particularly when a deleted row was the invoking control. No browser automation package is installed in the workspace.

## 2. Findings Addressed

Statuses refer to findings in `MY_LEADS_UI_UX_ACCESSIBILITY_AND_DATA_AUDIT.md`.

| Finding | Status | Reason |
|---|---|---|
| UI-01 | Not Applicable | Responsive table sizing was explicitly outside this foundation phase; no visual redesign was made. |
| UI-02 | Not Applicable | Consolidating row actions would be a later interaction/layout change. Existing actions remain visible. |
| UI-03 | Not Applicable | A new page-level result heading was not part of Phase 1; result count is announced accessibly. |
| UI-04 | Fixed | Retained the skeleton and added a polite “Updating leads” / settled result status plus `aria-busy`. |
| UI-05 | Not Applicable | Hydration date rendering is deferred; no change to date display. |
| UI-06 | Not Applicable | Control grouping and layout remain unchanged. |
| UX-01 | Fixed | `useTableQuery` now reads App Router `useSearchParams` changes and restores the hook state without writing that state back as a new navigation. Committed filters/sort/page push; debounced search replaces. |
| UX-02 | Fixed | Deep-link details read `leadId` from current search params; closing removes only that key and preserves all other query parameters. |
| UX-03 | Fixed | Focusable rows have contextual accessible names; Enter/Space still activate once. My Leads and Admin Leads provide the label. Nested action buttons remain independent. |
| UX-04 | Not Applicable | Sort affordance changes are deferred. |
| UX-05 | Not Applicable | Filter grouping and multi-select behavior are out of scope. |
| UX-06 | Not Applicable | No lead fields or table columns were added or removed. |
| UX-07 | Not Applicable | Follow-up urgency copy and date display are deferred. |
| UX-08 | Not Applicable | Destructive-action feedback was not redesigned in this phase. |
| UX-09 | Not Applicable | Personal page-size preference is deferred. |
| A-01 | Fixed | Shared `SearchToolbar` now renders a visually hidden associated label; My Leads names it “Search leads”; the icon is explicitly decorative. |
| A-02 | Fixed | Every Sales table filter Select has an ID and `aria-labelledby` association; native date inputs use associated labels. `Select` already forwards ID/ARIA props to Radix’s trigger, verified in source and tests. |
| A-03 | Fixed | DataTable accepts an optional contextual row accessible label. Both row-click consumers (My Leads and Admin Leads) now provide one; table semantics are not changed to `role="button"`. |
| A-04 | Fixed | A single polite status region announces loading or the settled result count; it does not announce both states simultaneously. |
| A-05 | Fixed | Radix Popover supplies `aria-expanded` and `aria-controls`; the Filters button announces the active-filter count, and the close icon is named “Close filters”. Keyboard open/dismiss behavior remains Radix-managed. |
| A-06 | Fixed | The ordinal header is now “Row”; My Leads and Admin icon actions include the lead name in their accessible labels. |
| A-07 | Not Applicable | Color contrast and small-text measurement require rendered/browser checks; colors were not changed. |
| A-08 | Not Applicable | Touch target resizing requires mobile validation and was outside this phase. |
| A-09 | Not Applicable | Reduced-motion behavior was not changed; global animation behavior still needs manual inspection. |
| A-10 | Not Fixed | The hook and dialog roles/names were inspected; no verified source-level defect justified changing them. Browser/AT checks remain outstanding. |
| A-11 | Not Applicable | Responsive reflow and horizontal table scrolling require browser verification and were not changed. |
| A-12 | Not Applicable | Hydration/date announcements are deferred with UI-05. |
| P-01 | Not Applicable | No database query optimization was made. |
| P-02 | Not Applicable | List projections were not changed. |
| P-03 | Not Applicable | Detail history pagination was not changed. |
| P-04 | Not Applicable | No profiling evidence justified transformation changes. |
| P-05 | Not Applicable | No speculative render optimization or component split was made. |
| P-06 | Not Applicable | Existing server filtering/sorting/pagination behavior was retained. |

## 3. Exact Changes Implemented

- Added a visually hidden, associated search label to `SearchToolbar`, with an overridable accessible name. Search behavior and placeholder are unchanged.
- Added IDs and accessible label associations for sort, status, source, activity date/action/response, priority, category, interest, archive, admin assignment/follow-up, and date range controls in `SalesTableControls`.
- Named the Filters close button. The controlled Radix Popover already exposes `aria-expanded` and `aria-controls`; the trigger now includes a spoken active-filter count.
- Changed deep-linked details to use the current App Router search params as the source of truth. Closing removes `leadId` and uses `router.replace()` on the same pathname with every other query parameter retained. This also lets browser navigation and refresh open/close the deep-linked dialog from URL state.
- Updated `useTableQuery` to parse URL state on navigation and serialize changes while preserving unrelated parameters such as `leadId` and custom query keys. Filter values are read from all `filter.*` keys. Serialization orders filters deterministically.
- Defined navigation behavior: search edits are debounced and replace the current history entry; filter, sort, reset, date, and page changes push a history entry. App Router `useSearchParams` updates keep controls synchronized on Back/Forward; no direct `history` writes were added to production code.
- Added optional accessible row labels to `DataTable`; both My Leads and Admin Leads supply “Open details for [name]”. Existing row click and Enter/Space behavior remain. The data row is not assigned button role. My Leads and Admin row action names now include the lead name, and the row-number heading is “Row”.
- Added a single polite result status for “Updating leads” or the settled lead count and `aria-busy` around the My Leads results.

## 4. Files Modified

- `src/hooks/use-table-query.ts`
- `src/components/sales/lead-detail-dialog.tsx`
- `src/app/(dashboard)/sales/my-leads/page.tsx`
- `src/components/sales/sales-my-leads-page-content.tsx`
- `src/components/sales/sales-table-controls.tsx`
- `src/components/shared/search-toolbar.tsx`
- `src/components/shared/data-table.tsx`
- `src/components/leads/admin-leads-page-content.tsx`
- `tests/filter-popover-interaction.test.tsx`
- `tests/phase1-my-leads.test.tsx` (new)
- `package.json` (registers the new regression test in `pnpm test`)
- `docs/audits/PHASE_1_IMPLEMENTATION_REPORT.md` (this report)

The working tree contained other uncommitted files before this phase, including `src/components/ui/filter-popover.tsx`, User table controls, and export audit changes. Those unrelated edits were left untouched.

## 5. Navigation and URL-State Behavior

- Initial state is parsed from the current App Router search params.
- A change reflected in the URL by Back/Forward is parsed back into search, filters, sort, date range, and pagination state. A guard prevents the restored state from triggering a second navigation.
- Search typing waits for the existing debounce; each settled search replaces the current history entry rather than adding a history entry per keystroke. Clearing search remains immediate.
- Filter, sort, reset, date, and pagination changes use `router.push()` and can be traversed with Back/Forward.
- When writing list state, the hook replaces only its known list-state keys and `filter.*` keys. Other query parameters are retained.
- Closing the URL-driven lead detail dialog removes only `leadId`; direct refresh and browser navigation use the URL as the source of truth.

This follows the App Router contract that `useSearchParams` reflects client navigation and that `router.push()` adds a history entry while `router.replace()` does not. See [Next.js `useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params) and [Next.js `useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router).

## 6. Accessibility Improvements

- Search and all Sales table filter controls have programmatic names.
- Radix popover state and relationship are exposed by its trigger; active-filter count and close-button purpose are named.
- The table remains a semantic table. Row focus announces its contextual details action, keyboard activation is retained, and nested action clicks do not trigger row navigation.
- Archive/delete/restore/view actions identify the lead in their accessible names.
- Result loading and settled count use one polite status region; the result container reports busy state during navigation.
- The shared dialog behavior was not rewritten. Source confirms dialog labels/roles and the shared focus, Escape, trap, restore, and scroll-lock mechanics; runtime verification is still required.

These code changes are not a claim of WCAG conformance.

## 7. Regression Tests Performed

- `tests/phase1-my-leads.test.tsx` covers query parse/serialization, unrelated query parameter preservation, search replacement, filter/sort/page pushes, multiple Back/Forward state restorations, contextual row labeling, Enter/Space activation, independent row action activation, search/filter labels, Radix expanded/control state, named filter dismissal, status filter/chip removal/reset, and independent From/To date values.
- `tests/filter-popover-interaction.test.tsx` covers keeping the Radix filter popover open during internal/select interactions, keyboard selection/dismissal, focus return, and trigger expanded/controls attributes.
- Existing project tests cover filter parsing/serialization, lead search query fields, list workflow contracts, and related activity behavior.

## 8. Test Results

- `pnpm test` — passed: 135 passed, 1 skipped, 0 failed (136 total). The skipped lease mock is already marked as superseded by PostgreSQL fencing integration tests.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `git diff --check` — passed.
- Focused Phase 1 test files were also run directly during implementation and passed.

## 9. Remaining Limitations

- No Playwright/browser automation installation is present, so actual App Router navigation, deep-link refresh, server-return timing, and rendered focus behavior were not browser-tested.
- The router-context test exercises push/replace and Back/Forward synchronization at the hook boundary; it does not start Next.js or a database.
- Search-by-name/company/email/phone was not run against live lead data. The existing server search implementation and query contract were not changed.
- The exact behavior of focus restoration when a deleted row was the original invoker requires a browser test. The existing hook focuses a remaining parent dialog if the original element is removed; no hook change was justified from source inspection alone.
- Contrast, zoom/reflow, mobile horizontal table navigation, touch-target comfort, reduced motion, and screen-reader output were not measured.

## 10. Manual Verification Required

1. Open `/sales/my-leads` with active query parameters, open a lead through `?leadId=...`, refresh, close, and confirm only `leadId` disappears.
2. Apply search, filters, sort, and pagination in sequence; use browser Back/Forward and verify URL and visible controls stay aligned.
3. Check screen-reader names for filter Selects, date inputs, active count, row purpose, action names, and loading/result announcements.
4. Use keyboard only through filter popover, nested Radix Select, row actions, details/edit/progress/confirm dialogs, validation errors, and Escape/close paths.
5. Delete or archive a lead from a dialog and verify focus has a useful destination when its invoking row disappears.
6. Test 320 CSS px, 200% zoom, touch target spacing, rendered contrast, and reduced-motion settings.

## 11. Deferred Items for Phase 2

- Table layout/density/column changes and page-level context headings.
- Additional sorting affordances and filter grouping/multi-select.
- Lead data visibility or projection changes.
- Saved views, preferences, optional columns, and page-size customization.
- Database/detail query optimization or history pagination without measured need.
- Visual contrast, responsive, reduced-motion, and touch adjustments unless manual verification identifies a defect.

