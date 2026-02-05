# Playwright Test Framework – POM + Fixtures + Components

This project is a refactored Playwright framework designed to:
- Leverage **Page Object Model (POM)**, **Custom Fixtures**, and **Component Pattern**
- Be easy to **scale to larger systems**
- Be **maintainable and reusable**, ready for CI/CD

---

## 📁 Project structure

```bash
project-root/
├── fixtures/              # Custom Playwright fixtures (test context, login, authenticatedPage, ...)
│   └── index.ts
├── pages/                 # Page Object Models
│   ├── BasePage.ts        # Base class with standardized wait/click/fill/... helpers
│   ├── LoginPage.ts       # Login page (OrangeHRM)
│   ├── MyInfoPage.ts      # My Info page (update user profile)
│   └── index.ts
├── components/            # Reusable UI Components (Button, Input, ...)
│   ├── BaseComponent.ts
│   ├── Button.ts
│   ├── Input.ts
│   └── index.ts
├── config/                # Environment configuration
│   ├── environment.ts     # DEV/STAGING/PROD baseURL, API URL, credentials
│   └── index.ts
├── utils/                 # Utilities
│   ├── Helpers.ts         # Utility helpers (random string/email, delay, waitForCondition, ...)
│   ├── TestData.ts        # Test data (username/password, URLs, messages, My Info data, ...)
│   ├── Logger.ts          # Logger for tests (info/debug/warn/error, step)
│   ├── api/
│   │   └── APIHelper.ts   # Hỗ trợ gọi API (login, get/post/put/delete, auth headers)
│   └── index.ts
├── tests/                 # Test suites
│   ├── login.spec.ts              # Login test suite
│   ├── update-user-info.spec.ts   # Update My Info test suite
│   └── example-advanced.spec.ts   # Advanced demo (fixtures, components, logger, APIHelper)
├── playwright.config.ts   # Playwright configuration (projects, baseURL, reporter, timeout, ...)
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies + npm scripts
└── README.md              # This guide
```

---

## 🧱 Key design ideas & benefits

### 1. Page Object Model (POM) – `pages/`

**Idea:** Each page (Login, My Info, Dashboard, …) is a separate class containing:
- Locators (selectors)
- Methods to interact with the page

**Benefits:**
- **Separate test logic from UI details**: tests call `loginPage.login()`, no need to know selectors.
- **Maintainability**: When UI changes, update the Page Object instead of every test.
- **Reusability**: Actions (login, update info, …) can be reused across many tests.

**Ví dụ `LoginPage`:**
- Locators:
  - `usernameInput`, `passwordInput`, `loginButton`
  - `errorMessage` (selector linh hoạt cho OrangeHRM)
  - `requiredFieldMessage` (text “Required”)
- Methods chính:
  - `navigateToLogin()` – điều hướng tới trang login `https://opensource-demo.orangehrmlive.com`
  - `login(username, password)` – thực hiện login đầy đủ
  - `getErrorMessage()` – lấy nội dung error, có fallback selector và logging
  - `verifyDashboardRedirect()` – verify redirect tới `/web/index.php/dashboard/index`

**Ví dụ `MyInfoPage`:**
- Locators:
  - Link `My Info`
  - Các textbox First/Middle/Last Name
  - Nút Save trong form `Employee Full NameEmployee`
  - Thông báo `Successfully Updated`
- Methods:
  - `navigateToMyInfo()`
  - `updateFirstName / updateMiddleName / updateLastName`
  - `updateFullName()` – cập nhật cả 3 field một lần
  - `saveInformation()`
  - `verifySuccessMessage()` – chờ & verify thông báo thành công

### 2. BasePage – `pages/BasePage.ts`

BasePage là lớp nền cho tất cả Page Objects, đã được **refactor nâng cấp**:
- Gắn với `baseURL` từ `config/environment.ts`
- Chuẩn hóa các thao tác:
  - `goto(url, options)` – hiểu `''`, relative path, absolute URL
  - `waitForLoadState(state)` – `load/domcontentloaded/networkidle`
  - `click(locator, options)` – có `waitFor` + `timeout` + `force`
  - `fill(locator, text, options)` – auto clear + wait visible
  - `getText(locator)` – chờ visible rồi lấy text
  - `waitForElement`, `waitForElementHidden`
  - `isVisible`, `isEnabled`
  - `scrollToElement`, `hover`, `getAttribute`
  - `waitForURL(pattern, timeout)`, `verifyURL(pattern)`
  - `reload`, `goBack`, `goForward`

