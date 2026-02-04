import { Locator, Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/**
 * Dropdown Component - ví dụ cho component phức tạp hơn.
 *
 * Thiết kế:
 * - rootLocator trỏ tới container của dropdown.
 * - triggerLocator là element dùng để mở dropdown.
 * - optionLocator là template để chọn option theo text.
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
   * Mở dropdown.
   */
  async open(): Promise<void> {
    await this.basePage.click(this.triggerLocator);
  }

  /**
   * Chọn option theo text.
   */
  async selectByText(text: string): Promise<void> {
    await this.open();
    const option = this.optionLocator(text);
    await this.basePage.click(option);
  }
}

