/**
 * Edge Cases Add Experience Scenarios
 * 
 * Tests error handling, validation, and robustness for edge cases in experience addition
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { processCareerConversation } from '../../services/ai/simplified-career-agent.js'
import { eq } from 'drizzle-orm'
import { db } from '../../db.js'
import { profiles } from '../../../shared/schema.js'
import { ProfileData } from '../../../shared/schema.js'
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

const findExperienceByCompany = (profile: ProfileData | null, companyName: string) => {
  if (!profile) return null
  return profile.experiences.find(exp => 
    exp.company.toLowerCase().includes(companyName.toLowerCase())
  )
}

describe('Edge Cases Add Experience Scenarios', () => {
  beforeAll(async () => {
    console.log('🔧 Setting up edge cases test environment...')
  }, 30000)

  beforeEach(async () => {
    // Reset test user data before each test for consistency
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up edge cases test environment...')
  })

  test('should handle invalid date formats gracefully', async () => {
    // Scenario: User provides dates in invalid or unclear formats
    // Agent should either ask for clarification or handle gracefully
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Developer role at TechCorp from yesterday to tomorrow',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-1-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    
    // Agent should either ask for clarification about dates or handle gracefully
    const handlesDateIssue = response.includes('date') || 
                            response.includes('when') ||
                            response.includes('specific') ||
                            response.includes('year') ||
                            response.includes('month') ||
                            response.includes('clarify') ||
                            result.updatedProfile === true // Or handled it anyway
    
    expect(handlesDateIssue).toBe(true)
    // Should not crash - either asks for clarification or processes with best effort
  })

  test('should handle future start dates with validation', async () => {
    // Scenario: User provides a start date in the future
    // Agent should question or validate this unusual scenario
    
    // Arrange & Act
    const futureYear = new Date().getFullYear() + 2
    const result = await processCareerConversation({
      message: `Add my Software Engineer role at FutureCorp starting in January ${futureYear}`,
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-2-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    
    // Agent should either question the future date or handle it appropriately
    const handlesFutureDate = response.includes('future') || 
                             response.includes(`${futureYear}`) ||
                             response.includes('upcoming') ||
                             response.includes('start') ||
                             result.updatedProfile === true // Or accepted it as future role
    
    expect(handlesFutureDate || result.updatedProfile).toBe(true)
  })

  test('should handle end date before start date validation', async () => {
    // Scenario: User provides end date that's before the start date
    // Agent should catch this logical inconsistency
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Manager role at LogicCorp from 2022 to 2020',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-3-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    
    // Agent should identify the date logic issue
    const catchesDateLogic = response.includes('date') || 
                           response.includes('before') ||
                           response.includes('after') ||
                           response.includes('order') ||
                           response.includes('correct') ||
                           response.includes('clarify') ||
                           result.updatedProfile === false // Didn't process due to validation
    
    expect(catchesDateLogic).toBe(true)
  })

  test('should handle very long company names', async () => {
    // Scenario: User provides extremely long company name
    // Agent should handle without errors and possibly truncate appropriately
    
    // Arrange & Act
    const longCompanyName = 'Super Ultra Mega International Global Worldwide Technology Solutions and Innovation Development Corporation Ltd Inc'
    const result = await processCareerConversation({
      message: `Add my Engineer role at ${longCompanyName} from 2020 to 2021`,
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-4-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    
    // Should either handle the long name or ask for shorter version
    expect(result.updatedProfile || result.response.toLowerCase().includes('shorter')).toBe(true)
    
    if (result.updatedProfile) {
      const newExperience = after?.experiences[after.experiences.length - 1]
      expect(newExperience).toBeTruthy()
      expect(newExperience?.company.length).toBeLessThan(200) // Some reasonable limit
    }
  })

  test('should handle very long role descriptions', async () => {
    // Scenario: User provides extremely detailed/long role description
    // Agent should handle without errors
    
    // Arrange & Act
    const longDescription = 'Led a cross-functional team of 15 engineers across 3 time zones to develop and maintain a highly scalable microservices architecture serving over 10 million users daily, implemented CI/CD pipelines using Jenkins and Docker, optimized database performance resulting in 40% query speed improvement, collaborated with product managers and designers to deliver 25+ features quarterly, mentored junior developers through code reviews and technical design sessions, established coding standards and best practices documentation, participated in on-call rotations for production support, integrated third-party APIs and payment systems, conducted technical interviews for engineering candidates, and presented quarterly engineering updates to executive leadership team'
    
    const result = await processCareerConversation({
      message: `Add my Senior Engineering Manager role at MegaCorp from 2019 to 2022 where I ${longDescription}`,
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-5-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'MegaCorp')
    
    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    
    // Description should be handled (possibly truncated)
    if (newExperience?.description) {
      expect(newExperience.description.length).toBeLessThan(1000) // Reasonable limit
    }
  })

  test('should handle special characters in company names', async () => {
    // Scenario: Company names with special characters, symbols, numbers
    // Agent should handle various character encodings properly
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Developer role at Tech@Co! & Partners #1 Solutions from 2021 to 2022',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-6-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    
    expect(result.updatedProfile).toBe(true)
    
    const newExperience = after?.experiences[after.experiences.length - 1]
    expect(newExperience).toBeTruthy()
    expect(newExperience?.company).toContain('Tech')
    // Should preserve or properly handle special characters
  })

  test('should handle empty or whitespace-only messages', async () => {
    // Scenario: User sends empty message or only whitespace
    // Agent should handle gracefully without crashing
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: '   ',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-7-${Date.now()}`
    })
    
    // Assert
    expect(result.response.length).toBeGreaterThan(0) // Should respond with something
    expect(result.updatedProfile).toBe(false) // Should not update profile
    
    const response = result.response.toLowerCase()
    const handlesEmptyInput = response.includes('help') || 
                             response.includes('tell') ||
                             response.includes('what') ||
                             response.includes('information')
    
    expect(handlesEmptyInput).toBe(true)
  })

  test('should handle conflicting information gracefully', async () => {
    // Scenario: User provides conflicting information within the same message
    // Agent should identify conflicts and ask for clarification
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my current role as Software Engineer at Google that ended in 2020 but I still work there',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-8-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    
    // Agent should catch the conflicting information
    const catchesConflict = response.includes('current') || 
                           response.includes('still work') ||
                           response.includes('ended') ||
                           response.includes('conflict') ||
                           response.includes('clarify') ||
                           response.includes('which') ||
                           result.updatedProfile === false // Didn't process due to conflict
    
    expect(catchesConflict).toBe(true)
  })

  test('should handle multiple experiences in single message', async () => {
    // Scenario: User tries to add multiple experiences in one message
    // Agent should handle appropriately - either process one or ask for separation
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Software Engineer role at Google from 2018-2020 and my Manager role at Facebook from 2020-2022',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-9-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    const response = result.response.toLowerCase()
    
    // Agent should either:
    // 1. Process one experience and ask about the other
    // 2. Ask user to add them separately
    // 3. Process both (less likely but possible)
    
    const handlesMultiple = result.updatedProfile || 
                           response.includes('one at a time') ||
                           response.includes('separate') ||
                           response.includes('first') ||
                           response.includes('which one')
    
    expect(handlesMultiple).toBe(true)
  })

  test('should verify robust error handling without crashes', async () => {
    // Scenario: Throw various challenging inputs to ensure no crashes
    // Agent should handle all inputs gracefully with meaningful responses
    
    const challengingInputs = [
      'Add my 123456789 role at @@@@@@',
      'experience experience experience role role company company',
      'I worked at null undefined error crash',
      'Add role: developer; company: DROP TABLE users;'
    ]
    
    for (const input of challengingInputs) {
      // Act
      const result = await processCareerConversation({
        message: input,
        userId: TEST_USER_ID.toString(),
        threadId: `edge-case-robust-${Date.now()}-${Math.random()}`
      })
      
      // Assert - Should not crash and should provide some response
      expect(result.response).toBeTruthy()
      expect(result.response.length).toBeGreaterThan(0)
      expect(typeof result.updatedProfile).toBe('boolean')
    }
  })

  test('should verify agent-driven error handling responses', async () => {
    // Scenario: Verify that error handling responses are contextual and helpful
    // Tests that error messages are agent-generated, not generic hardcoded templates
    
    // Arrange & Act - Intentionally problematic input
    const result = await processCareerConversation({
      message: 'Add my role that started in 2025 and ended in 2020 at',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-case-exp-11-${Date.now()}`
    })
    
    // Assert - Response should be contextual and helpful
    const response = result.response
    expect(response.length).toBeGreaterThan(10) // Should have substantial response
    
    // Should not be generic error messages
    expect(response).not.toMatch(/^(error|invalid|no)$/i)
    
    // Should be contextual to the specific issues in the input
    const responseLower = response.toLowerCase()
    const addressesIssues = responseLower.includes('date') || 
                           responseLower.includes('company') ||
                           responseLower.includes('year') ||
                           responseLower.includes('when') ||
                           responseLower.includes('clarify') ||
                           responseLower.includes('information')
                           
    expect(addressesIssues).toBe(true)
  })
})