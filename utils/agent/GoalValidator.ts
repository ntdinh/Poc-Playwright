import { Page } from '@playwright/test';
import { BrowserState, TestGoal } from './types';
import { Logger } from '../Logger';

/**
 * Validates whether a test goal has been achieved
 *
 * Uses both deterministic Playwright checks and LLM-based validation
 * for flexible goal verification.
 */
export class GoalValidator {
  private page: Page;
  private llmValidator?: (state: BrowserState, goal: TestGoal) => Promise<boolean>;

  constructor(page: Page, llmValidator?: (state: BrowserState, goal: TestGoal) => Promise<boolean>) {
    this.page = page;
    this.llmValidator = llmValidator;
  }

  /**
   * Validate if the goal is achieved
   */
  async validate(state: BrowserState, goal: TestGoal): Promise<{
    achieved: boolean;
    details: string[];
    failedCriteria: string[];
  }> {
    Logger.info(`Validating goal: ${goal.description}`);

    const details: string[] = [];
    const failedCriteria: string[] = [];

    // Check each success criterion
    for (const criterion of goal.successCriteria) {
      const result = await this.checkCriterion(state, criterion);
      details.push(result.detail);

      if (!result.passed) {
        failedCriteria.push(criterion);
      }
    }

    const achieved = failedCriteria.length === 0;

    if (achieved) {
      Logger.info(`Goal achieved: ${goal.description}`);
    } else {
      Logger.warn(`Goal not achieved. Failed criteria: ${failedCriteria.join(', ')}`);
    }

    return { achieved, details, failedCriteria };
  }

