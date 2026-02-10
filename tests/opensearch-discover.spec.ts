import { test, expect } from '@playwright/test';
import { Logger } from '../utils/Logger';

/**
 * Test Suite: OpenSearch Discover Dashboard
 *
 * Test case demonstrating navigation and interaction with OpenSearch Dashboard.
 * Uses Playwright's built-in locators (getByRole, getByLabel) for accessibility.
 */
test.describe('OpenSearch Dashboard Tests', () => {
  /**
   * Test Case 1: Navigate to Discover page and set time range
   *
   * Steps:
   * 1. Navigate to OpenSearch home
   * 2. Dismiss welcome banner
   * 3. Toggle primary navigation
   * 4. Click on Discover link
   * 5. Open date quick select
   * 6. Set time value to 1
   * 7. Select "months" as time unit
   * 8. Apply the time range
   */
  test('@smoke @opensearch TC001: Should navigate to Discover and set time range to 1 month', async ({ page }) => {
    // Step 1: Navigate to OpenSearch home
    Logger.step(1, 'Navigating to OpenSearch Dashboard');
    await page.goto('https://playground.opensearch.org/app/home');
    Logger.info('Navigated to OpenSearch Dashboard');

    // Step 2: Dismiss welcome banner if present
    Logger.step(2, 'Dismissing welcome banner');
    const dismissButton = page.getByRole('button', { name: 'Dismiss' });
    try {
      await dismissButton.click({ timeout: 5000 });
      Logger.info('Dismissed welcome banner');
    } catch (error) {
      Logger.warn('Dismiss button not found or not clickable - continuing');
    }

    // Step 3: Toggle primary navigation
    Logger.step(3, 'Toggling primary navigation');
    const toggleNavButton = page.getByRole('button', { name: 'Toggle primary navigation' });
    await toggleNavButton.click();
    Logger.info('Toggled primary navigation');

    // Step 4: Click on Discover link
    Logger.step(4, 'Navigating to Discover page');
    const discoverLink = page.getByRole('link', { name: 'Discover' });
    await discoverLink.click();
    Logger.info('Clicked on Discover link');

    // Wait for Discover page to load
    await page.waitForLoadState('networkidle');

    // Step 5: Open date quick select
    Logger.step(5, 'Opening date quick select');
    const dateQuickSelectButton = page.getByRole('button', { name: 'Date quick select' });
    await dateQuickSelectButton.click();
    Logger.info('Opened date quick select');

    // Step 6: Set time value to 1
    Logger.step(6, 'Setting time value to 1');
    const timeValueSpinner = page.getByRole('spinbutton', { name: 'Time value' });
    await timeValueSpinner.fill('2');
    Logger.info('Set time value to 1');

    // Step 7: Select "months" as time unit
    Logger.step(7, 'Selecting "months" as time unit');
    const timeUnitLabel = page.getByLabel('Time unit');
    await timeUnitLabel.selectOption('months');
    Logger.info('Selected "months" as time unit');

    // Step 8: Apply the time range
    Logger.step(8, 'Applying time range');
    const applyButton = page.getByRole('button', { name: 'Apply' });
    await applyButton.click();
    Logger.info('Applied time range');

    // Verify: Download as CSV button should be visible after applying time range
    Logger.info('Verifying Download as CSV button is displayed');
    const downloadCsvButton = page.getByRole('button', { name: 'Download as CSV' });
    await expect(downloadCsvButton).toBeVisible();
    Logger.info('Test passed - Download as CSV button is visible');
  });
});
