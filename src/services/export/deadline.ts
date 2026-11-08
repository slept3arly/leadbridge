import { EXPORT_LIMITS } from "@/lib/export/output";

export class ExportDeadline {
  readonly controller = new AbortController();
  readonly expired: Promise<void>;
  readonly endAt: number;
  private timer: ReturnType<typeof setTimeout>;
  private expire!: () => void;

  constructor(readonly startedAt: number, maxExecutionMs: number = EXPORT_LIMITS.maxExecutionMs) {
    this.endAt = startedAt + maxExecutionMs;
    this.expired = new Promise((resolve) => { this.expire = resolve; });
    this.timer = setTimeout(() => {
      this.controller.abort();
      this.expire();
    }, Math.max(0, this.endAt - Date.now()));
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  assertWithinTime(): void {
    if (this.signal.aborted || Date.now() >= this.endAt) throw new Error("EXPORT_TIMEOUT");
  }

  dispose(): void {
    clearTimeout(this.timer);
  }
}

export async function awaitBeforeDeadline<T>(promise: Promise<T>, deadline: ExportDeadline): Promise<T> {
  const result = await Promise.race([
    promise.then((value) => ({ value })),
    deadline.expired.then(() => ({ timedOut: true as const })),
  ]);
  if ("timedOut" in result) throw new Error("EXPORT_TIMEOUT");
  deadline.assertWithinTime();
  return result.value;
}
