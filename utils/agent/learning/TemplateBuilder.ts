/**
 * TemplateBuilder - Phase 2: Learning
 *
 * Builds and refines workflow templates.
 * Provides utilities for creating, validating, and refining templates.
 */

import { WorkflowTemplate, TemplateStep, TemplateVariable, TemplateCondition } from './WorkflowTemplate';
import { RecordedTrace } from '../recording/RecordedAction';
import { SemanticExtractionResult } from './SemanticExtractor';
import { Logger } from '../../Logger';

/**
 * Template Builder Options
 */
export interface TemplateBuilderOptions {
  /** Enable validation */
  validate?: boolean;
  /** Strict mode (fail on warnings) */
  strict?: boolean;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  /** Is the template valid? */
  valid: boolean;
  /** Errors found */
  errors: string[];
  /** Warnings found */
  warnings: string[];
  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Template Builder - Creates and refines workflow templates
 *
 * This component provides utilities for:
 * - Creating templates from scratch
 * - Validating template structure
 * - Refining templates based on feedback
 * - Merging multiple templates
 */
export class TemplateBuilder {
  private options: TemplateBuilderOptions;

  constructor(options: TemplateBuilderOptions = {}) {
    this.options = {
      validate: true,
      strict: false,
      ...options
    };
  }

  /**
   * Create a new empty template
   */
  createTemplate(config: {
    name: string;
    description: string;
    goal: string;
    domain?: string;
    tags?: string[];
  }): WorkflowTemplate {
    return {
      id: crypto.randomUUID(),
      name: config.name,
      description: config.description,
      goal: config.goal,
      steps: [],
      variables: [],
      preconditions: [],
      expectedOutcomes: [],
      domain: config.domain,
      tags: config.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      sourceTraceIds: []
    };
  }

  /**
   * Add a step to a template
   */
  addStep(
    template: WorkflowTemplate,
    step: Omit<TemplateStep, 'index'>
  ): WorkflowTemplate {
    const newStep: TemplateStep = {
      index: template.steps.length,
      ...step
    };

    return {
      ...template,
      steps: [...template.steps, newStep],
      updatedAt: Date.now()
    };
  }

  /**
   * Add a variable to a template
   */
  addVariable(
    template: WorkflowTemplate,
    variable: Omit<TemplateVariable, 'name'>
  ): WorkflowTemplate {
    const newVariable: TemplateVariable = {
      name: variable.name.toLowerCase().replace(/\s+/g, '_'),
      ...variable
    };

    return {
      ...template,
      variables: [...(template.variables || []), newVariable],
      updatedAt: Date.now()
    };
  }

  /**
   * Add a precondition to a template
   */
  addPrecondition(
    template: WorkflowTemplate,
    condition: TemplateCondition
  ): WorkflowTemplate {
    return {
      ...template,
      preconditions: [...(template.preconditions || []), condition],
      updatedAt: Date.now()
    };
  }

  /**
   * Validate a template
   */
  validate(template: WorkflowTemplate): TemplateValidationResult {
    const result: TemplateValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check required fields
    if (!template.id) {
      result.errors.push('Template missing ID');
      result.valid = false;
    }

    if (!template.name) {
      result.errors.push('Template missing name');
      result.valid = false;
    }

    if (!template.goal) {
      result.errors.push('Template missing goal');
      result.valid = false;
    }

    if (!template.steps || template.steps.length === 0) {
      result.errors.push('Template must have at least one step');
      result.valid = false;
    }

    // Validate steps
    if (template.steps) {
      template.steps.forEach((step, index) => {
        if (!step.actionType) {
          result.errors.push(`Step ${index}: missing actionType`);
          result.valid = false;
        }

        if (!step.intent) {
          result.warnings.push(`Step ${index}: missing intent`);
        }

        if (step.actionType !== 'wait' && !step.selectorPattern) {
          result.warnings.push(`Step ${index}: ${step.actionType} action should have a selectorPattern`);
        }
      });
    }

    // Check for variables
    if (template.variables && template.variables.length > 0) {
      template.variables.forEach((variable, index) => {
        if (!variable.name) {
          result.errors.push(`Variable ${index}: missing name`);
          result.valid = false;
        }
      });
    }

    // Suggestions
    if (template.steps && template.steps.length > 5 && !template.variables?.length) {
      result.suggestions.push('Consider adding variables to make template more flexible');
    }

    if (template.steps && !template.preconditions?.length) {
      result.suggestions.push('Consider adding preconditions to ensure template is used in correct context');
    }

    if (!template.expectedOutcomes?.length) {
      result.suggestions.push('Consider adding expected outcomes for better validation');
    }

    return result;
  }

