import { Navbar } from "@/components/shared/navbar";
import { ExportButton } from "@/components/shared/export-button";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ProvidersPageContent } from "@/components/providers/providers-page-content";
import { providerService } from "@/services/provider.service";

export default async function AdminProvidersPage() {
  const providers = await providerService.listAll();
  const serialized = providers.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    lastSyncAt: p.lastSyncAt?.toISOString() ?? null,
    lastSuccessAt: p.lastSuccessAt?.toISOString() ?? null,
  }));

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
      <ProvidersPageContent providers={serialized} />
    </>
  );
}
