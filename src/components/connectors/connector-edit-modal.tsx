"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { DateTimeCell } from "@/components/ui/date-time-cell";
import { toast } from "@/lib/toast";
import type { SerializedConnector } from "@/app/(dashboard)/admin/connectors/page";

type TabId = "general" | "configuration" | "scheduling" | "runtime";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "general", label: "General" },
  { id: "configuration", label: "Configuration" },
  { id: "scheduling", label: "Scheduling" },
  { id: "runtime", label: "Runtime" },
];

const SCHEDULE_OPTIONS = [
  { value: "MANUAL", label: "Manual" },
  { value: "EVERY_5_MIN", label: "Every 5 Minutes" },
  { value: "EVERY_15_MIN", label: "Every 15 Minutes" },
  { value: "EVERY_30_MIN", label: "Every 30 Minutes" },
  { value: "HOURLY", label: "Hourly" },
  { value: "DAILY", label: "Daily" },
  { value: "CUSTOM", label: "Custom" },
];

type RestConfig = {
  baseUrl: string;
  endpoint: string;
  method: string;
  headers: string;
  queryParams: string;
  body: string;
  authType: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: string;
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
  customHeaderName: string;
  customHeaderValue: string;
  leadArrayPath: string;
  timeout: string;
  retryCount: string;
  rateLimitDelayMs: string;
  paginationStrategy: string;
  pageSize: string;
  maxPages: string;
};

const EMPTY_CONFIG: RestConfig = {
  baseUrl: "",
  endpoint: "",
  method: "GET",
  headers: "",
  queryParams: "",
  body: "",
  authType: "NONE",
  apiKeyName: "",
  apiKeyValue: "",
  apiKeyIn: "header",
  bearerToken: "",
  basicUsername: "",
  basicPassword: "",
  customHeaderName: "",
  customHeaderValue: "",
  leadArrayPath: "data",
  timeout: "30000",
  retryCount: "3",
  rateLimitDelayMs: "200",
  paginationStrategy: "PAGE_NUMBER",
  pageSize: "50",
  maxPages: "50",
};

function parseJsonLines(input: string): Record<string, string> {
  if (!input.trim()) return {};
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, string>;
    }
  } catch {
  }
  const result: Record<string, string> = {};
  for (const line of input.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      result[trimmed.slice(0, colonIdx).trim()] = trimmed.slice(colonIdx + 1).trim();
    }
  }
  return result;
}

