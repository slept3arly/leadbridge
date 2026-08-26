"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { CheckCircle2, Edit3, Link2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/lib/toast";

type Provider = {
  id: string;
  name: string;
  sourceType: string;
  connectors: Array<{ id: string; name: string; enabled: boolean; type: string }>;
};

type Parser = {
  id: string;
  name: string;
  version: string | null;
  description: string | null;
  providerTypesSupported: string[];
  enabled: boolean;
};

type RoutingConnector = {
  id: string;
  name: string;
  environmentKey: string | null;
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
  connector: RoutingConnector | null;
};

type RoutingRuleForm = {
  name: string;
  providerId: string;
  parserId: string;
  connectorId: string;
  recipientGmailAccount: string;
  senderEmail: string;
  senderDomain: string;
  subjectContains: string;
  gmailLabel: string;
  priority: string;
  fallback: boolean;
  active: boolean;
};

type RoutingRuleOpenDetail = {
  providerId?: string;
  ruleId?: string;
};

const EMPTY_FORM: RoutingRuleForm = {
  name: "",
  providerId: "",
  parserId: "",
  connectorId: "",
  recipientGmailAccount: "",
  senderEmail: "",
  senderDomain: "",
  subjectContains: "",
  gmailLabel: "",
  priority: "100",
  fallback: false,
  active: true,
};

function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function describeConditions(rule: RoutingRule): string {
  const parts = [
    rule.recipientGmailAccount ? `Recipient ${rule.recipientGmailAccount}` : null,
    rule.senderEmail ? `Sender ${rule.senderEmail}` : null,
    rule.senderDomain ? `Domain ${rule.senderDomain}` : null,
    rule.subjectContains ? `Subject contains "${rule.subjectContains}"` : null,
    rule.gmailLabel ? `Label ${rule.gmailLabel}` : null,
    rule.connector ? `Connector ${rule.connector.name}` : null,
    rule.fallback ? "Fallback" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" • ") : "Matches any payload";
}

function createOpenEvent(detail: RoutingRuleOpenDetail): CustomEvent<RoutingRuleOpenDetail> {
  return new CustomEvent("leadbridge:open-routing-rule-modal", { detail });
}

