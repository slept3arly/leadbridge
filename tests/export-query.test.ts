import test from "node:test";
import assert from "node:assert/strict";
import { leadExportFiltersSchema, providerExportFiltersSchema, syncHistoryExportFiltersSchema, userExportFiltersSchema } from "../src/lib/export/filters";
import { resolveExportDateRange } from "../src/lib/export/dates";
import { resolveLeadProjection, resolveSyncHistoryProjection, resolveUserProjection } from "../src/services/export/projections";
import {
  buildLeadExportWhere,
  buildLeadExportCursorWhere,
  buildLeadOrderBy,
  buildProviderExportWhere,
  buildProviderExportCursorWhere,
  buildProviderOrderBy,
  buildSyncHistoryExportWhere,
  buildSyncHistoryExportCursorWhere,
  buildSyncHistoryOrderBy,
  buildUserExportWhere,
  buildUserExportCursorWhere,
  buildUserOrderBy,
} from "../src/services/export/query-builders";
import { buildExportLeadScope } from "../src/services/export/scope";
import { authorizeExportCategory, authorizeLeadExportFilters } from "../src/services/export/authorization";
import { ServiceError } from "../src/lib/service-errors";
import { parseLegacyLeadExport, parseLegacyReportExport, parseLegacySyncExport } from "../src/lib/export/legacy-compatibility";
import { iterateKeysetPages } from "../src/services/export/keyset";
import { andLeadWhere, buildReportLeadWhere } from "../src/services/export/query-builders";

const senior = { id: "sales-self", role: "SALES", salesPrivilege: "SENIOR" } as const;
const admin = { id: "admin", role: "ADMIN" } as const;
const junior = { id: "sales-junior", role: "SALES", salesPrivilege: "JUNIOR" } as const;

function encoded(where: object): string {
  return JSON.stringify(where);
}

test("server export authorization permits only category policy and rejects planned categories", () => {
  assert.doesNotThrow(() => authorizeExportCategory(admin, "users"));
  assert.doesNotThrow(() => authorizeExportCategory(senior, "leads"));
  assert.throws(() => authorizeExportCategory(junior, "leads"), (error) => error instanceof ServiceError && error.status === 403);
  assert.throws(() => authorizeExportCategory(senior, "users"), (error) => error instanceof ServiceError && error.status === 403);
  assert.throws(() => authorizeExportCategory(admin, "activities"), (error) => error instanceof ServiceError && error.status === 404);
});

