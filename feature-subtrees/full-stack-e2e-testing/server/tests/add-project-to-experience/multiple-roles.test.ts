/**
 * Multiple Roles Add Project Scenarios
 * 
 * Tests role-specific targeting when users have multiple roles at the same company
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestDatabaseManager } from '../utils/test-database.js'
import { processCareerConversation } from '../../services/ai/simplified-career-agent.js'
import { semanticSearch } from '../../services/ai/career-tools.js'
import { RuntimeContext } from '@mastra/core/di'

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID

describe('Multiple Roles Scenarios', () => {
  beforeAll(async () => {
    console.log('🔧 Setting up multiple roles test environment...')
  }, 30000)

  beforeEach(async () => {
    // Reset test user data before each test for consistency
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up multiple roles test environment...')
  })
  test('should find multiple ABCO experiences via semantic search', async () => {
    // Scenario: User has worked at ABCO in multiple roles/time periods
    // Tests the semantic search capability to find all related experiences
    
    // Arrange
    const runtimeContext = new RuntimeContext()
    runtimeContext.set('userId', TEST_USER_ID.toString())
    
    // Act
    const searchResult = await semanticSearch.execute({
      context: { query: 'ABCO', limit: 5, entityTypes: ['experience'] },
      runtimeContext
    }) as any
    
    // Assert
    expect(searchResult.count).toBeGreaterThanOrEqual(2)
  })

  test('should target specific role at ABCO (principal software engineer)', async () => {
    // Scenario: User specifies a particular role when they worked at the same company multiple times
    // Tests role-specific targeting and disambiguation capabilities
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a System Architecture project to ABCO when I was principal software engineer',
      userId: TEST_USER_ID.toString(),
      threadId: `roles-test-1-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    
    expect(result.updatedProfile).toBe(true)
    expect(response.includes('principal') || response.includes('abco')).toBe(true)
  })

  test('should handle case insensitive company matching', async () => {
    // Scenario: User types company name in different case (lowercase 'abco' vs 'ABCO')
    // Tests robust string matching regardless of case sensitivity
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Performance Testing project to abco experience',
      userId: TEST_USER_ID.toString(),
      threadId: `roles-test-2-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should disambiguate between multiple roles at same company', async () => {
    // Scenario: User mentions a level modifier ('senior role') to help identify the correct experience
    // Tests the agent's ability to use role descriptors for disambiguation
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Team Leadership project to my senior role at ABCO',
      userId: TEST_USER_ID.toString(),
      threadId: `roles-test-3-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should handle ambiguous role references gracefully', async () => {
    // Scenario: User doesn't specify which role when multiple exist at the same company
    // Agent should either make a reasonable choice or ask for clarification
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Code Review project to ABCO',
      userId: TEST_USER_ID.toString(),
      threadId: `roles-test-4-${Date.now()}`
    })
    
    // Assert
    // Should either successfully add to one role or ask for clarification
    const response = result.response.toLowerCase()
    const successful = result.updatedProfile
    const asksClarification = response.includes('which') || response.includes('role') || response.includes('position')
    
    expect(successful || asksClarification).toBe(true)
  })
})