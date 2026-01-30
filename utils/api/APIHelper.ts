import { APIRequestContext, APIResponse } from '@playwright/test';
import { getAPIURL, getCredentials } from '../../config/environment';

/**
 * APIHelper - Helper for performing API calls in tests.
 * Useful for:
 * - Setting up test data
 * - Cleaning up test data
 * - Verifying backend state
 * - Bypassing UI for faster tests
 */
export class APIHelper {
  private request: APIRequestContext;
  private baseURL: string;

  constructor(request: APIRequestContext) {
    this.request = request;
    this.baseURL = getAPIURL();
  }

  /**
   * Perform a GET request.
   */
  async get(endpoint: string, headers?: Record<string, string>): Promise<APIResponse> {
    return await this.request.get(`${this.baseURL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }

  /**
   * Perform a POST request.
   */
  async post(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<APIResponse> {
    return await this.request.post(`${this.baseURL}${endpoint}`, {
      data,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }

  /**
   * Perform a PUT request.
   */
  async put(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<APIResponse> {
    return await this.request.put(`${this.baseURL}${endpoint}`, {
      data,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }

  /**
   * Perform a DELETE request.
   */
  async delete(endpoint: string, headers?: Record<string, string>): Promise<APIResponse> {
    return await this.request.delete(`${this.baseURL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }

  /**
   * Login via API and return the auth token.
   */
  async login(username?: string, password?: string): Promise<string> {
    const credentials = getCredentials('admin');
    const response = await this.post('/auth/login', {
      username: username || credentials.username,
      password: password || credentials.password,
    });

    if (!response.ok()) {
      throw new Error(`Login failed: ${response.status()}`);
    }

    const data = await response.json();
    return data.token || data.accessToken || '';
  }

  /**
   * Build authentication headers using a token.
   */
  async getAuthHeaders(token?: string): Promise<Record<string, string>> {
    const authToken = token || (await this.login());
    return {
      Authorization: `Bearer ${authToken}`,
    };
  }
}
