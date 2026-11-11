# Phase 9 — Workflow Enums, Dropdowns, Defaults and Form UX Audit

> **Status:** Experimental audit and proposal only. No implementation changes are authorized by this report.
> **Source of truth:** The checked-out source and Prisma schema as inspected for this audit; existing dirty worktree changes are part of that source snapshot.
> **Database snapshot:** Aggregate-only reads of the configured database on 2026-11-10. No records were modified.

## 1. Executive summary

LeadBridge has 17 Prisma enums. The nine enums most directly used by lead capture, classification, interaction history and follow-up work are LeadStatus, LeadPriority, LeadCategory, FollowUpStatus, FollowUpPriority, ActionType, ResponseType, InterestType, and ActivityEntryType; ActivityEventType also structures the same workflow history. Lead Source is a dynamic LeadSource table, not an enum.

The largest terminology problem is conceptual: LeadStatus combines a lifecycle stage (NEW, CONVERTED), a disposition (LOST), a record quality label (SPAM shown as “Junk”), and a pause state (ON_HOLD). LeadCategory similarly mixes people/roles, organization types, relationship/source-like categories, and broad catch-alls. LeadPriority uses “Normal” for MEDIUM and “Do now” for URGENT, mixing a conventional scale with an imperative. Follow-up status labels (“To do”, “Done”) differ from lead/task language elsewhere.

The forms also make meaningful classifications without an explicit choice: Create Lead starts at New and Normal, and Action starts at Call. Response and Interest do require explicit choices. Whether those defaults are intentional workflow shortcuts or accidental classification is a product decision. Edit forms correctly initialize from the current record. Record Progress initializes from the current lead and shares the same action/priority/status catalogs.

Actual usage argues against removing apparently unused values: every lead category value is present in current records; all lead priorities and statuses are used. Some task/interaction enum values are absent from this database snapshot, but remain part of valid schema/API contracts and should not be removed without broader history/integration evidence. The configured database is reachable, so this report includes a current value-count snapshot; counts will change over time.

Recommended next step is an owner decision on the meaning and boundaries of status, category, and interest, followed by a separately approved compatibility plan. A safe first implementation increment would be centralized display-label and option-order work only after the owner approves the catalog. Do not infer approval for schema or enum changes from this audit.

## 2. Scope and evidence

Inspected prisma/schema.prisma, centralized option catalogs in src/lib/lead-constants.ts and src/lib/activity-options.ts, validation schemas, lead/follow-up/activity services, Create/Edit Lead and Record Progress, lead detail activity editing, Sales/Admin filters and dashboards, exports/reports, connector/provider forms, and existing tests. Database counts came from Prisma groupBy/count/lookup SELECTs only. The values shown below are a snapshot, not a claim about all historical backups or external integrations.

## 3. Complete Prisma enum inventory

The schema defines these 17 enums. “Display” gives the current UI label where a centralized or local mapping exists; otherwise the value is shown raw or appears only as a filter/technical state.

