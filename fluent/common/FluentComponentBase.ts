import { Page } from '@playwright/test';

/**
 * FluentComponentBase
 * -------------------
 * Base class cho tất cả fluent components/pages.
 * Đóng gói `Page` và sử dụng polymorphic `this` type cho fluent interface.
 */
export abstract class FluentComponentBase {
  protected readonly page: Page;

  protected constructor(page: Page) {
    this.page = page;
  }
}

