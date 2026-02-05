import { expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { FluentComponentBase } from '../common/FluentComponentBase';
import { Logger } from '../../utils/Logger';
import { TestData } from '../../utils/TestData';

/**
 * LoginAssertions (Fluent)
 * ------------------------
 * Groups verification steps after submitting the login form.
 * Used together with `LoginFormComponent` to build a fluent API:
 *
 * await fluentLogin
 *   .form()
 *   .withUsername('admin')
 *   .withPassword('admin123')
 *   .submit()
 *   .expectSuccess();
 */
export class LoginAssertions extends FluentComponentBase {
  private readonly loginPage: LoginPage;

  constructor(loginPage: LoginPage) {
    super(loginPage.page);
    this.loginPage = loginPage;
  }

  /**
   * Expects login to succeed and redirect to the dashboard.
   */
  async expectSuccess(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying login success');
    await this.loginPage.verifyDashboardRedirect();
    Logger.info('Fluent: Login successful - redirected to dashboard');
  }

  /**
   * Expects the "invalid credentials" error to be displayed.
   * Logic is similar to the legacy tests to keep the same behaviour.
   */
  async expectInvalidCredentialsError(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying invalid credentials error');

    // Wait for the error message to appear
    try {
      await this.loginPage.waitForElement(this.loginPage.errorMessage, 10000);
      await expect(this.loginPage.errorMessage).toBeVisible({ timeout: 10000 });
    } catch (error) {
      Logger.warn('Fluent: Primary error message selector not found, trying alternative methods');
      const altErrorLocator = this.loginPage.page
        .locator('.oxd-alert-content-text, .oxd-alert, [role="alert"]')
        .filter({ hasText: /Invalid|credentials|incorrect|wrong/i })
        .first();

      await expect(altErrorLocator).toBeVisible({ timeout: 10000 });
    }

    const errorText = await this.loginPage.getErrorMessage();
    expect(errorText).toBeTruthy();
    Logger.info(`Fluent: Error message displayed: ${errorText}`);
  }

  /**
   * Expects the "Required" error to be shown for an empty username.
   */
  async expectUsernameRequiredError(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying required validation for empty username');
    await expect(this.loginPage.requiredFieldMessage).toBeVisible();
    await expect(this.loginPage.requiredFieldMessage).toHaveText('Required');
    Logger.info('Fluent: Username required validation displayed correctly');
  }

  /**
   * Expects the "Required" error to be shown for an empty password.
   *
   * Note: In OrangeHRM, the Required message uses a shared selector,
   * so the test only verifies the text while keeping the same behaviour.
   */
  async expectPasswordRequiredError(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying required validation for empty password');
    await expect(this.loginPage.requiredFieldMessage).toBeVisible();
    await expect(this.loginPage.requiredFieldMessage).toHaveText('Required');
    Logger.info('Fluent: Password required validation displayed correctly');
  }

  /**
   * Example assertion for checking an already authenticated state (similar to TC006).
   */
  async expectOnDashboard(): Promise<void> {
    Logger.info('Fluent: Verifying authenticated dashboard URL');
    await expect(this.page).toHaveURL(new RegExp(TestData.DASHBOARD_URL.replace(/\//g, '\\/')));
  }
}

