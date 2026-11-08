import { EXPORT_LIMITS } from "@/lib/export/output";
import type { ExportDeadline } from "@/services/export/deadline";

export type CsvExportRecord = { csv: string; dataRows?: number };
export type ExportStreamOutcome = "SUCCESS" | "EMPTY" | "FAILED" | "LIMIT_EXCEEDED" | "TIMEOUT" | "CANCELLED";
export type ExportStreamSummary = {
  outcome: ExportStreamOutcome;
  rowCount: number;
  byteCount: number;
  durationMs: number;
  reasonCode?: "ROW_LIMIT" | "BYTE_LIMIT" | "TIMEOUT" | "QUERY_FAILED" | "SERIALIZATION_FAILED";
};

export class ExportDeliveryError extends Error {
  constructor(readonly reasonCode: NonNullable<ExportStreamSummary["reasonCode"]>) {
    super(reasonCode);
    this.name = "ExportDeliveryError";
  }
}

export function createCsvByteStream(
  records: AsyncIterable<CsvExportRecord>,
  deadline: ExportDeadline,
  onComplete: (summary: ExportStreamSummary) => void,
  limits: { maxRows: number; maxSerializedBytes: number } = EXPORT_LIMITS,
): ReadableStream<Uint8Array> {
  const iterator = records[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let rowCount = 0;
  let byteCount = 0;
  let done = false;

  const finish = (summary: ExportStreamSummary) => {
    if (done) return;
    done = true;
    deadline.dispose();
    try { onComplete(summary); } catch { /* Logging must never affect delivery. */ }
  };

  const fail = (reasonCode: ExportStreamSummary["reasonCode"], outcome: ExportStreamOutcome) => {
    if (done) return;
    finish({ outcome, rowCount, byteCount, durationMs: Date.now() - deadline.startedAt, ...(reasonCode ? { reasonCode } : {}) });
    try { controller?.error(new Error("Export stream failed.")); } catch { /* The client may already have cancelled. */ }
    void iterator.return?.().catch(() => undefined);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      void deadline.expired.then(() => fail("TIMEOUT", "TIMEOUT"));
    },
    async pull(streamController) {
      if (done) return;
      try {
        deadline.assertWithinTime();
        const next = await iterator.next();
        deadline.assertWithinTime();
        if (next.done) {
          finish({
            outcome: rowCount === 0 ? "EMPTY" : "SUCCESS",
            rowCount,
            byteCount,
            durationMs: Date.now() - deadline.startedAt,
          });
          streamController.close();
          return;
        }

        const bytes = encoder.encode(next.value.csv);
        const nextRows = next.value.dataRows ?? 1;
        if (rowCount + nextRows > limits.maxRows) {
          fail("ROW_LIMIT", "LIMIT_EXCEEDED");
          return;
        }
        if (byteCount + bytes.byteLength > limits.maxSerializedBytes) {
          fail("BYTE_LIMIT", "LIMIT_EXCEEDED");
          return;
        }
        rowCount += nextRows;
        byteCount += bytes.byteLength;
        streamController.enqueue(bytes);
      } catch (error) {
        if (deadline.signal.aborted || (error instanceof Error && error.message === "EXPORT_TIMEOUT")) {
          fail("TIMEOUT", "TIMEOUT");
        } else if (error instanceof ExportDeliveryError) {
          fail(error.reasonCode, "FAILED");
        } else {
          fail("QUERY_FAILED", "FAILED");
        }
      }
    },
    cancel() {
      if (done) return;
      deadline.controller.abort();
      finish({ outcome: "CANCELLED", rowCount, byteCount, durationMs: Date.now() - deadline.startedAt });
      return iterator.return?.().then(() => undefined).catch(() => undefined);
    },
  }, { highWaterMark: 0 });

  return stream;
}
