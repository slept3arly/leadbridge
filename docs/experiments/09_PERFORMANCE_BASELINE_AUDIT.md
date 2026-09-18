# LeadBridge Performance Baseline Audit

> **Status:** Experimental (Phase 1 measurement baseline)
> **Date:** 2026-09-17
> **Scope:** Code-level analysis of query patterns, N+1 issues, caching, frontend bundles, and database access patterns
> **Limitation:** No live database available — all performance claims are derived from code analysis, not measured execution times

---

## 1. Executive Summary

This audit establishes a factual baseline of LeadBridge's performance characteristics by tracing every database query path, identifying N+1 patterns, cataloging indexes, and analyzing frontend bundles. **No production measurements are available** — all findings are derived from code analysis and should be validated with `EXPLAIN ANALYZE` against a real database before Phase 2 optimization.

### Key Findings

| Finding | Classification | Evidence | Impact |
|---------|---------------|----------|--------|
| ILIKE '%term%' search across 5 fields | QUERY | Code (`query-builder.ts:63-66`) | Medium (grows with dataset) |
| OFFSET pagination on all lists | QUERY | Code (`query-builder.ts:59-61`) | Low (acceptable at current scale) |
| COUNT(*) on every page load | QUERY | Code (`lead.service.ts:205`) | Medium (full table scan) |
| 18 parallel dashboard queries (admin) | QUERY | Code (`dashboard.service.ts:35-62`) | Medium (connection pool pressure) |
| ActivityEntry fetch-all-to-count | N+1 | Code (`dashboard.service.ts:197-206`) | High (loads all matching rows into memory) |
| Routing rules fetched per payload | N+1 | Code (`routing-engine.ts:29-32`) | High (N queries for N payloads) |
| Parser lookup per payload | N+1 | Code (`connector-runtime.ts:295-298`) | High (N queries for N payloads) |
| Duplicate check per lead creation | QUERY | Code (`duplicate.service.ts:10-25`, `lead.service.ts:289-296`) | Medium (2 queries per import) |
| Redundant Lead index | INDEX | Schema (`@@index([connectorId, sourceReferenceId])` vs `@@unique`) | Low (write overhead) |
| GSAP unoptimized bundle (~315KB) | BUNDLE | Code (3 client components import gsap) | Medium (initial load) |
| Empty next.config.ts | BUNDLE | `next.config.ts` | Medium (missed optimization) |

### Biggest Surprise

The `dashboard.sales()` method loads **all matching ActivityEntry rows** into memory just to count distinct `leadId`s (`dashboard.service.ts:197-206`). This is not a traditional N+1 but is a severe memory and query amplification issue — it should use `GROUP BY` or `COUNT(DISTINCT ...)` instead.

---

## 2. Audit Scope

### In Scope
- All Prisma schema models, relations, and indexes
- All service-layer database queries (20 services)
- All API route handlers (38 routes, 52+ handlers)
- Frontend page components and client components
- Cache implementation (`unstable_cache`, tag-based invalidation)
- Connector/sync pipeline (routing → parsing → normalization → lead creation)
- Search, pagination, and count implementations
- Bundle-affecting dependencies

### Out of Scope
- Live database measurements (no database available)
- `EXPLAIN ANALYZE` results (requires live database)
- Network latency measurements
- Actual row counts or table sizes
- Load testing or stress testing

---

## 3. Environment / Database Context

| Component | Value | Source |
|-----------|-------|--------|
| Framework | Next.js 16.2.10 | `package.json` |
| Database | PostgreSQL (Neon serverless) | `docs/architecture.md` |
| ORM | Prisma 7.8.0 | `package.json` |
| Driver | `@prisma/adapter-pg` (Neon HTTP) | `package.json` |
| Auth | better-auth 1.6.23 | `package.json` |
| Node.js | Not specified | `package.json` targets ES2017 |
| TypeScript | ^5 | `package.json` |

**Note:** No database connection string or live database was available for this audit. All findings are code-level.

---

## 4. Database Size & Table Distribution

**Measurement method:** Schema analysis only — no live database queries.

### Schema Statistics

| Metric | Count | Source |
|--------|------:|--------|
| Models | 19 | `prisma/schema.prisma` |
| Enums | 17 | `prisma/schema.prisma` |
| `@@index` declarations | 43 | `prisma/schema.prisma` |
| `@@unique` declarations | 2 | `prisma/schema.prisma` |
| Field-level `@unique` | 10 | `prisma/schema.prisma` |
| Total indexes (all types) | 55 | Derived |

### Estimated Relative Table Sizes

Based on schema structure and usage patterns (estimated, not measured):

| Table | Estimated Relative Size | Reasoning |
|-------|------------------------|-----------|
| `Lead` | **Largest** | Core entity, many text fields (displayName, company, email, phone, address, city, state, country, product, requirement, customFields JSON, rawPayload JSON), 19+ indexes |
| `ActivityEvent` | Large | One event per mutation, grow-only, indexed by leadId + occurredAt |
| `ActivityEntry` | Large | Multiple entries per event, grow-only, indexed by eventId |
| `FollowUp` | Medium | Per-lead follow-ups, grow-with-activity |
| `Note` | Medium | Per-lead notes, grow-with-activity |
| `ConnectorSyncRun` | Medium | One per sync run, grow-only |
| `User` | Small | Fixed set of users |
| `Connector` | Small | Fixed set of connectors |
| `LeadSource` | Small | Fixed set of providers |
| `Session` | Small | Transient, cleaned by expiry |
| Others | Small | Fixed or low-volume |

**Key observation:** `Lead.rawPayload` and `Lead.customFields` are both `Json?` columns that can store arbitrary JSON. These can grow unbounded and significantly bloat the Lead table. No size limits are enforced.

---

## 5. Index Inventory

### Complete Index Catalog

