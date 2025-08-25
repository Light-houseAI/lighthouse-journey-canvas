/**
 * Quick test for the hierarchy API integration
 * Run this to verify the API service is working
 */

import { hierarchyApi, type CreateNodePayload } from './services/hierarchy-api';

async function testHierarchyApi() {
  console.log('🧪 Testing Hierarchy API Integration...');
  
  try {
    // Test 1: List existing nodes
    console.log('\n1. Listing existing nodes...');
    const nodes = await hierarchyApi.listNodes();
    console.log(`✅ Found ${nodes.length} nodes`);
    console.log('Sample node:', nodes[0]);

    // Test 2: Build hierarchy tree
    console.log('\n2. Building hierarchy tree...');
    const tree = hierarchyApi.buildHierarchyTree(nodes);
    console.log(`✅ Tree built with ${tree.nodes.length} nodes and ${tree.edges.length} edges`);
    console.log('Root nodes:', hierarchyApi.findRoots(nodes).length);

    // Test 3: Create a new test node
    console.log('\n3. Creating test node...');
    const testPayload: CreateNodePayload = {
      type: 'project',
      meta: {
        title: 'Test Hierarchy Integration',
        description: 'Testing the simplified hierarchy system',
        status: 'active',
        technologies: ['React', 'TypeScript', 'React Flow']
      }
    };

    const newNode = await hierarchyApi.createNode(testPayload);
    console.log('✅ Created node:', newNode.id);

    // Test 4: Update the test node
    console.log('\n4. Updating test node...');
    const updatedNode = await hierarchyApi.updateNode(newNode.id, {
      meta: {
        ...newNode.meta,
        status: 'completed'
      }
    });
    console.log('✅ Updated node status to completed');

    // Test 5: Delete the test node
    console.log('\n5. Cleaning up test node...');
    await hierarchyApi.deleteNode(newNode.id);
    console.log('✅ Test node deleted');

    console.log('\n🎉 All API tests passed!');

  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

// Export for manual testing
export { testHierarchyApi };

// Auto-run when file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testHierarchyApi();
}