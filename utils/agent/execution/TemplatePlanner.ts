/**
 * TemplatePlanner - Phase 3: Execution
 *
 * Plans actions from workflow templates.
 * Executes templates step by step with fallback to LLM when needed.
 */

import { Page } from '@playwright/test';
import { WorkflowTemplate, TemplateStep, TemplateExecutionContext, TemplateExecutionResult } from '../learning/WorkflowTemplate';
import { TestGoal } from '../types';
import { BrowserStateCapture } from '../BrowserStateCapture';
import { ActionExecutor } from '../ActionExecutor';
import { LLMDecisionEngine } from '../LLMDecisionEngine';
import { AgentAction } from '../types';
import { TemplateStore } from '../learning/TemplateStore';
import { TemplateBuilder } from '../learning/TemplateBuilder';
import { Logger } from '../../Logger';

/**
 * Template Planner Options
 */
export interface TemplatePlannerOptions {
  /** Enable LLM fallback when template fails */
  enableLLMFallback?: boolean;
  /** Continue on error? */
  continueOnError?: boolean;
  /** Max retries per step */
  maxRetries?: number;
  /** Step timeout in ms */
  stepTimeout?: number;
}

/**
 * Planner result
 */
export interface PlannerResult {
  /** Actions to execute */
  actions: AgentAction[];
  /** Whether template was used */
  usedTemplate: boolean;
  /** Template match score (if template used) */
  templateMatchScore?: number;
  /** Reason for planning approach */
  reasoning: string;
}

/**
 * Template Planner - Plans execution using templates or LLM
 *
 * This component:
 * 1. Tries to find a matching template for the goal
 * 2. If found, executes template steps
 * 3. If template fails or no template found, falls back to LLM
 */
export class TemplatePlanner {
  private page: Page;
  private stateCapture: BrowserStateCapture;
  private actionExecutor: ActionExecutor;
  private llmEngine: LLMDecisionEngine;
  private templateStore: TemplateStore;
  private templateBuilder: TemplateBuilder;
  private options: TemplatePlannerOptions;

  constructor(
    page: Page,
    llmEngine: LLMDecisionEngine,
    templateStore: TemplateStore,
    options: TemplatePlannerOptions = {}
  ) {
    this.page = page;
    this.llmEngine = llmEngine;
    this.templateStore = templateStore;
    this.options = {
      enableLLMFallback: true,
      continueOnError: false,
      maxRetries: 2,
      stepTimeout: 30000,
      ...options
    };

    this.stateCapture = new BrowserStateCapture(page);
    this.actionExecutor = new ActionExecutor(page, this.options.stepTimeout);
    this.templateBuilder = new TemplateBuilder();
  }

  /**
   * Plan and execute a goal using templates or LLM
   */
  async executeGoal(goal: TestGoal): Promise<TemplateExecutionResult> {
    const startTime = Date.now();
    Logger.info(`📋 Planning execution for goal: ${goal.description}`);

    // Try to find a matching template
    const templateMatch = await this.templateStore.getBestTemplate(goal.description);

    if (templateMatch && templateMatch.matchScore > 0.5) {
      Logger.info(`✅ Found matching template: ${templateMatch.template.name}`);
      Logger.info(`   Match score: ${(templateMatch.matchScore * 100).toFixed(1)}%`);
      Logger.info(`   Steps: ${templateMatch.template.steps.length}`);

      // Execute template
      const result = await this.executeTemplate(templateMatch.template, goal);

      // Update stats
      await this.templateStore.updateStats(templateMatch.template.id, {
        success: result.success,
        incrementAttempts: true
      });

      return result;
    }

    // No template found, use LLM
    Logger.info(`🤖 No suitable template found, using LLM planning`);
    return this.executeWithLLM(goal);
  }

  /**
   * Execute a workflow template
   */
  async executeTemplate(
    template: WorkflowTemplate,
    goal: TestGoal,
    context?: TemplateExecutionContext
  ): Promise<TemplateExecutionResult> {
    const startTime = Date.now();
    const executedSteps: TemplateExecutionResult['executedSteps'] = [];

    Logger.info(`🎯 Executing template: ${template.name}`);

    // Check preconditions
    if (template.preconditions && template.preconditions.length > 0) {
      const preconditionsMet = await this.checkConditions(template.preconditions);
      if (!preconditionsMet) {
        return {
          success: false,
          executedSteps: [],
          error: 'Preconditions not met',
          duration: Date.now() - startTime
        };
      }
    }

    // Execute each step
    for (const step of template.steps) {
      const stepStart = Date.now();

      // Apply variables if context provided
      const processedStep = context
        ? this.templateBuilder.applyVariables(step, context.variables)
        : step;

      // Execute step
      const result = await this.executeStep(processedStep, step.maxRetries || this.options.maxRetries);

      executedSteps.push({
        step: processedStep,
        success: result.success,
        error: result.error,
        duration: Date.now() - stepStart
      });

      if (!result.success) {
        if (this.options.continueOnError) {
          Logger.warn(`Step ${step.index} failed, continuing...`);
        } else {
          // Try alternatives if available
          if (step.alternatives && step.alternatives.length > 0) {
            Logger.info(`Trying alternative steps...`);
            let alternativeSuccess = false;

            for (const alt of step.alternatives) {
              const altResult = await this.executeStep(alt, 1);
              if (altResult.success) {
                alternativeSuccess = true;
                executedSteps.push({
                  step: alt,
                  success: true,
                  duration: Date.now() - stepStart
                });
                break;
              }
            }

            if (!alternativeSuccess) {
              return {
                success: false,
                executedSteps,
                error: `Step ${step.index} failed and all alternatives failed`,
                duration: Date.now() - startTime
              };
            }
          } else if (!step.optional) {
            return {
              success: false,
              executedSteps,
              error: `Step ${step.index} failed: ${result.error}`,
              duration: Date.now() - startTime
            };
          }
        }
      }

      // Check postconditions
      if (step.postconditions && step.postconditions.length > 0) {
        const postconditionsMet = await this.checkConditions(step.postconditions);
        if (!postconditionsMet) {
          Logger.warn(`Step ${step.index} postconditions not met`);
        }
      }
    }

    // Capture final state
    const finalState = await this.stateCapture.capture();

    return {
      success: true,
      executedSteps,
      finalState,
      duration: Date.now() - startTime
    };
  }

