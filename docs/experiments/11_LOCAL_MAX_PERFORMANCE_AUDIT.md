# LeadBridge — Local Maximum-Performance Audit

> **Status:** Experimental (Local deployment performance audit)
> **Date:** 2026-09-19
> **Scope:** Complete code-level audit optimized for locally hosted deployment with PostgreSQL in Docker
> **Previous report:** `09_PERFORMANCE_BASELINE_AUDIT.md` (Phase 1 — cloud-focused baseline)
> **Limitation:** No live database available — all performance claims are derived from code analysis. Docker and PostgreSQL are not yet installed on the target machine.

---

## 1. Executive Summary

This audit re-evaluates LeadBridge's entire performance profile for a **locally hosted, maximum-performance deployment** where PostgreSQL runs in Docker on the same Windows machine as the Next.js application. This replaces the previous Neon serverless cloud-first optimization model.

### Architecture Shift

| Aspect | Old Model | New Model |
|--------|-----------|-----------|
| Database | Neon serverless (HTTP-based, remote) | PostgreSQL in Docker (TCP, localhost) |
| Network | Internet round-trip to AWS | Docker bridge / localhost |
| Driver | `@prisma/adapter-pg` (Neon HTTP) | Direct `pg` driver (TCP) |
| Connection pooling | Neon serverless pool | Local PgBouncer or built-in pool |
| Latency | 50-200ms per query | <1ms per query |
| Storage | 0.5 GB free tier | Unlimited local disk |
| Compute | CU-hours, scale-to-zero | Dedicated 8-core CPU |

### Top 10 Findings

| # | Finding | Category | Confidence | Impact |
|---|---------|----------|------------|--------|
| 1 | **App uses Neon HTTP driver — wrong driver for local PostgreSQL** | INFRA | High | Critical |
| 2 | **No Docker or PostgreSQL installed on target machine** | INFRA | High | Critical |
| 3 | **Routing rules N+1 in connector sync** — `routingRule.findMany()` per payload | N+1 | High | High |
| 4 | **Parser lookup N+1 in connector sync** — `parser.findUnique()` per payload | N+1 | High | High |
| 5 | **Redundant activity event in connector sync** — duplicate of `leadService.create` activity | WASTE | High | Medium |
| 6 | **ActivityEntry fetch-all-to-count** in `dashboard.sales()` | QUERY | High | High |
| 7 | **Redundant Lead index** — `@@index([connectorId, sourceReferenceId])` redundant with `@@unique` | INDEX | High | Low |
| 8 | **ILIKE '%term%' search** across 5 fields — no index support | QUERY | High | Medium (scales) |
| 9 | **COUNT(*) on every page load** — full table scan | QUERY | High | Medium (scales) |
| 10 | **GSAP unoptimized bundle** (~315KB) — not dynamically imported | BUNDLE | High | Medium |

### Biggest Surprise vs Phase 09

The Phase 09 audit assumed Neon serverless and evaluated optimizations around cloud constraints. The biggest surprise is that **the application is fundamentally misconfigured for local deployment** — it uses `@prisma/adapter-pg` (Neon HTTP driver) which adds HTTP overhead to every database query. Switching to a direct TCP connection to local PostgreSQL will be the single highest-impact change, reducing per-query latency from ~50-200ms to <1ms.

---

## 2. New Deployment Model

### Target Architecture

```text
Browser (local or LAN)
 ↓
LAN / localhost (TCP)
 ↓
Next.js (pnpm dev / pnpm start)
 ↓
Prisma → pg driver (TCP, localhost:5432)
 ↓
PostgreSQL Docker container
 ↓
Docker volume → local disk (NTFS)
```

### Network Boundaries

| Path | Latency | Notes |
|------|---------|-------|
| Browser → Next.js (localhost) | <1ms | Loopback |
| Browser → Next.js (LAN) | 1-5ms | Ethernet/WiFi |
| Next.js → PostgreSQL (Docker localhost) | <1ms | Docker bridge network |
| Next.js → PostgreSQL (Docker TCP) | <1ms | localhost:5432 mapped port |
| PostgreSQL → Docker volume | <1ms | NTFS passthrough |

**Key insight:** Every network boundary adds <5ms in local deployment vs 50-200ms in cloud. This means:

- Caching is less critical (queries are cheap)
- Connection pooling is less critical (no cold starts)
- Batch operations are less critical (round-trips are cheap)
- But N+1 patterns still waste CPU and memory

### Deployment Components

| Component | Where | Status |
|-----------|-------|--------|
| Next.js application | Windows host (native or WSL2) | Running via `pnpm dev` |
| PostgreSQL | Docker container on Windows | **Not installed** |
| Docker Desktop | Windows host | **Not installed** |
| Node.js | v24.18.0 (WSL2) | Available |
| pnpm | 12.4.2 (WSL2) | Available |

---

## 3. Performance Objectives

For a locally hosted, maximum-performance CRM:

1. **Minimum request latency** — every API response should feel instant
2. **Minimum database latency** — PostgreSQL queries should complete in <10ms for typical operations
3. **Maximum throughput** — connector sync should process records as fast as the external API allows
4. **Minimum CPU waste** — no redundant queries, no unnecessary computation
5. **Minimum memory waste** — no loading entire datasets into memory for counting
6. **Excellent perceived speed** — instant navigation, immediate feedback
7. **Good behavior at scale** — performance should degrade gracefully as data grows
8. **Efficient hardware use** — leverage 8 cores and 9.7 GiB RAM effectively
9. **Stable LAN performance** — multiple concurrent users should not degrade experience

---

## 4. Hardware/Runtime Baseline

### Measured Environment

| Component | Value | Source |
|-----------|-------|--------|
| OS | Ubuntu 24.04.4 LTS (WSL2 on Windows) | `/etc/os-release` |
| Kernel | 6.18.33.2-microsoft-standard-WSL2 | `uname -a` |
| CPU | Intel Core i5-13450HX (8 cores / 16 threads) | `lscpu` |
| RAM | 9.7 GiB total, 8.3 GiB available | `free -h` |
| Disk | 1 TB (`/dev/sdd`), 923 GiB free (4% used) | `df -h` |
| Node.js | v24.18.0 | `node --version` |
| pnpm | 12.4.2 | `pnpm --version` |
| Docker | **Not installed** | `docker --version` |
| PostgreSQL | **Not installed locally** | `pg_isready` |
| Docker Compose | **None in project** | File search |
| Dockerfile | **None in project** | File search |

### Hardware Assessment

| Resource | Rating | Notes |
|----------|--------|-------|
| CPU | Good | 8 cores / 16 threads, modern architecture |
| RAM | Adequate | 9.7 GiB total, 8.3 GiB available |
| Disk | Excellent | 923 GiB free, likely SSD |
| Network | N/A | LAN deployment, localhost primary |

**The hardware is more than sufficient for a local CRM deployment.** The bottleneck is software configuration, not hardware.

---

## 5. Architecture & Network Boundaries

### Current Architecture (Cloud-First)

```text
Browser → Next.js → Prisma → @prisma/adapter-pg (Neon HTTP) → Neon Serverless PostgreSQL (AWS)
```

**Problems for local deployment:**
- HTTP-based database driver adds overhead per query
- Connection pooling handled by remote Neon service
- Every query traverses the internet
- SSL/TLS overhead on every connection

### Required Architecture (Local-First)

```text
Browser → Next.js → Prisma → pg driver (TCP) → PostgreSQL Docker (localhost:5432)
```

**Key changes needed:**
1. Remove `@prisma/adapter-pg` driver adapter
2. Use direct `pg` driver with TCP connection
3. Configure `DATABASE_URL` for localhost PostgreSQL
4. Set up PostgreSQL Docker container with volume mount
5. Configure PostgreSQL for local performance (not cloud defaults)

### Network Latency Comparison

| Operation | Cloud (Neon) | Local (Docker) | Improvement |
|-----------|-------------|----------------|-------------|
| Connection | 50-150ms | <1ms | 50-150x |
| Simple query | 50-200ms | <5ms | 10-40x |
| Complex query | 200-500ms | 5-50ms | 4-10x |
| Transaction | 100-300ms | 1-10ms | 10-30x |
| Bulk insert | 500ms-2s | 10-100ms | 5-20x |

---

## 6. PostgreSQL Configuration

### Current State

PostgreSQL is **not installed**. The application connects to Neon serverless via:

```typescript
// src/lib/prisma.ts
const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
```

The `DATABASE_URL` in `.env` points to Neon:
```
postgresql://neondb_owner:npg_...@ep-young-feather-aorbyecb-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
```

### Required Changes

1. **Install Docker Desktop** on Windows
2. **Create `docker-compose.yml`** with PostgreSQL container
3. **Create `Dockerfile`** for the Next.js application (optional for dev)
4. **Update `src/lib/prisma.ts`** to remove PrismaPg adapter
5. **Update `DATABASE_URL`** to `postgresql://user:password@localhost:5432/leadbridge`
6. **Run `prisma migrate deploy`** against local PostgreSQL

### Recommended PostgreSQL Configuration for Local CRM

When PostgreSQL is installed, configure for local performance:

