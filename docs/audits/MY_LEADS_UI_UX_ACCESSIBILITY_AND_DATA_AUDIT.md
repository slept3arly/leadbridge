# My Leads UI/UX, Accessibility & Data Utilization Audit

**Audit date:** 2026-11-17  
**Scope:** `/sales/my-leads` and the code paths/components used by its list, filters, actions, and lead workspace.  
**Mode:** Read-only source inspection. No application code, schema, or migrations were changed.  
**Evidence key:** **Verified** means visible in current source/schema. **Recommendation** is a proposed improvement. **Manual verification** means code alone cannot establish the user impact or runtime behavior. Production data population was not inspected.

## 1. Executive Summary

My Leads is a server-rendered, permission-scoped, paginated list. Search, filters, sort, dates, and page are reflected in URL query parameters; the client displays seven columns and opens a rich Lead Workspace or Record Progress modal. The overall page already follows the current visual system and has useful workflow information (status/priority, recent activity, next follow-up). Incremental improvements can preserve that structure.

The current shared filter panel binds the **From** and **To** date inputs to their respective state values, so the source does not show the suspected date-range binding defect. The list performs four database operations for a nonempty page (page query and count in parallel, then latest event query and event-entry query), but they are bounded to the current page; this is not an N+1 pattern. The page size is settings driven and the query already selects a restricted set of lead fields.

The highest-value workflow opportunities are to make the row’s primary destination and actions easier to understand, provide a compact page-level result heading/context, and improve return-to-list behavior. A lead opened from `?leadId=` is closed by replacing the URL with `/sales/my-leads`, which drops the current search/filter/page state. `useTableQuery` writes state with `router.replace()` but does not subscribe to `popstate`, so browser back/forward does not restore the hook’s in-memory state as users may expect.

There are confirmed accessibility gaps in controls: the search field has no accessible name, filter captions are `<p>` elements rather than labels associated with their selects/date inputs, and the Filters trigger’s active count is not exposed as a state. Table rows are keyboard focusable and open on Enter/Space, icon-only row actions have names, and the dialogs use the shared focus-management hook. Browser/AT testing is still required for contrast, zoom/reflow, focus order, touch interaction, and full dialog experience.

The schema contains much richer information than the list shows. The compact table appropriately excludes most import, campaign, address, financial, notes, and raw integration data. Better candidates for optional list-level information are **assigned owner** (mostly a self-owned view, but potentially useful when assignment/transfer records exist), **industry or location**, and perhaps **expected value** only if users confirm it is routinely populated and actionable. `lastFollowUpAt`, contact email, `requirement`, follow-up rows, and many timestamps are selected but unused by the list. Notes, attachments, complete activity history, and full follow-up data are fetched only when opening the workspace; attachments are not included in its details endpoint.

### Suggested first implementation slice after audit approval

1. Add programmatic labels/names for search, filter fields, and filter dismissal; expose loading and result updates to assistive technology.
2. Preserve list query context when closing a `leadId` deep link and define back/forward behavior for URL-backed table state.
3. Simplify row interaction/action hierarchy and add a clear results heading/count without changing the table’s design language.

## 2. Existing Implementation Overview

### Request and data flow

1. `src/app/(dashboard)/sales/my-leads/page.tsx` calls `requireSession("SALES")`, awaits `searchParams`, reads `default_page_size`, parses list query state, and resolves optional `leadId` for a deep-linked detail dialog.
2. The page calculates `canDelete`, `canArchive`, `canExport`, and `canCreate`, then concurrently calls `leadService.listPage(query, user)` and fetches active lead sources (`id`, `name`).
3. The query state is converted into `TableQueryState` values. Repeated filter values are joined with commas. Props passed to `SalesMyLeadsPageContent` are the current page of leads, pagination, active sources, query state, deep-link ID, user identity/role, and capability flags.
4. `LeadService.listPage` scopes SALES to `assignedUserId`, excludes archived/deleted leads by default, applies available status/priority/category/source/follow-up/activity/date/search predicates, orders by an allowlist, and runs a `findMany` and `count` concurrently. It selects a fixed lead projection plus assignee/source and one newest-created follow-up summary. For nonempty results it runs two bounded raw SQL reads to identify each page lead’s latest relevant activity event and its displayable entries.
5. `SalesMyLeadsPageContent` holds modal and destructive-action state, listens for CRM sync refresh events, renders `SalesTableControls`, the seven-column `DataTable`, and create/progress/detail/confirmation dialogs. Search and table state live in `useTableQuery`; the hook updates the URL through debounced `router.replace()`.
6. Selecting a row or its detail icon opens `LeadDetailsModal` client-side. `?leadId=` opens `LeadDetailDialog`. The detail endpoint runs lead, notes, follow-ups, and activity queries concurrently; notes and events are limited to 100 each, follow-ups are unbounded. The workspace supports timeline/activity, follow-up management, editing and a customer-information popup. The endpoint does not fetch attachments.

### Visible list and available interactions

- Columns: row index, lead identity (name/company/phone), status/priority/category, lead source, latest selected activity, next follow-up, actions.
- Actions: Record Progress, conditional Archive and Delete, View lead details. Clicking elsewhere on a row also opens the details modal.
- Controls: search, export shortcut if permitted, Create Lead if permitted, a filter popover with sort/status/source/activity date/action/response/priority/category/interest/archive controls, quick follow-up segments, active filter chips/reset, total/range text and previous/next pagination.
- Empty state: “No leads found”, an instruction to adjust filters or create a lead, and an optional Create Lead action. Route-level loading skeleton mirrors all seven columns.
- No multi-row selection, bulk actions, page-size control, column chooser, or resizable columns are present in this page.

