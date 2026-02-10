import { Page, expect } from '@playwright/test';
import { AgentAction } from './types';
import { Logger } from '../Logger';

/**
 * Executes Playwright actions based on LLM decisions
 *
 * This class translates AgentAction objects into Playwright API calls.
 * It handles various action types: navigate, click, fill, select, wait, verify, scroll.
 */
export class ActionExecutor {
  private page: Page;
  private defaultTimeout: number;

  constructor(page: Page, defaultTimeout: number = 30000) {
    this.page = page;
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Execute an action and return success status
   */
  async execute(action: AgentAction): Promise<{ success: boolean; error?: string }> {
    Logger.info(`Executing action: ${action.description}`);
    Logger.debug(`Action selector: ${action.selector}`);

    try {
      switch (action.type) {
        case 'navigate':
          await this.executeNavigate(action);
          break;
        case 'click':
          await this.executeClick(action);
          break;
        case 'fill':
          await this.executeFill(action);
          break;
        case 'select':
          await this.executeSelect(action);
          break;
        case 'wait':
          await this.executeWait(action);
          break;
        case 'verify':
          return await this.executeVerify(action);
        case 'scroll':
          await this.executeScroll(action);
          break;
        default:
          return {
            success: false,
            error: `Unknown action type: ${(action as any).type}`
          };
      }

      // Wait a bit for page to stabilize after action
      await this.page.waitForTimeout(500);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error(`Action failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Execute navigation action
   */
  private async executeNavigate(action: AgentAction): Promise<void> {
    if (!action.url) {
      throw new Error('Navigate action requires URL');
    }

    Logger.debug(`Navigating to: ${action.url}`);
    await this.page.goto(action.url, {
      waitUntil: 'domcontentloaded',
      timeout: this.defaultTimeout
    });
  }

  /**
   * Execute click action
   */
  private async executeClick(action: AgentAction): Promise<void> {
    if (!action.selector) {
      throw new Error('Click action requires selector');
    }

    Logger.debug(`Clicking: ${action.selector}`);

    // Try multiple locator strategies for robustness
    const locator = this.createLocator(action.selector);
    await locator.click({ timeout: this.defaultTimeout });
  }

  /**
   * Execute fill action
   */
  private async executeFill(action: AgentAction): Promise<void> {
    if (!action.selector) {
      throw new Error('Fill action requires selector');
    }
    if (action.value === undefined) {
      throw new Error('Fill action requires value');
    }

    Logger.debug(`Filling ${action.selector} with: ${action.value}`);

    const locator = this.createLocator(action.selector);
    await locator.fill(action.value, { timeout: this.defaultTimeout });
  }

  /**
   * Execute select action
   */
  private async executeSelect(action: AgentAction): Promise<void> {
    if (!action.selector) {
      throw new Error('Select action requires selector');
    }
    if (!action.option) {
      throw new Error('Select action requires option');
    }

    Logger.debug(`Selecting "${action.option}" from: ${action.selector}`);

    const locator = this.createLocator(action.selector);
    await locator.selectOption(action.option, { timeout: this.defaultTimeout });
  }

  /**
   * Execute wait action
   */
  private async executeWait(action: AgentAction): Promise<void> {
    const duration = action.duration || 1000;
    Logger.debug(`Waiting ${duration}ms`);
    await this.page.waitForTimeout(duration);
  }

  /**
   * Execute verify action - returns validation result
   */
  private async executeVerify(action: AgentAction): Promise<{ success: boolean; error?: string }> {
    if (!action.selector) {
      return { success: false, error: 'Verify action requires selector' };
    }

    Logger.debug(`Verifying: ${action.selector}`);

    try {
      const locator = this.createLocator(action.selector);

      // Check if element is visible
      await expect(locator).toBeVisible({ timeout: this.defaultTimeout });

      Logger.info(`Verification passed: ${action.expectation || action.selector}`);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.warn(`Verification failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Execute scroll action
   */
  private async executeScroll(action: AgentAction): Promise<void> {
    Logger.debug('Scrolling page');

    if (action.selector) {
      // Scroll element into view
      const locator = this.createLocator(action.selector);
      await locator.scrollIntoViewIfNeeded({ timeout: this.defaultTimeout });
    } else {
      // Scroll to bottom of page
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
    }
  }

  /**
   * Create a locator from a selector string
   * Handles multiple selector formats for robustness
   */
  private createLocator(selector: string) {
    Logger.info(`Creating locator for: "${selector}"`);

    // Try to determine selector type
    if (selector.startsWith('aria-')) {
      // ARIA-based selector
      const name = selector.replace('aria-', '');
      return this.page.getByRole('button', { name }).or(
        this.page.getByRole('link', { name })
      ).or(
        this.page.getByLabel(name)
      );
    }

    if (selector.startsWith('text=')) {
      // Text selector
      return this.page.getByText(selector.replace('text=', ''));
    }

    if (selector.startsWith('testId=')) {
      // Test ID selector
      return this.page.getByTestId(selector.replace('testId=', ''));
    }

    if (selector.startsWith('role=')) {
      // Role selector
      const [_, role, name] = selector.match(/^role=([^:]+):?(.+)?$/) || [];

      // Handle case where LLM outputs "name=Dismiss" instead of just "Dismiss"
      let actualName = name;
      if (name && name.includes('=')) {
        const nameParts = name.split('=');
        if (nameParts[0] === 'name' && nameParts[1]) {
          actualName = nameParts[1];
          Logger.info(`Detected LLM format issue, extracting actual name: "${actualName}"`);
        }
      }

      return actualName ? this.page.getByRole(role as any, { name: actualName }) : this.page.getByRole(role as any);
    }

    // Handle LLM output like "name=Dismiss" - treat as role=button:name=Dismiss
    if (selector.match(/^[a-zA-Z]+=.+/) && !selector.includes('[') && !selector.includes('#')) {
      // Format like "name=Dismiss" or "label=Something"
      const [_, key, value] = selector.match(/^([a-zA-Z]+)=(.+)$/) || [];
      Logger.debug(`Detected key=value format: key="${key}", value="${value}"`);
      if (key === 'name') {
        // Treat as button with that name
        Logger.debug(`Using getByRole with button/link for name="${value}"`);
        return this.page.getByRole('button', { name: value }).or(
          this.page.getByRole('link', { name: value })
        ).or(
          this.page.getByLabel(value)
        );
      }
      if (key === 'label') {
        Logger.debug(`Using getByLabel for label="${value}"`);
        return this.page.getByLabel(value);
      }
    }

    // Default: CSS selector - handle special characters
    // If selector contains [data- or similar, use it with getAttribute or escape it
    if (selector.includes('[') && selector.includes(']')) {
      // Try using getByTestId or getByLabel for common patterns
      const testIdMatch = selector.match(/\[data-test(?:id|-subj)=(?:['"])(.+?)(?:['"])\]/);
      if (testIdMatch) {
        return this.page.getByTestId(testIdMatch[1]);
      }
      const ariaLabelMatch = selector.match(/\[aria-label=(?:['"])(.+?)(?:['"])\]/i);
      if (ariaLabelMatch) {
        return this.page.getByLabel(ariaLabelMatch[1]);
      }
    }

    return this.page.locator(selector);
  }

  /**
   * Create a click action
   */
  static createClickAction(selector: string, description: string): AgentAction {
    return {
      type: 'click',
      selector,
      description
    };
  }

  /**
   * Create a fill action
   */
  static createFillAction(selector: string, value: string, description: string): AgentAction {
    return {
      type: 'fill',
      selector,
      value,
      description
    };
  }

  /**
   * Create a navigate action
   */
  static createNavigateAction(url: string, description: string): AgentAction {
    return {
      type: 'navigate',
      url,
      description
    };
  }

  /**
   * Create a select action
   */
  static createSelectAction(selector: string, option: string, description: string): AgentAction {
    return {
      type: 'select',
      selector,
      option,
      description
    };
  }

  /**
   * Create a verify action
   */
  static createVerifyAction(selector: string, expectation: string): AgentAction {
    return {
      type: 'verify',
      selector,
      expectation,
      description: `Verify ${expectation}`
    };
  }

  /**
   * Create a wait action
   */
  static createWaitAction(duration: number, description: string): AgentAction {
    return {
      type: 'wait',
      duration,
      description
    };
  }
}
