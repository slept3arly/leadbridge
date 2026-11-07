import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getCompletionFollowUpId,
  getEligibleProgressFollowUps,
  getValidProposedFollowUpId,
} from "../src/lib/record-progress-follow-ups";

const modal = readFileSync("src/components/leads/record-progress-modal.tsx", "utf8");

const followUps = [
  { id: "pending-current", status: "PENDING", leadId: "lead-1" },
  { id: "pending-other", status: "PENDING", leadId: "lead-2" },
  { id: "completed-current", status: "COMPLETED", leadId: "lead-1" },
];

test("normal entry has no proposed completion and task context selects only a current pending task", () => {
  const currentLeadTasks = getEligibleProgressFollowUps(followUps, "lead-1");
  assert.deepEqual(currentLeadTasks.map((item) => item.id), ["pending-current"]);
  assert.equal(getValidProposedFollowUpId(undefined, currentLeadTasks), "");
  assert.equal(getValidProposedFollowUpId("pending-current", currentLeadTasks), "pending-current");
  assert.equal(getValidProposedFollowUpId("completed-current", currentLeadTasks), "");
  assert.equal(getValidProposedFollowUpId("pending-other", currentLeadTasks), "");
  assert.match(modal, /initialFollowUpId && selectedFollowUp/);
  assert.match(modal, /setSelectedFollowUpId\(getValidProposedFollowUpId\(initialFollowUpId, pending\)\)/);
});

test("selection and clearing only set the proposed ID; completion payload omits an empty or invalid selection", () => {
  const pendingCurrent = getEligibleProgressFollowUps(followUps, "lead-1");
  assert.equal(getCompletionFollowUpId("", pendingCurrent), undefined);
  assert.equal(getCompletionFollowUpId("completed-current", pendingCurrent), undefined);
  assert.equal(getCompletionFollowUpId("pending-current", pendingCurrent), "pending-current");
  assert.match(modal, /setSelectedFollowUpId\(""\)/);
  assert.match(modal, /setSelectedFollowUpId\(item\.id\)/);
  assert.match(modal, /const completeFollowUpId = getCompletionFollowUpId\(selectedFollowUpId, pendingFollowUps\)/);
  assert.match(modal, /\.\.\.\(completeFollowUpId \? \{ completeFollowUpId \} : \{\}\)/);
  assert.doesNotMatch(modal, /confirmCompletion/);
});

test("follow-up choices use keyboard-accessible radios and render every pending option", () => {
  assert.match(modal, /<fieldset[\s\S]*<legend[\s\S]*Choose a pending follow-up/);
  assert.match(modal, /type="radio"[\s\S]*name="progress-follow-up-completion"/);
  assert.match(modal, /<label key=\{item\.id\}[\s\S]*type="radio"[\s\S]*checked=\{selected\}/);
  assert.match(modal, /pendingFollowUps\.map\(\(item\)/);
  assert.match(modal, /Proposed for completion/);
  assert.match(modal, /Leave all pending follow-ups unchanged/);
  assert.match(modal, /No pending follow-ups\./);
});

test("scheduling is independent and shares the existing single submission with completion", () => {
  assert.match(modal, /scheduleFollowUp,[\s\S]*followUpDate: scheduleFollowUp \? followUpFormDate/);
  assert.match(modal, /const completeFollowUpId = getCompletionFollowUpId\(selectedFollowUpId, pendingFollowUps\)/);
  assert.equal((modal.match(/axios\.post\(/g) ?? []).length, 1);
});
