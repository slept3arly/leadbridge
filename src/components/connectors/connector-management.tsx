"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Provider = { id: string; name: string };
type Parser = { key: string; name: string; type: string; version: string; description: string };
type ConnectorTypeInfo = { key: string; name: string; description: string; version: string };
type GmailAccount = { key: string; name: string; status: string; missing: string[]; lastSyncedAt: string | null; providerCount: number };
type ConnectorRow = {
  id: string; name: string; type: string; status: string; enabled: boolean;
  environmentKey: string | null;
  lastSyncedAt: string | null; lastSuccessAt: string | null; lastFailureAt: string | null;
  lastError: string | null; runtimeMetadata: Record<string, unknown> | null;
  scheduleType: string; scheduleConfig: Record<string, unknown> | null;
  nextScheduledRun: string | null;
  consecutiveFailures: number; averageDurationMs: number | null; lastDurationMs: number | null;
  healthStatus: string; isRunning: boolean; lockedBy: string | null;
};
type SyncRun = { id: string; status: string; startedAt: string; completedAt: string | null; recordsSeen: number; recordsCreated: number; recordsUpdated: number; recordsSkipped: number; errorMessage: string | null; connector: { name: string }; metadata: Record<string, unknown> | null };
type Unmatched = { id: string; senderEmail: string; subject: string | null; receivedAt: string; rawPreview: string | null; status: string; provider: Provider | null };
type ParserRequest = { id: string; vendorName: string; senderEmail: string; sampleSubject: string | null; status: string; requestedAt: string; requestedBy: { name: string } };

const SCHEDULE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  EVERY_5_MIN: "Every 5 min",
  EVERY_15_MIN: "Every 15 min",
  EVERY_30_MIN: "Every 30 min",
  HOURLY: "Hourly",
  DAILY: "Daily",
  CUSTOM: "Custom",
};

const AUTH_TYPE_LABELS: Record<string, string> = {
  NONE: "No auth",
  API_KEY: "API Key",
  BEARER: "Bearer Token",
  BASIC: "Basic Auth",
  CUSTOM_HEADER: "Custom Header",
};

const PAGINATION_LABELS: Record<string, string> = {
  PAGE_NUMBER: "Page number",
  OFFSET: "Offset",
  CURSOR: "Cursor",
  NEXT_URL: "Next URL",
  TOKEN: "Token-based",
};