| Enum / current values | Current display | Frontend and backend use | Filters, reports, exports, integrations | Current usage / assessment |
|---|---|---|---|---|
| UserRole: ADMIN, SALES | Admin, Sales in user form/table | User editing, authorization and permissions; default role is SALES | User export filters by role; role gates CRM routes | Both used: ADMIN 1, SALES 2 active users. Names are clear. |
| SalesPrivilege: JUNIOR, SENIOR | Junior, Senior | User form and server permission matrix | User export filter; privilege affects allowed features | JUNIOR 1, SENIOR 1, null 1 (the Admin); clear internally, but “Junior/Senior” can sound like rank rather than permission tier. |
| LeadStatus: NEW, CONVERTED, LOST, SPAM, ON_HOLD | New, Customer, Lost, Junk, Paused | Create/Edit Lead, Record Progress, badges, dashboards; validation and lead service accept all values. Lead.status defaults NEW. Status edits create a STATUS_CHANGED activity entry. | Sales/Admin lead filters, dashboard counts, lead reports and CSV filters/columns; connector imports can supply status through lead mapping. | NEW 58, CONVERTED 16, LOST 13, SPAM 6, ON_HOLD 22 (115 non-deleted leads; all values used). Concepts are mixed; “Junk” is an informal synonym for SPAM and “Customer” is an outcome/entity state, not a pipeline stage. |
| LeadPriority: LOW, MEDIUM, HIGH, URGENT | Low, Normal, High, Do now | Create/Edit Lead, Record Progress, badges; backend default MEDIUM | Sales/Admin filters, dashboard totals, exports/reports; connector mapping accepts stored values | LOW 25, MEDIUM 55, HIGH 26, URGENT 9. “Normal” differs from the MEDIUM stored scale; “Do now” is an action instruction rather than a priority level. |
| LeadCategory: MEDICAL_REPRESENTATIVE→Medical Representative; RETAILER→Retailer; WHOLESALER→Wholesaler; DISTRIBUTOR→Distributor; MARKETING→Marketing; THIRD_PARTY→Third Party; DOCTOR→Doctor; FRANCHISE→Franchise; BUSINESS→Business; HOSPITAL→Hospital; CLINIC→Clinic; PHARMACY→Pharmacy; LABORATORY→Laboratory; MANUFACTURER→Manufacturer; CORPORATE→Corporate; GOVERNMENT→Government; OTHER→Other | Exact value/label pairs shown in first column; centralized in LEAD_CATEGORIES | Create/Edit Lead (not Record Progress), badges, validation and Lead.category | Sales/Admin filters; lead export category filter; report data/exports | Every value is used: MARKETING 3, HOSPITAL 3, THIRD_PARTY 6, null 20, RETAILER 7, PHARMACY 6, CLINIC 7, GOVERNMENT 8, BUSINESS 7, MANUFACTURER 8, MEDICAL_REPRESENTATIVE 8, WHOLESALER 2, FRANCHISE 4, CORPORATE 6, OTHER 5, LABORATORY 3, DOCTOR 6, DISTRIBUTOR 6. Mixes individual role, account type, corporate segment and relationship; do not remove “rare” values based on this sample. |
| FollowUpStatus: PENDING, COMPLETED, CANCELLED | To do, Done, Cancelled | Task lists, Lead Workspace, Record Progress read-only task card; service lifecycle transitions PENDING to COMPLETED/CANCELLED | Follow-up filters/export status; activity entries record scheduled/completed/cancelled events | PENDING 3, COMPLETED 7, CANCELLED 0 (10 tasks). “To do/Done” differs from Pending/Completed used in API, service and audit language. No evidence that CANCELLED is unused globally. |
| FollowUpPriority: LOW, MEDIUM, HIGH, URGENT | Reuses lead labels: Low, Normal, High, Do now | Follow-up schema/service; task cards display priority. New follow-ups default MEDIUM in shared service. Current scheduling forms do not expose a priority selector. | Follow-up export filters and exported task priority; no separate business report catalog found | All 10 rows MEDIUM; other values unused in this database snapshot. Shared lead labels and no UI control make task priority capability unclear to users. |
| ActionType: CALL, WHATSAPP | Call, WhatsApp | Create Lead, Record Progress, activity editing/history; API validation restricts to these | Sales activity filters, report/export filters and activity exports; connector/import payloads can create corresponding activity entries | CALL 5, WHATSAPP 6 activity entries with an action. This is a contact channel/method, not a business action/outcome; the name “Action” is broad but consistent in current forms. |
| ResponseType: PICKED_UP, NO_RESPONSE, INVALID_NUMBER, REPLIED | They answered, No answer, Wrong number, They wrote back | Create Lead, Record Progress, activity editing/history; backend enforces response compatibility by action | Sales activity filters and activity report/export filters; historical entries keep enum values | NO_RESPONSE 6, REPLIED 3, PICKED_UP 2, INVALID_NUMBER 0. PICKED_UP and REPLIED are modality-specific success labels; “Wrong number” is contact-data quality rather than a customer response. |
| InterestType: INTERESTED, NOT_INTERESTED | Create/Record Progress centralized: Interested, Not Interested; activity editor has a title-case variant | Conditional field in Create Lead, Record Progress and activity editing. Successful response requires non-null interest; unsuccessful response requires null. | Sales filters/export and activity history | INTERESTED 4, NOT_INTERESTED 1; null on unsuccessful interactions. Binary model lacks “unknown/not asked/not applicable” for a successful contact; changing this affects a validated business contract. |
| ConnectorStatus: INACTIVE, ACTIVE, ERROR | Inactive, Active, Error (sync-run history maps ACTIVE to “Success”, ERROR to “Failed”) | Connector list/config, scheduler and service | Connector export/filter and sync history | One connector ACTIVE. “Active” can mean enabled/running/sync succeeded depending on context; sync-run labels are intentionally different, but deserve explicit context. |
| ConnectorScheduleType: MANUAL, EVERY_5_MIN, EVERY_15_MIN, EVERY_30_MIN, HOURLY, DAILY, CUSTOM | Manual, Every 5/15/30 Minutes, Hourly, Daily, Custom; list view shortens intervals to “Every 5/15/30 min” | Connector scheduling form/service; MANUAL default; runtime translates fixed intervals/custom config | Connector export includes schedule type; scheduler consumes stored values | MANUAL 1. Others unused in current connector rows. These are operational choices, not lead workflow choices. “Custom” needs interval context, supplied conditionally. |
| ConnectorHealthStatus: HEALTHY, WARNING, ERROR | List: Healthy, Warning, Error; admin dashboard: Healthy, Needs attention, Unavailable; edit modal can show raw enum | Connector list, dashboard, edit modal; scheduler updates health | Connector health filters/export; monitoring and sync system | HEALTHY 1. UI labels are inconsistent for WARNING/ERROR. “Error” also exists as connector status, so health vs operational state needs context. |
| UnmatchedEmailStatus: UNMATCHED, ASSIGNED, IGNORED, SPAM, PARSER_REQUESTED | No centralized label catalog found; some states may be shown raw in Admin workflows | unmatchedEmailService changes the state from actions (Assign/Create Provider → ASSIGNED; Ignore → IGNORED; Spam → SPAM; request parser → PARSER_REQUESTED); API lists/actions are Admin-only | No dedicated export fields/filter identified; provider/inbox operations only | UNMATCHED 2; other values 0. These are dispositions/actions on an unmatched email, not interchangeable lead statuses. |
| ParserRequestStatus: OPEN, IN_PROGRESS, COMPLETED, DECLINED | No centralized display catalog found; endpoint/service updates typed states | Parser request API/service; default OPEN | No dedicated report/export found | Zero rows. Low use in this configured database does not establish lack of need; owner/developer workflow may use it later. |
| ActivityEventType: INTERACTION, FOLLOW_UP, NOTE, SYSTEM | Activity/history UI supplies event-specific descriptions; no general dropdown | Activity services group entries into event types | Export event-type filters and activity export | INTERACTION 11, FOLLOW_UP 8, NOTE 1, SYSTEM 41. These are audit/history containers, not choices for users. |
| ActivityEntryType: CREATED, UPDATED, ASSIGNED, NOTE_ADDED, NOTE_EDITED, IMPORTED, STATUS_CHANGED, FOLLOW_UP_SCHEDULED, FOLLOW_UP_RESCHEDULED, FOLLOW_UP_COMPLETED, FOLLOW_UP_CANCELLED, DELETED, RESTORED, ATTACHMENT_ADDED, CALL, WHATSAPP | Human-readable activity-history messages; many labels are assembled from metadata rather than a shared catalog | Activity/event and workflow services; entries represent audit facts | Activity entry type export filters/columns; report/history builders | Used counts: CREATED 37, FOLLOW_UP_COMPLETED 7, UPDATED 5, FOLLOW_UP_SCHEDULED 10, WHATSAPP 6, CALL 5, NOTE_ADDED 3, STATUS_CHANGED 1; other values 0 in the snapshot. These values are historical contract, not dropdown options. |

