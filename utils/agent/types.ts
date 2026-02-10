import { Page } from '@playwright/test';

/**
 * Browser State captured for LLM analysis
 */
export interface BrowserState {
  /** Base64 encoded screenshot of current page */
  screenshot: string;
  /** Current page URL */
  url: string;
  /** Page title */
  title: string;
  /** Simplified DOM tree (accessible elements) */
  domTree: DOMElement[];
  /** Console logs (errors, warnings) */
  consoleLogs: ConsoleLog[];
  /** All visible text on page (for no-data detection) */
  pageText?: string;
  /** Current timestamp */
  timestamp: number;
}

/**
 * DOM Element representation
 */
export interface DOMElement {
  /** Element tag name */
  tag: string;
  /** Element ID if present */
  id?: string;
  /** CSS classes */
  classes?: string[];
  /** Accessible name/label */
  accessibleName?: string;
  /** ARIA role */
  role?: string;
  /** Text content (truncated) */
  text?: string;
  /** Element selector for Playwright */
  selector: string;
  /** Is element visible? */
  visible: boolean;
  /** Is element enabled? */
  enabled: boolean;
}

/**
 * Console log entry
 */
export interface ConsoleLog {
  level: 'error' | 'warning' | 'info' | 'log';
  message: string;
  timestamp: number;
}

/**
 * Action that can be executed by Playwright
 */
export interface AgentAction {
  /** Action type */
  type: 'navigate' | 'click' | 'fill' | 'select' | 'wait' | 'verify' | 'scroll';
  /** Target selector (for click, fill, etc.) */
  selector?: string;
  /** Value to fill (for fill action) */
  value?: string;
  /** Option to select (for select action) */
  option?: string;
  /** URL to navigate (for navigate action) */
  url?: string;
  /** Wait duration in ms */
  duration?: number;
  /** Verification expectation (for verify action) */
  expectation?: string;
  /** Human-readable description */
  description: string;
}

/**
 * Test Goal definition
 */
export interface TestGoal {
  /** Goal identifier */
  id: string;
  /** Human-readable goal description */
  description: string;
  /** Starting URL */
  startUrl: string;
  /** Success criteria - what we expect to see at the end */
  successCriteria: string[];
  /** Maximum iterations to attempt */
  maxIterations?: number;
  /** Timeout per iteration (ms) */
  iterationTimeout?: number;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  /** Was the goal achieved? */
  success: boolean;
  /** Number of iterations taken */
  iterations: number;
  /** Actions performed */
  actions: AgentAction[];
  /** Final browser state */
  finalState: BrowserState;
  /** Error message if failed */
  error?: string;
  /** Execution time (ms) */
  executionTime: number;
}

/**
 * LLM Decision response
 */
export interface LLMDecision {
  /** What action to take next */
  action: AgentAction;
  /** Reasoning for the action */
  reasoning: string;
  /** Is the goal achieved? */
  goalAchieved: boolean;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Decision context for adaptive behavior
 */
export interface DecisionContext {
  /** Whether current state indicates no data */
  hasNoData?: boolean;
  /** Number of attempts to find data */
  noDataAttempts?: number;
  /** Suggested next time range value */
  suggestedTimeRange?: number;
  /** Reasons why no data was detected */
  noDataReasons?: string[];
}

/**
 * Time range tracking state
 */
export interface TimeRangeState {
  currentValue: number;
  unit: string;
  attempts: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Maximum iterations per goal */
  maxIterations: number;
  /** Timeout per action execution (ms) */
  actionTimeout: number;
  /** Whether to take screenshots during execution */
  captureScreenshots: boolean;
  /** Whether to save execution trace */
  saveTrace: boolean;
  /** Output directory for artifacts */
  outputDir: string;
  /** Gemini API Key */
  geminiApiKey: string;
  /** Gemini model to use */
  geminiModel: string;
  /** Debug mode */
  debug: boolean;

  // Optimization options (NEW!)
  /** Enable rate limiting for LLM calls */
  enableRateLimiter?: boolean;
  /** Requests per minute for rate limiting */
  requestsPerMinute?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Enable decision caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Persist cache to disk */
  persistCache?: boolean;
  /** Enable deterministic mode (same input = same output) */
  deterministicMode?: boolean;
  /** Enable lightweight state capture (for performance) */
  lightweightMode?: boolean;
}
