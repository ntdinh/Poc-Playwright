/**
 * Learning Module - Phase 2
 *
 * Exports all learning-related functionality for extracting patterns
 * and creating generalized workflow templates.
 */

export { SemanticExtractor, createSemanticExtractor } from './SemanticExtractor';
export type { SemanticExtractorOptions, SemanticExtractionResult } from './SemanticExtractor';

export { PatternLearner, createPatternLearner } from './PatternLearner';
export type { PatternLearnerOptions, LearningResult, PatternComparison } from './PatternLearner';

export { TemplateBuilder, createTemplateBuilder } from './TemplateBuilder';
export type {
  TemplateBuilderOptions,
  TemplateValidationResult
} from './TemplateBuilder';

export { TemplateStore, createTemplateStore } from './TemplateStore';

export type {
  WorkflowTemplate,
  TemplateStep,
  TemplateCondition,
  GeneralizationRule,
  TemplateVariable,
  TemplateMatch,
  TemplateExecutionContext,
  TemplateExecutionResult
} from './WorkflowTemplate';
