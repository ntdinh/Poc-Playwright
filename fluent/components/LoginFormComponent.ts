import { LoginPage } from '../../pages/LoginPage';
import { FluentComponentBase } from '../common/FluentComponentBase';

type Step = () => Promise<void>;

/**
 * LoginFormComponent (Fluent)
 * ---------------------------
 * Đại diện cho form login ở dạng Fluent Interface.
 * Thay vì gọi hành động ngay lập tức, các bước sẽ được "xếp hàng"
 * và thực thi tuần tự khi gọi `submit()`.
 */
export class LoginFormComponent extends FluentComponentBase {
  private readonly loginPage: LoginPage;
  private readonly steps: Step[] = [];

  constructor(loginPage: LoginPage) {
    super(loginPage.page);
    this.loginPage = loginPage;
  }

  /**
   * Thiết lập username cho lần submit.
   */
  withUsername(username: string): this {
    this.steps.push(() => this.loginPage.enterUsername(username));
    return this;
  }

  /**
   * Thiết lập password cho lần submit.
   */
  withPassword(password: string): this {
    this.steps.push(() => this.loginPage.enterPassword(password));
    return this;
  }

  /**
   * Click nút "Forgot password".
   * Vẫn là style fluent nên trả về chính component.
   */
  clickForgotPassword(): this {
    this.steps.push(() => this.loginPage.clickForgotPassword());
    return this;
  }

  /**
   * Thực thi toàn bộ steps đã "build".
   * Chỉ thực hiện việc nhập liệu, không submit form.
   */
  async perform(): Promise<void> {
    for (const step of this.steps) {
      await step();
    }
  }

  /**
   * Submit form login bằng cách click nút Login.
   * Nên gọi sau khi đã nhập xong username/password.
   */
  async submit(): Promise<void> {
    await this.perform();
    await this.loginPage.clickLoginButton();
  }
}

