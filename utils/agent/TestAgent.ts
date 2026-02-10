import { Page } from '@playwright/test';
import { TestGoal, AgentResult, AgentConfig, BrowserState, AgentAction } from './types';
import { BrowserStateCapture } from './BrowserStateCapture';
import { ActionExecutor } from './ActionExecutor';
import { GoalValidator } from './GoalValidator';
import { LLMDecisionEngine } from './LLMDecisionEngine';
import { RateLimiter } from './RateLimiter';
import { DecisionCache } from './DecisionCache';
import { PerformanceMonitor, SmartWait } from './PerformanceOptimizer';
import { Logger } from '../Logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Enhanced Test Agent with Optimizations
 *
 * Orchestrates the goal-driven testing loop with:
 * - Rate limiting (prevents 429 errors)
 * - Decision caching (reduces non-deterministic behavior)
 * - Performance monitoring (tracks execution metrics)
 * - Smart waiting (adaptive wait strategies)
 */
export class TestAgent {
  private page: Page;
  private config: AgentConfig;
  private stateCapture: BrowserStateCapture;
  private actionExecutor: ActionExecutor;
  private goalValidator: GoalValidator;
  private llmEngine: LLMDecisionEngine;

  // Optimization modules
  private rateLimiter?: RateLimiter;
  private decisionCache?: DecisionCache;
  private perfMonitor: PerformanceMonitor;

  // Execution tracking
  private actions: AgentAction[] = [];
  private states: BrowserState[] = [];
  private iteration: number = 0;

  // POC: Simple time range tracking for adaptive behavior
  private currentTimeRange: number = 2; // Start with 2 months
  private noDataAttempts: number = 0;

  constructor(page: Page, config: AgentConfig) {
    this.page = page;
    this.config = config;

    // Initialize optimization modules
    if (config.enableRateLimiter !== false) {
      // Enable rate limiter by default
      this.rateLimiter = new RateLimiter(
        config.requestsPerMinute || 15,
        config.maxRetries || 3
      );
      Logger.info(`Rate limiter enabled: ${config.requestsPerMinute || 15} req/min`);
    }

    if (config.enableCache !== false) {
      // Enable cache by default
      this.decisionCache = new DecisionCache({
        enabled: true,
        ttl: config.cacheTTL || 60 * 60 * 1000, // 1 hour default
        persist: config.persistCache || false,
        deterministicMode: config.deterministicMode || false
      });
      Logger.info(`Decision cache enabled (deterministic: ${config.deterministicMode || false})`);
    }

    this.perfMonitor = new PerformanceMonitor();

    this.stateCapture = new BrowserStateCapture(page);
    this.actionExecutor = new ActionExecutor(page, config.actionTimeout);

    // Create LLM validator for complex criteria
    const llmValidator = async (state: BrowserState, goal: TestGoal) => {
      return this.llmEngine.validateGoalWithLLM(state, goal);
    };

    this.goalValidator = new GoalValidator(page, llmValidator);
    this.llmEngine = new LLMDecisionEngine(config, {
      rateLimiter: this.rateLimiter,
      cache: this.decisionCache,
      perfMonitor: this.perfMonitor
    });
  }