## 3. UI & Visual Consistency Findings

| ID | Category | Severity | Location | Current State | Problem | Recommendation | Effort | Dependencies |
|---|---|---|---|---|---|---|---|---|
| UI-01 | UI | Medium | `sales-my-leads-page-content.tsx`; `sales-table-controls.tsx` | Table contains seven columns with `px-5 py-4`, contact data and activity/follow-up detail; controls occupy two rows plus optional chips. | At narrower desktop widths, fixed status width, long metadata, and a wide vertical action cell compete for space; mobile relies on horizontal table scrolling. The user may need to scroll horizontally to reach actions. | Retain the columns and tokens, but tighten secondary cell typography/spacing or use a more compact action arrangement. Validate at 320/375/768/1024/1280px and 200% zoom before choosing widths. | Medium | Responsive visual review; shared DataTable changes may affect Admin. |
| UI-02 | UI | Medium | `sales-my-leads-page-content.tsx:287-331` | Every row shows a full “Record Progress” button plus archive/delete/detail icon buttons; the row itself also opens details. | The primary action is visually repeated across many rows, and the action area takes vertical space. The explicit view icon duplicates the row-click affordance. | Keep Record Progress prominent; group secondary actions in a labeled overflow menu or compact icon row, and make the row’s detail affordance visually apparent. Keep destructive actions discoverable and confirm them. | Medium | Shared row interaction and keyboard behavior. |
| UI-03 | UI | Low | `sales-my-leads-page-content.tsx:337-375` | The list starts with controls; there is no visible page-level result title, selected-view label, or contextual subtitle above the controls/table. Navbar supplies “My Leads” and user name. | After following a dashboard link into a filtered list, it is not immediately obvious which view or lead subset is active beyond filter chips/quick segment. | Add a compact result context such as “My leads · 26 results” or a clear active-view label, using existing section-heading typography and current count. | Small | None. |
| UI-04 | UI | Low | `sales-my-leads-page-content.tsx:354-375`; `loading.tsx` | Search updates replace the table with a skeleton; empty results use an empty-state panel. | A full table skeleton during filtering can interrupt orientation and shift content; there is no explicit inline loading label/status in the list region. | Consider retaining prior rows with a subtle loading state or include a visible and announced “Updating leads” status while transition is pending. Preserve the existing initial route skeleton. | Small | Accessibility finding A-04. |
| UI-05 | UI | Low | `sales-my-leads-page-content.tsx:60-89,94-145` | Relative activity labels are hidden until hydration; follow-up date and urgency are also hidden until hydration. | In server HTML and the initial client frame, activity appears as “No activity” and follow-up as “-” even when values exist, then changes after hydration. This is visually misleading/flickery on slow hydration. | Render a stable server-safe absolute date or neutral skeleton/placeholder that does not claim no data, then enhance to relative labels after hydration. | Small | Date/timezone convention decision. |
| UI-06 | UI | Low | `sales-table-controls.tsx:259-285,535-603` | Search/actions/filters are first row; quick segments and pagination below; chips appear only when active. | Controls are functionally rich but spread over a large horizontal footprint; the primary number of matches appears lower in the panel near pagination, not as a table heading. | Keep the same grouping, but align result count with the table context and ensure compact/wrapping behavior at tablet/mobile sizes. | Small | UI-03. |

## 4. UX & Interaction Findings

