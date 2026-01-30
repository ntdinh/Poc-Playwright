import { test, expect } from '../fixtures';
import { Logger } from '../utils/Logger';

/**
 * Test Suite: API Login (Mock 500)
 *
 * Goal:
 * - Call API /login with payload { user: 'Admin', pass: 'inValidPass' }
 * - Force backend to return 500
 * - Expect login fail (response.ok() === false)
 */
test.describe('API Login Tests', () => {
  test('TC_API_001: Should fail login when /login returns 500', async ({ page }) => {
    const payload = { user: 'Admin', pass: 'inValidPass' };

    Logger.step(1, 'Navigate to baseURL to establish origin for relative API calls');
    await page.goto('/');

    Logger.step(2, 'Mock /login to return 500');
    let receivedBody: any = undefined;

    await page.route('**/login', async (route) => {
      try {
        receivedBody = route.request().postDataJSON();
      } catch {
        receivedBody = route.request().postData();
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    Logger.step(3, 'Call API /login with invalid password');
    const result = await page.evaluate(async (body) => {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await res.text().catch(() => '');
      return { ok: res.ok, status: res.status, body: text };
    }, payload);

    Logger.step(4, 'Assert: request payload received & login failed');
    expect(receivedBody).toEqual(payload);
    expect(result.status).toBe(500);
    expect(result.ok).toBe(false);
    Logger.info(`API login failed as expected. status=${result.status}, ok=${result.ok}`);
  });
});

