import { Page } from '@playwright/test';

/**
 * FluentComponentBase
 * -------------------
 * Base class for all fluent components/pages.
 * Encapsulates `Page` and uses the polymorphic `this` type for the fluent interface.
 */
export abstract class FluentComponentBase {
  protected readonly page: Page;

  protected constructor(page: Page) {
    this.page = page;
  }
}

