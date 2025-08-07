import { defineConfig, devices } from '@playwright/test';

/**
 * Chrome-only Playwright configuration for focused testing
 * Desktop viewport only, using existing server on localhost:5004
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker for stability
  reporter: [
    ['html'],
    ['list']
  ],

  use: {
    // Use the existing running server
    baseURL: 'http://localhost:5004',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Desktop viewport - Chrome focus
    viewport: { width: 1440, height: 900 },
    
    // Additional browser context options
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});