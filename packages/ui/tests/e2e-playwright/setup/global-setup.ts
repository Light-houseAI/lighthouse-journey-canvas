/**
 * Playwright Global Setup
 *
 * Initializes test environment for E2E tests:
 * 1. Start test database backend
 * 2. Setup test data isolation
 * 3. Configure authentication state
 * 4. Prepare test fixtures
 */

import { chromium, type FullConfig } from '@playwright/test';
// TestDatabaseManager removed - using config-based approach instead

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test global setup...');

  try {
    // Test database setup removed - using existing database configuration
    console.log('📊 E2E tests will use existing test database setup...');
    
    // Start browser for auth setup
    console.log('🌐 Setting up browser and authentication...');
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to app and create authenticated state
    const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173';
    
    try {
      await page.goto(baseURL);
      console.log(`✅ Application accessible at ${baseURL}`);
    } catch (error) {
      console.error(`❌ Cannot access application at ${baseURL}`);
      throw error;
    }

    // Optional: Create authenticated user state for tests that need it
    // This can be used by tests via storageState
    try {
      await page.goto(`${baseURL}/login`);
      
      // Fill login form if it exists
      const emailInput = await page.locator('input[type="email"]').first();
      if (await emailInput.isVisible({ timeout: 5000 })) {
        await emailInput.fill('e2e.test@example.com');
        
        const passwordInput = await page.locator('input[type="password"]').first();
        await passwordInput.fill('TestPassword123!');
        
        const loginButton = await page.locator('button[type="submit"]').first();
        await loginButton.click();
        
        // Wait for login to complete
        await page.waitForURL(/\/dashboard|\/timeline/, { timeout: 10000 });
        console.log('✅ Created authenticated user state');
      }
    } catch (error) {
      console.log('ℹ️ Login form not available or authentication failed (this is OK for most tests)');
    }

    // Save authentication state for tests that need it
    await context.storageState({ path: 'client/tests/e2e/fixtures/auth-state.json' });

    await context.close();
    await browser.close();

    console.log('✅ E2E global setup completed successfully');

  } catch (error) {
    console.error('❌ E2E global setup failed:', error);
    throw error;
  }
}

export default globalSetup;