### 3.1 Lead Source is data, not an enum

LeadSource is a mutable lookup model (name, unique slug, free-form sourceType, active, description and priority) selected by source ID. The lead-source admin modal adds/removes named sources; Create/Edit Lead, filters, connector assignment and reports show dynamic names. Snapshot: 3 sources, 2 active; Facebook Ads (MANUAL, 47 linked leads), Mock REST Provider (inactive, REST, 50), REST Connector QA Provider (active, rest, 18). The case difference in sourceType and provider-shaped labels used as “lead sources” show that acquisition channel, source/provider identity, and technical source type are not clearly separated. No values should be hard-coded into an enum without deciding whether the field means channel or integration provider.

## 4. Current dropdown catalog and consistency findings

| Surface | Dropdown/choices | Current selection and placeholder | Findings |
|---|---|---|---|
| Create Lead | Status: five shared lead status labels | NEW preselected; no placeholder | Status is a meaningful classification, so silently choosing New may overstate user intent. It is also the backend default. |
| Create Lead | Priority: four shared lead priority labels | MEDIUM (“Normal”) preselected; no placeholder | User may leave Normal by default without choosing urgency; the list mixes scale labels. |
| Create Lead | Category: 17 shared labels | Blank value labeled “None” | Blank is represented honestly, but “None” is not a prompt; all values are currently used. |
| Create Lead | Lead Source: active dynamic source names | Blank value “None” | Dynamic list can mix acquisition channels with technical provider records; inactive source display/selection policy needs owner definition. |
| Create Lead | Action: Call, WhatsApp | CALL preselected; no “Select action” placeholder | Required interaction can be misrecorded as Call if user only accepts the default. |
| Create Lead | Response: action-compatible subset of four labels | “Select response”; blank by default | Strong explicit-choice pattern. Action-specific options are valid, but modality-specific labels make the two lists look different. |
| Create Lead | Status/Priority appear between Response and Interest | As above | This differs from Record Progress only in surface/component, not meaning; both use the same central catalogs and order. |
| Create Lead | Interest: Interested, Not Interested | “Select interest”; shown only for success | Good conditional visibility, but no “unknown/not asked” possibility when a successful response occurs. Validation requires a binary answer. |
| Create Lead | Follow-up scheduling | Switch off by default; date/time blank; Date required only when on; Time optional | Scheduling date/time values are omitted/cleared while off. Follow-up priority is not shown and shared service assigns MEDIUM. |
| Edit Lead | Status, Priority, Category, Lead Source | Existing record values; blank Category/Source is “None” | Existing values should remain initialized from the record. Same terminology issues as Create Lead. Edit also preserves separate legacy City and District fields. |
| Record Progress | Action, Response, Status, Priority, Interest | CALL default; response/interest explicit; status/priority from current lead (fallback NEW/MEDIUM) | Shared labels and compatibility rules. Action may be assumed if left untouched. |
| Record Progress | Schedule a new follow-up | Switch off; date/time blank; no priority selector | Clear default. Current task display is read-only. New follow-up priority is MEDIUM from backend behavior. |
| Lead activity edit | Action, Response, Interest | Existing activity values; response and interest have explicit select prompts | Interest labels are hard-coded (“Not Interested”) rather than using centralized catalog, presently visually identical but duplicated. It validates a patched outcome against stored state. |
| Sales/Admin lead tables | Status, source, activity/action/response/interest, priority, category, follow-up, owner, archive filters | All/Any/Hide options; empty query means no filter | Same centralized catalogs for enum options. Capitalization differs from export filters (“All Statuses” vs “All statuses”; “All Sources” vs “All sources”; etc.). Filters are not data-entry classifications. |
| Export workspace | Status, source, action, response, priority, category, interest; archive, assignee, connector and date selectors | Empty multi-selects mean all; archive defaults to Active and archived; date preset defaults all-time; activity date defaults Any; source/connector/assignee empty means all (assignee includes Unassigned only when selected) | Correctly distinguish filter-all from an actual enum value. Option labels use centralized lead/activity catalogs. |
| Lead source manager | Free-text name | Empty; placeholder “e.g. Google Ads, Referral, WhatsApp” | Helpful examples combine ad channel, referral type and messaging channel; example list implies channel semantics while sources can also be providers. |
| Connector editor | Connector type, provider, HTTP method/auth, pagination and schedule type | New connector type defaults REST API, provider Unassigned, method GET, auth None, API-key location Header, pagination Page Number, schedule Manual | Technical options are not lead classifications. Provider naming overlaps the Lead Source concept. Existing connector type is locked on edit. |
| Admin user editor | Role and Sales privilege | SALES and JUNIOR defaults | Role grants access; default SALES is conservative. JUNIOR grants fewer capabilities, but “Junior” can be read as seniority rather than access tier. Privilege is hidden/irrelevant for Admin role. |

Lead-source values are dynamic and may be created at runtime, so a single exhaustive static option list is not meaningful; catalog names and active/inactive behavior are owner-managed.

