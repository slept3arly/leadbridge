import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createLeadRequestSchema, manualLeadPatchSchema } from "../src/lib/validation";
import { parseListQuery } from "../src/lib/query-builder";
import { leadExportFiltersSchema } from "../src/lib/export/filters";
import { buildLeadExportWhere } from "../src/services/export/query-builders";

const initialActivity = { action: "CALL", response: "PICKED_UP", interest: "INTERESTED" };
const manualCreate = (location: Record<string, unknown>) => createLeadRequestSchema.safeParse({
  name: "District compatibility",
  phone: "1234567890",
  initialActivity,
  ...location,
});

test("city-only and district-only create requests write only their supplied field", () => {
  const city = manualCreate({ city: "  Old City  " });
  assert.equal(city.success, true);
  if (city.success) {
    assert.equal(city.data.city, "Old City");
    assert.equal("district" in city.data, false);
  }

  const district = manualCreate({ district: "  New District  " });
  assert.equal(district.success, true);
  if (district.success) {
    assert.equal(district.data.district, "New District");
    assert.equal("city" in district.data, false);
  }
});

test("Create Lead keeps District and legacy City as independent inputs without mirroring", () => {
  const modal = readFileSync("src/components/leads/lead-edit-modal.tsx", "utf8");
  assert.match(modal, /if \(city\) payload\.city = city;[\s\S]*if \(district\) payload\.district = district/);
  assert.doesNotMatch(modal, /setCity\(district\)|setDistrict\(city\)|payload\.city = district|payload\.district = city/);
  assert.match(modal, /label="District" htmlFor="lead-district"/);
  assert.match(modal, /label="City" htmlFor="lead-city"/);
  assert.match(modal, /const createLeadInformationFields[\s\S]*label="City" htmlFor="lead-city"[\s\S]*label="District" htmlFor="lead-district"/);
});

test("city and district accept different, identical, and individually normalized values", () => {
  const parsed = manualCreate({ city: "  North City ", district: "south district  " });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.city, "North City");
    assert.equal(parsed.data.district, "south district");
  }
  const identical = manualCreate({ city: " North City ", district: " North City " });
  assert.equal(identical.success, true);
  if (identical.success) {
    assert.equal(identical.data.city, "North City");
    assert.equal(identical.data.district, "North City");
  }

  const update = manualLeadPatchSchema.safeParse({ city: "  West Ward ", district: "west ward" });
  assert.equal(update.success, true);
  if (update.success) {
    assert.equal(update.data.city, "West Ward");
    assert.equal(update.data.district, "west ward");
  }
  const updateDifferent = manualLeadPatchSchema.safeParse({ city: "West City", district: "East Ward" });
  assert.equal(updateDifferent.success, true);
});

