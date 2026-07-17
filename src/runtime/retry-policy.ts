import { RetryableError } from "./runtime-errors";

export interface RetryPolicyConfig {
  maxRetries: number;
  initialBackoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

const DEFAULT_CONFIG: RetryPolicyConfig = {
  maxRetries: 3,
  initialBackoffMs: 1_000,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
};

export class RetryPolicy {
  private readonly config: RetryPolicyConfig;

  constructor(config?: Partial<RetryPolicyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  isRetryable(error: Error): boolean {
    if (error instanceof RetryableError) return true;
    const message = error.message.toLowerCase();
    return (
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("econnrefused") ||
      message.includes("socket hang up") ||
      message.includes("network timeout") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    );
  }

  async execute<T>(
    fn: (attempt: number) => Promise<T>,
  ): Promise<{ result: T; attempts: number }> {
    let lastError: Error | undefined;
    const maxAttempts = this.config.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn(attempt);
        return { result, attempts: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= maxAttempts) break;
        if (!this.isRetryable(lastError)) break;

        const delay = Math.min(
          this.config.initialBackoffMs *
            Math.pow(this.config.backoffMultiplier, attempt - 1),
          this.config.maxBackoffMs,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}
