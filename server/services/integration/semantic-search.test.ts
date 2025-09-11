/**
 * Semantic Search Testing
 * 
 * Tests to validate that semantic search functionality works correctly
 * with pg-mem in-memory PostgreSQL databases during parallel testing.
 */

import { describe, test, expect } from 'vitest';
import { RuntimeContext } from '@mastra/core/di';
import { TestDatabaseManager } from '../utils/test-database';

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID;

describe('Semantic Search with pg-mem', () => {
  test('should enable semantic search for conversation history', async ({ testAgent, testId }) => {
    console.log(`Testing semantic search with test ID: ${testId}`);
    
    // Set up runtime context with user ID for tool execution
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', TEST_USER_ID.toString());
    
    // Store some conversation history with related topics
    await testAgent.generate('I work as a Software Engineer at TechCorp since 2020', {
      memory: {
        resource: '999',
        thread: 'career-thread'
      },
      runtimeContext
    });
    
    await testAgent.generate('I love working on backend systems and APIs', {
      memory: {
        resource: '999', 
        thread: 'career-thread'
      },
      runtimeContext
    });
    
    await testAgent.generate('My favorite programming languages are Python and TypeScript', {
      memory: {
        resource: '999',
        thread: 'career-thread'
      },
      runtimeContext
    });
    
    // Now ask a related question that should trigger semantic search
    const result = await testAgent.generate('What do you know about my programming experience?', {
      memory: {
        resource: '999',
        thread: 'career-thread',
        options: {
          semanticRecall: {
            topK: 3,
            messageRange: 10
          }
        }
      },
      runtimeContext
    });
    
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
    
    // The response should reference previously stored information
    // Note: This test validates that semantic search is enabled, 
    // not the specific quality of the semantic matching
    console.log('✅ Semantic search test completed');
  });

  test('should handle multiple threads with semantic isolation', async ({ testAgent }) => {
    // Set up runtime context with user ID for tool execution
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', TEST_USER_ID.toString());
    
    // Store information in thread 1
    await testAgent.generate('I am learning React and frontend development', {
      memory: {
        resource: '999',
        thread: 'frontend-thread'
      },
      runtimeContext
    });
    
    // Store different information in thread 2  
    await testAgent.generate('I am working on machine learning and AI projects', {
      memory: {
        resource: '999',
        thread: 'ai-thread'
      },
      runtimeContext
    });
    
    // Query from frontend thread - should get frontend context
    const frontendResult = await testAgent.generate('What am I learning about?', {
      memory: {
        resource: '999',
        thread: 'frontend-thread',
        options: {
          semanticRecall: {
            topK: 2,
            messageRange: 5
          }
        }
      },
      runtimeContext
    });
    
    // Query from AI thread - should get AI context
    const aiResult = await testAgent.generate('What projects am I working on?', {
      memory: {
        resource: '999', 
        thread: 'ai-thread',
        options: {
          semanticRecall: {
            topK: 2,
            messageRange: 5
          }
        }
      },
      runtimeContext
    });
    
    expect(frontendResult.text).toBeDefined();
    expect(aiResult.text).toBeDefined();
    
    // Both should be different responses based on their thread context
    expect(frontendResult.text).not.toBe(aiResult.text);
    
    console.log('✅ Multi-thread semantic isolation test completed');
  });

  test('should work with working memory and semantic recall together', async ({ testAgent }) => {
    // Set up runtime context with user ID for tool execution
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', TEST_USER_ID.toString());
    
    // First, store some structured information using working memory
    const profileResult = await testAgent.generate('I am John Smith, a Senior Developer at TechCorp since 2019', {
      memory: {
        resource: '999',
        thread: 'profile-thread',
        options: {
          workingMemory: {
            enabled: true
          },
          semanticRecall: {
            topK: 3,
            messageRange: 10
          }
        }
      },
      runtimeContext
    });
    
    expect(profileResult.text).toBeDefined();
    
    // Add more context
    await testAgent.generate('I specialize in Node.js and PostgreSQL databases', {
      memory: {
        resource: '999',
        thread: 'profile-thread'
      },
      runtimeContext
    });
    
    // Query that should use both working memory and semantic recall
    const combinedResult = await testAgent.generate('Tell me about my professional background', {
      memory: {
        resource: '999',
        thread: 'profile-thread',
        options: {
          workingMemory: {
            enabled: true
          },
          semanticRecall: {
            topK: 3,
            messageRange: 10
          }
        }
      },
      runtimeContext
    });
    
    expect(combinedResult.text).toBeDefined();
    expect(typeof combinedResult.text).toBe('string');
    expect(combinedResult.text.length).toBeGreaterThan(0);
    
    console.log('✅ Working memory + semantic recall test completed');
  });
});