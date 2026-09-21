# Implementation Audit: Sales & Admin Dashboard Improvements

> **Status:** Plan — Ready for Implementation
> **Created:** 2026-09-20
> **Scope:** Bring Admin dashboard into the same visual language as Sales UI; improve dashboard usefulness
> **NOT in scope:** Performance optimization, design system overhaul, architecture redesign

---

## 1. Summary of What's Already Right

The codebase has a strong foundation. Most of the work is convergence, not rebuilding.

| Area | Status | Details |
|------|--------|---------|
| Shared component system | ✅ Solid | `src/components/ui/` (Button, Card, Badge, Input, etc.) and `src/components/shared/` (AppShell, Navbar, KpiCard, DataTable) are canonical and well-maintained |
| AppShell + Navigation | ✅ Solid | Both Sales and Admin use `AppShell` with role-based `BottomNavigation` |
| Navbar | ✅ Solid | Both pages use the same shared `Navbar` component |
| Design tokens | ✅ Solid | CSS variables (`--color-ink`, `--color-brand`, `--color-border`, etc.) used consistently across Sales UI |
| Service layer | ✅ Solid | `dashboard.service.ts` and `attention.service.ts` handle all business logic; no queries in components |
| Caching | ✅ Solid | `unstable_cache` with tag-based invalidation (`TAG.DASHBOARD`, `TAG.ATTENTION`) |
| Attention system | ✅ Solid | ActivityEvent + ActivityEntry model, well-structured service with typed return values |
| Permission system | ✅ Solid | `can(user, Permission.*)` for authorization; `requireSession()` for session validation |
| Prisma schema | ✅ Solid | 606 lines, well-indexed, proper enums, `@@unique` constraints |
| Badge tone coverage | ✅ Solid | 30+ tones for statuses, priorities, categories |
| KpiCard | ✅ Solid | Shared component with title, count, description, href — used by Sales Dashboard and Attention Center |

---

## 2. Inventory of What's Missing/Broken

### 2.1 Admin Dashboard — Inline Components Instead of Shared Ones

| Issue | File | Line(s) | Severity |
|-------|------|---------|----------|
| `KpiStat` defined locally instead of using `KpiCard` | `admin/page.tsx` | 35-41 | Medium |
| `InsightCard` defined locally (near-duplicate of `KpiCard`) | `admin-dashboard-client.tsx` | 296-318 | Medium |
| `HealthBadge` defined locally instead of extending `Badge` | `admin-dashboard-client.tsx` | 351-363 | Low |
| `WorkQueueRow` defined locally instead of using `DataTable` | `admin-dashboard-client.tsx` | 320-349 | Medium |
| Recent Activity hand-rolled `<table>` instead of `DataTable` | `admin-dashboard-client.tsx` | 231-256 | Medium |
| Recent Syncs hand-rolled `<table>` instead of `DataTable` | `admin-dashboard-client.tsx` | 262-290 | Medium |
| Pipeline section uses raw `Card` + `Badge` but pattern matches Sales | `admin-dashboard-client.tsx` | 114-136 | Low (acceptable) |

### 2.2 Sales Dashboard — Minor Inconsistencies

| Issue | File | Line(s) | Severity |
|-------|------|---------|----------|
| `PipelineCard` defined inline instead of extracted | `sales-dashboard-client.tsx` | 56-67 | Low |
| `AgendaRow` defined inline (justified — only used here) | `sales-dashboard-client.tsx` | 69-100 | None |
| KPI count uses `text-3xl font-bold` inline in section 3 | `sales-dashboard-client.tsx` | 174-218 | Low (matches KpiCard styling) |

### 2.3 Badge Component — Missing Admin Tones

| Missing Tone | Needed For | File |
|-------------|------------|------|
| `HEALTHY` | Connector health badge | `badge.tsx` |
| `WARNING` | Connector health badge | `badge.tsx` |
| `UNAVAILABLE` | Connector health badge | `badge.tsx` |
| `COMPLETED` | Sync status | `badge.tsx` |
| `ERROR` | Sync status | `badge.tsx` |
| `RUNNING` | Sync status | `badge.tsx` |

### 2.4 Structural Gaps

| Gap | Impact | Notes |
|-----|--------|-------|
| No shared `DashboardLayout` component | Minor duplication in `page.tsx` files | Each page wraps `<Navbar>` + children independently — acceptable pattern |
| Admin has no `requireSession("ADMIN")` guard | Security concern | `admin/page.tsx` does not call `requireSession()` — relies on middleware alone |
| `InsightCard` href logic is complex | Could be simplified with KpiCard | KpiCard already supports `href`; the `highlight` ring logic is the only addition |

---

## 3. File-by-File Implementation Plan

### 3.1 `src/components/ui/badge.tsx`

**Goal:** Add missing tones for Admin dashboard badges.

**Changes:**
- Add tones: `HEALTHY`, `WARNING`, `UNAVAILABLE`, `COMPLETED`, `ERROR`, `RUNNING`
- Follow existing pattern: `bg-{color}-50 text-{color}-700` for light tones

**Estimated complexity:** Trivial (add 6 entries to `tones` object)

