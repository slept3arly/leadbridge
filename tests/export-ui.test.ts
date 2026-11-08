import test from "node:test";
import assert from "node:assert/strict";
import {
  beginExportDownload,
  buildExportQuery,
  createDefaultExportSelection,
  endExportDownload,
  getAvailableExportCategories,
  getContextualExportParams,
  getContextualExportParamsFromState,
  getCurrentCsvHeaders,
} from "../src/lib/export/ui";
import { getNavigation } from "../src/lib/navigation";

const now = new Date("2026-11-07T16:20:00.000Z");
const admin = { id: "admin-1", role: "ADMIN" as const };
const senior = { id: "sales-1", role: "SALES" as const, salesPrivilege: "SENIOR" as const };
const junior = { id: "junior-1", role: "SALES" as const, salesPrivilege: "JUNIOR" as const };

test("workspace category availability follows the server export policy and live registry", () => {
  assert.deepEqual(getAvailableExportCategories(admin).map(({ id }) => id), ["leads", "users", "providers", "sync-history", "reports"]);
  assert.deepEqual(getAvailableExportCategories(senior).map(({ id }) => id), ["leads"]);
  assert.deepEqual(getAvailableExportCategories(junior), []);
});

test("navigation exposes Admin exports and only gives Senior Sales an export link", () => {
  assert.ok(getNavigation("ADMIN").flatMap((group) => group.items).some((item) => item.href === "/admin/exports"));
  assert.ok(getNavigation("SALES", true).flatMap((group) => group.items).some((item) => item.href === "/sales/exports"));
  assert.ok(!getNavigation("SALES", false).flatMap((group) => group.items).some((item) => item.href === "/sales/exports"));
});

test("category reset clears prior selections and CSV headers use the shared legacy field metadata", () => {
  const beforeSwitch = { ...createDefaultExportSelection(), status: ["NEW"], search: "clinic", datePreset: "custom" as const, dateFrom: "2026-11-01", dateTo: "2026-11-07" };
  assert.deepEqual(createDefaultExportSelection(), {
    status: [], sourceIds: [], actions: [], responses: [], priorities: [], categories: [], interests: [],
    assignedUserId: "", archived: "both", search: "", datePreset: "all-time", dateFrom: "", dateTo: "",
    activityDate: "any", activityFrom: "", activityTo: "", connectorId: "",
  });
  assert.ok(beforeSwitch.status.length > 0);
  assert.deepEqual(getCurrentCsvHeaders("leads").slice(9, 12), ["Country", "Product", "Requirement"]);
  assert.deepEqual(getCurrentCsvHeaders("users"), ["Name", "Email", "Role", "Active", "Employee Code", "Designation", "Phone", "Created At"]);
  assert.deepEqual(getCurrentCsvHeaders("reports"), []);
});

test("lead filters serialize only accepted parameters and Sales cannot select another owner", () => {
  const selection = {
    ...createDefaultExportSelection(),
    status: ["NEW", "LOST", "NEW"],
    assignedUserId: "sales-2",
    search: "clinic",
  };
  const adminRequest = buildExportQuery("leads", selection, admin, now);
  assert.equal(adminRequest.ok, true);
  if (adminRequest.ok) {
    assert.equal(adminRequest.params.toString(), "type=leads&status=NEW%2CLOST&assignedUserId=sales-2&search=clinic");
    assert.ok(!adminRequest.params.has("columns"));
    assert.ok(!adminRequest.params.has("page"));
  }

  assert.deepEqual(buildExportQuery("leads", selection, senior, now), {
    ok: false,
    error: "Sales exports are limited to your assigned leads.",
  });
  assert.equal(buildExportQuery("activities", createDefaultExportSelection(), admin, now).ok, false);
});

test("advanced lead filters serialize exact table values and All Responses adds no predicate", () => {
  const advanced = buildExportQuery("leads", {
    ...createDefaultExportSelection(),
    status: ["NEW", "LOST"],
    sourceIds: ["source-1", "source-2"],
    actions: ["CALL", "WHATSAPP"],
    responses: ["PICKED_UP", "REPLIED"],
    priorities: ["HIGH", "URGENT"],
    categories: ["CLINIC", "HOSPITAL"],
    interests: ["INTERESTED", "NOT_INTERESTED"],
    archived: "archived",
    activityDate: "custom",
    activityFrom: "2026-11-01",
    activityTo: "2026-11-02",
  }, admin, now);
  assert.equal(advanced.ok, true);
  if (advanced.ok) {
    assert.equal(advanced.params.get("status"), "NEW,LOST");
    assert.equal(advanced.params.get("source"), "source-1,source-2");
    assert.equal(advanced.params.get("activityAction"), "CALL,WHATSAPP");
    assert.equal(advanced.params.get("activityResponse"), "PICKED_UP,REPLIED");
    assert.equal(advanced.params.get("priority"), "HIGH,URGENT");
    assert.equal(advanced.params.get("category"), "CLINIC,HOSPITAL");
    assert.equal(advanced.params.get("activityInterest"), "INTERESTED,NOT_INTERESTED");
    assert.equal(advanced.params.get("archived"), "true");
    assert.equal(advanced.params.get("activityDate"), "custom");
    assert.equal(advanced.params.get("activityFrom"), "2026-11-01");
    assert.equal(advanced.params.get("activityTo"), "2026-11-02");
  }

  const allResponses = buildExportQuery("leads", { ...createDefaultExportSelection(), actions: ["CALL"] }, admin, now);
  assert.equal(allResponses.ok, true);
  if (allResponses.ok) assert.equal(allResponses.params.has("activityResponse"), false);
  assert.equal(buildExportQuery("leads", { ...createDefaultExportSelection(), activityDate: "custom" }, admin, now).ok, false);
});

