/**
 * Basic Add Experience Scenarios
 *
 * Tests the core functionality of adding new work experiences to user profiles
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

const countExperiences = (profile: ProfileData | null) => {
  return profile?.experiences?.length || 0
}

const findExperienceByCompany = (profile: ProfileData | null, companyName: string) => {
  if (!profile) return null
  return profile.experiences.find(exp =>
    exp.company.toLowerCase().includes(companyName.toLowerCase())
  )
}

describe('Basic Add Experience Scenarios', () => {
  beforeAll(async () => {
    console.log('🔧 Setting up basic add experience test environment...')
  }, 30000)

  beforeEach(async () => {
    // Reset test user data before each test for consistency
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up basic add experience test environment...')
  })

  test('should add new experience with all required fields', async () => {
    // Scenario: User provides complete experience details with all required fields
    // This tests the core functionality of experience creation

    // Arrange
    const before = await getCurrentProfile()
    const initialCount = countExperiences(before)

    // Act
    const result = await processCareerConversation({
      message: 'Add my Software Engineer role at TechCorp from January 2020 to December 2022',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-add-exp-1-${Date.now()}`
    })

    // Assert
    const after = await getCurrentProfile()
    const finalCount = countExperiences(after)
    const newExperience = findExperienceByCompany(after, 'TechCorp')

    expect(result.updatedProfile).toBe(true)
    expect(finalCount).toBeGreaterThan(initialCount)
    expect(newExperience).toBeTruthy()
    expect(newExperience?.title.toLowerCase()).toContain('software engineer')
    expect(newExperience?.company.toLowerCase()).toContain('techcorp')
  })

  test('should add current experience without end date', async () => {
    // Scenario: User adds their current role which doesn't have an end date
    // Tests handling of ongoing/current employment

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'I started as Senior Developer at StartupCo in March 2023 and I still work there',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-add-exp-2-${Date.now()}`
    })

    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'StartupCo')

    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    expect(newExperience?.title.toLowerCase()).toContain('senior developer')
    expect(newExperience?.company.toLowerCase()).toContain('startupco')
    // Current role should not have end date or have empty/null end date
    expect(!newExperience?.end || newExperience?.end === '').toBe(true)
  })

  test('should add experience with optional description', async () => {
    // Scenario: User provides experience with rich description including responsibilities
    // Tests handling of optional description field

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Principal Engineer position at BigTech from 2021 to 2023 where I led the ML platform development team and architected scalable microservices',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-add-exp-3-${Date.now()}`
    })

    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'BigTech')

    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    expect(newExperience?.title.toLowerCase()).toContain('principal engineer')
    expect(newExperience?.company.toLowerCase()).toContain('bigtech')
    // Should have description if agent captured it
    if (newExperience?.description) {
      expect(newExperience.description.toLowerCase()).toMatch(/ml|platform|microservices|led|architected/)
    }
  })

  test('should add experience with minimal details', async () => {
    // Scenario: User provides only basic information without extensive details
    // Tests agent's ability to handle sparse input gracefully

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Developer role at WebCorp from 2019 to 2020',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-add-exp-4-${Date.now()}`
    })

    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'WebCorp')

    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    expect(newExperience?.title.toLowerCase()).toContain('developer')
    expect(newExperience?.company.toLowerCase()).toContain('webcorp')
  })

  test('should add experience with different date formats', async () => {
    // Scenario: User provides dates in various common formats
    // Tests agent's ability to parse different date formats

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my QA Engineer role at TestCorp from June 2018 to Aug 2019',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-add-exp-5-${Date.now()}`
    })

    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'TestCorp')

    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    expect(newExperience?.title.toLowerCase()).toContain('qa') || newExperience?.title.toLowerCase().toContain('engineer')
    expect(newExperience?.company.toLowerCase()).toContain('testcorp')
  })

  test('should add experience for well-known company', async () => {
    // Scenario: User adds experience at a well-known company
    // Tests handling of recognizable company names

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'I worked as Software Engineer at Google from 2017 to 2019',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-add-exp-6-${Date.now()}`
    })

    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'Google')

    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    expect(newExperience?.title.toLowerCase()).toContain('software engineer')
    expect(newExperience?.company.toLowerCase()).toContain('google')
  })

  test('should handle complex role titles', async () => {
    // Scenario: User provides complex/multi-word role titles
    // Tests handling of various job title formats

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Senior Full Stack Software Engineer role at InnovateTech from January 2022 to present',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-add-exp-7-${Date.now()}`
    })

    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'InnovateTech')

    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    expect(newExperience?.company.toLowerCase()).toContain('innovatetech')
    // Role title should contain key parts
    const titleLower = newExperience?.title.toLowerCase() || ''
    expect(titleLower).toMatch(/senior|full|stack|software|engineer/)
  })

  test('should verify agent-driven response quality', async () => {
    // Scenario: Verify that agent provides meaningful, contextual responses
    // Tests that responses are agent-generated, not hardcoded templates

    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Data Scientist position at AnalyticsCorp from 2020 to 2022 where I built machine learning models for customer segmentation',
      userId: TEST_USER_ID.toString(),
      threadId: `basic-add-exp-8-${Date.now()}`
    })

    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'AnalyticsCorp')

    expect(result.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()

    // Verify response quality - should be contextual and mention relevant details
    const response = result.response.toLowerCase()
    expect(response.length).toBeGreaterThan(20) // Should have substantial response
    expect(response).toMatch(/data scientist|analyticscorp|added|success|experience/)

    // Response should not be a generic template
    expect(response).not.toMatch(/^(added experience|success|ok)$/i)
  })
})
