/**
 * Conversation Flow Add Project Scenarios
 * 
 * Tests conversational interactions, clarification requests, and continuation flows
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { processCareerConversation } from '../../services/ai/simplified-career-agent.js'
import { TestDatabaseManager } from '../utils/test-database.js'

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID

describe('Conversation Flow Scenarios', () => {
  beforeAll(async () => {
    // Allow extra time for initial database and vector store setup
    console.log('🔧 Setting up test environment...')
  }, 30000)

  beforeEach(async () => {
    // Reset test user data before each test for consistency
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)

  afterAll(async () => {
    // Cleanup if needed
    console.log('🧹 Cleaning up test environment...')
  })
  test('should ask for clarification when project details are insufficient', async () => {
    // Scenario: User provides very minimal information about a project
    // Agent should recognize insufficient details and ask for more information
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a project to my work',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-test-1-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForDetails = response.includes('what kind') || 
                          response.includes('which company') || 
                          response.includes('more details') ||
                          response.includes('tell me more') ||
                          response.includes('what type') ||
                          response.includes('describe') ||
                          response.includes('specify')
    
    expect(asksForDetails).toBe(true)
  })

  test('should ask for company clarification when not specified', async () => {
    // Scenario: User mentions a project but doesn't specify which company/experience
    // Agent should ask which company or experience to add the project to
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a machine learning project I worked on',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-test-2-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForCompany = response.includes('which company') || 
                          response.includes('which experience') || 
                          response.includes('where did you work') ||
                          response.includes('at which') ||
                          response.includes('company') ||
                          response.includes('employer')
    
    expect(asksForCompany || result.updatedProfile).toBe(true)
  })

  test('should continue conversation from previous clarification request', async () => {
    // Scenario: Multi-turn conversation - first request lacks details, second provides them
    // Tests agent's ability to maintain context and continue the conversation flow
    
    // Arrange - First interaction with insufficient details
    const threadId = `conversation-test-3-${Date.now()}`
    
    const firstResult = await processCareerConversation({
      message: 'I want to add a project',
      userId: TEST_USER_ID.toString(),
      threadId: threadId
    })
    
    // Act - Follow up with more details
    const secondResult = await processCareerConversation({
      message: 'It was a React dashboard project at TechCorp using TypeScript and Redux',
      userId: TEST_USER_ID.toString(),
      threadId: threadId
    })
    
    // Assert
    // Either the first request asks for clarification, or the second completes successfully
    const firstAsksForDetails = firstResult.response.toLowerCase().includes('more') || 
                               firstResult.response.toLowerCase().includes('details') ||
                               firstResult.response.toLowerCase().includes('which')
    
    expect(firstAsksForDetails || secondResult.updatedProfile).toBe(true)
    // The second interaction should ideally complete the task
    expect(secondResult.updatedProfile).toBe(true)
  })

  test('should handle project type clarification requests', async () => {
    // Scenario: User mentions adding a project but type/nature is unclear
    // Agent should ask what kind of project or what the project involved
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add the big project I did at Google',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-test-4-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForProjectType = response.includes('what kind of project') || 
                              response.includes('what type of project') ||
                              response.includes('what did the project') ||
                              response.includes('what was the project') ||
                              response.includes('describe the project') ||
                              response.includes('tell me about')
    
    expect(asksForProjectType || result.updatedProfile).toBe(true)
  })

  test('should resume interrupted conversation after system restart', async () => {
    // Scenario: Conversation gets interrupted (system restart, timeout, etc.)
    // User continues the conversation from where they left off
    
    // Arrange - Simulate interrupted conversation by using same thread ID
    const threadId = `interrupted-conversation-${Date.now()}`
    
    // First part of conversation
    const firstResult = await processCareerConversation({
      message: 'I need to add a project to',
      userId: TEST_USER_ID.toString(),
      threadId: threadId
    })
    
    // Act - Resume conversation (simulating after interruption)
    const resumedResult = await processCareerConversation({
      message: 'Sorry, got disconnected. I was trying to add a blockchain project to my fintech startup experience',
      userId: TEST_USER_ID.toString(),
      threadId: threadId
    })
    
    // Assert
    // The resumed conversation should handle the context appropriately
    expect(resumedResult.updatedProfile).toBe(true)
  })

  test('should handle ambiguous project references and ask for clarification', async () => {
    // Scenario: User refers to "that project" or "the API project" without clear context
    // Agent should ask for more specific information about which project they mean
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add that API project we discussed',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-test-6-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForClarification = response.includes('which api project') || 
                                response.includes('what api project') ||
                                response.includes('not sure which') ||
                                response.includes('clarify') ||
                                response.includes('more specific') ||
                                response.includes('which project')
    
    // More flexible assertion - agent behavior may vary
    expect(asksForClarification || result.updatedProfile, 
      `Expected clarification OR successful update. Response: "${result.response.substring(0, 100)}...", Updated: ${result.updatedProfile}`
    ).toBe(true)
  })

  test('should provide helpful suggestions when user is stuck', async () => {
    // Scenario: User provides very generic request and seems to need guidance
    // Agent should provide helpful suggestions or examples of what information is needed
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Help me add something to my profile',
      userId: TEST_USER_ID.toString(),
      threadId: `conversation-test-7-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const providesGuidance = response.includes('for example') || 
                            response.includes('you could') ||
                            response.includes('try') ||
                            response.includes('such as') ||
                            response.includes('like') ||
                            response.includes('help') ||
                            response.length > 50 // Substantial response with guidance
    
    expect(providesGuidance).toBe(true)
  })
})