/**
 * Self-Healing Goal-Driven Test Agent
 *
 * An autonomous testing agent that uses LLM (Gemini) to navigate
 * web applications and achieve test goals.
 *
 * NOW WITH 3-PHASE LEARNING SYSTEM:
 * - Phase 1: Recording - Capture user demonstrations
 * - Phase 2: Learning - Extract patterns and create templates
 * - Phase 3: Execution - Use templates or LLM to execute workflows
 *
 * @example
 * ```typescript
 * import { createTestAgent, TestGoal, GoalValidator } from './agent';
 *
 * const goal: TestGoal = {
 *   id: 'test-001',
 *   description: 'Navigate to Discover page and verify Download CSV button',
 *   startUrl: 'https://example.com',
 *   successCriteria: [
 *     'URL contains /discover',
 *     'Element [role="button"][name="Download as CSV"] is visible'
 *   ]
 * };
 *
 * const agent = createTestAgent(page);
 * const result = await agent.executeGoal(goal);
 * ```
 */

// ============================================================================
// CORE AGENT (Original)
// ============================================================================
export { TestAgent, createTestAgent } from './TestAgent';

// Core components
export { BrowserStateCapture } from './BrowserStateCapture';
export { ActionExecutor } from './ActionExecutor';
export { GoalValidator } from './GoalValidator';
export { LLMDecisionEngine } from './LLMDecisionEngine';

// Optimization modules
export { RateLimiter, withRetry } from './RateLimiter';
export {
  DecisionCache,
  TemperatureController,
  ActionValidator,
  CacheUtils
} from './DecisionCache';
export {
  BatchStateCapture,
  SmartWait,
  ActionBatcher,
  LLMRequestOptimizer,
  ParallelGoalExecutor,
  PerformanceMonitor
} from './PerformanceOptimizer';

// ============================================================================
// PHASE 1: RECORDING
// ============================================================================
export {
  ActionRecorder,
  createActionRecorder,
  TraceStorage,
  createTraceStorage
} from './recording';

// ============================================================================
// PHASE 2: LEARNING
// ============================================================================
export {
  SemanticExtractor,
  createSemanticExtractor,
  PatternLearner,
  createPatternLearner,
  TemplateBuilder,
  createTemplateBuilder,
  TemplateStore,
  createTemplateStore
} from './learning';

// ============================================================================
// PHASE 3: EXECUTION
// ============================================================================
export {
  TemplatePlanner,
  createTemplatePlanner
} from './execution';

// ============================================================================
// TYPES
// ============================================================================
export type {
  BrowserState,
  DOMElement,
  ConsoleLog,
  AgentAction,
  TestGoal,
  AgentResult,
  LLMDecision,
  AgentConfig,
  DecisionContext,
  TimeRangeState
} from './types';

// Extended types for optimization
export type { DecisionCacheOptions } from './DecisionCache';
export type { PerformanceOptions } from './PerformanceOptimizer';

// Recording types
export type {
  RecordedAction,
  RecordedTrace,
  RecordingConfig,
  RecordingSession,
  ActionValidation,
  TraceExport
} from './recording/RecordedAction';

// Learning types
export type {
  SemanticExtractorOptions,
  SemanticExtractionResult,
  PatternLearnerOptions,
  LearningResult,
  PatternComparison,
  TemplateBuilderOptions,
  TemplateValidationResult,
  WorkflowTemplate,
  TemplateStep,
  TemplateCondition,
  GeneralizationRule,
  TemplateVariable,
  TemplateMatch,
  TemplateExecutionContext,
  TemplateExecutionResult
} from './learning';

// Execution types
export type {
  TemplatePlannerOptions,
  PlannerResult
} from './execution/TemplatePlanner';
