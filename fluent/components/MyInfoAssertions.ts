import { expect } from '@playwright/test';
import { MyInfoPage } from '../../pages/MyInfoPage';
import { FluentComponentBase } from '../common/FluentComponentBase';
import { Logger } from '../../utils/Logger';
import { TestData } from '../../utils/TestData';

/**
 * MyInfoAssertions (Fluent)
 * ------------------------
 * Groups verification steps after saving user information.
 * Used together with `MyInfoFormComponent` to build a fluent API:
 *
 * await fluentMyInfo
 *   .form()
 *   .withFirstName('John')
 *   .withLastName('Doe')
 *   .save()
 *   .expectSuccess();
 */
export class MyInfoAssertions extends FluentComponentBase {
  private readonly myInfoPage: MyInfoPage;

  constructor(myInfoPage: MyInfoPage) {
    super(myInfoPage.page);
    this.myInfoPage = myInfoPage;
  }

  /**
   * Expects saving to succeed and the success message to be displayed.
   */
  async expectSuccess(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying success message after update');
    await this.myInfoPage.verifySuccessMessage();

    const successMessage = await this.myInfoPage.getSuccessMessage();
    expect(successMessage).toContain(TestData.SUCCESS_UPDATED_MESSAGE);
    Logger.info('Fluent: User information updated successfully');
  }

  /**
   * Expects the success message to be visible.
   * Uses Playwright's `expect` directly.
   */
  async expectSuccessMessageVisible(): Promise<void> {
    Logger.info('Fluent: Verifying success message is visible');
    await expect(this.myInfoPage.successMessage).toBeVisible();
    await expect(this.myInfoPage.successMessage).toHaveText(TestData.SUCCESS_UPDATED_MESSAGE);
  }
}