| Table | Index Type | Columns | Unique | Likely Query Purpose |
|-------|-----------|---------|--------|---------------------|
| **Lead** | `@@index` | `(assignedUserId, status, isDeleted)` | No | Sales user filtered by status |
| **Lead** | `@@index` | `(assignedUserId, isDeleted, updatedAt)` | No | Sales user list sorted by updatedAt |
| **Lead** | `@@index` | `(isDeleted, createdAt)` | No | Global list sorted by createdAt |
| **Lead** | `@@index` | `(status, isArchived, isDeleted)` | No | Status filtering |
| **Lead** | `@@index` | `(nextFollowUpAt, isDeleted)` | No | Follow-up queue queries |
| **Lead** | `@@index` | `(connectorId, sourceId)` | No | Connector sync queries |
| **Lead** | `@@index` | `(connectorId, sourceReferenceId)` | No | **REDUNDANT** — covered by @@unique |
| **Lead** | `@@unique` | `(connectorId, sourceReferenceId)` | Yes | Dedup during import |
| **Lead** | `@@index` | `(createdById, createdAt)` | No | Leads by creator |
| **Lead** | `@@index` | `(email)` | No | Email search (exact match) |
| **Lead** | `@@index` | `(phone)` | No | Phone search (exact match) |
| **Lead** | `@unique` | `leadNumber` | Yes | Unique lead number lookup |
| **ActivityEvent** | `@@index` | `(leadId, occurredAt)` | No | Lead timeline |
| **ActivityEvent** | `@@index` | `(leadId, type, occurredAt)` | No | Lead filtered timeline |
| **ActivityEntry** | `@@index` | `(eventId)` | No | Entries by event |
| **ActivityEntry** | `@@index` | `(followUpId)` | No | Entries by follow-up |
| **ActivityEntry** | `@@index` | `(type, createdAt)` | No | Dashboard activity counts |
| **FollowUp** | `@@index` | `(leadId, dueDate, status)` | No | Lead follow-ups by date+status |
| **FollowUp** | `@@index` | `(assignedUserId, status, dueDate)` | No | User follow-up tasks |
| **FollowUp** | `@@index` | `(leadId, createdAt)` | No | Lead follow-ups by creation |
| **Note** | `@@index` | `(leadId, createdAt)` | No | Lead notes timeline |
| **Note** | `@@index` | `(leadId, isPinned)` | No | Pinned notes |
| **Connector** | `@@index` | `(enabled, status)` | No | Scheduler discovery |
| **Connector** | `@@index` | `(sourceId, enabled)` | No | Provider connectors |
| **Connector** | `@@index` | `(parserId)` | No | Parser→connectors |
| **ConnectorSyncRun** | `@@index` | `(connectorId, startedAt)` | No | Sync run history |
| **ConnectorSyncRun** | `@@index` | `(status, startedAt)` | No | Failed runs |
| **RoutingRule** | `@@index` | `(active, priority)` | No | Routing engine lookup |
| **RoutingRule** | `@@index` | `(recipientGmailAccount, active, priority)` | No | Gmail-specific routing |
| **RoutingRule** | `@@index` | `(providerId)` | No | Provider routing rules |
| **UnmatchedEmail** | `@@index` | `(status, receivedAt)` | No | Unmatched queue |
| **UnmatchedEmail** | `@@index` | `(connectorId, receivedAt)` | No | Connector unmatched |
| **UnmatchedEmail** | `@@index` | `(senderEmail)` | No | Sender lookup |
| **ParserRequest** | `@@index` | `(status, requestedAt)` | No | Open requests |
| **ParserRequest** | `@@index` | `(requestedById, requestedAt)` | No | User requests |
| **FieldMapping** | `@@unique` | `(connectorId, sourceField)` | Yes | Unique field mapping |
| **FieldMapping** | `@@index` | `(connectorId, targetField)` | No | Target field lookup |
| **Parser** | `@@index` | `(type, active)` | No | Active parsers by type |
| **User** | `@@index` | `(role, active, isDeleted)` | No | User listing |
| **User** | `@@index` | `(isDeleted, deletedAt)` | No | Soft-delete cleanup |
| **LeadSource** | `@@index` | `(active, priority)` | No | Active providers |
| **Account** | `@@index` | `(userId, providerId)` | No | User accounts |
| **Verification** | `@@index` | `(identifier)` | No | Email verification |
| **Setting** | `@@index` | `(category)` | No | Settings by category |

### Redundant/Overlapping Indexes

| Index | Redundant With | Impact |
|-------|---------------|--------|
| `Lead.@@index([connectorId, sourceReferenceId])` | `Lead.@@unique([connectorId, sourceReferenceId])` | Write overhead (extra B-tree maintenance on every Lead insert/update) |

**Note:** The `@@unique` constraint already creates an index on `(connectorId, sourceReferenceId)`. The separate `@@index` on the same columns is redundant.

### Indexes Not Aligned with Current Query Patterns

| Index | Issue |
|-------|-------|
| `Lead.@@index([email])` | Standalone B-tree on email. Search uses `ILIKE '%term%'` — leading wildcard prevents index usage. Only useful for exact email lookups. |
| `Lead.@@index([phone])` | Same issue — `ILIKE '%term%'` prevents index usage for search. |
| `User.@@index([role, active, isDeleted])` | Leading column `role` has only 2 values (ADMIN/SALES) — low selectivity. Most queries filter `isDeleted` first. |

---

## 6. Query Inventory

### Lead List Queries

#### Admin Leads (`GET /api/leads`)

| Step | Query | Type | Lines |
|------|-------|------|-------|
| 1 | `prisma.lead.findMany({ where, select: leadListSelect, orderBy, skip, take })` | SELECT | `lead.service.ts:204` |
| 2 | `prisma.lead.count({ where })` | COUNT(*) | `lead.service.ts:205` |
| 3 | `prisma.$queryRaw` — latest activity event per lead | Raw SQL | `lead.service.ts:215-222` |
| 4 | `prisma.$queryRaw` — entries for event IDs | Raw SQL | `lead.service.ts:227-232` |

**Total: 4 queries per page load** (steps 1-2 run in parallel, steps 3-4 sequential after step 1)

**Search:** `containsSearch(["displayName", "company", "email", "phone", "leadNumber"], query.search)` generates:
```sql
WHERE (displayName ILIKE '%term%' OR company ILIKE '%term%' OR email ILIKE '%term%' OR phone ILIKE '%term%' OR leadNumber ILIKE '%term%')
```

**Pagination:** `skip = (page - 1) * pageSize`, `take = pageSize` — OFFSET-based.

**Count:** `prisma.lead.count({ where })` — exact count with same WHERE clause as the list query.

**Activity enrichment:** Two raw SQL queries with `DISTINCT ON` and `IN` clause to fetch latest activity per lead on current page. Not N+1 — batched for all leads on page.

#### Sales My Leads (`GET /api/leads` with SALES role)

Same as Admin Leads but with `accessWhere(actor)` adding `assignedUserId: actor.id` to WHERE clause.

#### Lead Detail (`GET /api/leads/[id]`)

| Step | Query | Type | Lines |
|------|-------|------|-------|
| 1 | `prisma.lead.findFirst({ where: { id, isDeleted: false }, select: leadDetailSelect })` | SELECT with 6 nested relations | `lead.service.ts:90-93` |

**Total: 1 query** — single lead with all relations.

#### Lead Detail Modal (`GET /api/leads/[id]/details`)

| Step | Query | Type | Lines |
|------|-------|------|-------|
| 1 | `prisma.lead.findFirst(...)` | SELECT | `leads/[id]/details/route.ts` |
| 2 | `prisma.note.findMany({ where: { leadId } })` | SELECT | `leads/[id]/details/route.ts` |
| 3 | `prisma.followUp.findMany({ where: { leadId } })` | SELECT | `leads/[id]/details/route.ts` |
| 4 | `activityEventService.listByLead(leadId)` | SELECT with cursor pagination | `leads/[id]/details/route.ts` |

**Total: 4 parallel queries** — all run simultaneously.

### Activity Timeline

#### `activityEventService.listByLead()` (`activity-event.service.ts:60-79`)

| Step | Query | Type |
|------|-------|------|
| 1 | `prisma.activityEvent.findMany({ where: { leadId }, include: { actor, entries.followUp }, cursor, skip, take, orderBy })` | SELECT with 2 nested includes |

