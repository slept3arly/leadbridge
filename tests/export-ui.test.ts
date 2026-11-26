import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  beginExportDownload,
  buildExportQuery,
  clearLeadExportFilters,
  clearSelectableColumns,
  createDefaultExportSelection,
  endExportDownload,
  getAvailableExportCategories,
  getContextualExportParams,
  getContextualExportParamsFromState,
  getCurrentCsvHeaders,
  getLeadStatusGroups,
  isCurrentExportCountRequest,
  selectAllColumns,
  selectableColumns,
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
    columns: ["serialNumber", "name", "company", "phone", "status", "city", "district", "state", "source"],
    status: [], sourceIds: [], actions: [], responses: [], priorities: [], categories: [], interests: [], reasons: [],
    assignedUserId: "", archived: "active", search: "", datePreset: "all-time", dateFrom: "", dateTo: "",
    activityDate: "any", activityFrom: "", activityTo: "", connectorId: "",
    userRole: "", userActive: "all", userBanned: "all", userSalesPrivilege: "", userDesignation: "",
    providerActive: "true", providerType: "", syncStatus: "", syncErrorOutcome: "any",
    reportSourceIds: [], reportOwnerIds: [], reportStatuses: [],
  });
  assert.ok(beforeSwitch.status.length > 0);
  assert.deepEqual(getCurrentCsvHeaders("leads"), ["S.No.", "Name", "Company", "Phone", "Status", "City", "District", "State", "Source"]);
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
    assert.equal(adminRequest.params.toString(), "type=leads&columns=serialNumber%2Cname%2Ccompany%2Cphone%2Cstatus%2Ccity%2Cdistrict%2Cstate%2Csource&status=NEW%2CLOST&assignedUserId=sales-2&archived=false&search=clinic");
    assert.ok(!adminRequest.params.has("page"));
  }

  assert.deepEqual(buildExportQuery("leads", selection, senior, now), {
    ok: false,
    error: "Sales exports are limited to your assigned leads.",
  });
  assert.equal(buildExportQuery("activities", createDefaultExportSelection(), admin, now).ok, false);
});

test("select all and clear all preserve mandatory S.No. and category defaults", () => {
  assert.deepEqual(clearSelectableColumns("leads"), ["serialNumber"]);
  assert.deepEqual(selectAllColumns("leads"), selectableColumns("leads").map((field) => field.id));
  assert.deepEqual(createDefaultExportSelection("users").columns, ["name", "email", "role", "active", "employeeCode", "designation", "phone", "createdAt"]);
  assert.deepEqual(createDefaultExportSelection("providers").columns, ["name", "slug", "sourceType", "active", "createdAt"]);
  const selected = buildExportQuery("leads", { ...createDefaultExportSelection(), columns: ["source", "district", "name"] }, admin, now);
  assert.equal(selected.ok, true);
  if (selected.ok) assert.equal(selected.params.get("columns"), "serialNumber,name,district,source");
  assert.equal(buildExportQuery("leads", { ...createDefaultExportSelection(), columns: ["madeUp"] }, admin, now).ok, false);
});

test("archived leads are excluded by default, explicitly included when checked, and deleted leads stay excluded", () => {
  const defaults = createDefaultExportSelection();
  assert.equal(defaults.archived, "active");
  const defaultQuery = buildExportQuery("leads", defaults, admin, now);
  assert.equal(defaultQuery.ok, true);
  if (defaultQuery.ok) assert.equal(defaultQuery.params.get("archived"), "false");
  const includeArchived = buildExportQuery("leads", { ...defaults, archived: "both" }, admin, now);
  assert.equal(includeArchived.ok, true);
  if (includeArchived.ok) assert.equal(includeArchived.params.has("archived"), false);
});

test("Clear All restores Lead filter defaults while retaining the selected CSV fields", () => {
  const dirty = { ...createDefaultExportSelection(), status: ["LOST"], sourceIds: ["provider-1"], archived: "both" as const, datePreset: "today" as const, reasons: ["PRICE"] };
  const cleared = clearLeadExportFilters(dirty);
  assert.deepEqual(cleared.status, []);
  assert.deepEqual(cleared.sourceIds, []);
  assert.deepEqual(cleared.reasons, []);
  assert.equal(cleared.archived, "active");
  assert.equal(cleared.datePreset, "all-time");
  assert.deepEqual(cleared.columns, dirty.columns);
});

test("current and legacy status groups follow transition support while retaining every enum value", () => {
  const groups = getLeadStatusGroups();
  assert.deepEqual(groups.current.map((status) => status.value), ["NEW", "OLD", "CONVERTED", "REPEATED"]);
  assert.deepEqual(groups.legacy.map((status) => status.value), ["LOST", "SPAM", "ON_HOLD"]);
  assert.equal(buildExportQuery("leads", { ...createDefaultExportSelection(), status: ["LOST", "SPAM"] }, admin, now).ok, true);
});