Connector/provider form option detail: connector type is Gmail or REST API (new default REST API); the provider selector defaults to Unassigned. REST method choices are GET (default), POST, PUT, PATCH, DELETE. Authentication choices are None (default), API Key, Bearer Token, Basic Auth, Custom Header; API key location is Header (default) or Query Parameter. Pagination choices are Page Number (default), Offset, Cursor, Next URL, Token. Schedule choices are Manual (default), every 5/15/30 minutes, Hourly, Daily, Custom; Custom reveals an interval in minutes (default 60). Routing rules require an explicit provider and parser using “Select provider” / “Select parser”; connector defaults to Any connector, while rule priority defaults to 100, fallback off, active on. Provider list filters default to All status and All types; these are filters rather than classifications. These operational defaults are outside Lead workflow and should remain a separate terminology review.

## 5. Current defaults and recommended policy

| Field | Current default behavior | Risk | Proposal for review |
|---|---|---|---|
| Create Lead status | NEW selected; server also defaults NEW if omitted | New lead may be correct in most cases but can silently imply stage assignment | Owner decide whether New is an intentional default. If users must classify deliberately, show “Select status” and require it; otherwise keep New and make the meaning explicit. |
| Create Lead priority | MEDIUM / “Normal” selected; server defaults MEDIUM | Default priority is mistaken for an explicit triage decision | Prefer blank/“Select priority” if priority is required; otherwise preserve MEDIUM only if routine is a known operational default. Do not assign HIGH/URGENT automatically. |
| Create Lead category | blank, “None” | None is honest, but may read like a category option | Keep nullable; use a neutral “Select category (optional)” placeholder. Do not auto-select OTHER. |
| Create Lead source | blank, “None” | None is honest; dynamic sources may be ambiguous | Keep nullable unless source is required for attribution; use “Select source (optional)” and separate source channel from provider if both are needed. |
| Create Lead action | CALL preselected | Can create a false call record when user has not selected method | Prefer blank “Select contact method” and require explicit choice if initial interaction is mandatory. |
| Create Lead response | no selection; “Select response” | No accidental outcome | Keep explicit choice. |
| Create Lead interest | no selection; “Select interest” when shown | Successful-contact validation forces one of two outcomes | Retain explicit choice only if business confirms interest is always known after successful response; otherwise consider an explicit unknown/not discussed value. |
| Create Lead follow-up | off, no date/time; service sets MEDIUM priority | Date/time is not accidental; priority is invisible | Keep off and no dates. Decide whether priority should remain system-defaulted MEDIUM or become a user-visible decision. |
| Record Progress action | CALL preselected | Same false-call risk | Same explicit-choice recommendation as Create Lead for consistency. |
| Record Progress response/interest | blank placeholders, interest conditional | Clear explicit-choice behavior | Keep explicit response; resolve unknown/not asked policy before expanding interest values. |
| Record Progress status/priority | Initialized from existing lead; fallback NEW/MEDIUM while data loads | Existing record values are correct; fallback should not be submitted before lead loads (submit is disabled while loading) | Preserve existing lead value. Do not reset an existing lead to system defaults. |
| Follow-up status | PENDING always for new task; transitions controlled by service | User cannot accidentally create completed work | Keep backend-owned. No status dropdown is appropriate for routine scheduling. |
| Follow-up priority | MEDIUM always for new tasks in shared service; no form selector | “Priority” appears in task display/export, but users cannot set it through current scheduling UI | Either keep a documented system default or add an explicit selector only after the owner establishes priority semantics. |
| Follow-up date/time | empty; date required when schedule switch is on, time optional | Good explicit schedule intent | Keep empty and conditional. “Due date” is clearer than “Date” for consistent surfaces. |
| Edit Lead fields | Values loaded from current record | No new classification should be silently introduced | Preserve stored values; blank nullable fields should stay blank. |
| Export and table filters | empty means All/Any | Empty is a filter state, not a classification | Keep this distinction and align wording/capitalization. |
| Admin role | SALES default; JUNIOR default privilege | Role default has broad consequences; privilege default is least privilege | Keep least-privilege defaults, explain Junior/Senior as permission tier or rename labels to “Standard access”/“Expanded access” if that matches policy. |

## 6. Placeholders and hint-text inventory

Create Lead and Record Progress use many unlabeled placeholder-free controls. Labels are visible, but the absence of examples is not necessarily a problem for simple classifications. Avoid adding paragraphs to every field.

