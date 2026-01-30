import { getCredentials } from '../config/environment';

/**
 * TestData - Centralized test data used across test cases.
 * Integrated with environment configuration.
 */
export class TestData {
  // Test credentials - Read from environment config
  static get VALID_USERNAME(): string {
    return getCredentials('admin').username;
  }

  static get VALID_PASSWORD(): string {
    return getCredentials('admin').password;
  }

  static get VALID_USER_USERNAME(): string {
    return getCredentials('user').username;
  }

  static get VALID_USER_PASSWORD(): string {
    return getCredentials('user').password;
  }

  // Invalid credentials
  static readonly INVALID_USERNAME = 'invalid@example.com';
  static readonly INVALID_PASSWORD = 'wrongpassword';
  static readonly EMPTY_STRING = '';

  // URLs
  // LOGIN_URL is an empty string because baseURL in playwright.config.ts is already the login page
  static readonly LOGIN_URL = '';
  static readonly DASHBOARD_URL = '/web/index.php/dashboard/index';
  static readonly HOME_URL = '/';

  // Expected messages
  static readonly ERROR_INVALID_CREDENTIALS = 'Invalid credentials';
  static readonly ERROR_EMPTY_FIELDS = 'Please fill in all fields';
  static readonly SUCCESS_LOGIN_MESSAGE = 'Login successful';
  static readonly TEXT_REQUIRED_FIELD = 'Required';
  static readonly SUCCESS_UPDATED_MESSAGE = 'Successfully Updated';

  // Test data for My Info page
  static readonly NEW_FIRST_NAME = 'New First Name';
  static readonly NEW_MIDDLE_NAME = 'New Middle Name';
  static readonly NEW_LAST_NAME = 'New Last Name';

  // Test data generators
  static generateRandomEmail(): string {
    const timestamp = Date.now();
    return `test_${timestamp}@example.com`;
  }

  static generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