| ID | Category | Severity | Location | Current State | Problem | Recommendation | Effort | Dependencies |
|---|---|---|---|---|---|---|---|---|
| UX-01 | UX | High | `use-table-query.ts:17-49,73-94` | State initializes from the URL once and each edit uses `router.replace()`. No popstate or route-search-param synchronization updates local state. | Browser Back/Forward cannot reliably restore an earlier list state; URL may move while controls remain at stale in-memory state. Replace also intentionally avoids history entries for each interaction, so navigation expectations are unclear. | Define expected behavior: typically keep debounced search from flooding history but use history entries for committed filter/page changes, and subscribe to navigation changes so control state rehydrates. Test browser back/forward. | Medium | URL state contract; Next App Router behavior. |
| UX-02 | UX | High | `lead-detail-dialog.tsx:22-31`; `sales-my-leads-page-content.tsx:376-386` | Closing the auto-open `?leadId=` modal calls `router.replace("/sales/my-leads")`. | Search, filters, sorting, pagination, and other query parameters are discarded when a deep-linked lead is closed. | Remove only `leadId` while preserving the remaining URL parameters, and retain the current client list context after close. | Small | UX-01. |
| UX-03 | UX | Medium | `sales-my-leads-page-content.tsx:354-360`; `data-table.tsx:81-112` | Clicking anywhere on a row opens details; row actions stop click propagation; the row is keyboard focusable with Enter/Space. A separate detail icon also opens the same modal. | Discovery is uneven: mouse users can click the row, while keyboard users encounter a focusable row whose “open details” purpose is not announced. Two routes to the same details action add redundancy. | Prefer a clearly labeled lead-name link/button or expose row purpose accessibly; keep one obvious detail action while preserving Record Progress as a separate direct workflow. | Medium | Accessibility finding A-03. |
| UX-04 | UX | Medium | `sales-my-leads-page-content.tsx:231-335` | Sort is controlled only by a dropdown within the filter popover; table headers are static. | Sorting a visible column requires opening Filters, locating Sort, and selecting a value. Sortable headings do not indicate affordance/state. | Keep dropdown as a complete sort menu but add sort toggles to useful headers (Name, Status/Priority, Next Follow-up), or visibly show current sort outside the popover. Avoid suggesting unsupported sorts such as source/activity. | Medium | Query allowlist already supports created/updated/name/status/priority/category/follow-up. |
| UX-05 | UX | Medium | `sales-table-controls.tsx:260-339,542-603` | Most filters are single-select controls; changing one updates immediately and active filters become removable chips. Multiple filter dimensions can be combined. | Users must reopen the filter popover for each dimension, and filter controls are mixed without sectioning. Multi-value filtering is accepted by query parsing/service but not exposed in this UI. | Add light grouping (Lead, Activity, Dates) and consider multi-select only for fields where sales users need OR filtering. Show applied state and one-click removal as today. | Medium | Product confirmation on common filter combinations. |
| UX-06 | UX | Medium | `sales-my-leads-page-content.tsx:28-40,231-280`; `lead.service.ts:46-58,281` | Lead email, city/district/state, requirement, `lastFollowUpAt`, and latest follow-up relation are fetched, but the row only displays name, company, phone, status/priority/category, source, activity, next follow-up. | Some potentially useful information is unavailable at scan time, while selected data is unused. Phone is shown but email is not, which may mismatch sales contact preference. | Use user workflow evidence to choose a secondary contact line (email vs phone), optionally expose location or requirement in row details/configurable columns, and remove unused selected fields from list payload if not otherwise needed. | Medium | Data-population and user research; payload contract. |
| UX-07 | UX | Medium | `sales-my-leads-page-content.tsx:94-145` | Follow-up status is shown by colored “Overdue”/“Pending” badges; last activity text gives action/response and relative time. | “Pending” is repeated for every future follow-up and the overdue badge carries elapsed time only for overdue; the two columns do not communicate explicit date/time or activity age in a stable initial render. | Keep the date-first structure; use concise urgency vocabulary (“Due today”, “Overdue 2d”, “Upcoming”) and expose full date/time via visible text or accessible description. | Small | Timezone verification; UI-05. |
| UX-08 | UX | Low | `sales-my-leads-page-content.tsx:291-331`; `confirm-dialog.tsx` | Archive and delete each prompt for confirmation; failures appear in dialog and success as toast. | After a destructive action succeeds, the confirmation closes and data refreshes, but there is no explicit per-row pending context if the refresh is delayed. | Keep current confirmation pattern; ensure the affected row/list shows pending or is optimistically removed only after success, and keep the success announcement. | Small | No required change if refresh is immediate in practice. |
| UX-09 | UX | Low | `sales-table-controls.tsx`; `use-table-query.ts` | Page size is read from the global `default_page_size`; there is no page-size selector. | Users cannot tune density or scanning volume for their own workflow. | First measure complaints and current default sizes. A user preference selector is a later enhancement if global defaults do not serve varied workflows. | Medium | User preference persistence decision. |

## 5. Accessibility Findings

This is a source-level WCAG 2.2 AA review, not a conformance claim. “Verified” below describes code structure. Contrast, zoom/reflow, assistive technology, and actual focus behavior require runtime testing.

