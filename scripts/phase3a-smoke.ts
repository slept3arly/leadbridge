import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, UserRole } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { discoverGmailAccounts } from "../src/connectors/environment";
import { providerService } from "../src/services/provider.service";
import { unmatchedEmailService } from "../src/services/unmatched-email.service";
import { connectorService } from "../src/services/connector.service";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  await prisma.routingRule.deleteMany({ where: { name: { startsWith: "Phase 3A Rule " } } });
  await prisma.parserRequest.deleteMany({ where: { vendorName: { startsWith: "Unknown Vendor" } } });
  await prisma.connector.deleteMany({ where: { name: { startsWith: "Phase 3A Connector " } } });
  await prisma.parser.deleteMany({ where: { name: { startsWith: "Phase 3A Parser " } } });
  await prisma.leadSource.deleteMany({ where: { name: { startsWith: "Phase 3A Provider " } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "phase3a-" } } });
  const suffix = randomUUID();
  const admin = await prisma.user.create({ data: { name: `Phase 3A Admin ${suffix}`, email: `phase3a-${suffix}@example.test`, role: UserRole.ADMIN } });
  const provider = await providerService.create({ name: `Phase 3A Provider ${suffix}`, slug: `phase-3a-${suffix}`, sourceType: "SMOKE_TEST" }, admin.id);
  const parser = await prisma.parser.create({ data: { name: `Phase 3A Parser ${suffix}`, type: "SMOKE_TEST", version: "1.0.0" } });
  const connector = await prisma.connector.create({ data: { name: `Phase 3A Connector ${suffix}`, type: "GMAIL", environmentKey: `SMOKE_${suffix}`, sourceId: provider.id, parserId: parser.id } });
  await providerService.createRoutingRule({ name: `Phase 3A Rule ${suffix}`, senderDomain: "vendor.example", providerId: provider.id, parserId: parser.id }, admin.id);
  const routed = await providerService.route({ senderEmail: "inbox@vendor.example", subject: "New lead" });
  if (!routed || routed.providerId !== provider.id || routed.parserId !== parser.id) throw new Error("Routing rule selection failed");
  const unmatched = await prisma.unmatchedEmail.create({ data: { senderEmail: "unknown@example.test", subject: "Unknown lead", receivedAt: new Date(), rawPreview: "sample", connectorId: connector.id } });
  await unmatchedEmailService.handle(unmatched.id, { action: "REQUEST_PARSER", vendorName: "Unknown Vendor", developerNotes: "Smoke test" }, admin.id);
  if (await prisma.parserRequest.count({ where: { requestedById: admin.id } }) !== 1) throw new Error("Parser request creation failed");
  await connectorService.recordSyncRun(connector.id, "ACTIVE", { recordsSeen: 2, recordsCreated: 1, recordsSkipped: 1 });
  if (await connectorService.listSyncRuns(connector.id).then((runs) => runs.length) !== 1) throw new Error("Sync history read failed");
  const accounts = discoverGmailAccounts({ GMAIL_SMOKE_CLIENT_ID: "configured" } as unknown as NodeJS.ProcessEnv);
  if (accounts[0]?.status !== "INCOMPLETE") throw new Error("Gmail environment discovery failed");
  await prisma.unmatchedEmail.delete({ where: { id: unmatched.id } });
  await prisma.leadSource.delete({ where: { id: provider.id } });
  await prisma.connector.delete({ where: { id: connector.id } });
  await prisma.parser.delete({ where: { id: parser.id } });
  await prisma.parserRequest.deleteMany({ where: { requestedById: admin.id } });
  await prisma.user.delete({ where: { id: admin.id } });
  console.log("Phase 3A smoke test passed: environment discovery, provider routing, unmatched queue, parser request, and sync history.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