```ini
# postgresql.conf — optimized for local CRM on dedicated machine

# Memory (9.7 GiB total, leave 4 GiB for OS + Node.js)
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 64MB
maintenance_work_mem = 512MB

# Write-ahead log
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 2GB
min_wal_size = 1GB

# Query planner
random_page_cost = 1.1          # SSD (Docker volume on NTFS)
effective_io_concurrency = 200   # SSD
default_statistics_target = 200

# Connections
max_connections = 50            # Sufficient for CRM workload

# Parallel query
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# JIT
jit = on
jit_above_cost = 100000

# Autovacuum
autovacuum_max_workers = 3
autovacuum_naptime = 30s

# Logging (optional, for performance investigation)
log_min_duration_statement = 100  # Log queries >100ms
log_autovacuum_min_duration = 0
```

### Configuration Risk Classification

#### Safe Configuration Candidates

| Setting | Value | Risk | Reason |
|---------|-------|------|--------|
| `shared_buffers` | 2GB | Low | Standard for 8GB+ RAM |
| `effective_cache_size` | 6GB | Low | Reflects available OS cache |
| `random_page_cost` | 1.1 | Low | Correct for SSD |
| `effective_io_concurrency` | 200 | Low | Correct for SSD |
| `work_mem` | 64MB | Low | Per-operation, not per-connection |
| `maintenance_work_mem` | 512MB | Low | Only during maintenance |
| `default_statistics_target` | 200 | Low | Better query plans |

#### Workload-Dependent Candidates

| Setting | Value | Risk | Reason |
|---------|-------|------|--------|
| `max_connections` | 50 | Medium | Depends on concurrent users |
| `max_parallel_workers_per_gather` | 4 | Medium | Depends on query patterns |
| `jit` | on | Medium | Benefits complex queries |

#### Do-Not-Change-Without-Evidence

| Setting | Risk | Reason |
|---------|------|--------|
| `synchronous_commit` | High | Data loss risk |
| `fsync` | High | Data corruption risk |
| `full_page_writes` | High | Data corruption risk |

---

## 7. Database Size & Storage

### Current State

No local database exists. The Neon database contains the production data but cannot be measured directly.

### Schema Statistics

| Metric | Count | Source |
|--------|------:|--------|
| Models | 19 | `prisma/schema.prisma` |
| Enums | 17 | `prisma/schema.prisma` |
| `@@index` declarations | 43 | `prisma/schema.prisma` |
| `@@unique` declarations | 2 | `prisma/schema.prisma` |
| Field-level `@unique` | 10 | `prisma/schema.prisma` |
| Total indexes (all types) | 55 | Derived |
| Migrations | 16 | `prisma/migrations/` |

### Estimated Table Sizes (per row)

| Table | Estimated Row Size | Primary Size Driver |
|-------|-------------------|---------------------|
| `Lead` | 500B–5KB+ | 19 scalar fields + 2 unbounded JSON columns (`customFields`, `rawPayload`) |
| `ActivityEvent` | 100–300B | 7 fields + Json metadata |
| `ActivityEntry` | 100–500B | 9 fields + Json metadata + optional message text |
| `FollowUp` | 100–300B | 13 fields + 4 FKs |
| `Note` | 100B–2KB+ | Unbounded `content` text field |
| `ConnectorSyncRun` | 100–500B | 12 fields + Json metadata |
| `User` | 100–200B | Fixed set of users |
| `Session` | 100–200B | Transient |

### Storage Concerns

- **`Lead.rawPayload`** and **`Lead.customFields`** are `Json?` with no size limits — can grow unbounded
- **`Note.content`** is unbounded text — could store large notes
- **`ConnectorSyncRun.metadata`** stores JSON metadata per sync — grows with connector activity
- **Local deployment eliminates storage concerns** — 923 GiB free on the host disk

### vacuum/analyze Status

Cannot be measured until local PostgreSQL is installed. After installation, run:

```sql
SELECT schemaname, relname, n_live_tup, n_dead_tup,
       last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

---

## 8. Index Analysis

### Complete Index Inventory

#### Lead Table (11 indexes + 2 unique)

| # | Index | Columns | Purpose | Query Pattern |
|---|-------|---------|---------|---------------|
| 1 | `@@index` | `(assignedUserId, status, isDeleted)` | Sales user + status filter | `listPage` for SALES role |
| 2 | `@@index` | `(assignedUserId, isDeleted, updatedAt)` | Sales user + updatedAt sort | `listPage` sorted by updatedAt |
| 3 | `@@index` | `(isDeleted, createdAt)` | Global list + createdAt sort | Admin lead list |
| 4 | `@@index` | `(status, isArchived, isDeleted)` | Status filtering | Status filter queries |
| 5 | `@@index` | `(nextFollowUpAt, isDeleted)` | Follow-up queue | Attention center, tasks |
| 6 | `@@index` | `(connectorId, sourceId)` | Connector sync queries | Connector lead lookup |
| 7 | `@@index` | `(connectorId, sourceReferenceId)` | **REDUNDANT** — covered by `@@unique` | Dedup check |
| 8 | `@@index` | `(createdById, createdAt)` | Creator history | Rarely used |
| 9 | `@@index` | `email` | Email search | Exact email lookup |
| 10 | `@@index` | `phone` | Phone search | Exact phone lookup |
| UQ | `@@unique` | `leadNumber` | Unique lead number | Lead number lookup |
| UQ | `@@unique` | `(connectorId, sourceReferenceId)` | Import dedup | Connector sync dedup |

**Redundant index:** `@@index([connectorId, sourceReferenceId])` is fully covered by `@@unique([connectorId, sourceReferenceId])`. The unique constraint already creates a B-tree index. The separate `@@index` adds write overhead with no read benefit.

#### ActivityEvent (2 indexes)

| # | Index | Columns | Purpose |
|---|-------|---------|---------|
| 1 | `@@index` | `(leadId, occurredAt)` | Lead activity timeline |
| 2 | `@@index` | `(leadId, type, occurredAt)` | Filtered activity queries |

**Assessment:** Both are well-designed. Index #2 covers the common query pattern of filtering by event type within a lead's timeline.

#### ActivityEntry (3 indexes)

| # | Index | Columns | Purpose |
|---|-------|---------|---------|
| 1 | `@@index` | `eventId` | Entries by event |
| 2 | `@@index` | `followUpId` | Entries by follow-up |
| 3 | `@@index` | `(type, createdAt)` | Dashboard activity counts |

**Assessment:** Index #3 supports the dashboard count queries. However, `(type, createdAt)` is a low-selectivity leading column — `type` has only ~16 values.

#### FollowUp (3 indexes)

| # | Index | Columns | Purpose |
|---|-------|---------|---------|
| 1 | `@@index` | `(leadId, dueDate, status)` | Lead's follow-ups by date+status |
| 2 | `@@index` | `(assignedUserId, status, dueDate)` | My Tasks (per-user) |
| 3 | `@@index` | `(leadId, createdAt)` | Lead's follow-ups by creation |

**Assessment:** Indexes #1 and #2 are excellent for the primary query patterns. Index #3 overlaps significantly with #1 — both start with `leadId`.

#### Other Tables

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| `User` | `@@index` | `(role, active, isDeleted)` | User listing filters |
| `User` | `@@index` | `(isDeleted, deletedAt)` | Soft-delete queries |
| `Connector` | `@@index` | `(enabled, status)` | Scheduler discovery |
| `Connector` | `@@index` | `(sourceId, enabled)` | Provider connectors |
| `Connector` | `@@index` | `parserId` | Connectors by parser |
| `ConnectorSyncRun` | `@@index` | `(connectorId, startedAt)` | Sync history by connector |
| `RoutingRule` | `@@index` | `(active, priority)` | Routing engine lookup |
| `Note` | `@@index` | `(leadId, createdAt)` | Lead notes timeline |
| `Note` | `@@index` | `(leadId, isPinned)` | Pinned notes |

### Index Overlap Analysis

| Index A | Index B | Overlap | Recommendation |
|---------|---------|---------|----------------|
| `Lead.@@index([connectorId, sourceReferenceId])` | `Lead.@@unique([connectorId, sourceReferenceId])` | 100% | Drop `@@index` |
| `FollowUp.@@index([leadId, createdAt])` | `FollowUp.@@index([leadId, dueDate, status])` | Partial (both start with `leadId`) | Keep both — different sort/filter patterns |
| `ActivityEvent.@@index([leadId, occurredAt])` | `ActivityEvent.@@index([leadId, type, occurredAt])` | Partial (both start with `leadId`) | Keep both — filtered vs unfiltered |

### Missing Indexes (Potential)

| Index | Columns | Query Pattern | Impact |
|-------|---------|---------------|--------|
| `Lead` | `(isDeleted, updatedAt)` | Admin lead list sorted by updatedAt (most common) | Could help default sort |
| `FollowUp` | `(status, dueDate)` | Global overdue/upcoming follow-up queries | Dashboard tasks count |
| `ActivityEntry` | `(eventId, type)` | Filtered entries by event + type | Activity timeline display |

### Write Cost Analysis

| Table | Indexes per Insert | Notes |
|-------|-------------------|-------|
| `Lead` | 13 (11 + 2 unique) | **Highest write cost** — most indexed table |
| `ActivityEvent` | 2 | Low |
| `ActivityEntry` | 3 | Low |
| `FollowUp` | 3 | Low |
| `Note` | 2 | Low |

**The Lead table has the highest write amplification** due to 13 indexes. Each Lead insert or update must maintain all 13 B-tree structures. The redundant `@@index([connectorId, sourceReferenceId])` adds unnecessary write cost.

---

## 9. Query Analysis

### Lead List Query (`GET /api/leads`)

**Flow:**
```
1. prisma.lead.findMany({ where, select, orderBy, skip, take })  — SELECT with OFFSET
2. prisma.lead.count({ where })                                   — COUNT(*)
3. prisma.$queryRaw — latest activity event per lead              — DISTINCT ON
4. prisma.$queryRaw — entries for event IDs                       — SELECT with IN
```

**Total: 4 queries** (steps 1-2 parallel, steps 3-4 sequential after step 1)

**Where clause for SALES:**
```sql
WHERE "assignedUserId" = $1 AND "isDeleted" = false AND "isArchived" = false
  AND ("displayName" ILIKE '%term%' OR "company" ILIKE '%term%' OR ...)
