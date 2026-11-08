import test from "node:test";
import assert from "node:assert/strict";
import { escapeCsv } from "../src/lib/csv";
import { exportOperationLogSchema } from "../src/lib/export/output";
import { EXPORT_CSV_HEADERS, serializeLeadCsvRow, serializeProviderCsvRow, serializeSyncRunCsvRow, serializeUserCsvRow } from "../src/services/export/csv-serialization";
import { createCsvByteStream, type CsvExportRecord, type ExportStreamSummary } from "../src/services/export/csv-stream";
import { ExportDeadline, awaitBeforeDeadline } from "../src/services/export/deadline";
import { assertExportRowLimit } from "../src/services/export/limits";
import { ServiceError } from "../src/lib/service-errors";

async function* source(records: CsvExportRecord[], onYield?: (index: number) => void): AsyncGenerator<CsvExportRecord> {
  try {
    for (const [index, record] of records.entries()) {
      onYield?.(index);
      yield record;
    }
  } finally {
    onYield?.(-1);
  }
}

function readText(chunk: Uint8Array): string {
  return new TextDecoder().decode(chunk);
}

test("all live CSV categories have deterministic legacy headers and Product/Error compatibility", () => {
  assert.deepEqual(EXPORT_CSV_HEADERS.leads, ["Lead Number", "Name", "Company", "Email", "Phone", "Status", "Priority", "City", "State", "Country", "Product", "Requirement", "Created At", "Assigned To", "Source"]);
  assert.deepEqual(EXPORT_CSV_HEADERS.users, ["Name", "Email", "Role", "Active", "Employee Code", "Designation", "Phone", "Created At"]);
  assert.deepEqual(EXPORT_CSV_HEADERS.providers, ["Name", "Slug", "Type", "Active", "Created At"]);
  assert.deepEqual(EXPORT_CSV_HEADERS["sync-history"], ["Run ID", "Connector", "Type", "Status", "Started At", "Completed At", "Records Seen", "Created", "Updated", "Skipped", "Error"]);

  const leadRow = serializeLeadCsvRow({
    leadNumber: "L-1", displayName: "Lead", company: null, email: null, phone: null,
    status: "NEW", priority: "LOW", city: null, state: null, country: "US", product: "Legacy Product",
    requirement: null, createdAt: new Date("2026-11-01T00:00:00.000Z"), assignedUser: null, source: null,
  });
  assert.equal(leadRow.split(",")[0], "L-1"); // Stored identifiers stay intact; schema has no reliable numeric sequence.
  assert.deepEqual(leadRow.split(",").slice(9, 12), ["US", "Legacy Product", ""]);

  const runRow = serializeSyncRunCsvRow({
    id: "run-1", connector: { name: "Mailbox", type: "GMAIL" }, status: "ERROR",
    startedAt: new Date("2026-11-01T00:00:00.000Z"), completedAt: null,
    recordsSeen: 1, recordsCreated: 0, recordsUpdated: 0, recordsSkipped: 1,
  });
  assert.equal(runRow.trimEnd().split(",").at(-1), "");
  assert.equal(runRow.includes("secret diagnostic"), false);
});

test("CSV encoding preserves quoting, CRLF, Unicode, null cells, and formula neutralization", () => {
  const row = serializeProviderCsvRow({ name: "Acme, \"Global\"\r\n世界", slug: "acme", sourceType: "WEB", active: true, createdAt: new Date("2026-11-01T00:00:00.000Z") });
  assert.ok(row.startsWith("\"Acme, \"\"Global\"\"\r\n世界\",acme,WEB,Yes,"));
  assert.ok(row.endsWith("2026-11-01T00:00:00.000Z\n"));

  const user = serializeUserCsvRow({ name: "=HYPERLINK(\"x\")", email: "é@example.test", role: "ADMIN", active: false, employeeCode: null, designation: null, phone: null, createdAt: new Date("2026-11-01T00:00:00.000Z") });
  assert.ok(user.startsWith("\"'=HYPERLINK(\"\"x\"\")\",é@example.test,ADMIN,No,,,"));
  assert.equal(escapeCsv("+SUM(1,1)"), "\"'+SUM(1,1)\"");
  assert.equal(escapeCsv("-cmd"), "'-cmd");
  assert.equal(escapeCsv("@SUM(1,1)"), "\"'@SUM(1,1)\"");
  assert.equal(escapeCsv("\t=1+1"), "'\t=1+1");
  assert.equal(escapeCsv(42), "42");
  assert.equal(escapeCsv(null), "");
});