| ID | Category | Severity | Location | Current State | Problem | Recommendation | Effort | Dependencies |
|---|---|---|---|---|---|---|---|---|
| A-01 | Accessibility | High | `search-toolbar.tsx:12-20`; `ui/input.tsx` | Search input has a placeholder but no label, `aria-label`, or `aria-labelledby`; decorative search icon is pointer-disabled. | Placeholder is not a reliable accessible name and disappears when typing. | Add a visually hidden “Search leads” label or `aria-label`; retain the helpful placeholder. | Small | None. |
| A-02 | Accessibility | High | `sales-table-controls.tsx:291-514` | Filter fields have visible `<p>` captions; Select/date inputs are not associated with `<label>` elements or accessible naming attributes. | Screen readers may announce controls without their purpose, especially with several identical native selects. | Use `<label htmlFor>` with stable IDs or wrap each caption/control in a label; ensure custom `Select` forwards IDs/ARIA correctly. | Small | Check shared Select API. |
| A-03 | Accessibility | Medium | `data-table.tsx:81-111`; `sales-my-leads-page-content.tsx:354-360` | Native `<tr>` is given `tabIndex=0` and click/Enter/Space behavior, but no role/accessible description announces that row opens lead details. | Keyboard focus is available, but the interactive purpose is not communicated consistently to screen readers. Interactive row semantics also need scrutiny when row contains buttons. | Use a named lead link/button as the primary navigation target, or provide an appropriate row label and tested semantics without nesting interactive controls. | Medium | UX-04; shared table consumers. |
| A-04 | Accessibility | Medium | `sales-my-leads-page-content.tsx:354-359`; `data-table.tsx:27-57`; `ui/loading.tsx` | Pending table refresh renders skeleton rows; no page result region or polite live status announces loading/result count changes. | Screen reader users may not know that filtering is in progress or that the result set changed. | Add a concise `role="status"`/polite live region for “Updating leads” and result count; avoid announcing every search keystroke. | Small | UX-03/UX-06. |
| A-05 | Accessibility | Medium | `sales-table-controls.tsx:270-285` | Filters trigger shows a count badge but does not expose `aria-expanded`, `aria-controls`, or the number of active filters in its accessible name. The close X in popover is icon-only with no accessible name. | Popup state and close purpose are less clear to assistive technology. | Set `aria-expanded`, `aria-controls`, and an active-filter count label on trigger; name close button “Close filters”. | Small | FilterPopover ID support. |
| A-06 | Accessibility | Medium | `data-table.tsx:81-111`; `sales-my-leads-page-content.tsx:231-335` | Table headers are semantic `<th scope="col">`; row number header is only `#`; multiple icon actions have labels and visible focus rings. | “#” is ambiguous when announced; action labels are generic across rows, with context coming only from neighboring cells. | Rename the column header “Row” or hide it from AT; provide action accessible names that include the lead name where practical (e.g. “Archive Ada Example”). | Small | None. |
| A-07 | Accessibility | Medium | `sales-my-leads-page-content.tsx:94-145`; `leads/lead-status-priority-cell.tsx` | Urgency/status is represented using text and colored badges, not color alone. Some muted metadata and badge color pairs are custom tokens/classes. | Text fallback is positive, but contrast ratios and text scaling are unverified; tiny 10px urgency labels may be difficult to read. | Measure foreground/background pairs against WCAG AA; retain text labels and increase urgency text to a readable token if needed. | Small | Browser contrast checks. |
| A-08 | Accessibility | Low | `ui/icon-action-button.tsx:22-42`; `sales-table-controls.tsx:548-586` | Icon actions are 36×36px; pagination buttons are size `sm` (component nominal height 36px). | These meet WCAG 2.2 AA 24px minimum in CSS pixels but may be less comfortable on touch than 44px guidance, particularly when clustered. | Test target spacing on mobile; consider 40–44px hit areas while preserving compact visual icons. | Small | Mobile testing. |
| A-09 | Accessibility | Low | `globals.css`; `ui/animated-reveal.tsx`; page/table components | Tailwind transitions/animations are used in controls and reveals; no page-specific reduced-motion handling is visible in audited files. | Source review does not establish whether global CSS or GSAP utility honors `prefers-reduced-motion`; this remains unverified, not a confirmed violation. | Inspect shared animation implementation and test OS reduced-motion mode; disable/shorten nonessential reveal/transition motion if needed. | Small | Inspect global and animation implementation during implementation. |
| A-10 | Accessibility | Medium | `lead-details-modal.tsx`; `use-accessible-dialog.ts`; `confirm-dialog.tsx` | Shared hook locks body scroll, moves focus into dialog, traps Tab, handles Escape, and restores prior focus; dialogs use dialog/alertdialog roles and labels. | Source support exists, but nested popup/modal behavior, initial focus selection, errors, close restoration, and focus when the invoking row disappears have not been browser-tested. | Run keyboard-only and screen-reader checks for details → popup/edit/progress/confirm flows, including errors and loading states. | Medium | Browser/AT session. |
| A-11 | Accessibility | Medium | `DataTable`, `sales-table-controls.tsx`, `sales-my-leads-page-content.tsx` | Table wrapper uses horizontal overflow; controls flex-wrap; no alternate mobile card representation. | At 320px or 200% zoom, content may require two-dimensional scrolling. WCAG reflow exception may apply to data tables, but all controls and non-tabular content should reflow. This is a manual verification item, not a confirmed violation. | Verify 320 CSS px and zoom; ensure keyboard users can reach horizontally clipped columns and there is no page-level horizontal overflow. | Medium | Browser responsive review. |
| A-12 | Accessibility | Low | `sales-my-leads-page-content.tsx:60-145` | Data-dependent activity/follow-up content changes after `useHydrated`, and status is rendered through plain text/badges. | Hydration changes may be announced or visually perceived as transient content; exact status semantics are not exposed as machine-readable labels. | Use stable initial values and add accessible text for urgency; verify screen-reader announcements. | Small | UI-05. |

## 6. Database Schema & Data Utilization Inventory

### Population caveat

Schema nullability/defaults describe what may be stored, not what is populated in a live database. No production or development database was queried for this audit. Therefore nullable/optional values below are identified as **potentially absent**; any claim about frequency or data quality requires a separate, authorized aggregate-only data review.

### Lead fields

`leadListSelect` is defined in `src/services/lead.service.ts:46-59`. It selects `id`, `leadNumber`, `displayName`, company, email, phone, city, district, state, requirement, status, priority, category, created/updated timestamps, next/last follow-up timestamps, archive state, assigned user `{id,name}`, source `{id,name}`, and the newest-created follow-up’s `{status,dueDate,completedAt}`. The row projection does not serialize/use all selected values. The service separately queries latest relevant activity for current-page IDs.

`leadDetailSelect` at `lead.service.ts:61-86` supplies the lead details endpoint. It includes most customer, source/import, lifecycle, custom JSON, and actor fields, but does not select `convertedAt`, `product`, or `rawPayload`. The UI hook exposes a permissive index signature. The workspace visibly uses identity/customer info, assignment, created/updated metadata, activity, notes, and follow-ups; source/import metadata and lifecycle fields vary by details popup usage. Attachments are not fetched by the details endpoint.