---

### 3.2 `src/app/(dashboard)/admin/page.tsx`

**Goal:** Replace inline `KpiStat` with shared `KpiCard`.

**Changes:**
- Remove `KpiStat` function definition (lines 35-41)
- Import `KpiCard` from `@/components/shared/kpi-card`
- Replace `<KpiStat>` usages with `<KpiCard>` — pass `title`, `count`, `description`, `href`
- Add `requireSession("ADMIN")` for server-side authorization guard
- Update grid to match Sales dashboard pattern (KpiCard has hover state, link behavior)

**Data mapping:**
| Old (`KpiStat`) | New (`KpiCard`) |
|-----------------|-----------------|
| `label="Total Leads"` | `title="Total Leads"` |
| `value={data.cards.totalLeads}` | `count={data.cards.totalLeads}` |
| (none) | `description="All leads in system"` |
| (none) | `href="/admin/leads"` |

**Estimated complexity:** Low

---

### 3.3 `src/components/admin/admin-dashboard-client.tsx`

**Goal:** Replace inline components with shared ones; use `DataTable` for tables.

#### 3.3a Replace `InsightCard` with `KpiCard`

**Changes:**
- Remove `InsightCard` function (lines 296-318)
- Replace all `<InsightCard>` usages with `<KpiCard>` from `@/components/shared/kpi-card`
- The `highlight` ring effect (`ring-1 ring-[var(--color-brand)]/20`) can be added as a className prop on KpiCard — it already accepts `className` via Card
- The `href` conditional logic stays in the parent component

**Estimated complexity:** Low

#### 3.3b Replace `HealthBadge` with `Badge`

**Changes:**
- Remove `HealthBadge` function (lines 351-363)
- Use `<Badge label={status} />` from `@/components/ui/badge` — the new tones (HEALTHY, WARNING, UNAVAILABLE) will handle the visual mapping
- Map status to display label: `HEALTHY` → "Healthy", `WARNING` → "Needs attention", default → "Unavailable"

**Estimated complexity:** Low

#### 3.3c Replace `WorkQueueRow` table with `DataTable`

**Changes:**
- Remove `WorkQueueRow` function (lines 320-349)
- Replace hand-rolled `<table>` (lines 142-192) with `<DataTable>` from `@/components/shared/data-table`
- Define columns:
  - `Item` — label text
  - `Count` — count number
  - `Description` — description text
  - `Action` — "Resolve →" link or "No action needed"
- `rowKey` = label
- `onRowClick` = navigate to href if available

**Estimated complexity:** Medium

#### 3.3d Replace Recent Activity hand-rolled table with `DataTable`

**Changes:**
- Replace `<table>` (lines 231-256) with `<DataTable>`
- Define columns: Time, Actor, Activity, Lead
- Use `formatTimeAgo` for time column
- `rowKey` = `a.id`
- `onRowClick` = navigate to `/admin/leads?leadId=${a.leadId}`

**Estimated complexity:** Medium

#### 3.3e Replace Recent Syncs hand-rolled table with `DataTable`

**Changes:**
- Replace `<table>` (lines 262-290) with `<DataTable>`
- Define columns: Connector, Status, Records Received, Leads Added, Started
- Use `<Badge label={s.status} />` for status column
- `rowKey` = `s.id`

**Estimated complexity:** Medium

---

### 3.4 `src/app/(dashboard)/sales/page.tsx`

**Goal:** Add `requireSession("ADMIN")` guard pattern check — no changes needed here (already uses `requireSession("SALES")`).

**No changes needed.** The Sales dashboard is the reference implementation.

---

### 3.5 `src/components/sales/sales-dashboard-client.tsx`

**Goal:** Extract `PipelineCard` to shared location (optional, low priority).

**Changes (optional):**
- Extract `PipelineCard` to `src/components/shared/pipeline-card.tsx` if Admin dashboard will reuse it
- Currently only used by Sales — extraction is premature unless Admin needs it

**Estimated complexity:** Low (but may be deferred)

---

## 4. Priority Order

| Priority | Task | Rationale |
|----------|------|-----------|
| **P0** | Add Badge tones (HEALTHY, WARNING, etc.) | Prerequisite for HealthBadge replacement |
| **P0** | Add `requireSession("ADMIN")` to admin page | Security: server-side auth guard |
| **P1** | Replace Admin `KpiStat` → `KpiCard` | Highest visibility fix, most obvious inconsistency |
| **P1** | Replace Admin `InsightCard` → `KpiCard` | Eliminates largest inline component duplication |
| **P2** | Replace Admin `HealthBadge` → `Badge` | Small win, uses new tones |
| **P2** | Replace Admin `WorkQueueRow` table → `DataTable` | Consistency with Sales DataTable usage |
| **P2** | Replace Admin Recent Activity table → `DataTable` | Consistency |
| **P2** | Replace Admin Recent Syncs table → `DataTable` | Consistency |
| **P3** | Extract Sales `PipelineCard` (optional) | Only if Admin needs pipeline cards |

---

## 5. Dependencies Between Changes

