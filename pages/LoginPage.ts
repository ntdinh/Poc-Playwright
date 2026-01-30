import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { TestData } from '../utils/TestData';
import { Logger } from '../utils/Logger';

/**
 * LoginPage - Page Object Model for the login page.
 * Contains all locators and methods related to the login screen.
 */
export class LoginPage extends BasePage {
  // Locators - All elements on the login page
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly requiredFieldMessage: Locator;

  constructor(page: Page) {
    super(page);
    // Initialize locators
    // Note: You may need to adjust these selectors for your actual application
    this.usernameInput = page.getByRole('textbox', { name: 'Username' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password' });
    this.loginButton = page.getByRole('button', { name: 'Login' });
    // Error message for OrangeHRM - may appear in different forms.
    // Use a flexible selector to find the error message.
    this.errorMessage = page.locator('.oxd-alert-content-text, .oxd-alert, [role="alert"]')
      .filter({ hasText: /Invalid|credentials|incorrect|wrong/i })
      .first();
    this.successMessage = page.locator('.success-message, .alert-success');
    this.forgotPasswordLink = page.locator('a:has-text("Forgot Password")');
    this.requiredFieldMessage = page.getByText('Required');
  }

  /**
   * Navigate to the login page.
   */
  async navigateToLogin(): Promise<void> {
    await this.goto(TestData.LOGIN_URL);
    await this.waitForLoadState();
  }

  /**
   * Enter username/email.
   * @param username - Username or email.
   */
  async enterUsername(username: string): Promise<void> {
    await this.fill(this.usernameInput, username);
  }

  /**
   * Enter password.
   * @param password - Password.
   */
  async enterPassword(password: string): Promise<void> {
    await this.fill(this.passwordInput, password);
  }

  /**
   * Click the Login button.
   */
  async clickLoginButton(): Promise<void> {
    await this.click(this.loginButton);
  }

  /**
   * Perform login with username and password.
   * @param username - Username or email.
   * @param password - Password.
   */
  async login(username: string, password: string): Promise<void> {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLoginButton();
  }

  /**
   * Get the error message text if present.
   * @returns Promise<string> - Error message content.
   */
  async getErrorMessage(): Promise<string> {
    try {
      // Wait for the error message to appear before reading text
      await this.waitForElement(this.errorMessage, 5000);
      return await this.getText(this.errorMessage);
    } catch (error) {
      Logger.warn('Error message not found with primary selector, trying alternative selectors');
      // Try alternative selectors for OrangeHRM
      const altSelectors = [
        this.page.locator('.oxd-alert-content-text'),
        this.page.locator('.oxd-alert'),
        this.page.locator('[role="alert"]'),
        this.page.getByText(/Invalid|credentials|incorrect/i),
      ];
      
      for (const selector of altSelectors) {
        try {
          if (await this.isVisible(selector)) {
            const text = await this.getText(selector);
            if (text) {
              Logger.info(`Found error message with alternative selector: ${text}`);
              return text;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      Logger.error('Could not find error message with any selector');
      return '';
    }
  }

  /**
   * Check if an error message is visible.
   * @returns Promise<boolean> - true if visible, false otherwise.
   */
  async isErrorMessageVisible(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Check if a success message is visible.
   * @returns Promise<boolean> - true if visible.
   */
  async isSuccessMessageVisible(): Promise<boolean> {
    return await this.successMessage.isVisible();
  }

  /**
   * Click the "Forgot password" link.
   */
  async clickForgotPassword(): Promise<void> {
    await this.click(this.forgotPasswordLink);
  }

  /**
   * Check if login was successful by verifying URL or page state.
   * @param expectedUrl - Expected URL after successful login.
   * @returns Promise<boolean> - true if login is successful.
   */
  async isLoginSuccessful(expectedUrl?: string): Promise<boolean> {
    if (expectedUrl) {
      await this.waitForURL(expectedUrl);
      return this.page.url().includes(expectedUrl);
    }
    // If no expectedUrl, check redirect or page state instead
    await this.waitForLoadState('networkidle');
    return !this.page.url().includes('/login');
  }

  /**
   * Verify that the user has been redirected to the dashboard after a successful login.
   * Uses TestData.DASHBOARD_URL for verification.
   */
  async verifyDashboardRedirect(): Promise<void> {
    // Wait until the URL contains the dashboard path
    await this.waitForURL(new RegExp(TestData.DASHBOARD_URL.replace(/\//g, '\\/')), 10000);
    // Verify URL contains the dashboard path
    await this.verifyURL(new RegExp(TestData.DASHBOARD_URL.replace(/\//g, '\\/')));
  }
}
