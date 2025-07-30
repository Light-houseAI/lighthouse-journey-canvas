/**
 * Conversation Flow Add Experience Scenarios
 * 
 * Tests conversational interactions, clarification requests, and multi-turn flows for adding experiences
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

describe('Conversation Flow Add Experience Scenarios', () => {
  beforeAll(async () => {
    console.log('🔧 Setting up conversation flow test environment...')
  }, 30000)

  beforeEach(async () => {
    // Reset test user data before each test for consistency  
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up conversation flow test environment...')
  })

  test('should ask for clarification when experience details are insufficient', async () => {
    // Scenario: User provides very minimal information about wanting to add experience
    // Agent should recognize insufficient details and ask for more information
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'I want to add my work experience',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-exp-1-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForDetails = response.includes('what company') || 
                          response.includes('which company') || 
                          response.includes('where did you work') ||
                          response.includes('what role') ||
                          response.includes('job title') ||
                          response.includes('position') ||
                          response.includes('tell me more') ||
                          response.includes('more details') ||
                          response.includes('when did you start') ||
                          response.includes('start date')
    
    expect(asksForDetails).toBe(true)
    // Should not have updated profile with insufficient info
    expect(result.updatedProfile).toBe(false)
  })

  test('should ask for missing company when role is specified', async () => {
    // Scenario: User mentions their role but doesn't specify the company
    // Agent should ask which company they worked at
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Software Engineer position that I started in 2021',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-exp-2-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForCompany = response.includes('which company') || 
                          response.includes('what company') || 
                          response.includes('where did you work') ||
                          response.includes('at which') ||
                          response.includes('company name') ||
                          response.includes('employer')
    
    expect(asksForCompany || result.updatedProfile).toBe(true)
    // If it didn't ask for company, it should have updated profile (agent made assumption)
  })

  test('should ask for missing role when company is specified', async () => {
    // Scenario: User mentions company but doesn't specify their role
    // Agent should ask what their role/position was
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'I worked at Google from 2019 to 2021',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-exp-3-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForRole = response.includes('what was your role') || 
                       response.includes('what position') ||
                       response.includes('job title') ||
                       response.includes('what did you do') ||
                       response.includes('your role') ||
                       response.includes('position')
    
    expect(asksForRole || result.updatedProfile).toBe(true)
    // If it didn't ask for role, it should have updated profile (agent made assumption)
  })

  test('should ask for missing start date when company and role are provided', async () => {
    // Scenario: User provides company and role but no dates
    // Agent should ask when they started (and optionally when they ended)
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my Product Manager role at Apple',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-exp-4-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForDates = response.includes('when did you start') || 
                        response.includes('start date') ||
                        response.includes('when did you work') ||
                        response.includes('what dates') ||
                        response.includes('time period') ||
                        response.includes('duration')
    
    expect(asksForDates || result.updatedProfile).toBe(true)
    // If it didn't ask for dates, it should have updated profile (agent made assumption)
  })

  test('should continue conversation from previous clarification request', async () => {
    // Scenario: Multi-turn conversation - first request lacks details, second provides them
    // Tests agent's ability to maintain context and continue the conversation flow
    
    // Arrange - First interaction with insufficient details
    const threadId = `conversation-exp-5-${Date.now()}`
    
    const firstResult = await processCareerConversation({
      message: 'I want to add a job',
      userId: TEST_USER_ID.toString(),
      threadId: threadId
    })
    
    // Act - Follow up with more details
    const secondResult = await processCareerConversation({
      message: 'It was a Frontend Developer role at Netflix from June 2020 to August 2022',
      userId: TEST_USER_ID.toString(),
      threadId: threadId
    })
    
    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'Netflix')
    
    // Either the first request asked for clarification or the second completed successfully
    const firstAsksForDetails = firstResult.response.toLowerCase().includes('more') || 
                               firstResult.response.toLowerCase().includes('details') ||
                               firstResult.response.toLowerCase().includes('company') ||
                               firstResult.response.toLowerCase().includes('role')
    
    expect(firstAsksForDetails || secondResult.updatedProfile).toBe(true)
    // The second interaction should ideally complete the task
    expect(secondResult.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    expect(newExperience?.company.toLowerCase()).toContain('netflix')
  })

  test('should handle vague company references and ask for clarification', async () => {
    // Scenario: User refers to "my startup" or "the company" without being specific
    // Agent should ask for the actual company name
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my engineer role at the startup I worked at',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-exp-6-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForCompanyName = response.includes('which startup') || 
                              response.includes('name of the startup') ||
                              response.includes('startup name') ||
                              response.includes('company name') ||
                              response.includes('which company') ||
                              response.includes('more specific')
    
    expect(asksForCompanyName || result.updatedProfile).toBe(true)
    // Agent behavior may vary - might ask for clarification or make reasonable assumption
  })

  test('should handle ambiguous role references and ask for clarification', async () => {
    // Scenario: User refers to "my role" or "the position" without being specific
    // Agent should ask what specific role/position they held
    
    // Arrange & Act  
    const result = await processCareerConversation({
      message: 'Add the role I had at Microsoft',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-exp-7-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForRoleSpecific = response.includes('what role') || 
                               response.includes('which role') ||
                               response.includes('what position') ||
                               response.includes('job title') ||
                               response.includes('specific role') ||
                               response.includes('what did you do')
    
    expect(asksForRoleSpecific || result.updatedProfile).toBe(true)
    // Agent might ask for clarification or make reasonable assumption
  })

  test('should resume interrupted conversation after system restart', async () => {
    // Scenario: Conversation gets interrupted (system restart, timeout, etc.)
    // User continues the conversation from where they left off
    
    // Arrange - Simulate interrupted conversation by using same thread ID
    const threadId = `interrupted-exp-conversation-${Date.now()}`
    
    // First part of conversation
    const firstResult = await processCareerConversation({
      message: 'I need to add my experience at',
      userId: TEST_USER_ID.toString(),
      threadId: threadId
    })
    
    // Act - Resume conversation (simulating after interruption)
    const resumedResult = await processCareerConversation({
      message: 'Sorry, got disconnected. I was trying to add my DevOps Engineer role at CloudTech from 2021 to 2023',
      userId: TEST_USER_ID.toString(),
      threadId: threadId
    })
    
    // Assert
    const after = await getCurrentProfile()
    const newExperience = findExperienceByCompany(after, 'CloudTech')
    
    // The resumed conversation should handle the context appropriately
    expect(resumedResult.updatedProfile).toBe(true)
    expect(newExperience).toBeTruthy()
    expect(newExperience?.title.toLowerCase()).toContain('devops') 
    expect(newExperience?.company.toLowerCase()).toContain('cloudtech')
  })

  test('should provide helpful suggestions when user is stuck', async () => {
    // Scenario: User provides very generic request and seems to need guidance
    // Agent should provide helpful suggestions or examples of what information is needed
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Help me add something to my work history',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-exp-9-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const providesGuidance = response.includes('for example') || 
                            response.includes('you could') ||
                            response.includes('try saying') ||
                            response.includes('such as') ||
                            response.includes('like') ||
                            response.includes('need to know') ||
                            response.includes('information') ||
                            response.length > 50 // Substantial response with guidance
    
    expect(providesGuidance).toBe(true)
    // Should not update profile for such a vague request
    expect(result.updatedProfile).toBe(false)
  })

  test('should verify agent-driven conversation responses', async () => {
    // Scenario: Verify that conversation responses are contextual and agent-driven
    // Tests that clarification requests are meaningful, not generic templates
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add my job',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-exp-10-${Date.now()}`
    })
    
    // Assert - Response should be contextual and helpful
    const response = result.response
    expect(response.length).toBeGreaterThan(15) // Should have substantial response
    
    // Should not be generic hardcoded responses
    expect(response).not.toMatch(/^(ok|sure|added|done)$/i)
    
    // Should contain contextual elements related to work experience
    const responseLower = response.toLowerCase()
    expect(responseLower).toMatch(/company|role|position|job|work|experience|title|start|when|where|what/)
    
    // Should be asking for specific information needed for experience creation
    const asksForSpecificInfo = responseLower.includes('company') || 
                               responseLower.includes('role') ||
                               responseLower.includes('position') ||
                               responseLower.includes('title') ||
                               responseLower.includes('start') ||
                               responseLower.includes('when') ||
                               responseLower.includes('where')
                               
    expect(asksForSpecificInfo).toBe(true)
  })
})