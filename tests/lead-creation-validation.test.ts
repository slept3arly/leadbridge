import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLeadRequestSchema, interactionActivitySchema, leadProgressRequestSchema, leadSchema } from "../src/lib/validation";
import { resolveFollowUpAssignee } from "../src/services/follow-up-policy";

const validActivity = {
  action: "CALL",
  response: "PICKED_UP",
  interest: "INTERESTED",
  notes: null,
  scheduleFollowUp: false,
  followUpDate: null,
  followUpTime: null,
};
const manualLead = (fields: Record<string, unknown>) => createLeadRequestSchema.safeParse({
  initialActivity: validActivity,
  ...fields,
});

test("lead phone validation requires exactly ten numeric digits", () => {
  assert.equal(manualLead({ name: "Valid phone", phone: "1234567890" }).success, true);
  assert.equal(manualLead({ name: "Short phone", phone: "123456789" }).success, false);
  assert.equal(manualLead({ name: "Long phone", phone: "12345678901" }).success, false);
  assert.equal(manualLead({ name: "Alphabetic phone", phone: "12345abcde" }).success, false);
  assert.equal(manualLead({ name: "Special phone", phone: "12345-7890" }).success, false);
  assert.equal(manualLead({ name: "Spaced phone", phone: " 1234567890 " }).success, false);
});

test("lead contact validation accepts either method, trims email, and normalizes empty optional values", () => {
  const emailOnly = manualLead({ name: "Email lead", email: "  person@example.test  ", phone: "" });
  assert.equal(emailOnly.success, true);
  if (emailOnly.success) {
    assert.equal(emailOnly.data.email, "person@example.test");
    assert.equal(emailOnly.data.phone, null);
  }

  const phoneOnly = manualLead({ name: "Phone lead", email: "", phone: "1234567890" });
  assert.equal(phoneOnly.success, true);
  if (phoneOnly.success) assert.equal(phoneOnly.data.email, null);

  assert.equal(manualLead({ name: "Contactless" }).success, false);
  assert.equal(manualLead({ name: "Bad email", email: "person at example.test", phone: "" }).success, false);

  const whitespaceOptionals = manualLead({
    name: "Whitespace optionals", email: " person@example.test ", phone: "  ", company: "  ", product: "   ",
  });
  assert.equal(whitespaceOptionals.success, true);
  if (whitespaceOptionals.success) {
    assert.equal(whitespaceOptionals.data.email, "person@example.test");
    assert.equal(whitespaceOptionals.data.phone, null);
    assert.equal(whitespaceOptionals.data.company, null);
    assert.equal(whitespaceOptionals.data.product, null);
  }
  assert.equal(manualLead({ name: "Blank contacts", email: "   ", phone: "  " }).success, false);
});

test("manual lead creation requires a valid initial contact interaction", () => {
  assert.equal(createLeadRequestSchema.safeParse({ name: "Missing activity", phone: "1234567890" }).success, false);
  assert.equal(manualLead({ name: "Invalid response", phone: "1234567890", initialActivity: { ...validActivity, response: "REPLIED" } }).success, false);
  assert.equal(manualLead({ name: "No response", phone: "1234567890", initialActivity: { ...validActivity, response: "NO_RESPONSE", interest: null } }).success, true);
  assert.equal(manualLead({ name: "No interest", phone: "1234567890", initialActivity: { ...validActivity, interest: null } }).success, false);
});

test("lead updates share email and phone validation without requiring contact details", () => {
  assert.equal(leadSchema.partial().safeParse({}).success, true);
  assert.equal(leadSchema.partial().safeParse({ phone: "123456789" }).success, false);
  const normalized = leadSchema.partial().safeParse({ email: " person@example.test ", phone: "" });
  assert.equal(normalized.success, true);
  if (normalized.success) {
    assert.equal(normalized.data.email, "person@example.test");
    assert.equal(normalized.data.phone, null);
  }
});

test("manual lead forms omit Product while legacy API input remains optional", () => {
  const editForm = readFileSync("src/components/leads/lead-edit-modal.tsx", "utf8");
  const details = readFileSync("src/components/sales/lead-info-section.tsx", "utf8");
  const adminList = readFileSync("src/components/leads/admin-leads-page-content.tsx", "utf8");
  const leadPage = readFileSync("src/app/(dashboard)/admin/leads/page.tsx", "utf8");
  const detailType = readFileSync("src/hooks/use-lead-details.ts", "utf8");
  const leadService = readFileSync("src/services/lead.service.ts", "utf8");
  const manualLeadWithoutProduct = manualLead({ name: "No Product field", email: "lead@example.test" });
  const legacyInput = leadSchema.safeParse({ name: "Legacy Product input", product: "Stored value" });

  assert.doesNotMatch(editForm, /product/i);
  assert.doesNotMatch(details, /product/i);
  assert.doesNotMatch(adminList, /product/i);
  assert.doesNotMatch(leadPage, /product/i);
  assert.doesNotMatch(detailType, /product/i);
  assert.doesNotMatch(leadService, /product:\s*true/);
  assert.equal(manualLeadWithoutProduct.success, true);
  assert.equal(legacyInput.success, true);
  if (legacyInput.success) assert.equal(legacyInput.data.product, "Stored value");
});

