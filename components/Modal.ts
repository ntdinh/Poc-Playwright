import { Locator, Page, expect } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/**
 * Modal Component - ví dụ cho component dialog.
 */
export class Modal extends BaseComponent {
  constructor(page: Page, rootLocator: Locator) {
    super(page, rootLocator);
  }

  async isOpen(): Promise<boolean> {
    return this.isVisible();
  }

  async expectOpen(): Promise<void> {
    await this.waitForVisible();
    await expect(this.rootLocator).toBeVisible();
  }

  async expectClosed(): Promise<void> {
    await expect(this.rootLocator).toBeHidden();
  }
}

