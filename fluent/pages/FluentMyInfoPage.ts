import { Page } from '@playwright/test';
import { MyInfoPage } from '../../pages/MyInfoPage';
import { MyInfoFormComponent } from '../components/MyInfoFormComponent';
import { MyInfoAssertions } from '../components/MyInfoAssertions';
import { FluentComponentBase } from '../common/FluentComponentBase';
import { Logger } from '../../utils/Logger';

/**
 * FluentMyInfoPage
 * ---------------
 * Entry point chính cho Fluent Interface liên quan tới My Info (update user profile).
 *
 * Ví dụ sử dụng:
 *
 * const fluentMyInfo = await FluentMyInfoPage.start(page);
 *
 * await fluentMyInfo
 *   .form()
 *   .withFirstName('John')
 *   .withMiddleName('William')
 *   .withLastName('Doe')
 *   .save()
 *   .expectSuccess();
 */
export class FluentMyInfoPage extends FluentComponentBase {
  readonly myInfoPage: MyInfoPage;

  private constructor(page: Page, myInfoPage: MyInfoPage) {
    super(page);
    this.myInfoPage = myInfoPage;
  }

  /**
   * Khởi tạo FluentMyInfoPage từ page đã authenticated.
   * Giả định user đã login và đang ở dashboard.
   */
  static async start(page: Page): Promise<FluentMyInfoPage> {
    const myInfoPage = new MyInfoPage(page);
    Logger.info('Fluent: Initializing My Info page from authenticated session');

    // Navigate to My Info page
    Logger.info('Fluent: Navigating to My Info page');
    await myInfoPage.navigateToMyInfo();
    Logger.info('Fluent: Navigated to My Info page');

    return new FluentMyInfoPage(page, myInfoPage);
  }

  /**
   * Trả về fluent component đại diện cho form update user info.
   * Component này chịu trách nhiệm build các bước nhập liệu.
   */
  form(): MyInfoFormComponent {
    return new MyInfoFormComponent(this.myInfoPage);
  }

  /**
   * Trả về fluent component chuyên xử lý assert sau khi save.
   */
  assertions(): MyInfoAssertions {
    return new MyInfoAssertions(this.myInfoPage);
  }

  /**
   * Hỗ trợ scenario dùng authenticatedPage fixture.
   */
  static async fromAuthenticatedPage(page: Page): Promise<FluentMyInfoPage> {
    Logger.info('Fluent: Using existing authenticated page for My Info');
    const myInfoPage = new MyInfoPage(page);
    return new FluentMyInfoPage(page, myInfoPage);
  }
}
