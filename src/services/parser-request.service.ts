import type { ParserRequestStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export class ParserRequestService {
  async list() {
    return prisma.parserRequest.findMany({ orderBy: { requestedAt: "desc" }, include: { requestedBy: { select: { id: true, name: true, email: true } } } });
  }

  async updateStatus(id: string, status: ParserRequestStatus, developerNotes: string | undefined, actorId: string) {
    const request = await prisma.parserRequest.update({ where: { id }, data: { status, developerNotes } });
    return request;
  }
}

export const parserRequestService = new ParserRequestService();
