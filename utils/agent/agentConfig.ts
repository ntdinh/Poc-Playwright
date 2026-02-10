import { AgentConfig } from './types';
import { DecisionCacheOptions, PerformanceOptions } from './index';

/**
 * Enhanced Agent Configuration with optimization options
 */
export interface EnhancedAgentConfig extends AgentConfig {
  // Rate limiting options
  enableRateLimiter?: boolean;
  requestsPerMinute?: number;
  maxRetries?: number;

  // Cache options
  cache?: DecisionCacheOptions;

  // Performance options
  performance?: PerformanceOptions;

  // Deterministic mode
  deterministicMode?: boolean;
}

/**
 * Configuration Presets for different scenarios
 */
export class AgentConfigPresets {
  /**
   * Fast mode - for quick development testing
   * - Aggressive caching
   * - Lightweight state capture
   * - Higher tolerance for errors
   */
  static fast(): EnhancedAgentConfig {
    return {
      maxIterations: 10,
      actionTimeout: 15000,
      captureScreenshots: false,
      saveTrace: false,
      outputDir: './test-results/agent',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      debug: false,

      // Fast optimizations
      enableRateLimiter: true,
      requestsPerMinute: 30, // More aggressive
      maxRetries: 1,

      cache: {
        enabled: true,
        ttl: 30 * 60 * 1000, // 30 minutes
        persist: true,
        deterministicMode: false
      },

      performance: {
        batchCapture: true,
        lightweightMode: true,
        cacheState: true
      },

      deterministicMode: false
    };
  }

  /**
   * Reliable mode - for CI/CD pipelines
   * - Conservative rate limiting
   * - Full state capture
   * - Maximum retries
   * - Deterministic mode enabled
   */
  static reliable(): EnhancedAgentConfig {
    return {
      maxIterations: 20,
      actionTimeout: 30000,
      captureScreenshots: true,
      saveTrace: true,
      outputDir: './test-results/agent',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      debug: true,

      // Conservative rate limiting
      enableRateLimiter: true,
      requestsPerMinute: 10, // Conservative
      maxRetries: 5,

      cache: {
        enabled: true,
        ttl: 60 * 60 * 1000, // 1 hour
        persist: true,
        deterministicMode: true // Enable deterministic mode
      },

      performance: {
        batchCapture: false, // Capture each state separately
        lightweightMode: false,
        cacheState: false, // Don't cache in CI
        parallelValidation: false
      },

      deterministicMode: true
    };
  }

  /**
   * Debug mode - for troubleshooting
   * - Full logging
   * - Screenshots each iteration
   * - Trace enabled
   */
  static debug(): EnhancedAgentConfig {
    return {
      maxIterations: 25,
      actionTimeout: 60000,
      captureScreenshots: true,
      saveTrace: true,
      outputDir: './test-results/agent',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      debug: true,

      enableRateLimiter: true,
      requestsPerMinute: 15,
      maxRetries: 3,

      cache: {
        enabled: false, // Disable cache for debugging
        ttl: 0,
        persist: false
      },

      performance: {
        batchCapture: false,
        lightweightMode: false
      },

      deterministicMode: false
    };
  }

  /**
   * Production mode - balanced for real-world usage
   * - Moderate caching
   * - Sensible defaults
   * - Good retry logic
   */
  static production(): EnhancedAgentConfig {
    return {
      maxIterations: 15,
      actionTimeout: 30000,
      captureScreenshots: true,
      saveTrace: false,
      outputDir: './test-results/agent',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      debug: false,

      enableRateLimiter: true,
      requestsPerMinute: 15,
      maxRetries: 3,

      cache: {
        enabled: true,
        ttl: 45 * 60 * 1000, // 45 minutes
        persist: true,
        deterministicMode: false
      },

      performance: {
        batchCapture: true,
        lightweightMode: false,
        cacheState: true,
        parallelValidation: true
      },

      deterministicMode: false
    };
  }

  /**
   * Local development mode
   * - No rate limiting (local only)
   * - Fast iteration
   */
  static localDev(): EnhancedAgentConfig {
    return {
      maxIterations: 10,
      actionTimeout: 20000,
      captureScreenshots: false,
      saveTrace: false,
      outputDir: './test-results/agent',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      debug: true,

      enableRateLimiter: false, // No rate limiting locally
      requestsPerMinute: 100,
      maxRetries: 1,

      cache: {
        enabled: true,
        ttl: 15 * 60 * 1000, // 15 minutes - shorter for dev
        persist: false
      },

      performance: {
        batchCapture: true,
        lightweightMode: true,
        cacheState: true
      },

      deterministicMode: false
    };
  }
}

/**
 * Environment-based config selection
 */
export function getConfigForEnvironment(): EnhancedAgentConfig {
  const env = process.env.NODE_ENV || process.env.AGENT_ENV || 'development';

  switch (env) {
    case 'production':
    case 'ci':
    case 'test':
      return AgentConfigPresets.reliable();
    case 'debug':
      return AgentConfigPresets.debug();
    case 'fast':
      return AgentConfigPresets.fast();
    case 'local':
      return AgentConfigPresets.localDev();
    default:
      return AgentConfigPresets.production();
  }
}

/**
 * Create custom config with defaults
 */
export function createAgentConfig(
  overrides: Partial<EnhancedAgentConfig> = {}
): EnhancedAgentConfig {
  const defaults = AgentConfigPresets.production();
  return { ...defaults, ...overrides };
}

/**
 * Validate agent configuration
 */
export function validateConfig(config: EnhancedAgentConfig): void {
  if (!config.geminiApiKey) {
    throw new Error(
      'GEMINI_API_KEY is required. Set it in environment variables or config.'
    );
  }

  if (!config.geminiModel) {
    throw new Error('geminiModel is required in config.');
  }

  if (config.requestsPerMinute && config.requestsPerMinute < 1) {
    throw new Error('requestsPerMinute must be at least 1');
  }

  if (config.maxRetries && config.maxRetries < 0) {
    throw new Error('maxRetries cannot be negative');
  }
}
