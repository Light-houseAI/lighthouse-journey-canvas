/**
 * Retry Utilities for LLM and API Calls
 *
 * Provides robust retry logic with:
 * - Exponential backoff
 * - Rate limit detection
 * - Configurable retry strategies
 * - Concurrency control
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: any) => boolean;
  /** Callback when a retry is attempted */
  onRetry?: (error: any, attempt: number, delayMs: number) => void;
  /** Total timeout across all retries in milliseconds (default: none) */
  totalTimeoutMs?: number;
  /** Per-attempt timeout in milliseconds (default: none) */
  perAttemptTimeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'isRetryable' | 'totalTimeoutMs' | 'perAttemptTimeoutMs'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Rate limit error patterns from various LLM providers
 */
const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /too.?many.?requests/i,
  /429/,
  /quota.?exceeded/i,
  /tokens?.?per.?min/i,
  /TPM/,
  /RPM/,
  /please.?try.?again.?in/i,
];

/**
 * Transient error patterns that are worth retrying
 */
const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNRESET/,
  /ETIMEDOUT/,
  /socket.?hang.?up/i,
  /network/i,
  /503/,
  /502/,
  /500/,
  /overloaded/i,
];

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  const errorMessage = getErrorMessage(error);
  return RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

/**
 * Check if an error is a transient/retryable error
 */
export function isTransientError(error: any): boolean {
  const errorMessage = getErrorMessage(error);
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

/**
 * Default retryable check - rate limits and transient errors
 */
export function isDefaultRetryable(error: any): boolean {
  return isRateLimitError(error) || isTransientError(error);
}

/**
 * Extract error message from various error types
 */
function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error?.message) return error.error.message;
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  return String(error);
}

/**
 * Extract retry delay from rate limit error (if available)
 */
export function extractRetryAfter(error: any): number | null {
  const errorMessage = getErrorMessage(error);

  // Try to extract "Please try again in X.XXXs" format
  const match = errorMessage.match(/try.?again.?in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000);
  }

  // Try to extract from headers (Retry-After)
  const retryAfter = error?.response?.headers?.['retry-after'];
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
  }

  return null;
}

/** Options required for delay calculation */
type DelayOptions = Required<Omit<RetryOptions, 'onRetry' | 'isRetryable' | 'totalTimeoutMs' | 'perAttemptTimeoutMs'>>;

/**
 * Calculate delay for a retry attempt using exponential backoff
 */
export function calculateDelay(
  attempt: number,
  options: DelayOptions,
  error?: any
): number {
  // First, check if the error includes a specific retry delay
  const retryAfter = error ? extractRetryAfter(error) : null;
  if (retryAfter) {
    return Math.min(retryAfter, options.maxDelayMs);
  }

  // Calculate exponential backoff
  let delay = options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt);

  // Add jitter (0-25% of delay) to prevent thundering herd
  if (options.jitter) {
    const jitterAmount = delay * 0.25 * Math.random();
    delay += jitterAmount;
  }

  // Cap at maximum delay
  return Math.min(delay, options.maxDelayMs);
}

/**
 * Execute a function with retry logic
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => llmProvider.generateStructuredResponse(messages, schema),
 *   {
 *     maxRetries: 3,
 *     onRetry: (error, attempt, delay) => {
 *       logger.warn(`Retry attempt ${attempt} after ${delay}ms`, { error });
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const isRetryable = options.isRetryable ?? isDefaultRetryable;
  const startTime = Date.now();

  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Check total timeout before attempting
      if (options.totalTimeoutMs) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= options.totalTimeoutMs) {
          throw new TimeoutError(
            `Total timeout of ${options.totalTimeoutMs}ms exceeded`,
            options.totalTimeoutMs
          );
        }
      }

      // Execute with per-attempt timeout if specified
      if (options.perAttemptTimeoutMs) {
        return await withTimeout(
          fn(),
          options.perAttemptTimeoutMs,
          `Attempt ${attempt + 1} timed out`
        );
      }

      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on total timeout
      if (error instanceof TimeoutError && options.totalTimeoutMs) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= options.totalTimeoutMs) {
          throw error;
        }
      }

      // Check if we should retry
      if (attempt >= opts.maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay
      const delayMs = calculateDelay(attempt, opts, error);

      // Check if delay would exceed total timeout
      if (options.totalTimeoutMs) {
        const elapsed = Date.now() - startTime;
        const remainingTime = options.totalTimeoutMs - elapsed;
        if (delayMs >= remainingTime) {
          throw new TimeoutError(
            `Total timeout of ${options.totalTimeoutMs}ms would be exceeded during retry delay`,
            options.totalTimeoutMs
          );
        }
      }

      // Notify about retry
      if (options.onRetry) {
        options.onRetry(error, attempt + 1, delayMs);
      }

      // Wait before retry
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timeout error class for distinguishing timeout failures
 */
export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap a promise with a timeout
 * Rejects with TimeoutError if the promise doesn't resolve within the specified time
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   llmProvider.generateStructuredResponse(messages, schema),
 *   60000, // 60 second timeout
 *   'LLM call timed out'
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${errorMessage} after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Simple concurrency limiter
 * Limits the number of concurrent executions of async functions
 */
export class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrency: number) {}

  /**
   * Execute a function with concurrency limiting
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for a slot to be available
    await this.acquire();

    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    this.running--;

    if (this.queue.length > 0 && this.running < this.maxConcurrency) {
      this.running++;
      const next = this.queue.shift()!;
      next();
    }
  }

  /**
   * Get current status
   */
  get status() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
    };
  }
}

/**
 * Token bucket rate limiter for managing API rate limits
 * Uses a simple token bucket algorithm
 */
export class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
    private refillInterval: number = 1000 // ms
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens, returning true if successful
   */
  tryConsume(amount: number = 1): boolean {
    this.refill();

    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }

    return false;
  }

  /**
   * Wait until tokens are available, then consume
   */
  async consume(amount: number = 1): Promise<void> {
    while (!this.tryConsume(amount)) {
      // Calculate time to wait for enough tokens
      const tokensNeeded = amount - this.tokens;
      const waitTime = Math.ceil((tokensNeeded / this.refillRate) * 1000);
      await sleep(Math.min(waitTime, 1000)); // Wait at most 1 second at a time
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.refillInterval) {
      const tokensToAdd = Math.floor((elapsed / 1000) * this.refillRate);
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Create a rate-limited version of an async function
 * Combines concurrency limiting with retry logic
 */
export function createRateLimitedFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    maxConcurrency?: number;
    retryOptions?: RetryOptions;
  } = {}
): (...args: TArgs) => Promise<TResult> {
  const limiter = new ConcurrencyLimiter(options.maxConcurrency ?? 2);
  const retryOpts = options.retryOptions ?? {};

  return async (...args: TArgs): Promise<TResult> => {
    return limiter.run(() =>
      withRetry(() => fn(...args), retryOpts)
    );
  };
}
