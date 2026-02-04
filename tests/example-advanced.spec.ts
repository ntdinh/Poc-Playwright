import { test, expect } from '../fixtures';
import { Logger } from '../utils/Logger';
import { APIHelper } from '../utils';
import { TestData } from '../utils/TestData';
import { Button, Input } from '../components';

/**
 * Example Test Suite - Advanced feature demos.
 *
 * This file showcases how to use:
 * - Custom Fixtures
 * - Component Pattern
 * - API Helpers
 * - Logger
 * - Environment Configuration
 */
test.describe('Advanced Features Demo', () => {
  /**
   * Demo 1: Using authenticatedPage fixture.
   * This fixture automatically logs in before the test starts.
   */
  test('@demo Demo: Using authenticatedPage fixture', async ({ authenticatedPage, page }) => {
    Logger.info('Test started with authenticated page');
    
    // authenticatedPage has already logged in.
    // We can start assertions directly.
    await expect(page).toHaveURL(new RegExp(TestData.DASHBOARD_URL.replace(/\//g, '\\/')));
    
    Logger.info('Successfully authenticated via fixture');
  });

  /**
   * Demo 2: Using Component Pattern.
   */
  test('@demo Demo: Using Component Pattern', async ({ loginPage, page }) => {
    Logger.step(1, 'Navigate to login page');
    await loginPage.navigateToLogin();

    Logger.step(2, 'Create component instances');
    // Use Component Pattern
    const usernameInput = new Input(page, loginPage.usernameInput);
    const passwordInput = new Input(page, loginPage.passwordInput);
    const loginButton = new Button(page, loginPage.loginButton);

    Logger.step(3, 'Interact with components');
    await usernameInput.fill(TestData.VALID_USERNAME);
    await passwordInput.fill(TestData.VALID_PASSWORD);
    
    // Verify button is enabled
    const isEnabled = await loginButton.isEnabled();
    Logger.info(`Login button enabled: ${isEnabled}`);
    
    await loginButton.click();

    Logger.step(4, 'Verify login success');
    await expect(page).toHaveURL(new RegExp(TestData.DASHBOARD_URL.replace(/\//g, '\\/')));
  });

  /**
   * Demo 3: Using API Helper (if backend API is available).
   *
   * Note: Uncomment and adjust according to your real API.
   */
  test.skip('@demo Demo: Using API Helper', async ({ request }) => {
    Logger.info('Demo: API Helper usage');
    
    const api = new APIHelper(request);
    
      // Example: Login via API
    try {
      const token = await api.login();
      Logger.info('API login successful');
      
      // Example: Get data with authentication
      const headers = await api.getAuthHeaders(token);
      const response = await api.get('/users', headers);
      
      Logger.info(`API response status: ${response.status()}`);
    } catch (error) {
      Logger.warn('API Helper demo skipped - API may not be available');
    }
  });

  /**
   * Demo 4: Using Logger with different log levels.
   */
  test('@demo Demo: Using Logger', async ({ loginPage, page }) => {
    Logger.debug('Debug message - detailed information');
    Logger.info('Info message - general information');
    Logger.warn('Warn message - warning information');
    
    await loginPage.navigateToLogin();
    
    Logger.step(1, 'Step 1: Navigate completed');
    Logger.step(2, 'Step 2: Ready to interact');
    
    await loginPage.login(TestData.VALID_USERNAME, TestData.VALID_PASSWORD);
    
    Logger.step(3, 'Step 3: Login completed');
    await expect(page).toHaveURL(new RegExp(TestData.DASHBOARD_URL.replace(/\//g, '\\/')));
    
    Logger.info('Test completed successfully');
  });

  /**
   * Demo 5: Test with multiple assertions and better error handling.
   */
  test('@demo Demo: Better error handling and assertions', async ({ loginPage, page }) => {
    await loginPage.navigateToLogin();

    // Verify page loaded correctly
    const title = await loginPage.getTitle();
    Logger.info(`Page title: ${title}`);
    expect(title).toBeTruthy();

    // Verify elements are visible
    const isUsernameVisible = await loginPage.isVisible(loginPage.usernameInput);
    const isPasswordVisible = await loginPage.isVisible(loginPage.passwordInput);
    const isButtonVisible = await loginPage.isVisible(loginPage.loginButton);

    Logger.info(`Username input visible: ${isUsernameVisible}`);
    Logger.info(`Password input visible: ${isPasswordVisible}`);
    Logger.info(`Login button visible: ${isButtonVisible}`);

    expect(isUsernameVisible).toBe(true);
    expect(isPasswordVisible).toBe(true);
    expect(isButtonVisible).toBe(true);

    // Perform login
    await loginPage.login(TestData.VALID_USERNAME, TestData.VALID_PASSWORD);

    // Verify login success
    await loginPage.verifyDashboardRedirect();
    Logger.info('All assertions passed');
  });
});
