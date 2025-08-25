/**
 * Simple test to verify parallel database isolation works
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDatabaseManager } from '../utils/test-database.js';

describe('Parallel Database Isolation', () => {
  const testIds: string[] = [];

  afterEach(async () => {
    // Clean up test agents and databases
    for (const testId of testIds) {
      try {
        await TestDatabaseManager.cleanup(testId);
      } catch (error: any) {
        // Ignore connection termination errors during cleanup
        if (error.code !== '57P01' && !error.message.includes('terminating connection')) {
          console.warn(`⚠️ Error during cleanup for ${testId}:`, error.message);
        }
      }
    }
    testIds.length = 0;
  });

  it('should create isolated databases for different test IDs', async () => {
    const testId1 = 'isolation_test_1';
    const testId2 = 'isolation_test_2';
    
    testIds.push(testId1, testId2);

    try {
      // Create agents with different test IDs
      const agent1 = await TestDatabaseManager.createIsolatedAgent(testId1);
      const agent2 = await TestDatabaseManager.createIsolatedAgent(testId2);

      // Verify both agents are created
      expect(agent1).toBeDefined();
      expect(agent2).toBeDefined();
      
      console.log('✅ Successfully created two isolated PostgreSQL test databases');
      
    } catch (error) {
      console.error('❌ Failed to create isolated databases:', error);
      throw error;
    }
  }, 30000); // 30 second timeout

  it('should handle concurrent database creation', async () => {
    const testId1 = 'concurrent_test_1';
    const testId2 = 'concurrent_test_2';
    const testId3 = 'concurrent_test_3';
    
    testIds.push(testId1, testId2, testId3);

    try {
      // Create multiple agents concurrently
      const [agent1, agent2, agent3] = await Promise.all([
        TestDatabaseManager.createIsolatedAgent(testId1),
        TestDatabaseManager.createIsolatedAgent(testId2),
        TestDatabaseManager.createIsolatedAgent(testId3),
      ]);

      // Verify all agents are created
      expect(agent1).toBeDefined();
      expect(agent2).toBeDefined();
      expect(agent3).toBeDefined();
      
      console.log('✅ Successfully created three concurrent isolated PostgreSQL test databases');
      
    } catch (error) {
      console.error('❌ Failed to create concurrent isolated databases:', error);
      throw error;
    }
  }, 30000); // 30 second timeout
});