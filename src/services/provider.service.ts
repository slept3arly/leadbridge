import { prisma } from "@/lib/prisma";
import { containsSearch, listResult, pagination, type ListQuery } from "@/lib/query-builder";
import { ServiceError } from "@/lib/service-errors";
import { auditService } from "@/services/audit.service";
import type { z } from "zod";
import { providerSchema, routingRuleSchema } from "@/lib/validation";

type ProviderInput = z.infer<typeof providerSchema>;
type RoutingInput = z.infer<typeof routingRuleSchema>;

export class ProviderService {
  async list(query?: ListQuery) {
    if (!query) return prisma.leadSource.findMany({ orderBy: [{ priority: "desc" }, { name: "asc" }], include: { connectors: { select: { id: true, name: true, type: true, enabled: true, status: true, environmentKey: true } }, routingRules: { select: { id: true, name: true, active: true, priority: true } } } });
    const where = { ...(query.filters.active?.length ? { active: query.filters.active.includes("true") } : {}), ...containsSearch(["name", "slug", "sourceType"], query.search) };
    const [data, total] = await Promise.all([
      prisma.leadSource.findMany({ where, orderBy: { name: "asc" }, ...pagination(query), include: { connectors: { select: { id: true, name: true, type: true, enabled: true, status: true, environmentKey: true } }, routingRules: { select: { id: true, name: true, active: true, priority: true } } } }),
      prisma.leadSource.count({ where }),
    ]);
    return listResult(data, total, query);
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
