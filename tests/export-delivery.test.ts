import test from "node:test";
import assert from "node:assert/strict";
import { escapeCsv } from "../src/lib/csv";
import { exportOperationLogSchema } from "../src/lib/export/output";
import { EXPORT_CSV_HEADERS, getExportCsvHeaders, serializeLeadCsvRow, serializeProviderCsvRow, serializeSyncRunCsvRow, serializeUserCsvRow } from "../src/services/export/csv-serialization";
import { createCsvByteStream, type CsvExportRecord, type ExportStreamSummary } from "../src/services/export/csv-stream";
import { ExportDeadline, awaitBeforeDeadline } from "../src/services/export/deadline";
import { assertExportRowLimit } from "../src/services/export/limits";
import { ServiceError } from "../src/lib/service-errors";
import { EXPORT_FIELDS, getDefaultExportColumns } from "../src/lib/export/fields";
import { LEGACY_EXPORT_COLUMNS } from "../src/lib/export/legacy-contract";
import { sanitizeSyncErrorDiagnostic } from "../src/lib/sync-error";
import { serializeLeadCsvRecords } from "../src/services/export/csv-serialization";

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

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (quoted && row[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell); cell = "";
    } else if (char !== "\n" || quoted) cell += char;
  }
  cells.push(cell);
  return cells;
}

test("live export defaults, metadata chips, legacy columns, and CSV headers share one contract", () => {
  const headers = EXPORT_CSV_HEADERS;
  for (const category of ["leads", "users", "providers", "sync-history"] as const) {
    const fields = EXPORT_FIELDS[category];
    const columns = LEGACY_EXPORT_COLUMNS[category];
    const declaredHeaders = columns.map((id) => fields.find((field) => field.id === id)?.header);
    assert.ok(declaredHeaders.every(Boolean), `${category} legacy columns resolve to declared fields`);
    assert.deepEqual(getDefaultExportColumns(category), columns, `${category} defaults preserve live column order`);
    assert.deepEqual(fields.filter((field) => field.defaultSelected).map((field) => field.id), columns);
    assert.deepEqual(headers[category], declaredHeaders, `${category} chips and CSV headers agree`);
  }
  for (const category of ["users", "providers"] as const) {
    for (const field of EXPORT_FIELDS[category].filter((item) => item.kind === "boolean" && item.defaultSelected)) {
      assert.equal(field.representation, "Yes/No");
    }
  }
});

test("all live CSV categories have deterministic legacy headers and Product/Error compatibility", () => {
  assert.deepEqual(EXPORT_CSV_HEADERS.leads, ["S.No.", "Name", "Company", "Phone", "Status", "City", "District", "State", "Source"]);
  assert.deepEqual(EXPORT_CSV_HEADERS.users, ["Name", "Email", "Role", "Active", "Employee Code", "Designation", "Phone", "Created At"]);
  assert.deepEqual(EXPORT_CSV_HEADERS.providers, ["Name", "Slug", "Type", "Active", "Created At"]);
  assert.deepEqual(EXPORT_CSV_HEADERS["sync-history"], ["Run ID", "Connector", "Type", "Status", "Started At", "Completed At", "Records Seen", "Created", "Updated", "Skipped", "Error"]);

  const leadColumns = ["serialNumber", "name", "product", "district"];
  assert.deepEqual(getExportCsvHeaders("leads", leadColumns), ["S.No.", "Name", "District", "Product"]);
  const leadRow = serializeLeadCsvRow({
    leadNumber: "L-1", displayName: "Lead", company: null, email: null, phone: null,
    status: "NEW", priority: "LOW", city: null, state: null, country: "US", product: "Legacy Product",
    requirement: null, createdAt: new Date("2026-11-01T00:00:00.000Z"), assignedUser: null, source: null,
  }, leadColumns, 7);
  assert.equal(parseCsvRow(leadRow).length, leadColumns.length);
  assert.deepEqual(parseCsvRow(leadRow), ["7", "Lead", "Legacy Product", ""]);
  assert.ok(!leadRow.includes("L-1"));

  const selectedUser = parseCsvRow(serializeUserCsvRow({
    name: "A", email: "a@example.test", role: "SALES", active: true, employeeCode: null, designation: null,
    phone: "+1 555 123 4567", createdAt: new Date("2026-11-01T00:00:00.000Z"), salesPrivilege: "SENIOR",
  }, ["name", "salesPrivilege"]));
  assert.deepEqual(selectedUser, ["A", "SENIOR"]);

  const runRow = serializeSyncRunCsvRow({
    id: "run-1", connector: { name: "Mailbox", type: "GMAIL" }, status: "ERROR",
    startedAt: new Date("2026-11-01T00:00:00.000Z"), completedAt: null,
    recordsSeen: 1, recordsCreated: 0, recordsUpdated: 0, recordsSkipped: 1, errorMessage: null,
  });
  assert.equal(parseCsvRow(runRow).length, EXPORT_CSV_HEADERS["sync-history"].length);
  assert.equal(parseCsvRow(runRow).at(-1), "");
  const withError = parseCsvRow(serializeSyncRunCsvRow({
    id: "run-2", connector: { name: "Mailbox", type: "GMAIL" }, status: "ERROR",
    startedAt: new Date("2026-11-01T00:00:00.000Z"), completedAt: null,
    recordsSeen: 1, recordsCreated: 0, recordsUpdated: 0, recordsSkipped: 1,
    errorMessage: "Request failed: password=hunter2; Authorization: Bearer abc123; postgres://user:pass@db.local/app",
  }));
  assert.equal(withError.at(-1), "Request failed: password=[REDACTED]; Authorization: [REDACTED]; [REDACTED CONNECTION STRING]");
});