  /**
   * Execute a test goal with optimizations
   */
  async executeGoal(goal: TestGoal): Promise<AgentResult> {
    const startTime = Date.now();
    Logger.info(`Starting goal execution: ${goal.description}`);
    Logger.info(`Optimizations: RateLimit=${!!this.rateLimiter}, Cache=${!!this.decisionCache}, Deterministic=${this.config.deterministicMode || false}`);

    // Reset execution state
    this.actions = [];
    this.states = [];
    this.iteration = 0;
    this.currentTimeRange = 2; // Reset to default 2 months
    this.noDataAttempts = 0;

    try {
      // Navigate to start URL
      Logger.info(`Navigating to start URL: ${goal.startUrl}`);
      await this.page.goto(goal.startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Use SmartWait instead of fixed timeout
      await SmartWait.adaptiveWait(this.page);

      // Handle common initial popups/banners before starting goal execution
      await this.handleInitialPopups();

      // Main execution loop
      while (this.iteration < (goal.maxIterations || this.config.maxIterations)) {
        this.iteration++;

        Logger.info(`\n=== Iteration ${this.iteration} ===`);

        // 1. Capture current state
        const captureStart = Date.now();
        const state = await this.stateCapture.capture();
        const captureTime = Date.now() - captureStart;
        this.perfMonitor.record('state_capture', captureTime);
        this.states.push(state);

        // Save state for debugging if enabled
        if (this.config.debug) {
          await this.saveStateSnapshot(state, this.iteration);
        }

        // POC: Simple no-data detection AND auto-fix
        const hasNoData = this.detectNoData(state);
        if (hasNoData && this.iteration > 3) { // Only after initial setup
          this.noDataAttempts++;
          const progression = [2, 4, 6, 12, 24, 36];
          const currentIndex = progression.indexOf(this.currentTimeRange);
          if (currentIndex >= 0 && currentIndex < progression.length - 1) {
            this.currentTimeRange = progression[currentIndex + 1];
          } else if (this.currentTimeRange < 60) {
            this.currentTimeRange = Math.min(this.currentTimeRange * 2, 60);
          }

          Logger.info(`🔄 No data detected (attempt ${this.noDataAttempts}). Increasing time range to ${this.currentTimeRange} months`);

          // AUTO-EXECUTE: Directly change time range instead of asking LLM
          await this.changeTimeRange(this.currentTimeRange);

          // Wait for page to update after time range change
          await this.page.waitForTimeout(3000);

          // Skip to next iteration (don't ask LLM for action)
          continue;
        }

        // 2. Validate goal
        const validation = await this.goalValidator.validate(state, goal);
        Logger.info(`Validation: ${validation.achieved ? 'PASSED' : 'FAILED'}`);
        validation.details.forEach(d => Logger.debug(d));

        if (validation.achieved) {
          Logger.info(`Goal achieved after ${this.iteration} iterations!`);
          this.printPerformanceReport(startTime);

          return {
            success: true,
            iterations: this.iteration,
            actions: [...this.actions],
            finalState: state,
            executionTime: Date.now() - startTime
          };
        }

        // 3. Ask LLM for next action (with rate limiting and caching)
        const decisionStart = Date.now();

        // Build context for adaptive behavior
        const decisionContext = hasNoData ? {
          hasNoData: true,
          noDataAttempts: this.noDataAttempts,
          suggestedTimeRange: this.currentTimeRange,
          noDataReasons: ['Detected "no data" keywords in page']
        } : undefined;

        const decision = await this.llmEngine.decide(
          state,
          goal,
          this.actions,
          this.iteration,
          decisionContext
        );
        const decisionTime = Date.now() - decisionStart;
        this.perfMonitor.record('llm_decision', decisionTime);
        Logger.debug(`LLM decision took ${decisionTime}ms`);

        // Check if LLM thinks goal is achieved
        if (decision.goalAchieved && decision.confidence > 0.7) {
          Logger.info('LLM indicates goal is achieved');

          // Double-check with validator
          const finalValidation = await this.goalValidator.validate(state, goal);
          if (finalValidation.achieved) {
            this.printPerformanceReport(startTime);
            return {
              success: true,
              iterations: this.iteration,
              actions: [...this.actions],
              finalState: state,
              executionTime: Date.now() - startTime
            };
          }
        }

        // 4. Execute action
        const action = decision.action;
        this.actions.push(action);

        const execStart = Date.now();
        const result = await this.actionExecutor.execute(action);
        const execTime = Date.now() - execStart;
        this.perfMonitor.record('action_execution', execTime);

        if (!result.success) {
          Logger.warn(`Action failed: ${result.error}`);

          // Check if we should continue despite failure
          if (decision.confidence < 0.5) {
            // Low confidence action failed - might be stuck
            Logger.warn('Low confidence action failed. Consider stopping.');
          }
        }

        // Use SmartWait for page stabilization instead of fixed timeout
        await SmartWait.waitForStability(this.page, 500, 2000);
      }

      // Max iterations reached
      Logger.warn(`Max iterations (${this.iteration}) reached without achieving goal`);

      // Capture final state
      const finalState = await this.stateCapture.capture();
      const finalValidation = await this.goalValidator.validate(finalState, goal);

      this.printPerformanceReport(startTime);

      return {
        success: finalValidation.achieved,
        iterations: this.iteration,
        actions: [...this.actions],
        finalState,
        error: `Max iterations reached. Failed: ${finalValidation.failedCriteria.join(', ')}`,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      Logger.error(`Goal execution error: ${error}`);
      this.printPerformanceReport(startTime);

      return {
        success: false,
        iterations: this.iteration,
        actions: [...this.actions],
        finalState: this.states[this.states.length - 1] || await this.stateCapture.capture(),
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Print performance report
   */
  private printPerformanceReport(startTime: number): void {
    const totalExecutionTime = Date.now() - startTime;

    if (this.config.debug) {
      console.log('\n=== Performance Report ===');
      console.log(`Total execution time: ${totalExecutionTime}ms`);
      console.log(`Iterations: ${this.iteration}`);
      console.log(`Average time per iteration: ${(totalExecutionTime / this.iteration).toFixed(2)}ms`);

      // Print performance metrics
      const stats = this.perfMonitor.getSummary();
      for (const [name, stat] of Object.entries(stats)) {
        if (stat) {
          console.log(`\n${name}:`);
          console.log(`  Count: ${stat.count}`);
          console.log(`  Avg:   ${stat.avg.toFixed(2)}ms`);
          console.log(`  Min:   ${stat.min.toFixed(2)}ms`);
          console.log(`  Max:   ${stat.max.toFixed(2)}ms`);
        }
      }

      // Print cache stats if available
      if (this.decisionCache) {
        const cacheStats = this.decisionCache.getStats();
        console.log(`\nCache Statistics:`);
        console.log(`  Entries: ${cacheStats.size}`);
        console.log(`  Hits:    ${cacheStats.hits}`);
        console.log(`  Hit Rate: ${cacheStats.size > 0 ? (cacheStats.hits / (cacheStats.hits + cacheStats.size) * 100).toFixed(1) : 0}%`);
      }

      console.log('========================\n');
    }
  }

  /**
   * Handle initial popups and banners that appear on page load
   */
  private async handleInitialPopups(): Promise<void> {
    Logger.debug('Checking for initial popups to dismiss...');

    try {
      // Wait a bit for any popups to appear
      await this.page.waitForTimeout(2000);

      // 1. Try to dismiss "Dismiss" button (common welcome banner)
      const dismissButton = this.page.getByRole('button', { name: 'Dismiss' });
      try {
        await dismissButton.click({ timeout: 5000 });
        Logger.info('Dismissed welcome banner');
        await this.page.waitForTimeout(500);
      } catch {
        Logger.debug('No "Dismiss" button found or not clickable');
      }

      // 2. Try to close common cookie/consent banners
      const acceptCookiesButtons = [
        this.page.getByRole('button', { name: /accept|agree|allow/i }),
        this.page.getByRole('button', { name: /got.it|understood/i }),
        this.page.getByRole('button', { name: /close/i }),
      ];

      for (const button of acceptCookiesButtons) {
        try {
          await button.first().click({ timeout: 2000 });
          Logger.info('Dismissed cookie/consent banner');
          await this.page.waitForTimeout(300);
          break;
        } catch {
          // Continue to next button type
        }
      }

      Logger.debug('Initial popup handling completed');
    } catch (error) {
      Logger.warn(`Error during popup handling: ${error}. Continuing anyway.`);
    }
  }

  /**
   * Save state snapshot for debugging
   */
  private async saveStateSnapshot(state: BrowserState, iteration: number): Promise<void> {
    const outputDir = path.join(this.config.outputDir, 'snapshots');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save screenshot
    if (state.screenshot) {
      const screenshotPath = path.join(outputDir, `iteration-${iteration}.png`);
      const buffer = Buffer.from(state.screenshot, 'base64');
      fs.writeFileSync(screenshotPath, buffer);
      Logger.debug(`Saved screenshot: ${screenshotPath}`);
    }

    // Save state as JSON
    const statePath = path.join(outputDir, `iteration-${iteration}.json`);
    fs.writeFileSync(statePath, JSON.stringify({
      url: state.url,
      title: state.title,
      domElements: state.domTree.length,
      consoleLogs: state.consoleLogs,
      timestamp: new Date(state.timestamp).toISOString()
    }, null, 2));
    Logger.debug(`Saved state: ${statePath}`);
  }

  /**
   * POC: Simple no-data detection
   * Checks if current state indicates no data scenario
   */
  private detectNoData(state: BrowserState): boolean {
    const noDataKeywords = ['no results', 'no data found', 'no matches', '0 items', 'empty table', 'no data'];

    // Check in page text (NEW - captures all visible text)
    const hasKeywordInPage = state.pageText ? noDataKeywords.some(keyword =>
      state.pageText!.includes(keyword)
    ) : false;

    // Also check in DOM elements (for buttons/labels)
    const domText = state.domTree.map(el => (el.text || '') + ' ' + (el.accessibleName || '')).join(' ').toLowerCase();
    const hasKeywordInDom = noDataKeywords.some(keyword => domText.includes(keyword));

    const hasKeyword = hasKeywordInPage || hasKeywordInDom;

    if (hasKeyword) {
      Logger.debug(`✅ No data detected via keywords!`);
    }

    return hasKeyword;
  }

  /**
   * Directly change time range on OpenSearch Discover page
   * Auto-executed when no data is detected
   */
  private async changeTimeRange(months: number): Promise<void> {
    try {
      Logger.info(`⚡ Auto-executing time range change to ${months} months`);

      // 1. Click Date quick select button
      try {
        await this.page.getByRole('button', { name: 'Date quick select' }).click({ timeout: 5000 });
        Logger.info(`  ✓ Opened date picker`);
      } catch (e) {
        Logger.warn(`  ✗ Could not open date picker (might already be open): ${e}`);
      }

      // 2. Fill time value
      try {
        await this.page.getByRole('spinbutton', { name: 'Time value' }).fill(String(months), { timeout: 5000 });
        Logger.info(`  ✓ Set time value to ${months}`);
      } catch (e) {
        Logger.warn(`  ✗ Could not set time value: ${e}`);
      }

      // 3. Select months unit
      try {
        await this.page.getByLabel('Time unit').selectOption('months', { timeout: 5000 });
        Logger.info(`  ✓ Selected months as unit`);
      } catch (e) {
        Logger.warn(`  ✗ Could not select months: ${e}`);
      }

      // 4. Click Apply
      try {
        await this.page.getByRole('button', { name: 'Apply' }).click({ timeout: 5000 });
        Logger.info(`  ✓ Applied time range`);
      } catch (e) {
        Logger.warn(`  ✗ Could not click Apply: ${e}`);
      }

      // Track this action
      this.actions.push({
        type: 'fill',
        description: `Auto-changed time range to ${months} months (no data detected)`,
        value: String(months)
      });

    } catch (error) {
      Logger.warn(`Auto time range change failed: ${error}`);
    }
  }

  /**
   * Get execution summary
   */
  getSummary(): {
    iterations: number;
    actions: AgentAction[];
    states: number;
    performance: ReturnType<PerformanceMonitor['getSummary']>;
  } {
    return {
      iterations: this.iteration,
      actions: [...this.actions],
      states: this.states.length,
      performance: this.perfMonitor.getSummary()
    };
  }

  /**
   * Get performance monitor
   */
  getPerformanceMonitor(): PerformanceMonitor {
    return this.perfMonitor;
  }

  /**
   * Clear decision cache
   */
  clearCache(): void {
    if (this.decisionCache) {
      this.decisionCache.clear();
    }
  }

  /**
   * Configure the agent
   */
  static createConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
    const defaultConfig: AgentConfig = {
      maxIterations: 20,
      actionTimeout: 30000,
      captureScreenshots: true,
      saveTrace: false,
      outputDir: './test-results/agent',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      debug: process.env.AGENT_DEBUG === 'true',

      // Optimization defaults
      enableRateLimiter: true,
      requestsPerMinute: 15,
      maxRetries: 3,
      enableCache: true,
      cacheTTL: 60 * 60 * 1000,
      persistCache: false,
      deterministicMode: false,
      lightweightMode: false
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: AgentConfig): void {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is required. Set it in environment variables or config.');
    }

    if (!config.geminiModel) {
      throw new Error('geminiModel is required in config.');
    }
  }
}

/**
 * Factory function to create a TestAgent
 */
export function createTestAgent(page: Page, config?: Partial<AgentConfig>): TestAgent {
  const fullConfig = TestAgent.createConfig(config);
  TestAgent.validateConfig(fullConfig);
  return new TestAgent(page, fullConfig);
}