ORDER BY "updatedAt" DESC
LIMIT 25 OFFSET 0
```

**Index used:** `(assignedUserId, isDeleted, updatedAt)` — but ILIKE prevents index usage for search.

### Admin Lead List Query

Same as above but without `assignedUserId` filter. Uses `(isDeleted, createdAt)` index for default sort.

### Lead Detail Query (`GET /api/leads/[id]`)

**Total: 1 query** — single lead with 7 nested relations via `select`.

### Lead Detail Modal (`GET /api/leads/[id]/details`)

**Total: 4 parallel queries:**
1. `leadService.getById()` — lead with relations
2. `prisma.note.findMany()` — notes with author
3. `prisma.followUp.findMany()` — follow-ups with users
4. `activityEventService.listByLead()` — activity timeline (cursor-based)

### Activity Timeline

**Total: 1 query** — cursor-based pagination with `include: { actor, entries.followUp }`.

### Follow-Up Queries

| Operation | Queries | Notes |
|-----------|---------|-------|
| `list(leadId)` | 2 | Access check + findMany |
| `listForTasks(actor)` | 1 | findMany with OR filter |
| `recalculateLeadFollowUpFields()` | 3 | 2 findFirst + 1 update (runs in every follow-up mutation) |
| `complete(id)` | 4-6 | Transaction: update + create + activity + recalculate |

### Duplicate Detection

| Operation | Queries | Notes |
|-----------|---------|-------|
| `findPotentialDuplicates()` | 1 | findMany with OR (email/phone) |
| `leadService.create()` sourceReferenceId check | 1 | findFirst with unique compound |

**Total: 2 queries** per lead creation for dedup.

### Dashboard Queries

#### Admin Dashboard (`dashboardService.admin()`)

**20 queries** (18 parallel + 2 sequential):

| # | Query | Type |
|---|-------|------|
| 1 | `lead.count({ isDeleted: false })` | COUNT |
| 2 | `lead.count({ status: ["NEW", "ON_HOLD"] })` | COUNT |
| 3 | `lead.count({ createdAt >= today })` | COUNT |
| 4 | `lead.count({ status: "CONVERTED" })` | COUNT |
| 5 | `lead.count({ status: "LOST" })` | COUNT |
| 6 | `lead.count({ assignedUserId: null })` | COUNT |
| 7 | `reportService.statusBreakdown()` | GROUP BY |
| 8 | `reportService.leadSources()` | 5 sub-queries |
| 9 | `connector.findMany()` | SELECT |
| 10 | `activityEvent.findMany(take: 10)` | SELECT with 3 includes |
| 11 | `connectorSyncRun.findMany(take: 5)` | SELECT |
| 12 | `parserRequest.count({ status: "OPEN" })` | COUNT |
| 13 | `unmatchedEmail.count({ status: "UNMATCHED" })` | COUNT |
| 14 | `lead.groupBy({ by: ["assignedUserId"] })` | GROUP BY |
| 15 | `connector.count({ enabled: false })` | COUNT |
| 16 | `connectorSyncRun.count({ status: "ERROR" })` | COUNT |
| 17 | `lead.groupBy({ by: ["email"], having: count > 1 })` | GROUP BY |
| 18 | `user.count({ active: false })` | COUNT |
| 19 | `user.findMany({ id: salesUserIds })` | SELECT (sequential) |
| 20 | `lead.count({ createdAt >= yesterday })` | COUNT (sequential) |

**True total: ~24 queries** (query #8 has 5 sub-queries).

**Note:** This is cached via `unstable_cache` with 60s TTL.

#### Sales Dashboard (`dashboardService.sales()`)

**13 parallel queries:**

| # | Query | Type | Issue |
|---|-------|------|-------|
| 1 | `lead.groupBy({ by: ["status"] })` | GROUP BY | |
| 2 | `followUp.findMany(take: 5)` | SELECT with lead include | |
| 3 | `followUp.count({ overdue })` | COUNT | |
| 4 | `followUp.count({ today })` | COUNT | |
| 5 | `lead.count({ notes: none, followUps: none })` | COUNT with NOT EXISTS | |
| 6 | `attentionService.getNeedsAttention()` | Raw SQL CTE | |
| 7 | `activityEntry.findMany()` → `.then()` Set count | **SELECT ALL + memory** | **CRITICAL** |
| 8-13 | `activityEntry.count()` × 6 | COUNT | |

**Critical issue with #7:** Loads ALL matching `ActivityEntry` rows into memory, then counts distinct `leadId` via `Set`. This should be `SELECT COUNT(DISTINCT "leadId")` or `GROUP BY`.

### Attention Center CTE

```sql
WITH assigned_leads AS MATERIALIZED (
  SELECT ... FROM "Lead" WHERE "assignedUserId" = $1 AND "isDeleted" = false
),
note_dates AS (...),
follow_up_dates AS (...),
activity_dates AS (...)
SELECT ... FROM assigned_leads al
LEFT JOIN note_dates nd ...
LEFT JOIN follow_up_dates fd ...
LEFT JOIN activity_dates ad ...
LEFT JOIN "LeadSource" s ...
ORDER BY "lastActivityDate" ASC LIMIT 20
```

**Total: 1 query** — complex but well-structured. Uses `MATERIALIZED` CTE for the lead set.

### Export Queries

```typescript
while (true) {
  const rows = await prisma.lead.findMany({ skip, take: 1000 });
  if (rows.length === 0) break;
  skip += rows.length;
  if (rows.length < 1000) break;
}
```

**Total: ceil(total_leads / 1000) queries** — OFFSET-based chunked pagination.

---

## 10. EXPLAIN ANALYZE Results

**Not available.** No live database was accessible during this audit. All query patterns were derived from code analysis.

To obtain measurements after local PostgreSQL is installed, run:

```sql
-- 1. Admin Leads list (default sort)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT l."id", l."leadNumber", l."name", l."company", l."email", l."phone",
       l."city", l."state", l."product", l."requirement", l."status", l."priority",
       l."category", l."createdAt", l."updatedAt", l."nextFollowUpAt", l."lastFollowUpAt"
FROM "Lead" l
WHERE l."isDeleted" = false AND l."isArchived" = false
ORDER BY l."updatedAt" DESC
LIMIT 25 OFFSET 0;

-- 2. Admin Leads with search
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ... FROM "Lead" l
WHERE l."isDeleted" = false AND l."isArchived" = false
  AND (l."name" ILIKE '%test%' OR l."company" ILIKE '%test%'
       OR l."email" ILIKE '%test%' OR l."phone" ILIKE '%test%'
       OR l."leadNumber" ILIKE '%test%')
ORDER BY l."updatedAt" DESC
LIMIT 25 OFFSET 0;

-- 3. Lead count with search
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*) FROM "Lead" l
WHERE l."isDeleted" = false AND l."isArchived" = false
  AND (l."name" ILIKE '%test%' OR l."company" ILIKE '%test%' OR ...);

-- 4. Activity enrichment (latest event per lead)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT DISTINCT ON (e."leadId") e."leadId", e."id", e."occurredAt"
FROM "ActivityEvent" e
INNER JOIN "ActivityEntry" en ON en."eventId" = e."id"
WHERE e."leadId" IN (...)
  AND en."type" IN ('CALL', 'WHATSAPP', ...)
ORDER BY e."leadId", e."occurredAt" DESC;

-- 5. Attention Center CTE
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
WITH assigned_leads AS MATERIALIZED (...)
SELECT ... FROM assigned_leads al
LEFT JOIN note_dates nd ...
LEFT JOIN follow_up_dates fd ...
LEFT JOIN activity_dates ad ...
LEFT JOIN "LeadSource" s ...
ORDER BY "lastActivityDate" ASC LIMIT 20;

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

-- 8. Dashboard duplicate emails
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT "email", COUNT(*) as cnt FROM "Lead"
WHERE "email" IS NOT NULL AND "isDeleted" = false
GROUP BY "email" HAVING COUNT(*) > 1;

-- 9. Follow-up overdue count
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*) FROM "FollowUp"
WHERE "status" = 'PENDING' AND "dueDate" < NOW()
  AND ("assignedUserId" = $1 OR "createdById" = $1);

