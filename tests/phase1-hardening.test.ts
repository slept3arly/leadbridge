import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { escapeCsv, toCsvRow } from "../src/lib/csv";
import { validateRestUrl, validateRestRedirectTarget, RestSecurityError, isPublicRoutableAddress, MAX_REST_RESPONSE_BYTES, MAX_REST_REQUEST_BODY_BYTES } from "../src/connectors/rest/rest-security";
import { RestClient } from "../src/connectors/rest/rest-client";
import { RestConnector } from "../src/connectors/rest/rest-connector";
import type { RestConnectorConfig } from "../src/connectors/rest/rest-types";
import { resolveFollowUpAssignee, salesFollowUpLeadScope } from "../src/services/follow-up-policy";
import { requireCompleteMessageBatch, GmailMessageFetchError } from "../src/connectors/gmail/gmail-batch";
import { followUpUpdateSchema, restConnectorConfigSchema } from "../src/lib/validation";
import { isSchedulerSecretAuthorized } from "../src/lib/scheduler-auth";
import { computeNextScheduledRun, getScheduleIntervalMs } from "../src/lib/scheduler-schedule";

function setTestEnv(name: string, value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[name];
  else env[name] = value;
}

test("CSV serialization neutralizes formula text and preserves numbers and CSV syntax", () => {
  for (const value of ["=1+1", "+SUM(A1:A2)", "-cmd", "@value", "\t=1+1", "  \r\n=1+1"]) {
    assert.ok(escapeCsv(value).includes("'"));
  }
  assert.equal(escapeCsv(-12), "-12");
  assert.equal(escapeCsv("-12"), "'-12");
  assert.equal(toCsvRow(['=SUM(1,2)', 'line 1\nline 2', 'say "hi"', "雪"]), '"\'=SUM(1,2)","line 1\nline 2","say ""hi""",雪\n');
});

test("REST URL policy rejects unsafe schemes and non-public addresses", async () => {
  for (const url of ["file:///etc/passwd", "ftp://example.com/x", "http://example.com/"]) {
    await assert.rejects(validateRestUrl(url, { resolve: async () => [{ address: "93.184.216.34", family: 4 }] }), RestSecurityError);
  }
  for (const address of ["127.0.0.1", "10.2.3.4", "169.254.169.254", "192.168.0.10", "::1", "fe80::1", "fc00::1"]) {
    assert.equal(isPublicRoutableAddress(address), false);
  }
  await assert.rejects(validateRestUrl("https://public.example/", { resolve: async () => [{ address: "10.0.0.1", family: 4 }] }), RestSecurityError);
  await assert.doesNotReject(validateRestUrl("https://public.example/", { resolve: async () => [{ address: "93.184.216.34", family: 4 }] }));
  await assert.rejects(validateRestUrl("not a valid URL"), RestSecurityError);
});

test("REST private destinations are allowed only by an exact development origin and remain blocked in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAllowed = process.env.REST_CONNECTOR_ALLOWED_ORIGINS;
  const previousDevAllowed = process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS;
  try {
    delete process.env.REST_CONNECTOR_ALLOWED_ORIGINS;
    process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS = "http://127.0.0.1:4001";
    setTestEnv("NODE_ENV", "development");
    await assert.doesNotReject(validateRestUrl("http://127.0.0.1:4001/api/leads"));
    await assert.rejects(validateRestUrl("http://127.0.0.1:4002/api/leads"), /exact HTTP origin is allowlisted/);

    setTestEnv("NODE_ENV", "production");
    await assert.rejects(validateRestUrl("http://127.0.0.1:4001/api/leads"), /exact HTTP origin is allowlisted/);
    await assert.rejects(
      validateRestUrl("https://private.example/api/leads", { resolve: async () => [{ address: "172.16.1.2", family: 4 }] }),
      /prohibited network address/,
    );
  } finally {
    setTestEnv("NODE_ENV", previousNodeEnv);
    if (previousAllowed === undefined) delete process.env.REST_CONNECTOR_ALLOWED_ORIGINS;
    else process.env.REST_CONNECTOR_ALLOWED_ORIGINS = previousAllowed;
    if (previousDevAllowed === undefined) delete process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS;
    else process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS = previousDevAllowed;
  }
});

