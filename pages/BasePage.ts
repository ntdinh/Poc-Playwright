import { Page, Locator, expect } from '@playwright/test';
import { getBaseURL } from '../config/environment';
import { Logger } from '../utils/Logger';

/**
 * BasePage - Base class for all Page Objects.
 * Contains common methods used by all pages.
 *
 * Improvements:
 * - Wait strategies
 * - Error handling
 * - Better logging
 * - Retry mechanisms
 */
export class BasePage {
  readonly page: Page;
  protected readonly baseURL: string;
  /**
   * Default timeout (ms) used by most wait helpers.
   * Can be overridden per-call via options.
   */
  protected readonly defaultTimeout: number = 5000;

  /**
   * Default number of retries for unstable actions
   * like click / fill in highly dynamic UIs.
   */
  protected readonly defaultRetryCount: number = 2;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = getBaseURL();
  }

  /**
   * Generic retry wrapper for flaky actions.
   * Logs attempts and errors to help debugging.
   */
  protected async withRetry<T>(
    actionName: string,
    fn: () => Promise<T>,
    retryCount: number = this.defaultRetryCount
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        Logger.debug(`BasePage action "${actionName}" attempt ${attempt}/${retryCount}`);
        const result = await fn();
        if (attempt > 1) {
          Logger.info(`BasePage action "${actionName}" succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        Logger.warn(`BasePage action "${actionName}" failed on attempt ${attempt}/${retryCount}`, error);

        if (attempt === retryCount) {
          Logger.error(`BasePage action "${actionName}" failed after ${retryCount} attempts`);
          throw error;
        }

        // Small backoff before retrying
        await this.page.waitForTimeout(250);
      }
    }

    // Should never reach here, but satisfies TypeScript.
    throw lastError as Error;
  }

  /**
   * Navigate to a specific URL.
   * @param url - Target URL (relative or absolute).
   *              If empty string '', will navigate to baseURL.
   * @param options - Navigation options.
   */
  async goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    // If absolute URL (starts with http), use it directly.
    // If empty string, Playwright will use baseURL from config.
    // If relative path, Playwright will append it to baseURL.
    const targetURL = url.startsWith('http') ? url : url || '/';
    await this.page.goto(targetURL, {
      waitUntil: options?.waitUntil || 'networkidle',
    });
  }

  /**
   * Get the current page title.
   * @returns Promise<string> - Page title.
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Wait until the page is fully loaded.
   */
  async waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle'): Promise<void> {
    await this.page.waitForLoadState(state);
  }

  /**
   * Take a full-page screenshot.
   * @param filename - Screenshot file name.
   */
  async takeScreenshot(filename: string): Promise<void> {
    await this.page.screenshot({ path: filename, fullPage: true });
  }

  /**
   * Click an element with waiting and optional retry.
   * @param locator - Element locator.
   * @param options - Click options.
   */
  async click(
    locator: Locator,
    options?: { timeout?: number; force?: boolean; retryCount?: number }
  ): Promise<void> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const retryCount = options?.retryCount ?? this.defaultRetryCount;

    await this.withRetry('click', async () => {
      await locator.waitFor({ state: 'visible', timeout });
      await locator.click({ force: options?.force ?? false });
    }, retryCount);
  }

  /**
   * Fill an input field, clearing it by default.
   * @param locator - Input locator.
   * @param text - Text to type.
   * @param options - Fill options.
   */
  async fill(
    locator: Locator,
    text: string,
    options?: { timeout?: number; clear?: boolean; retryCount?: number }
  ): Promise<void> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const retryCount = options?.retryCount ?? this.defaultRetryCount;

    await this.withRetry('fill', async () => {
      await locator.waitFor({ state: 'visible', timeout });
      if (options?.clear !== false) {
        // Note: clear() may not be supported on all elements.
        // If it fails, we fall back to filling empty string first.
        try {
          if (typeof (locator as any).clear === 'function') {
            await (locator as any).clear();
          } else {
            await locator.fill('');
          }
        } catch {
          await locator.fill('');
        }
      }
      await locator.fill(text);
    }, retryCount);
  }

  /**
   * Get the text content of an element.
   * @param locator - Element locator.
   * @returns Promise<string> - Text content.
   */
  async getText(locator: Locator): Promise<string> {
    await locator.waitFor({ state: 'visible' });
    return (await locator.textContent()) || '';
  }

  /**
   * Wait for an element to become visible.
   * @param locator - Element locator.
   * @param timeout - Max timeout (ms).
   */
  async waitForElement(locator: Locator, timeout: number = this.defaultTimeout): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for an element to become hidden.
   * @param locator - Element locator.
   * @param timeout - Max timeout (ms).
   */
  async waitForElementHidden(locator: Locator, timeout: number = this.defaultTimeout): Promise<void> {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Check if an element is visible.
   * @param locator - Element locator.
   * @returns Promise<boolean>.
   */
  async isVisible(locator: Locator): Promise<boolean> {
    try {
      await locator.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if an element is enabled.
   * @param locator - Element locator.
   * @returns Promise<boolean>.
   */
  async isEnabled(locator: Locator): Promise<boolean> {
    return await locator.isEnabled();
  }

  /**
   * Scroll the element into view if needed.
   * @param locator - Element locator.
   */
  async scrollToElement(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
  }

  /**
   * Hover over an element.
   * @param locator - Element locator.
   */
  async hover(locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'visible' });
    await locator.hover();
  }

  /**
   * Get an attribute from an element.
   * @param locator - Element locator.
   * @param attribute - Attribute name.
   * @returns Promise<string | null>.
   */
  async getAttribute(locator: Locator, attribute: string): Promise<string | null> {
    return await locator.getAttribute(attribute);
  }

  /**
   * Wait for the URL to match a pattern.
   * @param urlPattern - URL pattern (string or regex).
   * @param timeout - Max timeout (ms).
   */
  async waitForURL(urlPattern: string | RegExp, timeout: number = 10000): Promise<void> {
    await this.page.waitForURL(urlPattern, { timeout });
  }

  /**
   * Verify the current URL.
   * @param expectedURL - Expected URL (string or regex).
   */
  async verifyURL(expectedURL: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(expectedURL);
  }

  /**
   * Reload the page.
   */
  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' });
  }

  /**
   * Go back in browser history.
   */
  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: 'networkidle' });
  }

  /**
   * Go forward in browser history.
   */
  async goForward(): Promise<void> {
    await this.page.goForward({ waitUntil: 'networkidle' });
  }
}