**Total: 1 query per page** — cursor-based pagination (not OFFSET).

### Follow-up Queries

#### Lead Follow-ups (`GET /api/leads/[id]/follow-ups`)

| Step | Query | Type |
|------|-------|------|
| 1 | `prisma.lead.findFirst({ where: { id, isDeleted: false }, select: { id } })` | Access check |
| 2 | `prisma.followUp.findMany({ where: { leadId }, include: { assignedUser, createdBy } })` | SELECT with relations |

**Total: 2 queries**

#### `recalculateLeadFollowUpFields()` (called in every follow-up mutation)

| Step | Query | Type |
|------|-------|------|
| 1 | `db.followUp.findFirst({ where: { leadId, status: "COMPLETED" }, orderBy: { completedAt: "desc" } })` | SELECT |
| 2 | `db.followUp.findFirst({ where: { leadId, status: "PENDING" }, orderBy: { dueDate: "asc" } })` | SELECT |
| 3 | `db.lead.update({ where: { id: leadId }, data: { lastFollowUpAt, nextFollowUpAt } })` | UPDATE |

**Total: 3 queries** — runs inside every follow-up create/update/complete/remove transaction.

### Dashboard Queries

#### Admin Dashboard (`dashboardService.admin()`)

18 parallel queries + 1 sequential follow-up:

| # | Query | Type | Lines |
|---|-------|------|-------|
| 1 | `prisma.lead.count({ where: { isDeleted: false } })` | COUNT | `dashboard.service.ts:36` |
| 2 | `prisma.lead.count({ where: { isDeleted: false, status: { in: ["NEW", "ON_HOLD"] } } })` | COUNT | `:37` |
| 3 | `prisma.lead.count({ where: { createdAt: { gte: today }, isDeleted: false } })` | COUNT | `:38` |
| 4 | `prisma.lead.count({ where: { status: "CONVERTED", isDeleted: false } })` | COUNT | `:39` |
| 5 | `prisma.lead.count({ where: { status: "LOST", isDeleted: false } })` | COUNT | `:40` |
| 6 | `prisma.lead.count({ where: { assignedUserId: null, isDeleted: false } })` | COUNT | `:41` |
| 7 | `reportService.statusBreakdown()` → `prisma.lead.groupBy` | GROUP BY | `:42` |
| 8 | `reportService.leadSources(...)` → 3x `prisma.lead.groupBy` + 2x `findMany` | GROUP BY + SELECT | `:43` |
| 9 | `prisma.connector.findMany({ select: ... })` | SELECT | `:44` |
| 10 | `prisma.activityEvent.findMany({ take: 10, include: { actor, lead, entries } })` | SELECT with 3 includes | `:45-53` |
| 11 | `prisma.connectorSyncRun.findMany({ take: 5, include: { connector } })` | SELECT | `:54` |
| 12 | `prisma.parserRequest.count({ where: { status: "OPEN" } })` | COUNT | `:55` |
| 13 | `prisma.unmatchedEmail.count({ where: { status: "UNMATCHED" } })` | COUNT | `:56` |
| 14 | `prisma.lead.groupBy({ by: ["assignedUserId"], _count })` | GROUP BY | `:57` |
| 15 | `prisma.connector.count({ where: { enabled: false } })` | COUNT | `:58` |
| 16 | `prisma.connectorSyncRun.count({ where: { status: "ERROR", startedAt: { gte: yesterday } } })` | COUNT | `:59` |
| 17 | `prisma.lead.groupBy({ by: ["email"], having: { id: { _count: { gt: 1 } } } })` | GROUP BY | `:60` |
| 18 | `prisma.user.count({ where: { active: false } })` | COUNT | `:61` |
| 19 | `prisma.user.findMany({ where: { id: { in: salesUserIds } } })` | SELECT (sequential) | `:66` |
| 20 | `prisma.lead.count({ where: { createdAt: { gte: yesterday, lt: today } } })` | COUNT (sequential) | `:69` |

**Total: 20 queries** (18 parallel + 2 sequential)

**Note:** Query #8 (`reportService.leadSources`) itself executes 5 sub-queries (3 `groupBy` + 2 `findMany`), making the true total approximately **24 queries** for the admin dashboard.

#### Sales Dashboard (`dashboardService.sales()`)

14 parallel queries:

| # | Query | Type | Lines |
|---|-------|------|-------|
| 1 | `prisma.lead.groupBy({ by: ["status"], where: leadWhere })` | GROUP BY | `:159-163` |
| 2 | `prisma.followUp.findMany({ where: { status: "PENDING", dueDate: { gte: startOfToday }, OR: [...] }, take: 5, include: { lead } })` | SELECT | `:164-176` |
| 3 | `prisma.followUp.count({ where: { status: "PENDING", dueDate: { lt: now }, OR: [...] } })` | COUNT | `:177-183` |
| 4 | `prisma.followUp.count({ where: { status: "PENDING", dueDate: { gte: startOfToday, lte: endOfToday }, OR: [...] } })` | COUNT | `:184-190` |
| 5 | `prisma.lead.count({ where: { ...leadWhere, notes: { none: {} }, followUps: { none: {} } } })` | COUNT with NOT EXISTS | `:191-193` |
| 6 | `attentionService.getNeedsAttention(userId)` → raw SQL CTE | Raw SQL | `:194` |
| 7 | `prisma.activityEntry.findMany(...)` → `.then()` count distinct | **SELECT ALL + memory** | `:197-206` |
| 8 | `prisma.activityEntry.count({ where: { event: { occurredAt: { gte: startOfToday } }, type: { in: ["CALL", "WHATSAPP"] } } })` | COUNT | `:207-212` |
| 9 | `prisma.activityEntry.count({ where: { ... PICKED_UP/REPLIED ... } })` | COUNT | `:213-221` |
| 10 | `prisma.activityEntry.count({ where: { ... NO_RESPONSE ... } })` | COUNT | `:222-230` |
| 11 | `prisma.activityEntry.count({ where: { ... INVALID_NUMBER ... } })` | COUNT | `:231-239` |
| 12 | `prisma.activityEntry.count({ where: { interest: "INTERESTED" } })` | COUNT | `:240-245` |
| 13 | `prisma.activityEntry.count({ where: { interest: "NOT_INTERESTED" } })` | COUNT | `:246-251` |

**Total: 13 parallel queries**

**Critical issue with query #7:** Loads ALL matching `ActivityEntry` rows into memory, then counts distinct `leadId` via `Set`. This should be `SELECT COUNT(DISTINCT "leadId")` or `GROUP BY`.

#### Attention Center CTE (`attention.service.ts:182-239`)

