import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { getLeadCreateValidationTarget } from "../src/lib/lead-create-accordion";

const componentsRoot = join(process.cwd(), "src/components");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

test("user-facing progress entry points use the shared Record Progress component", () => {
  const consumers = [
    "src/components/sales/lead-details-modal.tsx",
    "src/components/sales/tasks-table-client.tsx",
    "src/components/sales/sales-my-leads-page-content.tsx",
  ];
  for (const path of consumers) {
    assert.match(readFileSync(join(process.cwd(), path), "utf8"), /RecordProgressModal/);
  }

  assert.match(readFileSync(join(process.cwd(), consumers[2]!), "utf8"), /Record Progress/);
  const taskTable = readFileSync(join(process.cwd(), consumers[1]!), "utf8");
  assert.match(taskTable, /initialFollowUpId=\{progressTarget\.id\}/);
  assert.match(taskTable, /Record progress and review task completion/);
  assert.match(taskTable, /aria-label=\{fu\.lead \? "Record progress and review task completion"/);
});

test("manual lead creation uses the required initial interaction form and one create endpoint", () => {
  const addLead = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  assert.match(addLead, /ActivityFormFields/);
  assert.match(addLead, /initialActivity/);
  assert.match(addLead, /axios\.post\("\/api\/leads"/);
});

test("Create Lead uses three initially collapsed shared accordion sections while Edit Lead keeps its layout", () => {
  const addLead = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const accordion = readFileSync(join(process.cwd(), "src/components/ui/accordion-section.tsx"), "utf8");
  const sectionCount = addLead.match(/<AccordionSection\b/g)?.length ?? 0;

  assert.equal(sectionCount, 3);
  assert.match(addLead, /title="Lead Information"[\s\S]*status="Required"/);
  assert.match(addLead, /title="Lead Classification"[\s\S]*status="Optional"/);
  assert.match(addLead, /title="Initial Customer Interaction"[\s\S]*status="Required"/);
  assert.match(addLead, /leadInformation: false,[\s\S]*classification: false,[\s\S]*interaction: false/);
  assert.match(addLead, /setExpandedSections\(\{ leadInformation: false, classification: false, interaction: false \}\)/);
  assert.match(addLead, /expanded=\{expandedSections\.leadInformation\}[\s\S]*onToggle=\{\(\) => setExpandedSections/);
  assert.match(addLead, /expanded=\{expandedSections\.classification\}[\s\S]*onToggle=\{\(\) => setExpandedSections/);
  assert.match(addLead, /expanded=\{expandedSections\.interaction\}[\s\S]*onToggle=\{\(\) => setExpandedSections/);
  assert.match(addLead, /value=\{name\}[\s\S]*value=\{email\}[\s\S]*value=\{phone\}/);
  assert.match(addLead, /value=\{status\}[\s\S]*value=\{priority\}[\s\S]*value=\{category\}/);
  assert.match(addLead, /action=\{activityAction\}[\s\S]*response=\{activityResponse\}[\s\S]*interest=\{activityInterest\}[\s\S]*notes=\{activityNotes\}/);
  assert.match(accordion, /aria-expanded=\{expanded\}/);
  assert.match(accordion, /aria-controls=\{panelId\}/);
  assert.match(accordion, /hidden=\{!expanded\}/);
  assert.match(addLead, /\{isEdit \? \([\s\S]*basicInformationFields[\s\S]*classificationFields[\s\S]*contactFields[\s\S]*requirementFields[\s\S]*\) : \([\s\S]*<AccordionSection/);
  assert.match(addLead, /ActivityFormFields[\s\S]*idPrefix="initial-activity"/);
  assert.match(addLead, /await axios\.post\("\/api\/leads", parsed\.data\)/);
});

test("Create Lead validation expands all affected sections and focuses its first invalid field", () => {
  const result = getLeadCreateValidationTarget([
    { path: ["name"] },
    { path: ["priority"] },
    { path: ["initialActivity", "response"] },
  ]);

  assert.deepEqual(result.sections, ["leadInformation", "classification", "interaction"]);
  assert.equal(result.firstElementId, "lead-name");

  const modal = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  assert.match(modal, /getLeadCreateValidationTarget\(issues\)/);
  assert.match(modal, /focusAfterExpansion\.current = target\.firstElementId/);
  assert.match(modal, /if \(element && !element\.closest\("\[hidden\]"\)\) element\.focus\(\)/);
});

test("Create Lead modal sizes to content and scrolls only its body while Edit keeps fixed sizing", () => {
  const modal = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");

  assert.match(modal, /isEdit \? "items-start" : "items-center p-3 sm:p-5"/);
  assert.match(modal, /isEdit \? "mt-6 mb-6" : "max-h-\[90dvh\]"/);
  assert.match(modal, /style=\{isEdit \? \{ height: "88vh", maxHeight: "88vh" \} : undefined\}/);
  assert.match(modal, /isEdit \? "" : "min-h-0"/);
  assert.match(modal, /flex-1 overflow-y-auto p-6/);
  assert.match(modal, /border-b[^\"]*shrink-0/);
  assert.match(modal, /border-t[^\"]*shrink-0/);
});

test("the obsolete Log Activity modal is absent and Record Progress owns interaction POSTs", () => {
  assert.equal(existsSync(join(componentsRoot, "sales/log-activity-modal.tsx")), false);
  const files = sourceFiles(componentsRoot);
  const oldComponentReferences = files.filter((path) => /LogActivityModal|log-activity-modal/.test(readFileSync(path, "utf8")));
  assert.deepEqual(oldComponentReferences, []);

  const directProgressPosts = files.filter((path) => /axios\.post\(\s*`[^`]*\/activities`/.test(readFileSync(path, "utf8")));
  assert.deepEqual(directProgressPosts.map((path) => relative(process.cwd(), path)), ["src/components/leads/record-progress-modal.tsx"]);
});

test("standalone scheduling and compatibility Note/follow-up APIs remain available", () => {
  const details = readFileSync(join(process.cwd(), "src/components/sales/lead-details-modal.tsx"), "utf8");
  assert.match(details, /\/api\/leads\/\$\{leadId\}\/follow-ups/);
  assert.match(details, /onRecordProgress=/);
  assert.equal(existsSync(join(process.cwd(), "src/app/api/follow-ups/[id]/complete/route.ts")), true);
  assert.equal(existsSync(join(process.cwd(), "src/app/api/leads/[id]/notes/route.ts")), true);
  assert.equal(existsSync(join(process.cwd(), "src/app/api/notes/[id]/route.ts")), true);
});