**Benefits:**
- Reduce repeated wait code everywhere.
- Centralize "anti-flakiness" logic (wait, retry) in one place.

### 3. Custom Fixtures – `fixtures/index.ts`

Use `@playwright/test` fixtures to **inject** dependencies into tests (pages, authenticated state, API client, ...).

Current fixtures:
- `loginPage: LoginPage`
- `authenticatedPage: BasePage` (already logged in to OrangeHRM)

**Example usage:**

```ts
import { test, expect } from '../fixtures';

test('example', async ({ loginPage, authenticatedPage, page }) => {
  // loginPage is already initialized
  await loginPage.navigateToLogin();
  await loginPage.login('Admin', 'admin123');

  // authenticatedPage is already logged in (via fixture)
  await expect(page).toHaveURL(/dashboard/);
});
```

**Benefits:**
- Reduce repeated `beforeEach` code – no need to manually initialize `LoginPage`.
- Easily have a "logged in" state for many tests without copy-pasting login logic.
- Type-safe (TypeScript) support for test context.

### 4. Component Pattern – `components/`

For repeated UI elements (button, input, modal, ...), use the Component Pattern to:
- Group common actions into a component class.
- Reuse the same behavior across many Pages.

**Example `Button` & `Input`:**

```ts
import { Button, Input } from '../components';

const usernameInput = new Input(page, loginPage.usernameInput);
const loginButton = new Button(page, loginPage.loginButton);

await usernameInput.fill(TestData.VALID_USERNAME);
await loginButton.click();
```

**Benefits:**
- Code is cleaner and clearer.
- Easy to change common behavior (e.g., hover before click, logging, ...) in one place.

### 5. Environment Configuration – `config/`

Manage multiple environments (dev, staging, production) via `EnvironmentConfig`:
- `baseURL` – system URL (e.g., DEV: `https://opensource-demo.orangehrmlive.com`)
- `apiURL`
- `timeout`
- `credentials` for `admin` and `user`

**Usage:**

```ts
import { getConfig, getBaseURL, getCredentials } from '../config';

const baseURL = getBaseURL();
const envConfig = getConfig();
const adminCreds = getCredentials('admin');
```

**Run with different ENV:**

```bash
ENV=staging npm test
NODE_ENV=production npm test
```

### 6. Utils – `utils/`

- `TestData.ts`:
  - Login data: `VALID_USERNAME`, `VALID_PASSWORD`, invalid credentials, `EMPTY_STRING`
  - URLs: `LOGIN_URL`, `DASHBOARD_URL`, `HOME_URL`
  - Messages: `SUCCESS_LOGIN_MESSAGE`, `SUCCESS_UPDATED_MESSAGE`, `TEXT_REQUIRED_FIELD`, ...
  - Test data for My Info: `NEW_FIRST_NAME`, `NEW_MIDDLE_NAME`, `NEW_LAST_NAME`
- `Helpers.ts`: random string/email, delay, waitForCondition, timestamp, ...
- `Logger.ts`: standard logging for tests (`info`, `debug`, `warn`, `error`, `step`)
- `APIHelper.ts`: call API login, get/post/put/delete, build auth headers.

---

## 🧪 Available test suites

### 1. `tests/login.spec.ts` – Login Tests

Uses the `loginPage` fixture + POM `LoginPage` to test login for OrangeHRM.

Main tests:
- **TC001**: Successful login with valid credentials, verify dashboard redirect.
- **TC002**: Invalid username – verify error message (flexible selector, with wait).
- **TC003**: Invalid password – similar to TC002.
- **TC004**: Empty username – verify message `"Required"`.
- **TC005**: Empty password – verify message `"Required"`.
- **TC006**: Demo `authenticatedPage` fixture – already logged in.

