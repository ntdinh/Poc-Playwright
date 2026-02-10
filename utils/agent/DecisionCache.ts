import { BrowserState, AgentAction, LLMDecision } from './types';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Cached Decision
 */
interface CachedDecision {
  key: string;
  decision: LLMDecision;
  timestamp: number;
  hitCount: number;
}

/**
 * Decision Cache Options
 */
export interface DecisionCacheOptions {
  /** Enable in-memory caching */
  enabled?: boolean;
  /** Cache TTL in milliseconds (default: 1 hour) */
  ttl?: number;
  /** Persist cache to disk */
  persist?: boolean;
  /** Cache directory */
  cacheDir?: string;
  /** Enable deterministic mode (same input = same output) */
  deterministicMode?: boolean;
}

/**
 * Decision Cache for LLM responses
 *
 * Reduces non-deterministic behavior by:
 * 1. Caching LLM decisions based on state hash
 * 2. Reusing decisions for similar states
 * 3. Supporting deterministic mode for reproducibility
 */
export class DecisionCache {
  private cache: Map<string, CachedDecision> = new Map();
  private options: Required<DecisionCacheOptions>;
  private seed: number;

  constructor(options: DecisionCacheOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      ttl: options.ttl ?? 60 * 60 * 1000, // 1 hour
      persist: options.persist ?? false,
      cacheDir: options.cacheDir ?? './test-results/agent/cache',
      deterministicMode: options.deterministicMode ?? false
    };

    // Use fixed seed for deterministic mode
    this.seed = this.options.deterministicMode ? 42 : Date.now();

    // Load persisted cache if enabled
    if (this.options.persist) {
      this.loadFromDisk();
    }
  }

  /**
   * Generate cache key from state and goal
   */
  private generateKey(
    state: BrowserState,
    goalId: string,
    iteration: number,
    previousActions: AgentAction[]
  ): string {
    // For deterministic mode, use a more specific key
    const actionSummary = previousActions
      .slice(-3) // Only last 3 actions matter most
      .map(a => `${a.type}:${a.selector}`)
      .join('|');

    // Create hash from state and context
    const data = {
      url: state.url,
      title: state.title,
      // Use first 500 chars of DOM as signature
      domSignature: this.hashString(JSON.stringify(state.domTree).slice(0, 500)),
      goalId,
      iteration: Math.floor(iteration / 2), // Group iterations
      actionSummary
    };

    return crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  /**
   * Simple string hash for DOM signature
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached decision
   */
  get(
    state: BrowserState,
    goalId: string,
    iteration: number,
    previousActions: AgentAction[]
  ): LLMDecision | null {
    if (!this.options.enabled) {
      return null;
    }

    const key = this.generateKey(state, goalId, iteration, previousActions);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check TTL
    if (Date.now() - cached.timestamp > this.options.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    cached.hitCount++;
    console.log(`[Cache HIT] Key: ${key.slice(0, 8)}... (hits: ${cached.hitCount})`);

    return cached.decision;
  }

  /**
   * Set cached decision
   */
  set(
    state: BrowserState,
    goalId: string,
    iteration: number,
    previousActions: AgentAction[],
    decision: LLMDecision
  ): void {
    if (!this.options.enabled) {
      return;
    }

    const key = this.generateKey(state, goalId, iteration, previousActions);

    this.cache.set(key, {
      key,
      decision,
      timestamp: Date.now(),
      hitCount: 0
    });

    console.log(`[Cache SET] Key: ${key.slice(0, 8)}...`);

    // Persist to disk if enabled
    if (this.options.persist) {
      this.saveToDisk();
    }
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    console.log('[Cache] Cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hits: number; entries: Array<{ key: string; hitCount: number }> } {
    const entries = Array.from(this.cache.values()).map(c => ({
      key: c.key.slice(0, 8),
      hitCount: c.hitCount
    }));

    const hits = entries.reduce((sum, e) => sum + e.hitCount, 0);

    return {
      size: this.cache.size,
      hits,
      entries
    };
  }

  /**
   * Save cache to disk
   */
  private saveToDisk(): void {
    try {
      if (!fs.existsSync(this.options.cacheDir)) {
        fs.mkdirSync(this.options.cacheDir, { recursive: true });
      }

      const cacheFile = path.join(this.options.cacheDir, 'decisions.json');
      const data = Array.from(this.cache.entries());

      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('[Cache] Failed to save to disk:', error);
    }
  }

  /**
   * Load cache from disk
   */
  private loadFromDisk(): void {
    try {
      const cacheFile = path.join(this.options.cacheDir, 'decisions.json');

      if (!fs.existsSync(cacheFile)) {
        return;
      }

      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));

      this.cache = new Map(
        data.map(([key, value]: [string, CachedDecision]) => [key, value])
      );

      console.log(`[Cache] Loaded ${this.cache.size} entries from disk`);
    } catch (error) {
      console.warn('[Cache] Failed to load from disk:', error);
    }
  }

  /**
   * Pre-seed cache with known good decisions
   * Use this to make tests more deterministic
   */
  seedWith(decisions: Array<{
    url: string;
    goalId: string;
    decision: LLMDecision;
  }>): void {
    for (const seed of decisions) {
      const key = crypto
        .createHash('md5')
        .update(JSON.stringify({ url: seed.url, goalId: seed.goalId }))
        .digest('hex');

      this.cache.set(key, {
        key,
        decision: seed.decision,
        timestamp: Date.now(),
        hitCount: 0
      });
    }

    console.log(`[Cache] Seeded with ${decisions.length} decisions`);
  }
}

