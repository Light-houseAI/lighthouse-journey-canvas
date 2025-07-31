#!/usr/bin/env node

/**
 * Direct test of the career agent and tools without HTTP layer
 */

import { createCareerAgent } from './server/services/ai/career-agent.ts';
import { RuntimeContext } from '@mastra/core/runtime-context';

async function testCareerAgentDirect() {
  console.log('🚀 Testing Career Agent and Tools (Direct)...\n');

  try {
    console.log('📦 Creating career agent...');
    const careerAgent = await createCareerAgent();
    console.log('✅ Career agent created successfully');

    // Test message
    const testMessage = 'I just completed a project at my company. I built a React dashboard that improved user engagement by 30%.';
    console.log('\n📤 Test message:', testMessage);

    // Create runtime context
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', 'test-user-123');
    runtimeContext.set('userInterest', 'grow-career');

    console.log('\n⏳ Generating response...');
    
    // Test the generate method first
    const response = await careerAgent.generate(testMessage, {
      memory: {
        resource: 'user_test-user-123',
        thread: 'test-conversation',
      },
      runtimeContext,
    });

    console.log('\n📥 Agent response:');
    console.log('Text:', response.text?.substring(0, 200) + '...');
    console.log('Has text:', !!response.text);
    console.log('Text length:', response.text?.length || 0);

    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('🔧 Tool calls made:', response.toolCalls.length);
      response.toolCalls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call.toolName} with args:`, call.args);
      });
    } else {
      console.log('🔧 No tool calls made');
    }

    console.log('\n✅ Direct agent test completed successfully!');
    
    return {
      success: true,
      hasResponse: !!response.text,
      responseLength: response.text?.length || 0,
      toolCallsCount: response.toolCalls?.length || 0,
    };

  } catch (error) {
    console.error('\n❌ Direct agent test failed:', error.message);
    console.error('Stack:', error.stack);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runDirectTests() {
  console.log('🧪 Career Agent Direct Test Suite\n');
  
  const result = await testCareerAgentDirect();
  
  if (result.success) {
    console.log('\n🎉 All direct tests passed!');
    console.log(`- Response generated: ${result.hasResponse ? '✅' : '❌'}`);
    console.log(`- Response length: ${result.responseLength} characters`);
    console.log(`- Tool calls: ${result.toolCallsCount}`);
  } else {
    console.log('\n❌ Direct tests failed:', result.error);
  }
}

// Run the tests
runDirectTests().catch(console.error);