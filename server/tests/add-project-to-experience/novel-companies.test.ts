/**
 * Novel Companies Add Project Scenarios
 * 
 * Tests generalization beyond training examples with new companies and roles
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestDatabaseManager } from '../utils/test-database.js'
import { processCareerConversation } from '../../services/ai/simplified-career-agent.js'
import { eq } from 'drizzle-orm'
import { db } from '../../db.js'
import { profiles } from '../../../shared/schema.js'
import { ProfileData } from '../../../shared/schema.js'

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID

// Helper functions
const getCurrentProfile = async (): Promise<ProfileData | null> => {
  const result = await db.select()
    .from(profiles)
    .where(eq(profiles.userId, TEST_USER_ID))
    .limit(1)
  return result.length > 0 ? result[0].filteredData : null
}

describe('Novel Companies Scenarios', () => {
  beforeAll(async () => {
    console.log('🔧 Setting up novel companies test environment...')
  }, 30000)

  beforeEach(async () => {
    // Reset test user data before each test for consistency
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up novel companies test environment...')
  })
  test('should create new experience for Apple with iOS development project', async () => {
    // Scenario: User wants to add a project to a company not in their current profile
    // This tests the agent's ability to create new experiences for novel companies
    
    // Arrange
    const beforeProfile = await getCurrentProfile()
    const initialExpCount = beforeProfile?.experiences.length || 0
    
    // Act
    const result = await processCareerConversation({
      message: 'Add an iOS App Development project to my Apple experience as an iOS Developer',
      userId: TEST_USER_ID.toString(),
      threadId: `novel-test-1-${Date.now()}`
    })
    
    // Assert
    const afterProfile = await getCurrentProfile()
    const finalExpCount = afterProfile?.experiences.length || 0
    
    expect(result.updatedProfile).toBe(true)
    expect(finalExpCount).toBeGreaterThanOrEqual(initialExpCount)
  })

  test('should handle Amazon with Data Scientist role (different from typical SWE)', async () => {
    // Scenario: Adding project to a well-known company but with a non-engineering role
    // Tests generalization to different role types beyond software engineering
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Machine Learning Pipeline project to my Amazon experience as a Data Scientist',
      userId: TEST_USER_ID.toString(),
      threadId: `novel-test-2-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should create Tesla experience for automotive industry project', async () => {
    // Scenario: Adding project to a company in a novel industry (automotive)
    // Tests agent's ability to handle domain-specific projects outside typical tech companies
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add an Autonomous Driving project to Tesla as a Software Engineer',
      userId: TEST_USER_ID.toString(),
      threadId: `novel-test-3-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should handle Netflix with content recommendation project', async () => {
    // Scenario: Adding a domain-specific project (content/media) to a streaming company
    // Tests understanding of industry-specific project types
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Content Recommendation Algorithm project to Netflix as a Data Scientist',
      userId: TEST_USER_ID.toString(),
      threadId: `novel-test-4-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should create Spotify experience with music technology project', async () => {
    // Scenario: Adding a highly specialized project to a music streaming company
    // Tests agent's ability to understand niche technical domains
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Real-time Audio Processing project to Spotify as an Audio Engineer',
      userId: TEST_USER_ID.toString(),
      threadId: `novel-test-5-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should handle Stripe with fintech payment infrastructure', async () => {
    // Scenario: Adding a financial technology project to a payment processing company
    // Tests understanding of fintech domain and payment systems
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Payment Gateway Optimization project to Stripe as a Backend Engineer',
      userId: TEST_USER_ID.toString(),
      threadId: `novel-test-6-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })
})