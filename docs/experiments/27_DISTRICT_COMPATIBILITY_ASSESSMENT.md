# District Compatibility and Data Assessment

> **Status:** Phase 3 read-only data inventory, followed by Phase 4 additive compatibility implementation. The inventory remains a historical read-only snapshot; see the Phase 4 update at the end.
> **Assessment date:** 2026-11-09.
> **Database query:** Read-only against the database configured by the workspace. Connection details are intentionally omitted.
> **Decision source:** Approved Phase 2 business contract in [26_LEAD_WORKFLOW_BUSINESS_CONTRACTS.md](./26_LEAD_WORKFLOW_BUSINESS_CONTRACTS.md).

## 1. Executive summary

The current application and database have a nullable Lead.city field and no Lead.district field. A read-only inventory returned 115 leads: 94 have a non-null, non-empty city string and 21 have NULL. There are 40 distinct non-null strings. No empty or whitespace-only values were found, and no distinct strings collapse under lower(trim(value)); there are no observed casing/spacing variants to consolidate.

The values are place-name-shaped (for example, Detroit, Raleigh, Mesa, and Phoenixville), but the records have no geographic context that establishes whether each value is a city, a district, or another locality. Therefore none is approved for district backfill. Preserve every value and require a data owner to classify each value or the associated records before any backfill.

Compatibility remains additive: city-only requests continue writing city only; district-only requests write district only; equal normalized dual values are accepted; conflicting dual values return HTTP 400. Responses expose both keys. District filters query district; legacy city filters continue querying city. Connector imports keep writing city unless an explicit mapping identifies a district. CSV behavior remains unchanged.

## 2. Consumer inventory

| Area | Current city consumer | Current behavior / District implication |
|---|---|---|
| Prisma model | prisma/schema.prisma, Lead.city String? | No district field exists. |
| Migration history | prisma/migrations/20260713173452_init/migration.sql | city was introduced as nullable TEXT. Later migrations contain no city/district migration. |
| Validation | src/lib/validation.ts, leadSchema.city | Optional string, maximum 80 characters. Manual create and PATCH schemas inherit city. There is no district validation or dual-key conflict rule yet. |
| Create API | POST /api/leads → createLeadRequestSchema → leadWorkflowService → LeadService | Accepts city as an optional input. The response returns the created lead object. |
| Update API | PATCH /api/leads/[id] → manualLeadFieldsSchema.partial() → LeadService.update | An explicitly supplied city is updated; omission leaves it unchanged. |
| List API | GET /api/leads → LeadService.listPage | The list select includes city and serializes it in lead rows. Global lead search does not search city; no general CRM district filter exists today. |
| Detail APIs | GET /api/leads/[id] and GET /api/leads/[id]/details | Lead detail select includes city; details response nests the lead. |
| Manual form | src/components/leads/lead-edit-modal.tsx | Create/Edit state and payload use city; field label is City. |
| List/detail frontend | src/components/leads/admin-leads-page-content.tsx, src/components/sales/lead-info-section.tsx, src/hooks/use-lead-details.ts, src/components/sales/lead-details-modal.tsx | Types/projections pass city and View Details renders City. |
| History | src/components/sales/daily-history.tsx | Existing field-change display maps city to City. Historical metadata must not be rewritten. |
| Connector imports | src/types/lead.ts, src/runtime/parser-runtime.ts, src/runtime/lead-normalizer.ts, src/runtime/connector-runtime.ts | NormalizedLead has city; connector normalization passes it directly to LeadInput.city. Do not globally reinterpret connector city values as districts. |
| Connector mappings | prisma/schema.prisma, FieldMapping | targetField is an unrestricted string. Current connector runtime path inspected maps normalized city directly; no district-specific source mapping behavior exists. Future explicit district mappings need defined semantics and tests. |
| CSV export | src/lib/export/fields.ts, src/lib/export/legacy-contract.ts, src/lib/export/filters.ts, src/services/export/projections.ts, src/services/export/query-builders.ts, src/services/export/csv-serialization.ts | Existing field key/header/filter are city/City; query filters Lead.city and serialization exports lead.city. Keep this contract unchanged. |
| Reports | src/services/report.service.ts, src/services/dashboard.service.ts, src/components/admin/admin-reports.tsx | No city-based aggregation or report filter was found in the inspected report/dashboard paths. |
| Tests | tests/lead-creation-validation.test.ts, tests/export-delivery.test.ts, other export tests | Tests assert city compatibility and the existing City CSV header/value behavior. No district-specific behavior exists yet. |
| Canonical/experimental docs | docs/api.md, docs/backend.md, docs/database.md, docs/frontend.md and workflow/export experiment docs | Current docs describe City/city. Update canonical docs only when the additive implementation ships; preserve the historical record of existing exports. |

