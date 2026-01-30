import { Locator, Page } from '@playwright/test';
import { BasePage } from '../pages/BasePage';

/**
 * BaseComponent - Base class for reusable UI components.
 *
 * Component Pattern helps to:
 * - Reuse UI components (buttons, forms, modals, etc.)
 * - Organize code better
 * - Make components easier to maintain and test
 *
 * Example usages:
 * - NavigationBar component
 * - SearchBox component
 * - Modal component
 * - Form component
 */
export abstract class BaseComponent {
  protected page: Page;
  protected basePage: BasePage;
  protected rootLocator: Locator;

  constructor(page: Page, rootLocator?: Locator) {
    this.page = page;
    this.basePage = new BasePage(page);
    this.rootLocator = rootLocator || page.locator('body');
  }

  /**
   * Check if the component is visible.
   */
  async isVisible(): Promise<boolean> {
    return await this.basePage.isVisible(this.rootLocator);
  }

  /**
   * Wait for the component to become visible.
   */
  async waitForVisible(timeout: number = 5000): Promise<void> {
    await this.basePage.waitForElement(this.rootLocator, timeout);
  }

  /**
   * Scroll the component into view.
   */
  async scrollIntoView(): Promise<void> {
    await this.basePage.scrollToElement(this.rootLocator);
  }
}
