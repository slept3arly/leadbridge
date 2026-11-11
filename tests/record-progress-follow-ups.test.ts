import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getEligibleProgressFollowUps } from "../src/lib/record-progress-follow-ups";

const modal = readFileSync("src/components/leads/record-progress-modal.tsx", "utf8");
const followUps = [
  { id: "pending-current", status: "PENDING", leadId: "lead-1" },
  { id: "pending-other", status: "PENDING", leadId: "lead-2" },
  { id: "completed-current", status: "COMPLETED", leadId: "lead-1" },
];

test("the read-only follow-up card includes task details and a compact empty state", () => {
  const currentLeadTasks = getEligibleProgressFollowUps(followUps, "lead-1");
  assert.deepEqual(currentLeadTasks.map((item) => item.id), ["pending-current"]);
  assert.match(modal, /FOLLOW_UP_STATUSES\.find/);
  assert.match(modal, /FOLLOW_UP_PRIORITIES\.find/);
  assert.match(modal, /currentFollowUp\.dueDate \? formatDate/);
  assert.match(modal, /currentFollowUp\.assignedUser\?\.name/);
  assert.match(modal, /Overdue/);
  assert.match(modal, /No pending follow-up\./);
  assert.doesNotMatch(modal, /Complete this follow-up when recording progress|Reschedule this task|axios\.patch/);
});

test("scheduling defaults off, uses an accessible switch, and clears hidden field values", () => {
  assert.match(modal, /useState\(false\)/);
  assert.match(modal, /role="switch" aria-checked=\{scheduleFollowUp\}/);
  assert.match(modal, /focus-visible:ring-3/);
  assert.match(modal, /inert=\{!scheduleFollowUp\}/);
  assert.match(modal, /if \(!enabled\) \{\s*setFollowUpDate\(""\);\s*setFollowUpTime\(""\);/);
  assert.match(modal, /scheduleFollowUp \? followUpFormDate\(followUpDate, followUpTime\) : null/);
  assert.match(modal, /scheduleFollowUp \? followUpTime \|\| null : null/);
});

test("Record Progress explains automatic completion in the footer and uses the shared API once", () => {
  const footer = modal.slice(modal.indexOf("<footer"), modal.indexOf("</footer>"));
  const message = "Recording progress will automatically mark the existing follow-up as completed, even if you don&apos;t schedule a new follow-up.";
  assert.ok(footer.includes(message));
  assert.equal(modal.split(message).length - 1, 1);
  assert.match(footer, /sm:flex-row sm:items-center sm:justify-between/);
  assert.match(footer, /flex shrink-0 justify-end gap-3/);
  assert.doesNotMatch(modal, /completeFollowUpId|selectedFollowUpId|confirmCompletion/);
  assert.match(modal, /axios\.post\(`\/api\/leads\/\$\{leadId\}\/activities`, parsed\.data\)/);
  assert.equal((modal.match(/axios\.post\(/g) ?? []).length, 1);
  const workflow = readFileSync("src/services/lead-workflow.service.ts", "utf8");
  assert.match(workflow, /const \{ pending \} = await followUpService\.lockLeadForLifecycle\(tx, leadId, actor\)/);
  assert.match(workflow, /data\.completeFollowUpId \?\? pending\[0\]\?\.id/);
});

test("409 conflicts and server validation errors are shown to the user", () => {
  assert.match(modal, /err\.response\?\.status === 409/);
  assert.match(modal, /The lead or follow-up changed while you were working/);
  assert.match(modal, /Unable to record progress/);
  assert.match(modal, /role="alert"/);
});
