import { Page, Route, Request } from '@playwright/test';
import { Logger } from './Logger';

export interface MockResponseOptions {
  status?: number;
  body?: any;
  headers?: Record<string, string>;
  delayMs?: number;
  /**
   * Optional callback để đọc request (ví dụ lưu payload) trước khi fulfill.
   */
  onRequest?: (request: Request) => void | Promise<void>;
}

/**
 * mockApiRoute - Helper generic để mock một API endpoint.
 *
 * Ví dụ:
 * await mockApiRoute(page, /\\/login$/, { status: 500, body: { message: 'Internal Error' } });
 */
export async function mockApiRoute(
  page: Page,
  urlPattern: string | RegExp,
  options: MockResponseOptions
): Promise<void> {
  const {
    status = 200,
    body = {},
    headers = { 'Content-Type': 'application/json' },
    delayMs = 0,
  } = options;

  await page.route(urlPattern, async (route: Route) => {
    const request: Request = route.request();
    Logger.info(`Mocking request ${request.method()} ${request.url()} with status ${status}`);

    if (options.onRequest) {
      await options.onRequest(request);
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    await route.fulfill({
      status,
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });
}

/**
 * NetworkMock - Comprehensive API mocking utilities.
 *
 * Use cases:
 * - Test error handling (500, 404, timeouts)
 * - Test slow networks
 * - Test loading states
 * - Isolate tests from backend changes
 */
export class NetworkMock {
  private page: Page;
  private activeRoutes: RegExp[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Mock GET request with success response.
   */
  async mockGet(urlPattern: string | RegExp, data: any, delayMs = 0): Promise<void> {
    await this.mockApiRoute(urlPattern, {
      method: 'GET',
      status: 200,
      body: data,
      delayMs,
    });
  }

  /**
   * Mock POST request with success response.
   */
  async mockPost(urlPattern: string | RegExp, data: any, delayMs = 0): Promise<void> {
    await this.mockApiRoute(urlPattern, {
      method: 'POST',
      status: 200,
      body: data,
      delayMs,
    });
  }

  /**
   * Mock PUT request with success response.
   */
  async mockPut(urlPattern: string | RegExp, data: any, delayMs = 0): Promise<void> {
    await this.mockApiRoute(urlPattern, {
      method: 'PUT',
      status: 200,
      body: data,
      delayMs,
    });
  }

  /**
   * Mock DELETE request with success response.
   */
  async mockDelete(urlPattern: string | RegExp, delayMs = 0): Promise<void> {
    await this.mockApiRoute(urlPattern, {
      method: 'DELETE',
      status: 204,
      body: null,
      delayMs,
    });
  }

  /**
   * Mock API error response.
   */
  async mockError(
    urlPattern: string | RegExp,
    status: number = 500,
    message?: string
  ): Promise<void> {
    const errorBody = {
      error: true,
      message: message || this.getDefaultErrorMessage(status),
      status,
    };

    await this.mockApiRoute(urlPattern, {
      status,
      body: errorBody,
    });
  }

  /**
   * Mock network timeout (request never completes).
   */
  async mockTimeout(urlPattern: string | RegExp): Promise<void> {
    await this.page.route(urlPattern, async (route) => {
      Logger.info(`Mocking timeout for ${route.request().url()}`);
      // Never fulfill the request - simulates timeout
      // Will fail when Playwright's timeout is reached
    });
    this.activeRoutes.push(urlPattern as RegExp);
  }

  /**
   * Mock slow network response.
   */
  async mockSlowNetwork(urlPattern: string | RegExp, delayMs: number = 5000): Promise<void> {
    await this.page.route(urlPattern, async (route) => {
      Logger.info(`Mocking slow network (${delayMs}ms) for ${route.request().url()}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await route.continue();
    });
    this.activeRoutes.push(urlPattern as RegExp);
  }

  /**
   * Mock failed network (offline mode).
   */
  async mockOffline(urlPattern: string | RegExp): Promise<void> {
    await this.page.route(urlPattern, async (route) => {
      Logger.info(`Mocking offline for ${route.request().url()}`);
      await route.abort('failed');
    });
    this.activeRoutes.push(urlPattern as RegExp);
  }

  /**
   * Mock API response with custom handler.
   */
  async mockCustom(
    urlPattern: string | RegExp,
    handler: (route: Route, request: Request) => Promise<void>
  ): Promise<void> {
    await this.page.route(urlPattern, handler);
    this.activeRoutes.push(urlPattern as RegExp);
  }

  /**
   * Mock authentication endpoints.
   */
  async mockAuth(options: {
    loginSuccess?: boolean;
    loginDelay?: number;
    token?: string;
  }): Promise<void> {
    const { loginSuccess = true, loginDelay = 0, token = 'mock-token-123' } = options;

    await this.mockApiRoute(/\/login/, {
      status: loginSuccess ? 200 : 401,
      body: loginSuccess
        ? { token, user: { id: 1, name: 'Test User' } }
        : { error: 'Invalid credentials' },
      delayMs: loginDelay,
    });

    await this.mockApiRoute(/\/logout/, {
      status: 200,
      body: { success: true },
    });

    await this.mockApiRoute(/\/refresh/, {
      status: 200,
      body: { token: 'refreshed-token-456' },
    });
  }

  /**
   * Mock user profile endpoints.
   */
  async mockUserProfile(userData: any): Promise<void> {
    await this.mockGet(/\/api\/user\/profile$/, userData);
    await this.mockPut(/\/api\/user\/profile$/, { ...userData, success: true });
  }

  /**
   * Mock paginated list response.
   */
  async mockPaginatedList(
    urlPattern: string | RegExp,
    items: any[],
    page: number = 1,
    pageSize: number = 10
  ): Promise<void> {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedItems = items.slice(start, end);

    await this.mockApiRoute(urlPattern, {
      status: 200,
      body: {
        data: paginatedItems,
        pagination: {
          page,
          pageSize,
          total: items.length,
          totalPages: Math.ceil(items.length / pageSize),
        },
      },
    });
  }

  /**
   * Mock file upload response.
   */
  async mockFileUpload(urlPattern: string | RegExp, options: {
    success?: boolean;
    fileUrl?: string;
    delayMs?: number;
  } = {}): Promise<void> {
    const { success = true, fileUrl = 'https://example.com/uploads/file.jpg', delayMs = 0 } = options;

    await this.mockApiRoute(urlPattern, {
      status: success ? 200 : 422,
      body: success
        ? { success: true, fileUrl, message: 'File uploaded successfully' }
        : { error: 'File upload failed' },
      delayMs,
    });
  }

  /**
   * Mock search API with fuzzy matching.
   */
  async mockSearch(urlPattern: string | RegExp, items: any[]): Promise<void> {
    await this.mockApiRoute(urlPattern, {
      status: 200,
      body: {
        data: items,
        total: items.length,
      },
      onRequest: async (request) => {
        const url = request.url();
        const urlObj = new URL(url);
        const query = urlObj.searchParams.get('q');
        Logger.info(`Search query: ${query}`);
      },
    });
  }

  /**
   * Mock API rate limiting (429 Too Many Requests).
   */
  async mockRateLimit(urlPattern: string | RegExp, retryAfter: number = 60): Promise<void> {
    await this.mockApiRoute(urlPattern, {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
      body: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter,
      },
    });
  }

  /**
   * Mock multiple scenarios for the same endpoint (e.g., first call fails, second succeeds).
   */
  async mockSequential(
    urlPattern: string | RegExp,
    responses: Array<{ status: number; body?: any }>
  ): Promise<void> {
    let callCount = 0;

    await this.page.route(urlPattern, async (route) => {
      const response = responses[Math.min(callCount, responses.length - 1)];
      callCount++;

      Logger.info(
        `Sequential mock call #${callCount} for ${route.request().url()} - status ${response.status}`
      );

      await route.fulfill({
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: response.body ? JSON.stringify(response.body) : undefined,
      });
    });

    this.activeRoutes.push(urlPattern as RegExp);
  }

  /**
   * Intercept and log all API calls without modifying them.
   * Useful for debugging and understanding API traffic.
   */
  async interceptAndLog(urlPattern?: string | RegExp): Promise<Map<string, Request[]>> {
    const requests = new Map<string, Request[]>();

    const pattern = urlPattern || '**/*';

    await this.page.route(pattern, async (route) => {
      const request = route.request();
      const url = request.url();
      const method = request.method();

      if (!requests.has(url)) {
        requests.set(url, []);
      }
      requests.get(url)!.push(request);

      Logger.info(`API Call: ${method} ${url}`);

      // Log request body for POST/PUT
      if (method === 'POST' || method === 'PUT') {
        try {
          const postData = request.postData();
          if (postData) {
            Logger.debug(`Request body: ${postData}`);
          }
        } catch {
          // Cannot read post data (might be binary or streamed)
        }
      }

      await route.continue();
    });

    return requests;
  }

  /**
   * Mock WebSocket connection (basic implementation).
   * Note: Full WebSocket mocking typically requires a mock server.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async mockWebSocket(_urlPattern: string | RegExp): Promise<void> {
    Logger.warn('WebSocket mocking is limited in Playwright. Consider using a test server.');
    // This is a placeholder for future enhancement
  }

  /**
   * Clear all active mocks for this page.
   */
  async clearAll(): Promise<void> {
    // Remove all routes
    await this.page.unrouteAll();
    this.activeRoutes = [];
    Logger.info('Cleared all network mocks');
  }

  /**
   * Clear specific mock by URL pattern.
   */
  async clear(urlPattern: string | RegExp): Promise<void> {
    await this.page.unroute(urlPattern);
    this.activeRoutes = this.activeRoutes.filter((pattern) => pattern !== urlPattern);
    Logger.info(`Cleared mock for ${urlPattern}`);
  }

  /**
   * Get default error message for HTTP status codes.
   */
  private getDefaultErrorMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return messages[status] || 'Unknown Error';
  }

  /**
   * Helper method to mock API route (internal use).
   */
  private async mockApiRoute(
    urlPattern: string | RegExp,
    options: {
      method?: string;
      status: number;
      body?: any;
      delayMs?: number;
      headers?: Record<string, string>;
      onRequest?: (request: Request) => void | Promise<void>;
    }
  ): Promise<void> {
    const { method, status, body, delayMs = 0, headers = {}, onRequest } = options;

    await this.page.route(urlPattern, async (route) => {
      const request = route.request();

      // Filter by method if specified
      if (method && request.method().toUpperCase() !== method.toUpperCase()) {
        await route.continue();
        return;
      }

      Logger.info(
        `Mocking ${request.method()} ${request.url()} -> status ${status}${delayMs ? ` (${delayMs}ms delay)` : ''
        }`
      );

      if (onRequest) {
        await onRequest(request);
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      await route.fulfill({
        status,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body !== null && body !== undefined ? JSON.stringify(body) : undefined,
      });
    });

    this.activeRoutes.push(urlPattern as RegExp);
  }
}

/**
 * Pre-built mock scenarios for common use cases.
 */
export class MockScenarios {
  /**
   * Scenario: API is slow and eventually times out.
   */
  static async slowAndTimeout(page: Page, urlPattern: string | RegExp): Promise<void> {
    const mock = new NetworkMock(page);
    await mock.mockTimeout(urlPattern);
  }

  /**
   * Scenario: API fails first, then succeeds (retry scenario).
   */
  static async flakyAPI(page: Page, urlPattern: string | RegExp, successData: any): Promise<void> {
    const mock = new NetworkMock(page);
    await mock.mockSequential(urlPattern, [
      { status: 500, body: { error: 'Internal Server Error' } },
      { status: 500, body: { error: 'Internal Server Error' } },
      { status: 200, body: successData },
    ]);
  }

  /**
   * Scenario: User is logged out during session.
   */
  static async sessionExpired(page: Page): Promise<void> {
    const mock = new NetworkMock(page);
    await mock.mockSequential(/\/api\/.*/, [
      { status: 401, body: { error: 'Session expired' } },
    ]);
  }

  /**
   * Scenario: Multiple concurrent requests (race condition testing).
   */
  static async concurrentRequests(page: Page, urlPattern: string | RegExp): Promise<void> {
    const mock = new NetworkMock(page);
    let requestCount = 0;

    await mock.mockCustom(urlPattern, async (route) => {
      requestCount++;
      const delay = Math.random() * 1000; // Random delay 0-1000ms
      Logger.info(`Concurrent request #${requestCount}, delay: ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ data: `Response ${requestCount}` }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  }

  /**
   * Scenario: Large payload response.
   */
  static async largePayload(page: Page, urlPattern: string | RegExp): Promise<void> {
    const mock = new NetworkMock(page);
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      description: 'A'.repeat(100), // 100 char description
    }));

    await mock.mockGet(urlPattern, largeData, 2000); // 2 second delay
  }
}

