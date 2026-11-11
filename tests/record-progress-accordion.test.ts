import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("src/components/leads/record-progress-modal.tsx", "utf8");

test("Record Progress uses a full-screen responsive two-column modal without accordions", () => {
  assert.match(modal, /fixed inset-0 z-\[60\]/);
  assert.match(modal, /grid-cols-1 lg:grid-cols-2/);
  assert.match(modal, /overflow-y-auto/);
  assert.doesNotMatch(modal, /AccordionSection|accordion-section/);
});

test("fields are arranged in the specified order with action and response together", () => {
  const action = modal.indexOf('htmlFor="record-progress-action"');
  const response = modal.indexOf('htmlFor="record-progress-response"');
  const status = modal.indexOf('htmlFor="progress-status"');
  const priority = modal.indexOf('htmlFor="progress-priority"');
  const interest = modal.indexOf('htmlFor="record-progress-interest"');
  const notes = modal.indexOf('id="progress-notes-title"');
  const followUps = modal.indexOf('id="progress-follow-ups-title"');
  assert.ok(action < response && response < status && status < priority && priority < interest);
  assert.ok(notes >= 0 && notes < followUps);
  assert.equal((modal.match(/id="record-progress-notes"/g) ?? []).length, 1);
  assert.match(modal, /className="min-h-\[60px\] resize-y"/);
  assert.match(modal, /grid grid-cols-1 gap-4 sm:grid-cols-2/);
  assert.doesNotMatch(modal, /Lead Category|Latest Requirement|progress-category|progress-requirement/);
});

test("the modal omits descriptive subtitles and visible required or optional tags", () => {
  assert.doesNotMatch(modal, /Customer Interaction Required|Manage Follow-ups Optional|Record a genuine customer interaction|Record what happened with the customer|Leave values unchanged when no update is needed|Choose what should happen to the current task/);
  assert.doesNotMatch(modal, />Required<|>Optional</);
});

test("existing required validation remains in place", () => {
  assert.match(modal, /id="record-progress-action"[^>]*required/);
  assert.match(modal, /id="record-progress-response"[^>]*required/);
  assert.match(modal, /id="record-progress-interest"[^>]*required/);
});
