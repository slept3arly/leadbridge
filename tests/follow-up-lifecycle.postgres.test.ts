import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ServiceError } from "../src/lib/service-errors";

const databaseUrl = process.env.LEADBRIDGE_TEST_DATABASE_URL;

test("PostgreSQL shared follow-up lifecycle serializes schedules and preserves cancellation history", { skip: !databaseUrl }, async () => {
  assert.ok(databaseUrl);
  assert.match(new URL(databaseUrl).pathname, /test/i, "refusing to run against a database not named as a test database");
  process.env.DATABASE_URL = databaseUrl;
  const [{ prisma }, { followUpService }] = await Promise.all([
    import("../src/lib/prisma"), import("../src/services/follow-up.service"),
  ]);
  const marker = randomUUID();
  const userId = `lifecycle-user-${marker}`;
  const leadId = `lifecycle-lead-${marker}`;
  const actor = { id: userId, role: "ADMIN" as const };
  try {
    const user = await prisma.user.create({ data: { id: userId, name: "Lifecycle test", email: `${marker}@example.test`, role: "ADMIN" } });
    await prisma.lead.create({ data: { id: leadId, displayName: "Lifecycle test lead" } });
    const index = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'FollowUp_one_pending_per_lead'
    `;
    assert.equal(index.length, 1, "isolated test database must have the pending-follow-up migration applied");
    assert.match(index[0]!.indexdef, /WHERE .*PENDING/i);

    const initial = await followUpService.create({ leadId, title: "First", dueDate: "2030-01-01" }, actor);
    const outcomes = await Promise.allSettled([
      followUpService.create({ leadId, title: "Replacement A", dueDate: "2030-02-01" }, actor),
      followUpService.create({ leadId, title: "Replacement B", dueDate: "2030-03-01" }, actor),
    ]);
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 2);
    const pending = await prisma.followUp.findMany({ where: { leadId, status: "PENDING" } });
    assert.equal(pending.length, 1);
    const old = await prisma.followUp.findUniqueOrThrow({ where: { id: initial.followUp.id } });
    assert.equal(old.status, "COMPLETED");
    assert.ok(old.completedAt);
    const autoCompletion = await prisma.activityEntry.findFirstOrThrow({ where: { followUpId: old.id, type: "FOLLOW_UP_COMPLETED" }, include: { event: true } });
    assert.equal(autoCompletion.event.actorId, user.id);
    assert.equal(autoCompletion.metadata && (autoCompletion.metadata as { autoCompleted?: boolean }).autoCompleted, true);
    assert.ok((autoCompletion.metadata as { supersededByFollowUpId?: string }).supersededByFollowUpId);

    const current = pending[0]!;
    const linkedEntry = await prisma.activityEntry.findFirstOrThrow({ where: { followUpId: current.id } });
    const cancelled = await followUpService.remove(current.id, actor);
    assert.equal(cancelled.leadId, leadId);
    const retained = await prisma.followUp.findUniqueOrThrow({ where: { id: current.id } });
    assert.equal(retained.status, "CANCELLED");
    assert.ok(retained.cancelledAt);
    assert.ok(await prisma.activityEntry.findUnique({ where: { id: linkedEntry.id } }));
    await assert.rejects(followUpService.remove(current.id, actor), (error: unknown) => error instanceof ServiceError && error.status === 409);
  } finally {
    await prisma.lead.deleteMany({ where: { id: leadId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
