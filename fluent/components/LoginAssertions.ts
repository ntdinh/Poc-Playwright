import { expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { FluentComponentBase } from '../common/FluentComponentBase';
import { Logger } from '../../utils/Logger';
import { TestData } from '../../utils/TestData';

/**
 * LoginAssertions (Fluent)
 * ------------------------
 * Gom nhóm các bước kiểm tra sau khi submit form login.
 * Dùng kèm với `LoginFormComponent` để tạo nên fluent API:
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
   * Kỳ vọng login thành công và redirect tới dashboard.
   */
  async expectSuccess(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying login success');
    await this.loginPage.verifyDashboardRedirect();
    Logger.info('Fluent: Login successful - redirected to dashboard');
  }

  /**
   * Kỳ vọng hiển thị lỗi "invalid credentials".
   * Logic tương tự như các test cũ để giữ behaviour.
   */
  async expectInvalidCredentialsError(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying invalid credentials error');

    // Chờ error message xuất hiện
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
   * Kỳ vọng hiển thị lỗi "Required" cho username rỗng.
   */
  async expectUsernameRequiredError(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying required validation for empty username');
    await expect(this.loginPage.requiredFieldMessage).toBeVisible();
    await expect(this.loginPage.requiredFieldMessage).toHaveText('Required');
    Logger.info('Fluent: Username required validation displayed correctly');
  }

  /**
   * Kỳ vọng hiển thị lỗi "Required" cho password rỗng.
   *
   * Lưu ý: Ở OrangeHRM, thông báo Required dùng chung selector,
   * nên test chỉ verify text, behaviour vẫn giống test cũ.
   */
  async expectPasswordRequiredError(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying required validation for empty password');
    await expect(this.loginPage.requiredFieldMessage).toBeVisible();
    await expect(this.loginPage.requiredFieldMessage).toHaveText('Required');
    Logger.info('Fluent: Password required validation displayed correctly');
  }

  /**
   * Ví dụ assertion kiểm tra đã authenticate sẵn (tương tự TC006).
   */
  async expectOnDashboard(): Promise<void> {
    Logger.info('Fluent: Verifying authenticated dashboard URL');
    await expect(this.page).toHaveURL(new RegExp(TestData.DASHBOARD_URL.replace(/\//g, '\\/')));
  }
}

