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
import { activityEventService } from "@/services/activity-event.service";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ExecutionFence } from "@/services/execution-fence";
import { withExecutionFence } from "@/services/execution-fence";


export interface RuntimeOptions {
  connectorRegistry: ConnectorRegistry;
  parserRegistry: ParserRegistry;
  leadService?: LeadService;
  retryPolicy?: RetryPolicy;
  syncHistory?: SyncHistory;
  routingEngine?: RoutingEngine;
  assertExecutionOwnership?: () => Promise<void>;
  executionFence?: ExecutionFence;
}

export class ConnectorRuntime {
  private readonly connectorExecutor: ConnectorExecutor;
  private readonly parserRuntime: ParserRuntime;
  private readonly normalizer: LeadNormalizer;
  private readonly retryPolicy: RetryPolicy;
  private readonly syncHistory: SyncHistory;
  private readonly routingEngine: RoutingEngine;
  private readonly leadService: LeadService;
  private readonly assertExecutionOwnership?: () => Promise<void>;
  private readonly executionFence?: ExecutionFence;

  constructor(options: RuntimeOptions) {
    this.connectorExecutor = new ConnectorExecutor(options.connectorRegistry);
    this.parserRuntime = new ParserRuntime(options.parserRegistry);
    this.normalizer = new LeadNormalizer();
    this.retryPolicy = options.retryPolicy ?? new RetryPolicy();
    this.routingEngine = options.routingEngine ?? new RoutingEngine();
    this.leadService = options.leadService ?? new LeadService();
    this.assertExecutionOwnership = options.assertExecutionOwnership;
    this.executionFence = options.executionFence;
    this.syncHistory = options.syncHistory ?? new SyncHistory(this.executionFence);
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
        await this.assertExecutionOwnership?.();

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
      await this.assertExecutionOwnership?.();
      await this.syncHistory.recordCompletion(syncRunId, connectorId, result.result, meta.breakdown as SyncBreakdown | undefined);
      return result.result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.name : "Unknown runtime error";
      const result = createFailedResult(
        new Error(errorMessage),
        {
          durationMs: Date.now() - startedAt,
          metadata: { connectorId, executionId: context.executionId },
        },
      );
      const gmailFailureDetails = error instanceof Error && error.name === "GmailMessageFetchError" && "details" in error
        ? (error as Error & { details?: { failureCount?: number; failedMessageIds?: unknown } }).details
        : undefined;

      context.logger.error("Execution failed", {
        executionId: context.executionId,
        connectorId,
        errorType: errorMessage,
        ...(gmailFailureDetails
          ? {
              failedMessageCount: gmailFailureDetails.failureCount,
              failedMessageIds: Array.isArray(gmailFailureDetails.failedMessageIds)
                ? gmailFailureDetails.failedMessageIds.filter((id): id is string => typeof id === "string")
                : [],
            }
          : {}),
        durationMs: Date.now() - startedAt,
      });

      if (!this.assertExecutionOwnership || await this.isExecutionOwned()) {
        await this.syncHistory.recordCompletion(syncRunId, connectorId, result);
      }
      return result;
    }
  }

  private async isExecutionOwned(): Promise<boolean> {
    try { await this.assertExecutionOwnership?.(); return true; } catch { return false; }
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
        await this.assertExecutionOwnership?.();
        const routing = await this.resolveRouting(payload, context);

        if (!routing.match) {
          breakdown.routingFailures++;
          if (routing.unmatchedId) {
            context.logger.info("No routing rule matched — payload recorded as unmatched", {
              unmatchedId: routing.unmatchedId,
            });
          } else {
            context.logger.warn("No routing rule matched and no sender info available", {
              connectorId: context.connectorId,
            });
          }
          continue;
        }

        const match = routing.match;
        const parserResolution = await this.resolveParser(match.parserId ?? context.parserId, match.ruleId, context);
        if (!parserResolution) {
          breakdown.parserFailures++;
          context.logger.warn("No parser resolved for payload, skipping", {
            connectorId: context.connectorId,
          });
          continue;
        }

        const lead = await this.parserRuntime.parse(payload, parserResolution.registryKey, context);
        const { lead: validatedLead, warnings } = this.normalizer.validate(lead);

        if (warnings.length > 0) {
          breakdown.warnings += warnings.length;
          context.logger.warn("Normalization warnings", {
            warningCount: warnings.length,
          });
        }

        const enrichedLead = this.normalizer.enrich(
          {
            ...validatedLead,
            sourceReferenceId: validatedLead.sourceReferenceId ?? payload._duplicateKey,
          },
          {
          sourceId: match?.providerId ?? context.providerId,
          sourceType: context.connectorType,
          parserVersion: "1.0",
          },
        );

        const leadInput = this.toLeadInput({
          ...enrichedLead,
          connectorId: context.connectorId,
        });
        context.logger.debug("Lead insert prepared", {
          connectorId: leadInput.connectorId ?? null,
          sourceReferenceId: leadInput.sourceReferenceId ?? null,
        });

        let createResult;
        try {
          await this.assertExecutionOwnership?.();
          createResult = await this.leadService.create(leadInput, actor, this.executionFence);
        } catch (error) {
          if (error instanceof Error && error.name === "ExecutionLockError") throw error;
          breakdown.validationFailures++;
          context.logger.error("Lead creation failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
          });
          continue;
        }

        if (createResult.status === "skipped") {
          breakdown.duplicatesSkipped++;
          context.logger.info("Duplicate lead skipped during import", {
            connectorId: context.connectorId,
          });
          continue;
        }

        const created = createResult.lead;
        await this.assertExecutionOwnership?.();

        const recordImportEvent = (tx?: Prisma.TransactionClient) => activityEventService.createEvent({
          leadId: created.id,
          type: "SYSTEM",
          actorId: actor.id,
          entries: [{
            type: "CREATED",
            message: `Lead imported via ${context.connectorType} connector`,
            metadata: {
              executionId: context.executionId,
              connectorId: context.connectorId,
              source: context.connectorType,
              routingRuleId: match?.ruleId,
            },
          }],
        }, tx);
        if (this.executionFence) await withExecutionFence(this.executionFence, recordImportEvent);
        else await recordImportEvent();

        createdLeads.push(created);
      } catch (error) {
        breakdown.connectorFailures++;
        context.logger.error("Failed to process payload", {
          errorType: error instanceof Error ? error.name : "UnknownError",
          connectorId: context.connectorId,
        });
      }
    }

    return { leads: createdLeads, breakdown };
  }

  private async resolveRouting(
    payload: RawPayload,
    context: ExecutionContext,
  ): Promise<RoutingResult> {
    const hints = payload._routing;
    if (!hints) return { match: null };

    return this.routingEngine.route(hints, payload, context.connectorId, this.executionFence);
  }

  private async resolveParser(
    parserDatabaseId: string | undefined,
    routingRuleId: string,
    context: ExecutionContext,
  ): Promise<{ databaseId: string; registryKey: string } | null> {
    if (!parserDatabaseId) {
      context.logger.debug("Routing parser resolution skipped", {
        routingRuleId,
        parserDatabaseId: null,
        parserRegistryKey: null,
        registryLookupResult: false,
      });
      return null;
    }

    const parserRecord = await prisma.parser.findUnique({
      where: { id: parserDatabaseId },
      select: { id: true, name: true, active: true },
    });

    const registryKey = parserRecord?.name ?? null;
    const registryLookupResult = registryKey ? this.parserRuntime.has(registryKey) : false;

    context.logger.debug("Routing parser resolved", {
      routingRuleId,
      parserDatabaseId,
      parserRegistryKey: registryKey,
      registryLookupResult,
      parserActive: parserRecord?.active ?? null,
    });

    if (!parserRecord || !registryKey || !registryLookupResult) {
      return null;
    }

    return {
      databaseId: parserRecord.id,
      registryKey,
    };
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
      connectorId: lead.connectorId ?? null,
      assignedUserId: lead.assignedUserId ?? null,
      status: lead.status,
      priority: lead.priority,
      customFields: (lead.customFields as Record<string, string>) ?? null,
      rawPayload: lead.rawPayload ?? null,
    } as unknown as LeadInput;
  }
}
