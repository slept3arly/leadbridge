# LeadBridge Performance

> **Status:** Canonical
> **Last verified:** 2026-09-17
> **Source of truth:** `src/services/`, `src/lib/`, `prisma/schema.prisma`

## Current Performance Architecture

### Database Access

- **Driver:** `@prisma/adapter-pg` (Neon serverless HTTP driver)
- **Connection pooling:** Handled by Neon serverless driver (no manual pool management)
- **Singleton pattern:** `PrismaClient` via `globalThis` in development, per-invocation in production

### Query Patterns

| Query | Pattern | Notes |
|---|---|---|
| My Leads list | OFFSET pagination + COUNT(*) + ILIKE search | Core list query |
| Lead activity enrichment | `DISTINCT ON (leadId)` raw SQL | Runs only for leads on current page |
| Dashboard admin | 18 parallel queries | Multiple count + groupBy calls |
| Dashboard sales | 12 parallel queries | Includes activityEntry queries |
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

### Caching

- **Cached (unstable_cache):** Dashboard metrics (per-user), attention center (per-user), admin dashboard (60s TTL), settings (300s TTL), lead source list
- **Not cached:** My Leads, lead details, notes, follow-ups, activity events
- **Invalidation:** `invalidateAfterMutation()` revalidates dashboard + attention + admin dashboard tags

### Rendering

- Server Components for all pages (no client-side data fetching for initial load)
- Client components receive data as props
- `loading.tsx` at route boundaries for instant feedback

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

### 4. Dashboard Query Count

**Current behavior:** Admin dashboard fires 18 parallel queries including count calls and groupBy operations.

**Estimate:** At 250k leads, estimated ~500ms-1s. (Theoretical estimate; not measured.)

## Optimization Priorities

### Current Implementation (verified from code)

- OFFSET pagination for all list queries
- `ILIKE '%term%'` for search across 5 fields
- `COUNT(*)` for total count on paginated lists
- `unstable_cache` with tag-based invalidation for dashboard/settings
- No caching for CRM data (leads, notes, follow-ups)
- 18 parallel queries for admin dashboard
- Cursor-based pagination for activity events only

### P0 -- High Impact / Free (when needed)

| Change | Benefit | Trigger |
|---|---|---|
| Add GIN trigram index for search | Avoids sequential scans on search | When leads exceed ~15k and search degrades |
| Replace COUNT(*) with approximate count | Eliminates full table scan for count | When page load time becomes unacceptable |
| Fix dashboard.sales() activity count | Reduces memory usage | When sales dashboard loads become slow |
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
| Dynamic import gsap | Bundle: -166KB | When initial load time becomes a concern |

### Future -- Only When Needed

| Change | Benefit | Trigger |
|---|---|---|
| Materialized view for dashboard | Dashboard: faster aggregates | When dashboard queries exceed target |
| Read replica for reports | Report isolation | When reports impact main database |
| Background job queue | Async processing | When connector sync blocks request handling |

## Free-Tier Considerations

- **Neon Free:** 0.5 GB storage, 100 CU-hrs compute, 5 GB egress
- **Storage is the binding constraint** -- not compute or bandwidth
- **Recommended ceiling:** ~15,000 leads at realistic activity density (~320 MB) -- estimate from `docs/experiments/08_FREE_TIER_CAPACITY_ASSESSMENT.md`
- **ILIKE search is acceptable** at <15k leads

See `docs/experiments/08_FREE_TIER_CAPACITY_ASSESSMENT.md` for detailed free-tier analysis (theoretical estimates, not measured).

## Scaling Considerations

At higher scale (250k+ leads):

- **PostgreSQL handles it trivially** -- no database change needed
- **Neon Launch with scale-to-zero** provides cost-effective scaling
- **Full-text search index** becomes essential
- **Cursor pagination** becomes important for deep page navigation
- **Approximate counts** become important for page load performance

See `docs/experiments/07_PERFORMANCE_ARCHITECTURE_ASSESSMENT.md` for detailed 250k analysis (theoretical estimates, not measured).
