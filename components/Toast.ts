import { Locator, Page, expect } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/**
 * Toast/Notification Component - example of a temporary message component.
 */
export class Toast extends BaseComponent {
  constructor(page: Page, rootLocator: Locator) {
    super(page, rootLocator);
  }

  async expectVisible(timeout: number = 5000): Promise<void> {
    await this.basePage.waitForElement(this.rootLocator, timeout);
    await expect(this.rootLocator).toBeVisible();
  }

  async getText(): Promise<string> {
    return this.basePage.getText(this.rootLocator);
  }
}