-- 10. Export chunk
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ... FROM "Lead" l
WHERE l."isDeleted" = false
ORDER BY l."createdAt" DESC, l."id" DESC
LIMIT 1000 OFFSET 0;
```

---

## 11. Prisma Analysis

### Driver Adapter Issue (CRITICAL)

**Current code** (`src/lib/prisma.ts`):
```typescript
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
```

**Problem:** The `PrismaPg` adapter is designed for Neon serverless and uses HTTP-based communication. For local PostgreSQL, this adds unnecessary overhead:

- HTTP request/response overhead per query
- No connection reuse (each query is a separate HTTP request)
- SSL/TLS overhead (Neon requires SSL)
- No TCP connection pooling

**Required fix:** Remove the adapter and use Prisma's built-in PostgreSQL driver:
```typescript
export const prisma = new PrismaClient();
```

Then set `DATABASE_URL` to `postgresql://user:password@localhost:5432/leadbridge`.

### Excessive `include` Usage

| Location | Issue | Impact |
|----------|-------|--------|
| `activityEventService.listByLead()` | `include: { actor, entries: { include: { followUp } } }` | 3 levels deep — could be 2 levels |
| `dashboardService.admin()` recentActivity | `include: { actor, lead, entries }` | 3 includes on 10 rows |
| `leadDetailSelect` | 7 nested relations | Acceptable for detail view |
| `providerService.list()` | `include: { connectors, routingRules }` | Acceptable for list with stats |

### Application-Side Aggregation

| Location | Issue | Impact |
|----------|-------|--------|
| `dashboardService.sales()` query #7 | Loads ALL ActivityEntry rows into memory to count distinct leadId via `Set` | **High** — should be SQL `COUNT(DISTINCT)` |
| `dashboardService.sales()` | Computes `myLeadsTotal`, `myOpenLeads`, `myClosedLeads` in JS from `groupBy` result | Low — 5 status values |
| `dashboardService.admin()` | Computes `salespersonLoad` by joining `groupBy` result with `user.findMany` in JS | Low — small user set |
| `providerService.augmentWithStats()` | Computes `leadCount`, `activeConnectorCount`, `lastSyncAt` from separate queries in JS | Low — small provider set |
| `exportService.exportLeads()` | Builds CSV rows in JS | Low — streaming |

### Query Patterns Inside Loops

| Location | Issue | Impact |
|----------|-------|--------|
| `connector-runtime.ts` `processPayloads()` | `resolveRouting()` per payload — queries DB per iteration | **High** |
| `connector-runtime.ts` `processPayloads()` | `resolveParser()` per payload — queries DB per iteration | **High** |
| `connector-runtime.ts` `processPayloads()` | `leadService.create()` per payload — multiple DB queries per iteration | **Medium** (necessary for transaction isolation) |
| `parser.service.ts` `listForManagement()` | `prisma.parser.upsert` per parser in loop | Low (not hot path) |
| `settings.service.ts` `updateMany()` | `this.update()` per setting in transaction | Low (small number of settings) |

---

## 12. N+1 Analysis

### Complete N+1 Inventory

| Location | Operation | DB Queries per Request | DB Queries per N Records | Can Batch? | Severity |
|----------|-----------|----------------------:|-------------------------:|------------|----------|
| `routing-engine.ts:29-32` | `routingRule.findMany` per payload in sync loop | N+1 | N queries for N payloads | **Yes — load once** | **Critical** |
| `connector-runtime.ts:295-298` | `parser.findUnique` per payload in sync loop | N+1 | N queries for N payloads | **Yes — cache per sync** | **Critical** |
| `connector-runtime.ts:241-255` | `activityEventService.createEvent` per payload (redundant) | N | 2N queries (redundant) | **Yes — remove** | **High** |
| `dashboard.service.ts:197-206` | `activityEntry.findMany` + `.then()` Set count | N/A | Loads all rows into memory | **Yes — use SQL** | **High** |
| `lead.service.ts:302` | `duplicateService.findPotentialDuplicates` per lead create | 1 | N queries for N creates | **Yes — batch** | **Medium** |
| `follow-up.service.ts` | `recalculateLeadFollowUpFields` per follow-up mutation | 3 | 3N queries for N mutations | **Yes — batch recalculation** | **Low** (inside tx) |

### Connector Sync N+1 Breakdown

For a sync importing **100 records** (all new):

| Step | Current Queries | Optimal Queries | Waste |
|------|----------------:|----------------:|------:|
| Routing rules | 100 | 1 | **99** |
| Parser lookup | 100 | 1 | **99** |
| Duplicate (sourceRef) | 100 | 100 | 0 |
| Duplicate (email/phone) | 100 | 100 | 0 |
| Lead create (in tx) | 100 | 100 | 0 |
| Activity event (in tx) | 200 | 200 | 0 |
| Activity event (redundant) | 200 | 0 | **200** |
| **Total** | **900** | **502** | **398** |

**Optimal (with batching):** ~102 queries (1 routing + 1 parser + 100×(2 dedup + 1 create + 2 activity))

---

## 13. Connector Throughput Analysis

### Sync Pipeline Trace

```text
POST /api/connectors/[id]/sync
  ↓
executionLock.acquire()          [1 query: UPDATE connector SET isRunning=true]
  ↓
connectorRuntime.execute()
  ↓
syncHistory.recordStart()        [1 query: INSERT connectorSyncRun]
  ↓
for each payload:
  → resolveRouting()             [1 query: SELECT all routing rules]  ← N+1
  → resolveParser()              [1 query: SELECT parser]            ← N+1
  → parserRuntime.parse()        [0 queries: in-memory]
  → normalizer.validate()        [0 queries: in-memory]
  → normalizer.enrich()          [0 queries: in-memory]
  → leadService.create()
    → findFirst(sourceRef)       [1 query: dedup check]
    → findMany(email/phone)      [1 query: potential dupes]
    → $transaction:
      → lead.create()            [1 query]
      → activityEvent.create()   [2 queries: event + entries]
  → activityEventService.createEvent()  [2 queries: REDUNDANT]
  ↓
syncHistory.recordCompletion()
  → connectorSyncRun.update()    [1 query]
  → connector.update()           [1 query]
  ↓
executionLock.release()          [1 query: UPDATE connector SET isRunning=false]
```

### Query Budget per Payload

| Phase | Queries per Payload | Can Reduce? |
|-------|--------------------:|-------------|
| Overhead (lock + history + release) | 5 | No |
| Routing | 1 | **Yes → 1 per sync** |
| Parser | 1 | **Yes → 0-1 per sync** |
| Dedup (sourceRef) | 1 | No |
| Dedup (email/phone) | 1 | No |
| Lead create (in tx) | 3 | No |
| Activity (redundant) | 2 | **Yes → 0** |
| **Total** | **9** | **Optimal: ~5** |

### Throughput Model

| Records | Current Queries | With Fixes | Improvement |
|--------:|----------------:|-----------:|------------:|
| 10 | 95 | 55 | 1.7x |
| 100 | 905 | 505 | 1.8x |
| 1,000 | 9,005 | 5,005 | 1.8x |
| 10,000 | 90,005 | 50,005 | 1.8x |

**After fixing routing/parser N+1:**

| Records | Current Queries | With Routing Fix | Improvement |
|--------:|----------------:|-----------------:|------------:|
| 100 | 905 | 505 | 1.8x |
| 1,000 | 9,005 | 5,005 | 1.8x |

**After removing redundant activity:**

| Records | With Routing Fix | With Activity Fix | Total Improvement |
|--------:|-----------------:|------------------:|------------------:|
| 100 | 505 | 305 | 3.0x |
| 1,000 | 5,005 | 3,005 | 3.0x |

### Memory per Payload

Each payload goes through:
1. `RawPayload` object (JSON) — 1-10KB
2. `NormalizedLead` object — 0.5-2KB
3. Prisma `lead.create` result — 1-5KB
4. `ActivityEvent` + `ActivityEntry` objects — 0.5-1KB

**Total per payload: ~3-18KB**
**For 10,000 records: ~30-180MB** (acceptable, no streaming needed)

---

## 14. Search Analysis

### Implementation

From `query-builder.ts:63-66`:
```typescript
export function containsSearch(fields: string[], search?: string) {
  if (!search) return undefined;
  return { OR: fields.map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) };
}
```

Generates:
```sql
WHERE ("displayName" ILIKE '%term%'
    OR "company" ILIKE '%term%'
    OR "email" ILIKE '%term%'
    OR "phone" ILIKE '%term%'
    OR "leadNumber" ILIKE '%term%')
```

### Analysis

| Property | Value | Impact |
|----------|-------|--------|
| Scan type | Sequential scan (leading wildcard) | O(n) per search |
| Fields searched | 5 | 5 sequential scans combined with OR |
| Case sensitivity | Case-insensitive | PostgreSQL lowercases for comparison |
| Index support | None for leading-wildcard ILIKE | Standalone `email`/`phone` indexes only help exact match |

### Performance Estimates (Theoretical — Not Measured)

| Dataset | Estimated Time | Notes |
|---------|---------------|-------|
| 1k leads | <50ms | Small table scan |
| 5k leads | 50-100ms | |
| 15k leads | 100-300ms | Current AGENTS.md threshold |
| 25k leads | 300-800ms | |
| 100k leads | 1-3s | |
| 250k leads | 2-8s | |

### Comparison: ILIKE vs Alternatives

| Method | Pros | Cons | Recommended When |
|--------|------|------|-----------------|
| Current ILIKE | Simple, no setup | Sequential scan, O(n) | <15k leads |
| pg_trgm GIN index | Fast substring search | Write overhead, index bloat | >15k leads |
| Full-text search | Stemming, ranking | Complex setup, language-dependent | >50k leads, multilingual |
| Elasticsearch | Blazing fast | External service, operational complexity | >250k leads |

