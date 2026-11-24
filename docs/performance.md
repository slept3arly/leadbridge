# LeadBridge Performance

> **Status:** Canonical
> **Last verified:** 2026-11-23
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
| Dashboard admin | 14 parallel operations in `Promise.all` | Includes 13 Prisma/service calls and one activity aggregate query; activity metrics use PostgreSQL grouping sets and return aggregate rows |
| Dashboard sales | 9 parallel operations in `Promise.all` | Includes the attention-center service call; activity metrics use one PostgreSQL aggregate rather than seven prior lead-ID result sets |
| Attention center CTE | 4 CTEs with MATERIALIZED | Joins 5 tables |
| CSV exports | Exact filtered count + 250-row keyset batches | Streamed response; 50,000 row, 25 MB serialized-body, 30-second application limits; no snapshot across pages |

### Search

Current implementation uses `ILIKE '%term%'` across 5 fields:

```sql
WHERE (displayName ILIKE '%term%'
    OR company ILIKE '%term%'
    OR email ILIKE '%term%'
    OR phone ILIKE '%term%'
    OR leadNumber ILIKE '%term%')
```

The leading wildcard means a conventional B-tree index does not support these substring predicates. The query planner chooses the scan strategy based on available indexes and statistics; no current plan or measured search latency is documented here.

### Pagination

OFFSET-based pagination throughout. Activity events (`activityEventService.listByLead`) use cursor-based pagination.

The five current CSV export categories use keyset batches rather than OFFSET and serialize one row at a time to the response. Each row-export count/page query uses a short transaction; the download does not retain a transaction snapshot. The application enforces row, generated-byte, and elapsed-time limits. Cancellation stops later iteration, but does not immediately cancel an in-flight Prisma query; PostgreSQL's 15-second statement timeout bounds export queries, and the interactive transaction timeout is 16 seconds. These limits and concurrency behavior have not been benchmarked against a production database.

Lead detail projections omit `Lead.rawPayload`, which is retained for connector ingestion but is not used by the ordinary lead detail UI or API response.

### Caching

- **Cached (`unstable_cache`):** Admin dashboard metrics (60-second revalidation); Sales dashboard and Attention Center data (per-user, tag-based, with no explicit time revalidation); individual settings fetched through `SettingsService.get()` (300-second revalidation). `SettingsService.getAll()` and lead-source list queries are not wrapped in this cache.
- **Not cached as general CRM reads:** My Leads, lead details, notes, follow-ups, and activity-event endpoints. Sales dashboard and Attention Center pages do cache selected lead/follow-up/activity-derived summaries per user as described above.
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

No production performance measurements are documented here. Evaluate query plans and timings against an isolated local PostgreSQL dataset before making performance changes.

### 1. ILIKE Search at Scale

**Current behavior:** `ILIKE '%term%'` with a leading wildcard is not supported by a conventional B-tree index. The planner's actual strategy depends on available indexes, statistics, and data; no query plan has been measured here.

**Assessment:** Substring-search cost depends on data, indexes, and the selected query plan. No scale threshold or latency estimate is established here.

### 2. OFFSET Pagination Deep Pages

**Current behavior:** Deep `SKIP N` pages may require PostgreSQL to scan and discard earlier rows. Exact work depends on the query plan and data; no query plan has been measured here.

**Assessment:** Deep-page cost depends on the query plan and matching rows. No latency estimate is established here.

### 3. COUNT(*) on Every Page Load

**Current behavior:** The paginated lead query requests a matching-row count alongside the page. The amount of work depends on filters, indexes, and the chosen query plan; no query plan has been measured here.

**Assessment:** Count cost depends on filters, indexes, and the query plan. No latency estimate is established here.

### 4. Dashboard Query Work

**Current behavior:** Admin and Sales activity metrics are aggregated in PostgreSQL. Admin returns one totals row and per-actor rows; Sales returns one aggregate row. Other dashboard queries remain independent parallel queries.

**Measurement status:** The prior JavaScript paths materialized matching ActivityEntry records (Admin) and lead IDs across seven Sales queries. The new SQL returns aggregate rows, reducing result transfer and JavaScript aggregation. Query duration and execution plans remain unmeasured; evaluate with `EXPLAIN (ANALYZE, BUFFERS)` and request timing against an isolated local PostgreSQL dataset before proposing index changes.

## Optimization Priorities

### Current Implementation (verified from code)

- OFFSET pagination for all list queries
- `ILIKE '%term%'` for search across 5 fields
- `COUNT(*)` for total count on paginated lists
- `unstable_cache` with tag-based invalidation for dashboard/settings
- No general-purpose cache for CRM list/detail endpoints; selected dashboard and Attention Center summaries are cached per user as described above
- 14 parallel operations in the admin dashboard's `Promise.all`
- Cursor-based pagination for activity events only

### P0 -- High Impact / Free (when needed)

| Change | Benefit | Trigger |
|---|---|---|
| Add GIN trigram index for search | Can support indexed substring matching when selected by the planner | Evaluate if search degrades; the 15k threshold is a theoretical estimate |
| Replace COUNT(*) with approximate count | May reduce exact-count work, with changed count semantics | Only if measurements show exact counts are a bottleneck |
| Add FollowUp(status, dueDate) index | May support common status/date filters | Only if query plans and timings show a bottleneck |

### P1 -- Worthwhile (when needed)

| Change | Benefit | Trigger |
|---|---|---|
| Add composite indexes for sort fields | Sort performance | When sort operations slow down |
| Optimize dashboard.admin() query consolidation | Fewer parallel queries | When admin dashboard loads exceed target |
| Remove redundant Lead `@@index([connectorId, sourceReferenceId])` | Minor write improvement | When write volume increases |

### P2 -- Scale-Dependent (when needed)

| Change | Benefit | Trigger |
|---|---|---|
| Cursor pagination for deep pages | Avoids discarding all earlier rows when a matching index supports the seek | Consider if measurements show deep-page cost matters |
| Further bundle work | No change recommended now | Reassess only from route-specific bundle or browser measurements |

### Future -- Only When Needed

| Change | Benefit | Trigger |
|---|---|---|
| Materialized view for dashboard | Dashboard: faster aggregates | When dashboard queries exceed target |
| Read replica for reports | Report isolation | When reports impact main database |
| Background job queue | Async processing | When connector sync blocks request handling |

## Scaling Considerations

At higher scale (250k+ leads):

- **Local PostgreSQL capacity** should be assessed from the actual machine's storage, memory, and query workload
- **Search indexes, cursor pagination, and approximate counts** are options to evaluate if measurements show that the current query patterns are limiting the workload

Assess capacity using the actual local machine, database workload, query plans, and measured timings before planning for a larger lead population.