```sql
WITH assigned_leads AS MATERIALIZED (
  SELECT l."id", l."name", l."company", l."phone", l."category", l."priority", l."updatedAt", l."sourceId"
  FROM "Lead" l
  WHERE l."assignedUserId" = $1 AND l."isDeleted" = false
),
note_dates AS (
  SELECT n."leadId", MAX(n."createdAt") AS "lastNoteDate"
  FROM "Note" n INNER JOIN assigned_leads al ON al."id" = n."leadId"
  GROUP BY n."leadId"
),
follow_up_dates AS (
  SELECT f."leadId", MAX(f."completedAt") AS "lastFollowUpDate"
  FROM "FollowUp" f INNER JOIN assigned_leads al ON al."id" = f."leadId"
  WHERE f."status" = 'COMPLETED'
  GROUP BY f."leadId"
),
activity_dates AS (
  SELECT ae."leadId", MAX(ae."occurredAt") AS "lastActivityRecordDate"
  FROM "ActivityEvent" ae INNER JOIN assigned_leads al ON al."id" = ae."leadId"
  WHERE ae."type" IN ('INTERACTION', 'NOTE')
  GROUP BY ae."leadId"
)
SELECT al."id", al."name", ...,
  GREATEST(al."updatedAt", COALESCE(nd."lastNoteDate", '1970-01-01'),
    COALESCE(fd."lastFollowUpDate", '1970-01-01'),
    COALESCE(ad."lastActivityRecordDate", '1970-01-01')) as "lastActivityDate",
  s."name" as "sourceName"
FROM assigned_leads al
LEFT JOIN note_dates nd ON nd."leadId" = al."id"
LEFT JOIN follow_up_dates fd ON fd."leadId" = al."id"
LEFT JOIN activity_dates ad ON ad."leadId" = al."id"
LEFT JOIN "LeadSource" s ON s."id" = al."sourceId"
ORDER BY "lastActivityDate" ASC LIMIT 20
```

**Total: 1 query** — complex but well-structured. Uses `MATERIALIZED` CTE for the lead set, then LEFT JOINs for date aggregation.

**Potential concern:** The `MATERIALIZED` CTE forces a temp table. For a user with many leads, this could be expensive. The `GREATEST` with `COALESCE` to `'1970-01-01'` is correct for handling NULL dates.

### Report Queries

#### `reportService.leadSummary()` (`report.service.ts:16-26`)

| Step | Query | Type |
|------|-------|------|
| 1-5 | 5x `prisma.lead.count(...)` in `Promise.all` | COUNT x5 |

**Total: 5 parallel queries**

#### `reportService.leadSources()` (`report.service.ts:41-60`)

| Step | Query | Type |
|------|-------|------|
| 1-3 | 3x `prisma.lead.groupBy(...)` in `Promise.all` | GROUP BY x3 |
| 4-5 | `prisma.leadSource.findMany(...)` + `prisma.connector.findMany(...)` in `Promise.all` | SELECT x2 |

**Total: 5 queries** (3 parallel + 2 parallel)

#### `reportService.monthlyTrends()` (`report.service.ts:156-170`)

Raw SQL:
```sql
SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (WHERE "status" = 'CONVERTED')::bigint AS won,
  COUNT(*) FILTER (WHERE "status" = 'LOST')::bigint AS lost
FROM "Lead"
WHERE "createdAt" >= $1 AND "isDeleted" = false
GROUP BY 1 ORDER BY 1 ASC
```

**Total: 1 query** — efficient use of PostgreSQL FILTER clause.

### Export Queries

#### `exportService.exportLeads()` (`export.service.ts:44-97`)

Uses `exportInChunks` with batch size 1000:
```typescript
while (true) {
  const rows = await fetchChunk(skip, batchSize);  // prisma.lead.findMany with skip/take
  if (rows.length === 0) break;
  skip += rows.length;
  if (rows.length < batchSize) break;
}
```

**Total: ceil(total_leads / 1000) queries** — OFFSET-based chunked pagination.

### Connector/Sync Pipeline

#### Per-Payload Database Queries

For each imported payload, the connector runtime executes:

| Step | Query | Service | Lines |
|------|-------|---------|-------|
| 1 | `prisma.routingRule.findMany({ where: { active: true } })` | `routing-engine.ts:29-32` | **EVERY PAYLOAD** |
| 2 | `prisma.parser.findUnique({ where: { id } })` | `connector-runtime.ts:295-298` | Per payload |
| 3 | `prisma.lead.findFirst({ where: { connectorId, sourceReferenceId } })` | `lead.service.ts:289-296` | Per payload (dedup) |
| 4 | `prisma.lead.findMany({ where: { OR: [email, phone] } })` | `duplicate.service.ts:10-25` | Per payload (potential dupes) |
| 5 | `tx.lead.create(...)` | `lead.service.ts:306` | Per new lead |
| 6 | `activityEventService.createEvent(...)` → 2x `create` | `lead.service.ts:320-331` | Per new lead (inside tx) |
| 7 | `activityEventService.createEvent(...)` → 2x `create` | `connector-runtime.ts:241-255` | Per new lead (outside tx) |

**Total per imported record: 7-9 queries** (routing + parser + 2 dedup + lead create + 2 activity creates + activity event create)

**Critical N+1:** Step 1 (`routingRule.findMany`) is called **once per payload** inside the `for...of` loop in `processPayloads()`. The routing rules should be loaded once before the loop.

**Critical N+1:** Step 2 (`parser.findUnique`) is called **once per payload**. The parser could be cached for the duration of the sync.

**Critical N+1:** Step 7 creates a **second** activity event outside the transaction from step 6. This is redundant — the `leadService.create()` already creates a CREATED activity event (step 6). The connector runtime then creates another CREATED event (step 7).

---

## 7. EXPLAIN ANALYZE Results

**Not available.** No live database was accessible during this audit. All query patterns were derived from code analysis.

To obtain these measurements, the following queries should be run against a representative database:

```sql
-- 1. Admin Leads list (with search)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ... FROM "Lead" l
WHERE l."isDeleted" = false AND l."isArchived" = false
  AND (l."name" ILIKE '%test%' OR l."company" ILIKE '%test%' OR ...)
ORDER BY l."updatedAt" DESC
LIMIT 25 OFFSET 0;

-- 2. Admin Leads count
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*) FROM "Lead" l
WHERE l."isDeleted" = false AND l."isArchived" = false
  AND (l."name" ILIKE '%test%' OR ...);

-- 3. Activity enrichment (latest event per lead)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT DISTINCT ON (e."leadId") e."leadId", e."id", e."occurredAt"
FROM "ActivityEvent" e
INNER JOIN "ActivityEntry" en ON en."eventId" = e."id"
WHERE e."leadId" IN (...)
  AND en."type" IN ('CALL', 'WHATSAPP', ...)
ORDER BY e."leadId", e."occurredAt" DESC;

-- 4. Attention Center CTE
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
WITH assigned_leads AS MATERIALIZED (...)
SELECT ... FROM assigned_leads al
LEFT JOIN note_dates nd ... LEFT JOIN follow_up_dates fd ...
LEFT JOIN activity_dates ad ... LEFT JOIN "LeadSource" s ...
ORDER BY "lastActivityDate" ASC LIMIT 20;

-- 5. Dashboard duplicate emails
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT "email", COUNT(*) as cnt FROM "Lead"
WHERE "email" IS NOT NULL AND "isDeleted" = false
GROUP BY "email" HAVING COUNT(*) > 1;

-- 6. Sales dashboard: leads with no notes or follow-ups
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*) FROM "Lead" l
WHERE l."assignedUserId" = $1 AND l."isDeleted" = false
  AND NOT EXISTS (SELECT 1 FROM "Note" n WHERE n."leadId" = l."id")
  AND NOT EXISTS (SELECT 1 FROM "FollowUp" f WHERE f."leadId" = l."id");

-- 7. Connector routing rules
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ... FROM "RoutingRule" WHERE "active" = true
ORDER BY "fallback" ASC, "priority" ASC;
```