test("city-only and district-only updates work and omitted location fields remain untouched", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/leadbridge_unit_test";
  try {
    const { LeadService } = await import("../src/services/lead.service");
    const service = new LeadService();
    const base = {
      id: "district-test-lead",
      updatedAt: new Date("2026-10-01T00:00:00.000Z"),
      isDeleted: false,
      city: "Legacy City",
      district: null as string | null,
    };

    for (const [patchValue, expectedField, expectedValue, otherField, otherValue] of [
      [{ city: "  Replacement City " }, "city", "Replacement City", "district", "Existing District"],
      [{ district: "  Central District " }, "district", "Central District", "city", "Existing City"],
    ] as const) {
      const patch = manualLeadPatchSchema.safeParse(patchValue);
      assert.equal(patch.success, true);
      if (!patch.success) continue;
      const initial = { ...base, [otherField]: otherValue };
      let stored = { ...initial };
      let write: Record<string, unknown> | undefined;
      const tx = {
        lead: {
          updateMany: async ({ data }: { data: Record<string, unknown> }) => {
            write = data;
            stored = { ...stored, ...data };
            return { count: 1 };
          },
          findUniqueOrThrow: async () => stored,
        },
      };
      await service.updateFieldsInTransaction(tx as never, initial as never, patch.data, "actor-1");
      assert.equal(write?.[expectedField], expectedValue);
      assert.equal(stored[otherField], otherValue);
      assert.equal("district" in (write ?? {}) && expectedField !== "district", false);
      assert.equal("city" in (write ?? {}) && expectedField !== "city", false);
    }

    const omitted = manualLeadPatchSchema.parse({ company: "Updated company" });
    assert.equal("city" in omitted, false);
    assert.equal("district" in omitted, false);

    const existing = { ...base, city: "Kept City", district: "Kept District" };
    let stored = { ...existing };
    let write: Record<string, unknown> | undefined;
    const tx = {
      lead: {
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          write = data;
          stored = { ...stored, ...data };
          return { count: 1 };
        },
        findUniqueOrThrow: async () => stored,
      },
    };
    await service.updateFieldsInTransaction(tx as never, existing as never, omitted, "actor-1");
    assert.equal("city" in (write ?? {}), false);
    assert.equal("district" in (write ?? {}), false);
    assert.equal(stored.city, "Kept City");
    assert.equal(stored.district, "Kept District");
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("list/detail/create/update response projections expose both fields", () => {
  const service = readFileSync("src/services/lead.service.ts", "utf8");
  const listPage = readFileSync("src/app/(dashboard)/admin/leads/page.tsx", "utf8");
  const detailsRoute = readFileSync("src/app/api/leads/[id]/details/route.ts", "utf8");
  const createRoute = readFileSync("src/app/api/leads/route.ts", "utf8");
  const updateRoute = readFileSync("src/app/api/leads/[id]/route.ts", "utf8");
  assert.match(createRoute, /createLeadRequestSchema\.safeParse/);
  assert.match(createRoute, /parsed\.error\.flatten\(\)/);
  assert.match(updateRoute, /manualLeadPatchSchema\.safeParse/);
  assert.match(updateRoute, /parsed\.error\.flatten\(\)/);
  assert.match(service, /city: true, district: true/);
  assert.match(listPage, /city: l\.city,[\s\S]*district: l\.district/);
  assert.match(detailsRoute, /leadService\.getById\(id, session\.user\)/);
  assert.match(createRoute, /result\.lead/);
  assert.match(updateRoute, /result\.lead/);
});

test("district list filtering is explicit and legacy city export filtering stays on city", () => {
  const query = parseListQuery(new URLSearchParams("filter.district=North%20Ward&filter.city=Legacy%20City"));
  assert.deepEqual(query.filters.district, ["North Ward"]);
  assert.deepEqual(query.filters.city, ["Legacy City"]);
  const leadServiceSource = readFileSync("src/services/lead.service.ts", "utf8");
  const exportBuilder = readFileSync("src/services/export/query-builders.ts", "utf8");
  assert.match(leadServiceSource, /query\.filters\.district\.map\(\(value\) => \(\{ district:/);
  assert.doesNotMatch(leadServiceSource, /query\.filters\.city/);
  assert.match(exportBuilder, /if \(filters\.city\) clauses\.push\(\{ city:/);
  const exportWhere = buildLeadExportWhere(leadExportFiltersSchema.parse({ city: "Legacy City" }), { id: "admin", role: "ADMIN" });
  const exportWhereText = JSON.stringify(exportWhere);
  assert.match(exportWhereText, /"city":\{"contains":"Legacy City"/);
  assert.doesNotMatch(exportWhereText, /"district"/);
});

test("connector imports keep city and CSV export contract remains unchanged", () => {
  const connector = readFileSync("src/runtime/connector-runtime.ts", "utf8");
  const exportBuilder = readFileSync("src/services/export/query-builders.ts", "utf8");
  const serializer = readFileSync("src/services/export/csv-serialization.ts", "utf8");
  const header = serializer.match(/leads: \[[^\]]+\]/)?.[0] ?? "";
  assert.match(connector, /city: lead\.city \?\? null/);
  assert.doesNotMatch(connector, /district:/);
  assert.match(exportBuilder, /if \(filters\.city\) clauses\.push\(\{ city:/);
  assert.match(serializer, /lead\.city, lead\.state, lead\.country/);
  assert.match(header, /"City"/);
  assert.doesNotMatch(header, /"District"/);
});
