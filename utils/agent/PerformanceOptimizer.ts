import { Page } from '@playwright/test';
import { BrowserState } from './types';
import { BrowserStateCapture } from './BrowserStateCapture';

/**
 * Performance optimization options
 */
export interface PerformanceOptions {
  /** Enable state capture batching */
  batchCapture?: boolean;
  /** Batch size for state capture */
  batchSize?: number;
  /** Enable parallel validation */
  parallelValidation?: boolean;
  /** Use lightweight state capture */
  lightweightMode?: boolean;
  /** Cache state captures */
  cacheState?: boolean;
}

/**
 * Batched State Capture
 *
 * Captures multiple states in parallel for performance
 */
export class BatchStateCapture {
  private stateCache: Map<string, BrowserState> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(private options: PerformanceOptions = {}) {
    this.options = {
      batchCapture: options.batchCapture ?? true,
      batchSize: options.batchSize ?? 3,
      parallelValidation: options.parallelValidation ?? true,
      lightweightMode: options.lightweightMode ?? false,
      cacheState: options.cacheState ?? true
    };
  }

  /**
   * Capture state with caching
   */
  async captureWithCache(
    page: Page,
    forceRefresh: boolean = false
  ): Promise<BrowserState> {
    const cacheKey = `${page.url()}-${Date.now()}`;

    // Check cache
    if (this.options.cacheState && !forceRefresh) {
      const cached = this.stateCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5000) {
        this.cacheHits++;
        return cached;
      }
    }

    this.cacheMisses++;

    // Capture new state
    const capture = new BrowserStateCapture(page);
    const state = await capture.capture();

    // Cache if enabled
    if (this.options.cacheState) {
      this.stateCache.set(cacheKey, state);

      // Limit cache size
      if (this.stateCache.size > 10) {
        const oldestKey = Array.from(this.stateCache.keys())[0];
        this.stateCache.delete(oldestKey);
      }
    }