**For local deployment with PostgreSQL on fast disk, ILIKE is acceptable up to ~25k leads.** Beyond that, pg_trgm GIN index is the simplest upgrade.

---

## 15. Pagination Analysis

### Implementation

From `query-builder.ts:59-61`:
```typescript
export function pagination(query: Pick<ListQuery, "page" | "pageSize">) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}
```

### Performance Estimates

| Page | Page Size | Rows Skipped | Estimated Time | Notes |
|------|----------|-------------|---------------|-------|
| 1 | 25 | 0 | <5ms | Index scan |
| 10 | 25 | 225 | <10ms | |
| 100 | 25 | 2,475 | <20ms | |
| 1,000 | 25 | 24,975 | 50-200ms | |
| 10,000 | 25 | 249,975 | 200ms-1s | |

### OFFSET vs Keyset Comparison

| Property | OFFSET (current) | Keyset/Cursor |
|----------|-----------------|---------------|
| Implementation | Simple | More complex |
| Deep page cost | Linear with page number | Constant |
| Page navigation | Direct page access | Sequential only |
| Consistency | May miss/dupe rows during writes | Consistent |
| Best for | Pages <100 | Infinite scroll, deep pagination |

**For a CRM with typical usage (pages <100), OFFSET is fine.** Keyset pagination is only needed if users navigate to very deep pages.

---

## 16. Dashboard Analysis

### Admin Dashboard

| Metric | Value |
|--------|-------|
| Query count | ~24 (18 parallel + 2 sequential + sub-queries) |
| Cache | `unstable_cache` 60s TTL + tag invalidation |
| Bottleneck | Query count, not individual query cost |
| Parallelism | Most queries run in `Promise.all` |

**18 × 5ms = 90ms** vs **1 × 200ms** — parallel execution is likely faster.

### Sales Dashboard

| Metric | Value |
|--------|-------|
| Query count | 13 parallel |
| Cache | `unstable_cache` + `React.cache()` |
| Critical issue | Query #7 loads ALL ActivityEntry rows into memory |

**Query #7 analysis:**
```typescript
prisma.activityEntry.findMany({
  where: {
    type: { in: ["CALL", "WHATSAPP"] },
    event: { occurredAt: { gte: startOfToday } },
  },
  select: { event: { select: { leadId: true } } },
}).then((entries) => {
  const uniqueLeadIds = new Set(entries.map((e) => e.event.leadId));
  return uniqueLeadIds.size;
});
```

If 1,000 activity entries match today, this loads 1,000 rows into memory just to count ~50 unique leadIds. Should be:
```sql
SELECT COUNT(DISTINCT e."leadId") FROM "ActivityEntry" en
INNER JOIN "ActivityEvent" e ON e."id" = en."eventId"
WHERE en."type" IN ('CALL', 'WHATSAPP')
  AND e."occurredAt" >= $startOfDay;
```

### Attention Center

| Metric | Value |
|--------|-------|
| Query count | 1 raw SQL CTE |
| Complexity | 4 CTEs, 5 LEFT JOINs, GREATEST aggregation |
| Performance | Single efficient query |
| Cache | `unstable_cache` + tag invalidation |

**The CTE is well-designed** — it's the most efficient way to compute "needs attention" leads. The `MATERIALIZED` CTE forces PostgreSQL to materialize the lead set, which is correct for the LEFT JOINs.

---

## 17. Request Waterfalls

### Lead List Page

```
Browser navigation
  → middleware.ts (cookie check)                          [~0ms]
  → Server Component: page.tsx
    → requireSession()                                    [~5ms: session lookup]
    → parseListQuery(searchParams)                        [~0ms: in-memory]
    → Promise.all([
        leadService.listPage(query, user)                   [~10-50ms: 4 DB queries]
        prisma.leadSource.findMany({ active: true })        [~2ms: 1 DB query]
      ])
    → Serial: leadIds + raw SQL events + raw SQL entries   [~5-20ms: 2 DB queries]
  → Render Server Component to HTML                       [~5-10ms]
  → Send HTML to browser                                  [~1-5ms LAN / ~50ms cloud]
  → Browser hydrate                                       [~10-50ms JS]
  → Client render                                         [~5-20ms]

Total estimated: ~40-160ms (local) vs ~120-400ms (cloud)
```

### Lead Detail Modal

```
Client click → API call to /api/leads/[id]/details
  → getSession()                                          [~5ms]
  → Promise.all([
      leadService.getById()                                [~5ms: 1 query with 7 relations]
      prisma.note.findMany()                               [~2ms: 1 query]
      prisma.followUp.findMany()                           [~2ms: 1 query]
      activityEventService.listByLead()                    [~5ms: 1 query with includes]
    ])
  → Serialize JSON response                               [~1-2ms]
  → Send to browser                                       [~1-5ms LAN]
  → Client parse + render modal                           [~10-20ms]

Total estimated: ~25-45ms (local)
```

### Dashboard

```
Browser navigation
  → Server Component: page.tsx
    → requireSession()                                    [~5ms]
    → unstable_cache (if cached: return immediately)      [~0ms cached / ~200ms uncached]
    → 18-24 parallel DB queries                           [~10-50ms on fast disk]
    → User lookup + count                                 [~5ms]
  → Render to HTML                                        [~10-20ms]
  → Send to browser                                       [~1-5ms LAN]

Total estimated (cached): ~20-40ms
Total estimated (uncached): ~40-100ms (local)
```

---

## 18. Perceived-Speed Analysis

### Current Loading States

| Route | Loading Component | Effect |
|-------|------------------|--------|
| `(dashboard)/loading.tsx` | Global dashboard loading | Instant feedback |
| `admin/loading.tsx` | Admin section loading | Instant feedback |
| `admin/leads/loading.tsx` | Leads list loading | Instant feedback |
| `admin/users/loading.tsx` | Users list loading | Instant feedback |
| `sales/loading.tsx` | Sales section loading | Instant feedback |
| `sales/my-leads/loading.tsx` | My leads loading | Instant feedback |

**Good:** 6 loading states provide instant feedback during Server Component rendering.

### Navigation Latency

| Action | Estimated Latency | Notes |
|--------|------------------:|-------|
| Bottom nav click (localhost) | <50ms | Server render + navigation |
| Bottom nav click (LAN) | <100ms | + network latency |
| Lead row click → modal open | <50ms | API call + render |
| Search input → results | <200ms | Debounced + API call + render |
| Filter change → results | <100ms | URL change + re-render |
| Form save → feedback | <100ms | API call + toast |
| Dashboard load (cached) | <50ms | Cache hit |
| Dashboard load (uncached) | <150ms | 18+ parallel queries |

### Perceived-Speed Opportunities

| Opportunity | Current | Potential | Impact |
|-------------|---------|-----------|--------|
| Optimistic lead updates | Not implemented | Immediate UI feedback | High |
| Prefetch lead detail on hover | Not implemented | Instant modal open | Medium |
| Streaming lead list | Not implemented | Progressive rendering | Medium |
| Prefetch next page | Not implemented | Instant pagination | Low |
| Instant search | Debounced 300ms | Debounced 150ms | Low |

---

## 19. Frontend Bundle Analysis

### Dependencies

| Package | Size (est.) | Client? | Usage |
|---------|-------------|---------|-------|
| `gsap` | ~315KB min (~100KB gz) | Yes | Menu animations in 3 components |
| `googleapis` | Very large | **No (server)** | Gmail connector |
| `lucide-react` | ~50KB per tree | Yes | Icons throughout |
| `better-auth` | Medium | **No (server)** | Auth |
| `sonner` | Small | Yes | Toast notifications |
| `axios` | ~15KB gz | Yes? | HTTP client |
| `zod` | ~15KB gz | Server + validation | Request validation |
| `clsx` + `tailwind-merge` | ~5KB gz | Yes | Class utilities |

### Client Components

58 `"use client"` files identified. The main client components are:
- Tables (DataTable variants)
- Modals (LeadEditModal, LeadDetailDialog, etc.)
- Forms (各种 forms)
- Navigation (BottomNavigation, Navbar)
- Filters (SearchToolbar, ActiveFilters)
- GSAP animations (3 files)

### Bundle Issues

| Issue | Impact | Current | Recommended |
|-------|--------|---------|-------------|
| GSAP not dynamically imported | ~315KB in initial bundle | 3 files import directly | Dynamic import per component |
| `lucide-react` not tree-shaken | Unused icons included | No `optimizePackageImports` | Add to `next.config.ts` |
| `googleapis` not externalized | May be bundled client-side | No `serverExternalPackages` | Add to `next.config.ts` |
| `pg` not externalized | May be bundled client-side | No `serverExternalPackages` | Add to `next.config.ts` |
| Empty `next.config.ts` | Missing all optimizations | No config | Add recommended config |

### Recommended `next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  optimizePackageImports: ["lucide-react"],
  serverExternalPackages: ["googleapis", "pg"],
};