## 3. Database inventory

### 3.1 Aggregate counts

| Measure | Count |
|---|---:|
| Total Lead rows | 115 |
| Rows with non-null city (affected records for classification) | 94 |
| Rows with NULL city | 21 |
| Empty-string city values | 0 |
| Whitespace-only city values | 0 |
| Distinct non-null city strings | 40 |
| Distinct strings sharing the same lower(trim(value)) key | 0 groups |

The 94 non-null rows are all affected by the semantic classification question. None is automatically eligible for backfill based on this inventory alone.

### 3.2 Exact distinct-value inventory and provisional classification

The inventory preserves the exact stored spelling. Each non-null value is marked **Owner review**: its text resembles a place name, but the data does not say whether it is a city, district, or another locality. “Potential district” is not inferred from a name.

| Existing Lead.city value | Records | Assessment |
|---|---:|---|
| Detroit | 7 | Owner review; place-name-shaped, geographic level unknown |
| Indianapolis | 4 | Owner review; place-name-shaped, geographic level unknown |
| Phoenix | 4 | Owner review; place-name-shaped, geographic level unknown |
| Raleigh | 4 | Owner review; place-name-shaped, geographic level unknown |
| San Diego | 4 | Owner review; place-name-shaped, geographic level unknown |
| Tampa | 4 | Owner review; place-name-shaped, geographic level unknown |
| Las Vegas | 3 | Owner review; place-name-shaped, geographic level unknown |
| Los Angeles | 3 | Owner review; place-name-shaped, geographic level unknown |
| Louisville | 3 | Owner review; place-name-shaped, geographic level unknown |
| Memphis | 3 | Owner review; place-name-shaped, geographic level unknown |
| Oklahoma City | 3 | Owner review; place-name-shaped, geographic level unknown |
| Pittsburgh | 3 | Owner review; place-name-shaped, geographic level unknown |
| Salt Lake City | 3 | Owner review; place-name-shaped, geographic level unknown |
| Virginia Beach | 3 | Owner review; place-name-shaped, geographic level unknown |
| Boston | 2 | Owner review; place-name-shaped, geographic level unknown |
| Chicago | 2 | Owner review; place-name-shaped, geographic level unknown |
| Colorado Springs | 2 | Owner review; place-name-shaped, geographic level unknown |
| Denver | 2 | Owner review; place-name-shaped, geographic level unknown |
| Des Moines | 2 | Owner review; place-name-shaped, geographic level unknown |
| Houston | 2 | Owner review; place-name-shaped, geographic level unknown |
| Kansas City | 2 | Owner review; place-name-shaped, geographic level unknown |
| Long Beach | 2 | Owner review; place-name-shaped, geographic level unknown |
| Mesa | 2 | Owner review; place-name-shaped, geographic level unknown |
| Milwaukee | 2 | Owner review; place-name-shaped, geographic level unknown |
| Minneapolis | 2 | Owner review; place-name-shaped, geographic level unknown |
| Nashville | 2 | Owner review; place-name-shaped, geographic level unknown |
| Orlando | 2 | Owner review; place-name-shaped, geographic level unknown |
| Sacramento | 2 | Owner review; place-name-shaped, geographic level unknown |
| San Antonio | 2 | Owner review; place-name-shaped, geographic level unknown |
| San Jose | 2 | Owner review; place-name-shaped, geographic level unknown |
| St. Louis | 2 | Owner review; place-name-shaped, geographic level unknown |
| Charlotte | 1 | Owner review; place-name-shaped, geographic level unknown |
| Cincinnati | 1 | Owner review; place-name-shaped, geographic level unknown |
| Cleveland | 1 | Owner review; place-name-shaped, geographic level unknown |
| Dallas | 1 | Owner review; place-name-shaped, geographic level unknown |
| Philadelphia | 1 | Owner review; place-name-shaped, geographic level unknown |
| Phoenixville | 1 | Owner review; place-name-shaped, geographic level unknown |
| Portland | 1 | Owner review; place-name-shaped, geographic level unknown |
| San Francisco | 1 | Owner review; place-name-shaped, geographic level unknown |
| Tucson | 1 | Owner review; place-name-shaped, geographic level unknown |
| NULL | 21 | No value; no classification/backfill |

