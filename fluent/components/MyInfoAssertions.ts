import { expect } from '@playwright/test';
import { MyInfoPage } from '../../pages/MyInfoPage';
import { FluentComponentBase } from '../common/FluentComponentBase';
import { Logger } from '../../utils/Logger';
import { TestData } from '../../utils/TestData';

/**
 * MyInfoAssertions (Fluent)
 * ------------------------
 * Gom nhóm các bước kiểm tra sau khi save user information.
 * Dùng kèm với `MyInfoFormComponent` để tạo nên fluent API:
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
   * Kỳ vọng save thành công và hiển thị success message.
   */
  async expectSuccess(): Promise<void> {
    Logger.step(3, 'Fluent: Verifying success message after update');
    await this.myInfoPage.verifySuccessMessage();

    const successMessage = await this.myInfoPage.getSuccessMessage();
    expect(successMessage).toContain(TestData.SUCCESS_UPDATED_MESSAGE);
    Logger.info('Fluent: User information updated successfully');
  }

  /**
   * Kỳ vọng success message visible.
   * Sử dụng expect trực tiếp từ Playwright.
   */
  async expectSuccessMessageVisible(): Promise<void> {
    Logger.info('Fluent: Verifying success message is visible');
    await expect(this.myInfoPage.successMessage).toBeVisible();
    await expect(this.myInfoPage.successMessage).toHaveText(TestData.SUCCESS_UPDATED_MESSAGE);
  }
}