export function ConnectorManagement({
  providers,
  parsers,
  connectorTypes,
  gmailAccounts,
  connectors,
  syncRuns,
  unmatched,
  parserRequests,
}: {
  providers: Provider[];
  parsers: Parser[];
  connectorTypes: ConnectorTypeInfo[];
  gmailAccounts: GmailAccount[];
  connectors: ConnectorRow[];
  syncRuns: SyncRun[];
  unmatched: Unmatched[];
  parserRequests: ParserRequest[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [restName, setRestName] = useState("");
  const [restType, setRestType] = useState("rest");
  const [restBaseUrl, setRestBaseUrl] = useState("");
  const [restEndpoint, setRestEndpoint] = useState("");
  const [restMethod, setRestMethod] = useState("GET");
  const [restAuthType, setRestAuthType] = useState("NONE");
  const [restBearerToken, setRestBearerToken] = useState("");
  const [restLeadPath, setRestLeadPath] = useState("data");
  const [restPagination, setRestPagination] = useState("PAGE_NUMBER");
  const [restHeaders, setRestHeaders] = useState("");
  const [restBody, setRestBody] = useState("");

  async function testConnection(key: string) {
    const response = await axios.post("/api/providers/connectors/test", { key, kind: "GMAIL" });
    if (response.data.success) {
      setMessage(`✅ ${key}: connected as ${response.data.emailAddress ?? "unknown"} (historyId: ${response.data.historyId ?? "—"})`);
    } else {
      setMessage(`❌ ${key}: ${response.data.error ?? "connection failed"}`);
    }
  }

  async function syncNow(connectorId: string) {
    setSyncingId(connectorId);
    setMessage(null);
    try {
      const response = await axios.post(`/api/connectors/${connectorId}/sync`);
      const data = response.data.data;
      if (data.status === "success") {
        setMessage(`✅ Sync complete — ${data.leadCount} leads imported, ${data.rawPayloadCount - data.leadCount} skipped`);
      } else if (data.status === "skipped") {
        setMessage(`ℹ️ Sync skipped: ${data.warnings.join(", ")}`);
      } else {
        setMessage(`❌ Sync failed: ${data.errors.map((e: { message: string }) => e.message).join(", ")}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setMessage("⏳ Connector is already running. Try again later.");
      } else {
        setMessage(`❌ Sync error: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } finally {
      setSyncingId(null);
    }
  }

  async function updateConnectorSettings(id: string, settings: Record<string, unknown>) {
    setSavingId(id);
    setMessage(null);
    try {
      await axios.patch(`/api/connectors/${id}/settings`, settings);
      setMessage("✅ Connector settings updated");
      window.location.reload();
    } catch (error) {
      setMessage(`❌ Failed to update: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleUnmatched(id: string, action: "ASSIGN" | "CREATE_PROVIDER" | "IGNORE" | "SPAM" | "REQUEST_PARSER", providerId?: string) {
    await axios.patch("/api/providers/unmatched", { id, action, providerId });
    window.location.reload();
  }

  async function createRestConnector() {
    const headersObj: Record<string, string> = {};
    if (restHeaders) {
      restHeaders.split("\n").filter(Boolean).forEach((line) => {
        const idx = line.indexOf(":");
        if (idx > 0) headersObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
    }

    const configuration: Record<string, unknown> = {
      baseUrl: restBaseUrl,
      endpoint: restEndpoint,
      method: restMethod,
      leadArrayPath: restLeadPath,
      headers: Object.keys(headersObj).length ? headersObj : undefined,
      body: restMethod !== "GET" && restBody ? restBody : undefined,
      auth: {
        type: restAuthType,
        ...(restAuthType === "BEARER" ? { bearerToken: restBearerToken } : {}),
      },
      pagination: {
        strategy: restPagination,
        pageSize: 50,
      },
      timeout: 30000,
      retryCount: 3,
      rateLimitDelayMs: 200,
    };

    await axios.post("/api/connectors", { name: restName, type: restType, configuration });
    window.location.reload();
  }

  async function testRestConnection() {
    const headersObj: Record<string, string> = {};
    if (restHeaders) {
      restHeaders.split("\n").filter(Boolean).forEach((line) => {
        const idx = line.indexOf(":");
        if (idx > 0) headersObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
    }

    const config: Record<string, unknown> = {
      baseUrl: restBaseUrl,
      endpoint: restEndpoint,
      method: restMethod,
      leadArrayPath: restLeadPath,
      headers: Object.keys(headersObj).length ? headersObj : undefined,
      body: restMethod !== "GET" && restBody ? restBody : undefined,
      auth: {
        type: restAuthType,
        ...(restAuthType === "BEARER" ? { bearerToken: restBearerToken } : {}),
      },
      pagination: { strategy: restPagination, pageSize: 50 },
      timeout: 30000,
    };

    try {
      const response = await axios.post("/api/providers/connectors/test", { kind: "REST", config });
      if (response.data.success) {
        setMessage(`✅ REST endpoint OK (HTTP ${response.data.statusCode}) — ${response.data.details?.recordsFound ?? 0} records found at "${restLeadPath}"`);
      } else {
        setMessage(`❌ REST test failed: ${response.data.error ?? "unknown error"}`);
      }
    } catch (error) {
      setMessage(`❌ REST test error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  function connectorForGmail(environmentKey: string): ConnectorRow | undefined {
    return connectors.find((c) => c.environmentKey === environmentKey);
  }

  function badge(label: string, color: "green" | "red" | "yellow" | "gray" | "blue") {
    const colors: Record<string, string> = {
      green: "bg-green-100 text-green-700",
      red: "bg-red-100 text-red-700",
      yellow: "bg-yellow-100 text-yellow-700",
      gray: "bg-gray-100 text-gray-600",
      blue: "bg-blue-100 text-blue-700",
    };
    return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${colors[color] ?? colors.gray}`}>{label}</span>;
  }

  return <div className="space-y-6">
    {message ? <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm">{message}</p> : null}

    <Card>
      <h2 className="text-lg font-semibold">REST API connector</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Configure a generic REST API connector. Supports JSON APIs with pagination.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Input placeholder="Connector name" value={restName} onChange={(event) => setRestName(event.target.value)} />
        <Select value={restType} onChange={(event) => setRestType(event.target.value)}>
          {connectorTypes.filter((ct) => ct.key !== "gmail").map((ct) => <option key={ct.key} value={ct.key}>{ct.name}</option>)}
        </Select>
        <Input placeholder="Base URL (https://api.example.com)" value={restBaseUrl} onChange={(event) => setRestBaseUrl(event.target.value)} />
        <Input placeholder="Endpoint (/v1/leads)" value={restEndpoint} onChange={(event) => setRestEndpoint(event.target.value)} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Select value={restMethod} onChange={(event) => setRestMethod(event.target.value)}>
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={restAuthType} onChange={(event) => setRestAuthType(event.target.value)}>
          {Object.entries(AUTH_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        {restAuthType === "BEARER" ? <Input placeholder="Bearer token" value={restBearerToken} type="password" onChange={(event) => setRestBearerToken(event.target.value)} /> : <div />}
        <Select value={restPagination} onChange={(event) => setRestPagination(event.target.value)}>
          {Object.entries(PAGINATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Input placeholder="Lead array path (data.leads, results, items)" value={restLeadPath} onChange={(event) => setRestLeadPath(event.target.value)} />
        <Input placeholder="Headers (Key: Value, one per line)" value={restHeaders} onChange={(event) => setRestHeaders(event.target.value)} />
        <Input placeholder="Request body (JSON) for POST" value={restBody} onChange={(event) => setRestBody(event.target.value)} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={testRestConnection} disabled={!restBaseUrl || !restEndpoint || !restName}>Test Connection</Button>
        <Button variant="secondary" onClick={createRestConnector} disabled={!restBaseUrl || !restEndpoint || !restName}>Create Connector</Button>
      </div>
    </Card>

    <Card>
      <h2 className="text-lg font-semibold">Connectors</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Manage connector schedules, health, and execution.</p>
      {connectors.length ? <div className="mt-4 space-y-4">{connectors.map((conn) => {
        const healthColor: Record<string, "green" | "yellow" | "red"> = { HEALTHY: "green", WARNING: "yellow", ERROR: "red" };
        const nextRun = conn.nextScheduledRun ? new Date(conn.nextScheduledRun) : null;
        const scheduleOptions = ["MANUAL", "EVERY_5_MIN", "EVERY_15_MIN", "EVERY_30_MIN", "HOURLY", "DAILY"];
        return <div key={conn.id} className="border-t pt-3 text-sm">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{conn.name}</p>
                {badge(conn.healthStatus, healthColor[conn.healthStatus] ?? "gray")}
                {badge(conn.status, conn.status === "ACTIVE" ? "green" : conn.status === "ERROR" ? "red" : "gray")}
                {conn.isRunning ? badge("Running", "blue") : null}
                {conn.enabled ? badge("Auto", "green") : badge("Disabled", "gray")}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--color-muted)]">
                <span>Schedule: {SCHEDULE_LABELS[conn.scheduleType] ?? conn.scheduleType}</span>
                <span>Next run: {nextRun ? nextRun.toLocaleString() : "—"}</span>
                <span>Last sync: {conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toLocaleString() : "Never"}</span>
                {conn.lastDurationMs != null ? <span>Last duration: {(conn.lastDurationMs / 1000).toFixed(1)}s</span> : null}
                {conn.averageDurationMs != null ? <span>Avg duration: {(conn.averageDurationMs / 1000).toFixed(1)}s</span> : null}
                {conn.consecutiveFailures > 0 ? <span className="text-red-600">Failures: {conn.consecutiveFailures}</span> : null}
                {conn.lockedBy ? <span className="text-blue-600">Locked: {conn.lockedBy.slice(0, 8)}</span> : null}
              </div>
              {conn.lastError ? <p className="mt-0.5 text-red-600 text-xs">{conn.lastError.slice(0, 120)}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Select
                value={conn.scheduleType}
                onChange={(event) => updateConnectorSettings(conn.id, { scheduleType: event.target.value })}
                disabled={savingId === conn.id}
              >
                {scheduleOptions.map((opt) => <option key={opt} value={opt}>{SCHEDULE_LABELS[opt]}</option>)}
              </Select>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateConnectorSettings(conn.id, { enabled: !conn.enabled })}
                disabled={savingId === conn.id}
              >
                {conn.enabled ? "Disable" : "Enable"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => syncNow(conn.id)}
                disabled={syncingId === conn.id || conn.isRunning}
              >
                {syncingId === conn.id ? "Syncing..." : "Sync Now"}
              </Button>
              {conn.isRunning ? <Button variant="secondary" size="sm" onClick={() => updateConnectorSettings(conn.id, { resetHealth: true })} disabled={savingId === conn.id}>Release Lock</Button> : null}
            </div>
          </div>
        </div>;
      })}</div> : <p className="pt-3 text-sm text-[var(--color-muted)]">No connectors configured.</p>}
    </Card>

    <Card>
      <h2 className="text-lg font-semibold">Configured Gmail accounts</h2>
      {gmailAccounts.length ? gmailAccounts.map((account) => {
        const conn = connectorForGmail(account.key);
        const meta = conn?.runtimeMetadata as Record<string, unknown> | null;
        return <div key={account.key} className="border-t py-3 text-sm">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{account.name}</p>
                {badge(account.status, account.status === "READY" ? "green" : "red")}
                {conn ? badge(conn.healthStatus, conn.healthStatus === "HEALTHY" ? "green" : conn.healthStatus === "WARNING" ? "yellow" : "red") : null}
                {conn?.isRunning ? badge("Running", "blue") : null}
              </div>
              {account.missing.length ? <p className="mt-0.5 text-red-600">Missing: {account.missing.join(", ")}</p> : null}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[var(--color-muted)]">
                <span>Providers: {account.providerCount}</span>
                <span>Last sync: {account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleString() : "Never"}</span>
                <span>Schedule: {conn ? SCHEDULE_LABELS[conn.scheduleType] ?? conn.scheduleType : "—"}</span>
                <span>Next sync: {conn?.nextScheduledRun ? new Date(conn.nextScheduledRun).toLocaleString() : "Manual only"}</span>
                {meta?.lastHistoryId ? <span>History ID: {(meta.lastHistoryId as string).slice(0, 12)}…</span> : null}
                {meta?.lastSyncLeadCount != null ? <span>Imported: {meta.lastSyncLeadCount as string}</span> : null}
                {meta?.lastSyncPayloadCount != null ? <span>Fetched: {meta.lastSyncPayloadCount as string}</span> : null}
                {conn?.lastDurationMs != null ? <span>Duration: {(conn.lastDurationMs / 1000).toFixed(1)}s</span> : null}
                {conn?.lastError ? <span className="text-red-600">Error: {conn.lastError.slice(0, 60)}</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" onClick={() => testConnection(account.key)} disabled={account.status !== "READY"}>Test</Button>
              {conn ? <Button variant="secondary" size="sm" onClick={() => syncNow(conn.id)} disabled={syncingId === conn.id || account.status !== "READY" || conn.isRunning}>{syncingId === conn.id ? "Syncing..." : "Sync Now"}</Button> : null}
            </div>
          </div>
        </div>;
      }) : <p className="pt-3 text-sm text-[var(--color-muted)]">No GMAIL_* environment configurations discovered.</p>}
    </Card>

    <Card>
      <h2 className="text-lg font-semibold">Sync history</h2>
      {syncRuns.length ? <div className="space-y-2">{syncRuns.map((run) => {
        const meta = run.metadata as Record<string, unknown> | null;
        const durationMs = meta?.durationMs as number | undefined;
        const breakdown = meta?.breakdown as Record<string, unknown> | undefined;
        const duration = durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : "";
        return <div key={run.id} className="border-t py-3 text-sm"><div className="flex justify-between"><span><strong>{run.connector.name}</strong> · <span className={`rounded-full px-2 py-0.5 text-xs ${run.status === "ACTIVE" || run.status === "SUCCESS" ? "bg-green-100 text-green-700" : run.status === "ERROR" || run.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{run.status}</span></span><span className="text-[var(--color-muted)]">{new Date(run.startedAt).toLocaleString()} {duration ? `· ${duration}` : ""}</span></div><p className="text-[var(--color-muted)]">Fetched {run.recordsSeen} · Created {run.recordsCreated} · Updated {run.recordsUpdated} · Skipped {run.recordsSkipped}{run.completedAt ? ` · Finished ${new Date(run.completedAt).toLocaleString()}` : ""}</p>{breakdown ? <p className="text-xs text-[var(--color-muted)]">Dupes {breakdown.duplicatesSkipped as number} · Routing misses {breakdown.routingFailures as number} · Parser fails {breakdown.parserFailures as number} · Validation fails {breakdown.validationFailures as number} · Connector fails {breakdown.connectorFailures as number}</p> : null}{run.errorMessage ? <p className="text-red-600">{run.errorMessage}</p> : null}</div>;
      })}</div> : <p className="pt-3 text-sm text-[var(--color-muted)]">No sync runs recorded.</p>}
    </Card>

    <Card>
      <h2 className="text-lg font-semibold">Unmatched email queue</h2>
      {unmatched.length ? unmatched.map((email) => <div key={email.id} className="border-t py-3 text-sm">
        <p className="font-semibold">{email.senderEmail} · {email.subject ?? "No subject"}</p>
        <p className="text-[var(--color-muted)]">{email.status} · {new Date(email.receivedAt).toLocaleString()}</p>
        {email.rawPreview ? <Textarea className="mt-2" value={email.rawPreview} readOnly rows={2} /> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Select defaultValue="" onChange={(event) => event.target.value && handleUnmatched(email.id, "ASSIGN", event.target.value)}>
            <option value="">Assign provider...</option>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </Select>
          <Button variant="secondary" size="sm" onClick={() => handleUnmatched(email.id, "CREATE_PROVIDER")}>Create provider</Button>
          <Button variant="secondary" size="sm" onClick={() => handleUnmatched(email.id, "IGNORE")}>Ignore</Button>
          <Button variant="secondary" size="sm" onClick={() => handleUnmatched(email.id, "SPAM")}>Spam</Button>
          <Button variant="secondary" size="sm" onClick={() => handleUnmatched(email.id, "REQUEST_PARSER")}>Request parser</Button>
        </div>
      </div>) : <p className="pt-3 text-sm text-[var(--color-muted)]">No unmatched emails.</p>}
    </Card>

    <Card>
      <h2 className="text-lg font-semibold">Parser requests</h2>
      {parserRequests.length ? parserRequests.map((request) => <div key={request.id} className="flex items-center justify-between border-t py-3 text-sm">
        <span>{request.vendorName} · {request.senderEmail} · {request.sampleSubject ?? "No subject"}</span>
        <span>{request.status} · {request.requestedBy.name}</span>
      </div>) : <p className="pt-3 text-sm text-[var(--color-muted)]">No parser requests.</p>}
    </Card>
  </div>;
}
