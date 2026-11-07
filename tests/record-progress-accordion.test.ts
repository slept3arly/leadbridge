import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("src/components/leads/record-progress-modal.tsx", "utf8");
const accordion = readFileSync("src/components/ui/accordion-section.tsx", "utf8");

test("Record Progress renders three controlled accordion sections collapsed by default", () => {
  assert.match(modal, /interaction: false,[\s\S]*classification: false,[\s\S]*followUps: false/);
  assert.match(modal, /title="Customer Interaction"[\s\S]*status="Required"[\s\S]*expanded=\{expandedSections\.interaction\}/);
  assert.match(modal, /title="Update Lead Classification"[\s\S]*status="Optional"[\s\S]*expanded=\{expandedSections\.classification\}/);
  assert.match(modal, /title="Manage Follow-ups"[\s\S]*status="Optional"[\s\S]*expanded=\{expandedSections\.followUps\}/);
});

test("accordion uses a full-width semantic button and a separate accessible content region", () => {
  assert.match(accordion, /<button[\s\S]*type="button"[\s\S]*aria-expanded=\{expanded\}[\s\S]*aria-controls=\{panelId\}/);
  assert.match(accordion, /className={cn\([\s\S]*"flex w-full items-center justify-between/);
  assert.match(accordion, /<\/button>\s*<div/);
  assert.match(accordion, /<div[\s\S]*id=\{panelId\}[\s\S]*role="region"[\s\S]*aria-labelledby=\{triggerId\}[\s\S]*hidden={!expanded}/);
  assert.match(accordion, /focus-visible:ring-2/);
  assert.match(accordion, /<ChevronDown[\s\S]*aria-hidden="true"/);
});

test("collapse preserves modal-owned form values and validation expands affected sections", () => {
  for (const state of ["action", "response", "interest", "notes", "status", "priority", "category", "selectedFollowUpId", "scheduleFollowUp", "followUpDate", "followUpTime"]) {
    assert.match(modal, new RegExp(`const \\[${state}, set[A-Za-z]+\\] = useState`), `${state} remains owned by the modal`);
  }
  assert.match(modal, /expandSectionsWithErrors\(invalidFields\)/);
  assert.match(modal, /interest: "interaction"[\s\S]*status: "classification"[\s\S]*category: "classification"[\s\S]*followUpDate: "followUps"/);
  assert.match(modal, /setExpandedSections\(\(current\) => \(\{[\s\S]*interaction: current\.interaction \|\| sections\.has\("interaction"\)/);
  assert.match(modal, /focusAfterExpansion/);
  assert.match(modal, /<form noValidate onSubmit={handleSubmit}/);
  assert.match(modal, /setFieldErrors\(\(current\) => \{[\s\S]*delete next\[field\]/);
});

test("accordion redesign retains task-context and single-request submission contracts", () => {
  assert.match(modal, /useState\(\(\) => getValidProposedFollowUpId\(initialFollowUpId, initialPendingFollowUps\)\)/);
  assert.match(modal, /initialFollowUpId && selectedFollowUp/);
  assert.match(modal, /const completeFollowUpId = getCompletionFollowUpId\(selectedFollowUpId, pendingFollowUps\)/);
  assert.match(modal, /\.\.\.\(completeFollowUpId \? \{ completeFollowUpId \} : \{\}\)/);
  assert.match(modal, /axios\.post\(`\/api\/leads\/\$\{leadId\}\/activities`, parsed\.data\)/);
  assert.equal((modal.match(/axios\.post\(/g) ?? []).length, 1);
  assert.match(modal, /setError\("The lead or follow-up changed while you were working/);
  assert.match(modal, /setError\("You no longer have permission to record progress/);
});
