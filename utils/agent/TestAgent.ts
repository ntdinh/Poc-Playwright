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
        // Thực hiện kiểm tra nếu page hiện trạng "no data" và tự động tăng time range nếu cần thiết, tự động xử lí và ko cần LLM
        const hasNoData = this.detectNoData(state);
        if (hasNoData && this.iteration > 3) { // Only after initial setup
          this.noDataAttempts++;

          // Calculate next time range value
          const previousTimeRange = this.currentTimeRange;
          const progression = [2, 4, 6, 12, 24, 36];
          const currentIndex = progression.indexOf(this.currentTimeRange);

          if (currentIndex >= 0 && currentIndex < progression.length - 1) {
            this.currentTimeRange = progression[currentIndex + 1];
          } else if (this.currentTimeRange < 60) {
            this.currentTimeRange = Math.min(this.currentTimeRange * 2, 60);
          }

          // Thực hiện change time nếu
          // Detailed logging for auto-fix action
          Logger.warn(`\n╔══════════════════════════════════════════════════════════════════╗`);
          Logger.warn(`║           🤖 AUTO-FIX TRIGGERED: No Data Found                     ║`);
          Logger.warn(`╠══════════════════════════════════════════════════════════════════╣`);
          Logger.warn(`║  Attempt:          #${this.noDataAttempts}                                            ║`);
          Logger.warn(`║  Previous range:   ${previousTimeRange} months                                           ║`);
          Logger.warn(`║  New range:        ${this.currentTimeRange} months                                           ║`);
          Logger.warn(`║  Progression:      ${progression.join(' → ')}                       ║`);
          Logger.warn(`║  Action:           Auto-executing time range change               ║`);
          Logger.warn(`║  Skipping:         LLM decision (using direct action)              ║`);
          Logger.warn(`╚══════════════════════════════════════════════════════════════════╝\n`);

          // AUTO-EXECUTE: Directly change time range instead of asking LLM
          await this.changeTimeRange(this.currentTimeRange);

          // Wait for page to update after time range change
          Logger.info(`⏳ Waiting 3s for page to update with new time range...`);
          await this.page.waitForTimeout(3000);
          Logger.info(`✅ Wait complete, proceeding to next iteration\n`);

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
   *
   * Returns true if page shows "no data" indicators
   */
  private detectNoData(state: BrowserState): boolean {
    const noDataKeywords = ['no results', 'no data found', 'no matches', '0 items', 'empty table', 'no data'];

    // Check in page text (captures all visible text)
    let foundKeywordInPage: string | null = null;
    const hasKeywordInPage = state.pageText ? noDataKeywords.some(keyword => {
      if (state.pageText!.toLowerCase().includes(keyword)) {
        foundKeywordInPage = keyword;
        return true;
      }
      return false;
    }) : false;

    // Also check in DOM elements (for buttons/labels)
    let foundKeywordInDom: string | null = null;
    const domText = state.domTree.map(el => (el.text || '') + ' ' + (el.accessibleName || '')).join(' ').toLowerCase();
    const hasKeywordInDom = noDataKeywords.some(keyword => {
      if (domText.includes(keyword)) {
        foundKeywordInDom = keyword;
        return true;
      }
      return false;
    });

    const hasKeyword = hasKeywordInPage || hasKeywordInDom;

    if (hasKeyword) {
      // Detailed logging for no-data detection
      const source = hasKeywordInPage ? 'PAGE_TEXT' : 'DOM_ELEMENTS';
      const foundKey = foundKeywordInPage || foundKeywordInDom;

      Logger.warn(`⚠️  NO DATA DETECTED!`);
      Logger.warn(`   Source: ${source}`);
      Logger.warn(`   Keyword found: "${foundKey}"`);
      Logger.warn(`   Current time range: ${this.currentTimeRange} months`);
      Logger.warn(`   Will trigger auto-fix (increase time range)`);
    }

    return hasKeyword;
  }

  /**
   * Directly change time range on OpenSearch Discover page
   * Auto-executed when no data is detected
   *
   * @param months - Time range in months to set
   */
  async changeTimeRange(months: number): Promise<void> {
    const stepPrefix = `      🕐`;

    Logger.info(`\n${stepPrefix} ┌─────────────────────────────────────────────────────────┐`);
    Logger.info(`${stepPrefix} │  AUTO-FIX: Changing Time Range to ${months} months` + ' '.repeat(Math.max(0, 24 - String(months).length)) + `│`);
    Logger.info(`${stepPrefix} ├─────────────────────────────────────────────────────────┤`);

    let successCount = 0;
    let failCount = 0;

    try {
      // Step 1: Click Date quick select button
      Logger.info(`${stepPrefix} │  Step 1/4: Opening date picker...`);
      try {
        await this.page.getByRole('button', { name: 'Date quick select' }).click({ timeout: 5000 });
        Logger.info(`${stepPrefix} │           ✅ SUCCESS - Date picker opened`);
        successCount++;
      } catch (e) {
        Logger.warn(`${stepPrefix} │           ⚠️  SKIPPED - Picker might already be open`);
        failCount++;
      }

      // Step 2: Fill time value
      Logger.info(`${stepPrefix} │  Step 2/4: Setting time value to "${months}"...`);
      try {
        await this.page.getByRole('spinbutton', { name: 'Time value' }).fill(String(months), { timeout: 5000 });
        Logger.info(`${stepPrefix} │           ✅ SUCCESS - Time value set to ${months}`);
        successCount++;
      } catch (e) {
        Logger.error(`${stepPrefix} │           ❌ FAILED - Could not set time value: ${e}`);
        failCount++;
        throw e; // Critical failure - can't continue
      }

      // Step 3: Select months unit
      Logger.info(`${stepPrefix} │  Step 3/4: Selecting "months" as time unit...`);
      try {
        await this.page.getByLabel('Time unit').selectOption('months', { timeout: 5000 });
        Logger.info(`${stepPrefix} │           ✅ SUCCESS - Time unit set to months`);
        successCount++;
      } catch (e) {
        Logger.warn(`${stepPrefix} │           ⚠️  WARNING - Could not select months: ${e}`);
        failCount++;
      }

      // Step 4: Click Apply
      Logger.info(`${stepPrefix} │  Step 4/4: Applying time range...`);
      try {
        await this.page.getByRole('button', { name: 'Apply' }).click({ timeout: 5000 });
        Logger.info(`${stepPrefix} │           ✅ SUCCESS - Time range applied`);
        successCount++;
      } catch (e) {
        Logger.error(`${stepPrefix} │           ❌ FAILED - Could not click Apply: ${e}`);
        failCount++;
        throw e; // Critical failure - changes won't take effect
      }

      // Summary
      Logger.info(`${stepPrefix} ├─────────────────────────────────────────────────────────┤`);
      Logger.info(`${stepPrefix} │  Result: ${successCount}/${successCount + failCount} steps succeeded`);
      Logger.info(`${stepPrefix} └─────────────────────────────────────────────────────────┘`);

      // Track this action for the execution log
      this.actions.push({
        type: 'fill',
        selector: 'role=spinbutton:name=Time value',
        description: `Auto-changed time range to ${months} months (no data detected - attempt ${this.noDataAttempts})`,
        value: String(months)
      });

      Logger.info(`${stepPrefix} ✅ Action tracked: Time range change to ${months} months`);

    } catch (error) {
      Logger.error(`${stepPrefix} └─────────────────────────────────────────────────────────┘`);
      Logger.error(`${stepPrefix} ❌ AUTO-FIX FAILED: Could not change time range`);
      Logger.error(`${stepPrefix}    Error: ${error}`);
      throw error;
    }
  }

  /**
   * Switch to a different OpenSearch index pattern
   * Used for testing multiple data sources
   *
   * Workflow:
   * 1. Close any open dropdowns for clean state
   * 2. Click on current index button to open dropdown
   * 3. Look for and click the new index name
   * 4. Wait for page to load
   *
   * @param indexName - The name of the index/pattern to switch to
   */
  async switchIndex(indexName: string): Promise<boolean> {
    const stepPrefix = `      🔄`;

    Logger.info(`\n${stepPrefix} ┌─────────────────────────────────────────────────────────┐`);
    Logger.info(`${stepPrefix} │  INDEX SWITCH: Changing to "${indexName}"` + ' '.repeat(Math.max(0, 30 - indexName.length)) + `│`);
    Logger.info(`${stepPrefix} ├─────────────────────────────────────────────────────────┤`);

    try {
      // Step 1: Click on current index button to open dropdown
      Logger.info(`${stepPrefix} │  Step 1/4: Opening index dropdown...`);

      // Try multiple selectors for the index dropdown button
      let dropdownOpened = false;

      // PRE-STEP: Close any open dropdowns first for clean state
      try {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(300);
      } catch { /* ignore */ }
      await this.page.waitForTimeout(500);

      // Method 1: Using data-test-subj attribute (most reliable)
      try {
        await this.page.locator('[data-test-subj="indexPatternSwitchLink"]').click({ timeout: 3000, force: true });
        dropdownOpened = true;
        Logger.info(`${stepPrefix} │           ✅ SUCCESS - Dropdown opened (data-test-subj)`);
      } catch (e) {
        Logger.warn(`${stepPrefix} │           ⚠️  data-test-subj not found, trying button...`);
      }

      // Method 2: Using button with class euiButtonEmpty
      if (!dropdownOpened) {
        try {
          await this.page.locator('button.euiButtonEmpty').filter({ hasText: /opensearch_dashboards_sample_data/i }).first().click({ timeout: 3000, force: true });
          dropdownOpened = true;
          Logger.info(`${stepPrefix} │           ✅ SUCCESS - Dropdown opened (button.euiButtonEmpty)`);
        } catch (e) {
          Logger.warn(`${stepPrefix} │           ⚠️  button.euiButtonEmpty not found, trying role=button...`);
        }
      }

      // Method 3: Fallback to role=button with regex
      if (!dropdownOpened) {
        try {
          await this.page.getByRole('button', { name: /opensearch_dashboards_sample_data/i }).first().click({ timeout: 3000, force: true });
          dropdownOpened = true;
          Logger.info(`${stepPrefix} │           ✅ SUCCESS - Dropdown opened (role=button)`);
        } catch (e) {
          Logger.warn(`${stepPrefix} │           ⚠️  role=button not found, trying manual search...`);
        }
      }

      // Method 4: Last resort - find button by text content
      if (!dropdownOpened) {
        try {
          const buttons = await this.page.locator('button').all();
          for (const button of buttons) {
            try {
              const text = await button.textContent();
              if (text && text.toLowerCase().includes('opensearch_dashboards_sample_data')) {
                await button.click({ force: true });
                dropdownOpened = true;
                Logger.info(`${stepPrefix} │           ✅ SUCCESS - Dropdown opened (manual search)`);
                break;
              }
            } catch { /* continue */ }
          }
        } catch (e) {
          Logger.error(`${stepPrefix} │           ❌ FAILED - Could not open dropdown: ${e}`);
          return false;
        }
      }

      // Wait for dropdown to appear
      await this.page.waitForTimeout(1000);

      // Step 2: Look for and click index with multiple strategies
      Logger.info(`${stepPrefix} │  Step 2/4: Looking for "${indexName}" in dropdown...`);

      let indexClicked = false;

      // Strategy 1: getByText
      try {
        const element = this.page.getByText(indexName, { exact: false }).first();
        if (await element.isVisible().catch(() => false)) {
          await element.scrollIntoViewIfNeeded({ timeout: 2000 });
          await this.page.waitForTimeout(300);
          await element.click({ timeout: 5000, force: true });
          indexClicked = true;
          Logger.info(`${stepPrefix} │           ✅ SUCCESS - Clicked using getByText`);
        }
      } catch (e) {
        Logger.debug(`${stepPrefix} │           ⚠️  getByText failed, trying filtered locator...`);
      }

      // Strategy 2: Filtered locator with more element types
      if (!indexClicked) {
        try {
          const element = this.page.locator('button, [role="option"], li, div[role="menuitem"], span.euiContextMenuItem__text').filter({ hasText: indexName }).first();
          await element.scrollIntoViewIfNeeded({ timeout: 2000 });
          await this.page.waitForTimeout(300);
          await element.click({ timeout: 5000, force: true });
          indexClicked = true;
          Logger.info(`${stepPrefix} │           ✅ SUCCESS - Clicked using filtered locator`);
        } catch (e) {
          Logger.debug(`${stepPrefix} │           ⚠️  Filtered locator failed, trying XPath...`);
        }
      }

      // Strategy 3: XPath fallback
      if (!indexClicked) {
        try {
          const xpaths = [
            `//*[contains(text(), '${indexName}')]`,
            `//li[contains(text(), '${indexName}')]`,
            `//button[contains(text(), '${indexName}')]`,
            `//span[contains(text(), '${indexName}')]`
          ];

          for (const xpath of xpaths) {
            try {
              const element = this.page.locator(`xpath=${xpath}`).first();
              if (await element.isVisible().catch(() => false)) {
                await element.scrollIntoViewIfNeeded({ timeout: 2000 });
                await this.page.waitForTimeout(300);
                await element.click({ timeout: 5000, force: true });
                indexClicked = true;
                Logger.info(`${stepPrefix} │           ✅ SUCCESS - Clicked using XPath`);
                break;
              }
            } catch { /* try next xpath */ }
          }
        } catch (e) {
          Logger.error(`${stepPrefix} │           ❌ FAILED - Could not click index: ${e}`);
          // Try to close dropdown
          try { await this.page.keyboard.press('Escape'); await this.page.waitForTimeout(300); } catch { /* ignore */ }
          return false;
        }
      }

      if (!indexClicked) {
        Logger.error(`${stepPrefix} │           ❌ FAILED - Could not find or click "${indexName}"`);
        try { await this.page.keyboard.press('Escape'); await this.page.waitForTimeout(300); } catch { /* ignore */ }
        return false;
      }

      // Step 3: Wait for page to load after index switch
      Logger.info(`${stepPrefix} │  Step 3/4: Waiting for page to load...`);
      await this.page.waitForTimeout(3000);

      // Verify URL
      try {
        await this.page.waitForURL(/\/discover/, { timeout: 5000 });
        Logger.info(`${stepPrefix} │           ✅ URL verified`);
      } catch {
        Logger.debug(`${stepPrefix} │           ⚠️  URL verification timeout`);
      }

      Logger.info(`${stepPrefix} │  Step 4/4: Complete`);

      Logger.info(`${stepPrefix} ├─────────────────────────────────────────────────────────┤`);
      Logger.info(`${stepPrefix} │  Index switch complete: ${indexName}`);
      Logger.info(`${stepPrefix} └─────────────────────────────────────────────────────────┘`);

      // Track this action
      this.actions.push({
        type: 'fill',
        description: `Switched index to "${indexName}"`,
        value: indexName
      });

      // Reset time range tracking for new index
      this.currentTimeRange = 2;
      this.noDataAttempts = 0;

      return true;

    } catch (error) {
      Logger.error(`${stepPrefix} └─────────────────────────────────────────────────────────┘`);
      Logger.error(`${stepPrefix} ❌ INDEX SWITCH FAILED: ${error}`);

      // Cleanup: Try to close any open dropdowns
      try {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(300);
      } catch { /* ignore */ }

      return false;
    }
  }

  /**
   * Extract table data from current OpenSearch Discover page
   *
   * @returns Object with table headers, row count, and sample data
   */
  async extractTableData(): Promise<{
    headers: string[];
    rowCount: number;
    sampleRows: string[][];
    hasData: boolean;
  }> {
    Logger.info(`\n      📊 Extracting table data from current page...`);

    // Wait for data to load
    await this.page.waitForTimeout(2000);

    // Find data table
    const dataTable = this.page.locator('.kbnDocTable, [data-test-subj="docTable"], table.euiTable').first();
    const tableVisible = await dataTable.isVisible().catch(() => false);

    if (!tableVisible) {
      Logger.warn(`      ⚠️  No data table found on page`);
      return {
        headers: [],
        rowCount: 0,
        sampleRows: [],
        hasData: false
      };
    }

    // Extract headers
    const headers = await this.page.locator('th.euiTableHeaderCell, .kbnDocTable th, table thead th').allTextContents();
    Logger.info(`      ✅ Found ${headers.length} columns: ${headers.slice(0, 3).join(', ')}${headers.length > 3 ? '...' : ''}`);

    // Extract rows
    const rows = this.page.locator('tr.euiTableRow, .kbnDocTable tbody tr, table tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      Logger.warn(`      ⚠️  Table found but contains 0 rows`);
      return {
        headers,
        rowCount: 0,
        sampleRows: [],
        hasData: false
      };
    }

    // Extract sample data (up to 10 rows)
    const sampleCount = Math.min(rowCount, 10);
    const sampleRows: string[][] = [];

    Logger.info(`      📄 Extracting ${sampleCount} sample rows from ${rowCount} total rows...`);

    for (let i = 0; i < sampleCount; i++) {
      const cells = await rows.nth(i).locator('td').allTextContents();
      sampleRows.push(cells);
    }

    Logger.info(`      ✅ Extracted ${sampleCount} rows successfully`);

    return {
      headers,
      rowCount,
      sampleRows,
      hasData: rowCount > 0
    };
  }

  /**
   * Save extracted data to Markdown file
   *
   * @param indexName - Name of the index/data source
   * @param tableData - Extracted table data
   * @param outputDir - Directory to save the file
   */
  async saveDataToMarkdown(
    indexName: string,
    tableData: {
      headers: string[];
      rowCount: number;
      sampleRows: string[][];
      hasData: boolean;
    },
    outputDir: string = './test-results/extracted-data'
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `index-${indexName.replace(/[^a-zA-Z0-9-_]/g, '_')}-${timestamp}.md`;
    const filepath = path.join(outputDir, filename);

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Build markdown content
    const samples = tableData.sampleRows.slice(0, 10).map((row, i) => {
      const rowPreview = row.map(cell => cell?.substring(0, 50) || '').join(' | ');
      return `| ${i + 1} | ${rowPreview}${row.length > 3 ? ' | ...' : ''} |`;
    }).join('\n');

    const markdownContent = `# OpenSearch Data Extraction Report

**Generated:** ${new Date().toISOString()}
**Data Source:** ${indexName}

---

## 📊 Data Overview

| Property | Value |
|----------|-------|
| **Data Source** | ${indexName} |
| **Total Records** | ${tableData.rowCount} |
| **Columns** | ${tableData.headers.length} |
| **Has Data** | ${tableData.hasData ? 'Yes ✅' : 'No ❌'} |

### Table Structure
${tableData.headers.map((col, i) => `${i + 1}. \`${col}\``).join('\n')}

