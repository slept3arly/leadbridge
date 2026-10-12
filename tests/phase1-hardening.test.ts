import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { escapeCsv, toCsvRow } from "../src/lib/csv";
import { validateRestUrl, validateRestRedirectTarget, RestSecurityError, isPublicRoutableAddress, MAX_REST_RESPONSE_BYTES, MAX_REST_REQUEST_BODY_BYTES } from "../src/connectors/rest/rest-security";
import { RestClient } from "../src/connectors/rest/rest-client";
import { resolveFollowUpAssignee, salesFollowUpLeadScope } from "../src/services/follow-up-policy";
import { requireCompleteMessageBatch, GmailMessageFetchError } from "../src/connectors/gmail/gmail-batch";
import { followUpUpdateSchema } from "../src/lib/validation";

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
});

test("REST redirect and pagination origins remain constrained", () => {
  const origin = new URL("https://integration.example/api");
  assert.throws(() => validateRestRedirectTarget("http://127.0.0.1/admin", origin, new Set()), RestSecurityError);
  assert.throws(() => validateRestRedirectTarget("https://other.example/page", origin, new Set()), RestSecurityError);
  assert.equal(validateRestRedirectTarget("https://other.example/page", origin, new Set(["https://other.example"])).origin, "https://other.example");
  assert.equal(validateRestRedirectTarget("/next?page=2", origin, new Set()).origin, origin.origin);
});

test("REST client rejects prohibited redirects and oversized bodies and accepts an exact allowlisted HTTP endpoint", async () => {
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/redirect")) {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }).end();
    } else if (req.url?.startsWith("/large")) {
      res.writeHead(200, { "content-length": String(MAX_REST_RESPONSE_BYTES + 1) }).end();
    } else if (req.url === "/pages" || req.url === "/pages?page=1") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "one" }], next: "/pages?page=2" }));
    } else if (req.url?.startsWith("/cross")) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [], next: "https://unapproved.example/next" }));
    } else if (req.url?.startsWith("/capped")) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [], next: "/capped?page=2" }));
    } else {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: [{ id: "two" }] }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const previous = process.env.REST_CONNECTOR_ALLOWED_ORIGINS;
  process.env.REST_CONNECTOR_ALLOWED_ORIGINS = origin;
  const config = (endpoint: string, pagination: { strategy: "PAGE_NUMBER" | "NEXT_URL"; maxPages: number; nextUrlPath?: string } = { strategy: "PAGE_NUMBER", maxPages: 2 }) => ({
    baseUrl: origin, endpoint, method: "GET" as const, auth: { type: "NONE" as const }, pagination, leadArrayPath: "data", timeout: 1000, retryCount: 1,
  });
  const logger = { info() {}, error() {} };
  try {
    await assert.rejects(new RestClient(config("/redirect")).fetchAll(logger), RestSecurityError);
    await assert.rejects(new RestClient(config("/large")).fetchAll(logger), RestSecurityError);
    await assert.rejects(new RestClient(config("/cross", { strategy: "NEXT_URL", nextUrlPath: "next", maxPages: 2 })).fetchAll(logger), RestSecurityError);
    await assert.rejects(new RestClient(config("/capped", { strategy: "NEXT_URL", nextUrlPath: "next", maxPages: 1 })).fetchAll(logger), /page limit/);
    const oversizedRequest = await new RestClient({ ...config("/large"), method: "POST", body: "x".repeat(MAX_REST_REQUEST_BODY_BYTES + 1) }).testConnection();
    assert.equal(oversizedRequest.success, false);
    assert.equal(oversizedRequest.error, "RestSecurityError");
    const result = await new RestClient(config("/pages", { strategy: "NEXT_URL", nextUrlPath: "next", maxPages: 2 })).fetchAll(logger);
    assert.deepEqual(result.records.map((record) => record.id), ["one", "two"]);
  } finally {
    if (previous === undefined) delete process.env.REST_CONNECTOR_ALLOWED_ORIGINS;
    else process.env.REST_CONNECTOR_ALLOWED_ORIGINS = previous;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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
