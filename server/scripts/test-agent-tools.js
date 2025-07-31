#!/usr/bin/env node

/**
 * Simple test script to verify that the career agent and tools are working
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5003';
const TEST_USER_ID = 'test-user-123';

async function testAgentTools() {
  console.log('🚀 Testing Career Agent Tools...\n');

  // Test data
  const testMessage = 'I just completed a major project at my current company. I built a new dashboard feature using React and TypeScript that improved user engagement by 30%. It took me 3 months to complete and I worked with a team of 4 developers.';

  try {
    console.log('📤 Sending message to agent...');
    console.log('Message:', testMessage);
    console.log('\n⏳ Waiting for agent response...\n');

    const response = await axios.post(`${BASE_URL}/api/ai/chat`, {
      message: testMessage,
      userId: TEST_USER_ID,
      userInterest: 'grow-career',
      profileData: {
        name: 'Test User',
        headline: 'Software Developer',
        experiences: [{
          title: 'Frontend Developer',
          company: 'Tech Corp',
          start: '2023-01-01',
          description: 'Building user interfaces'
        }]
      }
    }, {
      timeout: 30000, // 30 seconds timeout
      responseType: 'stream'
    });

    console.log('📥 Streaming response received:');
    console.log('Status:', response.status);
    
    // Parse the SSE stream
    let fullResponse = '';
    let milestoneData = null;
    
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              fullResponse += data.content;
              process.stdout.write(data.content);
            } else if (data.type === 'milestone') {
              milestoneData = data.data;
              console.log('\n🎯 Milestone detected:', JSON.stringify(milestoneData, null, 2));
            } else if (data.type === 'done') {
              console.log('\n\n✅ Stream completed');
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      }
    });

    return new Promise((resolve, reject) => {
      response.data.on('end', () => {
        console.log('\n\n📋 Test Results:');
        console.log('- Full response length:', fullResponse.length);
        console.log('- Milestone created:', milestoneData ? '✅ YES' : '❌ NO');
        if (milestoneData) {
          console.log('- Milestone count:', milestoneData.milestones?.length || 0);
          console.log('- Milestone titles:', milestoneData.milestones?.map(m => m.title) || []);
        }
        resolve({ fullResponse, milestoneData });
      });

      response.data.on('error', reject);
      
      // Timeout fallback
      setTimeout(() => {
        resolve({ fullResponse, milestoneData });
      }, 25000);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    return null;
  }
}

async function testBasicConnection() {
  try {
    console.log('🔗 Testing basic server connection...');
    const response = await axios.get(`${BASE_URL}/`, { timeout: 5000 });
    console.log('✅ Server connection successful');
    return true;
  } catch (error) {
    console.error('❌ Server connection failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Career Agent Tools Test Suite\n');
  
  // Test basic connection first
  const connectionOk = await testBasicConnection();
  if (!connectionOk) {
    console.log('\n❌ Cannot proceed - server is not responding');
    process.exit(1);
  }

  // Test agent tools
  const result = await testAgentTools();
  
  if (result) {
    console.log('\n🎉 Agent test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('- Check if tools are being called correctly');
    console.log('- Verify milestone creation in database');
    console.log('- Test other tool operations (update, find, delete)');
  } else {
    console.log('\n❌ Agent test failed');
  }
}

// Run the tests
runTests().catch(console.error);