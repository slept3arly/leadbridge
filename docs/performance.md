# LeadBridge Performance

> **Status:** Canonical
> **Last verified:** 2026-11-05
> **Source of truth:** `src/services/`, `src/lib/`, `prisma/schema.prisma`

## Current Performance Architecture

### Database Access

- **Driver:** `@prisma/adapter-pg` with the Node PostgreSQL driver
- **Connection pooling:** Managed by the PostgreSQL driver adapter using its default pool configuration; no external pooler is part of the local deployment
- **Singleton pattern:** `PrismaClient` via `globalThis` in development and a module-level client in production

### Query Patterns

| Query | Pattern | Notes |
|---|---|---|
| My Leads list | OFFSET pagination + COUNT(*) + ILIKE search | Core list query |
| Lead activity enrichment | `DISTINCT ON (leadId)` raw SQL | Runs only for leads on current page |
| Dashboard admin | 14 parallel queries | Activity metrics use PostgreSQL grouping sets; only aggregate rows are returned |
| Dashboard sales | 9 parallel queries | Activity metrics use one PostgreSQL aggregate instead of seven lead-ID result sets |
| Attention center CTE | 4 CTEs with MATERIALIZED | Joins 5 tables |
| Export leads | OFFSET in while loop (1000/batch) | Background export |

### Search

Current implementation uses `ILIKE '%term%'` across 5 fields:

```sql
WHERE (displayName ILIKE '%term%'
    OR company ILIKE '%term%'
    OR email ILIKE '%term%'
    OR phone ILIKE '%term%'
    OR leadNumber ILIKE '%term%')
```

Leading wildcard prevents B-tree index usage. Each OR branch causes a sequential scan.

### Pagination

OFFSET-based pagination throughout. Activity events (`activityEventService.listByLead`) use cursor-based pagination.

Lead detail projections omit `Lead.rawPayload`, which is retained for connector ingestion but is not used by the ordinary lead detail UI or API response.

### Caching

- **Cached (unstable_cache):** Dashboard metrics (per-user), attention center (per-user), admin dashboard (60s TTL), settings (300s TTL), lead source list
- **Not cached:** My Leads, lead details, notes, follow-ups, activity events
- **Invalidation:** `invalidateAfterMutation()` revalidates the acting user's dashboard and attention tags, any additional affected Sales owners' tags, and the Admin dashboard tag. Admin lead creation, ownership changes, and lead-associated note/follow-up mutations resolve affected owner IDs from persisted lead state and invalidate after the write succeeds. Ownership changes include both previous and new owners; tag generation deduplicates IDs. A failed write does not trigger invalidation.
- **Open tabs:** Successful Axios mutations for leads, notes, follow-ups, and activities broadcast entity identifiers through `BroadcastChannel`, with a `storage` event fallback. Affected views refresh server props, and an open lead detail refetches only for its lead or one of its currently loaded entities. Visible/focused tabs also revalidate after 30 seconds without a refresh; there is no polling.

### Rendering

- Server Components for all pages (no client-side data fetching for initial load)
- Client components receive data as props
- `loading.tsx` at route boundaries for instant feedback
- Admin lead data and active lead sources load concurrently after the request settings are resolved.
- Shared bottom navigation uses CSS transitions. GSAP remains on the login route for `AnimatedReveal` and is not included by Admin or Sales client-reference manifests.

### Measurements

The production build before the navigation change referenced a 20,361-byte JavaScript chunk containing GSAP (7,404 bytes when gzipped) from the Admin layout. After the change, the GSAP-containing chunk is referenced by the login route only; Admin and Sales manifests no longer reference it. These are emitted bundle measurements, not browser transfer timings. PostgreSQL dashboard latency and query plans were not measured because an isolated integration database was unavailable.

## Known Bottlenecks

All performance numbers below are **theoretical estimates from experimental analysis** (see `docs/experiments/07_PERFORMANCE_ARCHITECTURE_ASSESSMENT.md`). No production measurements exist.

