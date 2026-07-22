import { Navbar } from "@/components/shared/navbar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { connectorService } from "@/services/connector.service";
import { ServerTableControls } from "@/components/admin/server-table-controls";
import { parseListQuery, toSearchParams } from "@/lib/query-builder";

export default async function AdminConnectorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = toSearchParams(await searchParams);
  const query = parseListQuery(params);
  const result = await connectorService.listPage(query);
  const connectors = result.data;

  return (
    <>
      <Navbar title="Connector Framework" />
      <Card>
        <p className="text-sm text-[var(--color-muted)]">Connector configuration, parser assignment, provider ownership, and sync status are available here. Runtime integrations remain intentionally disabled.</p>
      </Card>
      <ServerTableControls initial={{ search: query.search ?? "", page: query.page, pageSize: query.pageSize, filters: Object.fromEntries(Object.entries(query.filters).map(([key, value]) => [key, value.join(",")])) }} pagination={result.pagination} filters={[{ key: "status", label: "Status", options: [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "ERROR", label: "Error" }] }]} />
      {connectors.length ? (
        <Card>
          {connectors.map((connector) => (
            <div key={connector.id} className="flex items-center justify-between border-b border-[var(--color-border)] py-4 last:border-b-0">
              <div><p className="font-semibold">{connector.name}</p><p className="text-sm text-[var(--color-muted)]">{connector.type} · {connector.source?.name ?? "No provider"} · {connector.parser?.name ?? "No parser"}</p></div>
              <p className="text-sm">{connector.status} · {connector.enabled ? "Enabled" : "Disabled"}</p>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState title="No connectors configured" description="The abstraction is ready for future Gmail, Meta, and custom source integrations." />
      )}
    </>
  );
}
