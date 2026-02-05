import { test } from '../fixtures';
import { TestData } from '../utils/TestData';
import { Logger } from '../utils/Logger';
import { FluentLoginPage } from '../fluent/pages/FluentLoginPage';

/**
 * Test Suite (Fluent): Login Functionality
 * ---------------------------------------
 * Cloned from `login.spec.ts` but using the Fluent Interface pattern
 * through `FluentLoginPage`, `LoginFormComponent`, and `LoginAssertions`.
 */
test.describe('Login Tests (Fluent)', () => {
  /**
   * Test Case 1 (Fluent): Successful login with valid credentials.
   */
  test('@fluent @smoke @regression TC001F: Should login successfully with valid credentials (fluent)', async ({
    page,
  }) => {
    const fluentLogin = await FluentLoginPage.start(page);

    await fluentLogin
      .form()
      .withUsername(TestData.VALID_USERNAME)
      .withPassword(TestData.VALID_PASSWORD)
      .submit();

    await fluentLogin.assertions().expectSuccess();
  });

  /**
   * Test Case 2 (Fluent): Failed login with invalid username.
   */
  test('@fluent @regression TC002F: Should show error message with invalid username (fluent)', async ({ page }) => {
    const fluentLogin = await FluentLoginPage.start(page);

    await fluentLogin
      .form()
      .withUsername(TestData.INVALID_USERNAME)
      .withPassword(TestData.VALID_PASSWORD)
      .submit();

    await fluentLogin.assertions().expectInvalidCredentialsError();
  });

  /**
   * Test Case 3 (Fluent): Failed login with invalid password.
   */
  test('@fluent @regression TC003F: Should show error message with invalid password (fluent)', async ({ page }) => {
    const fluentLogin = await FluentLoginPage.start(page);

    await fluentLogin
      .form()
      .withUsername(TestData.VALID_USERNAME)
      .withPassword(TestData.INVALID_PASSWORD)
      .submit();

    await fluentLogin.assertions().expectInvalidCredentialsError();
  });

  /**
   * Test Case 4 (Fluent): Failed login when username is empty.
   */
  test('@fluent @regression TC004F: Should show error when username is empty (fluent)', async ({ page }) => {
    const fluentLogin = await FluentLoginPage.start(page);

    await fluentLogin
      .form()
      .withPassword(TestData.VALID_PASSWORD)
      .submit();

    await fluentLogin.assertions().expectUsernameRequiredError();
  });

  /**
   * Test Case 5 (Fluent): Failed login when password is empty.
   */
  test('@fluent @regression TC005F: Should show error when password is empty (fluent)', async ({ page }) => {
    const fluentLogin = await FluentLoginPage.start(page);

    await fluentLogin
      .form()
      .withUsername(TestData.VALID_USERNAME)
      .submit();

    await fluentLogin.assertions().expectPasswordRequiredError();
  });

  /**
   * Test Case 6 (Fluent): Using authenticatedPage fixture.
   */
  // test('@fluent @demo TC006F: Should use authenticatedPage fixture (fluent)', async ({ authenticatedPage }) => {
  //   const fluentLogin = await FluentLoginPage.fromAuthenticatedPage(authenticatedPage);
  //   Logger.info('Fluent: Using authenticated page fixture');

  //   await fluentLogin.assertions().expectOnDashboard();
  // });
});

