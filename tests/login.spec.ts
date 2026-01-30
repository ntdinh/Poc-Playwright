import { test, expect } from '../fixtures';
import { TestData } from '../utils/TestData';
import { Logger } from '../utils/Logger';

/**
 * Test Suite: Login Functionality
 *
 * Sample test cases demonstrating how to use:
 * - Page Object Model (POM)
 * - Custom Fixtures
 * - Component Pattern
 * in Playwright testing.
 */
test.describe('Login Tests', () => {
  test.beforeEach(async ({ loginPage }) => {
    // Fixture automatically creates a LoginPage instance.
    // Navigate to the login page.
    await loginPage.navigateToLogin();
    Logger.info('Navigated to login page');
  });

  /**
   * Test Case 1: Successful login with valid credentials.
   *
   * Goal: Verify login works correctly with valid credentials.
   *
   * Steps:
   * 1. Navigate to the login page.
   * 2. Enter a valid username.
   * 3. Enter a valid password.
   * 4. Click the Login button.
   * 5. Verify successful login via redirect or visible element.
   */
  test('TC001: Should login successfully with valid credentials', async ({ loginPage, page }) => {
    // Arrange: Prepare test data
    const username = TestData.VALID_USERNAME;
    const password = TestData.VALID_PASSWORD;
    Logger.step(1, 'Prepared test data');

    // Act: Perform login
    Logger.step(2, 'Performing login');
    await loginPage.login(username, password);

    // Assert: Verify result
    Logger.step(3, 'Verifying login success');
    await loginPage.verifyDashboardRedirect();
    Logger.info('Login successful - redirected to dashboard');
  });

  /**
   * Test Case 2: Failed login with invalid username.
   *
   * Goal: Verify error message is shown when username is invalid.
   */
  test('TC002: Should show error message with invalid username', async ({ loginPage }) => {
    // Arrange
    const invalidUsername = TestData.INVALID_USERNAME;
    const password = TestData.VALID_PASSWORD;
    Logger.step(1, 'Prepared invalid credentials');

    // Act
    Logger.step(2, 'Attempting login with invalid username');
    await loginPage.login(invalidUsername, password);

    // Assert: Verify error message is displayed
    Logger.step(3, 'Verifying error message');
    // Wait a bit for the error message to appear after clicking login
    await loginPage.waitForLoadState('networkidle');
    
    // Try multiple strategies to verify the error message
    try {
      // Approach 1: Wait for error message using the primary selector
      await loginPage.waitForElement(loginPage.errorMessage, 10000);
      await expect(loginPage.errorMessage).toBeVisible({ timeout: 10000 });
    } catch (error) {
      Logger.warn('Primary error message selector not found, trying alternative methods');
      // Approach 2: Try to find the error message using alternative selectors
      const altErrorLocator = loginPage.page.locator('.oxd-alert-content-text, .oxd-alert, [role="alert"]')
        .filter({ hasText: /Invalid|credentials|incorrect|wrong/i })
        .first();
      
      await expect(altErrorLocator).toBeVisible({ timeout: 10000 });
    }
    
    const errorText = await loginPage.getErrorMessage();
    expect(errorText).toBeTruthy();
    Logger.info(`Error message displayed: ${errorText}`);
  });

  /**
   * Test Case 3: Failed login with invalid password.
   *
   * Goal: Verify error message is shown when password is invalid.
   */
  test('TC003: Should show error message with invalid password', async ({ loginPage }) => {
    // Arrange
    const username = TestData.VALID_USERNAME;
    const invalidPassword = TestData.INVALID_PASSWORD;
    Logger.step(1, 'Prepared invalid password');

    // Act
    Logger.step(2, 'Attempting login with invalid password');
    await loginPage.login(username, invalidPassword);

    // Assert: Verify error message is displayed
    Logger.step(3, 'Verifying error message');
    // Wait for the error message with a longer timeout
    await loginPage.waitForElement(loginPage.errorMessage, 10000);
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 10000 });
    const errorText = await loginPage.getErrorMessage();
    expect(errorText).toBeTruthy();
    Logger.info(`Error message displayed: ${errorText}`);
  });

  /**
   * Test Case 4: Failed login when username is empty.
   *
   * Goal: Verify validation shows 'Required' when username is empty.
   */
  test('TC004: Should show error when username is empty', async ({ loginPage }) => {
    // Arrange
    const emptyUsername = TestData.EMPTY_STRING;
    const password = TestData.VALID_PASSWORD;
    Logger.step(1, 'Prepared empty username');

    // Act
    Logger.step(2, 'Attempting login with empty username');
    await loginPage.enterPassword(password);
    await loginPage.clickLoginButton();

    // Assert: Verify 'Required' message is displayed
    Logger.step(3, 'Verifying required field validation');
    await expect(loginPage.requiredFieldMessage).toBeVisible();
    await expect(loginPage.requiredFieldMessage).toHaveText('Required');
    Logger.info('Validation error displayed correctly');
  });

  /**
   * Test Case 5: Failed login when password is empty.
   *
   * Goal: Verify validation shows 'Required' when password is empty.
   */
  test('TC005: Should show error when password is empty', async ({ loginPage }) => {
    // Arrange
    const username = TestData.VALID_USERNAME;
    const emptyPassword = TestData.EMPTY_STRING;
    Logger.step(1, 'Prepared empty password');

    // Act
    Logger.step(2, 'Attempting login with empty password');
    await loginPage.enterUsername(username);
    await loginPage.clickLoginButton();

    // Assert: Verify 'Required' message is displayed
    Logger.step(3, 'Verifying required field validation');
    await expect(loginPage.requiredFieldMessage).toBeVisible();
    await expect(loginPage.requiredFieldMessage).toHaveText('Required');
    Logger.info('Validation error displayed correctly');
  });

  /**
   * Test Case 6: Using authenticatedPage fixture.
   *
   * Goal: Demonstrate how to use the auto-login fixture.
   */
  test('TC006: Should use authenticatedPage fixture', async ({ authenticatedPage, page }) => {
    // authenticatedPage fixture has already logged in.
    // We can start assertions directly in an authenticated state.
    Logger.info('Using authenticated page fixture');
    // Verify we are on the dashboard
    await expect(page).toHaveURL(new RegExp(TestData.DASHBOARD_URL.replace(/\//g, '\\/')));
    Logger.info('Successfully authenticated via fixture');
  });
});