function formatRecord(input: Record<string, string> | undefined | null): string {
  if (!input || Object.keys(input).length === 0) return "";
  return Object.entries(input)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function buildConfiguration(c: RestConfig): Record<string, unknown> | null {
  if (!c.baseUrl || !c.endpoint) return null;

  const auth: Record<string, unknown> = { type: c.authType };
  if (c.authType === "API_KEY") {
    auth.apiKey = { name: c.apiKeyName, value: c.apiKeyValue, in: c.apiKeyIn };
  }
  if (c.authType === "BEARER") {
    auth.bearerToken = c.bearerToken;
  }
  if (c.authType === "BASIC") {
    auth.basic = { username: c.basicUsername, password: c.basicPassword };
  }
  if (c.authType === "CUSTOM_HEADER") {
    auth.customHeader = { name: c.customHeaderName, value: c.customHeaderValue };
  }

  const pagination: Record<string, unknown> = {
    strategy: c.paginationStrategy,
  };
  if (c.pageSize) pagination.pageSize = Number(c.pageSize);
  if (c.maxPages) pagination.maxPages = Number(c.maxPages);

  const config: Record<string, unknown> = {
    baseUrl: c.baseUrl,
    endpoint: c.endpoint,
    method: c.method,
    auth,
    pagination,
    leadArrayPath: c.leadArrayPath || "data",
    timeout: Number(c.timeout) || 30000,
    retryCount: Number(c.retryCount) || 3,
    rateLimitDelayMs: Number(c.rateLimitDelayMs) || 200,
  };

  const headers = parseJsonLines(c.headers);
  if (Object.keys(headers).length > 0) config.headers = headers;

  const queryParams = parseJsonLines(c.queryParams);
  if (Object.keys(queryParams).length > 0) config.queryParams = queryParams;

  if (c.method !== "GET" && c.body) {
    config.body = c.body;
  }

  return config;
}

export function ConnectorEditModal({
  open,
  onClose,
  connector,
}: {
  open: boolean;
  onClose: () => void;
  connector?: SerializedConnector | null;
}) {
  const router = useRouter();
  const isEdit = !!connector;
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("rest");
  const [enabled, setEnabled] = useState(false);
  const [scheduleType, setScheduleType] = useState("MANUAL");
  const [restConfig, setRestConfig] = useState<RestConfig>(EMPTY_CONFIG);

  const isRest = type === "rest";

  useEffect(() => {
    if (!open) return;
    if (connector) {
      setName(connector.name);
      setType(connector.type);
      setEnabled(connector.enabled);
      setScheduleType(connector.scheduleType);
    } else {
      setName("");
      setType("rest");
      setEnabled(false);
      setScheduleType("MANUAL");
    }
    setRestConfig(EMPTY_CONFIG);
    setActiveTab("general");
    setError(null);
  }, [open, connector]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const updateConfig = (field: keyof RestConfig, value: string) => {
    setRestConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const configuration = isRest && (!isEdit || activeTab === "configuration")
        ? buildConfiguration(restConfig)
        : undefined;

      if (isEdit) {
        await axios.patch(`/api/connectors/${connector!.id}/settings`, {
          enabled,
          scheduleType,
          ...(configuration ? { configuration } : {}),
        });
        toast.success("Connector updated");
      } else {
        await axios.post("/api/connectors", {
          name,
          type,
          enabled: false,
          ...(configuration ? { configuration } : {}),
        });
        toast.success("Connector created");
      }
      onClose();
      router.refresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.details) {
        setError("Configuration validation failed.");
      } else {
        setError(isEdit ? "Failed to update connector." : "Failed to create connector.");
      }
    } finally {
      setPending(false);
    }
  };

  if (!open) return null;

  const showConfigTab = activeTab === "configuration";

  const healthStatusLabel = connector?.healthStatus ?? "HEALTHY";
  const runtimeMeta = connector?.runtimeMetadata as Record<string, unknown> | null ?? {};

  const visibleTabs = tabs.filter((t) => t.id !== "configuration" || isRest);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 mt-6 mb-6 w-[90%] max-w-4xl flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        style={{ height: "88vh", maxHeight: "88vh" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            {isEdit ? "Edit Connector" : "Create Connector"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)] transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="flex border-b border-[var(--color-border)] bg-white">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 ${
                activeTab === tab.id
                  ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {activeTab === "general" && (
              <div className="space-y-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                  General Configuration
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Name" htmlFor="connector-name" required className="col-span-2">
                    <Input
                      id="connector-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={isEdit}
                    />
                  </FormField>
                  <FormField label="Type" htmlFor="connector-type" required>
                    <Select
                      id="connector-type"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      disabled={isEdit}
                    >
                      <option value="gmail">Gmail</option>
                      <option value="rest">REST API</option>
                    </Select>
                  </FormField>
                  <FormField label="Enabled" htmlFor="connector-enabled">
                    <label className="flex items-center gap-2 cursor-pointer h-10">
                      <input
                        id="connector-enabled"
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]/20"
                      />
                      <span className="text-sm text-[var(--color-ink)]">
                        {enabled ? "Active" : "Disabled"}
                      </span>
                    </label>
                  </FormField>
                </div>
              </div>
            )}

            {activeTab === "configuration" && isRest && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    General
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Base URL" htmlFor="cfg-base-url" className="col-span-2" required>
                      <Input
                        id="cfg-base-url"
                        value={restConfig.baseUrl}
                        onChange={(e) => updateConfig("baseUrl", e.target.value)}
                        placeholder="https://api.example.com"
                      />
                    </FormField>
                    <FormField label="Endpoint" htmlFor="cfg-endpoint" required>
                      <Input
                        id="cfg-endpoint"
                        value={restConfig.endpoint}
                        onChange={(e) => updateConfig("endpoint", e.target.value)}
                        placeholder="/v1/leads"
                      />
                    </FormField>
                    <FormField label="HTTP Method" htmlFor="cfg-method">
                      <Select
                        id="cfg-method"
                        value={restConfig.method}
                        onChange={(e) => updateConfig("method", e.target.value)}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                      </Select>
                    </FormField>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Authentication
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Type" htmlFor="cfg-auth-type" className="col-span-2">
                      <Select
                        id="cfg-auth-type"
                        value={restConfig.authType}
                        onChange={(e) => updateConfig("authType", e.target.value)}
                      >
                        <option value="NONE">None</option>
                        <option value="API_KEY">API Key</option>
                        <option value="BEARER">Bearer Token</option>
                        <option value="BASIC">Basic Auth</option>
                        <option value="CUSTOM_HEADER">Custom Header</option>
                      </Select>
                    </FormField>

                    {restConfig.authType === "API_KEY" && (
                      <>
                        <FormField label="Key Name" htmlFor="cfg-api-key-name">
                          <Input id="cfg-api-key-name" value={restConfig.apiKeyName} onChange={(e) => updateConfig("apiKeyName", e.target.value)} placeholder="X-API-Key" />
                        </FormField>
                        <FormField label="Key Value" htmlFor="cfg-api-key-value">
                          <Input id="cfg-api-key-value" type="password" value={restConfig.apiKeyValue} onChange={(e) => updateConfig("apiKeyValue", e.target.value)} placeholder="Leave blank to keep existing" autoComplete="off" />
                        </FormField>
                        <FormField label="Location" htmlFor="cfg-api-key-in">
                          <Select id="cfg-api-key-in" value={restConfig.apiKeyIn} onChange={(e) => updateConfig("apiKeyIn", e.target.value)}>
                            <option value="header">Header</option>
                            <option value="query">Query Parameter</option>
                          </Select>
                        </FormField>
                      </>
                    )}

                    {restConfig.authType === "BEARER" && (
                      <FormField label="Token" htmlFor="cfg-bearer-token" className="col-span-2">
                        <Input id="cfg-bearer-token" type="password" value={restConfig.bearerToken} onChange={(e) => updateConfig("bearerToken", e.target.value)} placeholder="Leave blank to keep existing" autoComplete="off" />
                      </FormField>
                    )}

                    {restConfig.authType === "BASIC" && (
                      <>
                        <FormField label="Username" htmlFor="cfg-basic-username">
                          <Input id="cfg-basic-username" value={restConfig.basicUsername} onChange={(e) => updateConfig("basicUsername", e.target.value)} />
                        </FormField>
                        <FormField label="Password" htmlFor="cfg-basic-password">
                          <Input id="cfg-basic-password" type="password" value={restConfig.basicPassword} onChange={(e) => updateConfig("basicPassword", e.target.value)} placeholder="Leave blank to keep existing" autoComplete="off" />
                        </FormField>
                      </>
                    )}

                    {restConfig.authType === "CUSTOM_HEADER" && (
                      <>
                        <FormField label="Header Name" htmlFor="cfg-custom-header-name">
                          <Input id="cfg-custom-header-name" value={restConfig.customHeaderName} onChange={(e) => updateConfig("customHeaderName", e.target.value)} placeholder="X-Custom" />
                        </FormField>
                        <FormField label="Header Value" htmlFor="cfg-custom-header-value">
                          <Input id="cfg-custom-header-value" type="password" value={restConfig.customHeaderValue} onChange={(e) => updateConfig("customHeaderValue", e.target.value)} placeholder="Leave blank to keep existing" autoComplete="off" />
                        </FormField>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Request
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Headers (key: value per line)" htmlFor="cfg-headers" className="col-span-2">
                      <Textarea
                        id="cfg-headers"
                        value={restConfig.headers}
                        onChange={(e) => updateConfig("headers", e.target.value)}
                        rows={3}
                        placeholder="Content-Type: application/json"
                      />
                    </FormField>
                    <FormField label="Query Parameters (key: value per line)" htmlFor="cfg-query-params" className="col-span-2">
                      <Textarea
                        id="cfg-query-params"
                        value={restConfig.queryParams}
                        onChange={(e) => updateConfig("queryParams", e.target.value)}
                        rows={3}
                        placeholder="status: active&#10;limit: 100"
                      />
                    </FormField>
                    {restConfig.method !== "GET" && (
                      <FormField label="Request Body" htmlFor="cfg-body" className="col-span-2">
                        <Textarea
                          id="cfg-body"
                          value={restConfig.body}
                          onChange={(e) => updateConfig("body", e.target.value)}
                          rows={4}
                          placeholder='{"filter": {"status": "new"}}'
                        />
                      </FormField>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Response
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Lead Array Path" htmlFor="cfg-lead-path" className="col-span-2">
                      <Input
                        id="cfg-lead-path"
                        value={restConfig.leadArrayPath}
                        onChange={(e) => updateConfig("leadArrayPath", e.target.value)}
                        placeholder='data.items or leave empty for root array'
                      />
                    </FormField>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Runtime
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField label="Timeout (ms)" htmlFor="cfg-timeout">
                      <Input id="cfg-timeout" type="number" value={restConfig.timeout} onChange={(e) => updateConfig("timeout", e.target.value)} />
                    </FormField>
                    <FormField label="Retry Count" htmlFor="cfg-retry-count">
                      <Input id="cfg-retry-count" type="number" value={restConfig.retryCount} onChange={(e) => updateConfig("retryCount", e.target.value)} />
                    </FormField>
                    <FormField label="Rate Limit Delay (ms)" htmlFor="cfg-rate-limit">
                      <Input id="cfg-rate-limit" type="number" value={restConfig.rateLimitDelayMs} onChange={(e) => updateConfig("rateLimitDelayMs", e.target.value)} />
                    </FormField>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                    Pagination
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField label="Strategy" htmlFor="cfg-pagination-strategy">
                      <Select
                        id="cfg-pagination-strategy"
                        value={restConfig.paginationStrategy}
                        onChange={(e) => updateConfig("paginationStrategy", e.target.value)}
                      >
                        <option value="PAGE_NUMBER">Page Number</option>
                        <option value="OFFSET">Offset</option>
                        <option value="CURSOR">Cursor</option>
                        <option value="NEXT_URL">Next URL</option>
                        <option value="TOKEN">Token</option>
                      </Select>
                    </FormField>
                    <FormField label="Page Size" htmlFor="cfg-page-size">
                      <Input id="cfg-page-size" type="number" value={restConfig.pageSize} onChange={(e) => updateConfig("pageSize", e.target.value)} />
                    </FormField>
                    <FormField label="Max Pages" htmlFor="cfg-max-pages">
                      <Input id="cfg-max-pages" type="number" value={restConfig.maxPages} onChange={(e) => updateConfig("maxPages", e.target.value)} />
                    </FormField>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-muted)]">
                  Configuration is stored securely and never exposed to the browser. When updating, leave secret fields blank to preserve existing values.
                </p>
              </div>
            )}

            {activeTab === "configuration" && !isRest && (
              <div className="flex items-center justify-center py-12 text-sm text-[var(--color-muted)]">
                Configuration is available for REST API connectors.
              </div>
            )}

            {activeTab === "scheduling" && (
              <div className="space-y-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                  Sync Schedule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Schedule" htmlFor="connector-schedule">
                    <Select
                      id="connector-schedule"
                      value={scheduleType}
                      onChange={(e) => setScheduleType(e.target.value)}
                    >
                      {SCHEDULE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                {isEdit && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Last Sync">
                      <DateTimeCell value={connector?.lastSyncedAt} fallback="Never" />
                    </FormField>
                    <FormField label="Next Scheduled">
                      <DateTimeCell value={connector?.nextScheduledRun} fallback="-" />
                    </FormField>
                  </div>
                )}
              </div>
            )}

            {activeTab === "runtime" && isEdit && (
              <div className="space-y-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                  Connector Health
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Health Status">
                    <Badge
                      label={healthStatusLabel}
                      toneKey={healthStatusLabel === "HEALTHY" ? "CONVERTED" : healthStatusLabel === "WARNING" ? "ON_HOLD" : "LOST"}
                    />
                  </FormField>
                  <FormField label="Running">
                    <span className="text-sm font-semibold text-[var(--color-ink)]">
                      {connector?.isRunning ? "Yes" : "No"}
                    </span>
                  </FormField>
                  <FormField label="Consecutive Failures">
                    <span className="text-sm font-semibold text-[var(--color-ink)]">
                      {connector?.consecutiveFailures ?? 0}
                    </span>
                  </FormField>
                  <FormField label="Last Duration">
                    <span className="text-sm text-[var(--color-ink)]">
                      {connector?.lastDurationMs != null
                        ? `${(connector.lastDurationMs / 1000).toFixed(1)}s`
                        : "-"}
                    </span>
                  </FormField>
                  <FormField label="Average Duration">
                    <span className="text-sm text-[var(--color-ink)]">
                      {connector?.averageDurationMs != null
                        ? `${(connector.averageDurationMs / 1000).toFixed(1)}s`
                        : "-"}
                    </span>
                  </FormField>
                  <FormField label="Last Success">
                    <DateTimeCell value={connector?.lastSuccessAt} fallback="-" />
                  </FormField>
                  <FormField label="Last Failure">
                    <DateTimeCell value={connector?.lastFailureAt} fallback="-" />
                  </FormField>
                </div>

                {connector?.lastError && (
                  <div className="rounded-xl bg-red-50 px-4 py-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Last Error</p>
                    <p className="text-sm text-red-600 font-mono text-xs whitespace-pre-wrap break-words">
                      {connector.lastError}
                    </p>
                  </div>
                )}

                <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] pt-4">
                  Runtime Metadata
                </h3>
                <div className="rounded-xl bg-slate-50 px-4 py-3 font-mono text-xs text-[var(--color-ink)] whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {Object.keys(runtimeMeta).length > 0
                    ? JSON.stringify(runtimeMeta, null, 2)
                    : "No runtime metadata available."}
                </div>
              </div>
            )}

            {activeTab === "runtime" && !isEdit && (
              <div className="flex items-center justify-center py-12 text-sm text-[var(--color-muted)]">
                Save the connector first to see runtime information.
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" isLoading={pending}>
                {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Connector"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