**Highlights:**
- Handles wait for error message to avoid flakiness.
- `getErrorMessage()` has fallback selector and logging if not found.

### 2. `tests/update-user-info.spec.ts` – Update User Info (My Info)

Uses the `authenticatedPage` fixture (already logged in) + `MyInfoPage`:

- **TC001**: Update First/Middle/Last Name step by step, click Save, verify `Successfully Updated`.
- **TC002**: Use `updateFullName()` to update all 3 fields at once, click Save, verify success message.

**Highlights:**
- `MyInfoPage.verifySuccessMessage()` automatically waits and checks the message.
- New name test data is taken from `TestData` (easy to change & reuse).

### 3. `tests/example-advanced.spec.ts` – Advanced Demo

Demonstrates many aspects of the framework:
- Uses `authenticatedPage` fixture & verifies dashboard URL with `TestData.DASHBOARD_URL`.
- Uses Component Pattern (`Button`, `Input`) to login.
- Uses `Logger` for each step.
- Uses `loginPage.verifyDashboardRedirect()` for stable redirect checking.
- Demo `APIHelper` (test is `skip`, serves as a sample for API integration).

---

## 🚀 Setup & run tests

### 1. Install dependencies & browsers

```bash
npm install
npx playwright install
``>

### 2. Main scripts in `package.json`

```bash
# Run all tests
npm test

# Run tests in headed mode (browser visible)
npm run test:headed

# Run with Playwright UI mode (very useful for debugging)
npm run test:ui

# Run login tests
npm run test:login

# Run update user info tests
npm run test:update-user

# Run update user info on Chrome headed
npm run test:update-user:headed

# Run by project (browser)
npm run test:chromium
npm run test:firefox
npm run test:webkit
```

### 3. Run directly with Playwright CLI

```bash
# Run a single file
npx playwright test tests/login.spec.ts --project=chromium

# Run a specific test case (use -g)
npx playwright test tests/login.spec.ts -g "TC002" --headed --project=chromium

# Run update-user-info with slow motion to observe
npx playwright test tests/update-user-info.spec.ts --headed --project=chromium --slow-mo=1000

# Run with debug mode
npx playwright test tests/update-user-info.spec.ts --debug --project=chromium

# Run single file with open brower
npx playwright test tests/login-fluent.spec.ts --headed
```

### 4. View report & debug on failure

```bash
# View HTML report after running tests
npm run test:report
```


When a test fails:
- Screenshot & video (if enabled) are in the `test-results/` folder.
- Trace can be viewed with:

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

---

## 🌐 Multi-browser configuration (projects)

Configuration in `playwright.config.ts`, section `projects`:

```ts
projects: [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      // You can override: viewport, headless, screenshot, video, trace, ...
    },
  },
  // You can add firefox, webkit, mobile, ...
];
```

**Run:**

```bash
# All projects
npm test

# Single project
npm test -- --project=chromium

# Multiple projects
npm test -- --project=chromium --project=firefox
```

---

## 🎯 Benefits of this architecture

- **Very easy to scale**: add new pages, tests, environments without breaking the old structure.
- **More stable tests**: wait/click/fill/waitForURL, etc. are centralized in `BasePage` and helpers, reducing flakiness.
- **Easy to read & onboard**: tests are close to business language (`loginPage.login`, `myInfoPage.updateFullName`).
- **Layered separation**:
  - `config` – environment, credentials
  - `pages` – UI interaction (POM)
  - `components` – reusable UI elements
  - `fixtures` – test context (already logged in, API client, ...)
  - `tests` – focus only on test logic
- **Ready for CI/CD**: clean configuration, easy to integrate with GitHub Actions/Jenkins/GitLab CI.

---

## 🔧 Extension directions

- Add:
  - `DashboardPage`, `AdminPage`, `LeavePage`, ... in `pages/`
  - More fixtures: `dashboardPage`, `apiClient`, `testDataFixture`, ...
  - More components: Modal, Form, Navigation, Table, Filter, ...
- Add tags for tests (`@smoke`, `@regression`, `@sanity`) for easier filtering.
- Add custom reporters (JSON/JUnit/HTML custom) for CI integration.

---

**Happy Testing with Playwright + POM + Fixtures + Components!**