export function RoutingRulesManager({
  providers,
  parsers,
  rules,
}: {
  providers: Provider[];
  parsers: Parser[];
  rules: RoutingRule[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(rules);
  const [open, setOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RoutingRuleForm>(EMPTY_FORM);

  useEffect(() => {
    setItems(rules);
  }, [rules]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<RoutingRuleOpenDetail>).detail ?? {};
      const providerId = detail.providerId ?? providers[0]?.id ?? "";
      const nextProvider = providers.find((provider) => provider.id === providerId) ?? providers[0];
      const nextParser = parsers.find((parser) =>
        !nextProvider
          ? true
          : parser.providerTypesSupported.length === 0 || parser.providerTypesSupported.includes(nextProvider.sourceType),
      ) ?? parsers[0];

      if (!nextProvider || !nextParser) {
        setError("Create or register a provider and parser before adding routing rules.");
        return;
      }

      const rule = detail.ruleId ? items.find((entry) => entry.id === detail.ruleId) : null;
      if (rule) {
        setEditingRuleId(rule.id);
        setForm({
          name: rule.name,
          providerId: rule.provider.id,
          parserId: rule.parser.id,
          connectorId: rule.connector?.id ?? "",
          recipientGmailAccount: rule.recipientGmailAccount ?? "",
          senderEmail: rule.senderEmail ?? "",
          senderDomain: rule.senderDomain ?? "",
          subjectContains: rule.subjectContains ?? "",
          gmailLabel: rule.gmailLabel ?? "",
          priority: String(rule.priority),
          fallback: rule.fallback,
          active: rule.active,
        });
      } else {
        setEditingRuleId(null);
        setForm({
          ...EMPTY_FORM,
          providerId: nextProvider.id,
          parserId: nextParser.id,
        });
      }
      setOpen(true);
      setError(null);
    };

    window.addEventListener("leadbridge:open-routing-rule-modal", handler);
    return () => window.removeEventListener("leadbridge:open-routing-rule-modal", handler);
  }, [items, parsers, providers]);

  const providerById = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const parserOptions = useMemo(() => {
    const provider = providerById.get(form.providerId);
    return parsers.filter((parser) =>
      !provider ? true : parser.providerTypesSupported.length === 0 || parser.providerTypesSupported.includes(provider.sourceType),
    );
  }, [form.providerId, parsers, providerById]);

  const connectorOptions = useMemo(() => {
    const provider = providerById.get(form.providerId);
    return provider?.connectors ?? [];
  }, [form.providerId, providerById]);

  const activeCount = items.filter((rule) => rule.active).length;

  const openCreate = (providerId?: string) => {
    window.dispatchEvent(createOpenEvent({ providerId }));
  };

  const updateField = <K extends keyof RoutingRuleForm>(field: K, value: RoutingRuleForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const close = () => {
    setOpen(false);
    setEditingRuleId(null);
    setError(null);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const payload = {
      id: editingRuleId,
      name: form.name.trim(),
      providerId: form.providerId,
      parserId: form.parserId,
      connectorId: toNullable(form.connectorId),
      recipientGmailAccount: toNullable(form.recipientGmailAccount),
      senderEmail: toNullable(form.senderEmail),
      senderDomain: toNullable(form.senderDomain),
      subjectContains: toNullable(form.subjectContains),
      gmailLabel: toNullable(form.gmailLabel),
      priority: Number(form.priority) || 100,
      fallback: form.fallback,
      active: form.active,
    };

    try {
      if (editingRuleId) {
        const response = await axios.patch("/api/providers/routing-rules", payload);
        setItems((prev) => prev.map((rule) => (rule.id === editingRuleId ? response.data : rule)));
        toast.success("Routing rule updated");
      } else {
        const response = await axios.post("/api/providers/routing-rules", payload);
        setItems((prev) => [response.data, ...prev]);
        toast.success("Routing rule created");
      }
      close();
      router.refresh();
    } catch {
      setError(editingRuleId ? "Failed to update routing rule." : "Failed to create routing rule.");
    } finally {
      setPending(false);
    }
  };

  const toggleActive = async (rule: RoutingRule) => {
    try {
      const response = await axios.patch("/api/providers/routing-rules", { id: rule.id, active: !rule.active });
      setItems((prev) => prev.map((entry) => (entry.id === rule.id ? response.data : entry)));
      toast.success(rule.active ? "Routing rule disabled" : "Routing rule enabled");
      router.refresh();
    } catch {
      toast.error("Failed to update routing rule");
    }
  };

  const remove = async (rule: RoutingRule) => {
    if (!confirm(`Delete routing rule "${rule.name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/providers/routing-rules/${rule.id}`);
      setItems((prev) => prev.filter((entry) => entry.id !== rule.id));
      toast.success("Routing rule deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete routing rule");
    }
  };

  const selectedProvider = providerById.get(form.providerId) ?? null;
  const filteredParserOptions = parserOptions;

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Routing Rules</CardTitle>
            <CardDescription>
              Providers, parsers, and connectors are linked here. The runtime matches active rules in priority order.
            </CardDescription>
          </div>
          <Button onClick={() => openCreate()}>
            <Plus size={16} />
            Create Routing Rule
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <div className="py-2">
            <EmptyState
              title="No routing rules configured"
              description="Create a rule for a provider so inbound payloads can be routed to the correct parser."
            />
            <div className="mt-4 flex justify-center">
              <Button onClick={() => openCreate()}>Create Routing Rule</Button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <table className="min-w-full divide-y divide-[var(--color-border)] text-left text-sm">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Rule</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Provider</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Parser</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Scope</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Priority</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-white">
                {items.map((rule) => (
                  <tr key={rule.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[var(--color-ink)]">{rule.name}</p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">{rule.fallback ? "Fallback rule" : "Conditional rule"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-[var(--color-ink)]">{rule.provider.name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-[var(--color-ink)]">{rule.parser.name}</p>
                      {rule.parser.version && <p className="text-xs text-[var(--color-muted)]">v{rule.parser.version}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-[var(--color-muted)] leading-5">{describeConditions(rule)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-ink)]">
                        {rule.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${rule.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {rule.active ? <CheckCircle2 size={12} /> : <X size={12} />}
                          {rule.active ? "Active" : "Inactive"}
                        </span>
                        {rule.connector ? (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                            <Link2 size={12} />
                            {rule.connector.name}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => window.dispatchEvent(createOpenEvent({ ruleId: rule.id }))}>
                          <Edit3 size={14} />
                          Edit
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => toggleActive(rule)}>
                          <RefreshCw size={14} />
                          {rule.active ? "Disable" : "Enable"}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => remove(rule)}>
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-[var(--color-muted)]">
          Active rules: {activeCount}. The first active rule that matches wins.
        </p>
      </CardContent>

      {error ? (
        <CardFooter className="border-t-0 pt-0">
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        </CardFooter>
      ) : null}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
          <div className="relative z-10 mt-6 mb-6 w-[92%] max-w-3xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-ink)]">
                  {editingRuleId ? "Edit Routing Rule" : "Create Routing Rule"}
                </h3>
                <p className="text-sm text-[var(--color-muted)]">
                  Link a provider to a parser and narrow the match conditions if needed.
                </p>
              </div>
              <button type="button" onClick={close} className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={save} className="max-h-[80vh] overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                <label className="col-span-2 space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Rule Name</span>
                  <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} required placeholder="e.g. Mock REST Leads" />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Provider</span>
                  <Select
                    value={form.providerId}
                    onChange={(e) => {
                      const nextProvider = providers.find((provider) => provider.id === e.target.value);
                      const nextParser = parsers.find((parser) =>
                        !nextProvider
                          ? true
                          : parser.providerTypesSupported.length === 0 || parser.providerTypesSupported.includes(nextProvider.sourceType),
                      );
                      updateField("providerId", e.target.value);
                      updateField("connectorId", "");
                      if (nextParser) {
                        updateField("parserId", nextParser.id);
                      }
                    }}
                    required
                  >
                    <option value="">Select provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.name} ({provider.sourceType})</option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Parser</span>
                  <Select value={form.parserId} onChange={(e) => updateField("parserId", e.target.value)} required>
                    <option value="">Select parser</option>
                    {filteredParserOptions.map((parser) => (
                      <option key={parser.id} value={parser.id}>
                        {parser.name}{parser.version ? ` v${parser.version}` : ""}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Connector</span>
                  <Select value={form.connectorId} onChange={(e) => updateField("connectorId", e.target.value)}>
                    <option value="">Any connector</option>
                    {connectorOptions.map((connector) => (
                      <option key={connector.id} value={connector.id}>{connector.name}</option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Priority</span>
                  <Input type="number" min={0} max={10000} value={form.priority} onChange={(e) => updateField("priority", e.target.value)} />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Recipient Gmail Account</span>
                  <Input value={form.recipientGmailAccount} onChange={(e) => updateField("recipientGmailAccount", e.target.value)} placeholder="inbox@example.com" />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Sender Email</span>
                  <Input value={form.senderEmail} onChange={(e) => updateField("senderEmail", e.target.value)} placeholder="john@example.com" />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Sender Domain</span>
                  <Input value={form.senderDomain} onChange={(e) => updateField("senderDomain", e.target.value)} placeholder="example.com" />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Subject Contains</span>
                  <Input value={form.subjectContains} onChange={(e) => updateField("subjectContains", e.target.value)} placeholder="pricing" />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--color-ink)]">Gmail Label</span>
                  <Input value={form.gmailLabel} onChange={(e) => updateField("gmailLabel", e.target.value)} placeholder="Inbox" />
                </label>

                <label className="flex items-center gap-2 pt-7">
                  <input type="checkbox" checked={form.fallback} onChange={(e) => updateField("fallback", e.target.checked)} />
                  <span className="text-sm text-[var(--color-ink)]">Fallback rule</span>
                </label>

                <label className="flex items-center gap-2 pt-7">
                  <input type="checkbox" checked={form.active} onChange={(e) => updateField("active", e.target.checked)} />
                  <span className="text-sm text-[var(--color-ink)]">Active</span>
                </label>
              </div>

              {selectedProvider ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-slate-50/50 px-4 py-3 text-xs text-[var(--color-muted)]">
                  Provider {selectedProvider.name} has {selectedProvider.connectors.filter((connector) => connector.enabled).length} active connector(s). Use the connector selector if the rule should be limited to one connector.
                </div>
              ) : null}

              {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button type="button" variant="secondary" onClick={close} disabled={pending}>Cancel</Button>
                <Button type="submit" isLoading={pending}>{editingRuleId ? "Save Rule" : "Create Rule"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