There are no repeated normalized variants to group. No two distinct values have been grouped because the observed data supplies no parent, region, postal code, country, or other evidence establishing that they refer to the same district.

## 4. Proposed classification and unapproved mapping

### 4.1 Classification status

- **Confirmed district:** none.
- **Confirmed non-district:** none, because the available records do not provide authoritative geographic context.
- **Owner review required:** all 40 distinct non-null strings, covering 94 records.
- **No value / no action:** NULL on 21 records.
- **Empty/inconsistent strings:** none observed.

This is intentionally conservative. Familiar place names do not establish the geographic meaning assigned by the person or integration that populated the field.

### 4.2 Recommended mapping artifact

Before any backfill, produce a reviewed mapping file with one row per exact existing city value, for example:

| source city exact value | record count | decision | canonical district value | reviewer / evidence |
|---|---:|---|---|---|
| Detroit | 7 | UNREVIEWED | NULL | Awaiting data owner |
| …all remaining 39 exact values… | … | UNREVIEWED | NULL | Awaiting data owner |

The proposed backfill mapping is currently **empty and unapproved**. For a confirmed district value, the eventual operation may copy that reviewed canonical value into Lead.district while retaining the original Lead.city unchanged. For a confirmed non-district or unresolved value, leave district NULL and retain city. Never map based on fuzzy name similarity or automatically normalize/collapse values.

## 5. Compatibility behavior and API impact

This section records the approved Phase 2 target as assessed in Phase 3. Its implementation status is updated in §9.

| Request/consumer | Target behavior |
|---|---|
| City-only create/update request | Write city only. Do not infer/copy district. |
| District-only create/update request | Write district only. |
| Both fields, normalized equal | Accept and persist both original supplied fields. Compare after trimming surrounding whitespace and lowercasing. |
| Both fields, conflicting | Return HTTP 400 with a field-level conflict. Never silently choose a winner. |
| API response | Expose city and district fields during compatibility, including list and detail responses. |
| Manual workflow | District is the canonical field for new manual writes; existing city remains readable/editable through legacy compatibility until deprecation is approved. |
| District filter | Query Lead.district only. |
| Legacy city filter | Continue querying Lead.city only. Do not change its semantics to search district. |
| Connector import | Continue writing Lead.city unless an explicit per-source mapping identifies the input as a district. An unspecified source mapping remains city. |
| CSV export | Preserve current City column, selection/filter contract, ordering, and serialized Lead.city values. No new District column or substituted values in this phase. |

Phase 4 implemented these rules in POST /api/leads and PATCH /api/leads/[id], along with dual-field validation, service projections, frontend response types, and GET /api/leads filtering. City-only writes retain the existing trim-and-empty-to-null behavior; District-only writes use the same normalization. Dual-field requests preserve the original supplied values after validation. The lead list accepts filter.district and queries District; export filter city continues to query City only.

## 6. Data-owner decisions required