export default nextConfig;
```

---

## 20. React Rendering Analysis

### Server Components (Good)

All page components are async Server Components. Data is fetched server-side and passed as props. No client-side data fetching for initial page loads.

### Client Components

| Pattern | Count | Notes |
|---------|-------|-------|
| `"use client"` files | 58 | Interactive UI only |
| Components with `useState` | ~30 | Local state management |
| Components with `useEffect` | ~15 | Side effects |
| Components with `useRouter` | ~10 | Navigation |
| Components with `useSearchParams` | ~5 | URL state |

### Potential Rendering Issues

| Location | Issue | Impact |
|----------|-------|--------|
| Lead table rows | Re-render on sort/filter change (entire table) | Low — paginated |
| Dashboard cards | Re-render on data change (entire dashboard) | Low — cached |
| Form modals | Re-render on field change (entire form) | Low — controlled |
| Search toolbar | Debounced input triggers re-render | Low — debounced |
| Bottom navigation | Re-render on route change | Low — small component |

**No significant React rendering issues identified.** The component tree is reasonably sized and well-structured.

---

## 21. Cache Analysis

### Cached Data

| Data | Mechanism | TTL | Invalidation |
|------|-----------|-----|-------------|
| Admin dashboard | `unstable_cache` | 60s | `invalidateAfterMutation()` |
| Sales dashboard | `unstable_cache` + `React.cache()` | Tag-only | `invalidateAfterMutation()` |
| Attention center | `unstable_cache` + `React.cache()` | Tag-only | `invalidateAfterMutation()` |
| Settings | `unstable_cache` | 300s | `invalidateSettings()` |

### Fresh Data (Not Cached)

| Data | Reason |
|------|--------|
| Lead list | Frequently changing, user-specific |
| Lead details | Frequently changing |
| Notes | Frequently changing |
| Follow-ups | Frequently changing |
| Activity events | Frequently changing |

### Cache Evaluation for Local Deployment

| Cache | Keep/Remove | Reason |
|-------|-------------|--------|
| Admin dashboard (60s) | **Remove candidate** | PostgreSQL queries on fast disk are <50ms; cache adds complexity |
| Sales dashboard | **Remove candidate** | Same reason — queries are fast locally |
| Attention center | **Keep** | Complex CTE query — caching saves measurable work |
| Settings | **Keep** | Rarely changes, low overhead |

**For local deployment, most caching adds complexity without meaningful benefit.** PostgreSQL on fast disk can serve dashboard queries in <50ms. The cache invalidation system (`invalidateAfterMutation`) is more complex than the work it saves.

**Exception:** The attention center CTE is complex enough that caching is justified.

### Invalidation Overhead

`invalidateAfterMutation()` calls 3 `revalidateTag()` operations:
1. `TAG.DASHBOARD(userId)` — sales dashboard
2. `TAG.ATTENTION(userId)` — attention center
3. `TAG.ADMIN_DASHBOARD` — admin dashboard

Every lead mutation (create, update, delete, assign, archive) invalidates all 3 caches. With active CRM usage, this means frequent cache misses.

---

## 22. Concurrency Analysis

### Realistic Workloads

| Scenario | Users | Connectors | Notes |
|----------|-------|------------|-------|
| Solo user | 1 | 0-1 | Single person CRM |
| Small team | 2-5 | 1-3 | Small sales team |
| Medium team | 5-10 | 2-5 | Growing team |

### Connection Pool Analysis

**Current (Neon):** Connection pooling handled by Neon serverless driver. No manual configuration.

**Required (Local PostgreSQL):**

| Setting | Value | Notes |
|---------|-------|-------|
| `max_connections` | 50 | PostgreSQL-level limit |
| Prisma connection pool | Default (CPU cores × 2 + disk spindles) | Auto-configured |
| Actual connections | ~8-16 | Node.js event loop handles concurrency |

**For 10 concurrent users:**
- Each user request uses 1 connection
- Dashboard: 18+ parallel queries (but same connection)
- Average request: 1-4 queries
- Peak: 10 users × 1 connection = 10 connections

**50 max_connections is sufficient** for a local CRM with <10 concurrent users.

### Contention Points

| Resource | Contention Risk | Notes |
|----------|-----------------|-------|
| PostgreSQL connections | Low | 50 max, typical usage <20 |
| CPU | Low | 16 threads, CRM is not CPU-bound |
| Memory | Low | 8.3 GiB available |
| Disk I/O | Low | SSD, local access |
| Connector execution lock | Medium | Only 1 connector can run at a time |
| Dashboard cache | Low | Tag-based invalidation |

### Connector Concurrency

Connectors use `ExecutionLock` (optimistic locking via `UPDATE ... WHERE isRunning = false`). Only one sync can run per connector at a time. Multiple connectors can run concurrently.

**For local deployment with 2-5 connectors, this is fine.** The lock prevents duplicate syncs without blocking unrelated operations.

---

## 23. LAN Performance Analysis

### Response Payload Sizes

| Endpoint | Typical Response | Compressed |
|----------|-----------------|------------|
| `GET /api/leads` (25 rows) | 10-30KB JSON | 3-10KB |
| `GET /api/leads/[id]/details` | 5-20KB JSON | 2-7KB |
| `GET /api/dashboard` (admin) | 20-50KB JSON | 5-15KB |
| `GET /api/dashboard` (sales) | 10-30KB JSON | 3-10KB |
| Static assets (JS) | 100-500KB | 30-150KB |
| Static assets (CSS) | 10-50KB | 3-15KB |

### LAN Considerations

| Factor | Impact | Mitigation |
|--------|--------|------------|
| Network latency | 1-5ms per request | Negligible |
| Response size | 10-50KB per API call | gzip compression |
| Static assets | 100-500KB | Next.js automatic optimization |
| WebSocket | Not used | N/A |
| Large exports | 1-10MB CSV | Streaming response |

**LAN performance should be nearly identical to localhost.** The 1-5ms network latency is negligible compared to server render time.

### Compression

Next.js enables gzip compression by default. For LAN deployment, this is sufficient. Brotli is not needed for local networks.

---

## 24. Memory Analysis

### Major Memory Consumers

| Consumer | Estimated Memory | Notes |
|----------|-----------------|-------|
| PostgreSQL | 256MB-2GB | `shared_buffers` + work_mem |
| Node.js (Next.js) | 200-500MB | V8 heap for server rendering |
| Prisma Client | 50-100MB | Connection pool + query results |
| Connector sync | 30-180MB | For 10k records: ~30-180MB |
| Dashboard aggregation | 10-50MB | Result objects |
| Export (CSV) | 10-100MB | String concatenation |

### Memory Amplification Patterns

| Pattern | Amplification | Notes |
|---------|--------------|-------|
| `dashboard.sales()` query #7 | **10-100x** | Loads ALL ActivityEntry rows into memory |
| `exportInChunks()` | 2-3x | String concatenation of CSV rows |
| `providerService.augmentWithStats()` | 2-3x | Separate query + JS join |
| `leadListSelect` with `followUps: take: 1` | 1.5x | Unnecessary relation for most rows |

### Memory Recommendations

| Change | Memory Saved | Complexity |
|--------|-------------|------------|
| Fix `dashboard.sales()` query #7 | 10-100MB for large datasets | Low |
| Remove redundant `followUps` from `leadListSelect` | 10-30MB for 1000 leads | Low |
| Stream export instead of string concat | 50-90% of export memory | Medium |

---

## 25. CPU Analysis

### CPU-Heavy Operations

| Operation | CPU Cost | Frequency | Notes |
|-----------|----------|-----------|-------|
| JSON parsing (request bodies) | Low | Per mutation | Zod validation |
| Parser execution | Low-Medium | Per sync payload | Regex + string ops |
| Normalization | Low | Per sync payload | Email/phone validation |
| Routing rule matching | Low | Per sync payload | String comparison |
| Duplicate detection | Low | Per lead create | 2 queries + comparison |
| Dashboard aggregation | Low | Per cache miss | SQL + JS mapping |
| React server render | Medium | Per page load | HTML generation |
| React hydration | Medium | Per page load | Client-side JS |
| GSAP animations | Low | Per animation trigger | 3 components |
| Export CSV generation | Medium | Per export | String concatenation |

### CPU vs I/O Dominance

| Workload | Dominant | Notes |
|----------|----------|-------|
| Lead list (no search) | I/O | Index scan, small result |
| Lead list (with search) | I/O | Sequential scan (ILIKE) |
| Dashboard (cached) | CPU | Negligible |
| Dashboard (uncached) | I/O | 18+ parallel queries |
| Connector sync | I/O | External API + DB writes |
| Export | CPU | String concatenation + I/O |

**For local deployment, I/O is the primary bottleneck** — but with PostgreSQL on fast disk, even I/O is fast (<5ms per query). CPU becomes relevant only for large exports and complex rendering.

---

## 26. Maximum-Performance Opportunity Matrix

| Area | Current Behavior | Bottleneck | Evidence | Potential Improvement | Expected Impact | Risk | Complexity |
|------|-----------------|------------|----------|----------------------|-----------------|------|------------|
| **Prisma driver** | Neon HTTP adapter for local PostgreSQL | HTTP overhead per query | `src/lib/prisma.ts:8-10` | Remove adapter, use direct pg driver | **50-200ms per query saved** | Low | Low |
| **Docker/PG setup** | No local PostgreSQL | No local database | Environment check | Install Docker + PostgreSQL | Enables local deployment | Low | Medium |
| **Routing N+1** | `routingRule.findMany()` per payload | N queries instead of 1 | `routing-engine.ts:29-32` | Load once before loop | **99 fewer queries per 100 records** | Low | Low |
| **Parser N+1** | `parser.findUnique()` per payload | N queries instead of 0-1 | `connector-runtime.ts:295-298` | Cache per sync | **99 fewer queries per 100 records** | Low | Low |
| **Redundant activity** | Double activity event in connector sync | 2N unnecessary queries | `connector-runtime.ts:241-255` | Remove redundant create | **200 fewer queries per 100 records** | Low | Low |
| **ActivityEntry count** | Loads all rows into memory | Memory + CPU waste | `dashboard.service.ts:197-206` | Use `COUNT(DISTINCT)` | **High for large datasets** | Low | Low |
| **Redundant index** | `@@index([connectorId, sourceReferenceId])` | Write overhead | `prisma/schema.prisma` | Drop redundant index | **Minor write improvement** | Low | Low |
| **ILIKE search** | Leading wildcard prevents index | Sequential scan | `query-builder.ts:63-66` | pg_trgm at >15k leads | **Medium (scales)** | Medium | Medium |
| **COUNT(*)** | Full table scan on every page | Amortized by fast disk | `lead.service.ts:205` | Approximate count at scale | **Medium (scales)** | Low | Medium |
| **OFFSET pagination** | Deep pages expensive | Linear cost growth | `query-builder.ts:59-61` | Keyset at >1000 pages | **Low (rare deep pages)** | Medium | Medium |
| **GSAP bundle** | ~315KB in initial bundle | Initial load time | 3 client components | Dynamic import | **100KB gzipped saved** | Low | Low |
| **next.config.ts** | Empty configuration | Missing optimizations | `next.config.ts` | Add optimizePackageImports | **50KB+ saved** | Low | Low |
| **Dashboard queries** | 18+ parallel queries | Connection pool pressure | `dashboard.service.ts:35-62` | Consolidate counts | **5-10 fewer queries** | Medium | Medium |
| **Cache complexity** | `unstable_cache` + tag invalidation | Unnecessary for local PG | `src/lib/cache-tags.ts` | Remove most caches | **Simpler codebase** | Medium | Medium |

---

## 27. P0/P1/P2/P3 Recommendations

### P0 — Confirmed Waste (Implement First)

| # | Change | Files | Risk | Complexity | Expected Impact |
|---|--------|-------|------|------------|-----------------|
| 1 | **Remove Neon HTTP adapter, use direct pg driver** | `src/lib/prisma.ts`, `.env`, `package.json` | Low | Low | **Critical** — eliminates HTTP overhead per query |
| 2 | **Install Docker + PostgreSQL locally** | New `docker-compose.yml`, `.env` | Low | Medium | **Critical** — enables local deployment |
| 3 | **Load routing rules once per sync** | `src/runtime/connector-runtime.ts`, `src/runtime/routing-engine.ts` | Low | Low | **High** — 99 fewer queries per 100 records |
| 4 | **Cache parser lookup per sync** | `src/runtime/connector-runtime.ts` | Low | Low | **High** — 99 fewer queries per 100 records |
| 5 | **Remove redundant activity event in connector sync** | `src/runtime/connector-runtime.ts` | Low | Low | **Medium** — 200 fewer queries per 100 records |
| 6 | **Fix ActivityEntry fetch-all-to-count** | `src/services/dashboard.service.ts` | Low | Low | **High** — eliminates memory amplification |
| 7 | **Remove redundant Lead index** | `prisma/schema.prisma` + migration | Low | Low | **Low** — minor write improvement |

### P1 — High-Impact Optimization (Implement After P0)

| # | Change | Files | Risk | Complexity | Expected Impact |
|---|--------|-------|------|------------|-----------------|
| 8 | **Add `optimizePackageImports` for lucide-react** | `next.config.ts` | Low | Low | **Medium** — smaller client bundle |
| 9 | **Dynamic-import GSAP** | 3 client components | Low | Low | **Medium** — ~100KB gzipped less in initial bundle |
| 10 | **Add `serverExternalPackages`** | `next.config.ts` | Low | Low | **Low** — prevents server packages in client bundle |
| 11 | **Remove `followUps` from `leadListSelect`** | `src/services/lead.service.ts` | Low | Low | **Medium** — less data per lead row |
| 12 | **Benchmark ILIKE search at current data volume** | N/A (measurement) | None | Low | **Informative** — validates whether pg_trgm is needed |
| 13 | **Benchmark OFFSET pagination at deep pages** | N/A (measurement) | None | Low | **Informative** — validates whether keyset is needed |

### P2 — Benchmark-Dependent (Implement After Measurement)

| # | Change | Trigger | Risk | Complexity |
|---|--------|---------|------|------------|
| 14 | Add pg_trgm GIN index for search | Search >300ms at current scale | Medium | Medium |
| 15 | Replace COUNT(*) with approximate count | Page load >200ms due to count | Low | Medium |
| 16 | Keyset/cursor pagination | Users navigate past page 100 | Medium | Medium |
| 17 | Consolidate dashboard queries | Dashboard load >200ms uncached | Medium | Medium |
| 18 | Remove dashboard cache (keep attention center) | Dashboard queries <50ms uncached | Medium | Low |

### P3 — Scale-Triggered (Implement When Needed)

| # | Change | Trigger | Risk | Complexity |
|---|--------|---------|------|------------|
| 19 | Materialized view for dashboard | >100k leads, dashboard >500ms | Medium | High |
| 20 | Full-text search index | >50k leads, ILIKE >1s | Medium | Medium |
| 21 | Read replica for reports | Reports impact main DB | Medium | High |
| 22 | Background job queue for connectors | Connector sync blocks request handling | Medium | High |
| 23 | Connection pool tuning | >10 concurrent users | Low | Low |
| 24 | Streaming export | Export >10MB | Low | Medium |

### Do Not Optimize

| Change | Reason |
|--------|--------|
| Redis caching | PostgreSQL on fast disk is faster than Redis for CRM workloads |
| Elasticsearch | ILIKE is acceptable at <50k leads; pg_trgm covers 50k-500k |
| Read replicas | Single PostgreSQL on fast disk handles all CRM reads |
| Microservices | Monolith is correct for CRM at this scale |
| Server actions | API routes provide clear HTTP boundaries (current design is good) |

---

## 28. Old Performance Plan Reassessment

### docs/performance.md Recommendations

| Recommendation | Old Assessment | New Assessment | Status |
|---------------|----------------|----------------|--------|
| GIN trigram index for search | P0 when >15k leads | P2 — measure first; ILIKE acceptable on fast local disk | **Needs measurement** |
| Replace COUNT(*) with approximate count | P0 when page load slow | P2 — measure first; fast disk makes COUNT fast | **Needs measurement** |
| Fix dashboard.sales() activity count | P0 — memory waste | **P0 — still valid** | **Still valid** |
| Add FollowUp(status, dueDate) index | P0 when dashboard slow | P3 — measure first | **Needs measurement** |
| Composite indexes for sort fields | P1 when sort slow | P3 — existing indexes cover most sorts | **Superseded** |
| Optimize dashboard query consolidation | P1 when dashboard slow | P2 — measure first; parallel queries are fast | **Needs measurement** |
| Remove redundant Lead index | P1 | **P0 — confirmed** | **Still valid** |
| Cursor pagination for deep pages | P2 when users navigate past page 100 | P2 — same trigger | **Still valid** |
| Dynamic import gsap | P2 when initial load slow | **P1 — always beneficial** | **Upgraded** |
| Materialized view for dashboard | Future when >250k leads | P3 — measure first | **Still valid** |
| Read replica for reports | Future when reports impact DB | **Do not optimize** — unnecessary for local | **Invalidated** |
| Background job queue | Future when sync blocks requests | P3 — only if sync blocks UX | **Still valid** |
| Neon free-tier storage | Ceiling at ~15k leads | **Invalidated** — unlimited local storage | **Invalidated** |
| Neon CU-hours | Optimize compute usage | **Invalidated** — dedicated local CPU | **Invalidated** |
| Egress optimization | Minimize data transfer | **Invalidated** — LAN has ample bandwidth | **Invalidated** |
| 15k lead ceiling | Binding constraint | **Invalidated** — local disk is unlimited | **Invalidated** |
| 250k lead projections | Future scaling concern | P3 — measure when needed | **Still valid** |

### docs/performance.md "Free-Tier Considerations" Section

**Entirely invalid under local deployment.** The 0.5 GB storage ceiling, CU-hour limits, and 5 GB egress constraints do not apply. This section should be removed or replaced with local deployment guidance.

### docs/performance.md "Scaling Considerations" Section

Partially valid:
- "PostgreSQL handles it trivially" — **still valid**
- "Neon Launch with scale-to-zero" — **invalidated** — local PostgreSQL
- "Full-text search index" — **still valid** at >50k leads
- "Cursor pagination" — **still valid** for deep pages
- "Approximate counts" — **still valid** at scale

---

## 29. Proposed Performance Budgets

### UI Budgets

| Interaction | Recommended Target | Measured Current | Aspirational Target |
|-------------|-------------------|------------------|---------------------|
| Navigation response | <100ms | Unknown | <50ms |
| First useful content | <200ms | Unknown | <100ms |
| Table interaction (sort/filter) | <150ms | Unknown | <75ms |
| Search response | <200ms | Unknown | <100ms |
| Modal opening | <100ms | Unknown | <50ms |
| Form save feedback | <100ms | Unknown | <50ms |
| Dashboard load (cached) | <50ms | Unknown | <25ms |
| Dashboard load (uncached) | <200ms | Unknown | <100ms |

### API Budgets

| Endpoint | Recommended Target | Measured Current | Aspirational Target |
|----------|-------------------|------------------|---------------------|
| Simple read (lead detail) | <20ms | Unknown | <10ms |
| Filtered list (leads page) | <50ms | Unknown | <25ms |
| Lead detail modal | <50ms | Unknown | <25ms |
| Dashboard (admin) | <100ms (uncached) | Unknown | <50ms |
| Dashboard (sales) | <100ms (uncached) | Unknown | <50ms |
| Mutation (create/update) | <50ms | Unknown | <25ms |
| Search | <100ms | Unknown | <50ms |

### Database Budgets

| Operation | Recommended Target | Measured Current | Aspirational Target |
|-----------|-------------------|------------------|---------------------|
| Simple lookup (by ID) | <2ms | Unknown | <1ms |
| List query (25 rows) | <10ms | Unknown | <5ms |
| COUNT(*) | <20ms | Unknown | <10ms |
| Aggregation (groupBy) | <20ms | Unknown | <10ms |
| Search (ILIKE) | <50ms | Unknown | <25ms |
| Complex CTE | <50ms | Unknown | <25ms |

### Connector Budgets

| Metric | Recommended Target | Measured Current | Aspirational Target |
|--------|-------------------|------------------|---------------------|
| Records per second | >50 rec/s | Unknown | >200 rec/s |
| DB queries per record | <6 | ~9 | <5 |
| Transactions per record | 1 | 1 | 1 |
| Memory per 1000 records | <50MB | Unknown | <20MB |

---

## 30. Recommended Optimization Roadmap

### Phase A — Infrastructure Setup (CRITICAL)

**Goal:** Get LeadBridge running on local PostgreSQL

**Files affected:**
- `docker-compose.yml` (new)
- `.env` (update DATABASE_URL)
- `src/lib/prisma.ts` (remove PrismaPg adapter)
- `package.json` (remove `@prisma/adapter-pg`)
- `prisma/schema.prisma` (no changes needed)

**Expected performance mechanism:**
- Eliminate HTTP overhead per query (50-200ms → <1ms)
- Enable TCP connection pooling
- Enable local disk I/O for PostgreSQL

**Risk:** Low — standard PostgreSQL migration
**Complexity:** Medium — requires Docker setup and schema migration
**Benchmark:** Time API responses before/after; expect 5-20x improvement

### Phase B — Connector Pipeline Fixes (P0)

**Goal:** Eliminate confirmed N+1 patterns in connector sync

**Files affected:**
- `src/runtime/connector-runtime.ts` (load routing once, cache parser, remove redundant activity)
- `src/runtime/routing-engine.ts` (accept pre-loaded rules)

**Expected performance mechanism:**
- 99 fewer routing queries per 100 records
- 99 fewer parser queries per 100 records
- 200 fewer redundant activity queries per 100 records

**Risk:** Low — straightforward refactoring
**Complexity:** Low — moving queries outside loops
**Benchmark:** Time sync for 100 records before/after; expect 2-3x improvement

### Phase C — Query & Index Optimization (P0-P1)

**Goal:** Fix confirmed query inefficiencies

**Files affected:**
- `src/services/dashboard.service.ts` (fix ActivityEntry count)
- `prisma/schema.prisma` (remove redundant index)
- `src/services/lead.service.ts` (remove unnecessary followUps from leadListSelect)

**Expected performance mechanism:**
- Eliminate memory amplification in sales dashboard
- Reduce write amplification from redundant index
- Reduce data transfer per lead row

**Risk:** Low
**Complexity:** Low
**Benchmark:** Measure dashboard load time, lead list memory usage

### Phase D — Frontend Optimization (P1)

**Goal:** Reduce initial bundle size and improve perceived speed

**Files affected:**
- `next.config.ts` (add optimizePackageImports, serverExternalPackages)
- 3 client components (dynamic-import GSAP)

**Expected performance mechanism:**
- ~150KB less JavaScript in initial bundle
- Faster initial page load
- Better code splitting

**Risk:** Low
**Complexity:** Low
**Benchmark:** Bundle analysis before/after; measure initial load time

### Phase E — Measurement & Benchmarking (P1)

**Goal:** Obtain actual performance measurements

**Actions:**
- Run EXPLAIN ANALYZE for all critical queries
- Benchmark lead list with/without search at various data volumes
- Benchmark OFFSET pagination at deep pages
- Benchmark dashboard load (cached vs uncached)
- Benchmark connector sync throughput
- Measure API response times for all endpoints
- Test with 1, 5, 10 concurrent LAN users

**Expected output:**
- Baseline measurements for all performance targets
- Data-driven decisions for P2/P3 optimizations

### Phase F — Search & Pagination at Scale (P2)

**Goal:** Optimize for growing data volumes

**Trigger:** When measurements show degradation

**Actions (if needed):**
- Add pg_trgm GIN index for search
- Implement keyset pagination for deep pages
- Replace COUNT(*) with approximate counts
- Consolidate dashboard queries

### Phase G — Concurrency & Load Testing (P2-P3)

**Goal:** Validate performance under concurrent LAN usage

**Trigger:** When multiple users are actively using the CRM

**Actions:**
- Test with 5, 10, 15 concurrent users
- Measure connection pool behavior
- Test connector sync while users are working
- Validate dashboard cache behavior under load

### Phase H — Final Regression Benchmark (P3)

**Goal:** Verify all optimizations maintain performance

**Actions:**
- Run full benchmark suite
- Compare against Phase E baseline
- Document final performance characteristics
- Update performance budgets

---

## 31. Measurement Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| No live database | Cannot obtain actual execution times | Phase A must complete first |
| No Docker installed | Cannot test local PostgreSQL performance | Install Docker Desktop |
| No EXPLAIN ANALYZE | Cannot verify index usage or scan types | Priority in Phase E |
| No production data volume | Cannot assess search/pagination performance | Use seed data or Neon snapshot |
| No load testing | Cannot assess concurrent user behavior | Phase G |
| No bundle analysis | Cannot measure actual JS sizes | Use `@next/bundle-analyzer` in Phase D |
| No network latency data | Cannot assess LAN vs localhost difference | Measure in Phase E |
| WSL2 environment | Some I/O overhead vs native Windows | Acceptable for development |

---

## Appendix A: Files Changed in This Audit

**No files were modified.** This was a read-only audit.

## Appendix B: Key Source Files Analyzed

| File | Lines | Purpose |
|------|------:|---------|
| `prisma/schema.prisma` | ~500 | Database schema, indexes, relations |
| `src/lib/prisma.ts` | 24 | Prisma client singleton with Neon adapter |
| `src/services/lead.service.ts` | 443 | Lead CRUD, list, search, activity enrichment |
| `src/services/dashboard.service.ts` | 301 | Admin + sales dashboard aggregation |
| `src/services/attention.service.ts` | 257 | Attention center queries + CTE |
| `src/services/follow-up.service.ts` | 453 | Follow-up CRUD + denormalized field maintenance |
| `src/services/report.service.ts` | 181 | Analytics aggregation queries |
| `src/services/export.service.ts` | 224 | CSV export with chunked pagination |
| `src/services/note.service.ts` | 202 | Note CRUD with follow-up scheduling |
| `src/services/connector-health.service.ts` | 75 | Health tracking |
| `src/services/connector.service.ts` | 56 | Connector listing and sync run recording |
| `src/services/scheduler.service.ts` | 257 | Connector scheduler and execution |
| `src/services/execution-lock.service.ts` | 67 | Distributed lock for connector execution |
| `src/services/settings.service.ts` | 112 | Settings with caching |
| `src/services/duplicate.service.ts` | 29 | Potential duplicate detection |
| `src/services/provider.service.ts` | ~200 | Provider CRUD and routing rules |
| `src/services/user.service.ts` | 106 | User listing and pagination |
| `src/services/activity-event.service.ts` | ~100 | Activity event/entry creation and querying |
| `src/runtime/connector-runtime.ts` | 360 | Connector execution orchestrator |
| `src/runtime/routing-engine.ts` | 105 | Routing rule matching |
| `src/runtime/parser-runtime.ts` | 40 | Parser execution |
| `src/runtime/lead-normalizer.ts` | 47 | Lead validation and enrichment |
| `src/runtime/sync-history.ts` | 115 | Sync run recording |
| `src/lib/query-builder.ts` | 88 | Search, pagination, filter utilities |
| `src/lib/cache-tags.ts` | 66 | Cache tag constants and invalidation |
| `src/lib/api.ts` | 60 | API authorization helpers |
| `src/lib/session.ts` | 44 | Session management |
| `src/lib/auth.ts` | 83 | Better Auth configuration |
| `src/middleware.ts` | 23 | Route protection middleware |
| `docs/performance.md` | 147 | Previous performance documentation |
| `docs/experiments/09_PERFORMANCE_BASELINE_AUDIT.md` | 1009 | Phase 1 baseline audit |
| `package.json` | ~60 | Dependencies and scripts |
| `next.config.ts` | 6 | Empty configuration |

---

*End of audit report.*