    return state;
  }

  /**
   * Capture multiple states in batch (for future parallel testing)
   */
  async captureBatch(pages: Page[]): Promise<BrowserState[]> {
    const promises = pages.map(page => this.captureWithCache(page));
    return Promise.all(promises);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.stateCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

/**
 * Smart Wait - intelligent waiting strategies
 */
export class SmartWait {
  /**
   * Wait for page stability (no network activity for specified time)
   */
  static async waitForStability(
    page: Page,
    stableDuration: number = 1000,
    timeout: number = 30000
  ): Promise<void> {
    const startTime = Date.now();
    let lastActivityTime = Date.now();

    // Monitor network activity
    page.on('request', () => {
      lastActivityTime = Date.now();
    });
    page.on('response', () => {
      lastActivityTime = Date.now();
    });

    // Wait for stable period
    while (Date.now() - lastActivityTime < stableDuration) {
      if (Date.now() - startTime > timeout) {
        console.warn('[SmartWait] Timeout waiting for stability');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Wait for specific element with smart retry
   */
  static async waitForElement(
    page: Page,
    selector: string,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<boolean> {
    const { timeout = 10000, interval = 500 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: interval })) {
          return true;
        }
      } catch {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    return false;
  }

  /**
   * Adaptive wait based on page complexity
   */
  static adaptiveWait(page: Page): Promise<void> {
    return page.evaluate(() => {
      return new Promise<void>((resolve) => {
        // Check if page has pending animations/requests
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', () => resolve(), { once: true });
        }
        // Fallback timeout
        setTimeout(() => resolve(), 2000);
      });
    });
  }
}

/**
 * Action Batching - combine multiple actions into single LLM call
 */
export class ActionBatcher {
  private actionQueue: Array<{ type: string; selector?: string; priority: number }> = [];
  private maxBatchSize = 5;

  /**
   * Add action to queue
   */
  addAction(action: { type: string; selector?: string; priority?: number }): void {
    this.actionQueue.push({
      ...action,
      priority: action.priority ?? 1
    });

    // Sort by priority
    this.actionQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get next batch of actions
   */
  getNextBatch(): Array<{ type: string; selector?: string }> {
    const batch = this.actionQueue.slice(0, this.maxBatchSize);
    this.actionQueue = this.actionQueue.slice(this.maxBatchSize);
    return batch;
  }

  /**
   * Check if there are pending actions
   */
  hasPendingActions(): boolean {
    return this.actionQueue.length > 0;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.actionQueue = [];
  }
}

/**
 * LLM Request Optimizer
 */
export class LLMRequestOptimizer {
  private requestCount = 0;
  private totalLatency = 0;
  private avgLatency = 0;

  /**
   * Record LLM request latency
   */
  recordLatency(latency: number): void {
    this.requestCount++;
    this.totalLatency += latency;
    this.avgLatency = this.totalLatency / this.requestCount;
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number {
    return this.avgLatency;
  }

  /**
   * Predict if we need timeout extension
   */
  shouldExtendTimeout(): boolean {
    return this.avgLatency > 5000; // If avg > 5s, consider extension
  }

  /**
   * Optimize prompt size by truncating unnecessary data
   */
  static optimizePrompt(prompt: string, maxLength: number = 10000): string {
    if (prompt.length <= maxLength) {
      return prompt;
    }

    // Keep beginning (instructions) and end (current state)
    const beginningLength = 3000;
    const endLength = maxLength - beginningLength;

    const beginning = prompt.slice(0, beginningLength);
    const end = prompt.slice(-endLength);

    return `${beginning}\n...\n[Content truncated for performance]\n...\n${end}`;
  }

  /**
   * Compress screenshot for faster transmission
   */
  static compressScreenshot(base64Screenshot: string, quality: number = 0.7): string {
    // In a real implementation, you would:
    // 1. Convert base64 to buffer
    // 2. Use sharp or jimp to resize/compress
    // 3. Convert back to base64

    // For now, just return original (placeholder)
    // In production, you'd implement actual compression
    return base64Screenshot;
  }
}

/**
 * Parallel Goal Execution
 *
 * Execute multiple independent goals in parallel
 */
export class ParallelGoalExecutor {
  private concurrency: number;

  constructor(concurrency: number = 2) {
    this.concurrency = concurrency;
  }

  /**
   * Execute goals in parallel batches
   */
  async executeParallel<T>(
    goals: Array<() => Promise<T>>
  ): Promise<Array<{ result: T; error: Error | null }>> {
    const results: Array<{ result: T; error: Error | null }> = [];

    // Process in batches
    for (let i = 0; i < goals.length; i += this.concurrency) {
      const batch = goals.slice(i, i + this.concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(goal => goal())
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push({ result: result.value, error: null });
        } else {
          results.push({ result: null as any, error: result.reason });
        }
      }
    }

    return results;
  }
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  /**
   * Record metric
   */
  record(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  /**
   * Get metric statistics
   */
  getStats(name: string): { min: number; max: number; avg: number; count: number } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length
    };
  }

  /**
   * Get all metrics summary
   */
  getSummary(): Record<string, ReturnType<typeof this.getStats>> {
    const summary: Record<string, any> = {};
    for (const [name] of this.metrics) {
      summary[name] = this.getStats(name);
    }
    return summary;
  }

  /**
   * Print performance report
   */
  printReport(): void {
    console.log('\n=== Performance Report ===');
    for (const [name, stats] of Object.entries(this.getSummary())) {
      if (stats) {
        console.log(`${name}:`);
        console.log(`  Count: ${stats.count}`);
        console.log(`  Avg:   ${stats.avg.toFixed(2)}ms`);
        console.log(`  Min:   ${stats.min.toFixed(2)}ms`);
        console.log(`  Max:   ${stats.max.toFixed(2)}ms`);
      }
    }
    console.log('========================\n');
  }
}
