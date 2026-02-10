/**
 * Rate Limiter for LLM API calls
 *
 * Prevents 429 errors by:
 * - Token bucket algorithm
 * - Exponential backoff on retry
 * - Request queueing
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;

  // Rate limits (adjust based on your Gemini tier)
  // Free tier: ~15 requests/minute
  // Paid tier: ~150 requests/minute
  constructor(
    private requestsPerMinute: number = 15,
    private maxRetries: number = 3
  ) {
    // Convert to tokens per second
    this.tokens = requestsPerMinute;
    this.lastRefill = Date.now();
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for available token
    await this.waitForToken();

    // Try with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          const delay = this.calculateBackoff(attempt);
          Logger.warn(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(delay);
        } else {
          // Not a rate limit error, don't retry
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Wait for an available token
   */
  private async waitForToken(): Promise<void> {
    while (this.tokens < 1) {
      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000; // seconds

      // Refill tokens based on elapsed time
      const tokensToAdd = elapsed * (this.requestsPerMinute / 60);
      this.tokens = Math.min(this.requestsPerMinute, this.tokens + tokensToAdd);
      this.lastRefill = now;

      if (this.tokens < 1) {
        // Not enough tokens, wait
        const waitTime = ((1 - this.tokens) * 60 / this.requestsPerMinute) * 1000;
        await this.sleep(Math.min(waitTime, 5000));
      }
    }

    // Consume one token
    this.tokens--;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    const baseDelay = 1000;
    const maxDelay = 30000; // Max 30 seconds
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (error?.status === 429) return true;
    if (error?.message?.includes('429')) return true;
    if (error?.message?.includes('QUOTA_EXCEEDED')) return true;
    if (error?.message?.includes('rate limit')) return true;
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current token count (for debugging)
   */
  getAvailableTokens(): number {
    return Math.floor(this.tokens);
  }
}

// Simple logger for RateLimiter
class Logger {
  static warn(message: string) {
    console.warn(`[RateLimiter] ${message}`);
  }
}

/**
 * Retry decorator for LLM calls with exponential backoff
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  maxRetries: number = 3
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;

        // Check if retryable
        if (isRetryableError(error) && attempt < maxRetries) {
          const delay = calculateExponentialBackoff(attempt);
          console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
          await sleep(delay);
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  }) as T;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  const retryableStatuses = [429, 500, 502, 503, 504];
  return (
    retryableStatuses.includes(error?.status) ||
    error?.message?.includes('ECONNRESET') ||
    error?.message?.includes('ETIMEDOUT') ||
    error?.message?.includes('429')
  );
}

/**
 * Calculate exponential backoff with jitter
 */
function calculateExponentialBackoff(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 30000;
  // Add jitter to avoid thundering herd
  const jitter = Math.random() * 500;
  return Math.min(baseDelay * Math.pow(2, attempt) + jitter, maxDelay);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
