import { Navbar } from "@/components/navbar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { connectorService } from "@/services/connector.service";

export default async function AdminConnectorsPage() {
  const connectors = await connectorService.list();

  return (
    <>
      <Navbar title="Connector Framework" />
      <Card>
        <p className="text-sm text-[var(--color-muted)]">Connectors will implement authenticate, fetch, normalize, and sync without changing the rest of the application architecture.</p>
      </Card>
      {connectors.length ? (
        <Card>
          {connectors.map((connector) => (
            <div key={connector.id} className="flex items-center justify-between border-b border-[var(--color-border)] py-4 last:border-b-0">
              <div><p className="font-semibold">{connector.name}</p><p className="text-sm text-[var(--color-muted)]">{connector.type}</p></div>
              <p className="text-sm">{connector.enabled ? "Enabled" : "Disabled"}</p>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState title="No connectors configured" description="The abstraction is ready for future Gmail, Meta, and custom source integrations." />
      )}
    </>
  );
}
