import { Navbar } from "@/components/shared/navbar";
import { ProviderManagement } from "@/components/providers/provider-management";
import { ExportButton } from "@/components/shared/export-button";
import { providerService } from "@/services/provider.service";
import { parserService } from "@/services/parser.service";
import { listConnectorManifests } from "@/connectors/registry";

export default async function ProvidersPage() {
  const [providers, rules, parserRows, parserManifests] = await Promise.all([
    providerService.list(),
    providerService.listRoutingRules(),
    parserService.listForManagement(),
    Promise.resolve(parserService.list()),
  ]);

  const providerRows = "data" in providers ? providers.data : providers;

  return (
    <>
      <Navbar title="Providers" actions={<div className="flex gap-2"><ExportButton type="providers" /></div>} />
      <ProviderManagement
        providers={providerRows.map((provider) => ({ id: provider.id, name: provider.name }))}
        parsers={parserRows.map((parser) => ({
          key: parser.id,
          name: parser.name,
          type: parser.type,
          version: parser.version ?? "—",
          description: parser.description ?? "",
        }))}
        parserManifests={parserManifests.map((m) => ({
          key: m.key,
          name: m.name,
          version: m.version,
          description: m.description,
          providerTypesSupported: m.providerTypesSupported,
          supportsAttachments: m.supportsAttachments,
          developerNotes: m.developerNotes,
        }))}
        rules={rules}
      />
    </>
  );
}
