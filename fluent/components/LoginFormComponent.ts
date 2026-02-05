import { LoginPage } from '../../pages/LoginPage';
import { FluentComponentBase } from '../common/FluentComponentBase';

type Step = () => Promise<void>;

/**
 * LoginFormComponent (Fluent)
 * ---------------------------
 * Represents the login form using the Fluent Interface pattern.
 * Instead of executing actions immediately, steps are queued
 * and executed sequentially when `submit()` is called.
 */
export class LoginFormComponent extends FluentComponentBase {
  private readonly loginPage: LoginPage;
  private readonly steps: Step[] = [];

  constructor(loginPage: LoginPage) {
    super(loginPage.page);
    this.loginPage = loginPage;
  }

  /**
   * Sets the username for the current submit.
   */
  withUsername(username: string): this {
    this.steps.push(() => this.loginPage.enterUsername(username));
    return this;
  }

  /**
   * Sets the password for the current submit.
   */
  withPassword(password: string): this {
    this.steps.push(() => this.loginPage.enterPassword(password));
    return this;
  }

  /**
   * Clicks the "Forgot password" button.
   * Still uses fluent style, so returns this component.
   */
  clickForgotPassword(): this {
    this.steps.push(() => this.loginPage.clickForgotPassword());
    return this;
  }

  /**
   * Executes all queued steps.
   * Only performs data entry, does not submit the form.
   */
  async perform(): Promise<void> {
    for (const step of this.steps) {
      await step();
    }
  }

  /**
   * Submits the login form by clicking the Login button.
   * Should be called after username/password have been entered.
   */
  async submit(): Promise<void> {
    await this.perform();
    await this.loginPage.clickLoginButton();
  }
}

