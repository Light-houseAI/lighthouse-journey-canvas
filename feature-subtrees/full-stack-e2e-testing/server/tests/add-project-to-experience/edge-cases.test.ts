/**
 * Edge Cases Add Project Scenarios
 * 
 * Tests error handling, robustness, and boundary conditions
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestDatabaseManager } from '../utils/test-database.js'
import { processCareerConversation } from '../../services/ai/simplified-career-agent.js'

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID

describe('Edge Cases Scenarios', () => {
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
  test('should handle vague project request gracefully', async () => {
    // Scenario: User provides minimal information without specifying company or details
    // Agent should either ask for clarification or make reasonable assumptions
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a project',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-test-1-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const asksForClarification = response.includes('which') || 
                                response.includes('more information') || 
                                response.includes('company') || 
                                response.includes('details') ||
                                response.includes('help')
    
    // Either successfully adds project or asks for clarification
    expect(asksForClarification || result.updatedProfile).toBe(true)
  })

  test('should handle special characters and formatting in project details', async () => {
    // Scenario: Project description contains special characters, quotes, and symbols
    // Tests robust parsing of complex input formats
    
    // Arrange & Act  
    const result = await processCareerConversation({
      message: 'Add a "Real-Time Analytics & Dashboard" project (using React.js & D3.js) to my TechCorp experience!',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-test-2-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should create new experience for completely unknown startup', async () => {
    // Scenario: User mentions a fictional/unknown company that doesn't exist
    // Agent should create a new experience entry for the unknown company
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a Blockchain project to my startup FutureTech as a Founder',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-test-3-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should handle empty or whitespace-only messages', async () => {
    // Scenario: User sends empty or whitespace-only input
    // Agent should handle this gracefully without crashing
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: '   ',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-test-4-${Date.now()}`
    })
    
    // Assert
    const response = result.response.toLowerCase()
    const handlesGracefully = response.includes('help') || 
                             response.includes('information') || 
                             response.includes('understand') ||
                             response.length > 0
    
    expect(handlesGracefully).toBe(true)
  })

  test('should handle very long project descriptions', async () => {
    // Scenario: User provides an extremely detailed project description
    // Tests agent's ability to process and summarize lengthy input
    
    // Arrange
    const longDescription = `Add a comprehensive Enterprise Resource Planning (ERP) system migration project to my TechCorp experience where I led a team of 15 developers across 3 time zones to migrate legacy COBOL systems to modern microservices architecture using Spring Boot, React, PostgreSQL, Redis, and Kubernetes, implementing CI/CD pipelines with Jenkins and Docker, establishing monitoring with Prometheus and Grafana, and achieving 99.9% uptime during the 18-month transition period while reducing operational costs by 40% and improving system response times by 85%`
    
    // Act
    const result = await processCareerConversation({
      message: longDescription,
      userId: TEST_USER_ID.toString(),
      threadId: `edge-test-5-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })

  test('should handle mixed case and typos in company names', async () => {
    // Scenario: User types company name with inconsistent casing or minor typos
    // Agent should still correctly identify and match the intended company
    
    // Arrange & Act
    const result = await processCareerConversation({
      message: 'Add a DevOps project to techCorp with kubernetes',
      userId: TEST_USER_ID.toString(),
      threadId: `edge-test-6-${Date.now()}`
    })
    
    // Assert
    expect(result.updatedProfile).toBe(true)
  })
})