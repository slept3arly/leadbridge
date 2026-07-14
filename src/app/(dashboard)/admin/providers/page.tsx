import { Navbar } from "@/components/navbar";
import { ProviderManagement } from "@/components/provider-management";
import { providerService } from "@/services/provider.service";
import { connectorService } from "@/services/connector.service";
import { parserRequestService } from "@/services/parser-request.service";
import { unmatchedEmailService } from "@/services/unmatched-email.service";
import { parserService } from "@/services/parser.service";

export default async function ProvidersPage() {
  const [providers, rules, gmailAccounts, syncRuns, unmatched, parserRequests, parserRows] = await Promise.all([
    providerService.list(),
    providerService.listRoutingRules(),
    connectorService.listGmailAccounts(),
    connectorService.listSyncRuns(),
    unmatchedEmailService.list(),
    parserRequestService.list(),
    parserService.listForManagement(),
  ]);
  const providerRows = "data" in providers ? providers.data : providers;
  return <><Navbar title="Providers" /><ProviderManagement providers={providerRows.map((provider) => ({ id: provider.id, name: provider.name }))} parsers={parserRows.map((parser) => ({ key: parser.id, name: parser.name, type: parser.type }))} gmailAccounts={gmailAccounts.map((account) => ({ ...account, lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null }))} rules={rules} syncRuns={syncRuns.map((run) => ({ ...run, startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null }))} unmatched={unmatched.map((email) => ({ ...email, receivedAt: email.receivedAt.toISOString() }))} parserRequests={parserRequests.map((request) => ({ ...request, requestedAt: request.requestedAt.toISOString() }))} /></>;
}