| Schema fields / relationship | Schema state | My Leads list query | List UI | Details/workspace or other availability | Utilization / investigation |
|---|---|---|---|---|---|
| `id`, `leadNumber`, `displayName` (`name` mapped), `company`, `email`, `phone` | Required identifiers/name; company/email/phone nullable | All selected; search covers display name/company/email/phone/number | Name, company, phone shown; lead number and email not shown | Lead number, email, phone, company, name are available in details/customer popup | Identity/contact are essential. Verify whether email or phone is the preferred secondary row contact. Lead number could be a low-space identifier if users quote it. |
| `alternatePhone`, `address`, `city`, `district`, `state`, `country` | Nullable strings | city/district/state selected; others not | None in table | Details select includes these and customer info view can display them | Useful in details. Consider one concise location line/optional field only if lead locality matters in daily prioritization. |
| `product`, `requirement`, `industry`, `website`, `jobTitle` | Nullable strings | `requirement` selected; others not | None in list | Details select includes requirement, industry, website, jobTitle; `product` is not selected by `leadDetailSelect` | Requirement/industry/jobTitle may help identify lead context. Verify population and avoid crowding the fixed table. `product` is a schema/detail-selection gap. |
| `budget`, `expectedValue`, `currency`, `wonAmount` | Nullable Decimal(14,2) / nullable currency string | Not selected | None | Details select includes all; hook types budget/expectedValue as unknown; workspace display should be checked for these exact fields | Potentially high value for prioritizing, but nullable and sensitivity/reliability need investigation before adding. Won amount only relevant after conversion/win. |
| `campaign`, `campaignId`, `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm` | Nullable strings | Not selected | None | Detail select returns all; no obvious list scan use | Attribution/debug context is usually details/export territory. Verify actual import quality before surfacing. |
| `sourceReferenceId`, `sourceName`, `sourceType`, `parserVersion`, `receivedAt`, `importedAt` | Nullable integration/import metadata | Not selected | `source.name` from relation shown | Details select includes these; workspace currently visibly exposes source name and imported date; source relation includes name/type | Keep technical lineage in details. `sourceName` is a denormalized snapshot distinct from current `LeadSource.name`; confirm intended display when source relation is null. |
| `firstContactedAt`, `lastContactedAt`, `nextFollowUpAt`, `lastFollowUpAt` | Nullable DateTimes; next/last follow-up denormalized | All except first/last contacted selected | `nextFollowUpAt` shown; `lastFollowUpAt` and contact timestamps unused | Details select includes all four; workspace shows timeline and follow-up support | Next follow-up and activity date remain visible. `lastFollowUpAt` duplicates workflow signal and is currently unused in row payload. Check whether latest activity is a better “last touched” field. |
| `closedAt`, `convertedAt`, `lostReason`, `wonAmount` | Nullable lifecycle fields | Not selected | Not shown | Details selects closedAt/lostReason/wonAmount but omits convertedAt | Relevant for closed lead review; lifecycle completeness should be verified. Do not show in default active list. |
| `status`, `priority`, `category` | Enum status/priority with defaults; category nullable | Selected | Status/priority/category shown in one cell | Details select and edit forms use them | Essential scan fields. Verify text labels and contrast for each enum option. |
| `customFields`, `rawPayload` | Nullable JSON | customFields selected; rawPayload not | Neither shown | customFields selected in details; rawPayload omitted | Raw payload should remain out of ordinary UI. Custom fields need a defined display contract/configuration before use. |
| `sourceId`, `connectorId`, `assignedUserId`, `createdById`, `updatedById`, `deletedById` | Nullable foreign keys | IDs omitted; assigned user relation selected | Assigned user not displayed (SALES view is scoped to self) | Detail select includes IDs and selected actor relations; connector relation selected | Assignment is valuable in Admin/transfer contexts, low incremental value in a strict personal-only view. IDs should remain internal. |
| `isArchived`, `isDeleted`, `deletedAt` | Booleans default false; nullable deletion date | archive state selected; deletion state filtered, not selected | Archived filter available; no row indicator in normal view | Details select includes archive/deletion state/time | Default excludes archived and deleted; archived view can still show only archive-filtered records. Deletion is lifecycle/admin detail. |
| `createdAt`, `updatedAt` | Required DateTimes with defaults/ORM update | Selected | Not in list | Detail shows created/updated information | Useful in detail; “recently updated” sort exists. Consider exposing only if users need freshness when no activity exists. |
| `source`, `connector`, assigned/created/updated/deleted user relations | Optional relations | Source `{id,name}`, assigned `{id,name}` selected | Source name shown; assignee unused | Detail selects source `{id,name,sourceType}`, connector `{id,name,type}`, actor summaries | No list-level connector or actor metadata needed for routine sales scanning. |
| `activityEvents`, `notes`, `followUps`, `attachments` | One-to-many relations | Follow-up relation limited to latest-created record but not used. Activity is separately queried; notes/attachments not fetched | Last activity summary and denormalized next follow-up shown | Details API fetches 100 notes, all follow-ups, and 100 activity events; attachments not fetched | Follow-up overfetch and unused list relation are covered under performance. Verify whether attachment display is required; model exists but this page’s current details API cannot show attachments. |

### Related models and their fields

