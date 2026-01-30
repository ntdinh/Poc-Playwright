import { Locator, Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/**
 * Button Component - Reusable button component.
 *
 * Example:
 * const submitButton = new Button(page, page.getByRole('button', { name: 'Submit' }));
 * await submitButton.click();
 */
export class Button extends BaseComponent {
  private buttonLocator: Locator;

  constructor(page: Page, locator: Locator) {
    super(page, locator);
    this.buttonLocator = locator;
  }

  /**
   * Click the button.
   */
  async click(): Promise<void> {
    await this.basePage.click(this.buttonLocator);
  }

  /**
   * Check if the button is enabled.
   */
  async isEnabled(): Promise<boolean> {
    return await this.basePage.isEnabled(this.buttonLocator);
  }

  /**
   * Check if the button is disabled.
   */
  async isDisabled(): Promise<boolean> {
    return !(await this.isEnabled());
  }

  /**
   * Get the button text.
   */
  async getText(): Promise<string> {
    return await this.basePage.getText(this.buttonLocator);
  }

  /**
   * Hover over the button.
   */
  async hover(): Promise<void> {
    await this.basePage.hover(this.buttonLocator);
  }
}
