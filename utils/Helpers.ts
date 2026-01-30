import { Page } from '@playwright/test';

/**
 * Helpers - Utility helper functions for testing.
 */
export class Helpers {
  /**
   * Generate a random string.
   * @param length - String length.
   * @returns Random string.
   */
  static generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a random email address.
   * @returns Random email.
   */
  static generateRandomEmail(): string {
    return `test_${this.generateRandomString(8)}@example.com`;
  }

  /**
   * Wait for a given amount of time (delay).
   * @param ms - Milliseconds to wait.
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the current timestamp as a string.
   * @returns Timestamp string.
   */
  static getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  /**
   * Check if a URL is valid.
   * @param url - URL to validate.
   * @returns true if URL is valid.
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait until a condition is met, polling at a given interval.
   * @param condition - Function returning boolean (or Promise<boolean>).
   * @param timeout - Max timeout (ms).
   * @param interval - Polling interval (ms).
   */
  static async waitForCondition(
    condition: () => Promise<boolean> | boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await this.delay(interval);
    }
    return false;
  }
}