  /**
   * Execute a single template step
   */
  private async executeStep(step: TemplateStep, maxRetries: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        const action = this.stepToAction(step);
        const result = await this.actionExecutor.execute(action);

        if (result.success) {
          return { success: true };
        }

        retries++;
        if (retries <= maxRetries) {
          Logger.debug(`Retrying step (attempt ${retries}/${maxRetries})...`);
          await this.page.waitForTimeout(1000);
        }
      } catch (error) {
        retries++;
        if (retries > maxRetries) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries} retries`
    };
  }

  /**
   * Execute goal using LLM (fallback)
   */
  private async executeWithLLM(goal: TestGoal): Promise<TemplateExecutionResult> {
    Logger.info(`Using LLM-based execution for: ${goal.description}`);

    // This would integrate with the existing TestAgent
    // For now, return a placeholder result
    return {
      success: false,
      executedSteps: [],
      error: 'LLM execution not yet integrated with TemplatePlanner. Use TestAgent directly.',
      duration: 0
    };
  }

  /**
   * Check if conditions are met
   */
  private async checkConditions(conditions: WorkflowTemplate['preconditions']): Promise<boolean> {
    if (!conditions) return true;

    for (const condition of conditions) {
      const met = await this.checkCondition(condition);
      if (!met && !condition.negate) {
        return false;
      }
      if (met && condition.negate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check a single condition
   */
  private async checkCondition(condition: NonNullable<WorkflowTemplate['preconditions']>[number]): Promise<boolean> {
    try {
      switch (condition.type) {
        case 'elementExists':
          if (condition.selector) {
            const count = await this.page.locator(condition.selector).count();
            return count > 0;
          }
          return false;

        case 'elementVisible':
          if (condition.selector) {
            return await this.page.locator(condition.selector).isVisible();
          }
          return false;

        case 'elementHidden':
          if (condition.selector) {
            return !(await this.page.locator(condition.selector).isVisible());
          }
          return false;

        case 'urlContains':
          if (condition.value) {
            return this.page.url().includes(condition.value);
          }
          return false;

        case 'urlEquals':
          if (condition.value) {
            return this.page.url() === condition.value;
          }
          return false;

        case 'custom':
          if (condition.expression) {
            return await this.page.evaluate(condition.expression);
          }
          return false;

        default:
          Logger.warn(`Unknown condition type: ${condition.type}`);
          return false;
      }
    } catch (error) {
      Logger.debug(`Condition check failed: ${error}`);
      return false;
    }
  }

  /**
   * Convert template step to AgentAction
   */
  private stepToAction(step: TemplateStep): AgentAction {
    const action: AgentAction = {
      type: step.actionType,
      description: step.description || step.intent
    };

    if (step.selectorPattern) {
      action.selector = step.selectorPattern;
    }
    if (step.valuePattern) {
      action.value = step.valuePattern;
    }
    if (step.optionPattern) {
      action.option = step.optionPattern;
    }
    if (step.urlPattern) {
      action.url = step.urlPattern;
    }
    if (step.duration) {
      action.duration = step.duration;
    }

    return action;
  }

  /**
   * Get template for a goal (without executing)
   */
  async getTemplateForGoal(goal: TestGoal): Promise<WorkflowTemplate | null> {
    const match = await this.templateStore.getBestTemplate(goal.description);
    return match?.template || null;
  }

  /**
   * Plan actions from a template
   */
  planFromTemplate(template: WorkflowTemplate): AgentAction[] {
    return template.steps.map(step => this.stepToAction(step));
  }
}

/**
 * Factory function to create a TemplatePlanner
 */
export function createTemplatePlanner(
  page: Page,
  llmEngine: LLMDecisionEngine,
  templateStore: TemplateStore,
  options?: TemplatePlannerOptions
): TemplatePlanner {
  return new TemplatePlanner(page, llmEngine, templateStore, options);
}
