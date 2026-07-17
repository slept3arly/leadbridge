import type { ExecutionContext, ConnectorExecutionResult, RawPayload } from "./runtime-types";
import { ConnectorExecutor, type ConnectorRegistry } from "./connector-executor";
import { ParserRuntime, type ParserRegistry } from "./parser-runtime";
import { LeadNormalizer } from "./lead-normalizer";
import { RetryPolicy } from "./retry-policy";
import { SyncHistory, type SyncBreakdown } from "./sync-history";
import { RoutingEngine, type RoutingResult } from "./routing-engine";
import { createExecutionContext } from "./execution-context";
import {
  createSuccessResult,
  createFailedResult,
  createSkippedResult,
} from "./runtime-result";
import type { NormalizedLead } from "@/types/lead";
import { LeadService, type LeadInput } from "@/services/lead.service";
import { activityService } from "@/services/activity.service";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/service-errors";

export interface RuntimeOptions {
  connectorRegistry: ConnectorRegistry;
  parserRegistry: ParserRegistry;
  leadService?: LeadService;
  retryPolicy?: RetryPolicy;
  syncHistory?: SyncHistory;
  routingEngine?: RoutingEngine;
}

export class ConnectorRuntime {
  private readonly connectorExecutor: ConnectorExecutor;
  private readonly parserRuntime: ParserRuntime;
  private readonly normalizer: LeadNormalizer;
  private readonly retryPolicy: RetryPolicy;
  private readonly syncHistory: SyncHistory;
  private readonly routingEngine: RoutingEngine;
  private readonly leadService: LeadService;

  constructor(options: RuntimeOptions) {
    this.connectorExecutor = new ConnectorExecutor(options.connectorRegistry);
    this.parserRuntime = new ParserRuntime(options.parserRegistry);
    this.normalizer = new LeadNormalizer();
    this.retryPolicy = options.retryPolicy ?? new RetryPolicy();
    this.syncHistory = options.syncHistory ?? new SyncHistory();
    this.routingEngine = options.routingEngine ?? new RoutingEngine();
    this.leadService = options.leadService ?? new LeadService();
  }

  async execute(
    connectorId: string,
    connectorType: string,
    actor: { id: string; role: "ADMIN" | "SALES" },
    config?: {
      providerId?: string;
      parserId?: string;
      configuration?: Record<string, unknown>;
    },
  ): Promise<ConnectorExecutionResult> {
    const startedAt = Date.now();

    const context = createExecutionContext({
      connectorId,
      connectorType,
      providerId: config?.providerId,
      parserId: config?.parserId,
      configuration: config?.configuration,
    });

    const syncRunId = await this.syncHistory.recordStart(context);

    try {
      const result = await this.retryPolicy.execute(async (attempt) => {
        if (attempt > 1) {
          context.logger.info(`Retry attempt ${attempt}`, { executionId: context.executionId });
        }

        const payloads = await this.connectorExecutor.execute(context);

        if (payloads.length === 0) {
          return createSkippedResult("No payloads returned by connector", {
            rawPayloadCount: 0,
            leadCount: 0,
            durationMs: Date.now() - startedAt,
            metadata: { connectorId, executionId: context.executionId },
          });
        }

        const { leads, breakdown } = await this.processPayloads(payloads, context, actor);

        context.logger.info("Execution completed", {
          executionId: context.executionId,
          connectorId,
          payloadsFetched: payloads.length,
          leadsCreated: leads.length,
          duplicatesSkipped: breakdown.duplicatesSkipped,
          routingFailures: breakdown.routingFailures,
          parserFailures: breakdown.parserFailures,
          validationFailures: breakdown.validationFailures,
          connectorFailures: breakdown.connectorFailures,
          durationMs: Date.now() - startedAt,
          historyId: context.configuration.lastHistoryId,
        });

        return createSuccessResult({
          rawPayloadCount: payloads.length,
          leadCount: leads.length,
          durationMs: Date.now() - startedAt,
          metadata: {
            connectorId,
            executionId: context.executionId,
            leadIds: leads.map((l) => l.id),
            breakdown,
          },
        });
      });

      const meta = result.result.metadata as Record<string, unknown>;
      await this.syncHistory.recordCompletion(syncRunId, connectorId, result.result, meta.breakdown as SyncBreakdown | undefined);
      return result.result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown runtime error";
      const result = createFailedResult(
        error instanceof Error ? error : new Error(errorMessage),
        {
          durationMs: Date.now() - startedAt,
          metadata: { connectorId, executionId: context.executionId },
        },
      );

      context.logger.error("Execution failed", {
        executionId: context.executionId,
        connectorId,
        error: errorMessage,
        durationMs: Date.now() - startedAt,
      });

      await this.syncHistory.recordCompletion(syncRunId, connectorId, result);
      return result;
    }
  }