| Model | Schema fields and relationships | Current page use | Data status / notes |
|---|---|---|---|
| `LeadSource` | `id`, `name`, unique `slug`, mapped `sourceType`, `active`, nullable `description`, `icon`, `color`, `priority`, `createdAt`, `updatedAt`; relations to leads/connectors/routing/unmatched emails | Page fetches active source `{id,name}` for filter/create/edit controls; list query loads lead source `{id,name}`; details source includes `sourceType` | No source field completeness/population was checked. Inactive sources are excluded from filter choices though a historical lead may still refer to one. |
| `FollowUp` | `id`, required `title`, nullable `description`, nullable `dueDate`/`dueTime`, priority/status defaults, required `leadId`, nullable `noteId`, nullable assignee, required creator, nullable `completedAt`/`cancelledAt`, created/updated; relations to notes, lead, users, activity entries | List query selects one row by `createdAt desc` with only status/dueDate/completedAt (not rendered). Denormalized lead next follow-up is rendered. Details endpoint fetches all follow-ups and user summaries. | Nullable due fields allow unscheduled dates; all follow-ups are unbounded in details query. Production count and typical task history require data inspection. |
| `Note` | `id`, required `content`, optional `whatIDid`/`whatCustomerSaid`, required lead/author, `editedAt`, `isPinned` default false, `visibility` string default `INTERNAL`, createdAt; follow-ups | Not queried by list (except relation-existence predicate for “new” filter); details endpoint returns newest 100 with author and at most one linked follow-up summary | `visibility` is a free-form String rather than enum in schema; confirm filtering/security semantics. No frequency/population claims made. |
| `ActivityEvent` | `id`, enum `type`, required lead, nullable actor, nullable JSON metadata, occurred/created timestamps, entries; lead cascade, actor set-null | List raw SQL fetches latest relevant event by occurrence time for page IDs. Details endpoint returns up to 100 events via activity service. | `occurredAt` is used for ordering/relative labels. Events outside selected types are intentionally omitted from list summary; inspect service type filter if broadening. |
| `ActivityEntry` | `id`, required event, enum type, nullable action/response/interest/message/JSON metadata/followUpId, createdAt; event cascade, follow-up set-null | List loads types CALL, WHATSAPP, and follow-up lifecycle entries; UI displays action/response or follow-up label, not interest/message | Interaction notes/metadata are kept in event entry and not rendered in summary. Full details timeline includes them. |
| `Attachment` | `id`, `name`, storage `key`, MIME type, size, optional checksum, provider default `local`, required lead, optional uploader, createdAt | Not selected or queried by My Leads details endpoint | This is currently unavailable in this page’s detail interaction. Confirm intended attachment workflow before treating as an omission. |
| `User` (related) | `id`, name/email, role/privilege, active/banned/deleted lifecycle, optional phone/employee code/designation/login/seen/create actor; relations to leads, activities, notes, follow-ups, attachments, settings/auth entities | Page receives current user `{id,role}` for details permissions; list query selects assigned user id/name; details returns selected creator/updater/deleter, note authors, follow-up assignee/creator, activity actor | Personal view is assigned-user scoped. User contact/auth/security fields are not appropriate list data. |

## 7. Recommended Data Visibility Changes

### A. Data that should remain visible

- Lead name and one practical contact method; company when present.
- Status, priority, and category (current cell structure is compact and useful).
- Source name, especially for inbound lead context.
- Last meaningful activity with time context.
- Next follow-up date/urgency.
- Clear Record Progress action.

### B. Data that could be added

- **Email as alternate contact line:** Medium value, small effort. It is searched and available to details but omitted from the row. First establish whether users prefer email or phone as the second line; avoid displaying both by default on narrow screens.
- **Location or industry:** Medium value if geographic territory/sector informs triage. Both are nullable and details-only/unused in the list. Validate populated rates and sales workflow first; prefer optional column or detail panel.
- **Expected value/budget:** Potentially high value for prioritization, but data is nullable and may have currency/quality variance. Investigate populated rate, currency consistency, and edit/import behavior before making visible.
- **Assigned owner:** Low value for a personal SALES list if the query scopes every row to the signed-in user; more useful to Admin or mixed-ownership workflows. Existing row data already fetches the assigned user name.
- **Lead number:** Optional identifier for support and verbal handoffs; currently selected and searchable but not visible. Consider a subtle secondary label only if users reference it.

### C. Data to remove or de-emphasize

- Do not add all address, campaign/UTM, import/parser, raw JSON, actor, and lifecycle fields to the default table. Keep them in details or admin/integration workflows.
- Remove `lastFollowUpAt` and the `followUps` list relation from `leadListSelect` if confirmed unused elsewhere in list service consumers. The list response has no need for their current selection solely to render this table.
- `email`, `city`, `district`, `state`, and `requirement` are selected for list rows but not displayed; keep only fields needed by list consumers/search/filter or remove from this list-specific projection after checking shared service consumers.
- `#` row ordinal is not lead identity; avoid treating it as a meaningful data field. It can remain decorative or be replaced by a useful identifier.

### D. Data needing investigation

- Production population and consistency for budget, expected value, currency, industry, location, email/phone, campaign, source snapshot, requirement, and custom fields.
- Whether `LeadSource` relation may be null/inactive while `sourceName` snapshot remains populated; decide the user-facing fallback.
- Why `product` is in schema but omitted from `leadDetailSelect`; verify whether intentional or an unserved detail field.
- Why `convertedAt` exists in schema but is omitted from details selection/UI.
- Attachment model has no details route/query/rendering path in My Leads; confirm if attachments are in scope for the workspace.
- Follow-up query orders by `dueDate` and created date in detail API, while list relation takes latest by `createdAt`; confirm intended “current/next” semantics. The list currently relies on denormalized `Lead.nextFollowUpAt` instead.
- Activity timestamps use UTC helpers and browser-local relative formatting; manually verify day-boundary behavior in the deployment timezone.

## 8. Performance & Data Fetching Findings

