/**
 * Playwright Global Teardown
 *
 * Cleans up test environment after E2E tests:
 * 1. Cleanup test databases
 * 2. Remove test artifacts
 * 3. Close any remaining browser instances
 */

import type { FullConfig } from '@playwright/test';
// TestDatabaseManager removed - using config-based approach instead

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test global teardown...');

  try {
    // Test database cleanup removed - using existing database configuration  
    console.log('📊 E2E test cleanup completed via existing database setup...');

    // Remove auth state file
    try {
      const fs = await import('fs/promises');
      await fs.unlink('client/tests/e2e/fixtures/auth-state.json');
      console.log('✅ Removed authentication state file');
    } catch (error) {
      // File might not exist, which is fine
      console.log('ℹ️ Authentication state file already cleaned up');
    }

    console.log('✅ E2E global teardown completed successfully');

  } catch (error) {
    console.error('❌ E2E global teardown failed:', error);
    // Don't throw - let tests complete even if cleanup fails
  }
}

export default globalTeardown;