---

## 8. Search Performance

### Implementation

From `query-builder.ts:63-66`:
```typescript
export function containsSearch(fields: string[], search?: string) {
  if (!search) return undefined;
  return { OR: fields.map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) };
}
```

This generates:
```sql
WHERE (displayName ILIKE '%term%' OR company ILIKE '%term%' OR email ILIKE '%term%' OR phone ILIKE '%term%' OR leadNumber ILIKE '%term%')
```

### Analysis

| Property | Value | Impact |
|----------|-------|--------|
| Scan type | Sequential scan (leading wildcard prevents index usage) | O(n) per search |
| Fields searched | 5 (displayName, company, email, phone, leadNumber) | 5 sequential scans combined with OR |
| Case sensitivity | Case-insensitive (`mode: "insensitive"`) | PostgreSQL lowercases for comparison |
| Index support | None for leading-wildcard ILIKE | Standalone `email` and `phone` indexes only help exact match |
| Acceptable scale | <15k leads (per AGENTS.md) | Degrades beyond this |

### Estimated Performance

| Dataset Size | Estimated Execution Time | Evidence |
|-------------|------------------------|----------|
| 1k leads | <50ms | Theoretical (small table scan) |
| 5k leads | 50-100ms | Theoretical |
| 15k leads | 100-300ms | Theoretical |
| 25k leads | 300-800ms | Theoretical |
| 100k leads | 1-3s | Theoretical |
| 250k leads | 2-8s | Theoretical |

**All estimates are theoretical — no measurements taken.**

---

## 9. Pagination Performance

### Implementation

From `query-builder.ts:59-61`:
```typescript
export function pagination(query: Pick<ListQuery, "page" | "pageSize">) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}
```

This is standard OFFSET-based pagination.

### Analysis

| Property | Value | Impact |
|----------|-------|--------|
| Strategy | OFFSET/SKIP | PostgreSQL must scan and discard `skip` rows |
| Default page size | 25 | Configurable per request |
| Max page size | 100 | `maxPageSize` option |
| Deep page cost | Linear increase with page number | Page 1000 = skip 25,000 rows |

### Estimated Performance

| Page | Page Size | Rows Skipped | Estimated Execution Time | Evidence |
|------|----------|-------------|------------------------|----------|
| 1 | 25 | 0 | <20ms | Theoretical |
| 10 | 25 | 225 | <30ms | Theoretical |
| 100 | 25 | 2,475 | <50ms | Theoretical |
| 1,000 | 25 | 24,975 | 100-500ms | Theoretical |
| 10,000 | 25 | 249,975 | 1-5s | Theoretical |

**Note:** Activity events use cursor-based pagination (`cursor: { id }, skip: 1`) — this is correct for deep pagination of timeline data.

---

## 10. COUNT(*) Performance

### Where COUNT(*) Occurs

| Location | Frequency | Filters | Evidence |
|----------|----------|---------|----------|
| `GET /api/leads` (listPage) | Every page load | Same as list query WHERE | `lead.service.ts:205` |
| `GET /api/users` (listPage) | Every page load | `isDeleted: false` | `user.service.ts:90` |
| Admin dashboard | Every 60s (cached) | 6 different count queries | `dashboard.service.ts:36-41,55-61` |
| Sales dashboard | Every cache invalidation | ~8 count queries | `dashboard.service.ts:177-251` |
| Reports (leadSummary) | On demand | Date range + status | `report.service.ts:20-26` |
| Reports (activity) | On demand | Date range + type | `report.service.ts:127-137` |
| Export leads | Per chunk (1000 rows) | Same as list WHERE | `export.service.ts:30-38` |

### Analysis

- Lead list COUNT uses the same WHERE clause as the list query — PostgreSQL can potentially reuse index scans
- Dashboard counts are cached for 60s (admin) or until invalidation (sales) — amortized cost
- Export COUNT is not separate — the chunked loop just checks `rows.length < batchSize`
- **No approximate count mechanism** exists — all counts are exact

---

## 11. N+1 Findings

### Critical N+1 Patterns

| Location | Pattern | Queries Per N Records | Severity | Evidence |
|----------|---------|----------------------|----------|----------|
| `dashboard.service.ts:197-206` | Loads ALL ActivityEntry rows into memory to count distinct leadId | N (all matching rows) | **High** | Code loads entire result set, then uses `Set` to count unique |
| `routing-engine.ts:29-32` | `routingRule.findMany` called once per payload in connector sync loop | N (one query per payload) | **High** | `connector-runtime.ts:157-159` calls `resolveRouting` per payload |
| `connector-runtime.ts:295-298` | `parser.findUnique` called once per payload | N (one query per payload) | **High** | `resolveParser` called per payload |
| `connector-runtime.ts:219` + `:241` | `leadService.create` + separate `activityEventService.createEvent` per payload | N×2 activity event creates per lead | **Medium** | Redundant — `leadService.create` already creates activity event |
| `parser.service.ts:23-41` | `prisma.parser.upsert` in loop | N (one upsert per parser) | **Low** | Only during parser management, not hot path |

### Connector Sync Query Amplification

For a sync importing **100 payloads** (all new, no duplicates):

| Step | Queries | Per Payload | Total for 100 |
|------|---------|-------------|---------------|
| Routing rules | 1 | 1 | **100** (should be 1) |
| Parser lookup | 1 | 1 | **100** (should be 0-1) |
| Duplicate check (sourceReferenceId) | 1 | 1 | 100 |
| Duplicate check (email/phone) | 1 | 1 | 100 |
| Lead create | 1 | 1 | 100 |
| Activity event (inside tx) | 2 | 2 | 200 |
| Activity event (outside tx) | 2 | 2 | **200** (redundant) |
| **Total** | **9** | **9** | **900** |

**Optimal (with caching):** ~101 queries (1 routing + 100×(2 dedup + 1 create + 2 activity))

---

## 12. Dashboard Query Analysis

### Admin Dashboard

- **Query count:** 20 (18 parallel + 2 sequential), with sub-queries in `reportService.leadSources` bringing true total to ~24
- **All reads, no writes** — no transaction overhead
- **Cached:** `unstable_cache` with 60s TTL and `TAG.ADMIN_DASHBOARD` tag
- **Invalidated by:** `invalidateAfterMutation()`, `invalidateAdminDashboard()`
- **Connection pool pressure:** 18+ simultaneous queries on each cache miss

### Sales Dashboard

- **Query count:** 13 parallel queries
- **Critical issue:** Query #7 loads ALL matching ActivityEntry rows into memory
- **Cached:** `unstable_cache` + React `cache()` for dedup, tag-based invalidation
- **Unique feature:** Uses `React.cache()` for per-request deduplication within the same Server Component tree