test("REST redirect and pagination origins remain constrained", () => {
  const origin = new URL("https://integration.example/api");
  assert.throws(() => validateRestRedirectTarget("http://127.0.0.1/admin", origin, new Set()), RestSecurityError);
  assert.throws(() => validateRestRedirectTarget("https://other.example/page", origin, new Set()), RestSecurityError);
  assert.equal(validateRestRedirectTarget("https://other.example/page", origin, new Set(["https://other.example"])).origin, "https://other.example");
  assert.equal(validateRestRedirectTarget("/next?page=2", origin, new Set()).origin, origin.origin);
});

test("scheduler machine authentication requires an exact bearer secret", () => {
  assert.equal(isSchedulerSecretAuthorized(new Request("https://crm.example/api/scheduler/trigger"), "test-secret"), false);
  assert.equal(isSchedulerSecretAuthorized(new Request("https://crm.example/api/scheduler/trigger", { headers: { authorization: "Bearer wrong" } }), "test-secret"), false);
  assert.equal(isSchedulerSecretAuthorized(new Request("https://crm.example/api/scheduler/trigger", { headers: { authorization: "Bearer test-secret" } }), "test-secret"), true);
});

test("custom scheduler intervals are bounded and produce the next run time", () => {
  const start = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(getScheduleIntervalMs("CUSTOM", { intervalMinutes: 30 }), 30 * 60 * 1000);
  assert.equal(getScheduleIntervalMs("CUSTOM", { intervalMinutes: 0 }), null);
  assert.equal(getScheduleIntervalMs("CUSTOM", { intervalMinutes: 525601 }), null);
  assert.equal(computeNextScheduledRun("CUSTOM", { intervalMinutes: 30 }, start)?.toISOString(), "2026-01-01T00:30:00.000Z");
  assert.equal(computeNextScheduledRun("MANUAL", null, start), null);
});

test("REST configuration rejects credentials embedded in URLs and query-bearing endpoints", () => {
  const config = { baseUrl: "https://api.example.test", endpoint: "/leads", method: "GET", auth: { type: "NONE" }, pagination: { strategy: "PAGE_NUMBER" } };
  assert.equal(restConnectorConfigSchema.safeParse(config).success, true);
  assert.equal(restConnectorConfigSchema.safeParse({ ...config, baseUrl: "https://user:secret@api.example.test" }).success, false);
  assert.equal(restConnectorConfigSchema.safeParse({ ...config, baseUrl: "https://api.example.test?token=secret" }).success, false);
  assert.equal(restConnectorConfigSchema.safeParse({ ...config, endpoint: "/leads?token=secret" }).success, false);
  assert.equal(restConnectorConfigSchema.safeParse({ ...config, method: "POST", body: "{\"limit\": 10}" }).success, true);
  assert.equal(restConnectorConfigSchema.safeParse({ ...config, method: "POST", body: "{broken" }).success, false);
});

