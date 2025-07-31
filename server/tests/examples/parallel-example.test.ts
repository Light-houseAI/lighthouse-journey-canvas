/**
 * Parallel Testing Example
 * 
 * Example showing how to use the new parallel testing infrastructure
 */

import { describe, test, expect } from 'vitest';
import { RuntimeContext } from '@mastra/core/di';
import { TestDatabaseManager } from '../utils/test-database.js';

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID;

describe('Parallel Testing Examples', () => {
  test('example 1 - each test gets isolated database', async ({ testAgent, testId }) => {
    // Each test automatically gets:
    // - testAgent: Isolated agent with its own database
    // - testId: Unique identifier for this test instance
    
    console.log(`Test ID: ${testId}`);
    
    expect(testAgent).toBeDefined();
    expect(testId).toBeDefined();
    
    // Set up runtime context with user ID for tool execution
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', TEST_USER_ID.toString());
    
    // This test can run in parallel with others without conflicts
    const result = await testAgent.generate('I am a Software Engineer at TechCorp since 2020', {
      memory: {
        resource: '999',
        thread: 'test-thread'
      },
      runtimeContext
    });
    
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe('string');
  });

  test('example 2 - parallel execution with different data', async ({ testAgent }) => {
    // This test runs simultaneously with example 1 but with completely isolated data
    
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', TEST_USER_ID.toString());
    
    const result = await testAgent.generate('I work as a Data Scientist at AI Corp', {
      memory: {
        resource: '999',
        thread: 'test-thread'
      },
      runtimeContext
    });
    
    expect(result.text).toBeDefined();
    // This won't conflict with the Software Engineer data from example 1
  });

  test('example 3 - fast test execution', async ({ testAgent }) => {
    // Tests should be much faster now with local PostgreSQL
    const startTime = Date.now();
    
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', TEST_USER_ID.toString());
    
    const result = await testAgent.generate('Hello, can you help me with my career?', {
      memory: {
        resource: '999',
        thread: 'test-thread'
      },
      runtimeContext
    });
    
    const duration = Date.now() - startTime;
    
    expect(result.text).toBeDefined();
    expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
  });

  test('example 4 - multiple operations in same test', async ({ testAgent }) => {
    // Multiple operations within the same test share the same isolated database
    
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', TEST_USER_ID.toString());
    
    const result1 = await testAgent.generate('Add my role as Frontend Developer at WebCorp from 2021 to 2023', {
      memory: {
        resource: '999',
        thread: 'test-thread-1'
      },
      runtimeContext
    });
    
    const result2 = await testAgent.generate('Add my current role as Senior Developer at StartupCo from 2023', {
      memory: {
        resource: '999',
        thread: 'test-thread-2'
      },
      runtimeContext
    });
    
    expect(result1.text).toBeDefined();
    expect(result2.text).toBeDefined();
    
    // Both operations worked on the same isolated database instance
  });
});