/**
 * Playwright E2E Test Configuration
 *
 * Configures end-to-end testing for the client application:
 * 1. Real database backend integration
 * 2. Test data isolation per test
 * 3. Cross-browser testing capability
 * 4. Page object pattern support
 * 5. Test parallelization with database safety
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: '../workflows',
  
  // Test patterns
  testMatch: '**/*.spec.ts',
  
  // Global setup and teardown
  globalSetup: require.resolve('./global-setup.ts'),
  globalTeardown: require.resolve('./global-teardown.ts'),
  
  // Timeout configuration
  timeout: 30 * 1000, // 30 seconds per test
  expect: {
    timeout: 5 * 1000, // 5 seconds for assertions
  },
  
  // Test execution configuration
  fullyParallel: true, // Run tests in parallel
  forbidOnly: !!process.env.CI, // Forbid test.only in CI
  retries: process.env.CI ? 2 : 0, // Retry failed tests in CI
  workers: process.env.CI ? 1 : 2, // Limit workers for database safety
  
  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ...(process.env.CI ? [['github']] : [['list']]),
  ],
  
  // Output directory
  outputDir: 'test-results/',
  
  // Global test configuration
  use: {
    // Base URL for the application
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    
    // Browser configuration
    headless: process.env.CI ? true : false,
    viewport: { width: 1280, height: 720 },
    
    // Test artifacts
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    
    // Network configuration
    ignoreHTTPSErrors: true,
    
    // Test speed configuration
    actionTimeout: 10 * 1000, // 10 seconds for actions
    navigationTimeout: 15 * 1000, // 15 seconds for navigation
  },

  // Browser projects configuration
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile testing (optional)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // 
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Development server configuration
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      // Use test database for E2E tests
      NODE_ENV: 'test',
      USE_TEST_DB: 'true',
      TEST_E2E: 'true',
      // Disable non-essential services during testing
      DISABLE_ANALYTICS: 'true',
      DISABLE_ERROR_REPORTING: 'true',
    },
  },
});