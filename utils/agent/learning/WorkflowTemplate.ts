/**
 * Workflow Template Types - Phase 2: Learning
 *
 * Data structures for generalized workflow templates that
 * can be applied by the Template Planner (Phase 3).
 */

import { DOMElement } from '../types';

/**
 * Semantic intent extracted from an action
 */
export interface SemanticIntent {
  /** The intent description (e.g., "Open navigation menu") */
  intent: string;
  /** Action type */
  actionType: string;
  /** The selector pattern (can include wildcards) */
  selectorPattern: string;
  /** Conditions that must be met (e.g., "only if menu is collapsed") */
  preconditions?: string[];
  /** Expected results (e.g., "menu expands") */
  postconditions?: string[];
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * A single step in a generalized workflow template
 */
export interface TemplateStep {
  /** Step index in the workflow */
  index: number;
  /** Semantic intent of this step */
  intent: string;
  /** Action type */
  actionType: 'navigate' | 'click' | 'fill' | 'select' | 'wait' | 'verify' | 'scroll';
  /** Selector pattern (can be generalized with wildcards) */
  selectorPattern?: string;
  /** Value pattern (for fill actions) */
  valuePattern?: string;
  /** Option pattern (for select actions) */
  optionPattern?: string;
  /** URL pattern (for navigate actions) */
  urlPattern?: string;
  /** Wait duration (for wait actions) */
  duration?: number;
  /** Conditions that must be true before executing this step */
  preconditions?: TemplateCondition[];
  /** Conditions that should be true after executing this step */
  postconditions?: TemplateCondition[];
  /** Is this step optional? */
  optional?: boolean;
  /** Alternative steps to try if this one fails */
  alternatives?: TemplateStep[];
  /** How many times to retry this step */
  maxRetries?: number;
  /** Human-readable description */
  description: string;
}

/**
 * Template condition (pre/post condition)
 */
export interface TemplateCondition {
  /** Condition type */
  type: 'elementExists' | 'elementVisible' | 'elementHidden' | 'urlContains' | 'urlEquals' | 'custom';
  /** Selector for element-based conditions */
  selector?: string;
  /** Value for comparison */
  value?: string;
  /** Custom JavaScript expression */
  expression?: string;
  /** Negate the condition? */
  negate?: boolean;
  /** Description for debugging */
  description: string;
}

/**
 * Generalization rule for abstracting recorded actions
 */
export interface GeneralizationRule {
  /** Rule name */
  name: string;
  /** What to generalize */
  from: string;
  /** What to replace with */
  to: string;
  /** Rule type */
  type: 'selector' | 'value' | 'url' | 'text';
  /** Confidence in this generalization */
  confidence: number;
  /** Examples that support this rule */
  examples: string[];
}

/**
 * Parameterized variable for template flexibility
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Default value */
  defaultValue?: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'selector' | 'url';
  /** Description */
  description: string;
  /** Required or optional */
  required: boolean;
}

/**
 * Complete workflow template
 */
export interface WorkflowTemplate {
  /** Unique template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Description of what this template does */
  description: string;
  /** The high-level goal this template achieves */
  goal: string;
  /** Steps in the workflow */
  steps: TemplateStep[];
  /** Variables that can be customized */
  variables?: TemplateVariable[];
  /** Conditions that must be true before using this template */
  preconditions?: TemplateCondition[];
  /** Expected outcomes after applying this template */
  expectedOutcomes?: string[];
  /** Domain/application this template is for */
  domain?: string;
  /** Tags for categorization */
  tags: string[];
  /** How many times this template has been successfully applied */
  successCount?: number;
  /** How many times this template has been attempted */
  attemptCount?: number;
  /** Success rate (0-1) */
  successRate?: number;
  /** When this template was created */
  createdAt: number;
  /** When this template was last updated */
  updatedAt: number;
  /** Version of this template */
  version: string;
  /** Original trace IDs that generated this template */
  sourceTraceIds: string[];
  /** Generalization rules used */
  generalizationRules?: GeneralizationRule[];
  /** Metadata */
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Template match result
 */
export interface TemplateMatch {
  /** The matched template */
  template: WorkflowTemplate;
  /** How well the template matches (0-1) */
  matchScore: number;
  /** Which variables need to be filled */
  requiredVariables: TemplateVariable[];
  /** Why this template matches */
  matchReasons: string[];
}

/**
 * Template execution context
 */
export interface TemplateExecutionContext {
  /** Variable values */
  variables: { [key: string]: any };
  /** Current browser state */
  state?: any;
  /** Execution options */
  options?: {
    /** Continue on error? */
    continueOnError?: boolean;
    /** Max retries per step */
    maxRetries?: number;
    /** Step timeout */
    stepTimeout?: number;
  };
}

/**
 * Template execution result
 */
export interface TemplateExecutionResult {
  /** Was execution successful? */
  success: boolean;
  /** Which steps were executed */
  executedSteps: {
    step: TemplateStep;
    success: boolean;
    error?: string;
    duration: number;
  }[];
  /** Final state (if available) */
  finalState?: any;
  /** Error message (if failed) */
  error?: string;
  /** Execution time */
  duration: number;
}
