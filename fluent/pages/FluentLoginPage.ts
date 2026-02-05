import { Page } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { LoginFormComponent } from '../components/LoginFormComponent';
import { LoginAssertions } from '../components/LoginAssertions';
import { FluentComponentBase } from '../common/FluentComponentBase';
import { Logger } from '../../utils/Logger';
import { TestData } from '../../utils/TestData';

/**
 * FluentLoginPage
 * ---------------
 * Entry point chính cho Fluent Interface liên quan tới login.
 *
 * Ví dụ sử dụng:
 *
 * const fluentLogin = await FluentLoginPage.start(page);
 *
 * await fluentLogin
 *   .form()
 *   .withUsername(TestData.VALID_USERNAME)
 *   .withPassword(TestData.VALID_PASSWORD)
 *   .submit()
 *   .expectSuccess();
 */
export class FluentLoginPage extends FluentComponentBase {
  readonly loginPage: LoginPage;

  private constructor(page: Page, loginPage: LoginPage) {
    super(page);
    this.loginPage = loginPage;
  }

  /**
   * Khởi tạo FluentLoginPage và điều hướng tới trang login.
   */
  static async start(page: Page): Promise<FluentLoginPage> {
    const loginPage = new LoginPage(page);
    Logger.info('Fluent: Navigating to login page');
    await loginPage.navigateToLogin();
    Logger.info('Fluent: Navigated to login page');
    return new FluentLoginPage(page, loginPage);
  }

  /**
   * Trả về fluent component đại diện cho form login.
   * Component này chịu trách nhiệm build các bước nhập liệu.
   */
  form(): LoginFormComponent {
    return new LoginFormComponent(this.loginPage);
  }

  /**
   * Trả về fluent component chuyên xử lý assert sau login.
   * Có thể dùng trực tiếp cho các scenario như đã authenticated sẵn.
   */
  assertions(): LoginAssertions {
    return new LoginAssertions(this.loginPage);
  }

  /**
   * Hỗ trợ scenario dùng authenticatedPage fixture (TC006).
   */
  static async fromAuthenticatedPage(page: Page): Promise<FluentLoginPage> {
    Logger.info('Fluent: Using existing authenticated page');
    // Ở đây giả định fixture đã login xong và đang ở dashboard.
    const loginPage = new LoginPage(page);
    return new FluentLoginPage(page, loginPage);
  }
}

