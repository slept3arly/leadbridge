import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getLeadCreateValidationTarget } from "../src/lib/lead-create-accordion";
import { CREATE_LEAD_FIELD_ORDER, findNextCreateLeadFieldId, isEnterNavigationInput, shouldAdvanceFromSelect } from "../src/lib/create-lead-enter-navigation";
import { Select } from "../src/components/ui/select";

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
  const leadService = readFileSync(join(process.cwd(), "src/services/lead.service.ts"), "utf8");
  assert.match(addLead, /ActivityFormFields/);
  assert.match(addLead, /initialActivity/);
  assert.match(addLead, /axios\.post\("\/api\/leads"/);
  assert.match(addLead, /if \(pending\) return/);
  assert.match(addLead, /response\?\.status === 409/);
  assert.match(addLead, /message && typeof message === "object" && "fieldErrors" in message/);
  assert.match(leadService, /scheduleInTransaction\(tx/);
});

test("Create Lead uses a full-screen two-column layout and the required field order", () => {
  const addLead = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const activityFields = readFileSync(join(process.cwd(), "src/components/sales/activity-fields.tsx"), "utf8");
  assert.match(addLead, /absolute inset-0 z-10 flex h-\[100dvh\] flex-col bg-white/);
  assert.match(addLead, /grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2/);
  assert.match(addLead, /overflow-y-auto border-b border-\[var\(--color-border\)\] p-5 sm:p-8 lg:border-b-0 lg:border-r/);
  assert.match(addLead, /<header[\s\S]*Create Lead[\s\S]*<footer/);
  assert.doesNotMatch(addLead, /AccordionSection|expandedSections/);

  const info = addLead.slice(addLead.indexOf("const createLeadInformationFields"), addLead.indexOf("const createLeadInteractionFields"));
  const orderedLabels = ["Name", "Company", "City", "District", "State", "Phone", "Email", "Category", "Lead Source"];
  let priorIndex = -1;
  for (const label of orderedLabels) {
    const index = info.search(new RegExp(`label="${label}"`));
    assert.ok(index > priorIndex, `${label} follows the required left-column order`);
    priorIndex = index;
  }
  assert.ok(info.indexOf('label="City"') < info.indexOf('label="District"'), "City precedes District");
  const emailIndex = info.indexOf('label="Email"');
  const categoryIndex = info.indexOf('label="Category"');
  const sourceIndex = info.indexOf('label="Lead Source"');
  assert.match(info, /label="Email" htmlFor="lead-email" className="sm:col-span-2"/);
  assert.ok(emailIndex < categoryIndex && categoryIndex < sourceIndex, "full-width Email precedes the Category and Lead Source row");
  assert.match(info, /grid grid-cols-1 gap-4 sm:grid-cols-2/);

  const interaction = addLead.slice(addLead.indexOf("const createLeadInteractionFields"), addLead.indexOf("if (!open) return null;"));
  assert.match(interaction, /betweenResponseAndInterest=\{[\s\S]*label="Status"[\s\S]*label="Priority"/);
  assert.ok(
    interaction.search(/label="Status"/) < interaction.search(/label="Priority"/),
    "Status precedes Priority in the classification slot",
  );

  priorIndex = -1;
  for (const marker of ["Action{guidance", "Response{guidance", "{betweenResponseAndInterest}", "Interest{guidance", "Notes{guidance", "Schedule follow-up"]) {
    const index = activityFields.indexOf(marker);
    assert.ok(index > priorIndex, `${marker} follows the required right-column order`);
    priorIndex = index;
  }

  assert.match(addLead, /ActivityFormFields[\s\S]*idPrefix="initial-activity"[\s\S]*centralizedInterestLabels/);
  assert.match(addLead, /scheduleFollowUp,[\s\S]*followUpDate,[\s\S]*followUpTime/);
  assert.doesNotMatch(info + interaction, /Product/i);
  assert.match(addLead, /await axios\.post\("\/api\/leads", parsed\.data\)/);
});

test("Create Lead places Action and Response in one equal-width row that stacks on narrow screens", () => {
  const addLead = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const activityFields = readFileSync(join(process.cwd(), "src/components/sales/activity-fields.tsx"), "utf8");

  assert.match(addLead, /ActivityFormFields[\s\S]*actionResponseInline[\s\S]*centralizedInterestLabels/);
  assert.match(
    activityFields,
    /actionResponseInline \? \(\s*<div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">\s*\{actionField\}\s*\{responseField\}\s*<\/div>\s*\) : \(/,
  );
  assert.match(activityFields, /<\/div>\s*\) : \(\s*<>\s*\{actionField\}\s*\{responseField\}\s*<\/>/);
});

test("Create Lead Enter navigation walks the two-column visual order across both columns", () => {
  assert.equal(findNextCreateLeadFieldId("lead-name"), "lead-company");
  assert.equal(findNextCreateLeadFieldId("lead-company"), "lead-city");
  assert.equal(findNextCreateLeadFieldId("lead-email"), "lead-category");
  assert.equal(findNextCreateLeadFieldId("lead-source"), "lead-assigned");
  assert.equal(findNextCreateLeadFieldId("lead-assigned"), "initial-activity-action");
  assert.equal(findNextCreateLeadFieldId("initial-activity-action"), "initial-activity-response");
  assert.equal(findNextCreateLeadFieldId("initial-activity-response"), "lead-status");
  assert.equal(findNextCreateLeadFieldId("lead-priority"), "initial-activity-interest");
  assert.equal(findNextCreateLeadFieldId("initial-activity-interest"), "initial-activity-notes");
  assert.equal(CREATE_LEAD_FIELD_ORDER[CREATE_LEAD_FIELD_ORDER.length - 1], "create-lead-submit");
});

test("Create Lead Enter navigation skips conditional, disabled, and hidden fields", () => {
  const without = (...hidden: string[]) => (id: string) => !hidden.includes(id);

  assert.equal(findNextCreateLeadFieldId("lead-source", without("lead-assigned")), "initial-activity-action");
  assert.equal(findNextCreateLeadFieldId("lead-priority", without("initial-activity-interest")), "initial-activity-notes");
  assert.equal(
    findNextCreateLeadFieldId("initial-activity-schedule-toggle", without("initial-activity-follow-up-date", "initial-activity-follow-up-time")),
    "create-lead-submit",
  );
  assert.equal(findNextCreateLeadFieldId("initial-activity-schedule-toggle"), "initial-activity-follow-up-date");
  assert.equal(findNextCreateLeadFieldId("initial-activity-follow-up-time"), "create-lead-submit");
  assert.equal(findNextCreateLeadFieldId("create-lead-submit"), null);
});

test("Create Lead advances from a select only after a committed selection closes the picker", () => {
  // Open picker: the selecting Enter must reach the native picker untouched.
  assert.equal(shouldAdvanceFromSelect(true, false), false);
  assert.equal(shouldAdvanceFromSelect(true, true), false);
  // Closed without a committed selection (dismissed): Enter should reopen, not advance.
  assert.equal(shouldAdvanceFromSelect(false, false), false);
  // Closed with a committed selection: the next Enter moves focus onward.
  assert.equal(shouldAdvanceFromSelect(false, true), true);
});

test("Create Lead handles custom dropdowns before single-line inputs and wires blur for Create only", () => {
  const modal = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const recordProgress = readFileSync(join(process.cwd(), "src/components/leads/record-progress-modal.tsx"), "utf8");
  const selectBranch = modal.indexOf('target.getAttribute("role") === "combobox"');
  const inputBranch = modal.indexOf("isEnterNavigationInput({ tagName: target.tagName");

  assert.ok(selectBranch > -1);
  assert.ok(inputBranch > selectBranch);
  assert.match(modal, /target\.getAttribute\("data-select-value-committed"\) === "true"/);
  assert.match(modal, /if \(target\.getAttribute\("role"\) === "combobox"\) target\.removeAttribute\("data-select-value-committed"\)/);
  assert.doesNotMatch(recordProgress, /shouldAdvanceFromSelect|handleCreateLeadChange|handleCreateLeadBlur/);
});

test("Enter navigation applies only to single-line inputs and leaves selects and Notes alone", () => {
  assert.equal(isEnterNavigationInput({ tagName: "INPUT", type: "text" }), true);
  assert.equal(isEnterNavigationInput({ tagName: "INPUT", type: "email" }), true);
  assert.equal(isEnterNavigationInput({ tagName: "INPUT", type: "tel" }), true);
  assert.equal(isEnterNavigationInput({ tagName: "INPUT", type: "date" }), true);
  assert.equal(isEnterNavigationInput({ tagName: "SELECT" }), false);
  assert.equal(isEnterNavigationInput({ tagName: "TEXTAREA" }), false);
  assert.equal(isEnterNavigationInput({ tagName: "BUTTON", type: "button" }), false);
});

test("Create Lead wires Enter navigation without changing Record Progress", () => {
  const modal = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const activityFields = readFileSync(join(process.cwd(), "src/components/sales/activity-fields.tsx"), "utf8");
  const recordProgress = readFileSync(join(process.cwd(), "src/components/leads/record-progress-modal.tsx"), "utf8");

  assert.match(modal, /import \{ CREATE_LEAD_FIELD_ORDER, findNextCreateLeadFieldId, isEnterNavigationInput, shouldAdvanceFromSelect \}/);
  assert.match(modal, /onKeyDown=\{handleCreateLeadKeyDown\}/);
  assert.match(modal, /onBlur=\{handleCreateLeadBlur\}/);
  assert.match(modal, /if \(isEdit \|\| event\.key !== "Enter" \|\| event\.defaultPrevented\) return/);
  assert.match(modal, /if \(event\.shiftKey \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey\) return/);
  assert.match(modal, /if \(event\.nativeEvent\.isComposing\) return/);
  assert.match(modal, /CREATE_LEAD_FIELD_ORDER\.includes\(target\.id\)/);
  assert.match(modal, /event\.preventDefault\(\)/);
  assert.match(modal, /element\.closest\("\[inert\]"\)/);
  assert.match(modal, /id=\{isEdit \? undefined : "create-lead-submit"\}/);
  assert.match(modal, /onClick=\{\(\) => formRef\.current\?\.requestSubmit\(\)\}/);
  assert.match(activityFields, /id=\{`\$\{idPrefix\}-schedule-toggle`\}/);
  assert.doesNotMatch(recordProgress, /handleCreateLeadKeyDown|create-lead-enter-navigation/);
});

test("Create Lead uses a compact Notes textarea while Record Progress keeps its height", () => {
  const addLead = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const activityFields = readFileSync(join(process.cwd(), "src/components/sales/activity-fields.tsx"), "utf8");
  const recordProgress = readFileSync(join(process.cwd(), "src/components/leads/record-progress-modal.tsx"), "utf8");
  const createUi = addLead.slice(addLead.indexOf("const createLeadInteractionFields"), addLead.indexOf("if (!open) return null;"));

  assert.match(createUi, /compactNotes/);
  assert.match(activityFields, /compactNotes \? "h-\[60px\] min-h-\[60px\] resize-none" : "resize-none"/);
  assert.match(activityFields, /placeholder="Add a note about the interaction"/);
  assert.match(activityFields, /value=\{notes\} onChange=\{\(e\) => onNotesChange\(e\.target\.value\)\} rows=\{3\}/);
  assert.doesNotMatch(recordProgress, /compactNotes/);
});

test("Create Lead removes subtitles and the contact-method helper message", () => {
  const addLead = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const activityFields = readFileSync(join(process.cwd(), "src/components/sales/activity-fields.tsx"), "utf8");
  const createUi = addLead.slice(addLead.indexOf("const createLeadInformationFields"), addLead.indexOf("if (!open) return null;"));

  for (const removed of [
    "Add lead details and record the initial customer interaction.",
    "Add the lead’s contact and location details.",
    "Set the starting status, priority, and latest requirement.",
    "Record the genuine call or WhatsApp interaction that led to this entry.",
    "Name and one contact method are required.",
  ]) {
    assert.equal(addLead.includes(removed), false, `"${removed}" must not render`);
  }

  const editUi = addLead.slice(addLead.indexOf("const basicInformationFields"), addLead.indexOf("const createLeadInformationFields"));

  assert.doesNotMatch(createUi, /labelSuffix="(?:Optional|Required)"/);
  assert.doesNotMatch(createUi, />Required</);
  assert.doesNotMatch(createUi, /showFieldGuidance/);
  assert.match(editUi, /label="Name" htmlFor="lead-name" labelSuffix="Required"/);
  assert.doesNotMatch(editUi, /labelSuffix="Optional"/);
  assert.match(activityFields, /const guidance = \(value: "Required" \| "Optional"\) => showFieldGuidance \?/);
});

test("approved lead placeholders appear across create, edit, progress, activity, and search", () => {
  const leadForm = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const progress = readFileSync(join(process.cwd(), "src/components/leads/record-progress-modal.tsx"), "utf8");
  const activity = readFileSync(join(process.cwd(), "src/components/sales/activity-fields.tsx"), "utf8");
  const activityEdit = readFileSync(join(process.cwd(), "src/components/sales/lead-details-modal.tsx"), "utf8");
  const tableControls = readFileSync(join(process.cwd(), "src/components/shared/table-controls.tsx"), "utf8");
  const searchToolbar = readFileSync(join(process.cwd(), "src/components/shared/search-toolbar.tsx"), "utf8");

  for (const value of [
    'placeholder="Full name"',
    'placeholder="Company or organization"',
    'placeholder="e.g. Pune"',
    'placeholder="e.g. Andheri West"',
    'placeholder="e.g. Maharashtra"',
    'placeholder="10-digit phone number"',
    'placeholder="name@example.com"',
    "Select category",
    "Select source",
  ]) assert.ok(leadForm.includes(value), `lead form should include ${value}`);

  assert.match(activity, /placeholder="Add a note about the interaction"/);
  assert.match(progress, /placeholder="Add a note about the interaction"/);
  assert.match(activityEdit, /placeholder="Add a note about the interaction"/);
  assert.match(tableControls, /placeholder="Search by name, company, email, phone, or lead number"/);
  assert.match(searchToolbar, /placeholder = "Search by name, company, email, phone, or lead number"/);
  assert.doesNotMatch(leadForm, /Select (?:category|source) \(optional\)/i);
});

test("approved initial defaults and saved edit values remain intact", () => {
  const leadForm = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const progress = readFileSync(join(process.cwd(), "src/components/leads/record-progress-modal.tsx"), "utf8");
  const followUpService = readFileSync(join(process.cwd(), "src/services/follow-up.service.ts"), "utf8");

  assert.match(leadForm, /const \[status, setStatus\] = useState\("NEW"\)/);
  assert.match(leadForm, /const \[priority, setPriority\] = useState\("MEDIUM"\)/);
  assert.match(leadForm, /const \[activityAction, setActivityAction\] = useState\("CALL"\)/);
  assert.match(leadForm, /setStatus\(lead\.status\)/);
  assert.match(leadForm, /setPriority\(lead\.priority\)/);
  assert.match(leadForm, /setActivityAction\("CALL"\)/);
  assert.match(progress, /const \[action, setAction\] = useState\("CALL"\)/);
  assert.match(progress, /const \[status, setStatus\] = useState\(leadProp\?\.status \?\? "NEW"\)/);
  assert.match(progress, /const \[priority, setPriority\] = useState\(leadProp\?\.priority \?\? "MEDIUM"\)/);
  assert.match(progress, /const \[scheduleFollowUp, setScheduleFollowUp\] = useState\(false\)/);
  assert.match(progress, /const \[followUpDate, setFollowUpDate\] = useState\(""\)/);
  assert.match(progress, /const \[followUpTime, setFollowUpTime\] = useState\(""\)/);
  assert.match(followUpService, /priority: \(data\.priority as FollowUpPriority\) \?\? "MEDIUM"/);
});

test("shared Radix dropdown renders controlled and default values, placeholder, disabled, and required states", () => {
  const options = [
    createElement("option", { key: "empty", value: "" }, "Choose an option"),
    createElement("option", { key: "a", value: "a" }, "Alpha"),
    createElement("option", { key: "b", value: "b" }, "Bravo"),
  ];
  const controlled = renderToStaticMarkup(createElement(Select, {
    id: "controlled-select", value: "b", required: true, "aria-describedby": "controlled-error",
  }, ...options));
  const uncontrolled = renderToStaticMarkup(createElement(Select, {
    id: "default-select", defaultValue: "a", disabled: true, placeholder: "Pick a value",
  }, ...options));
  const blank = renderToStaticMarkup(createElement(Select, {
    id: "placeholder-select", placeholder: "Pick a value",
  }, ...options));

  assert.match(controlled, /data-slot="select-value">Bravo</);
  assert.match(controlled, /aria-required="true"/);
  assert.match(controlled, /aria-describedby="controlled-error"/);
  assert.match(uncontrolled, /data-slot="select-value">Alpha</);
  assert.match(uncontrolled, /disabled=""/);
  assert.match(blank, /data-slot="select-value">Pick a value</);
  const source = readFileSync(join(process.cwd(), "src/components/ui/select.tsx"), "utf8");
  assert.match(source, /onChange\(\{ target, currentTarget: target \} as ChangeEvent<HTMLSelectElement>\)/);
  assert.match(source, /onValueChange\?\.\(next\)/);
});

test("application components contain no handwritten native select controls", () => {
  const sourceRoot = join(process.cwd(), "src");
  const nativeSelects = sourceFiles(sourceRoot).filter((path) => /<select(?:\s|>)/.test(readFileSync(path, "utf8")));
  assert.deepEqual(nativeSelects, []);
});

test("Create Lead uses an accessible follow-up toggle and omits scheduling values when off", () => {
  const addLead = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const activityFields = readFileSync(join(process.cwd(), "src/components/sales/activity-fields.tsx"), "utf8");
  const recordProgress = readFileSync(join(process.cwd(), "src/components/leads/record-progress-modal.tsx"), "utf8");
  const createUi = addLead.slice(addLead.indexOf("const createLeadInteractionFields"), addLead.indexOf("if (!open) return null;"));

  assert.match(createUi, /scheduleToggle/);
  assert.match(activityFields, /role="switch"/);
  assert.match(activityFields, /aria-checked=\{scheduleFollowUp\}/);
  assert.match(activityFields, /aria-controls=\{`\$\{idPrefix\}-schedule-fields`\}/);
  assert.match(activityFields, /Schedule a follow-up/);
  assert.match(activityFields, /inert=\{!scheduleFollowUp\}/);
  assert.match(activityFields, /transition-all duration-200/);
  assert.match(activityFields, /grid-rows-\[1fr\][\s\S]*grid-rows-\[0fr\]/);
  assert.doesNotMatch(recordProgress, /scheduleToggle/);

  assert.match(addLead, /followUpDate: scheduleFollowUp \? followUpFormDate\(followUpDate, followUpTime\) : null/);
  assert.match(addLead, /followUpTime: scheduleFollowUp \? followUpTime \|\| null : null/);
  assert.match(addLead, /if \(!value\) \{ setFollowUpDate\(""\); setFollowUpTime\(""\); \}/);
});

test("Create Lead stops rendering and submitting Latest Requirement while Edit keeps it", () => {
  const addLead = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  const createUi = addLead.slice(addLead.indexOf("const createLeadInformationFields"), addLead.indexOf("if (!open) return null;"));
  const editUi = addLead.slice(addLead.indexOf("const requirementFields"), addLead.indexOf("const createLeadInformationFields"));

  assert.doesNotMatch(createUi, /Latest Requirement|lead-requirement|requirement/);
  assert.match(editUi, /label="Requirement" htmlFor="lead-requirement"/);
  assert.match(addLead, /if \(isEdit\) \{\s*payload\.requirement = requirement \|\| null;/);
  assert.doesNotMatch(addLead, /^\s*requirement: requirement \|\| null,/m);
});

test("Create Lead validation focuses the first invalid visible field", () => {
  const result = getLeadCreateValidationTarget([
    { path: ["name"] },
    { path: ["priority"] },
    { path: ["initialActivity", "response"] },
  ]);

  assert.deepEqual(result.sections, ["leadInformation", "classification", "interaction"]);
  assert.equal(result.firstElementId, "lead-name");

  const modal = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");
  assert.match(modal, /getLeadCreateValidationTarget\(issues\)/);
  assert.match(modal, /focusAfterValidation\.current = target\.firstElementId/);
  assert.match(modal, /document\.getElementById\(elementId\)\?\.focus\(\)/);
  assert.match(modal, /setDistrictError\(districtIssue\?\.message \?\? null\)/);
});

test("Create Lead keeps its header and footer visible while Edit Lead retains its sizing", () => {
  const modal = readFileSync(join(process.cwd(), "src/components/leads/lead-edit-modal.tsx"), "utf8");

  assert.match(modal, /isEdit \? "relative z-10 mt-6 mb-6 flex h-\[88vh\]/);
  assert.match(modal, /style=\{isEdit \? \{ height: "88vh", maxHeight: "88vh" \} : undefined\}/);
  assert.match(modal, /isEdit \? "flex-1 overflow-y-auto p-6" : "min-h-0 flex-1"/);
  assert.match(modal, /<footer className=\{`flex shrink-0/);
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
