import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Timeline Tests
 * Runs against the existing server on localhost:5004
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'consolidated-timeline-tests.spec.ts',
  
  /* Run tests in series for timeline tests */
  fullyParallel: false,
  
  /* Retry on failure */
  retries: 1,
  
  /* Workers */
  workers: 1,
  
  /* Reporter */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/timeline-report' }]
  ],
  
  /* Test settings */
  use: {
    /* Base URL - connects to your existing mock server */
    baseURL: 'http://localhost:5004',
    
    /* Collect trace on failure */
    trace: 'retain-on-failure',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video recording */
    video: 'retain-on-failure',
    
    /* Viewport */
    viewport: { width: 1280, height: 720 },
  },

  /* Test timeout */
  timeout: 60 * 1000,
  
  /* Expect timeout */
  expect: {
    timeout: 10 * 1000
  },

  /* Projects - only Chromium for timeline tests */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],

  /* No web server - assumes existing server at localhost:5004 */
});