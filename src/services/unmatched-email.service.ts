import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { unmatchedActionSchema } from "@/lib/validation";
import { auditService } from "@/services/audit.service";
import { ServiceError } from "@/lib/service-errors";

type Action = z.infer<typeof unmatchedActionSchema>;

export class UnmatchedEmailService {
  async list() {
    return prisma.unmatchedEmail.findMany({ orderBy: { receivedAt: "desc" }, include: { connector: { select: { id: true, name: true, environmentKey: true } }, provider: { select: { id: true, name: true } } } });
  }

  async handle(id: string, action: Action, actorId: string) {
    const email = await prisma.unmatchedEmail.findUnique({ where: { id } });
    if (!email) throw new ServiceError("Unmatched email not found.", 404);
    if (action.action === "ASSIGN" && !action.providerId) throw new ServiceError("A provider is required.", 400);
    let providerId = action.providerId;
    if (action.action === "CREATE_PROVIDER") {
      const domain = email.senderEmail.split("@")[1] ?? `provider-${id}`;
      const slug = domain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const provider = await prisma.leadSource.create({ data: { name: action.vendorName ?? domain, slug: `${slug}-${id.slice(-6)}`, sourceType: "EMAIL" } });
      providerId = provider.id;
    }
    const status = action.action === "ASSIGN" || action.action === "CREATE_PROVIDER" ? "ASSIGNED" : action.action === "IGNORE" ? "IGNORED" : action.action === "SPAM" ? "SPAM" : "PARSER_REQUESTED";
    const updated = await prisma.unmatchedEmail.update({ where: { id }, data: { status, providerId, handledById: actorId, handledAt: new Date() } });
    if (action.action === "REQUEST_PARSER") {
      const request = await prisma.parserRequest.create({ data: { vendorName: action.vendorName ?? "Unknown vendor", senderEmail: email.senderEmail, sampleSubject: email.subject, samplePreview: email.rawPreview, requestedById: actorId, developerNotes: action.developerNotes } });
      await prisma.unmatchedEmail.update({ where: { id }, data: { parserRequestId: request.id } });
    }
    await auditService.log(`unmatched_email.${action.action.toLowerCase()}`, "UnmatchedEmail", id, actorId, { providerId: action.providerId });
    return updated;
  }
}

export const unmatchedEmailService = new UnmatchedEmailService();
