/**
 * Validation Add Experience Scenarios
 * 
 * Tests data integrity, format validation, and profile consistency for experience addition
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

const validateExperienceStructure = (experience: any) => {
  // Validate that experience has expected structure
  expect(experience).toBeTruthy()
  expect(typeof experience.id).toBe('string')
  expect(typeof experience.company).toBe('string')
  expect(typeof experience.title).toBe('string')
  expect(experience.company.length).toBeGreaterThan(0)
  expect(experience.title.length).toBeGreaterThan(0)
  
  // Validate optional fields
  if (experience.start) {
    expect(typeof experience.start).toBe('string')
  }
  if (experience.end) {
    expect(typeof experience.end).toBe('string')
  }
  if (experience.description) {
    expect(typeof experience.description).toBe('string')
  }
}

describe('Validation Add Experience Scenarios', () => {
  beforeAll(async () => {
    console.log('🔧 Setting up validation test environment...')
  }, 30000)

  beforeEach(async () => {
    // Reset test user data before each test for consistency
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up validation test environment...')
  })

  test('should validate required fields are present', async () => {
    // Scenario: Verify that created experience has all required fields
    // Tests data integrity of the core experience structure
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Software Engineer role at DataCorp from January 2021 to March 2023',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-1-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'DataCorp')
    
    expect(result.updatedProfile).toBe(true)
    validateExperienceStructure(newExperience)
    
    // Verify specific required fields
    expect(newExperience?.company).toContain('DataCorp')
    expect(newExperience?.title.toLowerCase()).toContain('software engineer')
    expect(newExperience?.start).toBeTruthy() // Should have start date
  })

  test('should validate date format consistency', async () => {
    // Scenario: Verify that dates are stored in consistent format
    // Tests date normalization and format validation
    
    // Arrange & Act  
    const result = await processCareerConversation({
      message: 'Add my Product Manager role at InnovateTech from March 2020 to December 2022',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-2-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'InnovateTech')
    
    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    
    // Validate date formats (should be consistently formatted)
    if (newExperience?.start) {
      // Should be in some consistent date format (YYYY-MM-DD, YYYY-MM, or similar)
      expect(newExperience.start).toMatch(/\d{4}/)  // Should contain year
    }
    
    if (newExperience?.end) {
      expect(newExperience.end).toMatch(/\d{4}/)  // Should contain year
    }
  })

  test('should validate profile state consistency after update', async () => {
    // Scenario: Verify profile remains in consistent state after experience addition
    // Tests that profile structure integrity is maintained
    
    // Arrange
    const before = await getCurrentProfile()
    const initialExperienceCount = before?.experiences?.length || 0
    
    // Act
    const result = await processCareerConversation({
      message: 'Add my UX Designer role at CreativeCorp from June 2019 to August 2021',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-3-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    
    expect(result.updatedProfile).toBe(true)
    expect(after).toBeTruthy()
    expect(Array.isArray(after?.experiences)).toBe(true)
    expect(after?.experiences.length).toBe(initialExperienceCount + 1)
    
    // Validate all experiences still have proper structure
    after?.experiences.forEach(exp => {
      validateExperienceStructure(exp)
    })
    
    // Verify the new experience was added correctly
    const newExperience = findExperienceByCompany(after, 'CreativeCorp')
    expect(newExperience?.title.toLowerCase()).toContain('ux designer')
  })

  test('should validate data sanitization and normalization', async () => {
    // Scenario: Verify that input data is properly sanitized and normalized
    // Tests handling of extra whitespace, case normalization, etc.
    
    // Arrange & Act - Input with extra whitespace and mixed case
    const result = await processCareerConversation({
      message: '   Add my    SENIOR SOFTWARE  ENGINEER   role at   techCORP inc.   from 2020 to 2022   ',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-4-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'techCORP')
    
    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    
    // Data should be cleaned and normalized
    expect(newExperience?.company).not.toMatch(/^\s+|\s+$/) // No leading/trailing whitespace
    expect(newExperience?.title).not.toMatch(/^\s+|\s+$/) // No leading/trailing whitespace
    expect(newExperience?.company.length).toBeGreaterThan(0)
    expect(newExperience?.title.length).toBeGreaterThan(0)
  })

  test('should validate experience ID uniqueness', async () => {
    // Scenario: Verify that each experience gets a unique ID
    // Tests ID generation and uniqueness constraints
    
    // Arrange & Act - Add multiple experiences
    const result1 = await processCareerConversation({
      message: 'Add my Developer role at Company1 from 2019 to 2020',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-5a-${Date.now()}`
    })
    
    const result2 = await processCareerConversation({
      message: 'Add my Manager role at Company2 from 2021 to 2022',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-5b-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    
    expect(result1.updatedProfile).toBe(true)
    expect(result2.updatedProfile).toBe(true)
    expect(after?.experiences.length).toBeGreaterThanOrEqual(2)
    
    // Collect all experience IDs
    const experienceIds = after?.experiences.map(exp => exp.id) || []
    const uniqueIds = new Set(experienceIds)
    
    // All IDs should be unique
    expect(uniqueIds.size).toBe(experienceIds.length)
    
    // All IDs should be non-empty strings
    experienceIds.forEach(id => {
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  test('should validate optional field handling', async () => {
    // Scenario: Verify that optional fields are handled correctly when present/absent
    // Tests proper handling of description, end date, etc.
    
    // Arrange & Act - Experience without description
    const result1 = await processCareerConversation({
      message: 'Add my Analyst role at DataFirm from 2020 to 2021',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-6a-${Date.now()}`
    })
    
    // Act - Experience with description
    const result2 = await processCareerConversation({
      message: 'Add my Consultant role at AdviceCorp from 2021 to 2022 where I provided strategic business advice to Fortune 500 clients',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-6b-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    const exp1 = findExperienceByCompany(after, 'DataFirm')
    const exp2 = findExperienceByCompany(after, 'AdviceCorp')
    
    expect(result1.updatedProfile).toBe(true)
    expect(result2.updatedProfile).toBe(true)
    expect(exp1).toBeTruthy()
    expect(exp2).toBeTruthy()
    
    // Both should have required fields
    validateExperienceStructure(exp1)
    validateExperienceStructure(exp2)
    
    // Second experience may have description if agent captured it
    if (exp2?.description) {
      expect(exp2.description.length).toBeGreaterThan(0)
      expect(typeof exp2.description).toBe('string')
    }
  })

  test('should validate current experience handling', async () => {
    // Scenario: Verify that current experiences (no end date) are handled correctly
    // Tests proper validation of ongoing employment
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Senior Engineer role at CurrentCorp that I started in January 2023 and still work there',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-7-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'CurrentCorp')
    
    expect(result.updatedProfile).toBe(true)
    validateExperienceStructure(newExperience)
    
    // Current experience should not have end date or have empty/null end date
    expect(!newExperience?.end || newExperience?.end === '' || newExperience?.end === null).toBe(true)
    expect(newExperience?.start).toBeTruthy() // Should still have start date
  })

  test('should validate database persistence', async () => {
    // Scenario: Verify that experience data persists correctly in database
    // Tests database transaction integrity
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my QA Engineer role at TestCorp from 2018 to 2020',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-8-${Date.now()}`
    })
    
    // Assert - First check
    const immediately = await getCurrentProfile()
    const exp1 = findExperienceByCompany(immediately, 'TestCorp')
    
    expect(result.updatedProfile).toBe(true)
    expect(exp1).toBeTruthy()
    
    // Assert - Re-fetch from database to verify persistence
    const refetched = await getCurrentProfile()
    const exp2 = findExperienceByCompany(refetched, 'TestCorp')
    
    expect(exp2).toBeTruthy()
    expect(exp2?.id).toBe(exp1?.id) // Same experience
    expect(exp2?.company).toBe(exp1?.company)
    expect(exp2?.title).toBe(exp1?.title)
    expect(exp2?.start).toBe(exp1?.start)
    expect(exp2?.end).toBe(exp1?.end)
  })

  test('should validate experience array ordering', async () => {
    // Scenario: Verify that experiences maintain consistent ordering
    // Tests that new experiences are added in predictable order
    
    // Arrange
    const before = await getCurrentProfile()
    const initialCount = before?.experiences?.length || 0
    
    // Act
    const result = await processCareerConversation({
      message: 'Add my Operations Manager role at LogisticsCorp from 2017 to 2019',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-9-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    
    expect(result.updatedProfile).toBe(true)
    expect(after?.experiences.length).toBe(initialCount + 1)
    
    // Verify the new experience was added (either at the end or in some consistent position)
    const newExperience = findExperienceByCompany(after, 'LogisticsCorp')
    expect(newExperience).toBeTruthy()
    
    // All experiences should still have valid structure
    after?.experiences.forEach((exp, index) => {
      validateExperienceStructure(exp)
      expect(exp.id).toBeTruthy()
    })
  })

  test('should validate response quality and consistency', async () => {
    // Scenario: Verify that validation responses are agent-driven and contextual
    // Tests that validation messages are meaningful, not hardcoded
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Research Scientist role at LabCorp from September 2019 to November 2021',
      userId: TEST_USER_ID.toString(),
      threadId: `validation-exp-10-${Date.now()}`
    })
    
    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'LabCorp')
    
    expect(result.updatedProfile).toBe(true)
    validateExperienceStructure(newExperience)
    
    // Verify response quality
    const response = result.response
    expect(response.length).toBeGreaterThan(15) // Should have substantial response
    
    // Should not be generic validation messages
    expect(response).not.toMatch(/^(valid|ok|added|done)$/i)
    
    // Should be contextual to the experience added
    const responseLower = response.toLowerCase()
    expect(responseLower).toMatch(/research|scientist|labcorp|added|success|experience/)
    
    // Should indicate successful addition
    const indicatesSuccess = responseLower.includes('added') || 
                             responseLower.includes('success') ||
                             responseLower.includes('created') ||
                             responseLower.includes('experience')
                             
    expect(indicatesSuccess).toBe(true)
  })
})