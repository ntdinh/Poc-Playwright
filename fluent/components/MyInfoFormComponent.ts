import { MyInfoPage } from '../../pages/MyInfoPage';
import { FluentComponentBase } from '../common/FluentComponentBase';

type Step = () => Promise<void>;

/**
 * MyInfoFormComponent (Fluent)
 * ---------------------------
 * Represents the user info update form using the Fluent Interface pattern.
 * Instead of executing actions immediately, steps are queued
 * and executed sequentially when `save()` is called.
 */
export class MyInfoFormComponent extends FluentComponentBase {
  private readonly myInfoPage: MyInfoPage;
  private readonly steps: Step[] = [];

  constructor(myInfoPage: MyInfoPage) {
    super(myInfoPage.page);
    this.myInfoPage = myInfoPage;
  }

  /**
   * Sets the First Name.
   */
  withFirstName(firstName: string): this {
    this.steps.push(() => this.myInfoPage.updateFirstName(firstName));
    return this;
  }

  /**
   * Sets the Middle Name.
   */
  withMiddleName(middleName: string): this {
    this.steps.push(() => this.myInfoPage.updateMiddleName(middleName));
    return this;
  }

  /**
   * Sets the Last Name.
   */
  withLastName(lastName: string): this {
    this.steps.push(() => this.myInfoPage.updateLastName(lastName));
    return this;
  }

  /**
   * Sets the full name (First, Middle, Last) at once.
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
   * Executes all queued steps and saves the information.
   * This is the final method in the fluent chain.
   */
  async save(): Promise<void> {
    for (const step of this.steps) {
      await step();
    }
    await this.myInfoPage.saveInformation();
  }
}
