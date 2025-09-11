/**
 * Global test teardown
 * 
 * Runs once after all tests to cleanup test environment
 */

import { TestDatabaseManager } from '../utils/test-database.js'

export default async function globalTeardown() {
  console.log('🧹 Starting global test teardown...')
  
  try {
    // Cleanup legacy single-instance test data
    const testDb = TestDatabaseManager.getInstance()
    await testDb.cleanupTestUser()
    
    // Cleanup all parallel test instances
    TestDatabaseManager.cleanupAll()
    
    console.log('✅ Global test teardown completed successfully')
    
  } catch (error) {
    console.error('❌ Global test teardown failed:', error)
    // Don't throw on teardown errors
  }
}