  private async processPayloads(
    payloads: RawPayload[],
    context: ExecutionContext,
    actor: { id: string; role: "ADMIN" | "SALES" },
  ): Promise<{ leads: Array<{ id: string }>; breakdown: SyncBreakdown }> {
    const createdLeads: Array<{ id: string }> = [];
    const breakdown: SyncBreakdown = {
      duplicatesSkipped: 0,
      routingFailures: 0,
      parserFailures: 0,
      validationFailures: 0,
      connectorFailures: 0,
      warnings: 0,
    };

    for (const payload of payloads) {
      try {
        if (await this.isDuplicate(payload, context)) {
          context.logger.info("Skipping duplicate payload", {
            duplicateKey: payload._duplicateKey,
          });
          breakdown.duplicatesSkipped++;
          continue;
        }

        const routing = await this.resolveRouting(payload, context);

        if (!routing.match) {
          breakdown.routingFailures++;
          if (routing.unmatchedId) {
            context.logger.info("No routing rule matched — payload recorded as unmatched", {
              unmatchedId: routing.unmatchedId,
            });
          } else {
            context.logger.warn("No routing rule matched and no sender info available", {
              payloadPreview: JSON.stringify(payload).slice(0, 200),
            });
          }
          continue;
        }

        const match = routing.match;
        const parserId = match.parserId ?? context.parserId;
        if (!parserId) {
          breakdown.parserFailures++;
          context.logger.warn("No parser resolved for payload, skipping", {
            payloadPreview: JSON.stringify(payload).slice(0, 200),
          });
          continue;
        }

        const lead = await this.parserRuntime.parse(payload, parserId, context);
        const { lead: validatedLead, warnings } = this.normalizer.validate(lead);

        if (warnings.length > 0) {
          breakdown.warnings += warnings.length;
          context.logger.warn("Normalization warnings", {
            warnings,
            leadName: lead.name,
          });
        }

        const enrichedLead = this.normalizer.enrich(validatedLead, {
          sourceId: match?.providerId ?? context.providerId,
          sourceType: context.connectorType,
          parserVersion: "1.0",
        });

        const leadInput = this.toLeadInput(enrichedLead);

        let created;
        try {
          created = await this.leadService.create(leadInput, actor);
        } catch (error) {
          if (error instanceof ServiceError && error.status === 409) {
            breakdown.duplicatesSkipped++;
            context.logger.info("Duplicate lead skipped during import", {
              leadName: enrichedLead.name,
              email: enrichedLead.email,
            });
            continue;
          }
          breakdown.validationFailures++;
          context.logger.error("Lead creation failed", {
            leadName: enrichedLead.name,
            email: enrichedLead.email,
            error: error instanceof Error ? error.message : String(error),
          });
          continue;
        }

        await activityService.record(
          created.id,
          "IMPORTED",
          `Lead imported via ${context.connectorType} connector`,
          actor.id,
          {
            executionId: context.executionId,
            connectorId: context.connectorId,
            source: context.connectorType,
            routingRuleId: match?.ruleId,
          },
        );

        createdLeads.push(created);
      } catch (error) {
        breakdown.connectorFailures++;
        context.logger.error("Failed to process payload", {
          error: error instanceof Error ? error.message : String(error),
          payloadPreview: JSON.stringify(payload).slice(0, 500),
        });
      }
    }

    return { leads: createdLeads, breakdown };
  }

  private async isDuplicate(
    payload: RawPayload,
    context: ExecutionContext,
  ): Promise<boolean> {
    const duplicateKey = payload._duplicateKey;
    if (!duplicateKey) return false;

    const existing = await prisma.lead.findFirst({
      where: {
        connectorId: context.connectorId,
        sourceReferenceId: duplicateKey,
      },
      select: { id: true },
    });

    return existing !== null;
  }

  private async resolveRouting(
    payload: RawPayload,
    context: ExecutionContext,
  ): Promise<RoutingResult> {
    const hints = payload._routing;
    if (!hints) return { match: null };

    return this.routingEngine.route(hints, payload, context.connectorId);
  }

  private toLeadInput(lead: NormalizedLead): LeadInput {
    return {
      name: lead.name,
      company: lead.company ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      alternatePhone: lead.alternatePhone ?? null,
      address: lead.address ?? null,
      city: lead.city ?? null,
      state: lead.state ?? null,
      country: lead.country ?? null,
      product: lead.product ?? null,
      requirement: lead.requirement ?? null,
      industry: null,
      website: null,
      jobTitle: null,
      budget: null,
      expectedValue: null,
      currency: null,
      campaign: null,
      campaignId: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      nextFollowUpAt: null,
      lostReason: null,
      wonAmount: null,
      sourceId: lead.sourceId ?? null,
      sourceReferenceId: lead.sourceReferenceId ?? null,
      assignedUserId: lead.assignedUserId ?? null,
      status: lead.status,
      priority: lead.priority,
      customFields: (lead.customFields as Record<string, string>) ?? null,
      rawPayload: lead.rawPayload ?? null,
    } as unknown as LeadInput;
  }
}