test("stream pulls rows incrementally without buffering the complete export", async () => {
  const yielded: number[] = [];
  const complete: ExportStreamSummary[] = [];
  const startedAt = Date.now();
  const deadline = new ExportDeadline(startedAt);
  const stream = createCsvByteStream(source([
    { csv: "Header\n", dataRows: 0 },
    { csv: "one\n" },
    { csv: "two\n" },
  ], (index) => yielded.push(index)), deadline, (summary) => complete.push(summary));
  const reader = stream.getReader();

  assert.equal(readText((await reader.read()).value!), "Header\n");
  assert.deepEqual(yielded, [0]);
  assert.equal(readText((await reader.read()).value!), "one\n");
  assert.deepEqual(yielded, [0, 1]);
  assert.equal(readText((await reader.read()).value!), "two\n");
  assert.equal((await reader.read()).done, true);
  assert.equal(complete[0]?.outcome, "SUCCESS");
  assert.equal(complete[0]?.rowCount, 2);
  assert.equal(complete[0]?.byteCount, new TextEncoder().encode("Header\none\ntwo\n").byteLength);
});

test("stream cancellation stops source iteration and reports cancellation", async () => {
  const events: number[] = [];
  const complete: ExportStreamSummary[] = [];
  const deadline = new ExportDeadline(Date.now());
  const stream = createCsvByteStream(source([
    { csv: "Header\n", dataRows: 0 }, { csv: "one\n" }, { csv: "two\n" },
  ], (index) => events.push(index)), deadline, (summary) => complete.push(summary));
  const reader = stream.getReader();
  await reader.read();
  await reader.cancel();
  assert.deepEqual(events, [0, -1]);
  assert.equal(complete[0]?.outcome, "CANCELLED");
  assert.equal(deadline.signal.aborted, true);
});

test("row and byte limits terminate the stream without reporting success", async () => {
  const rowComplete: ExportStreamSummary[] = [];
  const rowDeadline = new ExportDeadline(Date.now());
  const rowStream = createCsvByteStream(source([{ csv: "h\n", dataRows: 0 }, { csv: "1\n" }, { csv: "2\n" }]), rowDeadline, (summary) => rowComplete.push(summary), { maxRows: 1, maxSerializedBytes: 100 });
  const rowReader = rowStream.getReader();
  await rowReader.read();
  await rowReader.read();
  await assert.rejects(() => rowReader.read(), /Export stream failed/);
  assert.equal(rowComplete[0]?.outcome, "LIMIT_EXCEEDED");
  assert.equal(rowComplete[0]?.reasonCode, "ROW_LIMIT");

  const byteComplete: ExportStreamSummary[] = [];
  const byteDeadline = new ExportDeadline(Date.now());
  const byteStream = createCsvByteStream(source([{ csv: "h\n", dataRows: 0 }, { csv: "1234\n" }]), byteDeadline, (summary) => byteComplete.push(summary), { maxRows: 10, maxSerializedBytes: 2 });
  const byteReader = byteStream.getReader();
  assert.equal(readText((await byteReader.read()).value!), "h\n");
  await assert.rejects(() => byteReader.read(), /Export stream failed/);
  assert.equal(byteComplete[0]?.reasonCode, "BYTE_LIMIT");
});

test("query and serialization failures error the body without appending diagnostics", async () => {
  async function* failed() {
    yield { csv: "header\n", dataRows: 0 };
    throw new Error("secret query and SQL details");
  }
  const complete: ExportStreamSummary[] = [];
  const stream = createCsvByteStream(failed(), new ExportDeadline(Date.now()), (summary) => complete.push(summary));
  const reader = stream.getReader();
  assert.equal(readText((await reader.read()).value!), "header\n");
  await assert.rejects(() => reader.read(), /Export stream failed/);
  assert.equal(complete[0]?.outcome, "FAILED");
  assert.equal(complete[0]?.reasonCode, "QUERY_FAILED");

  assert.throws(() => assertExportRowLimit(50_001), (error) => error instanceof ServiceError && error.status === 413);
  assert.doesNotThrow(() => assertExportRowLimit(50_000));
});

test("accountability callback failure does not corrupt a complete CSV", async () => {
  const stream = createCsvByteStream(source([{ csv: "header\n", dataRows: 0 }, { csv: "row\n" }]), new ExportDeadline(Date.now()), () => { throw new Error("logging backend details"); });
  const reader = stream.getReader();
  assert.equal(readText((await reader.read()).value!), "header\n");
  assert.equal(readText((await reader.read()).value!), "row\n");
  assert.equal((await reader.read()).done, true);
});

test("execution deadline rejects pre-stream work and logs remain redacted", async () => {
  const deadline = new ExportDeadline(Date.now(), 20);
  await assert.rejects(() => awaitBeforeDeadline(new Promise<string>(() => undefined), deadline), /EXPORT_TIMEOUT/);
  deadline.dispose();
  assert.equal(exportOperationLogSchema.safeParse({
    actorId: "user-1", actorRole: "ADMIN", category: "leads", startedAt: new Date().toISOString(), durationMs: 12,
    outcome: "CANCELLED", rowCount: 1, byteCount: 20, safeMetadata: { activeFilterGroups: ["search"] },
  }).success, true);
  assert.equal(exportOperationLogSchema.safeParse({
    actorId: "user-1", actorRole: "ADMIN", category: "leads", startedAt: new Date().toISOString(), durationMs: 12,
    outcome: "FAILED", safeMetadata: { searchTerm: "customer@example.test" },
  }).success, false);
});
