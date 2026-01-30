import { Locator, Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/**
 * Input Component - Reusable input field component
 *
 * Example usage:
 * const usernameInput = new Input(page, page.getByPlaceholder('Username'));
 * await usernameInput.fill('testuser');
 */
export class Input extends BaseComponent {
  private inputLocator: Locator;

  constructor(page: Page, locator: Locator) {
    super(page, locator);
    this.inputLocator = locator;
  }

  /**
   * Fill text into input
   */
  async fill(text: string, clear: boolean = true): Promise<void> {
    await this.basePage.fill(this.inputLocator, text, { clear });
  }

  /**
   * Clear input
   */
  async clear(): Promise<void> {
    await this.inputLocator.clear();
  }

  /**
   * Get the value of the input
   */
  async getValue(): Promise<string> {
    return (await this.inputLocator.inputValue()) || '';
  }

  /**
   * Check if the input is enabled
   */
  async isEnabled(): Promise<boolean> {
    return await this.basePage.isEnabled(this.inputLocator);
  }

  /**
   * Check if the input is disabled
   */
  async isDisabled(): Promise<boolean> {
    return !(await this.isEnabled());
  }

  /**
   * Check if the input has a placeholder
   */
  async getPlaceholder(): Promise<string | null> {
    return await this.basePage.getAttribute(this.inputLocator, 'placeholder');
  }
}