### Attention Center (Sales Tasks Page)

- **Query count:** 4 queries (3 Prisma + 1 raw SQL CTE)
- **The CTE is the most complex query in the codebase** — 4 CTEs with MATERIALIZED, 4 LEFT JOINs, GREATEST aggregation
- **Cached:** `unstable_cache` with tag `TAG.ATTENTION(userId)`

---

## 13. Connector/Sync Query Analysis

### Complete Sync Execution Path

```
POST /api/connectors/[id]/sync
  → executionLock.acquire()          [1 query: UPDATE connector SET isRunning=true]
  → connectorRuntime.execute()
    → syncHistory.recordStart()      [1 query: INSERT connectorSyncRun]
    → for each payload:
      → resolveRouting()
        → routingRule.findMany()      [1 query: SELECT all active rules]  ← N+1
      → resolveParser()
        → parser.findUnique()         [1 query: SELECT parser]           ← N+1
      → parserRuntime.parse()         [0 queries: in-memory]
      → normalizer.validate()         [0 queries: in-memory]
      → normalizer.enrich()           [0 queries: in-memory]
      → leadService.create()
        → findFirst(sourceReferenceId) [1 query: dedup check]
        → findMany(email/phone)        [1 query: potential dupes]
        → $transaction:
          → lead.create()              [1 query]
          → activityEvent.create()     [2 queries: event + entries]
        → recalculateFollowUpFields()  [NOT called — lead has no follow-ups yet]
      → activityEventService.createEvent() [2 queries: event + entries]  ← REDUNDANT
    → syncHistory.recordCompletion()
      → connectorSyncRun.update()     [1 query]
      → connector.update()            [1 query]
  → executionLock.release()          [1 query: UPDATE connector SET isRunning=false]
```

**Overhead queries (outside per-payload):** 5
**Per-payload queries:** 7-9 (routing + parser + 2 dedup + lead create + 2 activity + 2 redundant activity)
**Total for N payloads:** 5 + N×(7-9)

### Scheduler Execution

`scheduler.service.ts:109-112`:
```typescript
for (const connector of due) {
  await this.runConnector(connector);
}
```

Connectors are executed **sequentially** — intentional for resource safety but means total scheduler time = sum of all connector times.

---

## 14. API Performance Findings

### High-Query-Count Endpoints

| Endpoint | Method | DB Queries | Notes |
|----------|--------|-----------|-------|
| `GET /api/dashboard` | GET | 20-24 (admin) / 13 (sales) | Cached — amortized |
| `GET /api/leads` | GET | 4 | Every page load |
| `POST /api/connectors/[id]/sync` | POST | 5 + N×(7-9) | Per sync run |
| `POST /api/follow-ups/[id]/complete` | POST | 4-6 | Transaction |
| `GET /api/leads/[id]/details` | GET | 4 parallel | Every detail open |
| `POST /api/scheduler/trigger` | POST | 5 + Σ(connectors) | Sequential |

### Authentication Overhead

- `withApiAuthorization()` calls `getSession()` which queries the session table on every request
- Session lookup is by token (indexed via `@unique`) — single index seek, negligible cost
- Middleware only checks cookie existence — no DB query

### Serialization Overhead

- `leadListSelect` returns ~25 scalar fields + 3 relations per lead
- `leadDetailSelect` returns ~50 scalar fields + 7 relations per lead
- `activityEvent.findMany` with `include: { actor, lead, entries }` returns nested objects
- No evidence of excessive over-fetching — selects are reasonably scoped

---

## 15. Application Performance Findings

### Sequential Waterfalls

| Location | Pattern | Impact | Evidence |
|----------|---------|--------|----------|
| `lead.service.ts:203-248` | `findMany + count` → `raw SQL events` → `raw SQL entries` | 3 sequential steps | Lines 203-248 |
| `dashboard.service.ts:64-69` | 18 parallel queries → `user.findMany` → `lead.count` | 3 sequential steps | Lines 35-69 |
| `connector-runtime.ts:157-265` | Sequential `for...of` loop with DB queries per iteration | N sequential steps | Lines 157-265 |

### Unnecessary Work

| Location | Issue | Impact | Evidence |
|----------|-------|--------|----------|
| `connector-runtime.ts:241-255` | Creates redundant activity event (already created by `leadService.create`) | 2 extra queries per import | Lines 219 + 241 |
| `dashboard.service.ts:197-206` | Loads all ActivityEntry rows into memory to count distinct leadId | Memory + query waste | Lines 197-206 |

### Transaction Usage

| Service | Methods Using Transactions | Purpose |
|---------|---------------------------|---------|
| `lead.service.ts` | create, update, assign, remove | Lead mutation + activity recording |
| `follow-up.service.ts` | createScheduled, update (when dueDate changes), reschedule, complete, remove | Follow-up mutation + lead field recalculation |
| `note.service.ts` | create, update, remove | Note mutation + optional follow-up + activity |
| `connector.service.ts` | recordSyncRun | Sync run + connector status |
| `settings.service.ts` | updateMany | Batch setting updates |

**Good:** All mutations are transactional. Denormalized field maintenance happens inside transactions.

---

## 16. Frontend/Bundling Findings

### Client Components

| Count | Type | Evidence |
|-------|------|----------|
| 58 | `"use client"` files | Codebase search |
| 3 | GSAP imports | `BottomNavigationMenu.tsx`, `BottomNavigation.tsx`, `animated-reveal.tsx` |

### Bundle-Affecting Dependencies

| Package | Size (estimated) | Client? | Usage | Evidence |
|---------|------------------|---------|-------|----------|
| `gsap` | ~315KB minified (~100KB gzipped) | Yes | Menu animations in 3 components | `package.json`, 3 import files |
| `googleapis` | Very large | **No (server only)** | Gmail connector | `package.json` |
| `lucide-react` | ~50KB per icon tree | Yes | Icons throughout | `package.json` |
| `better-auth` | Medium | No (server only) | Auth | `package.json` |
| `sonner` | Small | Yes | Toast notifications | `package.json` |

### Configuration Gaps

| Gap | Impact | Evidence |
|-----|--------|----------|
| `next.config.ts` is empty | Missing `optimizePackageImports` for lucide-react, missing `serverExternalPackages` for googleapis/pg | `next.config.ts` |
| No dynamic imports for GSAP | GSAP bundled even if animations not used on page | 3 files import gsap directly |
| No bundle analyzer | Cannot identify actual bundle sizes | No `@next/bundle-analyzer` |

### Server Components

**Good:** All page components are Server Components. Data is fetched server-side and passed as props to client components. No client-side data fetching for initial page loads.

---

## 17. Cache Analysis

### Cached Data

| Data | Cache Mechanism | TTL | Tags | Invalidation |
|------|----------------|-----|------|-------------|
| Admin dashboard | `unstable_cache` | 60s | `TAG.ADMIN_DASHBOARD` | `invalidateAfterMutation()`, `invalidateAdminDashboard()` |
| Sales dashboard | `unstable_cache` + `React.cache()` | None (tag-only) | `TAG.DASHBOARD(userId)`, `TAG.ATTENTION(userId)` | `invalidateAfterMutation()`, `invalidateDashboard()` |
| Attention center | `unstable_cache` + `React.cache()` | None (tag-only) | `TAG.ATTENTION(userId)` | `invalidateAfterMutation()`, `invalidateAttention()` |
| Settings | `unstable_cache` | 300s | `TAG.SETTINGS` | `invalidateSettings()` |

