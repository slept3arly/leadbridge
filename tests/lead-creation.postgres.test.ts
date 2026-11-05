import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createLeadRequestSchema } from "../src/lib/validation";

const databaseUrl = process.env.LEADBRIDGE_TEST_DATABASE_URL;

test("lead creation commits its creation event, optional interaction, and follow-up atomically", { skip: !databaseUrl }, async (t) => {
  assert.ok(databaseUrl);
  assert.match(new URL(databaseUrl).pathname, /test/i, "refusing to run against a database not named as a test database");
  process.env.DATABASE_URL = databaseUrl;

  const [{ prisma }, { leadService }, { activityEventService }, { followUpService }] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/services/lead.service"),
    import("../src/services/activity-event.service"),
    import("../src/services/follow-up.service"),
  ]);
  const marker = randomUUID().replaceAll("-", "");
  const adminId = `create-admin-${marker}`;
  const salesId = `create-sales-${marker}`;
  const secondSalesId = `create-sales-second-${marker}`;
  const leadIds: string[] = [];
  const email = (suffix: string) => `${marker}-${suffix}@example.test`;
  const leadInput = (suffix: string) => ({ name: `Creation ${suffix}`, email: email(suffix) });
  const parsedLead = (input: Record<string, unknown>) => createLeadRequestSchema.parse(input);

  try {
    await prisma.user.create({ data: { id: adminId, name: "Lead Creation Admin", email: email("admin"), role: "ADMIN" } });
    await prisma.user.create({ data: { id: salesId, name: "Lead Creation Sales", email: email("sales"), role: "SALES", salesPrivilege: "SENIOR" } });
    await prisma.user.create({ data: { id: secondSalesId, name: "Second Lead Creation Sales", email: email("sales-second"), role: "SALES", salesPrivilege: "SENIOR" } });

    await t.test("legacy creation writes exactly one CREATED event", async () => {
      const rawPayload = { connectorRecord: { externalId: "raw-legacy", privateValue: "retained internally" } };
      const result = await leadService.create(parsedLead({ ...leadInput("legacy"), rawPayload }), { id: salesId, role: "SALES", salesPrivilege: "SENIOR" });
      assert.equal(result.status, "created");
      if (result.status !== "created") return;
      leadIds.push(result.lead.id);
      const detail = await leadService.getById(result.lead.id, { id: salesId, role: "SALES", salesPrivilege: "SENIOR" });
      assert.equal(detail.name, "Creation legacy");
      assert.equal("company" in detail, true);
      assert.equal("customFields" in detail, true);
      assert.equal("rawPayload" in detail, false);
      const persistedPayload = await prisma.lead.findUnique({ where: { id: result.lead.id }, select: { rawPayload: true } });
      assert.deepEqual(persistedPayload?.rawPayload, rawPayload);
      const events = await prisma.activityEvent.findMany({ where: { leadId: result.lead.id }, include: { entries: true } });
      assert.equal(events.length, 1);
      assert.equal(events[0]?.type, "SYSTEM");
      assert.equal(events[0]?.entries.filter((entry) => entry.type === "CREATED").length, 1);
    });

    await t.test("Sales creation writes a Call and assigns its follow-up under existing policy", async () => {
      const result = await leadService.create(parsedLead({
        ...leadInput("sales"),
        initialActivity: {
          action: "CALL", response: "PICKED_UP", interest: "INTERESTED", notes: "Initial call",
          scheduleFollowUp: true, followUpDate: "2026-12-01T10:00:00.000Z", followUpTime: "10:00",
        },
      }), { id: salesId, role: "SALES", salesPrivilege: "SENIOR" });
      assert.equal(result.status, "created");
      if (result.status !== "created") return;
      leadIds.push(result.lead.id);
      const events = await prisma.activityEvent.findMany({ where: { leadId: result.lead.id }, include: { entries: true } });
      assert.equal(events.filter((event) => event.entries.some((entry) => entry.type === "CREATED")).length, 1);
      const interaction = events.filter((event) => event.type === "INTERACTION");
      assert.equal(interaction.length, 1);
      assert.equal(interaction[0]?.actorId, salesId);
      assert.equal(interaction[0]?.entries.filter((entry) => entry.type === "CALL").length, 1);
      assert.equal(interaction[0]?.entries.filter((entry) => entry.type === "FOLLOW_UP_SCHEDULED").length, 1);
      const followUp = await prisma.followUp.findFirst({ where: { leadId: result.lead.id } });
      assert.equal(followUp?.assignedUserId, salesId);
      assert.equal(followUp?.createdById, salesId);
    });

    await t.test("Admin remains activity author and uses existing Admin follow-up assignment behavior", async () => {
      const result = await leadService.create(parsedLead({
        ...leadInput("admin"), assignedUserId: salesId,
        initialActivity: {
          action: "WHATSAPP", response: "REPLIED", interest: "NOT_INTERESTED", notes: null,
          scheduleFollowUp: true, followUpDate: "2026-12-02T10:00:00.000Z", followUpTime: null,
        },
      }), { id: adminId, role: "ADMIN" });
      assert.equal(result.status, "created");
      if (result.status !== "created") return;
      leadIds.push(result.lead.id);
      const interaction = await prisma.activityEvent.findFirst({ where: { leadId: result.lead.id, type: "INTERACTION" }, include: { entries: true } });
      assert.equal(interaction?.actorId, adminId);
      assert.equal(interaction?.entries.filter((entry) => entry.type === "WHATSAPP").length, 1);
      const followUp = await prisma.followUp.findFirst({ where: { leadId: result.lead.id } });
      assert.equal(followUp?.assignedUserId, adminId);
      assert.equal(followUp?.createdById, adminId);
      assert.equal((await prisma.lead.findUnique({ where: { id: result.lead.id }, select: { assignedUserId: true } }))?.assignedUserId, salesId);
      assert.deepEqual(result.affectedUserIds, [salesId]);

      const updated = await leadService.update(result.lead.id, { status: "ON_HOLD" }, { id: adminId, role: "ADMIN" });
      assert.deepEqual(updated.affectedUserIds, [salesId]);

      const reassigned = await leadService.assign(result.lead.id, secondSalesId, { id: adminId, role: "ADMIN" });
      assert.deepEqual(reassigned.affectedUserIds, [salesId, secondSalesId]);

      const unassigned = await leadService.assign(result.lead.id, null, { id: adminId, role: "ADMIN" });
      assert.deepEqual(unassigned.affectedUserIds, [secondSalesId, null]);
    });

    await t.test("interaction and follow-up failures roll back lead creation", async () => {
      const originalCreateEvent = activityEventService.createEvent;
      activityEventService.createEvent = async (input, client) => {
        if (input.type === "INTERACTION") throw new Error("forced interaction failure");
        return originalCreateEvent.call(activityEventService, input, client);
      };
      try {
        await assert.rejects(leadService.create(parsedLead({
          ...leadInput("rollback-activity"), initialActivity: {
            action: "CALL", response: "NO_RESPONSE", interest: null, notes: null,
            scheduleFollowUp: false, followUpDate: null, followUpTime: null,
          },
        }), { id: salesId, role: "SALES", salesPrivilege: "SENIOR" }), /forced interaction failure/);
      } finally {
        activityEventService.createEvent = originalCreateEvent;
      }
      assert.equal(await prisma.lead.count({ where: { email: email("rollback-activity") } }), 0);

      const originalCreateFollowUp = followUpService.create;
      followUpService.create = async () => { throw new Error("forced follow-up failure"); };
      try {
        await assert.rejects(leadService.create(parsedLead({
          ...leadInput("rollback-follow-up"), initialActivity: {
            action: "WHATSAPP", response: "NO_RESPONSE", interest: null, notes: null,
            scheduleFollowUp: true, followUpDate: "2026-12-03T10:00:00.000Z", followUpTime: null,
          },
        }), { id: salesId, role: "SALES", salesPrivilege: "SENIOR" }), /forced follow-up failure/);
      } finally {
        followUpService.create = originalCreateFollowUp;
      }
      assert.equal(await prisma.lead.count({ where: { email: email("rollback-follow-up") } }), 0);
    });
  } finally {
    if (leadIds.length) await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, salesId, secondSalesId] } } });
    await prisma.$disconnect();
  }
});
