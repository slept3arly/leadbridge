import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildLeadWorkspaceTimeline, organizeLeadWorkspaceFollowUps } from "../src/lib/lead-workspace";
import type { ActivityEventItem, LeadFollowUp, LeadNote } from "../src/hooks/use-lead-details";

const event = (id: string, occurredAt: string, type = "INTERACTION", entries: ActivityEventItem["entries"] = []): ActivityEventItem => ({
  id,
  type,
  occurredAt,
  createdAt: occurredAt,
  actor: null,
  metadata: null,
  entries,
});

const note = (id: string, createdAt: string, content: string): LeadNote => ({
  id,
  content,
  whatIDid: null,
  whatCustomerSaid: null,
  createdAt,
  editedAt: createdAt,
  authorId: "author-1",
  author: { id: "author-1", name: "Salesperson" },
});

test("workspace timeline joins saved note content and adds legacy notes once, newest first", () => {
  const joined = event("event-1", "2035-04-10T10:00:00.000Z", "NOTE", [{
    id: "entry-1",
    type: "NOTE_ADDED",
    action: null,
    response: null,
    interest: null,
    message: "Note added",
    metadata: { noteId: "note-1" },
    followUpId: null,
    followUp: null,
    createdAt: "2035-04-10T10:00:00.000Z",
  }]);
  const timeline = buildLeadWorkspaceTimeline(
    [event("newer", "2035-04-12T10:00:00.000Z"), joined],
    [note("note-1", "2035-04-10T10:00:00.000Z", "Saved content"), note("legacy", "2035-04-11T10:00:00.000Z", "Historical note")],
  );

  assert.deepEqual(timeline.map((item) => item.id), ["newer", "legacy-note-legacy", "event-1"]);
  assert.equal(timeline[2].entries[0].message, "Saved content");
  assert.equal(timeline[1].entries[0].message, "Historical note");
  assert.equal(timeline[1].entries[0].response, null);
});

const followUp = (id: string, status: string, dueDate: string | null, completedAt: string | null = null): LeadFollowUp => ({
  id,
  title: id,
  description: null,
  dueDate,
  dueTime: null,
  priority: "MEDIUM",
  status,
  completedAt,
  noteId: null,
  assignedUser: null,
  createdBy: { id: "creator", name: "Creator" },
  createdAt: "2035-04-01T00:00:00.000Z",
});

test("workspace follow-ups keep all pending tasks, sort next action first, and identify overdue dates", () => {
  const result = organizeLeadWorkspaceFollowUps([
    followUp("later", "PENDING", "2035-04-20T00:00:00.000Z"),
    followUp("overdue", "PENDING", "2035-04-09T00:00:00.000Z"),
    followUp("completed", "COMPLETED", "2035-04-08T00:00:00.000Z", "2035-04-08T12:00:00.000Z"),
    followUp("today", "PENDING", "2035-04-10T00:00:00.000Z"),
  ], new Date("2035-04-10T16:00:00.000Z"));

  assert.deepEqual(result.pending.map((item) => item.id), ["overdue", "today", "later"]);
  assert.deepEqual([...result.overdueIds], ["overdue"]);
  assert.deepEqual(result.completed.map((item) => item.id), ["completed"]);
});

test("Lead Details exposes View Details while keeping Record Progress and permission-gated actions", () => {
  const header = readFileSync("src/components/sales/lead-header.tsx", "utf8");
  const workspace = readFileSync("src/components/sales/lead-details-modal.tsx", "utf8");

  assert.match(header, /onViewDetails/);
  assert.match(header, /View Details/);
  assert.doesNotMatch(header, /Edit Details/);
  assert.match(header, /onRecordProgress/);
  assert.match(header, /canArchive &&/);
  assert.match(header, /canDelete && onDelete/);
  assert.match(workspace, /onEditActivity={!isAdmin \?/);
  assert.match(workspace, /onViewDetails=\{\(\) => setViewDetailsOpen\(true\)\}/);
  assert.match(workspace, /RecordProgressModal/);
  assert.match(workspace, /<ConfirmDialog[\s\S]*title=\{leadDraft\?\.isArchived/);
  assert.match(workspace, /title="Delete lead\?"/);
});

test("Activity and History leads the workspace while assignment and timestamps are separated", () => {
  const workspace = readFileSync("src/components/sales/lead-details-modal.tsx", "utf8");
  const info = readFileSync("src/components/sales/lead-info-section.tsx", "utf8");

  assert.match(workspace, /<main className="order-1[\s\S]*<h3 id="workspace-history-title"[^>]*>Activity and history/);
  assert.doesNotMatch(workspace, /<main[\s\S]*?<LeadInfoSection/);
  const assignment = workspace.slice(workspace.indexOf("aria-label=\"Assigned salesperson\""), workspace.indexOf("<FollowUpsColumn"));
  assert.doesNotMatch(assignment, />Lead owner</);
  assert.match(assignment, />Assigned to</);
  assert.match(assignment, /lead\.assignedUser\?\.name \?\? "Unassigned"/);
  assert.doesNotMatch(assignment, /firstContactedAt|lastContactedAt|closedAt/);
  assert.match(info, /Lead timing/);
  assert.match(info, /First contacted/);
  assert.match(info, /Last contacted/);
  assert.match(info, /Closed/);
});

test("View Details reuses the customer information display and existing edit flow", () => {
  const popup = readFileSync("src/components/sales/lead-details-popup.tsx", "utf8");
  const workspace = readFileSync("src/components/sales/lead-details-modal.tsx", "utf8");
  const info = readFileSync("src/components/sales/lead-info-section.tsx", "utf8");

  assert.match(popup, /role="dialog"/);
  assert.match(popup, /aria-modal="true"/);
  assert.match(popup, /aria-labelledby="lead-view-details-title"/);
  assert.match(popup, /useAccessibleDialog/);
  assert.match(popup, /<h2 id="lead-view-details-title"[^>]*>View Details/);
  assert.match(popup, /<LeadInfoSection lead=\{lead\}/);
  assert.match(popup, /onClick=\{onEdit\}[^>]*data-autofocus/);
  assert.match(workspace, /onEdit=\{\(\) => \{ setViewDetailsOpen\(false\); setEditLeadOpen\(true\); \}\}/);
  assert.match(workspace, /<LeadEditModal[\s\S]*onSaved=\{refresh\}/);
  assert.match(info, /fields\.filter\(\(field\) => displayValue\(field\.value\)\.trim\(\) !== ""\)/);
  assert.match(info, /mailto:/);
  assert.match(info, /tel:/);
});

test("Lead Workspace retains historical Product labels and uses no separate workflow action", () => {
  const history = readFileSync("src/components/sales/daily-history.tsx", "utf8");
  const workspace = readFileSync("src/components/sales/lead-details-modal.tsx", "utf8");

  assert.match(history, /product: "Product"/);
  assert.match(workspace, /onComplete=\{\(id\) => \{ setCompletionFollowUpId\(id\); setProgressScheduleDraft\(null\); setRecordProgressOpen\(true\); \}\}/);
  assert.match(workspace, /RecordProgressModal/);
});