### Fresh Data (Not Cached)

| Data | Reason | Evidence |
|------|--------|----------|
| Lead list | Frequently changing, user-specific | `lead.service.ts:listPage` — no cache |
| Lead details | Frequently changing | `lead.service.ts:getById` — no cache |
| Notes | Frequently changing | `note.service.ts:list` — no cache |
| Follow-ups | Frequently changing | `follow-up.service.ts:list` — no cache |
| Activity events | Frequently changing | `activity-event.service.ts:listByLead` — no cache |

### Cache Invalidation

`invalidateAfterMutation()` (from `cache-tags.ts`) revalidates:
1. `TAG.DASHBOARD(userId)` — sales dashboard
2. `TAG.ATTENTION(userId)` — attention center
3. `TAG.ADMIN_DASHBOARD` — admin dashboard

**Good:** Tag-based invalidation ensures that only affected caches are cleared.

**Potential issue:** Every lead mutation (even a minor field update) invalidates the entire dashboard and attention center caches for the user. This could cause frequent cache misses if a user is actively working leads.

---

## 18. Primary Performance Table

| QUERY / ROUTE | CURRENT SQL / OPERATION | EXECUTION TIME | ROWS | INDEX USED | N+1? | FREQUENCY | EVIDENCE | RECOMMENDED ACTION | PRIORITY |
|---|---|---|---|---|---|---|---|---|---|
| `GET /api/leads` (list) | `findMany` + `COUNT(*)` + 2 raw SQL | Unknown | 25/page + total | Partial (ILIKE prevents) | No | Every page load | Code | Measure with EXPLAIN | P1 |
| `GET /api/leads` (search) | 5x `ILIKE '%term%'` OR | Unknown | Varies | None (leading wildcard) | No | On search | Code | Measure selectivity | P1 |
| `GET /api/dashboard` (admin) | 20+ parallel queries | Unknown (cached 60s) | Various | Yes (counts use indexes) | No | Every 60s | Code | Already cached | P2 |
| `GET /api/dashboard` (sales) | 13 parallel queries | Unknown (cached) | Various | Yes | **YES (#7)** | Per cache invalidation | Code | Fix fetch-all-to-count | **P0** |
| `POST /api/connectors/[id]/sync` | 5 + N×(7-9) queries | Unknown | 0-100+ | Yes | **YES (routing, parser)** | Per sync | Code | Batch routing + cache parser | **P0** |
| `GET /api/leads/[id]/details` | 4 parallel queries | Unknown | 1 + N | Yes | No | Per detail open | Code | Acceptable | P2 |
| Attention Center CTE | 1 complex CTE query | Unknown | ≤20 | Partial (MATERIALIZED) | No | Per cache invalidation | Code | Measure CTE cost | P1 |
| `GET /api/follow-ups/[id]/complete` | 4-6 queries in transaction | Unknown | Various | Yes | No | Per completion | Code | Acceptable | P2 |
| Export leads | OFFSET chunks of 1000 | Unknown | 1000/chunk | Yes | No | Per export | Code | Measure chunk cost | P2 |
| `recalculateLeadFollowUpFields` | 2 findFirst + 1 update | Unknown | 1 each | Yes (leadId, status, dueDate) | No | Per follow-up mutation | Code | Acceptable | P2 |
| `duplicateService.findPotentialDuplicates` | 1 findMany (OR email/phone) | Unknown | ≤5 | Partial (email/phone exact) | No | Per lead creation | Code | Acceptable | P2 |
| Routing rules (in sync) | `findMany` per payload | Unknown | All active | Yes (active, priority) | **YES** | Per payload in sync | Code | Load once before loop | **P0** |
| Parser lookup (in sync) | `findUnique` per payload | Unknown | 1 | Yes (id PK) | **YES** | Per payload in sync | Code | Cache for sync duration | **P0** |

---

## 19. Capacity Snapshot

**Measurement method:** Schema analysis only — no live database queries available.

| Metric | Current Value | Measurement Method |
|--------|-------------|-------------------|
| Leads | Unknown | Unavailable (no DB access) |
| ActivityEvents | Unknown | Unavailable |
| ActivityEntries | Unknown | Unavailable |
| FollowUps | Unknown | Unavailable |
| Notes | Unknown | Unavailable |
| Users | Unknown | Unavailable |
| Connectors | Unknown | Unavailable |
| Database size | Unknown | Unavailable |
| Largest table | Estimated: `Lead` | Schema analysis (most fields, JSON columns, most indexes) |
| Largest index | Estimated: `Lead` composite indexes | Schema analysis |
| Total index size | Unknown | Unavailable |

### Schema-Size Estimates (per row)

| Table | Estimated Row Size | Reasoning |
|-------|-------------------|-----------|
| `Lead` | 500B-5KB+ | 19 scalar fields (strings, decimals, dates) + 2 JSON columns (unbounded) + 4 FK relations |
| `ActivityEvent` | 100-300B | 7 fields + 1 FK + Json metadata |
| `ActivityEntry` | 100-500B | 9 fields + 2 FKs + Json metadata + optional message text |
| `FollowUp` | 100-300B | 13 fields + 4 FKs |
| `Note` | 100B-2KB+ | 8 fields + 2 FKs + unbounded content text |
| `ConnectorSyncRun` | 100-500B | 12 fields + 1 FK + Json metadata |
| `Session` | 100-200B | 10 fields + 1 FK |

**Key risk:** `Lead.rawPayload` and `Lead.customFields` are `Json?` columns with no size limits. A single lead with a large raw payload could bloat significantly.

---

## 20. Prioritized Optimization Candidates

### P0 — Investigate Immediately (Evidence-Supported)

| # | Finding | Classification | Evidence | Estimated Impact |
|---|---------|---------------|----------|-----------------|
| 1 | **ActivityEntry fetch-all-to-count** in `dashboard.sales()` | N+1 | `dashboard.service.ts:197-206` — loads ALL matching rows into memory | High — memory waste, query time proportional to dataset |
| 2 | **Routing rules N+1** in connector sync | N+1 | `routing-engine.ts:29-32` called per payload | High — N queries instead of 1 |
| 3 | **Parser lookup N+1** in connector sync | N+1 | `connector-runtime.ts:295-298` called per payload | Medium — N queries instead of 0-1 |
| 4 | **Redundant activity event** in connector sync | QUERY | `connector-runtime.ts:241-255` creates duplicate of `leadService.create` activity | Medium — 2 extra queries per import |
| 5 | **Redundant Lead index** | INDEX | `@@index([connectorId, sourceReferenceId])` redundant with `@@unique` | Low — write overhead |

### P1 — Likely Optimization Opportunities (Strong Code Evidence)

| # | Finding | Classification | Evidence | Notes |
|---|---------|---------------|----------|-------|
| 6 | **ILIKE search** across 5 fields | QUERY | `query-builder.ts:63-66` | Acceptable at <15k; measure at current scale |
| 7 | **OFFSET pagination** | QUERY | `query-builder.ts:59-61` | Acceptable for pages <1000; measure deep pages |
| 8 | **COUNT(*) on every page load** | QUERY | `lead.service.ts:205` | Full table scan; measure at current scale |
| 9 | **18+ parallel dashboard queries** | QUERY | `dashboard.service.ts:35-62` | Connection pool pressure; cached 60s |
| 10 | **GSAP bundle** (~315KB) | BUNDLE | 3 client components | Dynamic import could reduce initial bundle |
| 11 | **Empty next.config.ts** | BUNDLE | `next.config.ts` | Missing optimizePackageImports, serverExternalPackages |

### P2 — Scale-Triggered Optimizations

| # | Finding | Trigger | Notes |
|---|---------|---------|-------|
| 12 | GIN trigram index for search | >15k leads | Replaces ILIKE sequential scans |
| 13 | Cursor pagination for deep pages | Users navigate past page 100 | OFFSET cost grows linearly |
| 14 | Approximate counts | COUNT(*) becomes slow | PostgreSQL `pg_stat_user_tables` or materialized count |
| 15 | Dashboard query consolidation | >100k leads | Combine related counts into single query |
| 16 | Materialized view for dashboard | >250k leads | Pre-compute expensive aggregations |
| 17 | Read replica for reports | Reports impact main DB | Separate read traffic |

### Not Currently Justified

| Optimization | Why Not Justified |
|-------------|-------------------|
| Redis caching | `unstable_cache` with tag invalidation is sufficient for current scale |
| Elasticsearch | ILIKE is acceptable at <15k leads |
| Background job queue | Connectors run synchronously with DB locks — works at current scale |
| Connection pooling tuning | Neon serverless driver handles pooling |
| Cursor pagination for all lists | OFFSET is acceptable for pages <1000 |
| Dashboard query consolidation | Cached for 60s — amortized cost is low |

---

## 21. Optimizations Not Yet Justified

The following optimizations appear in `docs/performance.md` but are **not supported by current evidence**:

| Optimization | docs/performance.md Claim | Actual Evidence |
|-------------|--------------------------|-----------------|
| GIN/trigram search | "At 250k leads: 500ms-2s" | No measurement — theoretical only |
| Cursor pagination | "Page 10,000: ~5s" | No measurement — theoretical only |
| Approximate counts | "At 25k/person: ~50-100ms" | No measurement — theoretical only |
| Materialized view | "Dashboard at 250k: ~500ms-1s" | No measurement — theoretical only |
| Read replica | "When reports impact main DB" | No evidence reports are slow |

**These are reasonable scale-triggered optimizations, but they should not be implemented until measurements justify them.**

---

## 22. Recommended Phase 2 Plan

Based on code-level findings (not measurements), the recommended Phase 2 sequence is:

### Step 1: Obtain Measurements (Prerequisite)

Before any optimization, obtain `EXPLAIN ANALYZE` data for the queries listed in Section 7. This requires:
- A representative database (ideally with production-like data volume)
- `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` for each query pattern
- Comparison of estimated vs actual row counts

### Step 2: Fix High-Confidence N+1 Issues (P0)

These are code-level issues that are clearly suboptimal regardless of dataset size:

1. **Load routing rules once per sync** — move `routingRule.findMany` outside the payload loop in `connector-runtime.ts`
2. **Cache parser lookup per sync** — store parser record after first lookup, reuse for subsequent payloads
3. **Remove redundant activity event** in `connector-runtime.ts:241-255` — `leadService.create` already creates one
4. **Fix ActivityEntry fetch-all-to-count** — replace with `SELECT COUNT(DISTINCT "leadId")` or `GROUP BY`
5. **Remove redundant Lead index** — drop `@@index([connectorId, sourceReferenceId])`

### Step 3: Measure Search and Pagination (P1)

With measurements in hand:
- If ILIKE search is slow at current scale → consider pg_trgm GIN index
- If OFFSET pagination is slow for deep pages → consider cursor pagination
- If COUNT(*) is slow → consider approximate counts

### Step 4: Frontend Optimization (P1)

- Add `optimizePackageImports: ["lucide-react"]` to `next.config.ts`
- Dynamic-import GSAP in 3 components
- Add `serverExternalPackages: ["googleapis", "pg"]` to `next.config.ts`

### Step 5: Dashboard Optimization (P2)

Only if measurements show dashboard queries are slow:
- Consolidate related count queries
- Consider materialized views for expensive aggregations

---

## 23. Measurement Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| No live database | Cannot obtain actual execution times, row counts, or table sizes | Use code analysis; obtain measurements in Phase 2 |
| No `EXPLAIN ANALYZE` | Cannot verify index usage, scan types, or buffer behavior | Prioritize obtaining these in Phase 2 |
| No production data volume | Cannot assess actual ILIKE/OFFSET/COUNT performance | Use code analysis + theoretical estimates |
| No load testing | Cannot assess connection pool pressure or concurrent user behavior | Consider in Phase 3 if needed |
| No bundle analysis | Cannot measure actual JS bundle sizes | Use `@next/bundle-analyzer` in Phase 2 |
| No network latency data | Cannot assess API response times from browser perspective | Consider in Phase 3 if needed |

---

## Appendix A: Files Changed in This Audit

**No files were modified.** This was a read-only audit.

## Appendix B: Key Source Files Analyzed

| File | Lines | Purpose |
|------|------:|---------|
| `prisma/schema.prisma` | ~500 | Database schema, indexes, relations |
| `src/services/lead.service.ts` | 443 | Lead CRUD, list, search, activity enrichment |
| `src/services/dashboard.service.ts` | 301 | Admin + sales dashboard aggregation |
| `src/services/attention.service.ts` | 257 | Attention center queries + CTE |
| `src/services/follow-up.service.ts` | 453 | Follow-up CRUD + denormalized field maintenance |
| `src/services/report.service.ts` | 181 | Analytics aggregation queries |
| `src/services/export.service.ts` | 224 | CSV export with chunked pagination |
| `src/services/duplicate.service.ts` | 29 | Potential duplicate detection |
| `src/runtime/connector-runtime.ts` | 360 | Connector execution pipeline |
| `src/runtime/routing-engine.ts` | 105 | Routing rule matching |
| `src/runtime/sync-history.ts` | 115 | Sync run recording |
| `src/lib/query-builder.ts` | 88 | Search, pagination, filter utilities |
| `src/lib/cache-tags.ts` | 66 | Cache tag constants + invalidation |
| `src/lib/validation.ts` | 191 | Zod schemas for API validation |
| `src/app/api/leads/route.ts` | — | Lead list/create API |
| `src/app/api/dashboard/route.ts` | — | Dashboard API |
| `src/app/api/connectors/[id]/sync/route.ts` | — | Sync trigger API |
| `package.json` | — | Dependencies and scripts |
| `next.config.ts` | — | Next.js configuration (empty) |