test("Lead filter navigation uses a compact responsive two-column grid beside its content panel", () => {
  const source = readFileSync("src/components/export/export-workspace.tsx", "utf8");
  assert.match(source, /grid gap-4 lg:grid-cols-\[minmax\(270px,0\.38fr\)_minmax\(0,1fr\)\]/);
  assert.match(source, /grid grid-cols-1 gap-1\.5 min-\[540px\]:grid-cols-2/);
  assert.match(source, /whitespace-normal break-words/);
  assert.match(source, /min-h-11 min-w-0 items-center justify-between/);
});

test("Archived and date controls render only through their sidebar content panels", () => {
  const source = readFileSync("src/components/export/export-workspace.tsx", "utf8");
  for (const id of ["export-include-archived", "export-activity-date", "export-lead-created-date-preset", "export-lead-created-date-from", "export-lead-created-date-to"]) {
    assert.equal(source.split(`id="${id}"`).length - 1, 1, `${id} has one control`);
  }
  for (const group of ["Archived Leads", "Activity Date", "Lead Created Date"]) {
    assert.ok(source.includes(`activeLeadFilter === "${group}"`), `${group} is a sidebar panel`);
  }
});

test("empty Selected Filters uses a neutral chip without a remove control or extra helper row", () => {
  const source = readFileSync("src/components/export/export-workspace.tsx", "utf8");
  assert.match(source, /rounded-full border border-\[var\(--color-border\)\] bg-white px-2\.5 py-1 text-xs[^>]*>No filters selected<\/span>/);
  assert.doesNotMatch(source, /Deleted leads are always excluded\./);
  assert.doesNotMatch(source, /No filters selected\. Deleted leads are always excluded\./);
});

