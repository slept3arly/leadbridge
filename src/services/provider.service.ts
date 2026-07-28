import { prisma } from "@/lib/prisma";
import { containsSearch, listResult, pagination, type ListQuery } from "@/lib/query-builder";
import { ServiceError } from "@/lib/service-errors";
import { auditService } from "@/services/audit.service";
import type { z } from "zod";
import { providerSchema, routingRuleSchema } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

type ProviderInput = z.infer<typeof providerSchema>;
type RoutingInput = z.infer<typeof routingRuleSchema>;

const providerInclude = {
  connectors: { select: { id: true, name: true, type: true, enabled: true, status: true, environmentKey: true } as const },
  routingRules: { select: { id: true, name: true, active: true, priority: true } as const },
} satisfies Prisma.LeadSourceInclude;

type ProviderBase = Prisma.LeadSourceGetPayload<{ include: typeof providerInclude }>;

export type ProviderWithStats = ProviderBase & {
  leadCount: number;
  activeConnectorCount: number;
  totalConnectorCount: number;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
};

export class ProviderService {
  async list(query?: ListQuery) {
    if (!query) return { data: await this.listAll(), pagination: { page: 1, pageSize: 0, total: 0, totalPages: 0 } };
    const where = { ...(query.filters.active?.length ? { active: query.filters.active.includes("true") } : {}), ...containsSearch(["name", "slug", "sourceType"], query.search) };
    const [data, total] = await Promise.all([
      prisma.leadSource.findMany({ where, orderBy: { name: "asc" }, ...pagination(query), include: providerInclude }),
      prisma.leadSource.count({ where }),
    ]);
    return listResult(await this.augmentWithStats(data), total, query);
  }

  async listAll(): Promise<ProviderWithStats[]> {
    const providers = await prisma.leadSource.findMany({ orderBy: [{ priority: "desc" }, { name: "asc" }], include: providerInclude });
    return this.augmentWithStats(providers);
  }

  private async augmentWithStats(providers: ProviderBase[]): Promise<ProviderWithStats[]> {
    if (providers.length === 0) return [];
    const ids = providers.map((p) => p.id);
    const [leadCounts, connectors] = await Promise.all([
      prisma.lead.groupBy({ by: ["sourceId"], where: { sourceId: { in: ids }, isDeleted: false }, _count: { id: true } }),
      prisma.connector.findMany({ where: { sourceId: { in: ids } }, select: { id: true, sourceId: true, lastSyncedAt: true, lastSuccessAt: true, lastFailureAt: true, status: true, enabled: true, type: true, name: true } }),
    ]);
    const leadCountMap = new Map(leadCounts.map((r) => [r.sourceId, r._count.id]));
    const connectorMap = new Map<string, typeof connectors>();
    for (const c of connectors) {
      const list = connectorMap.get(c.sourceId ?? "") ?? [];
      list.push(c);
      connectorMap.set(c.sourceId ?? "", list);
    }
    return providers.map((p) => {
      const pConnectors = connectorMap.get(p.id) ?? [];
      const activeConnectors = pConnectors.filter((c) => c.enabled);
      const lastSyncDates = pConnectors.map((c) => c.lastSyncedAt?.getTime()).filter(Boolean) as number[];
      const lastSuccessDates = pConnectors.map((c) => c.lastSuccessAt?.getTime()).filter(Boolean) as number[];
      return {
        ...p,
        leadCount: leadCountMap.get(p.id) ?? 0,
        activeConnectorCount: activeConnectors.length,
        totalConnectorCount: pConnectors.length,
        lastSyncAt: lastSyncDates.length > 0 ? new Date(Math.max(...lastSyncDates)) : null,
        lastSuccessAt: lastSuccessDates.length > 0 ? new Date(Math.max(...lastSuccessDates)) : null,
      };
    });
  }

  async create(data: ProviderInput, actorId: string) {
    const provider = await prisma.leadSource.create({ data: { ...data, sourceType: data.sourceType, description: data.description ?? null } });
    await auditService.log("provider.created", "LeadSource", provider.id, actorId, { name: provider.name });
    return provider;
  }

  async update(id: string, data: Partial<ProviderInput>, actorId: string) {
    const provider = await prisma.leadSource.update({ where: { id }, data: { ...data, description: data.description ?? undefined } });
    await auditService.log("provider.updated", "LeadSource", id, actorId, data);
    return provider;
  }

  async delete(id: string, actorId: string) {
    const provider = await prisma.leadSource.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!provider) throw new ServiceError("Provider not found.", 404);
    await prisma.leadSource.update({ where: { id }, data: { active: false, connectors: { set: [] } } });
    await auditService.log("provider.deleted", "LeadSource", id, actorId, { name: provider.name });
    return provider;
  }

  async createRoutingRule(data: RoutingInput, actorId: string) {
    const rule = await prisma.routingRule.create({ data: { ...data, priority: data.priority ?? 100, fallback: data.fallback ?? false, active: data.active ?? true } });
    await auditService.log("routing_rule.created", "RoutingRule", rule.id, actorId, { providerId: rule.providerId, parserId: rule.parserId });
    return rule;
  }

  async listRoutingRules() {
    return prisma.routingRule.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }], include: { provider: { select: { id: true, name: true } }, parser: { select: { id: true, name: true, version: true } }, connector: { select: { id: true, name: true, environmentKey: true } } } });
  }

  // Legacy compatibility for smoke scripts. Routing is now owned by the runtime.
  async route(input: { recipientGmailAccount?: string; senderEmail?: string; senderDomain?: string; subject?: string; gmailLabel?: string }) {
    const rules = await prisma.routingRule.findMany({ where: { active: true }, orderBy: [{ fallback: "asc" }, { priority: "asc" }] });
    return rules.find((rule) => {
      if (rule.fallback) return true;
      return (!rule.recipientGmailAccount || rule.recipientGmailAccount === input.recipientGmailAccount)
        && (!rule.senderEmail || rule.senderEmail.toLowerCase() === input.senderEmail?.toLowerCase())
        && (!rule.senderDomain || input.senderEmail?.toLowerCase().endsWith(`@${rule.senderDomain.toLowerCase()}`))
        && (!rule.subjectContains || input.subject?.toLowerCase().includes(rule.subjectContains.toLowerCase()))
        && (!rule.gmailLabel || rule.gmailLabel === input.gmailLabel);
    }) ?? null;
  }

  async assertProvider(id: string) {
    const provider = await prisma.leadSource.findUnique({ where: { id } });
    if (!provider) throw new ServiceError("Provider not found.", 404);
    return provider;
  }
}

export const providerService = new ProviderService();