test("REST client rejects prohibited redirects and oversized bodies and accepts an exact allowlisted HTTP endpoint", async () => {
  let postRequests = 0;
  let retryRequests = 0;
  let rateLimitRequests = 0;
  let capturedRequest: { authorization?: string; customHeader?: string; apiKey?: string; apiKeyHeader?: string } = {};
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/redirect")) {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }).end();
    } else if (req.url?.startsWith("/large")) {
      res.writeHead(200, { "content-length": String(MAX_REST_RESPONSE_BYTES + 1) }).end();
    } else if (req.url === "/pages" || req.url === "/pages?page=1") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "one" }], next: "/pages?page=2" }));
    } else if (req.url?.startsWith("/cross")) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "cross-page" }], next: "https://unapproved.example/next" }));
    } else if (req.url?.startsWith("/capped")) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "capped-page" }], next: "/capped?page=2" }));
    } else if (req.url?.startsWith("/number")) {
      const page = Number(new URL(req.url, origin).searchParams.get("page"));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: page <= 2 ? [{ id: `n${page}` }] : [] }));
    } else if (req.url?.startsWith("/offset")) {
      const offset = Number(new URL(req.url, origin).searchParams.get("offset"));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: offset < 2 ? [{ id: `o${offset}` }] : [] }));
    } else if (req.url?.startsWith("/cursor")) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "cursor-record" }], nextCursor: "repeat" }));
    } else if (req.url?.startsWith("/token")) {
      const pageToken = new URL(req.url, origin).searchParams.get("pageToken");
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: pageToken ? "token-2" : "token-1" }], ...(pageToken ? {} : { nextPageToken: "next-token" }) }));
    } else if (req.url?.startsWith("/malformed")) {
      res.writeHead(200, { "content-type": "application/json" }).end("{not-json");
    } else if (req.url?.startsWith("/wrong-path")) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ results: [] }));
    } else if (req.url?.startsWith("/post-error")) {
      postRequests++;
      res.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ error: "unavailable" }));
    } else if (req.url?.startsWith("/retry")) {
      retryRequests++;
      if (retryRequests === 1) res.writeHead(503).end();
      else res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "retried" }] }));
    } else if (req.url?.startsWith("/rate-limit")) {
      rateLimitRequests++;
      if (rateLimitRequests === 1) res.writeHead(429, { "retry-after": "0" }).end();
      else res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "rate-retried" }] }));
    } else if (req.url?.startsWith("/slow")) {
      setTimeout(() => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [] })), 100);
    } else if (req.url?.startsWith("/auth")) {
      const requestUrl = new URL(req.url, origin);
      capturedRequest = {
        authorization: req.headers.authorization,
        customHeader: req.headers["x-tenant-key"] as string | undefined,
        apiKey: requestUrl.searchParams.get("access_key") ?? undefined,
        apiKeyHeader: req.headers["x-api-key"] as string | undefined,
      };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "authorized" }] }));
    } else if (req.url?.startsWith("/root-array")) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify([{ id: "root" }]));
    } else if (req.url?.startsWith("/bad-record")) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [null, "not an object", { id: "valid" }] }));
    } else {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "two" }] }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const previousNodeEnv = process.env.NODE_ENV;
  const previous = process.env.REST_CONNECTOR_ALLOWED_ORIGINS;
  const previousDevAllowed = process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS;
  setTestEnv("NODE_ENV", "development");
  delete process.env.REST_CONNECTOR_ALLOWED_ORIGINS;
  process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS = origin;
  const config = (endpoint: string, pagination: RestConnectorConfig["pagination"] = { strategy: "PAGE_NUMBER", maxPages: 2 }) => ({
    baseUrl: origin, endpoint, method: "GET" as const, auth: { type: "NONE" as const }, pagination, leadArrayPath: "data", timeout: 1000, retryCount: 1, rateLimitDelayMs: 0,
  });
  const logger = { info() {}, error() {} };
  try {
    await assert.rejects(new RestClient(config("/redirect")).fetchAll(logger), RestSecurityError);
    await assert.rejects(new RestClient(config("/large")).fetchAll(logger), RestSecurityError);
    await assert.rejects(new RestClient(config("/cross", { strategy: "NEXT_URL", nextUrlPath: "next", maxPages: 2 })).fetchAll(logger), RestSecurityError);
    await assert.rejects(new RestClient(config("/capped", { strategy: "NEXT_URL", nextUrlPath: "next", maxPages: 1 })).fetchAll(logger), /page limit/);
    const oversizedRequest = await new RestClient({ ...config("/large"), method: "POST", body: "x".repeat(MAX_REST_REQUEST_BODY_BYTES + 1) }).testConnection();
    assert.equal(oversizedRequest.success, false);
    assert.match(oversizedRequest.error ?? "", /REST request body exceeded/);
    const connectionTest = await new RestClient(config("/pages")).testConnection();
    assert.equal(connectionTest.success, true, "Test Connection accepts the exact local development origin");
    const pacedStart = Date.now();
    const result = await new RestClient({ ...config("/pages", { strategy: "NEXT_URL", nextUrlPath: "next", maxPages: 2 }), rateLimitDelayMs: 20 }).fetchAll(logger);
    assert.deepEqual(result.records.map((record) => record.id), ["one", "two"]);
    assert.ok(Date.now() - pacedStart >= 15, "configured delay is applied between paginated requests");

    const numbered = await new RestClient({ ...config("/number"), pagination: { strategy: "PAGE_NUMBER", pageSize: 1, maxPages: 5 } }).fetchAll(logger);
    assert.deepEqual(numbered.records.map((record) => record.id), ["n1", "n2"]);
    const offset = await new RestClient({ ...config("/offset"), pagination: { strategy: "OFFSET", pageSize: 1, maxPages: 5 } }).fetchAll(logger);
    assert.deepEqual(offset.records.map((record) => record.id), ["o0", "o1"]);
    const retried = await new RestClient({ ...config("/retry"), retryCount: 2, rateLimitDelayMs: 0 }).fetchAll(logger);
    assert.deepEqual(retried.records.map((record) => record.id), ["retried"]);
    assert.equal(retryRequests, 2, "GET requests retry retryable server failures");
    const rateLimited = await new RestClient({ ...config("/rate-limit"), retryCount: 2, rateLimitDelayMs: 0 }).fetchAll(logger);
    assert.deepEqual(rateLimited.records.map((record) => record.id), ["rate-retried"]);
    assert.equal(rateLimitRequests, 2, "429 responses respect Retry-After and retry");
    const authorized = await new RestClient({
      ...config("/auth"),
      headers: { "x-tenant-key": "header-secret" },
      queryParams: { access_key: "configured-query-value" },
      auth: { type: "API_KEY", apiKey: { name: "access_key", value: "query-secret", in: "query" } },
    }).fetchAll(logger);
    assert.equal(capturedRequest.customHeader, "header-secret");
    assert.equal(capturedRequest.apiKey, "query-secret");
    assert.equal(authorized.documents[0].url.includes("query-secret"), false, "query credentials are masked in sync history");
    await new RestClient({ ...config("/auth"), auth: { type: "BEARER", bearerToken: "bearer-secret" } }).fetchAll(logger);
    assert.equal(capturedRequest.authorization, "Bearer bearer-secret");
    await new RestClient({ ...config("/auth"), auth: { type: "BASIC", basic: { username: "user", password: "pass" } } }).fetchAll(logger);
    assert.equal(capturedRequest.authorization, `Basic ${Buffer.from("user:pass").toString("base64")}`);
    await new RestClient({ ...config("/auth"), auth: { type: "API_KEY", apiKey: { name: "X-API-Key", value: "header-secret", in: "header" } } }).fetchAll(logger);
    assert.equal(capturedRequest.apiKeyHeader, "header-secret");
    const rootArray = await new RestClient({ ...config("/root-array"), leadArrayPath: "" }).fetchAll(logger);
    assert.deepEqual(rootArray.records.map((record) => record.id), ["root"]);
    const malformedRecords = await new RestConnector({ ...config("/bad-record") }).execute({
      connectorId: "connector-test",
      logger: { ...logger, debug() {}, warn() {} },
    } as never);
    assert.equal(malformedRecords.length, 3, "malformed array entries remain isolated records for per-record runtime handling");
    assert.equal((malformedRecords[0]._rawPayload as Record<string, unknown>).value, null);
    await assert.rejects(new RestClient({ ...config("/cursor"), pagination: { strategy: "CURSOR", cursorPath: "nextCursor", pageSize: 1, maxPages: 5 } }).fetchAll(logger), /repeated a cursor/);
    const token = await new RestClient({ ...config("/token"), pagination: { strategy: "TOKEN", tokenPath: "nextPageToken", pageSize: 1, maxPages: 5 } }).fetchAll(logger);
    assert.deepEqual(token.records.map((record) => record.id), ["token-1", "token-2"]);
    await assert.rejects(new RestClient(config("/malformed")).fetchAll(logger), /invalid JSON/i);
    await assert.rejects(new RestClient(config("/wrong-path")).fetchAll(logger), /configured Lead Array Path/);
    await assert.rejects(new RestClient({ ...config("/slow"), timeout: 30 }).fetchAll(logger), /timed out/i);

    await assert.rejects(new RestClient({ ...config("/post-error"), method: "POST", retryCount: 3, rateLimitDelayMs: 0 }).fetchAll(logger));
    assert.equal(postRequests, 1, "POST requests must not be retried automatically");

    const previousDev = process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS;
    delete process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS;
    await assert.rejects(new RestClient(config("/pages")).fetchAll(logger), RestSecurityError);
    if (previousDev === undefined) delete process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS;
    else process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS = previousDev;
  } finally {
    setTestEnv("NODE_ENV", previousNodeEnv);
    if (previous === undefined) delete process.env.REST_CONNECTOR_ALLOWED_ORIGINS;
    else process.env.REST_CONNECTOR_ALLOWED_ORIGINS = previous;
    if (previousDevAllowed === undefined) delete process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS;
    else process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS = previousDevAllowed;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("REST Test Connection reports a safe connection-refused cause", async () => {
  const reservation = createServer();
  await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));

  const previousNodeEnv = process.env.NODE_ENV;
  const previousDevAllowed = process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS;
  setTestEnv("NODE_ENV", "development");
  process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS = `http://127.0.0.1:${address.port}`;
  try {
    const result = await new RestClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      endpoint: "/api/leads",
      method: "GET",
      auth: { type: "NONE" },
      pagination: { strategy: "PAGE_NUMBER", maxPages: 1 },
      leadArrayPath: "data",
      timeout: 1000,
      retryCount: 1,
      rateLimitDelayMs: 0,
    }).testConnection();
    assert.equal(result.success, false);
    assert.match(result.error ?? "", /REST API network error.*ECONNREFUSED/);
    assert.equal((result.error ?? "").includes("127.0.0.1"), false, "network errors do not expose the configured URL");
  } finally {
    setTestEnv("NODE_ENV", previousNodeEnv);
    if (previousDevAllowed === undefined) delete process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS;
    else process.env.REST_CONNECTOR_DEV_ALLOWED_ORIGINS = previousDevAllowed;
  }
});

