import { Locator, Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/**
 * Dropdown Component - example of a more complex component.
 *
 * Design:
 * - `rootLocator` points to the dropdown container.
 * - `triggerLocator` is the element used to open the dropdown.
 * - `optionLocator` is a template to select an option by text.
 */
export class Dropdown extends BaseComponent {
  private triggerLocator: Locator;
  private optionLocator: (text: string | RegExp) => Locator;

  constructor(page: Page, rootLocator: Locator, triggerLocator?: Locator) {
    super(page, rootLocator);
    this.triggerLocator = triggerLocator ?? rootLocator;
    this.optionLocator = (text: string | RegExp) =>
      this.page.getByRole('option', { name: text });
  }

  /**
   * Opens the dropdown.
   */
  async open(): Promise<void> {
    await this.basePage.click(this.triggerLocator);
  }

  /**
   * Selects an option by its text.
   */
  async selectByText(text: string): Promise<void> {
    await this.open();
    const option = this.optionLocator(text);
    await this.basePage.click(option);
  }
}

