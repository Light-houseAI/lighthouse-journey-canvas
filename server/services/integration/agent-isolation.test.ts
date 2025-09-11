/**
 * Agent Isolation Tests
 * 
 * Tests to validate that parallel tests run in isolation with separate databases
 */

import { describe, test, expect } from 'vitest';
import { processCareerConversation } from '../../services/ai/simplified-career-agent';

describe('Agent Isolation Tests', () => {
  test('should create isolated agent instance', async ({ testAgent, testId }) => {
    expect(testAgent).toBeDefined();
    expect(testId).toBeDefined();
    expect(testId).toMatch(/^[a-zA-Z0-9_]+$/);
  });

  test('should process career conversation with isolated database', async ({ testAgent }) => {
    const result = await testAgent.process({
      message: 'Hello, I want to add my experience as a Software Engineer at TechCorp',
      userId: '999',
      threadId: 'test-thread'
    });

    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe('string');
  });

  test('should handle multiple conversations independently', async ({ testAgent }) => {
    // First conversation
    const result1 = await testAgent.process({
      message: 'Add my Software Engineer role at TechCorp from 2020 to 2022',
      userId: '999',
      threadId: 'test-thread-1'
    });

    // Second conversation  
    const result2 = await testAgent.process({
      message: 'Add my Product Manager role at StartupCo from 2022 to present',
      userId: '999',
      threadId: 'test-thread-2'
    });

    expect(result1.text).toBeDefined();
    expect(result2.text).toBeDefined();
    expect(result1.text).not.toBe(result2.text);
  });

  test('parallel test 1 - should not interfere with other tests', async ({ testAgent, testId }) => {
    const result = await testAgent.process({
      message: 'I am a Data Scientist at AI Corp',
      userId: '999',
      threadId: `${testId}-thread`
    });

    expect(result.text).toContain('Data Scientist');
  });

  test('parallel test 2 - should not interfere with other tests', async ({ testAgent, testId }) => {
    const result = await testAgent.process({
      message: 'I am a DevOps Engineer at Cloud Inc',
      userId: '999', 
      threadId: `${testId}-thread`
    });

    expect(result.text).toContain('DevOps Engineer');
  });

  test('parallel test 3 - should not interfere with other tests', async ({ testAgent, testId }) => {
    const result = await testAgent.process({
      message: 'I am a Frontend Developer at WebCorp',
      userId: '999',
      threadId: `${testId}-thread`
    });

    expect(result.text).toContain('Frontend Developer');
  });
});