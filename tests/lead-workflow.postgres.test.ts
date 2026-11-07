import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ServiceError } from "../src/lib/service-errors";
import { createLeadRequestSchema, leadSchema } from "../src/lib/validation";

const databaseUrl = process.env.LEADBRIDGE_TEST_DATABASE_URL;

test("lead workflow service persists creation and progress atomically", { skip: !databaseUrl }, async (t) => {
  assert.ok(databaseUrl);
  assert.match(new URL(databaseUrl).pathname, /test/i, "refusing to run against a database not named as a test database");
  process.env.DATABASE_URL = databaseUrl;

  const [{ prisma }, { leadWorkflowService }, { leadService }, { activityEventService }] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/services/lead-workflow.service"),
    import("../src/services/lead.service"),
    import("../src/services/activity-event.service"),
  ]);
  const marker = randomUUID().replaceAll("-", "");
  const adminId = `workflow-admin-${marker}`;
  const salesId = `workflow-sales-${marker}`;
  const juniorId = `workflow-junior-${marker}`;
  const leadIds: string[] = [];
  const followUpIds: string[] = [];
  const actorAdmin = { id: adminId, role: "ADMIN" as const };
  const actorSales = { id: salesId, role: "SALES" as const, salesPrivilege: "SENIOR" as const };
  const email = (suffix: string) => `${marker}-${suffix}@example.test`;

  async function createLead(suffix: string, assignedUserId: string | null = salesId) {
    const lead = await prisma.lead.create({
      data: { displayName: `Workflow ${suffix}`, email: email(suffix), assignedUserId },
    });
    leadIds.push(lead.id);
    return lead;
  }

  async function createPendingFollowUp(leadId: string, suffix: string) {
    const followUp = await prisma.followUp.create({
      data: {
        title: `Workflow ${suffix}`,
        dueDate: new Date(`2032-01-0${followUpIds.length + 1}T10:00:00.000Z`),
        leadId,
        assignedUserId: salesId,
        createdById: salesId,
      },
    });
    followUpIds.push(followUp.id);
    return followUp;
  }

  try {
    await prisma.user.create({ data: { id: adminId, name: "Workflow Admin", email: email("admin"), role: "ADMIN" } });
    await prisma.user.create({ data: { id: salesId, name: "Workflow Sales", email: email("sales"), role: "SALES", salesPrivilege: "SENIOR" } });
    await prisma.user.create({ data: { id: juniorId, name: "Workflow Junior", email: email("junior"), role: "SALES", salesPrivilege: "JUNIOR" } });

    await t.test("manual creation records exactly one initial interaction and uses the lead owner for follow-up", async () => {
      const result = await leadWorkflowService.createLeadWithInitialActivity({
        name: "Workflow create call",
        email: email("created-call"),
        assignedUserId: salesId,
        initialActivity: {
          action: "CALL", response: "NO_RESPONSE", interest: null, notes: "  ",
          scheduleFollowUp: true, followUpDate: "2032-02-03T10:00:00.000Z", followUpTime: "10:00",
        },
      }, actorAdmin);
      assert.equal(result.status, "created");
      if (result.status !== "created") return;
      leadIds.push(result.lead.id);
      assert.ok(result.interactionEventId);
      const event = await prisma.activityEvent.findUniqueOrThrow({ where: { id: result.interactionEventId }, include: { entries: true } });
      assert.equal(event.type, "INTERACTION");
      assert.deepEqual(event.entries.map((entry) => entry.type).sort(), ["CALL", "FOLLOW_UP_SCHEDULED"].sort());
      assert.equal(event.entries.find((entry) => entry.type === "CALL")?.message, "CALL - NO RESPONSE");
      const task = await prisma.followUp.findFirstOrThrow({ where: { leadId: result.lead.id } });
      followUpIds.push(task.id);
      assert.equal(task.assignedUserId, salesId);
      assert.equal(task.description, null);
      assert.equal(await prisma.note.count({ where: { leadId: result.lead.id } }), 0);
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: result.lead.id } });
      assert.equal(lead.nextFollowUpAt?.getTime(), task.dueDate?.getTime());
    });

    await t.test("WhatsApp creation and unassigned Admin follow-up use the actor as owner", async () => {
      const result = await leadWorkflowService.createLeadWithInitialActivity({
        name: "Workflow create WhatsApp", phone: "1234567890", assignedUserId: null,
        initialActivity: {
          action: "WHATSAPP", response: "REPLIED", interest: "INTERESTED", notes: "Replied",
          scheduleFollowUp: true, followUpDate: "2032-02-04", followUpTime: null,
        },
      }, actorAdmin);
      assert.equal(result.status, "created");
      if (result.status !== "created") return;
      leadIds.push(result.lead.id);
      const task = await prisma.followUp.findFirstOrThrow({ where: { leadId: result.lead.id } });
      followUpIds.push(task.id);
      assert.equal(task.assignedUserId, adminId);
      assert.equal(task.description, null);
      assert.equal(task.dueDate?.toISOString(), "2032-02-04T00:00:00.000Z");
    });

    await t.test("Sales self-assigns and junior Sales cannot create", async () => {
      const result = await leadWorkflowService.createLeadWithInitialActivity({
        name: "Workflow Sales create", email: email("sales-create"),
        initialActivity: { action: "CALL", response: "INVALID_NUMBER", interest: null, notes: null },
      }, actorSales);
      assert.equal(result.status, "created");
      if (result.status === "created") leadIds.push(result.lead.id);
      const created = result.status === "created"
        ? await prisma.lead.findUniqueOrThrow({ where: { id: result.lead.id } })
        : null;
      assert.equal(created?.assignedUserId, salesId);
      await assert.rejects(
        leadWorkflowService.createLeadWithInitialActivity({
          name: "Workflow Junior create", email: email("junior-create"),
          initialActivity: { action: "CALL", response: "NO_RESPONSE", interest: null, notes: null },
        }, { id: juniorId, role: "SALES", salesPrivilege: "JUNIOR" }),
        (error: unknown) => error instanceof ServiceError && error.status === 403,
      );
      await assert.rejects(
        leadWorkflowService.createLeadWithInitialActivity({
          name: "Workflow Sales cannot assign", email: email("sales-other-assignee"), assignedUserId: juniorId,
          initialActivity: { action: "CALL", response: "NO_RESPONSE", interest: null, notes: null },
        }, actorSales),
        (error: unknown) => error instanceof ServiceError && error.status === 403,
      );
    });

    await t.test("Record Progress updates changed fields, completes only the selected task, and schedules an owner-assigned replacement", async () => {
      const lead = await createLead("progress");
      const selected = await createPendingFollowUp(lead.id, "selected");
      const untouched = await createPendingFollowUp(lead.id, "untouched");
      const result = await leadWorkflowService.recordLeadProgress(lead.id, {
        action: "CALL", response: "NO_RESPONSE", interest: null, notes: "No answer",
        status: "ON_HOLD", priority: "HIGH", category: "RETAILER",
        completeFollowUpId: selected.id,
        scheduleFollowUp: true, followUpDate: "2032-03-01T09:30:00-05:00", followUpTime: "09:30",
      }, actorAdmin);

      assert.equal(result.lead.status, "ON_HOLD");
      assert.equal(result.lead.priority, "HIGH");
      assert.equal(result.lead.category, "RETAILER");
      assert.ok(result.affectedUserIds.includes(salesId));
      assert.equal(result.completedFollowUp && (result.completedFollowUp as { id: string }).id, selected.id);
      assert.equal((await prisma.followUp.findUniqueOrThrow({ where: { id: selected.id } })).status, "COMPLETED");
      assert.equal((await prisma.followUp.findUniqueOrThrow({ where: { id: untouched.id } })).status, "PENDING");
      const next = await prisma.followUp.findFirstOrThrow({ where: { leadId: lead.id, id: { notIn: [selected.id, untouched.id] } } });
      followUpIds.push(next.id);
      assert.equal(next.assignedUserId, salesId);
      assert.equal(next.description, null);
      assert.equal(await prisma.note.count({ where: { leadId: lead.id } }), 0);
      assert.equal(next.dueDate?.toISOString(), "2032-03-01T14:30:00.000Z");
      assert.equal(result.lead.nextFollowUpAt?.getTime(), untouched.dueDate?.getTime());
      assert.equal(result.lead.lastFollowUpAt?.getTime(), (result.completedFollowUp as { completedAt: Date }).completedAt.getTime());
      const entries = result.interaction.entries;
      assert.deepEqual(entries.map((entry) => entry.type).sort(), ["CALL", "FOLLOW_UP_COMPLETED", "FOLLOW_UP_SCHEDULED", "STATUS_CHANGED", "UPDATED"].sort());
      assert.equal(result.interaction.type, "INTERACTION");
    });

    await t.test("repeated interactions remain distinct and unchanged lead PATCH is a true no-op", async () => {
      const lead = await createLead("repeat");
      const before = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      const first = await leadWorkflowService.recordLeadProgress(lead.id, {
        action: "WHATSAPP", response: "NO_RESPONSE", interest: null, notes: null,
      }, actorSales);
      const second = await leadWorkflowService.recordLeadProgress(lead.id, {
        action: "WHATSAPP", response: "NO_RESPONSE", interest: null, notes: null,
      }, actorSales);
      assert.notEqual(first.interaction.id, second.interaction.id);
      assert.equal(await prisma.activityEvent.count({ where: { leadId: lead.id, type: "INTERACTION" } }), 2);
      const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
      assert.equal(after.updatedById, before.updatedById);

      const eventsBefore = await prisma.activityEvent.count({ where: { leadId: lead.id } });
      const noOp = await leadService.update(lead.id, { status: lead.status, priority: lead.priority, category: lead.category }, actorSales);
      assert.equal(noOp.changed, false);
      assert.equal(await prisma.activityEvent.count({ where: { leadId: lead.id } }), eventsBefore);
      const afterPatch = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      assert.equal(afterPatch.updatedAt.getTime(), before.updatedAt.getTime());
    });

    await t.test("scheduling without completion leaves existing pending tasks untouched", async () => {
      const lead = await createLead("schedule-only");
      const existing = await createPendingFollowUp(lead.id, "schedule-only-existing");
      const result = await leadWorkflowService.recordLeadProgress(lead.id, {
        action: "WHATSAPP", response: "INVALID_NUMBER", interest: null,
        scheduleFollowUp: true, followUpDate: "2032-04-01T08:00:00Z",
      }, actorSales);
      const existingAfter = await prisma.followUp.findUniqueOrThrow({ where: { id: existing.id } });
      assert.equal(existingAfter.status, "PENDING");
      assert.equal(existingAfter.dueDate?.getTime(), existing.dueDate?.getTime());
      assert.ok(result.nextFollowUp);
      assert.equal(result.interaction.entries.filter((entry) => entry.type === "WHATSAPP").length, 1);
    });

    await t.test("unrelated follow-up IDs are hidden and already-completed tasks conflict without interaction", async () => {
      const leadA = await createLead("lead-a");
      const leadB = await createLead("lead-b");
      const taskB = await createPendingFollowUp(leadB.id, "other-lead");
      await assert.rejects(
        leadWorkflowService.recordLeadProgress(leadA.id, {
          action: "CALL", response: "NO_RESPONSE", interest: null, completeFollowUpId: taskB.id,
        }, actorSales),
        (error: unknown) => error instanceof ServiceError && error.status === 404,
      );
      await prisma.followUp.update({ where: { id: taskB.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await assert.rejects(
        leadWorkflowService.recordLeadProgress(leadB.id, {
          action: "CALL", response: "NO_RESPONSE", interest: null, completeFollowUpId: taskB.id,
        }, actorSales),
        (error: unknown) => error instanceof ServiceError && error.status === 409,
      );
      assert.equal(await prisma.activityEvent.count({ where: { leadId: leadB.id, type: "INTERACTION" } }), 0);
    });

    await t.test("Sales cannot record progress on another user's lead", async () => {
      const lead = await createLead("other-owner", juniorId);
      await assert.rejects(
        leadWorkflowService.recordLeadProgress(lead.id, {
          action: "CALL", response: "NO_RESPONSE", interest: null,
        }, actorSales),
        (error: unknown) => error instanceof ServiceError && error.status === 404,
      );
      assert.equal(await prisma.activityEvent.count({ where: { leadId: lead.id } }), 0);
    });

    await t.test("concurrent progress requests complete a selected task only once", async () => {
      const lead = await createLead("concurrent-completion");
      const task = await createPendingFollowUp(lead.id, "concurrent-completion");
      const submit = () => leadWorkflowService.recordLeadProgress(lead.id, {
        action: "CALL", response: "NO_RESPONSE", interest: null, completeFollowUpId: task.id,
      }, actorSales);
      const outcomes = await Promise.allSettled([submit(), submit()]);
      assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
      const failures = outcomes.filter((outcome) => outcome.status === "rejected");
      assert.equal(failures.length, 1);
      assert.ok(failures[0]?.status === "rejected" && failures[0].reason instanceof ServiceError);
      if (failures[0]?.status === "rejected") assert.equal(failures[0].reason.status, 409);
      assert.equal(await prisma.activityEvent.count({ where: { leadId: lead.id, type: "INTERACTION" } }), 1);
    });

    await t.test("event failure rolls back a selected completion and no stale lead write overwrites newer fields", async () => {
      const lead = await createLead("rollback");
      const task = await createPendingFollowUp(lead.id, "rollback");
      const originalCreateEvent = activityEventService.createEvent;
      activityEventService.createEvent = async () => { throw new Error("forced event failure"); };
      try {
        await assert.rejects(leadWorkflowService.recordLeadProgress(lead.id, {
          action: "CALL", response: "NO_RESPONSE", interest: null, completeFollowUpId: task.id,
        }, actorSales), /forced event failure/);
      } finally {
        activityEventService.createEvent = originalCreateEvent;
      }
      assert.equal((await prisma.followUp.findUniqueOrThrow({ where: { id: task.id } })).status, "PENDING");
      assert.equal(await prisma.activityEvent.count({ where: { leadId: lead.id } }), 0);

      const stale = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      await leadService.update(lead.id, { status: "ON_HOLD" }, actorSales);
      await assert.rejects(prisma.$transaction((tx) => leadService.updateFieldsInTransaction(tx, stale, { priority: "HIGH" }, salesId)),
        (error: unknown) => error instanceof ServiceError && error.status === 409);
      const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      assert.equal(after.status, "ON_HOLD");
      assert.equal(after.priority, "MEDIUM");
    });

    await t.test("import creation remains exempt from manual activity", async () => {
      const imported = await leadService.create(leadSchema.parse({ name: "Workflow imported", email: email("imported"), connectorId: null }), actorAdmin);
      assert.equal(imported.status, "created");
      if (imported.status === "created") {
        leadIds.push(imported.lead.id);
        assert.equal(imported.interactionEventId, null);
        assert.equal(await prisma.activityEvent.count({ where: { leadId: imported.lead.id, type: "INTERACTION" } }), 0);
      }
      assert.equal(createLeadRequestSchema.safeParse({ name: "Manual missing activity", email: email("missing") }).success, false);
    });
  } finally {
    if (leadIds.length) await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    if (followUpIds.length) await prisma.followUp.deleteMany({ where: { id: { in: followUpIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, salesId, juniorId] } } });
    await prisma.$disconnect();
  }
});
