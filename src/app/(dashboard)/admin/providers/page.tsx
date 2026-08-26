import { Navbar } from "@/components/shared/navbar";
import { ExportButton } from "@/components/shared/export-button";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ProvidersPageContent } from "@/components/providers/providers-page-content";
import { providerService } from "@/services/provider.service";
import { parserService } from "@/services/parser.service";

export default async function AdminProvidersPage() {
  const [providers, parserRecords, parserManifests, routingRules] = await Promise.all([
    providerService.listAll(),
    parserService.listForManagement(),
    parserService.list(),
    providerService.listRoutingRules(),
  ]);

  const parserManifestMap = new Map(parserManifests.map((parser) => [parser.key, parser]));
  const serialized = providers.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    lastSyncAt: p.lastSyncAt?.toISOString() ?? null,
    lastSuccessAt: p.lastSuccessAt?.toISOString() ?? null,
  }));
  const serializedParsers = parserRecords.map((parser) => {
    const manifest = parserManifestMap.get(parser.name);
    return {
      id: parser.id,
      name: parser.name,
      version: parser.version,
      description: parser.description,
      providerTypesSupported: manifest?.providerTypesSupported ?? [],
      enabled: manifest?.enabled ?? true,
    };
  });
  const serializedRules = routingRules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    recipientGmailAccount: rule.recipientGmailAccount,
    senderEmail: rule.senderEmail,
    senderDomain: rule.senderDomain,
    subjectContains: rule.subjectContains,
    gmailLabel: rule.gmailLabel,
    priority: rule.priority,
    fallback: rule.fallback,
    active: rule.active,
    provider: { id: rule.provider.id, name: rule.provider.name },
    parser: { id: rule.parser.id, name: rule.parser.name, version: rule.parser.version ?? null },
    connector: rule.connector
      ? { id: rule.connector.id, name: rule.connector.name, environmentKey: rule.connector.environmentKey ?? null }
      : null,
  }));
  const renderedAt = new Date().toISOString();

  return (
    <>
      <Navbar
        title="Providers"
        showResync
        actions={
          <>
            <ExportButton type="providers" iconOnly />
            <SignOutButton />
          </>
        }
      />
      <ProvidersPageContent providers={serialized} parsers={serializedParsers} routingRules={serializedRules} renderedAt={renderedAt} />
    </>
  );
}
