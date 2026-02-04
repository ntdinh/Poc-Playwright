import { test, expect } from '../fixtures';
import { MyInfoPage } from '../pages/MyInfoPage';
import { TestData } from '../utils/TestData';
import { Logger } from '../utils/Logger';

/**
 * Test Suite: Update User Information
 *
 * Test cases for updating user profile (First Name, Middle Name, Last Name)
 * using the authenticatedPage fixture for automatic login.
 */
test.describe('Update User Information Tests', () => {
  /**
   * Test Case: Successfully update user information.
   *
   * Steps:
   * 1. Login (via authenticatedPage fixture)
   * 2. Click the \"My Info\" link
   * 3. Update First Name
   * 4. Update Middle Name
   * 5. Update Last Name
   * 6. Click Save
   * 7. Verify \"Successfully Updated\" message is visible
   */
  test('@regression TC001: Should update user information successfully', async ({ authenticatedPage, page }) => {
    // Arrange: authenticatedPage fixture has already logged in
    Logger.info('Test started - User is already authenticated');
    
    // Initialize MyInfoPage
    const myInfoPage = new MyInfoPage(page);
    
    // Act: Perform profile update steps
    Logger.step(1, 'Navigate to My Info page');
    await myInfoPage.navigateToMyInfo();
    
    Logger.step(2, 'Update First Name');
    await myInfoPage.updateFirstName(TestData.NEW_FIRST_NAME);
    
    Logger.step(3, 'Update Middle Name');
    await myInfoPage.updateMiddleName(TestData.NEW_MIDDLE_NAME);
    
    Logger.step(4, 'Update Last Name');
    await myInfoPage.updateLastName(TestData.NEW_LAST_NAME);
    
    Logger.step(5, 'Click Save button');
    await myInfoPage.saveInformation();
    
    // Assert: Verify success message
    Logger.step(6, 'Verify success message');
    await myInfoPage.verifySuccessMessage();
    
    const successMessage = await myInfoPage.getSuccessMessage();
    expect(successMessage).toContain(TestData.SUCCESS_UPDATED_MESSAGE);
    
    Logger.info('User information updated successfully');
  });

  /**
   * Test Case: Update user information using updateFullName method.
   *
   * Demonstrates using updateFullName to update all name fields at once.
   */
  test('@regression TC002: Should update full name using updateFullName method', async ({ authenticatedPage, page }) => {
    Logger.info('Test started - Using updateFullName method');
    
    const myInfoPage = new MyInfoPage(page);
    
    Logger.step(1, 'Navigate to My Info page');
    await myInfoPage.navigateToMyInfo();
    
    Logger.step(2, 'Update full name (First, Middle, Last)');
    await myInfoPage.updateFullName(
      TestData.NEW_FIRST_NAME,
      TestData.NEW_MIDDLE_NAME,
      TestData.NEW_LAST_NAME
    );
    
    Logger.step(3, 'Save information');
    await myInfoPage.saveInformation();
    
    Logger.step(4, 'Verify success message');
    await expect(myInfoPage.successMessage).toBeVisible();
    await expect(myInfoPage.successMessage).toHaveText(TestData.SUCCESS_UPDATED_MESSAGE);
    
    Logger.info('Full name updated successfully using updateFullName method');
  });
});