test("Leads S.No. begins at one and stays sequential across streamed query batches", async () => {
  const rowsFromBatches = async function* () {
    for (let index = 0; index < 251; index++) {
      yield {
        leadNumber: `L-${index + 1000}`, displayName: `Lead ${index + 1}`, company: null, email: null, phone: null,
        status: "NEW", priority: "LOW", city: null, state: null, country: null, product: null, requirement: null,
        createdAt: new Date("2026-01-01T00:00:00Z"), source: null,
      };
    }
  };
  const rows: string[][] = [];
  for await (const record of serializeLeadCsvRecords(rowsFromBatches(), ["serialNumber", "name"])) {
    rows.push(parseCsvRow(record.csv));
  }
  assert.deepEqual(rows[0], ["S.No.", "Name"]);
  assert.deepEqual(rows[1], ["1", "Lead 1"]);
  assert.deepEqual(rows[250], ["250", "Lead 250"]);
  assert.deepEqual(rows[251], ["251", "Lead 251"]);
  assert.equal(rows.flat().some((cell) => cell.startsWith("L-")), false);
});

test("CSV encoding preserves quoting, CRLF, Unicode, nulls and phone numbers while neutralizing formulas", () => {
  const row = serializeProviderCsvRow({ name: "Acme, \"Global\"\r\n世界", slug: "acme", sourceType: "WEB", active: true, createdAt: new Date("2026-11-01T00:00:00.000Z") });
  assert.ok(row.startsWith("\"Acme, \"\"Global\"\"\r\n世界\",acme,WEB,Yes,"));
  assert.ok(row.endsWith("2026-11-01T00:00:00.000Z\n"));

  const user = serializeUserCsvRow({ name: "=HYPERLINK(\"x\")", email: "é@example.test", role: "ADMIN", active: false, employeeCode: null, designation: null, phone: null, createdAt: new Date("2026-11-01T00:00:00.000Z") });
  assert.ok(user.startsWith("\"'=HYPERLINK(\"\"x\"\")\",é@example.test,ADMIN,No,,,"));
  assert.equal(escapeCsv("+1 (555) 123-4567", "phone"), "+1 (555) 123-4567");
  assert.equal(escapeCsv("+SUM(1,1)"), "\"'+SUM(1,1)\"");
  assert.equal(escapeCsv("-cmd"), "'-cmd");
  assert.equal(escapeCsv("@SUM(1,1)"), "\"'@SUM(1,1)\"");
  assert.equal(escapeCsv("=1+1"), "'=1+1");
  assert.equal(escapeCsv("\t=1+1"), "'\t=1+1");
  assert.equal(escapeCsv("\r=1+1"), "\"'\r=1+1\"");
  assert.equal(escapeCsv(-42), "-42");
  assert.equal(escapeCsv("-42", "number"), "-42");
  assert.equal(escapeCsv("-cmd", "number"), "'-cmd");
  assert.equal(escapeCsv("=bad,\"value\"\nnext"), "\"'=bad,\"\"value\"\"\nnext\"");
  assert.equal(escapeCsv(42), "42");
  assert.equal(escapeCsv(null), "");
  assert.equal(escapeCsv(""), "");

  const phoneUser = parseCsvRow(serializeUserCsvRow({ name: "A", email: "a@example.test", role: "SALES", active: true, employeeCode: null, designation: null, phone: "+1 555 123 4567", createdAt: new Date("2026-11-01T00:00:00.000Z") }));
  assert.equal(phoneUser.length, EXPORT_CSV_HEADERS.users.length);
  assert.equal(phoneUser[3], "Yes");
  assert.equal(phoneUser[6], "+1 555 123 4567");
});

test("sync diagnostics are safe for display and preserve absent or ordinary errors", () => {
  assert.equal(sanitizeSyncErrorDiagnostic(null), "");
  assert.equal(sanitizeSyncErrorDiagnostic("Remote returned 503"), "Remote returned 503");
  assert.equal(sanitizeSyncErrorDiagnostic("api_key=abc123"), "api_key=[REDACTED]");
  assert.equal(sanitizeSyncErrorDiagnostic("X-API-Key: abc123"), "X-API-Key: [REDACTED]");
  assert.equal(sanitizeSyncErrorDiagnostic("failed with Bearer abc123"), "failed with [REDACTED]");
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