```
P0: Badge tones ──────────┐
                          ├──→ P1: KpiCard replacements (Admin)
P0: requireSession ADMIN ─┘    │
                               ├──→ P2: HealthBadge → Badge
                               ├──→ P2: WorkQueueRow → DataTable
                               ├──→ P2: Recent Activity → DataTable
                               └──→ P2: Recent Syncs → DataTable
```

**Critical path:** Badge tones must land before HealthBadge replacement. All other changes are independent.

---

## 6. Risks and Gotchas

| Risk | Mitigation |
|------|------------|
| `KpiCard` requires `href` prop — Admin insight cards sometimes have conditional hrefs | Pass conditional href (undefined when count is 0); KpiCard wraps in `<Link>` so ensure href is always a string or refactor KpiCard to accept optional href |
| `DataTable` expects `rows` and `columns` — Admin work queue has no row-level data source | Create a derived `workQueueItems` array from `data.insights` + `data.pending` before passing to DataTable |
| `InsightCard` has `highlight` ring effect not on KpiCard | Add `className="ring-1 ring-[var(--color-brand)]/20"` to KpiCard when highlight is true — KpiCard passes className to Card which supports it |
| Admin page has no `requireSession` — adding it may break existing behavior | Test that middleware already blocks unauthorized access; `requireSession` adds defense-in-depth |
| `formatTimeAgo` hydration timing — Admin uses `hydrated` state pattern | Keep existing hydration pattern when moving to DataTable (pass formatted values in column render) |
| Badge tone mapping — `HealthBadge` maps status to human labels | Use `toneKey` prop on Badge to map `HEALTHY` → "Healthy" display label |

---

## 7. Estimated Complexity Per Change

| Change | Files Modified | Lines Changed | Risk | Estimate |
|--------|---------------|---------------|------|----------|
| Add Badge tones | 1 | ~10 | None | 15 min |
| Add `requireSession("ADMIN")` | 1 | ~5 | Low | 10 min |
| Replace `KpiStat` → `KpiCard` | 1 | ~20 | Low | 30 min |
| Replace `InsightCard` → `KpiCard` | 1 | ~40 | Low | 45 min |
| Replace `HealthBadge` → `Badge` | 1 | ~15 | Low | 15 min |
| Replace `WorkQueueRow` → `DataTable` | 1 | ~50 | Medium | 1 hr |
| Replace Recent Activity → `DataTable` | 1 | ~40 | Medium | 45 min |
| Replace Recent Syncs → `DataTable` | 1 | ~40 | Medium | 45 min |
| Extract `PipelineCard` (optional) | 2 | ~30 | Low | 30 min |
| **Total** | **~4 files** | **~250 lines** | | **~5 hrs** |

---

## 8. Recommended Execution Order

### Phase 1: Prerequisites (30 min)
1. Add Badge tones to `src/components/ui/badge.tsx`
2. Add `requireSession("ADMIN")` to `src/app/(dashboard)/admin/page.tsx`

### Phase 2: Admin KPI/Insight Cards (1.5 hrs)
3. Replace `KpiStat` → `KpiCard` in `admin/page.tsx`
4. Replace `InsightCard` → `KpiCard` in `admin-dashboard-client.tsx`
5. Replace `HealthBadge` → `Badge` in `admin-dashboard-client.tsx`

### Phase 3: Admin Tables (2.5 hrs)
6. Replace `WorkQueueRow` table → `DataTable` in `admin-dashboard-client.tsx`
7. Replace Recent Activity table → `DataTable` in `admin-dashboard-client.tsx`
8. Replace Recent Syncs table → `DataTable` in `admin-dashboard-client.tsx`

### Phase 4: Optional Refinements (30 min)
9. Extract `PipelineCard` if Admin needs it (defer if not)
10. Verify all Admin pages match Sales visual language

### Verification
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Admin dashboard renders identically to current (minus visual improvements)
- [ ] All links navigate correctly
- [ ] Badge tones render correctly for all statuses
- [ ] DataTable empty states work for each section
- [ ] No console errors or hydration mismatches

---

## Appendix: Component Mapping Reference

### Admin → Shared Component Migration

| Admin Inline | Shared Component | Key Differences |
|-------------|-----------------|-----------------|
| `KpiStat` | `KpiCard` | Adds `description`, `href`, hover state |
| `InsightCard` | `KpiCard` | Adds `highlight` ring → use `className` prop |
| `HealthBadge` | `Badge` | New tones: HEALTHY, WARNING, UNAVAILABLE |
| `WorkQueueRow` | `DataTable` | Columns: Item, Count, Description, Action |
| Recent Activity `<table>` | `DataTable` | Columns: Time, Actor, Activity, Lead |
| Recent Syncs `<table>` | `DataTable` | Columns: Connector, Status, Records, Leads, Started |

### Sales Components Already Using Shared Ones

| Sales Component | Shared Components Used |
|----------------|----------------------|
| `SalesDashboardClient` | `KpiCard`, `Card`, `CardEmptyState`, `Badge` |
| `AttentionCenter` | `KpiCard`, `AttentionCard` |
| `AttentionCard` | `Button`, `IconActionButton`, `Badge` |
| `TasksTableClient` | `DataTable` (if present) |
