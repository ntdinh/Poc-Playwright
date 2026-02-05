import { test } from '../fixtures';
import { TestData } from '../utils/TestData';
import { Logger } from '../utils/Logger';
import { FluentMyInfoPage } from '../fluent/pages/FluentMyInfoPage';

/**
 * Test Suite (Fluent): Update User Information
 * -------------------------------------------
 * Cloned from `update-user-info.spec.ts` but using the Fluent Interface pattern
 * through `FluentMyInfoPage`, `MyInfoFormComponent`, and `MyInfoAssertions`.
 */
test.describe('Update User Information Tests (Fluent)', () => {
  /**
   * Test Case 1 (Fluent): Successfully update user information.
   *
   * Steps:
   * 1. Login (via authenticatedPage fixture)
   * 2. Click the "My Info" link
   * 3. Update First Name
   * 4. Update Middle Name
   * 5. Update Last Name
   * 6. Click Save
   * 7. Verify "Successfully Updated" message is visible
   */
  test('@fluent @regression TC001F: Should update user information successfully (fluent)', async ({ authenticatedPage, page }) => {
    // Arrange: authenticatedPage fixture has already logged in
    Logger.info('Test started - User is already authenticated');

    const fluentMyInfo = await FluentMyInfoPage.start(page);

    // Act & Assert: Fluent chain - update all fields and verify success
    await fluentMyInfo
      .form()
      .withFirstName(TestData.NEW_FIRST_NAME)
      .withMiddleName(TestData.NEW_MIDDLE_NAME)
      .withLastName(TestData.NEW_LAST_NAME)
      .save();

    await fluentMyInfo.assertions().expectSuccess();
  });

  /**
   * Test Case 2 (Fluent): Update user information using withFullName method.
   *
   * Demonstrates using withFullName to update all name fields at once.
   */
  test('@fluent @regression TC002F: Should update full name using withFullName method (fluent)', async ({ authenticatedPage, page }) => {
    Logger.info('Test started - Using withFullName method');

    const fluentMyInfo = await FluentMyInfoPage.start(page);

    // Act & Assert: Fluent chain - use withFullName for cleaner code
    await fluentMyInfo
      .form()
      .withFullName(TestData.NEW_FIRST_NAME, TestData.NEW_MIDDLE_NAME, TestData.NEW_LAST_NAME)
      .save();

    await fluentMyInfo.assertions().expectSuccessMessageVisible();

    Logger.info('Full name updated successfully using withFullName method');
  });

  /**
   * Test Case 3 (Fluent): Update only First Name.
   *
   * Demonstrates partial field update.
   */
  test('@fluent @regression TC003F: Should update only first name (fluent)', async ({ authenticatedPage, page }) => {
    Logger.info('Test started - Updating only first name');

    const fluentMyInfo = await FluentMyInfoPage.start(page);

    // Act & Assert: Fluent chain - update only first name
    await fluentMyInfo
      .form()
      .withFirstName(TestData.NEW_FIRST_NAME)
      .save();

    await fluentMyInfo.assertions().expectSuccess();

    Logger.info('First name updated successfully');
  });

  /**
   * Test Case 4 (Fluent): Update only Last Name.
   *
   * Demonstrates partial field update.
   */
  test('@fluent @regression TC004F: Should update only last name (fluent)', async ({ authenticatedPage, page }) => {
    Logger.info('Test started - Updating only last name');

    const fluentMyInfo = await FluentMyInfoPage.start(page);

    // Act & Assert: Fluent chain - update only last name
    await fluentMyInfo
      .form()
      .withLastName(TestData.NEW_LAST_NAME)
      .save();

    await fluentMyInfo.assertions().expectSuccess();

    Logger.info('Last name updated successfully');
  });

  /**
   * Test Case 5 (Fluent): Update First and Last Name (skip Middle).
   *
   * Demonstrates selective field update.
   */
  test('@fluent @regression TC005F: Should update first and last name only (fluent)', async ({ authenticatedPage, page }) => {
    Logger.info('Test started - Updating first and last name only');

    const fluentMyInfo = await FluentMyInfoPage.start(page);

    // Act & Assert: Fluent chain - update first and last name
    await fluentMyInfo
      .form()
      .withFirstName(TestData.NEW_FIRST_NAME)
      .withLastName(TestData.NEW_LAST_NAME)
      .save();

    await fluentMyInfo.assertions().expectSuccess();

    Logger.info('First and last name updated successfully');
  });
});