### 1. ILIKE Search at Scale

**Current behavior:** `ILIKE '%term%'` with leading wildcard causes sequential scans. With 5 OR'd columns, each causes a separate scan.

**Estimate:** Acceptable at <15k leads. At 250k leads, estimated 500ms-2s depending on data distribution. (Theoretical estimate; not measured.)

### 2. OFFSET Pagination Deep Pages

**Current behavior:** `SKIP N` forces PostgreSQL to scan and discard N rows.

**Estimate:** Pages 1-100 fast. Page 10,000 with pageSize=25 estimated at ~5s. (Theoretical estimate; not measured.)

### 3. COUNT(*) on Every Page Load

**Current behavior:** Full table scan to count matching rows on every My Leads page load.

**Estimate:** At 25k leads per salesperson, estimated ~50-100ms. (Theoretical estimate; not measured.)

### 4. Dashboard Query Work

**Current behavior:** Admin and Sales activity metrics are aggregated in PostgreSQL. Admin returns one totals row and per-actor rows; Sales returns one aggregate row. Other dashboard queries remain independent parallel queries.

**Measurement status:** The prior JavaScript paths materialized matching ActivityEntry records (Admin) and lead IDs across seven Sales queries. The new SQL returns aggregate rows, reducing result transfer and JavaScript aggregation. Query duration and execution plans remain unmeasured; evaluate with `EXPLAIN (ANALYZE, BUFFERS)` and request timing against an isolated local PostgreSQL dataset before proposing index changes.

## Optimization Priorities

### Current Implementation (verified from code)

- OFFSET pagination for all list queries
- `ILIKE '%term%'` for search across 5 fields
- `COUNT(*)` for total count on paginated lists
- `unstable_cache` with tag-based invalidation for dashboard/settings
- No caching for CRM data (leads, notes, follow-ups)
- 14 parallel queries for admin dashboard
- Cursor-based pagination for activity events only

### P0 -- High Impact / Free (when needed)

| Change | Benefit | Trigger |
|---|---|---|
| Add GIN trigram index for search | Avoids sequential scans on search | When leads exceed ~15k and search degrades |
| Replace COUNT(*) with approximate count | Eliminates full table scan for count | When page load time becomes unacceptable |
| Add FollowUp(status, dueDate) index | Speeds up global follow-up queries | When dashboard/tasks queries slow down |

### P1 -- Worthwhile (when needed)

| Change | Benefit | Trigger |
|---|---|---|
| Add composite indexes for sort fields | Sort performance | When sort operations slow down |
| Optimize dashboard.admin() query consolidation | Fewer parallel queries | When admin dashboard loads exceed target |
| Remove redundant Lead `@@index([connectorId, sourceReferenceId])` | Minor write improvement | When write volume increases |

### P2 -- Scale-Dependent (when needed)

| Change | Benefit | Trigger |
|---|---|---|
| Cursor pagination for deep pages | Constant-time deep pages | When users navigate past page 100 |
| Further bundle work | No change recommended now | Reassess only from route-specific bundle or browser measurements |

### Future -- Only When Needed

| Change | Benefit | Trigger |
|---|---|---|
| Materialized view for dashboard | Dashboard: faster aggregates | When dashboard queries exceed target |
| Read replica for reports | Report isolation | When reports impact main database |
| Background job queue | Async processing | When connector sync blocks request handling |

## Scaling Considerations

At higher scale (250k+ leads):

- **PostgreSQL handles it trivially** -- no database change needed
- **Local PostgreSQL capacity** should be assessed from the actual machine's storage, memory, and query workload
- **Full-text search index** becomes essential
- **Cursor pagination** becomes important for deep page navigation
- **Approximate counts** become important for page load performance

See `docs/experiments/07_PERFORMANCE_ARCHITECTURE_ASSESSMENT.md` for detailed 250k analysis (theoretical estimates, not measured). Its historical hosted-database assumptions do not describe the current local deployment.
