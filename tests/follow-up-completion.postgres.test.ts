import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ServiceError } from "../src/lib/service-errors";

const databaseUrl = process.env.LEADBRIDGE_TEST_DATABASE_URL;

test("PostgreSQL follow-up completion is an atomic pending-to-completed transition", { skip: !databaseUrl }, async (t) => {
  assert.ok(databaseUrl);
  assert.match(new URL(databaseUrl).pathname, /test/i, "refusing to run against a database not named as a test database");
  process.env.DATABASE_URL = databaseUrl;

  const [{ prisma }, { followUpService }] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/services/follow-up.service"),
  ]);
  const leadIds: string[] = [];
  const userIds: string[] = [];

  async function createFixture(label: string) {
    const token = randomUUID();
    const userId = `follow-up-completion-${label}-${token}`;
    const leadId = `follow-up-completion-lead-${token}`;
    const followUpId = `follow-up-completion-task-${token}`;
    const user = await prisma.user.create({
      data: { id: userId, name: `Completion ${label}`, email: `${userId}@example.test`, role: "SALES" },
    });
    userIds.push(user.id);
    const lead = await prisma.lead.create({
      data: { id: leadId, displayName: `Completion ${label}`, assignedUserId: user.id },
    });
    leadIds.push(lead.id);
    const followUp = await prisma.followUp.create({
      data: {
        id: followUpId,
        title: `Completion ${label}`,
        dueDate: new Date("2030-01-01T10:00:00.000Z"),
        leadId: lead.id,
        assignedUserId: user.id,
        createdById: user.id,
      },
    });
    await followUpService.recalculateLeadFollowUpFields(lead.id);
    return { actor: { id: user.id, role: "SALES" as const }, leadId: lead.id, followUpId: followUp.id, userId: user.id };
  }

  try {
    await t.test("normal completion records one event and duplicate completion returns conflict without side effects", async () => {
      const fixture = await createFixture("normal");
      const result = await followUpService.complete(fixture.followUpId, {
        note: "Completion note",
        activity: { action: "CALL", response: "NO_RESPONSE", interest: null, notes: "No answer" },
      }, fixture.actor);

      assert.equal(result.completedFollowUp.status, "COMPLETED");
      assert.equal(result.nextFollowUp, null);
      assert.ok(result.completedFollowUp.completedAt);

      const completionEvents = await prisma.activityEvent.findMany({
        where: { leadId: fixture.leadId, entries: { some: { followUpId: fixture.followUpId, type: "FOLLOW_UP_COMPLETED" } } },
        include: { entries: true },
      });
      assert.equal(completionEvents.length, 1);
      assert.equal(completionEvents[0]?.actorId, fixture.userId);
      assert.deepEqual(
        completionEvents[0]?.entries.map((entry) => entry.type).sort(),
        ["CALL", "FOLLOW_UP_COMPLETED", "NOTE_ADDED"].sort(),
      );

      let duplicateError: unknown;
      try {
        await followUpService.complete(fixture.followUpId, {
          nextFollowUp: { dueDate: "2030-02-01T10:00:00.000Z" },
          activity: { action: "WHATSAPP", response: "NO_RESPONSE", interest: null },
        }, fixture.actor);
      } catch (error) {
        duplicateError = error;
      }
      assert.ok(duplicateError instanceof ServiceError);
      assert.equal(duplicateError.status, 409);
      assert.match(duplicateError.message, /no longer pending/i);

      assert.equal(await prisma.activityEvent.count({ where: { leadId: fixture.leadId } }), 1);
      assert.equal(await prisma.followUp.count({ where: { leadId: fixture.leadId } }), 1);
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadId } });
      assert.equal(lead.lastFollowUpAt?.getTime(), result.completedFollowUp.completedAt?.getTime());
      assert.equal(lead.nextFollowUpAt, null);
    });

    await t.test("concurrent requests create one completion event and at most one next follow-up", async () => {
      const fixture = await createFixture("concurrent");
      const nextDueDate = new Date("2030-03-01T10:00:00.000Z");
      const request = () => followUpService.complete(fixture.followUpId, {
        note: "Completed concurrently",
        activity: { action: "CALL", response: "PICKED_UP", interest: "INTERESTED", notes: "Spoke to customer" },
        nextFollowUp: { dueDate: nextDueDate, dueTime: "10:00" },
      }, fixture.actor);

      const outcomes = await Promise.allSettled([request(), request()]);
      const successes = outcomes.filter((outcome) => outcome.status === "fulfilled");
      const failures = outcomes.filter((outcome) => outcome.status === "rejected");
      assert.equal(successes.length, 1, "exactly one request should claim the pending transition");
      assert.equal(failures.length, 1, "the competing request should receive a conflict");
      if (failures[0]?.status === "rejected") {
        assert.ok(failures[0].reason instanceof ServiceError);
        assert.equal(failures[0].reason.status, 409);
      }

      const completionEvents = await prisma.activityEvent.findMany({
        where: { leadId: fixture.leadId, entries: { some: { followUpId: fixture.followUpId, type: "FOLLOW_UP_COMPLETED" } } },
        include: { entries: true },
      });
      assert.equal(completionEvents.length, 1);
      assert.equal(completionEvents[0]?.actorId, fixture.userId);
      assert.deepEqual(
        completionEvents[0]?.entries.map((entry) => entry.type).sort(),
        ["CALL", "FOLLOW_UP_COMPLETED", "FOLLOW_UP_SCHEDULED", "NOTE_ADDED"].sort(),
      );

      const followUps = await prisma.followUp.findMany({ where: { leadId: fixture.leadId }, orderBy: { createdAt: "asc" } });
      assert.equal(followUps.length, 2, "only the winning request should create a next follow-up");
      assert.equal(followUps.filter((followUp) => followUp.status === "COMPLETED").length, 1);
      assert.equal(followUps.filter((followUp) => followUp.status === "PENDING").length, 1);

      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadId } });
      const completedFollowUp = followUps.find((followUp) => followUp.status === "COMPLETED");
      const pendingFollowUp = followUps.find((followUp) => followUp.status === "PENDING");
      assert.equal(lead.lastFollowUpAt?.getTime(), completedFollowUp?.completedAt?.getTime());
      assert.equal(lead.nextFollowUpAt?.getTime(), pendingFollowUp?.dueDate?.getTime());
    });
  } finally {
    if (leadIds.length) await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
