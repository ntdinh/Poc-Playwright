import { Page } from '@playwright/test';
import { MyInfoPage } from '../../pages/MyInfoPage';
import { MyInfoFormComponent } from '../components/MyInfoFormComponent';
import { MyInfoAssertions } from '../components/MyInfoAssertions';
import { FluentComponentBase } from '../common/FluentComponentBase';
import { Logger } from '../../utils/Logger';

/**
 * FluentMyInfoPage
 * ---------------
 * Main entry point for the Fluent Interface related to My Info (update user profile).
 *
 * Example usage:
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
   * Initializes `FluentMyInfoPage` from an already authenticated page.
   * Assumes the user is logged in and currently on the dashboard.
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
   * Returns the fluent component representing the user info update form.
   * This component is responsible for building the data entry steps.
   */
  form(): MyInfoFormComponent {
    return new MyInfoFormComponent(this.myInfoPage);
  }

  /**
   * Returns the fluent component responsible for assertions after saving.
   */
  assertions(): MyInfoAssertions {
    return new MyInfoAssertions(this.myInfoPage);
  }

  /**
   * Supports scenarios that use the `authenticatedPage` fixture.
   */
  static async fromAuthenticatedPage(page: Page): Promise<FluentMyInfoPage> {
    Logger.info('Fluent: Using existing authenticated page for My Info');
    const myInfoPage = new MyInfoPage(page);
    return new FluentMyInfoPage(page, myInfoPage);
  }
}
