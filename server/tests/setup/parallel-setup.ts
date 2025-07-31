/**
 * Parallel Test Setup
 * 
 * Provides isolated test context for parallel execution with PGlite databases
 */

import { beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { TestDatabaseManager } from '../utils/test-database.js';

// Generate unique test ID for each test
let currentTestId: string;

beforeAll(async () => {
  console.log('🚀 Starting parallel test setup');
});

beforeEach(async (context) => {
  // Generate unique test ID based on test file and test name
  const testFile = context.task.file?.name || 'unknown';
  const testName = context.task.name || 'unknown';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  
  currentTestId = `${testFile}_${testName}_${timestamp}_${random}`.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // Create isolated agent for this test
  const testAgent = await TestDatabaseManager.createIsolatedAgent(currentTestId);
  
  // Attach the agent to the test context
  (context as any).testAgent = testAgent;
  (context as any).testId = currentTestId;
  
  console.log(`🔧 Test setup complete for: ${currentTestId}`);
});

afterEach(async (context) => {
  // Cleanup the test agent and database
  if (currentTestId) {
    await TestDatabaseManager.cleanup(currentTestId);
  }
  
  console.log(`🧹 Test cleanup complete for: ${currentTestId}`);
});

afterAll(async () => {
  // Final cleanup of any remaining instances
  await TestDatabaseManager.cleanupAll();
  console.log('✅ Parallel test teardown complete');
});

// Type augmentation for test context
declare module 'vitest' {
  export interface TestContext {
    testAgent: any;
    testId: string;
  }
}