test("lead scope is server-owned and cannot be widened with client assignees", () => {
  assert.deepEqual(buildExportLeadScope(senior), { assignedUserId: "sales-self", isDeleted: false });
  assert.deepEqual(buildExportLeadScope(admin), { isDeleted: false });
  const filters = leadExportFiltersSchema.parse({ assignedUserIds: ["another-salesperson", "unassigned"], archived: "both" });
  const where = buildLeadExportWhere(filters, senior);
  assert.match(encoded(where), /"assignedUserId":"sales-self"/);
  assert.match(encoded(where), /"isDeleted":false/);
  assert.match(encoded(where), /"in":\["another-salesperson","unassigned"\]/);
  assert.match(encoded(where), /"AND":\[/, "mandatory scope remains an independent AND clause");
});

test("lead filters combine groups with AND, values with OR, search with OR, and dates use exclusive upper bound", () => {
  const filters = leadExportFiltersSchema.parse({
    status: ["NEW", "LOST"], priority: ["HIGH", "LOW"], archived: "archived", search: "acme",
    dateField: "lastContactedAt", dateRange: { preset: "custom", custom: { from: "2026-03-01", to: "2026-03-02" } },
  });
  const where = buildLeadExportWhere(filters, admin);
  const whereJson = encoded(where);
  assert.match(whereJson, /"status":\{"in":\["NEW","LOST"\]\}/);
  assert.match(whereJson, /"priority":\{"in":\["HIGH","LOW"\]\}/);
  assert.match(whereJson, /"isArchived":true/);
  assert.match(whereJson, /"lastContactedAt":\{"gte":"2026-03-01T00:00:00.000Z","lt":"2026-03-03T00:00:00.000Z"\}/);
  assert.match(whereJson, /"OR":\[.*"displayName".*"leadNumber"/);
  assert.equal(where.AND && (Array.isArray(where.AND) ? where.AND.length : 1), 6);
});

test("user and provider builders preserve explicit inactive-state filters", () => {
  const userWhere = buildUserExportWhere(userExportFiltersSchema.parse({ active: false, banned: true, search: "lee" }));
  const userJson = encoded(userWhere);
  assert.match(userJson, /"isDeleted":false/);
  assert.match(userJson, /"active":false/);
  assert.match(userJson, /"banned":true/);

  const noState = buildProviderExportWhere(providerExportFiltersSchema.parse({}));
  assert.deepEqual(noState, {});
  const inactive = buildProviderExportWhere(providerExportFiltersSchema.parse({ active: false, search: "partner" }));
  assert.match(encoded(inactive), /"active":false/);
  assert.match(encoded(inactive), /"OR":\[.*"name".*"slug"/);
});

test("sync-history filters use safe predicates without selecting diagnostic content", () => {
  const filters = syncHistoryExportFiltersSchema.parse({ statuses: ["ERROR"], errorOutcome: "with-error" });
  const where = buildSyncHistoryExportWhere(filters);
  assert.match(encoded(where), /"status":"ERROR"/);
  const projection = resolveSyncHistoryProjection();
  assert.equal("errorMessage" in projection.select, false);
  assert.equal("metadata" in projection.select, false);
  assert.equal("configuration" in projection.select, false);
  assert.ok(projection.columns.includes("recordsSkipped"));
});

test("field projection validates selections and preserves registry order", () => {
  assert.deepEqual(resolveLeadProjection(["product", "name"]).columns, ["name", "product"]);
  assert.deepEqual(resolveUserProjection(["createdAt", "name"]).columns, ["name", "createdAt"]);
  assert.throws(() => resolveLeadProjection(["rawPayload"]), /Unsupported export column/);
  assert.throws(() => resolveLeadProjection([]), /At least one export column/);
  assert.equal("password" in resolveUserProjection().select, false);
  assert.equal("credential" in resolveUserProjection().select, false);
});

test("keyset cursors include a unique tie-break and avoid offset pagination", () => {
  assert.deepEqual(buildLeadOrderBy(), [{ createdAt: "desc" }, { id: "desc" }]);
  assert.deepEqual(buildUserOrderBy(), [{ id: "asc" }]);
  assert.deepEqual(buildProviderOrderBy(), [{ id: "asc" }]);
  assert.deepEqual(buildSyncHistoryOrderBy(), [{ startedAt: "desc" }, { id: "desc" }]);
  const leadCursor = buildLeadExportCursorWhere({ isDeleted: false }, { createdAt: new Date("2026-01-01T00:00:00Z"), id: "lead-1" });
  assert.match(encoded(leadCursor), /"createdAt":\{"lt":"2026-01-01T00:00:00.000Z"\}/);
  assert.match(encoded(leadCursor), /"id":\{"lt":"lead-1"\}/);
  assert.match(encoded(buildUserExportCursorWhere({}, "user-1")), /"id":\{"gt":"user-1"\}/);
  assert.match(encoded(buildProviderExportCursorWhere({}, "provider-1")), /"id":\{"gt":"provider-1"\}/);
  assert.match(encoded(buildSyncHistoryExportCursorWhere({}, { startedAt: new Date("2026-01-01T00:00:00Z"), id: "run-1" })), /"id":\{"lt":"run-1"\}/);
});

test("keyset traversal does not duplicate prior rows and remains bounded as rows change", async () => {
  const records = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const iterator = iterateKeysetPages({
    count: 3,
    batchSize: 2,
    cursorFor: (row) => row.id,
    fetchPage: async (cursor: string | undefined, take: number) => records.filter((row) => !cursor || row.id > cursor).sort((a, b) => a.id.localeCompare(b.id)).slice(0, take),
  });
  assert.deepEqual(await iterator.next(), { value: { id: "a" }, done: false });
  assert.deepEqual(await iterator.next(), { value: { id: "b" }, done: false });
  records.splice(2, 1, { id: "d" });
  assert.deepEqual(await iterator.next(), { value: { id: "d" }, done: false });
  assert.deepEqual(await iterator.next(), { value: undefined, done: true });
});

test("UTC preset and invalid filter contracts retain strict validation", () => {
  const range = resolveExportDateRange({ preset: "yesterday" }, new Date("2026-11-07T18:00:00.000Z"));
  assert.equal(range.from?.toISOString(), "2026-11-06T00:00:00.000Z");
  assert.equal(range.toExclusive?.toISOString(), "2026-11-07T00:00:00.000Z");
  assert.equal(leadExportFiltersSchema.safeParse({ dateField: "updatedAt" }).success, false);
  assert.equal(leadExportFiltersSchema.safeParse({ extra: "ignored?" }).success, false);
  assert.equal(syncHistoryExportFiltersSchema.safeParse({ statuses: ["not-a-status"] }).success, false);
});

test("legacy adapter preserves inclusive timestamp bounds and rejects invalid report ranges", () => {
  const lead = parseLegacyLeadExport(new URLSearchParams("from=2026-03-01T00%3A00%3A00.000Z&to=2026-03-01T23%3A59%3A59.999Z&assignedUserId=someone-else"));
  assert.equal(lead.bounds?.from?.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(lead.bounds?.toExclusive?.toISOString(), "2026-03-02T00:00:00.000Z");
  assert.deepEqual(lead.filters.assignedUserIds, ["someone-else"]);
  assert.throws(() => parseLegacyReportExport(new URLSearchParams("from=2026-03-01")), (error) => error instanceof ServiceError && error.status === 400);
  assert.throws(() => parseLegacySyncExport(new URLSearchParams("from=garbage")), (error) => error instanceof ServiceError && error.status === 400);
});

test("report aggregate constraints preserve selected source and owner filters", () => {
  const filters = { dateField: "createdAt" as const, sourceIds: ["source-1"], ownerIds: ["owner-1"] };
  const filteredWhere = buildReportLeadWhere(filters);
  const serializedSources = JSON.stringify(andLeadWhere(filteredWhere, { sourceId: { not: null } }));
  assert.match(serializedSources, /"sourceId":\{"in":\["source-1"\]\}/);
  assert.match(serializedSources, /"sourceId":\{"not":null\}/);

  const serializedAssignments = JSON.stringify(andLeadWhere(filteredWhere, { assignedUserId: { not: null } }));
  assert.match(serializedAssignments, /"assignedUserId":\{"in":\["owner-1"\]\}/);
  assert.match(serializedAssignments, /"assignedUserId":\{"not":null\}/);
  const unassigned = JSON.stringify(andLeadWhere(filteredWhere, { assignedUserId: null }));
  assert.match(unassigned, /"assignedUserId":\{"in":\["owner-1"\]\}/);
  assert.match(unassigned, /"assignedUserId":null/);
});

test("lead export applies advanced classifications, source, archive, and assignee filters", () => {
  const filters = leadExportFiltersSchema.parse({
    status: ["NEW", "LOST", "NEW"],
    priority: ["HIGH", "URGENT"],
    category: ["CLINIC", "HOSPITAL"],
    sourceIds: ["source-a", "source-b"],
    assignedUserIds: ["sales-a"],
    archived: "active",
  });
  const where = JSON.stringify(buildLeadExportWhere(filters, admin));
  assert.match(where, /"status":\{"in":\["NEW","LOST"\]\}/);
  assert.match(where, /"priority":\{"in":\["HIGH","URGENT"\]\}/);
  assert.match(where, /"category":\{"in":\["CLINIC","HOSPITAL"\]\}/);
  assert.match(where, /"sourceId":\{"in":\["source-a","source-b"\]\}/);
  assert.match(where, /"assignedUserId":\{"in":\["sales-a"\]\}/);
  assert.match(where, /"isArchived":false/);

  const unassigned = JSON.stringify(buildLeadExportWhere(leadExportFiltersSchema.parse({ assignedUnassigned: true }), admin));
  assert.match(unassigned, /"assignedUserId":null/);
  assert.equal(leadExportFiltersSchema.safeParse({ assignedUnassigned: true, assignedUserIds: ["sales-a"] }).success, false);
  assert.throws(
    () => authorizeLeadExportFilters(senior, leadExportFiltersSchema.parse({ assignedUserIds: ["sales-other"] })),
    (error) => error instanceof ServiceError && error.status === 403,
  );

  const salesWhere = JSON.stringify(buildLeadExportWhere(leadExportFiltersSchema.parse({ assignedUserIds: ["sales-other"] }), senior));
  assert.match(salesWhere, /"assignedUserId":"sales-self"/);
  assert.match(salesWhere, /"assignedUserId":\{"in":\["sales-other"\]\}/);
  assert.match(salesWhere, /"isDeleted":false/);
});

test("activity action, response, interest, and occurredAt filters share one related event entry", () => {
  const filters = leadExportFiltersSchema.parse({
    dateRange: { preset: "custom", custom: { from: "2026-03-01", to: "2026-03-02" } },
    activityDate: "custom",
    activityFrom: "2026-03-04",
    activityTo: "2026-03-05",
    actions: ["CALL", "WHATSAPP", "CALL"],
    responses: ["PICKED_UP", "REPLIED", "PICKED_UP"],
    interests: ["INTERESTED"],
  });
  const where = buildLeadExportWhere(filters, admin);
  const json = JSON.stringify(where);
  assert.match(json, /"createdAt":\{"gte":"2026-03-01T00:00:00.000Z","lt":"2026-03-03T00:00:00.000Z"\}/);
  assert.match(json, /"activityEvents":\{"some":\{"occurredAt":\{"gte":"2026-03-04T00:00:00.000Z","lt":"2026-03-06T00:00:00.000Z"\}/);
  assert.match(json, /"entries":\{"some":\{"type":\{"in":\["CALL","WHATSAPP"\]\},"action":\{"in":\["CALL","WHATSAPP"\]\},"response":\{"in":\["PICKED_UP","REPLIED"\]\},"interest":\{"in":\["INTERESTED"\]\}\}\}\}\}/);
  assert.equal((where.AND as unknown[]).filter((clause) => JSON.stringify(clause).includes("activityEvents")).length, 1);
});

test("activity presets use UTC event occurrence boundaries and absent response means all responses", () => {
  const today = buildLeadExportWhere(leadExportFiltersSchema.parse({ activityDate: "today", actions: ["CALL"] }), admin);
  const todayJson = JSON.stringify(today);
  const start = new Date();
  const utcStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())).toISOString();
  const tomorrow = new Date(Date.parse(utcStart) + 86400000).toISOString();
  assert.match(todayJson, new RegExp(`"occurredAt":\\{\\"gte\\":\\"${utcStart}\\",\\"lt\\":\\"${tomorrow}\\"`));
  assert.doesNotMatch(todayJson, /"response"/);

  const noActivity = buildLeadExportWhere(leadExportFiltersSchema.parse({}), admin);
  assert.doesNotMatch(JSON.stringify(noActivity), /"activityEvents"/);
  assert.equal(leadExportFiltersSchema.safeParse({ activityDate: "custom" }).success, false);
  assert.equal(leadExportFiltersSchema.safeParse({ activityFrom: "2026-01-01" }).success, false);
  assert.equal(leadExportFiltersSchema.safeParse({ activityDate: "yesterday", activityTo: "2026-01-02" }).success, false);
});

test("legacy Lead adapter accepts exact domain filters and rejects invalid or malformed values", () => {
  const parsed = parseLegacyLeadExport(new URLSearchParams(
    "status=NEW%2CLOST%2CNEW&priority=HIGH%2CURGENT&category=CLINIC&source=source-1%2Csource-2&activityDate=custom&activityFrom=2026-01-01&activityTo=2026-01-01&activityAction=CALL%2CWHATSAPP&activityResponse=PICKED_UP%2CREPLIED&activityInterest=INTERESTED&archived=false&assignedUserId=unassigned",
  ));
  assert.deepEqual(parsed.filters.status, ["NEW", "LOST"]);
  assert.deepEqual(parsed.filters.actions, ["CALL", "WHATSAPP"]);
  assert.deepEqual(parsed.filters.responses, ["PICKED_UP", "REPLIED"]);
  assert.deepEqual(parsed.filters.interests, ["INTERESTED"]);
  assert.equal(parsed.filters.archived, "active");
  assert.equal(parsed.filters.assignedUnassigned, true);
  assert.deepEqual(parsed.filters.sourceIds, ["source-1", "source-2"]);
  assert.equal(parsed.filters.activityFrom, "2026-01-01");
  assert.equal(parsed.filters.activityTo, "2026-01-01");

  assert.throws(() => parseLegacyLeadExport(new URLSearchParams("activityAction=FAX")));
  assert.throws(() => parseLegacyLeadExport(new URLSearchParams("activityResponse=NO_RESPONSE,,REPLIED")), (error) => error instanceof ServiceError && error.status === 400);
  assert.throws(() => parseLegacyLeadExport(new URLSearchParams("activityDate=custom")));
  assert.throws(() => parseLegacyLeadExport(new URLSearchParams("activityDate=today&activityTo=2026-01-01")));
});
