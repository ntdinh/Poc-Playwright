import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { BasePage } from '../pages/BasePage';
import { getCredentials } from '../config/environment';

/**
 * Custom Fixtures - Define custom Playwright fixtures.
 *
 * Fixtures help with:
 * - Dependency injection for pages
 * - Shared setup/teardown logic
 * - Reusable test context
 * - Better type safety
 */

// Define fixture types
export type TestFixtures = {
  loginPage: LoginPage;
  authenticatedPage: BasePage;
  adminPage: BasePage;
  userPage: BasePage;
};

// Extend base test with custom fixtures
export const test = base.extend<TestFixtures>({
  /**
   * Fixture: loginPage
   * Automatically instantiate LoginPage for each test.
   */
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  /**
   * Fixture: authenticatedPage
   * Automatically logs in before the test runs.
   * Useful for tests that require an authenticated session.
   *
   * Note: All tests using this fixture will automatically navigate to
   * the login page (https://opensource-demo.orangehrmlive.com) and log in.
   */
  authenticatedPage: async ({ page, loginPage }, use) => {
    // Navigate to login page (baseURL is already the login page)
    await loginPage.navigateToLogin();
    
    // Login with credentials from environment config
    const credentials = getCredentials('admin');
    await loginPage.login(credentials.username, credentials.password);
    
    // Wait for login to finish and redirect to dashboard
    await page.waitForLoadState('networkidle');
    
    // Verify login succeeded
    await page.waitForURL(/.*dashboard\/index.*/, { timeout: 10000 });
    
    // Create BasePage instance to return
    const authenticatedPage = new BasePage(page);
    await use(authenticatedPage);
  },

  /**
   * Fixture: adminPage
   * Tương tự authenticatedPage nhưng rõ nghĩa là role admin.
   */
  adminPage: async ({ page, loginPage }, use) => {
    const credentials = getCredentials('admin');
    await loginPage.navigateToLogin();
    await loginPage.login(credentials.username, credentials.password);
    await page.waitForLoadState('networkidle');
    await page.waitForURL(/.*dashboard\/index.*/, { timeout: 10000 });

    const adminPage = new BasePage(page);
    await use(adminPage);
  },

  /**
   * Fixture: userPage
   * Đăng nhập với role user (non-admin).
   */
  userPage: async ({ page, loginPage }, use) => {
    const credentials = getCredentials('user');
    await loginPage.navigateToLogin();
    await loginPage.login(credentials.username, credentials.password);
    await page.waitForLoadState('networkidle');

    const userPage = new BasePage(page);
    await use(userPage);
  },
});

// Re-export expect from Playwright for tests
export { expect } from '@playwright/test';
