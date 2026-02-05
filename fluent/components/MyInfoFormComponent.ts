import { MyInfoPage } from '../../pages/MyInfoPage';
import { FluentComponentBase } from '../common/FluentComponentBase';

type Step = () => Promise<void>;

/**
 * MyInfoFormComponent (Fluent)
 * ---------------------------
 * Đại diện cho form update user info ở dạng Fluent Interface.
 * Thay vì gọi hành động ngay lập tức, các bước sẽ được "xếp hàng"
 * và thực thi tuần tự khi gọi `save()`.
 */
export class MyInfoFormComponent extends FluentComponentBase {
  private readonly myInfoPage: MyInfoPage;
  private readonly steps: Step[] = [];

  constructor(myInfoPage: MyInfoPage) {
    super(myInfoPage.page);
    this.myInfoPage = myInfoPage;
  }

  /**
   * Thiết lập First Name.
   */
  withFirstName(firstName: string): this {
    this.steps.push(() => this.myInfoPage.updateFirstName(firstName));
    return this;
  }

  /**
   * Thiết lập Middle Name.
   */
  withMiddleName(middleName: string): this {
    this.steps.push(() => this.myInfoPage.updateMiddleName(middleName));
    return this;
  }

  /**
   * Thiết lập Last Name.
   */
  withLastName(lastName: string): this {
    this.steps.push(() => this.myInfoPage.updateLastName(lastName));
    return this;
  }

  /**
   * Thiết lập Full Name (First, Middle, Last) cùng lúc.
   */
  withFullName(firstName: string, middleName: string, lastName: string): this {
    this.steps.push(async () => {
      await this.myInfoPage.updateFirstName(firstName);
      await this.myInfoPage.updateMiddleName(middleName);
      await this.myInfoPage.updateLastName(lastName);
    });
    return this;
  }

  /**
   * Thực thi toàn bộ steps đã "build" và save thông tin.
   * Đây là method cuối cùng trong chuỗi fluent chain.
   */
  async save(): Promise<void> {
    for (const step of this.steps) {
      await step();
    }
    await this.myInfoPage.saveInformation();
  }
}
