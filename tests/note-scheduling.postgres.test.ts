import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.LEADBRIDGE_TEST_DATABASE_URL;

test("PostgreSQL note creation atomically persists or omits requested follow-ups", { skip: !databaseUrl }, async (t) => {
  assert.ok(databaseUrl);
  assert.match(new URL(databaseUrl).pathname, /test/i, "refusing to run against a database not named as a test database");
  process.env.DATABASE_URL = databaseUrl;

  const [{ prisma }, { noteService }, { createNoteSchema }] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/services/note.service"),
    import("../src/lib/validation"),
  ]);
  const leadIds: string[] = [];
  const userIds: string[] = [];

  async function createFixture(label: string) {
    const token = randomUUID();
    const userId = `note-scheduling-${label}-${token}`;
    const user = await prisma.user.create({
      data: { id: userId, name: `Note ${label}`, email: `${userId}@example.test`, role: "SALES" },
    });
    userIds.push(user.id);
    const lead = await prisma.lead.create({
      data: { displayName: `Note scheduling ${label}`, assignedUserId: user.id },
    });
    leadIds.push(lead.id);
    return { actor: { id: user.id, role: "SALES" as const }, leadId: lead.id };
  }

  async function createNote(leadId: string, actor: { id: string; role: "SALES" }, input: Record<string, unknown>) {
    const data = createNoteSchema.parse(input);
    const result = await noteService.create(leadId, {
      content: data.content,
      whatIDid: data.whatIDid,
      whatCustomerSaid: data.whatCustomerSaid,
      scheduleFollowUp: data.scheduleFollowUp,
      followUpDate: data.followUpDate,
      followUpTime: data.followUpTime,
    }, actor);
    return result.note;
  }

  try {
    await t.test("scheduled note creates its follow-up and event entries in the same transaction", async () => {
      const fixture = await createFixture("scheduled");
      const note = await createNote(fixture.leadId, fixture.actor, {
        whatIDid: "Called the customer",
        scheduleFollowUp: true,
        followUpDate: "2030-04-03",
        followUpTime: "14:30",
      });

      const followUps = await prisma.followUp.findMany({ where: { leadId: fixture.leadId } });
      assert.equal(followUps.length, 1);
      assert.equal(followUps[0]?.noteId, note.id);
      assert.equal(followUps[0]?.status, "PENDING");
      assert.equal(followUps[0]?.dueDate?.toISOString(), "2030-04-03T14:30:00.000Z");

      const events = await prisma.activityEvent.findMany({ where: { leadId: fixture.leadId }, include: { entries: true } });
      assert.equal(events.length, 1);
      assert.equal(events[0]?.type, "NOTE");
      assert.deepEqual(events[0]?.entries.map((entry) => entry.type).sort(), ["FOLLOW_UP_SCHEDULED", "NOTE_ADDED"].sort());

      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadId } });
      assert.equal(lead.nextFollowUpAt?.toISOString(), "2030-04-03T14:30:00.000Z");
      assert.equal(lead.lastFollowUpAt, null);
    });

    await t.test("disabled scheduling creates the note and event without a follow-up", async () => {
      const fixture = await createFixture("disabled");
      const note = await createNote(fixture.leadId, fixture.actor, {
        whatIDid: "Added a note",
        scheduleFollowUp: false,
      });

      assert.ok(await prisma.note.findUnique({ where: { id: note.id } }));
      assert.equal(await prisma.followUp.count({ where: { leadId: fixture.leadId } }), 0);
      const events = await prisma.activityEvent.findMany({ where: { leadId: fixture.leadId }, include: { entries: true } });
      assert.equal(events.length, 1);
      assert.deepEqual(events[0]?.entries.map((entry) => entry.type), ["NOTE_ADDED"]);
    });

    await t.test("disabled scheduling ignores an optional valid date", async () => {
      const fixture = await createFixture("disabled-date");
      await createNote(fixture.leadId, fixture.actor, {
        whatIDid: "Added a note",
        scheduleFollowUp: false,
        followUpDate: "2030-04-03",
      });

      assert.equal(await prisma.followUp.count({ where: { leadId: fixture.leadId } }), 0);
      assert.equal(await prisma.activityEvent.count({ where: { leadId: fixture.leadId } }), 1);
    });

    await t.test("a failed follow-up persistence rolls back the note and event", async () => {
      const fixture = await createFixture("rollback");
      await assert.rejects(createNote(fixture.leadId, fixture.actor, {
        whatIDid: "This note must roll back",
        scheduleFollowUp: true,
        followUpDate: "2030-04-03",
        followUpTime: "not-a-time",
      }));

      assert.equal(await prisma.note.count({ where: { leadId: fixture.leadId } }), 0);
      assert.equal(await prisma.followUp.count({ where: { leadId: fixture.leadId } }), 0);
      assert.equal(await prisma.activityEvent.count({ where: { leadId: fixture.leadId } }), 0);
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadId } });
      assert.equal(lead.nextFollowUpAt, null);
      assert.equal(lead.lastFollowUpAt, null);
    });
  } finally {
    if (leadIds.length) await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