test("Sales follow-up assignment is restricted to the current user while Admin assignment remains supported", () => {
  const sales = { id: "sales-a", role: "SALES" as const };
  assert.equal(resolveFollowUpAssignee(sales), "sales-a");
  assert.equal(resolveFollowUpAssignee(sales, "sales-a"), "sales-a");
  assert.throws(() => resolveFollowUpAssignee(sales, "sales-b"));
  assert.equal(resolveFollowUpAssignee({ id: "admin", role: "ADMIN" }, "sales-b"), "sales-b");
  assert.deepEqual(salesFollowUpLeadScope("sales-b"), { lead: { assignedUserId: "sales-b", isDeleted: false } });
  assert.equal(followUpUpdateSchema.safeParse({ leadId: "other-lead" }).success, false);
});

test("Gmail batches fail visibly and retryably when any message fetch fails", () => {
  const message = { id: "m1" } as never;
  assert.throws(() => requireCompleteMessageBatch(["m1", "m2"], [
    { status: "fulfilled", value: message },
    { status: "rejected", reason: new Error("provider unavailable") },
  ]), (error) => error instanceof GmailMessageFetchError && error.details?.failureCount === 1 && (error.details.failedMessageIds as string[])[0] === "m2");
  assert.deepEqual(requireCompleteMessageBatch(["m1"], [{ status: "fulfilled", value: message }]), [message]);
});