  /**
   * Refine a template based on feedback
   */
  refine(
    template: WorkflowTemplate,
    feedback: {
      failedStep?: number;
      error?: string;
      suggestion?: string;
    }
  ): WorkflowTemplate {
    Logger.info(`Refining template: ${template.name}`);

    let refined = { ...template, updatedAt: Date.now() };

    if (feedback.failedStep !== undefined) {
      const step = refined.steps[feedback.failedStep];

      if (step) {
        // Increase max retries for failed step
        if (!step.maxRetries) {
          step.maxRetries = 2;
        } else {
          step.maxRetries = Math.min(step.maxRetries + 1, 5);
        }

        // Make step optional if it fails repeatedly
        if (step.maxRetries >= 3 && !step.optional) {
          step.optional = true;
          Logger.info(`Made step ${feedback.failedStep} optional due to repeated failures`);
        }

        refined.steps[feedback.failedStep] = step;
      }
    }

    return refined;
  }

  /**
   * Merge multiple templates into one
   */
  merge(templates: WorkflowTemplate[], options: {
    name?: string;
    description?: string;
    mergeStrategy?: 'all' | 'common' | 'first';
  } = {}): WorkflowTemplate {
    if (templates.length === 0) {
      throw new Error('Cannot merge zero templates');
    }

    if (templates.length === 1) {
      return templates[0];
    }

    Logger.info(`Merging ${templates.length} templates...`);

    const merged: WorkflowTemplate = {
      id: crypto.randomUUID(),
      name: options.name || `Merged: ${templates.map(t => t.name).join(' + ')}`,
      description: options.description || `Merged template from ${templates.length} sources`,
      goal: templates[0].goal,
      steps: [],
      variables: [],
      preconditions: [],
      expectedOutcomes: [],
      tags: [...new Set(templates.flatMap(t => t.tags))],
      domain: templates[0].domain,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      sourceTraceIds: [...new Set(templates.flatMap(t => t.sourceTraceIds))]
    };

    // Merge steps based on strategy
    if (options.mergeStrategy === 'first') {
      merged.steps = templates[0].steps;
    } else if (options.mergeStrategy === 'common') {
      // Find common steps
      const allSteps = templates.flatMap(t => t.steps);
      const stepIntents = new Set(allSteps.map(s => s.intent));

      merged.steps = Array.from(stepIntents)
        .map(intent => allSteps.find(s => s.intent === intent)!)
        .filter(Boolean)
        .map((step, index) => ({ ...step, index }));
    } else {
      // Merge all steps
      let index = 0;
      for (const template of templates) {
        for (const step of template.steps) {
          merged.steps.push({ ...step, index: index++ });
        }
      }
    }

    // Merge variables
    const allVariables = templates.flatMap(t => t.variables || []);
    const variableNames = new Set(allVariables.map(v => v.name));
    merged.variables = Array.from(variableNames)
      .map(name => allVariables.find(v => v.name === name)!)
      .filter(Boolean);

    // Merge preconditions
    merged.preconditions = [...new Set(templates.flatMap(t => t.preconditions || []))];

    // Merge expected outcomes
    merged.expectedOutcomes = [...new Set(templates.flatMap(t => t.expectedOutcomes || []))];

    return merged;
  }

  /**
   * Extract variables from a template by analyzing steps
   */
  extractVariables(template: WorkflowTemplate): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const valuePattern = /\{\{(\w+)\}\}/g;

    for (const step of template.steps) {
      // Check selector pattern for variables
      if (step.selectorPattern) {
        const matches = step.selectorPattern.matchAll(valuePattern);
        for (const match of matches) {
          const name = match[1];
          if (!variables.find(v => v.name === name)) {
            variables.push({
              name,
              type: 'string',
              description: `Variable for ${name}`,
              required: true
            });
          }
        }
      }

      // Check value pattern
      if (step.valuePattern) {
        const matches = step.valuePattern.matchAll(valuePattern);
        for (const match of matches) {
          const name = match[1];
          if (!variables.find(v => v.name === name)) {
            variables.push({
              name,
              type: 'string',
              description: `Value for ${name}`,
              required: true
            });
          }
        }
      }
    }

    return variables;
  }

  /**
   * Apply variables to a template step
   */
  applyVariables(step: TemplateStep, variables: { [key: string]: any }): TemplateStep {
    let applied = { ...step };

    // Replace variables in selector pattern
    if (applied.selectorPattern) {
      for (const [key, value] of Object.entries(variables)) {
        applied.selectorPattern = applied.selectorPattern.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          String(value)
        );
      }
    }

    // Replace variables in value pattern
    if (applied.valuePattern) {
      for (const [key, value] of Object.entries(variables)) {
        applied.valuePattern = applied.valuePattern.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          String(value)
        );
      }
    }

    return applied;
  }

  /**
   * Increment template version
   */
  incrementVersion(template: WorkflowTemplate): WorkflowTemplate {
    const parts = template.version.split('.');
    const patch = parseInt(parts[2] || '0', 10) + 1;

    return {
      ...template,
      version: `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`,
      updatedAt: Date.now()
    };
  }

  /**
   * Clone a template
   */
  clone(template: WorkflowTemplate, newName?: string): WorkflowTemplate {
    return {
      ...template,
      id: crypto.randomUUID(),
      name: newName || `${template.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceTraceIds: [...template.sourceTraceIds]
    };
  }
}

/**
 * Factory function to create a TemplateBuilder
 */
export function createTemplateBuilder(options?: TemplateBuilderOptions): TemplateBuilder {
  return new TemplateBuilder(options);
}