  /**
   * Check a single success criterion
   */
  private async checkCriterion(
    state: BrowserState,
    criterion: string
  ): Promise<{ passed: boolean; detail: string }> {
    // Parse criterion to determine check type

    // 1. Check for visible element: "Element [selector] is visible"
    const visibleMatch = criterion.match(/element\s+(.+?)\s+is\s+visible/i);
    if (visibleMatch) {
      const selector = visibleMatch[1];
      const isVisible = await this.isElementVisible(selector);
      return {
        passed: isVisible,
        detail: isVisible
          ? `✓ Element ${selector} is visible`
          : `✗ Element ${selector} is not visible`
      };
    }

    // 2. Check for URL: "URL contains [pattern]"
    const urlMatch = criterion.match(/url\s+contains\s+(.+)/i);
    if (urlMatch) {
      const pattern = urlMatch[1].replace(/['"]/g, '');
      const matches = state.url.includes(pattern);
      return {
        passed: matches,
        detail: matches
          ? `✓ URL contains "${pattern}"`
          : `✗ URL does not contain "${pattern}"`
      };
    }

    // 3. Check for exact URL: "URL is [url]"
    const urlExactMatch = criterion.match(/url\s+is\s+(.+)/i);
    if (urlExactMatch) {
      const expectedUrl = urlExactMatch[1].replace(/['"]/g, '');
      const matches = state.url === expectedUrl;
      return {
        passed: matches,
        detail: matches
          ? `✓ URL is "${expectedUrl}"`
          : `✗ URL is not "${expectedUrl}"`
      };
    }

    // 4. Check for element with text: "Element contains [text]"
    const textMatch = criterion.match(/element\s+contains\s+(.+)/i);
    if (textMatch) {
      const text = textMatch[1].replace(/['"]/g, '');
      const contains = state.domTree.some(el =>
        el.text?.toLowerCase().includes(text.toLowerCase()) ||
        el.accessibleName?.toLowerCase().includes(text.toLowerCase())
      );
      return {
        passed: contains,
        detail: contains
          ? `✓ Found element containing "${text}"`
          : `✗ No element contains "${text}"`
      };
    }

    // 5. Check for button/action availability: "Can [action]"
    const canMatch = criterion.match(/can\s+(click\s+.+?|find\s+.+?|see\s-.+?)$/i);
    if (canMatch) {
      const action = canMatch[1];
      // Check if relevant element exists in DOM
      const target = action.replace(/^(click|find|see)\s+/, '');
      const exists = state.domTree.some(el =>
        el.accessibleName?.toLowerCase().includes(target.toLowerCase()) ||
        el.text?.toLowerCase().includes(target.toLowerCase()) ||
        el.selector.includes(target)
      );
      return {
        passed: exists,
        detail: exists
          ? `✓ Can ${action}`
          : `✗ Cannot ${action}`
      };
    }

    // 6. Check for no errors: "No console errors"
    if (criterion.toLowerCase().includes('no console errors') ||
        criterion.toLowerCase().includes('no errors')) {
      const errors = state.consoleLogs.filter(l => l.level === 'error');
      return {
        passed: errors.length === 0,
        detail: errors.length === 0
          ? '✓ No console errors'
          : `✗ Found ${errors.length} console errors`
      };
    }

    // 7. Use LLM for complex criteria
    if (this.llmValidator) {
      try {
        const passed = await this.llmValidator(state, {
          id: 'temp',
          description: criterion,
          startUrl: state.url,
          successCriteria: [criterion]
        });
        return {
          passed,
          detail: passed
            ? `✓ LLM confirmed: ${criterion}`
            : `✗ LLM rejected: ${criterion}`
        };
      } catch (error) {
        Logger.warn(`LLM validation failed: ${error}`);
        return {
          passed: false,
          detail: `? Could not validate: ${criterion}`
        };
      }
    }

    // Default: unknown criterion
    return {
      passed: false,
      detail: `? Unknown criterion format: ${criterion}`
    };
  }

  /**
   * Check if an element is visible
   */
  private async isElementVisible(selector: string): Promise<boolean> {
    try {
      const locator = this.createLocator(selector);
      await expect(locator).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a locator from a selector string
   */
  private createLocator(selector: string) {
    // Handle [role="..."][name="..."] format
    if (selector.includes('[role=') && selector.includes('[name=')) {
      const roleMatch = selector.match(/\[role="([^"]+)"\]/);
      const nameMatch = selector.match(/\[name="([^"]+)"\]/);
      if (roleMatch && nameMatch) {
        return this.page.getByRole(roleMatch[1] as any, { name: nameMatch[1] });
      }
    }

    // Handle [role="..."] format
    if (selector.includes('[role=') && !selector.includes('[name=')) {
      const roleMatch = selector.match(/\[role="([^"]+)"\]/);
      if (roleMatch) {
        return this.page.getByRole(roleMatch[1] as any);
      }
    }

    // Handle [aria-label="..."] format
    const ariaLabelMatch = selector.match(/\[aria-label="([^"]+)"\]/i);
    if (ariaLabelMatch) {
      return this.page.getByLabel(ariaLabelMatch[1]);
    }

    // Try to determine selector type
    if (selector.startsWith('aria-')) {
      const name = selector.replace('aria-', '');
      return this.page.getByRole('button', { name }).or(
        this.page.getByRole('link', { name })
      ).or(
        this.page.getByLabel(name)
      );
    }

    if (selector.startsWith('text=')) {
      return this.page.getByText(selector.replace('text=', ''));
    }

    if (selector.startsWith('testId=')) {
      return this.page.getByTestId(selector.replace('testId=', ''));
    }

    // Default: CSS selector
    return this.page.locator(selector);
  }

  /**
   * Helper: Create success criteria for common checks
   */
  static Criteria = {
    elementVisible: (selector: string) => `Element ${selector} is visible`,
    urlContains: (pattern: string) => `URL contains ${pattern}`,
    urlIs: (url: string) => `URL is ${url}`,
    canClick: (target: string) => `Can click ${target}`,
    canFind: (target: string) => `Can find ${target}`,
    noErrors: () => 'No console errors',
    elementContainsText: (text: string) => `Element contains ${text}`
  };
}

// Import expect for Playwright assertions
import { expect } from '@playwright/test';