test.skip("sync lease state-only mock is superseded by PostgreSQL fencing integration tests", async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL ??= "postgresql://audit:audit@127.0.0.1:5432/audit";
  try {
    const { ExecutionLock } = await import("../src/services/execution-lock.service");
    const makeDb = (lockedAt: Date | null, isRunning: boolean, lockedBy: string | null) => {
      const connector = { id: "connector", lockedAt, isRunning, lockedBy, status: "ACTIVE", healthStatus: "HEALTHY", consecutiveFailures: 0 };
      const runs = [{ connectorId: "connector", status: "ACTIVE", completedAt: null as Date | null, errorMessage: null as string | null }];
      const fake = {
        connector: {
          async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
            if (where.id !== connector.id) return { count: 0 };
            const ownerMatch = where.lockedBy === undefined || connector.lockedBy === where.lockedBy;
            const conditions = Array.isArray(where.OR) ? where.OR as Array<{ isRunning?: boolean; lockedAt?: { lt?: Date } | null }> : undefined;
            const lockedAtFilter = where.lockedAt as { gte?: Date; lt?: Date } | null | undefined;
            const freshnessMatch = !lockedAtFilter || (lockedAtFilter.gte ? connector.lockedAt !== null && connector.lockedAt >= lockedAtFilter.gte : !lockedAtFilter.lt || (connector.lockedAt !== null && connector.lockedAt < lockedAtFilter.lt));
            const leaseMatch = freshnessMatch && (!conditions || !connector.isRunning || conditions.some((entry) =>
              entry.isRunning === true && (entry.lockedAt === null ? connector.lockedAt === null : connector.lockedAt !== null && entry.lockedAt?.lt instanceof Date && connector.lockedAt < entry.lockedAt.lt),
            ));
            if (!ownerMatch || !leaseMatch) return { count: 0 };
            Object.assign(connector, data);
            return { count: 1 };
          },
          async findFirst({ where }: { where: Record<string, unknown> }) {
            const freshness = where.lockedAt as { gte?: Date } | undefined;
            return connector.isRunning && connector.lockedBy === where.lockedBy && (!freshness?.gte || (connector.lockedAt !== null && connector.lockedAt >= freshness.gte)) ? { id: connector.id } : null;
          },
          async findUnique() { return connector; },
          async update({ data }: { data: Record<string, unknown> }) { Object.assign(connector, data); return connector; },
        },
        connectorSyncRun: {
          async updateMany({ data }: { data: Record<string, unknown> }) {
            let count = 0;
            for (const run of runs) if (run.connectorId === "connector" && run.status === "ACTIVE") { Object.assign(run, data); count++; }
            return { count };
          },
        },
      };
      return { fake, connector, runs };
    };

    const expired = makeDb(new Date(Date.now() - 120_000), true, "old-worker");
    const recoveryLock = new ExecutionLock(expired.fake as never);
    assert.equal(await recoveryLock.owns("connector", "old-worker", BigInt(0)), false);
    assert.equal(await recoveryLock.renew("connector", "old-worker", BigInt(0)), false);
    const staleHeartbeat = recoveryLock.startHeartbeat("connector", "old-worker", BigInt(0));
    await assert.rejects(staleHeartbeat.assertOwned(), /already running/);
    staleHeartbeat.stop();
    assert.ok(await recoveryLock.acquire("connector", "new-worker"));
    assert.equal(expired.runs[0].status, "ERROR");
    assert.equal(expired.runs[0].errorMessage, "Interrupted: execution lease expired.");
    assert.equal(await recoveryLock.owns("connector", "new-worker", BigInt(1)), true);

    const idle = makeDb(null, false, null);
    const lock = new ExecutionLock(idle.fake as never);
    const acquired = await Promise.all([lock.acquire("connector", "worker-a"), lock.acquire("connector", "worker-b")]);
    assert.equal(acquired.filter(Boolean).length, 1);
    assert.equal(await lock.owns("connector", "worker-a", BigInt(1)), acquired[0] !== null);
    assert.equal(await lock.owns("connector", "worker-b", BigInt(1)), acquired[1] !== null);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});
