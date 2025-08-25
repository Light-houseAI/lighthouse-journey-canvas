/**
 * Basic Add Project to Experience Scenarios
 *
 * Tests the core functionality of adding projects to existing experiences
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { processCareerConversation } from '../../services/ai/simplified-career-agent.js'
import { eq } from 'drizzle-orm'
import { db } from '../../db.js'
import { profiles } from '@shared/schema'
import { ProfileData } from '@shared/schema'
import { TestDatabaseManager } from '../utils/test-database.js'

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID

// Helper functions
const getCurrentProfile = async (): Promise<ProfileData | null> => {
  const result = await db.select()
    .from(profiles)
    .where(eq(profiles.userId, TEST_USER_ID))
    .limit(1)
  return result.length > 0 ? result[0].filteredData : null
}

const countProjectsForCompany = (profile: ProfileData | null, companyName: string) => {
  if (!profile) return 0
  const experience = profile.experiences.find(exp =>
    exp.company.toLowerCase().includes(companyName.toLowerCase())
  )
  return experience?.projects?.length || 0
}

describe('Basic Add Project Scenarios', () => {
  beforeAll(async () => {
    console.log('🔧 Setting up basic scenarios test environment...')
  }, 30000)

  beforeEach(async () => {
    // Reset test user data before each test for consistency
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up basic scenarios test environment...')
  })
  test('should add project to TechCorp experience', async () => {
    // Scenario: User wants to add a technical project to an existing well-known company experience
    // This tests the core functionality of project addition to established companies

    // Arrange
    const before = await getCurrentProfile()
    const initialCount = countProjectsForCompany(before, 'TechCorp')

    // Act
    const result = await processCareerConversation({
      message: 'Add a Database Optimization project to my TechCorp experience',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-test-1-${Date.now()}`
    })

    // Assert
    const after = await getCurrentProfile()
    const finalCount = countProjectsForCompany(after, 'TechCorp')

    expect(result.updatedProfile).toBe(true)
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  test('should add project to Optum healthcare experience', async () => {
    // Scenario: User adds a healthcare-specific project to a healthcare company
    // Tests domain-specific project handling and company name recognition

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a FHIR Integration project to my Optum healthcare experience',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-test-2-${Date.now()}`
    })

    // Assert
    expect(result.updatedProfile).toBe(true)
    expect(result.response.toLowerCase()).toContain('optum')
  })

  test('should handle minimal project details', async () => {
    // Scenario: User provides only basic project information without specific details
    // Tests agent's ability to handle sparse input and still create meaningful entries

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Security Audit project to TechCorp',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-test-3-${Date.now()}`
    })

    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should handle rich project details', async () => {
    // Scenario: User provides comprehensive project details including technologies and timeline
    // Tests agent's ability to parse and utilize detailed project information

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Microservices Architecture project to my TechCorp experience using Docker, Kubernetes, and Node.js from January 2024 to March 2024',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-test-4-${Date.now()}`
    })

    // Assert
    expect(result.updatedProfile).toBe(true)
  })
})
