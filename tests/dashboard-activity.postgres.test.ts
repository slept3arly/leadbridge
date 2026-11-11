import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.LEADBRIDGE_TEST_DATABASE_URL;

test("dashboard activity aggregates preserve entry counts, distinct lead counts, and date filters", { skip: !databaseUrl }, async () => {
  assert.ok(databaseUrl);
  assert.match(new URL(databaseUrl).pathname, /test/i, "refusing to run against a database not named as a test database");
  process.env.DATABASE_URL = databaseUrl;

  const [{ prisma }, { dashboardService }, { startOfTodayUTC, endOfTodayUTC }] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/services/dashboard.service"),
    import("../src/lib/utils"),
  ]);
  const marker = randomUUID().replaceAll("-", "");
  const salesId = `dashboard-sales-${marker}`;
  const otherSalesId = `dashboard-sales-other-${marker}`;
  const leads: string[] = [];
  const start = startOfTodayUTC();
  const end = endOfTodayUTC();
  const yesterday = new Date(start.getTime() - 1);
  const tomorrow = new Date(end.getTime() + 1);

  try {
    await prisma.user.create({ data: { id: salesId, name: "Dashboard Sales", email: `${marker}-sales@example.test`, role: "SALES" } });
    await prisma.user.create({ data: { id: otherSalesId, name: "Dashboard Other Sales", email: `${marker}-other@example.test`, role: "SALES" } });

    const [leadA, leadB, leadC, leadD] = await Promise.all([
      prisma.lead.create({ data: { displayName: "Dashboard A", assignedUserId: salesId } }),
      prisma.lead.create({ data: { displayName: "Dashboard B", assignedUserId: otherSalesId } }),
      prisma.lead.create({ data: { displayName: "Dashboard C", assignedUserId: salesId } }),
      prisma.lead.create({ data: { displayName: "Dashboard D", assignedUserId: salesId } }),
    ]);
    leads.push(leadA.id, leadB.id, leadC.id, leadD.id);
    const [adminBefore, salesBefore] = await Promise.all([
      dashboardService.admin(),
      dashboardService.sales(salesId),
    ]);

    const addInteraction = (leadId: string, actorId: string, occurredAt: Date, type: "CALL" | "WHATSAPP", response: "PICKED_UP" | "NOT_PICKED_UP" | "NO_RESPONSE" | "REPLIED" | "NOT_REPLIED", interest?: "INTERESTED" | "NOT_INTERESTED") =>
      prisma.activityEvent.create({
        data: {
          leadId,
          actorId,
          type: "INTERACTION",
          occurredAt,
          entries: {
            create: [{
              type,
              action: type,
              response,
              ...(interest ? { interest } : {}),
            }],
          },
        },
      });

    await Promise.all([
      addInteraction(leadA.id, salesId, start, "CALL", "PICKED_UP", "INTERESTED"),
      addInteraction(leadA.id, salesId, end, "CALL", "NOT_PICKED_UP", "INTERESTED"),
      addInteraction(leadA.id, salesId, end, "WHATSAPP", "REPLIED", "NOT_INTERESTED"),
      addInteraction(leadB.id, otherSalesId, start, "CALL", "NOT_PICKED_UP"),
      addInteraction(leadA.id, salesId, yesterday, "CALL", "PICKED_UP"),
      // Sales metrics have an inclusive lower bound only; Admin metrics are bounded to the current UTC day.
      addInteraction(leadC.id, salesId, tomorrow, "CALL", "PICKED_UP", "INTERESTED"),
      prisma.activityEvent.create({
        data: {
          leadId: leadD.id,
          actorId: salesId,
          type: "SYSTEM",
          occurredAt: start,
          entries: { create: [{ type: "UPDATED", interest: "INTERESTED" }] },
        },
      }),
    ]);

    const [adminDashboard, salesDashboard] = await Promise.all([
      dashboardService.admin(),
      dashboardService.sales(salesId),
    ]);

    assert.deepEqual({
      workedLeads: adminDashboard.activity.workedLeads - adminBefore.activity.workedLeads,
      callsLogged: adminDashboard.activity.callsLogged - adminBefore.activity.callsLogged,
      whatsappLogged: adminDashboard.activity.whatsappLogged - adminBefore.activity.whatsappLogged,
      responseEntries: adminDashboard.activity.responseEntries - adminBefore.activity.responseEntries,
    }, {
      workedLeads: 2, callsLogged: 3, whatsappLogged: 1, responseEntries: 2,
    });
    const salesperson = adminDashboard.salespersonPerformance.find((row) => row.userId === salesId);
    assert.deepEqual(
      salesperson && { workedToday: salesperson.workedToday, calls: salesperson.calls, whatsapp: salesperson.whatsapp, responses: salesperson.responses },
      { workedToday: 1, calls: 2, whatsapp: 1, responses: 2 },
    );
    assert.deepEqual(Object.fromEntries(Object.entries(salesDashboard.insights).map(([key, value]) => [
      key,
      value - (salesBefore.insights[key as keyof typeof salesBefore.insights]),
    ])), {
      workedLeads: 2,
      calls: 2,
      whatsapp: 1,
      responded: 2,
      noResponse: 1,
      interested: 3,
      notInterested: 1,
    });
  } finally {
    if (leads.length) await prisma.lead.deleteMany({ where: { id: { in: leads } } });
    await prisma.user.deleteMany({ where: { id: { in: [salesId, otherSalesId] } } });
    await prisma.$disconnect();
  }
});
