import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadStatusPriorityCell } from "../src/components/leads/lead-status-priority-cell";
import { LEAD_CATEGORIES, LEAD_PRIORITIES, LEAD_STATUSES, FOLLOW_UP_PRIORITIES, FOLLOW_UP_STATUSES } from "../src/lib/lead-constants";
import {
  ACTIVITY_ACTION_OPTIONS,
  ACTIVITY_INTEREST_OPTIONS,
  ACTIVITY_RESPONSE_OPTIONS,
  getActivityResponseOptions,
} from "../src/lib/activity-options";
import { createLeadRequestSchema, followUpSchema, interactionActivitySchema, leadProgressRequestSchema } from "../src/lib/validation";
import { leadExportFiltersSchema, followUpExportFiltersSchema } from "../src/lib/export/filters";
import { ACTIVITY_REASON_OPTIONS } from "../src/lib/activity-reasons";

const schema = readFileSync("prisma/schema.prisma", "utf8");

test("Admin and Sales share the compact Status / Priority presentation", () => {
  const markup = renderToStaticMarkup(createElement(LeadStatusPriorityCell, {
    status: "NEW",
    priority: "MEDIUM",
    category: "MEDICAL_REPRESENTATIVE",
  }));
  assert.match(markup, /New/);
  assert.match(markup, /Medium/);
  assert.match(markup, /Medical Representative/);
  assert.match(markup, /w-\[82px\].*text-\[11px\]/);
  assert.match(markup, /w-\[72px\].*text-\[11px\]/);
  assert.match(markup, /w-\[158px\].*whitespace-normal.*break-words/);
  assert.doesNotMatch(markup, /whitespace-nowrap[^\"]*Medical Representative/);

  for (const path of [
    "src/components/leads/admin-leads-page-content.tsx",
    "src/components/sales/sales-my-leads-page-content.tsx",
  ]) {
    const page = readFileSync(path, "utf8");
    const column = page.match(/key: "statusPriority",[\s\S]*?(?=\n\s*\},)/)?.[0];
    assert.ok(column, `${path} has the Status / Priority column`);
    assert.match(column, /LeadStatusPriorityCell/);
    assert.match(column, /w-\[190px\] min-w-\[190px\]/);
    assert.match(column, /align-middle/);
  }
});

function enumValues(name: string): string[] {
  const body = schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  assert.ok(body, `Missing Prisma enum ${name}`);
  return body.split("\n").map((line) => line.trim()).filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
}

function assertCatalog(name: string, options: readonly { value: string; label: string }[]) {
  const actual = options.map(({ value }) => value);
  const expected = name === "ResponseType" ? enumValues(name).filter((value) => value !== "NO_RESPONSE") : enumValues(name);
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${name} catalog must cover every user-facing enum value`);
  assert.equal(new Set(actual).size, actual.length, `${name} values must occur once`);
  assert.ok(options.every(({ label }) => label.trim().length > 0), `${name} labels must be non-empty`);
}

const validCall = {
  action: "CALL",
  response: "PICKED_UP",
  interest: "INTERESTED",
  notes: "Spoke with the contact",
};

test("central label catalogs cover every workflow enum value without changing stored values", () => {
  assertCatalog("LeadStatus", LEAD_STATUSES);
  assertCatalog("LeadPriority", LEAD_PRIORITIES);
  assertCatalog("LeadCategory", LEAD_CATEGORIES);
  assertCatalog("FollowUpStatus", FOLLOW_UP_STATUSES);
  assertCatalog("FollowUpPriority", FOLLOW_UP_PRIORITIES);
  assertCatalog("ActionType", ACTIVITY_ACTION_OPTIONS);
  assertCatalog("ResponseType", ACTIVITY_RESPONSE_OPTIONS);
  assertCatalog("InterestType", ACTIVITY_INTEREST_OPTIONS);
  assertCatalog("ActivityReason", ACTIVITY_REASON_OPTIONS);
  assert.equal(LEAD_STATUSES.find(({ value }) => value === "LOST")?.label, "Lost");
  assert.equal(LEAD_STATUSES.find(({ value }) => value === "CONVERTED")?.label, "Converted");
  assert.deepEqual(LEAD_STATUSES, [
    { value: "NEW", label: "New" },
    { value: "CONVERTED", label: "Converted" },
    { value: "LOST", label: "Lost" },
    { value: "SPAM", label: "Junk" },
    { value: "ON_HOLD", label: "Paused" },
    { value: "OLD", label: "Old" },
    { value: "REPEATED", label: "Repeated" },
  ]);
  assert.equal(ACTIVITY_INTEREST_OPTIONS.find(({ value }) => value === "NOT_INTERESTED")?.label, "Not interested");
  assert.equal(ACTIVITY_INTEREST_OPTIONS.find(({ value }) => value === "DETAIL_SHARED")?.label, "Detail shared");
  assert.equal(ACTIVITY_INTEREST_OPTIONS.find(({ value }) => value === "POSITIVE")?.label, "Positive");
  assert.equal(ACTIVITY_REASON_OPTIONS.find(({ value }) => value === "CALL_CUT_HOLD")?.label, "Call cut/Hold");
  assert.equal(FOLLOW_UP_STATUSES.find(({ value }) => value === "PENDING")?.label, "To do");
  assert.deepEqual(getActivityResponseOptions("CALL").map(({ value }) => value), ["PICKED_UP", "NOT_PICKED_UP", "INVALID_NUMBER", "SWITCHED_OFF"]);
  assert.deepEqual(getActivityResponseOptions("WHATSAPP").map(({ value }) => value), ["REPLIED", "NOT_REPLIED"]);
  assert.equal(LEAD_PRIORITIES.find(({ value }) => value === "MEDIUM")?.label, "Medium");
  assert.equal(LEAD_PRIORITIES.find(({ value }) => value === "COLD")?.label, "Cold");
  for (const status of LEAD_STATUSES) {
    assert.equal(leadExportFiltersSchema.safeParse({ status: [status.value] }).success, true, `${status.value} is export-filterable`);
  }
  for (const option of ACTIVITY_INTEREST_OPTIONS) {
    assert.equal(leadExportFiltersSchema.safeParse({ interests: [option.value] }).success, true, `${option.value} is export-filterable`);
  }
  for (const option of ACTIVITY_REASON_OPTIONS) {
    assert.equal(leadExportFiltersSchema.safeParse({ reasons: [option.value], interests: ["NOT_INTERESTED"] }).success, true, `${option.value} is export-filterable`);
  }
  const dashboard = readFileSync("src/services/dashboard.service.ts", "utf8");
  const salesDashboard = readFileSync("src/components/sales/sales-dashboard-client.tsx", "utf8");
  const adminReports = readFileSync("src/components/admin/admin-reports.tsx", "utf8");
  assert.match(dashboard, /statusBreakdown: LEAD_STATUSES\.map/);
  assert.match(salesDashboard, /PIPELINE_STATUSES = LEAD_STATUSES\.map/);
  assert.match(adminReports, /LEAD_STATUSES\.some\(\(status\) => status\.value === s\.status\)/);
  for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT", "COLD"]) {
    assert.equal(leadExportFiltersSchema.safeParse({ priority: [priority] }).success, true);
    assert.equal(followUpExportFiltersSchema.safeParse({ priorities: [priority] }).success, true);
    assert.equal(followUpSchema.safeParse({ title: "Task", leadId: "lead-1", priority }).success, true);
  }
  for (const path of [
    "src/components/admin/admin-dashboard-client.tsx",
    "src/components/sales/daily-history.tsx",
    "src/components/sales/sales-my-leads-page-content.tsx",
    "src/components/sales/lead-details-modal.tsx",
    "src/components/sales/sales-dashboard-client.tsx",
  ]) {
    const component = readFileSync(path, "utf8");
    assert.doesNotMatch(component, /const (?:STATUS|PRIORITY|ACTION|RESPONSE|INTEREST)_LABELS/);
  }
});

test("interaction contract requires compatible responses and conditional interest", () => {
  assert.equal(interactionActivitySchema.safeParse(validCall).success, true);
  assert.equal(interactionActivitySchema.safeParse({ ...validCall, response: "REPLIED" }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validCall, interest: null }).success, false);
  for (const response of ["PICKED_UP", "NOT_PICKED_UP", "INVALID_NUMBER", "SWITCHED_OFF"]) {
    assert.equal(interactionActivitySchema.safeParse({ ...validCall, response, interest: response === "PICKED_UP" ? "INTERESTED" : null }).success, true);
  }
  for (const response of ["REPLIED", "NOT_REPLIED"]) {
    assert.equal(interactionActivitySchema.safeParse({ ...validCall, action: "WHATSAPP", response, interest: response === "REPLIED" ? "INTERESTED" : null }).success, true);
  }
  assert.equal(interactionActivitySchema.safeParse({ ...validCall, response: "NO_RESPONSE", interest: null }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validCall, action: "WHATSAPP", response: "REPLIED" }).success, true);
  assert.equal(interactionActivitySchema.safeParse({ ...validCall, action: "WHATSAPP", response: "PICKED_UP" }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validCall, action: "WHATSAPP", response: "INVALID_NUMBER", interest: null }).success, false);
});

test("legacy NO_RESPONSE stays readable and can remain unchanged during activity edits", async () => {
  const { validateActivityOutcomePatch } = await import("../src/lib/validation");
  assert.equal(validateActivityOutcomePatch(
    { action: "CALL", response: "NO_RESPONSE", interest: null },
    {},
  ), null);
  assert.equal(validateActivityOutcomePatch(
    { action: "CALL", response: "NO_RESPONSE", interest: null },
    { interest: null },
  )?.success, true);
  assert.equal(validateActivityOutcomePatch(
    { action: "WHATSAPP", response: "NO_RESPONSE", interest: null },
    { action: "CALL" },
  )?.success, false);
  assert.equal(ACTIVITY_RESPONSE_OPTIONS.some(({ value }) => String(value) === "NO_RESPONSE"), false);
});

test("Create Lead and Record Progress require a real interaction and manual schedules require a date", () => {
  assert.equal(createLeadRequestSchema.safeParse({ name: "No interaction", phone: "1234567890" }).success, false);
  assert.equal(createLeadRequestSchema.safeParse({ name: "Valid", phone: "1234567890", initialActivity: validCall }).success, true);
  assert.equal(leadProgressRequestSchema.safeParse({}).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validCall, scheduleFollowUp: true, followUpDate: null }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validCall, scheduleFollowUp: true, followUpDate: "2026-12-01" }).success, true);
  assert.equal(leadProgressRequestSchema.safeParse({ ...validCall, requirement: "Needs a clinic delivery option" }).success, true);
  assert.equal(leadProgressRequestSchema.safeParse({ ...validCall, requirement: "x".repeat(2001) }).success, false);
});

test("follow-up, District, and migration safeguards match current implementation", () => {
  const backend = readFileSync("docs/backend.md", "utf8");
  const database = readFileSync("docs/database.md", "utf8");
  const followUpService = readFileSync("src/services/follow-up.service.ts", "utf8");
  const migration = readFileSync("prisma/migrations/20261109100000_followup_one_pending_per_lead/migration.sql", "utf8");

  assert.match(backend, /Scheduling supersedes the one existing pending task/);
  assert.match(followUpService, /where: \{ leadId, status: "PENDING" \}/);
  assert.match(followUpService, /completionReason: "SUPERSEDED_BY_NEW_FOLLOW_UP"/);
  assert.match(database, /a city-only write does not infer a district/);
  assert.match(database, /differing values are allowed/);
  assert.match(database, /run a fresh read-only inventory against the intended target database/);
  assert.match(migration, /HAVING count\(\*\) > 1/);
  assert.match(migration, /RAISE EXCEPTION/);
  assert.match(database, /never auto-resolve conflicts/);
});
