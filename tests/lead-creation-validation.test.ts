import test from "node:test";
import assert from "node:assert/strict";
import { createLeadRequestSchema, interactionActivitySchema, leadSchema } from "../src/lib/validation";
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

test("lead phone validation requires exactly ten numeric digits", () => {
  assert.equal(createLeadRequestSchema.safeParse({ name: "Valid phone", phone: "1234567890" }).success, true);
  assert.equal(createLeadRequestSchema.safeParse({ name: "Short phone", phone: "123456789" }).success, false);
  assert.equal(createLeadRequestSchema.safeParse({ name: "Long phone", phone: "12345678901" }).success, false);
  assert.equal(createLeadRequestSchema.safeParse({ name: "Alphabetic phone", phone: "12345abcde" }).success, false);
  assert.equal(createLeadRequestSchema.safeParse({ name: "Special phone", phone: "12345-7890" }).success, false);
  assert.equal(createLeadRequestSchema.safeParse({ name: "Spaced phone", phone: " 1234567890 " }).success, false);
});

test("lead contact validation accepts either method, trims email, and normalizes empty optional values", () => {
  const emailOnly = createLeadRequestSchema.safeParse({ name: "Email lead", email: "  person@example.test  ", phone: "" });
  assert.equal(emailOnly.success, true);
  if (emailOnly.success) {
    assert.equal(emailOnly.data.email, "person@example.test");
    assert.equal(emailOnly.data.phone, null);
  }

  const phoneOnly = createLeadRequestSchema.safeParse({ name: "Phone lead", email: "", phone: "1234567890" });
  assert.equal(phoneOnly.success, true);
  if (phoneOnly.success) assert.equal(phoneOnly.data.email, null);

  assert.equal(createLeadRequestSchema.safeParse({ name: "Contactless" }).success, false);
  assert.equal(createLeadRequestSchema.safeParse({ name: "Bad email", email: "person at example.test", phone: "" }).success, false);

  const whitespaceOptionals = createLeadRequestSchema.safeParse({
    name: "Whitespace optionals", email: " person@example.test ", phone: "  ", company: "  ", product: "   ",
  });
  assert.equal(whitespaceOptionals.success, true);
  if (whitespaceOptionals.success) {
    assert.equal(whitespaceOptionals.data.email, "person@example.test");
    assert.equal(whitespaceOptionals.data.phone, null);
    assert.equal(whitespaceOptionals.data.company, null);
    assert.equal(whitespaceOptionals.data.product, null);
  }
  assert.equal(createLeadRequestSchema.safeParse({ name: "Blank contacts", email: "   ", phone: "  " }).success, false);
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

  assert.equal(resolveFollowUpAssignee({ id: "sales-1", role: "SALES" }), "sales-1");
  assert.throws(() => resolveFollowUpAssignee({ id: "sales-1", role: "SALES" }, "sales-2"), /only to themselves/);
  assert.equal(resolveFollowUpAssignee({ id: "admin-1", role: "ADMIN" }), "admin-1");
});
