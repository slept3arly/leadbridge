"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SearchToolbar } from "@/components/shared/search-toolbar";
import { Navbar } from "@/components/shared/navbar";
import { ExportButton } from "@/components/shared/export-button";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { ProviderEditModal } from "@/components/providers/provider-edit-modal";
import { RoutingRulesManager } from "@/components/providers/routing-rules-manager";
import { Plus, ChevronDown, ChevronRight, Trash2 } from "lucide-react";

type ProviderConnector = {
  id: string; name: string; type: string; enabled: boolean;
  status: string; environmentKey: string | null;
};

type ProviderRoutingRule = { id: string; name: string; active: boolean; priority: number };

type Provider = {
  id: string; name: string; slug: string; sourceType: string;
  active: boolean; description: string | null; icon: string | null;
  color: string | null; priority: number;
  connectors: ProviderConnector[];
  routingRules: ProviderRoutingRule[];
  leadCount: number;
  activeConnectorCount: number;
  totalConnectorCount: number;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RoutingParser = {
  id: string;
  name: string;
  version: string | null;
  description: string | null;
  providerTypesSupported: string[];
  enabled: boolean;
};

type RoutingRule = {
  id: string;
  name: string;
  recipientGmailAccount: string | null;
  senderEmail: string | null;
  senderDomain: string | null;
  subjectContains: string | null;
  gmailLabel: string | null;
  priority: number;
  fallback: boolean;
  active: boolean;
  provider: { id: string; name: string };
  parser: { id: string; name: string; version: string | null };
  connector: { id: string; name: string; environmentKey: string | null } | null;
};

function dateParts(value: Date | string | number, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    ...(timeZone ? { timeZone } : {}),
    year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function relativeTime(dateStr: string | null, timeZone?: string, now: Date | string | number = Date.now()): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr).getTime();
  const diffMin = Math.floor((new Date(now).getTime() - date) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const today = dateParts(now, timeZone);
  const entryDate = dateParts(dateStr, timeZone);
  const yesterday = dateParts(new Date(new Date(now).getTime() - 86400000), timeZone);
  const isToday = entryDate.year === today.year && entryDate.month === today.month && entryDate.day === today.day;
  const isYesterday = entryDate.year === yesterday.year && entryDate.month === yesterday.month && entryDate.day === yesterday.day;
  const timeStr = new Intl.DateTimeFormat("en-US", {
    ...(timeZone ? { timeZone } : {}), hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(dateStr));
  if (isToday) return `Today \u2022 ${timeStr}`;
  if (isYesterday) return `Yesterday \u2022 ${timeStr}`;
  const month = new Intl.DateTimeFormat("en-US", {
    ...(timeZone ? { timeZone } : {}), month: "short",
  }).format(new Date(dateStr));
  const year = entryDate.year !== today.year ? ` ${entryDate.year}` : "";
  return `${entryDate.day} ${month}${year} \u2022 ${timeStr}`;
}

function statusBadge(active: boolean) {
  return <Badge label={active ? "Active" : "Inactive"} toneKey={active ? "Active" : "Inactive"} />;
}

function connectorHealthBadge(connectors: ProviderConnector[]) {
  const enabled = connectors.filter((c) => c.enabled);
  if (enabled.length === 0) return null;
  const healthy = enabled.filter((c) => c.status === "ACTIVE" || c.status === "HEALTHY");
  const warning = enabled.filter((c) => c.status === "ERROR" || c.status === "WARNING");
  if (warning.length > 0) {
    return <Badge label="Needs Attention" toneKey="WARNING" />;
  }
  if (healthy.length > 0) {
    return <Badge label={`${healthy.length} Active`} toneKey="HEALTHY" />;
  }
  return null;
}

export function ProvidersPageContent({
  providers,
  parsers,
  routingRules,
  renderedAt,
}: {
  providers: Provider[];
  parsers: RoutingParser[];
  routingRules: RoutingRule[];
  renderedAt: string;
}) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const providerTypes = [...new Set(providers.map((p) => p.sourceType))].sort();

  const filtered = providers.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sourceType.toLowerCase().includes(q)) return false;
    }
    if (statusFilter === "active" && !p.active) return false;
    if (statusFilter === "inactive" && p.active) return false;
    if (typeFilter && p.sourceType !== typeFilter) return false;
    return true;
  });

  const openCreate = () => {
    setSelectedProvider(null);
    setModalOpen(true);
  };

  const openEdit = (provider: Provider) => {
    setSelectedProvider(provider);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedProvider(null);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeactivating(true);
    try {
      const response = await fetch(`/api/providers/${deletingId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Provider delete failed");
      toast.success("Provider deactivated");
      setDeletingId(null);
      setDeleteError(null);
      router.refresh();
    } catch {
      setDeleteError("Failed to deactivate provider. Please try again.");
    } finally {
      setDeactivating(false);
    }
  };

  const openRoutingRule = (providerId?: string) => {
    window.dispatchEvent(new CustomEvent("leadbridge:open-routing-rule-modal", { detail: { providerId } }));
  };

  return (
    <div className="space-y-5">
      <Navbar
        title="Providers"
        subtitle="Manage lead sources and how incoming data is routed."
        showResync
        actions={
          <>
            <Button onClick={openCreate} className="h-10 whitespace-nowrap"><Plus size={16} />Create Provider</Button>
            <ExportButton type="providers" iconOnly />
            <SignOutButton />
          </>
        }
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <SearchToolbar
            value={search}
            onChange={(value) => setSearch(value)}
            placeholder="Search providers..."
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 w-full py-2.5 text-sm sm:w-36">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 w-full py-2.5 text-sm sm:w-36">
          <option value="">All types</option>
          {providerTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-[var(--color-muted)]" aria-live="polite">{filtered.length} {filtered.length === 1 ? "provider" : "providers"}</p>

      {filtered.length === 0 ? (
        <EmptyState
          title={search || statusFilter || typeFilter ? "No providers match your filters" : "No providers have been created yet"}
          description={search || statusFilter || typeFilter ? "Try adjusting your search or filters." : "Create a provider to start receiving leads from a new source."}
        />
      ) : (
        <div className="w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full divide-y divide-[var(--color-border)] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">Provider Name</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">Type</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">Status</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">Connected Connectors</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">Routing Rules</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">Last Sync</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">Leads Imported</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.flatMap((provider) => {
                  const isExpanded = expandedId === provider.id;
                  const expandedConnectors = provider.connectors.filter((c) => c.enabled);
                  const expandedRules = provider.routingRules.filter((r) => r.active);
                  const rows = [
                    <tr key={provider.id} className="transition-colors duration-150 hover:bg-slate-50/50">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : provider.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface)] transition-colors"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <div>
                            <p className="font-semibold text-[var(--color-ink)]">{provider.name}</p>
                            {provider.description && (
                              <p className="text-xs text-[var(--color-muted)] mt-0.5 line-clamp-1">{provider.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-[var(--color-ink)]">{provider.sourceType}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          {statusBadge(provider.active)}
                          {connectorHealthBadge(provider.connectors)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-[var(--color-ink)]">
                          {provider.activeConnectorCount > 0
                            ? `${provider.activeConnectorCount} of ${provider.totalConnectorCount}`
                            : provider.totalConnectorCount > 0
                              ? `${provider.totalConnectorCount} (all inactive)`
                              : "\u2014"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-[var(--color-ink)]">
                          {provider.routingRules.length > 0
                            ? `${provider.routingRules.length} rule${provider.routingRules.length > 1 ? "s" : ""}`
                            : "\u2014"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-[var(--color-muted)] tabular-nums">
                          {relativeTime(provider.lastSyncAt ?? provider.lastSuccessAt, hydrated ? undefined : "UTC", hydrated ? undefined : renderedAt)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">
                          {provider.leadCount.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openEdit(provider)}>Edit</Button>
                          <IconActionButton
                            icon={Trash2}
                            label={`Deactivate ${provider.name}`}
                            onClick={() => { setDeleteError(null); setDeletingId(provider.id); }}
                            isLoading={deactivating && deletingId === provider.id}
                          />
                        </div>
                      </td>
                    </tr>,
                  ];
                  if (isExpanded) {
                    rows.push(
                      <tr key={`${provider.id}-detail`} className="bg-[var(--color-surface)]/40">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">Description</h4>
                              {provider.description ? (
                                <p className="text-sm text-[var(--color-ink)]">{provider.description}</p>
                              ) : (
                                <p className="text-sm text-[var(--color-muted)] italic">No description</p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">Connectors</h4>
                              {expandedConnectors.length > 0 ? (
                                <div className="space-y-1.5">
                                  {expandedConnectors.map((c) => (
                                    <div key={c.id} className="flex items-center gap-2 text-sm">
                                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-success)]" />
                                      <span className="text-[var(--color-ink)]">{c.name}</span>
                                      <span className="text-xs text-[var(--color-muted)]">({c.type})</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-[var(--color-muted)] italic">None connected</p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">Active Routing Rules</h4>
                              {expandedRules.length > 0 ? (
                                <div className="space-y-1.5">
                                  {expandedRules.map((r) => (
                                    <div key={r.id} className="flex items-center gap-2 text-sm">
                                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand)]" />
                                      <span className="text-[var(--color-ink)]">{r.name}</span>
                                      <span className="text-xs text-[var(--color-muted)]">(Priority {r.priority})</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-sm text-[var(--color-muted)] italic">
                                    No active routing rules. Payloads from this provider will be recorded as unmatched.
                                  </p>
                                  <Button variant="secondary" size="sm" onClick={() => openRoutingRule(provider.id)}>
                                    <Plus size={14} />
                                    Configure Routing
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>,
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RoutingRulesManager providers={providers} parsers={parsers} rules={routingRules} />

      <ProviderEditModal
        open={modalOpen}
        onClose={closeModal}
        provider={selectedProvider}
      />
      <ConfirmDialog
        open={!!deletingId}
        title="Delete this provider?"
        description="This deactivates the provider and disconnects it from connectors. Existing leads remain in the CRM."
        confirmLabel="Deactivate provider"
        isLoading={deactivating}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => { if (!deactivating) { setDeletingId(null); setDeleteError(null); } }}
      />
    </div>
  );
}