| Form / field | Current placeholder or hint | Assessment | Candidate concise text |
|---|---|---|---|
| Create Lead — Name | None | Label is sufficiently clear; required validation says “Enter at least 2 characters.” | Optional placeholder “Full name”; avoid duplicating label. |
| Company | None | Clear. | “Company or organization” (optional). |
| City, District, State | None | Clear labels; City/District equality validation is unusual and should be explained only if this remains a business rule. | Example values only if users need geographic format guidance. Do not imply a required pairing. |
| Phone | None; input requires exactly 10 digits when present | Missing format instruction until validation appears; geographic rule may be locale-specific. | “10-digit phone number” only if the 10-digit rule applies to all intended markets. Confirm country/format policy first. |
| Email | None; validation message on invalid value | Clear; no example needed. | Optional “name@example.com” if users frequently enter invalid formats. |
| Category | “None” option | No explanatory hint. Category options are diverse, making the label alone insufficient. | Replace prompt with “Select category (optional)”; define category semantics before adding a hint. |
| Lead Source | “None” option | Source means dynamic registry entry/provider/channel ambiguously. | “Select source (optional)” until channel-vs-provider decision. |
| Action | No placeholder; Call preselected | Default masks explicit action choice. | “Select contact method” if default removed. |
| Response | “Select response” | Useful. Labels “They answered/wrote back” are conversational but fairly clear. | Keep short prompt; if labels revised, make both modalities parallel. |
| Status / Priority | No placeholder; NEW/MEDIUM selected | No hint says these are existing/default classifications; Create Lead has no visible field help. | If retained defaults, concise option labels should be self-explanatory; if no default, use “Select status/priority”. |
| Interest | “Select interest” | Clear enough, but binary requirement may force a guess. | Keep prompt; add “Not discussed” only if owner approves the value/rule. |
| Notes | “Add notes...” in Create Lead and Record Progress | Generic, but field purpose is obvious. | “Key details from the conversation” is a concrete alternative; current text is acceptable. |
| Schedule toggle | “Schedule a follow-up” / “Schedule a new follow-up” | Same intent with slightly different phrase. | Standardize to “Schedule a follow-up”; no additional explanation needed if date fields reveal after enabling. |
| Follow-up date/time | Create Lead labels Date/Time; Record Progress Due date/Time; no placeholders | Native date/time controls are self-explanatory; label mismatch is unnecessary. | Standardize labels to “Due date” and “Time”. |
| Record Progress status/priority | Existing lead values; no placeholder | Correctly reflect the current lead. | No hint needed. |
| Lead Source Manager — new source | “e.g. Google Ads, Referral, WhatsApp” | Examples describe acquisition channels, while current list also contains providers. | After semantics decision, use examples from the chosen concept (channel examples or provider names). |
| Follow-up scheduling empty state | “No pending follow-up.” | Compact and clear. | Keep. |

Record Progress currently has no descriptive subtitles in its primary form; the follow-up card may show title/description/owner as record data, not helper text. Create Lead section headings identify the two sections without added descriptive paragraphs.

## 7. Actual configured-database usage snapshot

All counts below are aggregate counts from the configured database, queried read-only on 2026-11-10. Lead counts exclude soft-deleted leads; other tables count all rows. These results are not a substitute for production-history/archive analysis.

| Field | Current values / records |
|---|---|
| Leads | 115 total, 0 soft-deleted |
| Lead status | NEW 58; CONVERTED 16; LOST 13; SPAM 6; ON_HOLD 22 |
| Lead priority | LOW 25; MEDIUM 55; HIGH 26; URGENT 9 |
| Lead category | null 20; Medical Representative 8; Retailer 7; Wholesaler 2; Distributor 6; Marketing 3; Third Party 6; Doctor 6; Franchise 4; Business 7; Hospital 3; Clinic 7; Pharmacy 6; Laboratory 3; Manufacturer 8; Corporate 6; Government 8; Other 5 |
| Lead Source registry | Facebook Ads (active, type MANUAL): 47 linked; Mock REST Provider (inactive, type REST): 50; REST Connector QA Provider (active, type rest): 18. Registry contains 3 rows, 2 active. |
| Follow-up status / priority | 10 total: PENDING 3, COMPLETED 7, CANCELLED 0. Priority: MEDIUM 10. |
| Interaction action | CALL 5, WHATSAPP 6 (11 entries with action) |
| Interaction response | NO_RESPONSE 6, REPLIED 3, PICKED_UP 2, INVALID_NUMBER 0 (11 entries with response) |
| Interest | INTERESTED 4, NOT_INTERESTED 1 (5 non-null entries) |
| Activity event type | SYSTEM 41, INTERACTION 11, FOLLOW_UP 8, NOTE 1 |
| Activity entry type | CREATED 37, FOLLOW_UP_SCHEDULED 10, FOLLOW_UP_COMPLETED 7, WHATSAPP 6, UPDATED 5, CALL 5, NOTE_ADDED 3, STATUS_CHANGED 1; other enum entries 0 in snapshot |
| User role / privilege | ADMIN 1, SALES 2; JUNIOR 1, SENIOR 1, null 1 |
| Connector status / schedule / health | One ACTIVE connector; MANUAL schedule 1; HEALTHY 1 |
| Unmatched email / parser request | UNMATCHED 2; other unmatched states 0; no parser-request rows |

## 8. Workflow and terminology problems

### 8.1 Lead status is not one dimension

NEW and CONVERTED suggest progress through a lifecycle; LOST is a closed disposition; SPAM/“Junk” is record quality; ON_HOLD/“Paused” is a temporary state. The report service currently calls NEW and ON_HOLD “active/open”, CONVERTED “won”, and LOST “lost”; SPAM is outside the won/lost/open summary. No general transition state machine was found in the lead service; status is editable as a normal classification. A status transition can record an activity entry, but closedAt, convertedAt, and lostReason are not uniformly derived by the status update path inspected. This can leave lifecycle metrics/metadata semantics unclear. The Admin report color mapping still branches on CONTACTED and QUALIFIED, values absent from the current Prisma enum; those colors are stale and should be considered when a separately authorized implementation is planned.

### 8.2 Priority labels do not form one scale

LOW / MEDIUM / HIGH / URGENT are ordered values, while the display “Normal” renames MEDIUM and “Do now” changes URGENT into an imperative. The highest level may overlap with “High”; no SLA or due-time guidance is communicated. Follow-up priority shares the same list but is invisible during the current scheduling flows, and all sampled tasks are MEDIUM.

### 8.3 Category mixes different kinds of things

The set mixes individual roles (Doctor, Medical Representative), channel/relationship concepts (Marketing, Third Party), business types (Retailer, Wholesaler, Distributor, Franchise), institution types (Hospital, Clinic, Pharmacy, Laboratory), and size/ownership/sector labels (Business, Corporate, Government, Manufacturer). Some may be mutually exclusive in current owner usage; the code does not encode such definitions. OTHER is useful as a fallback but should be accompanied by an optional detail only if the owner needs it. Every category appears in the current sample, so this is a semantics/organization question rather than a cleanup-by-frequency opportunity.