test("date presets use UTC calendar boundaries and custom ranges require valid inclusive dates", () => {
  const selection = { ...createDefaultExportSelection(), datePreset: "yesterday" as const };
  const yesterday = buildExportQuery("leads", selection, admin, now);
  assert.equal(yesterday.ok, true);
  if (yesterday.ok) {
    assert.equal(yesterday.params.get("from"), "2026-11-06T00:00:00.000Z");
    assert.equal(yesterday.params.get("to"), "2026-11-06T23:59:59.999Z");
  }

  const custom = buildExportQuery("reports", {
    ...createDefaultExportSelection(), datePreset: "custom", dateFrom: "2026-10-01", dateTo: "2026-10-31",
  }, admin, now);
  assert.equal(custom.ok, true);
  if (custom.ok) {
    assert.equal(custom.params.get("from"), "2026-10-01T00:00:00.000Z");
    assert.equal(custom.params.get("to"), "2026-10-31T23:59:59.999Z");
  }
  assert.equal(buildExportQuery("reports", {
    ...createDefaultExportSelection(), datePreset: "custom", dateFrom: "2026-10-01", dateTo: "",
  }, admin, now).ok, false);
  assert.equal(buildExportQuery("leads", {
    ...createDefaultExportSelection(), datePreset: "custom", dateFrom: "2026-11-08", dateTo: "2026-11-07",
  }, admin, now).ok, false);
  assert.equal(buildExportQuery("sync-history", {
    ...createDefaultExportSelection(), datePreset: "custom", dateFrom: "2026-02-30", dateTo: "2026-03-01",
  }, admin, now).ok, false);
});

test("contextual shortcuts map supported state and block filters the live route cannot represent", () => {
  const mapped = getContextualExportParams("leads", "?page=3&pageSize=25&sortBy=createdAt&search=clinic&filter.status=NEW,LOST&filter.assignedUserId=sales-1&dateFrom=2026-11-01T00%3A00%3A00.000Z&dateTo=2026-11-07T23%3A59%3A59.999Z");
  assert.deepEqual(mapped.params, {
    status: "NEW,LOST",
    assignedUserId: "sales-1",
    search: "clinic",
    from: "2026-11-01T00:00:00.000Z",
    to: "2026-11-07T23:59:59.999Z",
    archived: "false",
  });
  assert.ok(!("page" in mapped.params));
  assert.deepEqual(getContextualExportParams("leads", "?filter.assignedUserId=unassigned").params, { assignedUserId: "unassigned", archived: "false" });
  assert.deepEqual(getContextualExportParams("leads", "?filter.priority=HIGH").params, { priority: "HIGH", archived: "false" });
  assert.deepEqual(getContextualExportParams("leads", "?filter.activityDate=today&dateFrom=2026-11-01T00%3A00%3A00.000Z&dateTo=2026-11-07T23%3A59%3A59.999Z").params, { activityDate: "today", archived: "false" });
  assert.deepEqual(getContextualExportParams("leads", "?filter.activityResponse=REPLIED&filter.activityInterest=INTERESTED&filter.source=source-1&filter.archived=true").params, { source: "source-1", activityResponse: "REPLIED", activityInterest: "INTERESTED", archived: "true" });
  assert.ok(getContextualExportParams("leads", "?filter.followUp=overdue").error);
  assert.ok(getContextualExportParams("users", "?search=alex").error);
  assert.deepEqual(getContextualExportParams("users", "?page=2&pageSize=25&sortBy=name"), { params: {} });
  assert.deepEqual(getContextualExportParamsFromState("leads", {
    search: "latest typed search",
    filters: { status: "NEW", priority: "HIGH", activityDate: "custom", activityAction: "CALL" },
    dateFrom: "2026-11-01T00:00:00.000Z",
    dateTo: "2026-11-07T23:59:59.000Z",
  }), {
    params: {
      status: "NEW", priority: "HIGH", activityAction: "CALL", activityDate: "custom",
      activityFrom: "2026-11-01T00:00:00.000Z", activityTo: "2026-11-07T23:59:59.000Z", archived: "false", search: "latest typed search",
    },
  });
});

test("download guard rejects duplicate starts and can be released after initiation", () => {
  const guard = { pending: false };
  assert.equal(beginExportDownload(guard), true);
  assert.equal(beginExportDownload(guard), false);
  endExportDownload(guard);
  assert.equal(beginExportDownload(guard), true);
});
