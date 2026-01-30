import { Page, Locator, expect } from '@playwright/test';
import { getBaseURL } from '../config/environment';

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

  constructor(page: Page) {
    this.page = page;
    this.baseURL = getBaseURL();
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
    options?: { timeout?: number; force?: boolean }
  ): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: options?.timeout || 5000 });
    await locator.click({ force: options?.force || false });
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
    options?: { timeout?: number; clear?: boolean }
  ): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: options?.timeout || 5000 });
    if (options?.clear !== false) {
      await locator.clear();
    }
    await locator.fill(text);
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
  async waitForElement(locator: Locator, timeout: number = 5000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for an element to become hidden.
   * @param locator - Element locator.
   * @param timeout - Max timeout (ms).
   */
  async waitForElementHidden(locator: Locator, timeout: number = 5000): Promise<void> {
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