---

## 📄 Sample Data (First ${tableData.sampleRows.length} Records)

| # | Data Preview |
|---|-------------|
${samples}

---

## 📋 Column Details

| Column | Type |
|--------|------|
${tableData.headers.map(h => `| \`${h}\` | string |`).join('\n')}

---

## 📝 Metadata

| Key | Value |
|-----|-------|
| Extraction Timestamp | ${new Date().toISOString()} |
| Data Source (Index) | ${indexName} |
| Total Row Count | ${tableData.rowCount} |
| Column Count | ${tableData.headers.length} |
| Sample Size | ${tableData.sampleRows.length} rows |
| Extraction Agent | TestAgent with Auto-Fix |

---

*This report was automatically generated by the OpenSearch Test Agent*
`;

    // Write file
    fs.writeFileSync(filepath, markdownContent, 'utf-8');

    Logger.info(`\n      💾 Data saved to: ${filepath}`);
    Logger.info(`      📊 Records: ${tableData.rowCount}`);
    Logger.info(`      📁 Source: ${indexName}\n`);

    return filepath;
  }

  /**
   * Process multiple indices with auto-fix for each
   * Switches between indices, extracts data, and saves results
   *
   * @param indices - Array of index names to process
   * @param outputDir - Directory to save results
   * @param maxAttemptsPerIndex - Max time range attempts per index
   */
  async processMultipleIndices(
    indices: string[],
    outputDir: string = './test-results/extracted-data',
    maxAttemptsPerIndex: number = 5
  ): Promise<{
    processed: Array<{ index: string; success: boolean; records: number; filepath?: string }>;
    totalRecords: number;
    summary: string;
  }> {
    const results: Array<{ index: string; success: boolean; records: number; filepath?: string }> = [];
    let totalRecords = 0;

    Logger.info(`\n╔══════════════════════════════════════════════════════════════════╗`);
    Logger.info(`║       🗂️ MULTI-INDEX PROCESSING STARTED                           ║`);
    Logger.info(`║       Indices to process: ${indices.length}                             ║`);
    Logger.info(`╚══════════════════════════════════════════════════════════════════╝\n`);

    for (let i = 0; i < indices.length; i++) {
      const indexName = indices[i];
      Logger.info(`\n${'='.repeat(70)}`);
      Logger.info(`  📂 INDEX ${i + 1}/${indices.length}: "${indexName}"`);
      Logger.info(`${'='.repeat(70)}\n`);

      // Step 1: Switch to index
      const switchSuccess = await this.switchIndex(indexName);
      if (!switchSuccess) {
        Logger.warn(`  ⚠️  Failed to switch to index "${indexName}", skipping...`);
        results.push({ index: indexName, success: false, records: 0 });
        continue;
      }

      // Wait for page to load after index switch
      await this.page.waitForTimeout(3000);

      // Reset time range for new index
      this.currentTimeRange = 2;
      this.noDataAttempts = 0;

      // Step 2: Extract data with auto-fix loop
      let tableData: Awaited<ReturnType<typeof this.extractTableData>> | undefined;
      let attempts = 0;

      while (attempts < maxAttemptsPerIndex) {
        attempts++;
        Logger.info(`\n      🔍 Attempt ${attempts}/${maxAttemptsPerIndex} for index "${indexName}"`);

        // Extract data from current page
        tableData = await this.extractTableData();

        if (tableData.hasData) {
          Logger.info(`      ✅ DATA FOUND in index "${indexName}" with ${tableData.rowCount} records!`);
          break;
        }

        // No data - try auto-fix
        if (attempts > 1) { // Allow first attempt to fail
          Logger.warn(`      ⚠️  No data in attempt ${attempts}, increasing time range...`);

          const progression = [2, 4, 6, 12, 24, 36];
          const currentIndex = progression.indexOf(this.currentTimeRange);

          if (currentIndex >= 0 && currentIndex < progression.length - 1) {
            this.currentTimeRange = progression[currentIndex + 1];
          } else if (this.currentTimeRange < 60) {
            this.currentTimeRange = Math.min(this.currentTimeRange * 2, 60);
          }

          await this.changeTimeRange(this.currentTimeRange);
          await this.page.waitForTimeout(3000);
        }
      }

      // Step 3: Save results
      if (tableData && tableData.hasData) {
        const filepath = await this.saveDataToMarkdown(indexName, tableData, outputDir);
        results.push({
          index: indexName,
          success: true,
          records: tableData.rowCount,
          filepath
        });
        totalRecords += tableData.rowCount;
      } else {
        Logger.warn(`  ❌ No data found for "${indexName}" after ${maxAttemptsPerIndex} attempts`);
        results.push({
          index: indexName,
          success: false,
          records: 0
        });
      }
    }

    // Build summary
    const successCount = results.filter(r => r.success).length;
    const summary = `Processed ${indices.length} indices: ${successCount} successful, ${indices.length - successCount} failed. Total records: ${totalRecords}`;

    Logger.info(`\n╔══════════════════════════════════════════════════════════════════╗`);
    Logger.info(`║       ✅ MULTI-INDEX PROCESSING COMPLETE                         ║`);
    Logger.info(`╠══════════════════════════════════════════════════════════════════╣`);
    Logger.info(`║  Total indices:    ${indices.length}                                          ║`);
    Logger.info(`║  Successful:       ${successCount}                                                ║`);
    Logger.info(`║  Failed:          ${indices.length - successCount}                                                ║`);
    Logger.info(`║  Total records:    ${totalRecords}                                              ║`);
    Logger.info(`╚══════════════════════════════════════════════════════════════════╝\n`);

    return {
      processed: results,
      totalRecords,
      summary
    };
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
