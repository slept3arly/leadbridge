import test from "node:test";
import assert from "node:assert/strict";
import {
  crmMutationFromAxiosResponse,
  createCrmMutationHandler,
  parseCrmMutationMessage,
  shouldRevalidateOnVisibility,
  type CrmMutationInput,
} from "../src/lib/crm-sync";

const leadMutation: CrmMutationInput = {
  entityType: "lead",
  entityId: "lead-1",
};

test("successful Axios CRM responses map to minimal entity notifications", () => {
  assert.deepEqual(crmMutationFromAxiosResponse({
    status: 201,
    method: "POST",
    url: "/api/leads",
    data: { id: "lead-1", email: "private@example.test", displayName: "Private" },
  }), leadMutation);
  assert.deepEqual(crmMutationFromAxiosResponse({
    method: "POST",
    url: "/api/leads/lead-1/notes",
    data: { id: "note-1", leadId: "lead-1", content: "private note" },
  }), { entityType: "note", entityId: "note-1", leadId: "lead-1" });
  assert.deepEqual(crmMutationFromAxiosResponse({
    method: "POST",
    url: "/api/follow-ups/follow-up-1/complete",
    data: { completedFollowUp: { id: "follow-up-1", leadId: "lead-1", description: "private" } },
  }), { entityType: "follow-up", entityId: "follow-up-1", leadId: "lead-1" });
  assert.deepEqual(crmMutationFromAxiosResponse({
    method: "PATCH",
    url: "/api/activities/activity-1",
    data: { id: "activity-1", event: { leadId: "lead-1" }, message: "private" },
  }), { entityType: "activity", entityId: "activity-1", leadId: "lead-1" });
  assert.deepEqual(crmMutationFromAxiosResponse({ method: "DELETE", url: "/api/notes/note-1", data: "" }), {
    entityType: "note", entityId: "note-1",
  });
  assert.equal(crmMutationFromAxiosResponse({ method: "GET", url: "/api/leads/lead-1", data: {} }), null);
  assert.equal(crmMutationFromAxiosResponse({ status: 500, method: "PATCH", url: "/api/leads/lead-1", data: {} }), null);
  assert.equal(crmMutationFromAxiosResponse({ method: "PATCH", url: "/api/settings", data: {} }), null);
  assert.equal(crmMutationFromAxiosResponse({ method: "DELETE", url: "/api/leads/lead-1", data: {} })?.entityId, "lead-1");
});

test("message parsing strips unrelated fields and rejects malformed events", () => {
  assert.deepEqual(parseCrmMutationMessage({
    eventType: "mutation",
    entityType: "note",
    entityId: "note-1",
    leadId: "lead-1",
    timestamp: 123,
    email: "private@example.test",
  }), {
    eventType: "mutation",
    entityType: "note",
    entityId: "note-1",
    leadId: "lead-1",
    timestamp: 123,
  });
  assert.equal(parseCrmMutationMessage({ eventType: "mutation", entityType: "user", timestamp: 1 }), null);
});

test("mutation handlers refresh only matching entities and currently displayed leads", () => {
  const refreshed: string[] = [];
  const handle = createCrmMutationHandler(
    (message) => refreshed.push(`${message.entityType}:${message.entityId ?? ""}`),
    { entityTypes: ["lead", "note", "follow-up", "activity"], leadId: "lead-1", entityIds: ["note-2"] },
  );

  assert.equal(handle({ eventType: "mutation", entityType: "note", entityId: "note-1", leadId: "lead-1", timestamp: 1 }), true);
  assert.equal(handle({ eventType: "mutation", entityType: "lead", entityId: "lead-1", timestamp: 2 }), true);
  assert.equal(handle({ eventType: "mutation", entityType: "activity", entityId: "activity-2", leadId: "lead-2", timestamp: 3 }), false);
  assert.equal(handle({ eventType: "mutation", entityType: "note", entityId: "note-2", timestamp: 4 }), true);
  assert.deepEqual(refreshed, ["note:note-1", "lead:lead-1", "note:note-2"]);
});

test("visibility revalidation is throttled", () => {
  assert.equal(shouldRevalidateOnVisibility(29_999, 0), false);
  assert.equal(shouldRevalidateOnVisibility(30_000, 0), true);
  assert.equal(shouldRevalidateOnVisibility(60_000, 45_000, 30_000), false);
});
