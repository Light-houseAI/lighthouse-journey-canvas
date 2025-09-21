import { defineConfig, devices } from '@playwright/test';

/**
 * Consolidated Playwright Configuration for E2E Tests
 * Follows PRD-E2E-Test-Suite.md specifications with comprehensive browser coverage
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined, // Increased from 1 for better performance

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['list', { printSteps: true }],
    process.env.CI ? ['github'] : ['line']
  ],

  /* Maximum time one test can run for. */
  timeout: 30 * 1000,

  /* Expect timeout for individual assertions */
  expect: {
    timeout: 10 * 1000
  },

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:5004',

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording */
    video: 'retain-on-failure',

    /* Global timeout for each action */
    actionTimeout: 15000, // Increased from 10000
    navigationTimeout: 30000,

    /* Locale for testing */
    locale: 'en-US',

    /* Timezone for testing */
    timezoneId: 'America/New_York',

    /* Reduced motion for more stable tests */
    reducedMotion: 'reduce',

    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,

    /* Viewport settings */
    viewport: { width: 1280, height: 720 }
  },

  /* Database setup handled by webServer (npm run test:server) */

  /* Browser Coverage Matrix - Simplified Chrome Desktop Only */
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Optimize setup performance
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      }
    },

    /* Chrome Desktop - Authenticated Tests (requires login) */
    {
      name: 'chromium-auth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        // Chrome performance optimizations
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--memory-pressure-off',
            '--max_old_space_size=4096'
          ]
        },
        // Viewport optimization for timeline testing
        viewport: { width: 1920, height: 1080 }
      },
      dependencies: ['setup'],
      testMatch: [
        // Timeline tests require authentication
        '**/timeline/**/*.spec.ts',
        // Any other authenticated features
        '**/settings/**/*.spec.ts',
        '**/profile/**/*.spec.ts',
        '**/permissions/**/*.spec.ts',
        '**/insights/**/*.spec.ts'
      ],
    },

    /* Unauthenticated Tests (login/signup flows that don't need existing auth) */
    {
      name: 'chromium-no-auth',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security'
          ]
        }
      },
      testMatch: [
        // Auth flows that don't need existing authentication
        '**/auth/login.spec.ts',
        '**/auth/signup.spec.ts',
        // Onboarding tests full signup→onboarding flow (starts fresh)
        '**/auth/onboarding.spec.ts'
      ],
    }
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // Always use test server for E2E tests
    command: 'cd .. && npm run test:server',
    url: 'http://localhost:5004',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    // Pass environment variables to the server
    env: {
      ...process.env,
      NODE_ENV: 'test',
      USE_TEST_DB: 'true',
    },
    // Server output configuration
    stdout: process.env.DEBUG ? 'pipe' : 'ignore',
    stderr: process.env.DEBUG ? 'pipe' : 'ignore'
  },

  /* Output directories for better organization */
  outputDir: './test-results/',

  /* Metadata for better reporting */
  metadata: {
    'Test Environment': 'test',
    'Base URL': process.env.BASE_URL || 'http://localhost:5004',
    'Browser Coverage': 'Chrome Desktop Only',
    'Test Categories': 'Authentication, Timeline CRUD, Settings, Profile, Permissions, Insights',
    'Server Command': 'npm run test:server'
  }
});