### 8.4 Source conflates acquisition attribution and integration ownership

The UI calls the lookup “Lead Source” and gives examples of marketing channels. The model stores named providers used by connectors and routing. Current data includes Facebook Ads plus REST provider names; a REST QA provider is active while another provider is inactive but has 50 linked leads. sourceType is a free-form string with inconsistent case (REST/rest) and is not the same thing as Connector.type. Decide whether the CRM needs “How did we acquire this lead?”, “Which provider imported it?”, or both.

### 8.5 Interaction response models different axes

CALL and WHATSAPP are channels. PICKED_UP and REPLIED encode successful reach by channel, NO_RESPONSE represents failure to reach, and INVALID_NUMBER describes data validity. The action-response refinement prevents an invalid pairing, but different action selections produce differently worded response lists. A modality-neutral result model could be easier to filter (“Reached”, “No response”, “Invalid contact”), but would lose call-vs-message distinction unless channel remains a separate field. Existing INVALID_NUMBER has no sampled usage but could be important operationally.

### 8.6 Interest may demand unsupported certainty

The business rule requires INTERESTED or NOT_INTERESTED for a successful response. Real conversations may end without an interest assessment; the UI currently cannot record “not discussed/unknown”. This is a deliberate data-quality decision, not merely a form issue, because API validation, historical interaction writes and exports depend on the nullable/binary contract.

### 8.7 Follow-up status is service-owned, labels differ

The state machine is clear in code: pending work can complete, cancel, or remain pending; schedule replacement lifecycle is service-managed. However “To do/Done” differs from “PENDING/COMPLETED” in API and operational language. Cancellation currently has zero records in the live snapshot but is supported by soft cancellation and must be retained unless the owner explicitly decides otherwise.

## 9. Proposed terminology catalog (not approved)

The table offers candidate terminology; it does not recommend immediate stored-value changes. For fields with unresolved meaning, multiple alternatives are shown.

| Field | Current value/label | Problem | Proposed label/value | Reason | Migration impact |
|---|---|---|---|---|---|
| Lead Status | NEW / New | Meaning is “not moved to another status”; no contacted/qualified stage | Candidate display-only: New / retain NEW | Clear if a simple lifecycle is intended | None for label-only. |
| Lead Status | CONVERTED / Customer | “Converted” technical, “Customer” is an outcome/entity state | Candidate “Customer” / retain CONVERTED; alternative “Won” if status means sale outcome | Everyday language; select according to whether CRM tracks customer conversion or sales win | Label-only has no enum migration; affects dashboard/report wording and historical labels. |
| Lead Status | LOST / Lost | Does not say why or whether closed | Candidate “Closed — not won” / retain LOST; alternative “Lost” if familiar in sales team | Make closed disposition explicit | Label-only; review exports that still emit raw values. |
| Lead Status | SPAM / Junk | Record quality mixed into sales lifecycle; “Junk” informal | Candidate “Spam / invalid lead” / retain SPAM, or move to an archive/quality flag | Distinguishes unusable data from sales outcome | Separating requires schema/API/report changes; do not drop existing 6 rows. |
| Lead Status | ON_HOLD / Paused | Temporary state may need resume date/reason; “Paused” can describe task instead of lead | Candidate “On hold” / retain ON_HOLD; alternatively model as a hold flag with reason/date | Matches common business language | Label-only low risk; splitting adds fields/workflow. |
| Lead Status (alternative model) | Five mixed values | Lifecycle, disposition and quality have different transition rules | Candidate lifecycle: New → Contacting → Qualified → Customer/Closed-lost; handle spam separately. Alternative minimal model: New, Active, Customer, Closed-lost with hold as separate state. | Represents a pipeline, but only if the owner actually works those stages | New enum values, mapping old data, state machine, reports and API compatibility; high impact. |
| Lead Priority | LOW / Low | — | Low / LOW | Clear. | Label-only. |
| Lead Priority | MEDIUM / Normal | Storage scale and label differ | Medium or Routine / retain MEDIUM | Preserve ordering semantics; “Routine” if urgency language is desired | Label-only, but consumers may display raw values. |
| Lead Priority | HIGH / High | Unclear threshold versus urgent | High / HIGH | Familiar, but define expected response time | Label-only. |
| Lead Priority | URGENT / Do now | Imperative overlaps High and has no SLA | Urgent / URGENT; alternative Today / add explicit due-time policy | Keep scale consistent or tie to a real deadline | Label-only if value retained; new SLA rules are behavior changes. |
| Lead Category (candidate split) | Current 17 values | Role, organization type and relationship are mixed | Contact role (e.g. Doctor, Medical Representative) plus Organization type (Retailer, Hospital, Pharmacy, Manufacturer, Government, etc.). Keep relationship/source descriptors separate. | Allows valid combinations such as a Doctor at a Hospital | Requires schema/API/UI/export migration and mapping. Owner must define values and cardinality. |
| Lead Category (near-term alternative) | Current 17 values | Existing single field may still be operationally required | Keep current values, group headings in UI (Person/role, Organization, Other) without changing stored values; alternatively rename only display labels after definitions | Low-risk discoverability while preserving records | Grouping/labels no schema migration; every category appears in current data. |
| Lead Source | Dynamic source ID/name | Acquisition channel and importer/provider mixed | Option A: reserve Lead Source for acquisition channel (Referral, Website, Ads, Event, Outbound, etc.) and store provider separately. Option B: keep it as Provider and introduce an acquisition-channel field only if attribution is needed. | Distinguishes marketing attribution from connector ownership | Option A needs data migration for existing source IDs; Option B requires additive field/API/export work. Names are not enum values today. |
| Follow-up Status | PENDING / To do | Display differs from API and other workflow text | Pending / retain PENDING; Completed / retain COMPLETED; Cancelled / retain CANCELLED | Same words across tasks, status filters and audit trail | Label-only. Keep lifecycle values and cancellation support. |
| Follow-up Priority | LOW/MEDIUM/HIGH/URGENT; “Normal”/“Do now” | Same inconsistent labels as lead priority, but hidden scheduling control | Reuse approved priority labels; decide whether task urgency differs from lead importance | Avoid two meanings for a shared dropdown | Label-only if same scale; separate scale requires new enum/API contract. |
| Action | CALL / Call; WHATSAPP / WhatsApp | Label “Action” can sound like result, although values are channels | “Contact method” with Call / WhatsApp; retain CALL, WHATSAPP | Names what user selects | Label-only; adjust filter/export wording. |
| Response | PICKED_UP / They answered; REPLIED / They wrote back | Modality-specific success labels; mixed with contact validity | Option A keep modality-specific values but label “Answered” / “Replied”. Option B use “Reached” for both and preserve channel separately. | A is accurate to current data; B is simpler if only reach outcome matters | Label-only for A. B needs value mapping or new response model and may lose modality-specific history. |
| Response | NO_RESPONSE / No answer | “No answer” fits phone better than a message | “No response” / retain NO_RESPONSE | Works for calls and messages | Label-only. |
| Response | INVALID_NUMBER / Wrong number | Invalid phone can still mean wrong, unreachable or malformed; not a response | “Invalid contact details” if it covers phone/email; otherwise “Wrong number” | Names the data issue accurately | Label-only; no current sample use, but retain until owner confirms. |
| Interest | INTERESTED / Interested; NOT_INTERESTED / Not Interested | Binary and mandatory after any successful contact | Keep if team reliably assesses interest; alternative add “Not discussed” (value UNKNOWN/NOT_ASSESSED) | Avoid forcing a guess after a successful response | Additive enum/API/validation/history/export change; owner decision required. |
| Lead Source sourceType | MANUAL, REST/rest | Free-form, casing inconsistent | Normalize technical source type values separately from human-facing source name | Prevent filters/mappings splitting by case | Data normalization and connector/parser compatibility; sourceType is not Prisma enum. |