| ID | Category | Severity | Location | Current State | Problem | Recommendation | Effort | Dependencies |
|---|---|---|---|---|---|---|---|---|
| P-01 | Performance | Low | `lead.service.ts:281-333` | A populated page causes `findMany` + count in parallel, followed by a bounded latest-event query and event-entry query for page IDs. | Four DB round trips per populated result; the two activity lookups execute sequentially. Cost grows with request rate, not total dataset per page, and is not N+1. | Measure page latency/query timings first. If activity is material, combine latest-event and entries in one SQL query or use a well-bounded relation strategy; retain page-level bounds. | Medium | Measurements and DB plan; no speculative index. |
| P-02 | Performance | Medium | `lead.service.ts:46-59`; `lead.service.ts:281` | List projection fetches unused `email`, location, requirement, `lastFollowUpAt`, and a one-record follow-up relation; the page component uses only name/company/phone/status/priority/category/source/nextFollowUpAt/activity. | Extra columns/relations add data serialization and query work. Some may serve other `listPage` callers, so removal must be consumer-aware. | Create a My Leads-specific lightweight projection or verify other service callers before removing unused selects. Preserve fields needed for search predicates even if not returned. | Small | API/service consumers review. |
| P-03 | Performance | Medium | `api/leads/[id]/details/route.ts:14-39` | Detail modal fetches up to 100 notes, all follow-ups, up to 100 activity events; list note query includes one follow-up each. | Follow-up history is unbounded and can grow per lead; response size and timeline processing may become costly for long-lived leads. | Measure history sizes and response payloads; paginate/“load older” history if real records become large. Keep all pending tasks available if workflow requires it. | Medium | Data volume measurement; UX for history paging. |
| P-04 | Performance | Low | `sales-my-leads-page-content.tsx:66-78`; `DataTable` | `LastActivityCell` copies and sorts each row’s latest event entries on each render; max entries are bounded to one event and only relevant types. | Tiny bounded work, but repeated when parent state changes. This is not currently material. | No change needed unless profiling identifies rerender cost; can pre-order in service if display order is stable and justified. | Small | Profiling only. |
| P-05 | Performance | Low | `sales-my-leads-page-content.tsx:178-184,337-375` | Parent owns page, action, and modal state; columns are recreated on each render. Each row child may rerender with the table. | Component responsibility and render allocation are broad, but page size is bounded and there is no evidence of a user-visible performance issue. | Defer memoization/component splitting until profiling. If optimizing, isolate row action state and stable column definitions without complicating the existing architecture. | Medium | Profiling; avoid speculative complexity. |
| P-06 | Performance | Low | `sales-table-controls.tsx:189-224` | Active filter labels are memoized; URL replacement is debounced 300ms for search, immediate for empty search; server handles filtering/sorting/pagination. | Data is not duplicated into a client filter/sort layer; no large client-side transformations are apparent. | Preserve server-side filtering and OFFSET pagination per current architecture. Test default count/latency at actual scale before redesigning. | Small | None. |

## 9. Customization Opportunities

| Opportunity | User value | Complexity | Architecture fit | Recommendation / timing |
|---|---|---|---|---|
| Optional columns (email, location/industry, expected value) | Medium to high if data is populated and relevant to triage | Medium | Fits `Column<T>` table model, but needs preferences and projection work | Later P2 after production population review. Start with show/hide, not a large column builder. |
| Column ordering | Low to medium | Medium | Possible but needs preference persistence and stable schema | Defer; users have not yet established a need and seven columns are currently fixed. |
| Column resizing | Low | Large | Requires table layout and responsive keyboard/touch handling | P3/likely unnecessary; fixed/compact widths are simpler at current scale. |
| Density setting | Medium | Small to medium | `DataTable` already has `compact` prop, but preference storage is missing | P2 if users scan many rows; expose comfortable/compact modes only after checking small-screen legibility. |
| Saved filter views | High for repeated workflows | Medium to large | URL filters already form a serializable basis; no preference/view model exists | P2/P3. First improve URL state and define whether views are personal or shared. Avoid database schema until value is demonstrated. |
| Default sort preference | Medium | Medium | Query state supports sort; persistence can be local/user setting | P2 if users repeatedly change from the default. Current dropdown includes Updated/Created/Name/Priority/Follow-up sorting. |
| Filter organization and quick filters | High | Small to medium | Existing `SalesTableControls` and URL filters support extension | P1/P2. Group related filters and add only workflow-validated quick filters (e.g. overdue, today, no next follow-up); the current follow-up segments already cover overdue/today/upcoming. |
| Persistent personal preferences | Medium | Medium to large | Could use existing user settings service, but no My Leads preferences contract found | Defer until chosen preferences (density, columns, sort/views) are approved; avoid adding settings for speculative controls. |
| Multi-select filters | Medium for broad categorical scanning | Medium | Parser/service accept arrays, controls currently use one string per key and chips assume one selected option | P2 only for validated fields; needs clear AND/OR semantics and chip representation. |

## 10. Prioritized Improvement Roadmap

### P0 — Critical

No P0 source-verified issue was identified in the current My Leads implementation. The current To-date field is independently bound to `query.dateTo`; manually verify custom range behavior in the browser.

### P1 — High value

1. **Accessible control names and labels** (A-01, A-02, A-05). Search, every filter/date input, filter trigger state, and close button should have programmatic names.
2. **URL/list context preservation** (UX-01, UX-02). Define back/forward semantics and preserve all list parameters when closing a deep-linked lead.
3. **Communicate row action semantics and result updates** (UX-03, A-03, A-04). Make the details target discoverable to keyboard/screen-reader users and announce filter loading/count changes.
4. **Reduce action/control clutter incrementally** (UI-02, UI-06, UX-05). Keep Record Progress primary; group rarely used actions and lightly organize filters.

