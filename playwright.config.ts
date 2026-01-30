import { defineConfig, devices } from '@playwright/test';
import { getBaseURL, getEnvironment } from './config/environment';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: getBaseURL(),
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    /* Timeout for each action */
    actionTimeout: 10000,
    /* Timeout for navigation */
    navigationTimeout: 30000,
  },
  /* Global timeout for each test */
  timeout: 60000,
  /* Expect timeout */
  expect: {
    timeout: 5000,
  },

  /* Configure projects for major browsers */
  /*
   * Each project represents a specific browser or device.
   * When running `npm test`, all enabled projects run in parallel.
   *
   * Examples to run a single project:
   * - npm test -- --project=chromium    (Chromium / Chrome)
   * - npm test -- --project=firefox     (Firefox)
   * - npm test -- --project=webkit      (Safari / WebKit)
   * - npm test -- --project="Mobile Chrome"  (Mobile Chrome)
   */
  projects: [
    // Desktop Browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // You can override settings for Chromium here, for example:
        // viewport: { width: 1920, height: 1080 },
        // headless: false, // Run with visible browser
      },
    },

    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     // Override Firefox-specific settings here if needed
    //   },
    // },

    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     // Override Safari-specific settings here if needed
    //   },
    // },

    // Mobile Browsers - uncomment to enable
    // {
    //   name: 'Mobile Chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //     // Example: test on Chrome mobile with Pixel 5 viewport
    //   },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //     // Example: test on Safari mobile with iPhone 12 viewport
    //   },
    // },
    
    // You can add more devices, for example:
    // {
    //   name: 'iPad',
    //   use: { ...devices['iPad Pro'] },
    // },
    // {
    //   name: 'Tablet',
    //   use: { ...devices['iPad Air'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