## 10. Option ordering and placeholder recommendations

These recommendations are for a future approved implementation. They should not be applied before owners settle the meaning of the fields.

| Dropdown | Candidate ordering | Candidate prompt/default policy | Hint |
|---|---|---|---|
| Lead Status | Active/new states first, then successful/closed outcomes, then quality/hold if still mixed | If explicit: “Select status”; otherwise preserve New only if owner confirms it is a true default | None if definitions are in option labels or a short accessible info link. |
| Lead Priority | Low → Medium/Routine → High → Urgent | “Select priority” if a deliberate classification; otherwise keep Medium only if routine is the agreed default | Add response-time definitions only after an SLA is approved. |
| Lead Category | Grouped by approved concept (role/person, organization, other) | “Select category (optional)”; leave blank | A short hint is warranted until single-field meaning is clarified. |
| Lead Source | Alphabetical dynamic list or grouped acquisition channels/providers | “Select source (optional)” | Explain whether this means acquired through or imported from. |
| Action/contact method | Call, WhatsApp (alphabetical or common usage first) | “Select contact method”; require explicit choice if an interaction is required | None. |
| Response | Successful contact outcomes, then no response, then invalid details; only compatible choices | “Select response”; never default | Short labels should be modality-neutral or clearly modality-specific. |
| Interest | Interested, Not interested, then approved unknown/not discussed option | “Select interest”; never default | Only if the policy on unknown is explicit. |
| Follow-up Status | Not a user-selectable scheduling dropdown | No prompt; backend owns PENDING and lifecycle transitions | Use the same Pending/Completed/Cancelled labels in UI/history. |
| Follow-up Priority | Low → Medium → High → Urgent if selector is approved | Explicit prompt if exposed; otherwise keep backend MEDIUM and document this default | Do not add a control until task-level semantics are defined. |
| Connector health/status | Keep separate groups/labels for connector state vs health | Not applicable to lead workflow | Use consistent distinct labels, e.g. “Connection state” and “Health”. |

## 11. Database, API and compatibility impact

1. **Display-label-only changes:** No Prisma enum or migration is needed. Check centralized label helpers, badges, Admin/Sales reports, activity history, filter summaries, connector status mappings, and tests. Some history surfaces use raw enum fallback, so not every view necessarily uses the central labels.
2. **Option ordering and placeholder changes:** No database migration if stored values remain the same. Explicit blank selections may require nullable frontend state and updated required validation; do not accidentally serialize a display string as a value. Defaults can also be applied by backend when omitted, so UI-only blankness does not remove a database default.
3. **Additive enum values:** Prisma-generated types, PostgreSQL enum migration, API validators, client contracts, activity history, filters, exports, reports, connectors and tests need coordinated updates. Old clients cannot send a newly added value until updated; existing consumers may fail if they assume exhaustive unions.
4. **Renaming stored enum values:** Requires a PostgreSQL enum rename or a staged replacement type migration; review historical ActivityEntry values, raw exports, connector payloads, generated client types and external consumers. A display-only rename is substantially safer when semantics are unchanged.
5. **Removing/replacing values:** Never drop a value merely because its current count is zero. Back up/define a mapping for active records and histories; update defaults, raw SQL, analytics, filters, reports, exports, integrations, seed data and tests. Current data uses all LeadStatus, LeadPriority and LeadCategory values.
6. **Splitting status/category/source/interest concepts:** Requires additive fields or new models, API input/output and authorization decisions, migration/backfill rules, UI workflows, historical reporting policy and connector mapping. Splitting a value into multiple dimensions cannot be inferred from the current single enum alone.
7. **Follow-up lifecycle:** FollowUpService owns status transitions and MEDIUM creation default; do not change state behavior as part of a label audit. Existing task state history is recorded as ActivityEntryType entries.
8. **Lead Source:** It is relational data and appears in filters, source reports, connector ownership/routing and exports. Reclassifying source semantics needs migration of source IDs and likely separate provider/attribution semantics; changing sourceType casing needs compatibility review for connectors and imported payloads.
9. **Current report inconsistency:** Admin reports have visual branches for CONTACTED and QUALIFIED despite these not being LeadStatus values. This is stale code evidence, not a proposal to add those statuses. Verify actual report query values before an implementation phase.