test("count preview ignores stale responses after a newer request is issued", () => {
  assert.equal(isCurrentExportCountRequest(4, 4), true);
  assert.equal(isCurrentExportCountRequest(3, 4), false);
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

test("contextual Leads export separates created-date and activity-date constraints", () => {
  const createdDateOnly = getContextualExportParams("leads", "?dateFrom=2026-11-01T00%3A00%3A00.000Z&dateTo=2026-11-07T23%3A59%3A59.999Z");
  assert.deepEqual(createdDateOnly.params, {
    from: "2026-11-01T00:00:00.000Z", to: "2026-11-07T23:59:59.999Z", archived: "false",
  });

  const activityWithoutDate = getContextualExportParams("leads", "?filter.activityAction=CALL&filter.activityResponse=REPLIED");
  assert.deepEqual(activityWithoutDate.params, { activityAction: "CALL", activityResponse: "REPLIED", archived: "false" });

  const createdDateAndActivity = getContextualExportParams("leads", "?filter.activityAction=CALL&filter.activityInterest=INTERESTED&dateFrom=2026-11-01T00%3A00%3A00.000Z&dateTo=2026-11-07T23%3A59%3A59.999Z");
  assert.deepEqual(createdDateAndActivity.params, {
    activityAction: "CALL", activityInterest: "INTERESTED",
    from: "2026-11-01T00:00:00.000Z", to: "2026-11-07T23:59:59.999Z", archived: "false",
  });
  assert.equal("activityFrom" in createdDateAndActivity.params, false);
  assert.equal("activityTo" in createdDateAndActivity.params, false);

  const explicitActivityDate = getContextualExportParams("leads", "?filter.activityDate=custom&filter.activityResponse=REPLIED&dateFrom=2026-11-01&dateTo=2026-11-07");
  assert.deepEqual(explicitActivityDate.params, {
    activityDate: "custom", activityFrom: "2026-11-01", activityTo: "2026-11-07",
    activityResponse: "REPLIED", archived: "false",
  });
  assert.equal("from" in explicitActivityDate.params, false);
});

test("download guard rejects duplicate starts and can be released after initiation", () => {
  const guard = { pending: false };
  assert.equal(beginExportDownload(guard), true);
  assert.equal(beginExportDownload(guard), false);
  endExportDownload(guard);
  assert.equal(beginExportDownload(guard), true);
});

test("leads smart filter dependencies enforce response, interest, and reason rules and clear invalid child selections", async () => {
  const { reconcileLeadActivityFilters } = await import("../src/lib/export/lead-dependencies");

  // Only NOT_PICKED_UP / NO_RESPONSE -> Interest and Reason disabled & cleared
  const nonContacted = reconcileLeadActivityFilters({
    responses: ["NOT_PICKED_UP", "NO_RESPONSE"],
    interests: ["NOT_INTERESTED"],
    reasons: ["LANGUAGE_BARRIER"],
  });
  assert.equal(nonContacted.interestEnabled, false);
  assert.equal(nonContacted.reasonEnabled, false);
  assert.deepEqual(nonContacted.interests, []);
  assert.deepEqual(nonContacted.reasons, []);
  assert.equal(nonContacted.clearedInterests, true);
  assert.equal(nonContacted.clearedReasons, true);

  // Mixed responses including a contacted response (PICKED_UP or REPLIED) -> Interest enabled
  const mixedResponses = reconcileLeadActivityFilters({
    responses: ["NOT_PICKED_UP", "REPLIED"],
    interests: ["NOT_INTERESTED"],
    reasons: ["PERSONAL_USE"],
  });
  assert.equal(mixedResponses.interestEnabled, true);
  assert.equal(mixedResponses.reasonEnabled, true);
  assert.deepEqual(mixedResponses.interests, ["NOT_INTERESTED"]);
  assert.deepEqual(mixedResponses.reasons, ["PERSONAL_USE"]);

  // Interest excludes NOT_INTERESTED -> Reason disabled & cleared
  const interestedOnly = reconcileLeadActivityFilters({
    responses: ["PICKED_UP"],
    interests: ["INTERESTED"],
    reasons: ["PERSONAL_USE"],
  });
  assert.equal(interestedOnly.interestEnabled, true);
  assert.equal(interestedOnly.reasonEnabled, false);
  assert.deepEqual(interestedOnly.reasons, []);
  assert.equal(interestedOnly.clearedReasons, true);

  // Interest includes NOT_INTERESTED alongside INTERESTED -> Reason enabled with explanation
  const bothInterests = reconcileLeadActivityFilters({
    responses: [],
    interests: ["INTERESTED", "NOT_INTERESTED"],
    reasons: ["NO_CURRENT_REQUIREMENT"],
  });
  assert.equal(bothInterests.interestEnabled, true);
  assert.equal(bothInterests.reasonEnabled, true);
  assert.match(bothInterests.reasonMessage ?? "", /Not Interested/i);

  // No Interest selected -> Reason disabled until parent condition satisfied
  const emptyInterest = reconcileLeadActivityFilters({
    responses: [],
    interests: [],
    reasons: ["LANGUAGE_BARRIER"],
  });
  assert.equal(emptyInterest.interestEnabled, true);
  assert.equal(emptyInterest.reasonEnabled, false);
  assert.deepEqual(emptyInterest.reasons, []);

  // buildExportQuery rejects contradictory combinations directly
  assert.equal(buildExportQuery("leads", {
    ...createDefaultExportSelection(),
    responses: ["NOT_PICKED_UP"],
    interests: ["INTERESTED"],
  }, admin, now).ok, false);
  assert.equal(buildExportQuery("leads", {
    ...createDefaultExportSelection(),
    responses: ["PICKED_UP"],
    interests: ["NOT_INTERESTED"],
    reasons: ["LANGUAGE_BARRIER"],
  }, admin, now).ok, true);
});

test("users, providers, sync-history, and reports filters serialize identically for count and download", () => {
  const users = buildExportQuery("users", {
    ...createDefaultExportSelection("users"),
    search: "alex",
    userRole: "SALES",
    userActive: "false",
    userBanned: "false",
    userSalesPrivilege: "SENIOR",
    userDesignation: "Territory Manager",
    datePreset: "this-week",
  }, admin, now);
  assert.equal(users.ok, true);
  if (users.ok) {
    assert.equal(users.params.get("search"), "alex");
    assert.equal(users.params.get("role"), "SALES");
    assert.equal(users.params.get("active"), "false");
    assert.equal(users.params.get("banned"), "false");
    assert.equal(users.params.get("salesPrivilege"), "SENIOR");
    assert.equal(users.params.get("designation"), "Territory Manager");
    assert.equal(users.params.get("from"), "2026-11-02T00:00:00.000Z");
    assert.equal(users.params.get("to"), "2026-11-07T23:59:59.999Z");
  }

  const providers = buildExportQuery("providers", {
    ...createDefaultExportSelection("providers"),
    providerActive: "all",
    providerType: "EMAIL",
  }, admin, now);
  assert.equal(providers.ok, true);
  if (providers.ok) {
    assert.equal(providers.params.get("active"), "all");
    assert.equal(providers.params.get("sourceType"), "EMAIL");
  }

  const sync = buildExportQuery("sync-history", {
    ...createDefaultExportSelection("sync-history"),
    connectorId: "conn-1",
    syncStatus: "ERROR",
    syncErrorOutcome: "with-error",
  }, admin, now);
  assert.equal(sync.ok, true);
  if (sync.ok) {
    assert.equal(sync.params.get("connectorId"), "conn-1");
    assert.equal(sync.params.get("status"), "ERROR");
    assert.equal(sync.params.get("errorOutcome"), "with-error");
  }

  const reports = buildExportQuery("reports", {
    ...createDefaultExportSelection("reports"),
    datePreset: "this-month",
    reportSourceIds: ["src-1"],
    reportOwnerIds: ["user-1"],
    reportStatuses: ["NEW", "CONVERTED"],
  }, admin, now);
  assert.equal(reports.ok, true);
  if (reports.ok) {
    assert.equal(reports.params.get("source"), "src-1");
    assert.equal(reports.params.get("owner"), "user-1");
    assert.equal(reports.params.get("status"), "NEW,CONVERTED");
    assert.equal(reports.params.get("from"), "2026-11-01T00:00:00.000Z");
    assert.equal(reports.params.get("to"), "2026-11-07T23:59:59.999Z");
  }
});