/**
 * Temperature controller for deterministic LLM responses
 */
export class TemperatureController {
  private baseTemperature: number;
  private deterministicMode: boolean;

  constructor(
    baseTemperature: number = 0.7,
    deterministicMode: boolean = false
  ) {
    this.baseTemperature = baseTemperature;
    this.deterministicMode = deterministicMode;
  }

  /**
   * Get temperature for current request
   *
   * In deterministic mode, use lower temperature for more consistent outputs
   */
  getTemperature(iteration: number, confidenceHistory: number[]): number {
    if (this.deterministicMode) {
      // Use very low temperature for deterministic mode
      return 0.1;
    }

    // Adaptive temperature based on iteration
    // Early iterations: higher temp (explore)
    // Later iterations: lower temp (exploit known patterns)
    const explorationFactor = Math.max(0, 1 - iteration / 10);
    return this.baseTemperature * explorationFactor;
  }

  /**
   * Enable/disable deterministic mode
   */
  setDeterministicMode(enabled: boolean): void {
    this.deterministicMode = enabled;
  }
}

/**
 * Action sequence validator to ensure consistent workflows
 */
export class ActionValidator {
  private validSequences: Map<string, string[]> = new Map();

  /**
   * Register a valid action sequence for a goal
   */
  registerSequence(goalId: string, actions: string[]): void {
    this.validSequences.set(goalId, actions);
  }

  /**
   * Validate if action is expected in sequence
   */
  validateAction(goalId: string, currentAction: string, previousActions: string[]): boolean {
    const sequence = this.validSequences.get(goalId);
    if (!sequence) return true; // No sequence defined, allow anything

    const currentIndex = previousActions.length;
    const expectedAction = sequence[currentIndex];

    if (!expectedAction) return true; // Beyond defined sequence

    // Allow some flexibility - check if action matches expected or is a variant
    return this.isActionMatch(currentAction, expectedAction);
  }

  /**
   * Check if actions match (with some flexibility)
   */
  private isActionMatch(actual: string, expected: string): boolean {
    // Direct match
    if (actual === expected) return true;

    // Type match (e.g., "click" matches any click action)
    const actualType = actual.split(':')[0];
    const expectedType = expected.split(':')[0];
    return actualType === expectedType;
  }
}

/**
 * Cache utility functions
 */
export const CacheUtils = {
  /**
   * Create cache key from screenshot hash
   */
  hashScreenshot(base64Screenshot: string): string {
    // Use first 1KB for quick hash
    const sample = base64Screenshot.slice(0, 1024);
    return crypto.createHash('md5').update(sample).digest('hex');
  },

  /**
   * Normalize state for caching (remove dynamic elements)
   */
  normalizeState(state: BrowserState): BrowserState {
    return {
      ...state,
      // Remove timestamps and dynamic data
      timestamp: 0,
      consoleLogs: state.consoleLogs.filter(log => log.level === 'error'),
      // Simplify DOM tree
      domTree: state.domTree.map(el => ({
        ...el,
        text: el.text?.slice(0, 50) // Truncate long text
      }))
    };
  }
};