1. Confirm which source/system and geographic convention populated city for these 94 rows.
2. Classify each exact value as district, city/municipality, other locality, mixed, or unknown. If meaning varies by record for the same string, review records individually.
3. Supply authoritative district spelling and evidence for any proposed canonical mapping. Confirm whether names are unique without state/country context.
4. Name an owner and define the legacy city API deprecation window and exit criteria.
5. Confirm that every lead response shape returns both fields; create, patch, list, and detail responses do. CSV remains a separate unchanged contract.
6. Define how a future explicit connector mapping will declare “district” and how to handle an existing mapping targeting city.

## 7. Risks, prerequisites, and rollback

### Risks and prerequisites

- **Semantic misclassification:** blindly copying all 94 populated city values would re-label locality data as districts without evidence.
- **Incomplete compatibility:** adding District only to the form while list/detail/API projections remain city-only would lose or hide data.
- **Dual-write ambiguity:** allowing unequal city and district silently creates two competing location values. Reject such payloads.
- **Search/filter drift:** the current global lead search does not search city; export has a distinct city filter. New district filtering must be explicit and must not broaden legacy city filtering.
- **Connector data loss/mislabeling:** parser-normalized city maps directly to Lead.city. Global field renaming would change imported data meaning.
- **Export breakage:** changing export headers or selecting district in place of city breaks the established CSV contract.
- **Migration race:** inventory counts can change between assessment and migration. Repeat the exact-value/count query against the target immediately before any approved backfill.
- **PII/business data handling:** the list of values is business data; keep the report within repository documentation access controls.

Prerequisites: approved District definition, owner-classified mapping, compatibility API tests, list/detail projection coverage, filter behavior tests, explicit connector mapping semantics, and a migration plan that retains the original city column.

### Rollback considerations

The safest first rollout is additive: nullable district column, city retained, and no unreviewed backfill. If application code must roll back, it can stop writing/reading district while city data remains intact. Do not drop district after writes without an export/backup and a reviewed reconciliation of district-only values. Do not reverse-copy district to city automatically; the fields can legitimately differ under the compatibility contract. CSV rollback is unnecessary because export behavior remains unchanged.

## 8. Verification and phase boundary

- Database inventory was performed with SELECT queries only.
- No Prisma schema or migration was edited or applied.
- No database row was inserted, updated, or deleted.
- No application compatibility behavior was implemented in this phase.
- No enum or label was changed as part of this phase.

## 9. Phase 4 implementation update

The backend compatibility contract has since been implemented additively. Lead.district is nullable, city remains present, request validation compares supplied dual values using surrounding-whitespace trimming and case-insensitive comparison, and accepted dual inputs preserve their original strings. City-only and District-only requests affect only the supplied field. Create, patch, list, and detail responses expose both fields. The lead list supports filter.district; the existing export city filter and CSV contract remain unchanged. Connector import code still maps normalized city to Lead.city. The manual form now writes District and retains an explicit legacy City field.

No historical city values were backfilled or modified. The Phase 3 value inventory above is not a current live count guarantee; rerun it against the intended deployment database before any future data migration. The Phase 4 schema migration is additive and remains unapplied pending the deployment owner's approval of the target database.

### Phase 6B migration preflight (2026-11-09)

The configured database was identified as Neon PostgreSQL at the workspace-configured endpoint, database `neondb`, schema `public`; the hostname identifies a Neon endpoint, while the branch name was not available through SQL connection metadata. `prisma migrate status` reported 19 migrations and both `20261109090000_add_lead_district` and `20261109100000_followup_one_pending_per_lead` unapplied. Read-only checks found 115 leads, 94 non-null city values, and no `Lead.district` column. The migration SQL contains no data backfill; city was not modified. The migration preflight found zero pending-follow-up conflicts, eight FollowUp rows, 14 activity-entry links, no `FollowUp.cancelledAt`, and no `FollowUp_one_pending_per_lead` index. No migration was applied. Neon supports recovery branches/PITR, but this environment has no Neon control-plane credentials or CLI; no recovery point could be created or verified, so deployment stopped before migration execution. PostgreSQL concurrency behavior remains unverified.
