import { randomUUID } from "node:crypto";
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { auth } from "../src/lib/auth";
import { PrismaClient, UserRole } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { leadService } from "../src/services/lead.service";
import { noteService } from "../src/services/note.service";
import { connectorService } from "../src/services/connector.service";
import { parseListQuery } from "../src/lib/query-builder";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const suffix = randomUUID();
  const adminPassword = `Phase2-${suffix}`;
  const admin = await prisma.user.create({ data: { name: `Phase 2 Admin ${suffix}`, email: `phase2-admin-${suffix}@example.test`, role: UserRole.ADMIN, accounts: { create: { id: randomUUID(), accountId: `phase2-${suffix}`, providerId: "credential", password: await hashPassword(adminPassword) } } } });
  const sales = await prisma.user.create({ data: { name: `Phase 2 Sales ${suffix}`, email: `phase2-sales-${suffix}@example.test`, role: UserRole.SALES } });
  const login = await auth.api.signInEmail({ body: { email: admin.email, password: adminPassword }, headers: new Headers() });
  if (!login?.user?.id || login.user.id !== admin.id) throw new Error("Admin login failed");
  const adminActor = { id: admin.id, role: UserRole.ADMIN };
  const salesActor = { id: sales.id, role: UserRole.SALES };

  const lead = await leadService.create({ name: `Phase 2 Lead ${suffix}`, email: `lead-${suffix}@example.test`, phone: null, company: null, alternatePhone: null, address: null, city: null, state: null, country: null, product: null, requirement: null, industry: null, website: null, jobTitle: null, budget: null, expectedValue: null, currency: null, campaign: null, campaignId: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, nextFollowUpAt: null, lostReason: null, wonAmount: null, customFields: null, rawPayload: { provider: "smoke-test" }, sourceId: null, sourceReferenceId: `ref-${suffix}`, assignedUserId: null, status: "NEW", priority: "HIGH" }, adminActor);
  await leadService.assign(lead.id, sales.id, adminActor);
  await leadService.update(lead.id, { status: "CONTACTED", nextFollowUpAt: new Date(Date.now() + 86_400_000) }, salesActor);
  const note = await noteService.create(lead.id, "Smoke-test follow-up note", salesActor);
  await noteService.update(note.id, "Edited smoke-test follow-up note", salesActor);

  const page = await leadService.listPage(parseListQuery(new URLSearchParams(`search=${encodeURIComponent(lead.name)}&pageSize=1`)), adminActor);
  if (page.pagination.total !== 1 || page.data[0]?.id !== lead.id) throw new Error("Lead search/pagination failed");
  const activitiesBeforeDelete = await prisma.leadActivity.count({ where: { leadId: lead.id } });
  const auditsBeforeDelete = await prisma.auditLog.count({ where: { entityId: lead.id } });
  if (activitiesBeforeDelete < 4 || auditsBeforeDelete < 3) throw new Error("Activity/audit generation failed");

  await leadService.remove(lead.id, adminActor);
  if ((await leadService.listPage(parseListQuery(new URLSearchParams(`search=${encodeURIComponent(lead.name)}`)), adminActor)).pagination.total !== 0) throw new Error("Soft delete filtering failed");
  await leadService.restore(lead.id, adminActor);
  if ((await leadService.listPage(parseListQuery(new URLSearchParams(`search=${encodeURIComponent(lead.name)}`)), adminActor)).pagination.total !== 1) throw new Error("Lead restore failed");

  const source = await prisma.leadSource.create({ data: { name: `Phase 2 Source ${suffix}`, slug: `phase-2-source-${suffix}`, sourceType: "SMOKE_TEST" } });
  const parser = await prisma.parser.create({ data: { name: `Phase 2 Parser ${suffix}`, type: "SMOKE_TEST", version: "1.0.0" } });
  const connector = await prisma.connector.create({ data: { name: `Phase 2 Connector ${suffix}`, type: "SMOKE_TEST", sourceId: source.id, parserId: parser.id } });
  await connectorService.recordSyncRun(connector.id, "ACTIVE", { recordsSeen: 1, recordsCreated: 1 });
  if (await prisma.connectorSyncRun.count({ where: { connectorId: connector.id } }) !== 1) throw new Error("Connector sync history failed");

  await prisma.lead.delete({ where: { id: lead.id } });
  await prisma.connector.delete({ where: { id: connector.id } });
  await prisma.parser.delete({ where: { id: parser.id } });
  await prisma.leadSource.delete({ where: { id: source.id } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, sales.id] } } });
  console.log("Phase 2 smoke test passed: lead lifecycle, assignment, notes, history, audit, search, pagination, restore, and connector sync history.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
