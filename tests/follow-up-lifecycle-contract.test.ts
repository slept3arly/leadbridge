import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("all application scheduling entry points use the shared transactional scheduler", () => {
  const service = source("src/services/follow-up.service.ts");
  assert.match(service, /SELECT "id" FROM "Lead" WHERE "id" = \$\{leadId\} FOR UPDATE/);
  assert.match(service, /status: \"PENDING\"[\s\S]*pending\.length > 1/);
  assert.match(service, /scheduleInTransaction/);
  assert.match(service, /autoCompleted: true/);
  assert.match(service, /SUPERSEDED_BY_NEW_FOLLOW_UP/);
  assert.match(service, /supersededByFollowUpId: followUp\.id/);
  assert.match(service, /status: \"CANCELLED\", cancelledAt: now/);
  assert.doesNotMatch(service, /followUp\.delete\(/);

  for (const [path, expected] of [
    ["src/services/lead.service.ts", "scheduleInTransaction"],
    ["src/services/lead-workflow.service.ts", "scheduleInTransaction"],
    ["src/services/note.service.ts", "scheduleInTransaction"],
  ]) assert.match(source(path), new RegExp(expected));
  assert.match(source("src/app/api/leads/[id]/follow-ups/route.ts"), /followUpService\.create/);
});

test("PostgreSQL migration adds cancellation timestamp and refuses pre-existing pending conflicts", () => {
  const migration = source("prisma/migrations/20261109100000_followup_one_pending_per_lead/migration.sql");
  assert.match(migration, /ALTER TABLE "FollowUp" ADD COLUMN "cancelledAt" TIMESTAMP\(3\)/);
  assert.match(migration, /HAVING count\(\*\) > 1/);
  assert.match(migration, /RAISE EXCEPTION/);
  assert.match(migration, /CREATE UNIQUE INDEX "FollowUp_one_pending_per_lead"[\s\S]*WHERE "status" = 'PENDING'/);
});
