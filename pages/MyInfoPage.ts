import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * MyInfoPage - Page Object Model for the \"My Info\" page.
 * Contains all locators and methods related to updating personal information.
 */
export class MyInfoPage extends BasePage {
  // Locators - All relevant elements on the My Info page
  readonly myInfoLink: Locator;
  readonly firstNameInput: Locator;
  readonly middleNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly saveButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);
    // Initialize locators
    this.myInfoLink = page.getByRole('link', { name: 'My Info' });
    this.firstNameInput = page.getByRole('textbox', { name: 'First Name' });
    this.middleNameInput = page.getByRole('textbox', { name: 'Middle Name' });
    this.lastNameInput = page.getByRole('textbox', { name: 'Last Name' });
    this.saveButton = page.locator('form').filter({ hasText: 'Employee Full NameEmployee' }).getByRole('button');
    this.successMessage = page.getByText('Successfully Updated');
  }

  /**
   * Navigate to the My Info page.
   */
  async navigateToMyInfo(): Promise<void> {
    await this.click(this.myInfoLink);
    await this.waitForLoadState();
  }

  /**
   * Update First Name.
   * @param firstName - New first name.
   */
  async updateFirstName(firstName: string): Promise<void> {
    await this.fill(this.firstNameInput, firstName);
  }

  /**
   * Update Middle Name.
   * @param middleName - New middle name.
   */
  async updateMiddleName(middleName: string): Promise<void> {
    await this.fill(this.middleNameInput, middleName);
  }

  /**
   * Update Last Name.
   * @param lastName - New last name.
   */
  async updateLastName(lastName: string): Promise<void> {
    await this.fill(this.lastNameInput, lastName);
  }

  /**
   * Click the Save button to persist changes.
   */
  async clickSaveButton(): Promise<void> {
    await this.click(this.saveButton);
  }

  /**
   * Update full name (First, Middle, Last).
   * @param firstName - New first name.
   * @param middleName - New middle name.
   * @param lastName - New last name.
   */
  async updateFullName(firstName: string, middleName: string, lastName: string): Promise<void> {
    await this.updateFirstName(firstName);
    await this.updateMiddleName(middleName);
    await this.updateLastName(lastName);
  }

  /**
   * Save updated information.
   */
  async saveInformation(): Promise<void> {
    await this.clickSaveButton();
    await this.waitForLoadState();
  }

  /**
   * Check if the success message is visible.
   * @returns Promise<boolean> - true if the message is visible.
   */
  async isSuccessMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.successMessage);
  }

  /**
   * Get the success message text.
   * @returns Promise<string> - Message content.
   */
  async getSuccessMessage(): Promise<string> {
    return await this.getText(this.successMessage);
  }

  /**
   * Verify that the success message is displayed.
   */
  async verifySuccessMessage(): Promise<void> {
    await this.waitForElement(this.successMessage, 5000);
    const message = await this.getSuccessMessage();
    if (!message.includes('Successfully Updated')) {
      throw new Error(`Expected success message but got: ${message}`);
    }
  }
}
