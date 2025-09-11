/**
 * Global test setup
 * 
 * Runs once before all tests to initialize test environment
 */

import { TestDatabaseManager } from '../utils/test-database.js'

export default async function globalSetup() {
  console.log('🚀 Starting global test setup...')
  
  try {
    const testDb = TestDatabaseManager.getInstance()
    await testDb.setupTestUser()
    
    console.log('✅ Global test setup completed successfully')
    
  } catch (error) {
    console.error('❌ Global test setup failed:', error)
    throw error
  }
}