## 12. Decisions requiring business-owner input

| Decision | Current behavior / concern | Alternatives and consequences | Recommendation from available evidence |
|---|---|---|---|
| What does Lead Status represent? | One enum combines New/Customer, Lost, Spam/Junk, Paused. Reports classify only NEW/ON_HOLD as open, CONVERTED as won, LOST as lost. | A) Keep five current values and define transitions. B) Pipeline stages plus separate disposition/quality/hold flags (schema/API/report expansion). C) Minimal New/Customer/Closed-lost with spam and hold separate. | Decide whether users manage stages or just outcomes before changing names/values. Current 115-record data uses every value. |
| Is “Customer” the right outcome for CONVERTED? | Current label says Customer; reports call it won. convertedAt exists but its maintenance semantics need confirmation. | Customer = relationship status; Won = deal outcome; Converted = technical event. | Use “Customer” if CRM tracks account conversion; use “Won” only if a sales opportunity is actually won. Define timestamp/report contract. |
| How should Spam and On hold behave? | Spam is a status; hold is treated as open. No separate reasons/resume metadata are enforced here. | Keep statuses; separate quality/hold fields; archive/soft-delete spam. | Keep existing values until rules, reasons and historic reporting are mapped. |
| What is Lead Category? | 17 mixed, all currently used values. | A) Current single category with definitions. B) Contact role and organization type as separate dimensions. C) Organization type only, move people roles to job title/other field. | Ask users to categorize actual customer account or person. If both are needed, separate dimensions; do not combine them in one enum. |
| What does Lead Source mean? | Dynamic provider registry serves both UI source selection and connector ownership; source types include MANUAL/REST with casing differences. | A) Acquisition channel. B) Import/provider. C) Both, in separate fields. | If reporting on marketing attribution matters, recommend C. Otherwise choose one meaning and relabel the current field. |
| Should Create Lead set New/Normal automatically? | NEW and MEDIUM selected and server defaults also exist. | Keep defaults for speed; or blank choices and require explicit classification; or default New but leave priority blank. | At minimum consider blank Priority. Keep New only if every manually created record is genuinely new by policy. |
| Should Action default to Call? | It is required for the initial interaction but auto-selected. | Keep as common path; or require “Select contact method”. | Prefer explicit selection to avoid false call history unless Call is overwhelmingly the standard and UI makes it obvious. |
| Is every successful interaction guaranteed to include interest? | API requires binary interest for PICKED_UP/REPLIED. | Keep binary requirement; allow successful-but-unknown; separate interest from response. | Confirm whether users are expected to ask/record interest every time. If not, add “Not discussed” with clear reporting semantics. |
| Should Call/WhatsApp share a response vocabulary? | PICKED_UP vs REPLIED; INVALID_NUMBER is not a response and action is channel. | Keep channel-specific success; unify as Reached/No response/Invalid details; model channel separately and outcome separately. | Keep current stored values until reports and integration consumers are reviewed; “No response” is a safe display-label candidate. |
| Does task priority need user control? | Follow-up enum has four levels but current scheduling UI does not expose it; service sets MEDIUM; all sample tasks MEDIUM. | Keep fixed Medium; add task priority selector; use lead priority as inherited default. | Decide only if assignees act differently based on task urgency. If exposed, choose whether priority is independent or inherited. |
| What should “Junior/Senior” mean? | Values drive permissions; labels imply hierarchy/seniority. | Keep internal roles; label access tiers; rename enum values. | If these values are permissions, show “Standard/Expanded access” as labels while preserving codes, pending permission-owner approval. |
| Is a 10-digit phone rule universal? | Lead validation enforces exactly ten digits. | Keep for single-country deployment; support country code/E.164 or locale-specific rules. | Confirm deployment geography before adding phone placeholders or altering validation. |

## 13. Suggested implementation phases after review

1. **Owner decision log:** Approve definitions for status, category, source, interest, action/response, defaults and task priority; record rejected alternatives.
2. **Safe display pass:** Centralize labels and align filter wording/capitalization; fix stale report status-color branches; no stored-value changes.
3. **Form defaults and prompts:** Based on decisions, add explicit prompts where classification must be intentional; keep server default behavior aligned or remove it through an approved API/business change.
4. **Compatibility inventory:** Identify external connector mappings, historical export consumers and all typed/raw SQL status uses; define backfills and old-client behavior.
5. **Additive model changes if approved:** Add new fields/enum values first, migrate/backfill without deleting old values, update APIs/UI/reports/exports and add compatibility tests.
6. **Removal/cleanup only after evidence:** Migrate all records and external consumers, verify counts and history, then separately approve any enum-value removal or legacy-field deprecation.

## 14. Audit boundary

This phase changed no application code, Prisma schema, migrations, enum values/labels, dropdown options, defaults, placeholders, backend behavior or database records. The aggregate database queries were read-only. This document is a proposal and requires owner review before implementation.
