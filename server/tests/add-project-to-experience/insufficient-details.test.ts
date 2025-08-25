/**
 * Insufficient Details Add Project Scenarios
 * 
 * Tests agent behavior when project details are missing or incomplete
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestDatabaseManager } from '../utils/test-database.js'
import { processCareerConversation } from '../../services/ai/simplified-career-agent.js'

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID

describe('Insufficient Details Scenarios', () => {
  beforeAll(async () => {
    console.log('🔧 Setting up insufficient details test environment...')
  }, 30000)

  beforeEach(async () => {
    // Reset test user data before each test for consistency
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up insufficient details test environment...')
  })
  test('should request project name when only company is mentioned', async () => {
    // Scenario: User specifies company but no project details
    // Agent should ask what kind of project they want to add
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a project to TechCorp',
      userId: TEST_USER_ID.toString(),
      threadId: `insufficient-test-1-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForProjectDetails = response.includes('what kind of project') || 
                                 response.includes('what type of project') ||
                                 response.includes('what project') ||
                                 response.includes('tell me more') ||
                                 response.includes('describe the project') ||
                                 response.includes('what did you work on')
    
    // Either asks for details or makes reasonable assumption and adds project
    expect(asksForProjectDetails || result.updatedProfile).toBe(true)
  })

  test('should request company when only project type is mentioned', async () => {
    // Scenario: User mentions project type but no company/experience context
    // Agent should ask which company or experience to add it to
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a machine learning project',
      userId: TEST_USER_ID.toString(),
      threadId: `insufficient-test-2-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForCompany = response.includes('which company') || 
                          response.includes('which experience') ||
                          response.includes('where did you work') ||
                          response.includes('at which') ||
                          response.includes('to which experience') ||
                          response.includes('which employer')
    
    expect(asksForCompany || result.updatedProfile).toBe(true)
  })

  test('should handle completely vague requests with helpful prompting', async () => {
    // Scenario: User request is extremely vague with no useful details
    // Agent should provide structured guidance on what information is needed
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add something',
      userId: TEST_USER_ID.toString(),
      threadId: `insufficient-test-3-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const providesStructuredHelp = response.includes('need more information') || 
                                  response.includes('please specify') ||
                                  response.includes('help you add') ||
                                  response.includes('what would you like') ||
                                  response.includes('could you tell me') ||
                                  response.includes('more details')
    
    expect(providesStructuredHelp).toBe(true)
  })

  test('should request missing timeline when project details are provided', async () => {
    // Scenario: User provides project and company but no timeline/dates
    // Agent should either ask for timeline or add project with estimated dates
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a REST API project to TechCorp',
      userId: TEST_USER_ID.toString(),
      threadId: `insufficient-test-4-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForTimeline = response.includes('when did you work') || 
                           response.includes('what dates') ||
                           response.includes('time period') ||
                           response.includes('duration') ||
                           response.includes('start and end')
    
    // Either asks for timeline or successfully adds with reasonable defaults
    expect(asksForTimeline || result.updatedProfile).toBe(true)
  })

  test('should handle partial technology stack information', async () => {
    // Scenario: User mentions some technologies but description is incomplete
    // Agent should either ask for more tech details or work with what's provided
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a web project using React to TechCorp',
      userId: TEST_USER_ID.toString(),
      threadId: `insufficient-test-5-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForMoreTech = response.includes('what other technologies') || 
                           response.includes('additional tools') ||
                           response.includes('backend') ||
                           response.includes('database') ||
                           response.includes('more details about')
    
    // Should either ask for more tech details or successfully add the project
    expect(asksForMoreTech || result.updatedProfile).toBe(true)
  })

  test('should request role clarification when experience context is ambiguous', async () => {
    // Scenario: User has multiple roles at same company, doesn't specify which
    // Agent should ask which role/position the project relates to
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a leadership project to ABCO',
      userId: TEST_USER_ID.toString(),
      threadId: `insufficient-test-6-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForRole = response.includes('which role') || 
                       response.includes('which position') ||
                       response.includes('when you were') ||
                       response.includes('as a') ||
                       response.includes('multiple') ||
                       response.includes('which time')
    
    // Either asks for role clarification or makes reasonable choice
    expect(asksForRole || result.updatedProfile).toBe(true)
  })

  test('should provide example format when user seems confused', async () => {
    // Scenario: User makes repeated vague attempts or seems unsure of format
    // Agent should provide examples of well-formatted project addition requests
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'I don\'t know how to add projects properly',
      userId: TEST_USER_ID.toString(),
      threadId: `insufficient-test-7-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const providesExamples = response.includes('for example') || 
                            response.includes('you can say') ||
                            response.includes('try something like') ||
                            response.includes('here\'s how') ||
                            response.includes('example:') ||
                            response.includes('such as') ||
                            response.includes('format')
    
    expect(providesExamples).toBe(true)
  })
})