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
 * Main entry point for the Fluent Interface related to login.
 *
 * Example usage:
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
   * Initializes `FluentLoginPage` and navigates to the login page.
   */
  static async start(page: Page): Promise<FluentLoginPage> {
    const loginPage = new LoginPage(page);
    Logger.info('Fluent: Navigating to login page');
    await loginPage.navigateToLogin();
    Logger.info('Fluent: Navigated to login page');
    return new FluentLoginPage(page, loginPage);
  }

  /**
   * Returns the fluent component representing the login form.
   * This component is responsible for building the data entry steps.
   */
  form(): LoginFormComponent {
    return new LoginFormComponent(this.loginPage);
  }

  /**
   * Returns the fluent component responsible for assertions after login.
   * Can be used directly for scenarios where the user is already authenticated.
   */
  assertions(): LoginAssertions {
    return new LoginAssertions(this.loginPage);
  }

  /**
   * Supports scenarios that use the `authenticatedPage` fixture (TC006).
   */
  static async fromAuthenticatedPage(page: Page): Promise<FluentLoginPage> {
    Logger.info('Fluent: Using existing authenticated page');
    // Assumes the fixture has already logged in and is on the dashboard.
    const loginPage = new LoginPage(page);
    return new FluentLoginPage(page, loginPage);
  }
}