### P2 — Medium value

1. **Sorting discoverability** (UX-05). Add obvious current-sort context or sort controls to supported headers.
2. **Stable data during hydration and result context** (UI-03, UI-05, UX-08, A-12). Avoid “No activity”/dash flashes for known values and clarify urgency with text.
3. **Responsive and contrast validation** (A-07, A-08, A-11). Test at small widths, 200% zoom, keyboard, and measured color pairs; change only failing values/targets.
4. **Optional data exposure decision** (UX-07, sections 6–7). Review population and user workflows for email vs phone, location/industry, expected value, and lead number before making the list denser.
5. **Density or optional columns** only after validating demand (customization table).

### P3 — Optional

1. Saved views, column reordering/resizing, and personal preference persistence (Customization table).
2. Attachment rendering in the workspace if attachment workflows are confirmed in scope.
3. Paginated historical notes/follow-ups/activity if measured record volume makes current modal payloads slow.

### Suggested implementation sequence and dependencies

1. A-01/A-02/A-05 naming and labels; no data/API dependency.
2. UX-02 preserve query when deep-link dialog closes, then UX-01 add coherent navigation synchronization; agree on replace-vs-push semantics first.
3. UX-03/A-03/A-04 row semantics and loading/result announcements; coordinate shared `DataTable` impact across Sales and Admin.
4. UI-02/UX-05 compact action and filter hierarchy, then UX-04 sort affordance.
6. Run manual responsive, keyboard, screen-reader, contrast, reduced-motion, and timezone checks; record only verified defects.
7. Review anonymized aggregate population statistics and sales-user feedback before optional data/column customization.
8. Profile list/detail query latency and payload sizes before any query optimization or pagination changes.

## 11. Files and Components Inspected

- `AGENTS.md`
- `docs/README.md`
- `docs/UI_DESIGN_SYSTEM.md`
- `docs/frontend.md`
- `docs/development.md`
- Earlier workflow audits were used as historical context only; implementation claims were checked against source and current behavior is described in the [Frontend](../frontend.md) and [Backend](../backend.md) guides.
- `src/app/(dashboard)/sales/my-leads/page.tsx`
- `src/app/(dashboard)/sales/my-leads/loading.tsx`
- `src/components/sales/sales-my-leads-page-content.tsx`
- `src/components/sales/sales-table-controls.tsx`
- `src/components/sales/lead-detail-dialog.tsx`
- `src/components/sales/lead-details-modal.tsx`
- `src/components/sales/lead-details-popup.tsx`
- `src/components/leads/lead-edit-modal.tsx`
- `src/components/leads/record-progress-modal.tsx`
- `src/components/leads/lead-status-priority-cell.tsx`
- `src/components/shared/data-table.tsx`
- `src/components/shared/search-toolbar.tsx`
- `src/components/ui/filter-popover.tsx`
- `src/components/ui/icon-action-button.tsx`
- `src/components/ui/confirm-dialog.tsx`
- `src/components/ui/pagination.tsx`, `src/components/ui/segmented-control.tsx`, `src/components/ui/select.tsx`, `src/components/ui/input.tsx`, `src/components/ui/loading.tsx`
- `src/hooks/use-table-query.ts`
- `src/hooks/use-lead-details.ts`
- `src/hooks/use-accessible-dialog.ts`
- `src/services/lead.service.ts`
- `src/services/activity-event.service.ts`
- `src/app/api/leads/[id]/details/route.ts`
- `prisma/schema.prisma` (`User`, `LeadSource`, `Lead`, `ActivityEvent`, `ActivityEntry`, `Note`, `FollowUp`, `Attachment`, relevant enums)
- `src/app/globals.css` and UI primitive usage were referenced for the design system; no visual browser inspection was performed.

## 12. Open Questions and Areas Requiring Manual Verification

1. Which secondary contact should appear in a row: phone, email, or configurable choice? How often does each field have usable data?
2. Do sales users routinely prioritize by industry, territory/location, expected value, or budget? What are the observed populated rates and currency consistency?
3. Is the current default sort (`createdAt desc` when absent) intentional, given “Recently Updated” is offered and the service fallback is `updatedAt desc` for unsupported/missing sort? Verify parse defaults and current real behavior.
4. Should deep-linked lead close return to the exact list URL, and should filter/page changes create browser-history entries or replace the current entry?
5. Are inactive sources expected to be available as historical filters? Does the source snapshot need to display when `Lead.source` is null?
6. What is the intended role of attachments in the Lead Workspace? The schema exists, but this endpoint does not fetch them.
7. Are `product` and `convertedAt` intentionally omitted from detail selection/UI? Confirm with product/workflow owners.
8. What are actual notes/follow-up/activity history size distributions per lead? This determines whether unbounded follow-up loading needs pagination.
9. Manually test the date range, browser back/forward, query preservation, all filter combinations, empty/loading/error states, and CRM refresh across tabs.
10. Run keyboard-only and screen-reader checks on row focus, filter popover, nested dialogs, focus restoration, error announcements, and toast feedback.
11. Measure contrast for badge/muted text, verify focus indicators against the rendered design, check 320px and 200% zoom reflow/horizontal scrolling, and confirm reduced-motion support.
12. Confirm timezone expectations for “Today”, “Overdue”, custom date ranges, and relative activity labels in the local deployment.
13. If reviewing actual population is authorized later, use aggregate counts/null rates only for the candidate fields; this audit did not query a database or infer production completeness from schema defaults.