test("lead PATCH omission preserves the stored Product value", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/leadbridge_unit_test";
  try {
    const { LeadService } = await import("../src/services/lead.service");
    const service = new LeadService();
    const existing = {
      id: "lead-product-compatibility",
      displayName: "Legacy lead",
      company: "Before",
      product: "Persisted historical value",
      updatedAt: new Date("2026-10-01T00:00:00.000Z"),
      isDeleted: false,
    };
    let stored = { ...existing };
    let updateData: Record<string, unknown> | undefined;
    const tx = {
      lead: {
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          updateData = data;
          stored = { ...stored, ...data };
          return { count: 1 };
        },
        findUniqueOrThrow: async () => stored,
      },
    };

    await service.updateFieldsInTransaction(tx as never, existing as never, { company: "After" }, "actor-1");

    assert.equal(updateData?.company, "After");
    assert.equal("product" in (updateData ?? {}), false);
    assert.equal(stored.product, "Persisted historical value");
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("connector mapping, CSV export compatibility, and historical Product labels remain", () => {
  const connector = readFileSync("src/runtime/connector-runtime.ts", "utf8");
  const exporter = readFileSync("src/services/export.service.ts", "utf8");
  const history = readFileSync("src/components/sales/daily-history.tsx", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const exportHeader = exporter.match(/\["Lead Number"[^\]]+\]/)?.[0];

  assert.match(connector, /product: lead\.product \?\? null/);
  assert.match(exporter, /product: true/);
  assert.match(exporter, /lead\.country, lead\.product, lead\.requirement/);
  assert.ok(exportHeader);
  assert.ok(exportHeader.indexOf('"Product"') > exportHeader.indexOf('"Country"'));
  assert.ok(exportHeader.indexOf('"Product"') < exportHeader.indexOf('"Requirement"'));
  assert.match(history, /product: "Product"/);
  assert.match(schema, /product\s+String\?/);
});

test("activity validation enforces action-specific response and conditional interest", () => {
  assert.equal(interactionActivitySchema.safeParse(validActivity).success, true);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, action: "CALL", response: "REPLIED" }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, action: "WHATSAPP", response: "PICKED_UP" }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, interest: null }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, response: "NO_RESPONSE", interest: null }).success, true);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, action: "WHATSAPP", response: "REPLIED" }).success, true);
  const clientIdentity = interactionActivitySchema.parse({ ...validActivity, actorId: "forged-actor", assignedUserId: "forged-assignee" });
  assert.equal("actorId" in clientIdentity, false);
  assert.equal("assignedUserId" in clientIdentity, false);
});

test("follow-up scheduling requires a valid date and follows existing actor assignment rules", () => {
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, scheduleFollowUp: true, followUpDate: null }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, scheduleFollowUp: true, followUpDate: "not-a-date" }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, scheduleFollowUp: true, followUpDate: "2026-12-01T10:00:00.000Z" }).success, true);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, scheduleFollowUp: true, followUpDate: "2026-12-01" }).success, true);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, scheduleFollowUp: true, followUpDate: "2026-12-01T10:00:00" }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, followUpDate: "2026-12-01" }).success, false);
  assert.equal(interactionActivitySchema.safeParse({ ...validActivity, scheduleFollowUp: true, followUpDate: "2026-02-30" }).success, false);
  assert.equal(leadProgressRequestSchema.safeParse({ ...validActivity, completeFollowUpId: "  task-1  " }).success, true);
  assert.equal(leadProgressRequestSchema.safeParse({ ...validActivity, category: "UNKNOWN" }).success, false);
  assert.equal(leadProgressRequestSchema.safeParse({ ...validActivity, scheduleFollowUp: true, followUpDate: "2030-01-01" }).success, true);

  assert.equal(resolveFollowUpAssignee({ id: "sales-1", role: "SALES" }), "sales-1");
  assert.throws(() => resolveFollowUpAssignee({ id: "sales-1", role: "SALES" }, "sales-2"), /only to themselves/);
  assert.equal(resolveFollowUpAssignee({ id: "admin-1", role: "ADMIN" }), "admin-1");
});
