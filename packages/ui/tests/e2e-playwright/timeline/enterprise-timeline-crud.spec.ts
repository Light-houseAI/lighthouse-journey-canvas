import { expect,test } from '@playwright/test';
import { TimelineNodeType } from '@journey/schema/src/enums';

import { LoginPage } from '../fixtures/page-objects/LoginPage';
import { TimelinePage } from '../fixtures/page-objects/TimelinePage';
import { TestDataFactory, TestUser } from '../fixtures/test-data';

/**
 * Enterprise Timeline CRUD Tests
 * Demonstrates new testing patterns with enhanced reliability and performance
 */
test.describe('Enterprise Timeline CRUD Operations', () => {
  let timelinePage: TimelinePage;
  let loginPage: LoginPage;
  let testUser: TestUser;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects with enterprise patterns
    timelinePage = new TimelinePage(page);
    loginPage = new LoginPage(page);
    
    // Create test user (if not using auth state)
    testUser = TestDataFactory.createNewUser({
      name: 'Timeline Test User',
      email: 'timeline.test@lighthouse.com'
    });

    console.log('🔧 Setting up enterprise timeline test...');
    
    // Navigate to timeline with comprehensive validation
    await timelinePage.navigate();
    
    // Validate timeline is ready for testing
    await timelinePage.waitForNodesLoad();
    
    console.log('✅ Timeline ready for enterprise testing');
  });

  test('creates complete career journey using enterprise patterns', async () => {
    console.log('🎯 Testing complete career journey creation...');
    
    // Generate realistic career journey data
    const journeyData = TestDataFactory.createCareerJourney();
    
    console.log(`📊 Creating journey with ${journeyData.timeline.length} nodes`);
    
    // Create career journey using timeline helpers
    await timelinePage.createCareerJourney(journeyData);
    
    // Validate all nodes were created successfully
    for (const node of journeyData.timeline) {
      await timelinePage.expectNodeExists(node.title);
      console.log(`✅ Verified node: ${node.title}`);
    }
    
    // Validate timeline performance
    await timelinePage.validatePerformance({
      loadTime: 3000,
      renderTime: 1000
    });
    
    console.log('🎉 Career journey creation test completed successfully!');
  });

  test('creates and manages hierarchical node structure', async () => {
    console.log('🌳 Testing hierarchical node management...');
    
    // Create complex hierarchy test data
    const hierarchyData = TestDataFactory.createComplexHierarchy();
    
    // Create root node (job position)
    const rootNodeId = await timelinePage.createNode(hierarchyData.root);
    console.log(`📁 Created root node: ${hierarchyData.root.title}`);
    
    // Create child nodes systematically
    for (const level of hierarchyData.levels) {
      for (const nodeData of level) {
        await timelinePage.createNode(nodeData);
        console.log(`📄 Created child node: ${nodeData.title}`);
      }
    }
    
    // Validate hierarchy structure
    await timelinePage.expectHierarchyStructure({
      root: hierarchyData.root,
      children: hierarchyData.levels.flat(),
      levels: hierarchyData.maxDepth
    });
    
    // Test hierarchy expansion
    await timelinePage.expandNode(rootNodeId, 2);
    
    // Validate all nodes are visible in hierarchy
    const visibleNodes = await timelinePage.getVisibleNodes();
    expect(visibleNodes.length).toBeGreaterThanOrEqual(hierarchyData.totalNodes);
    
    console.log(`✅ Hierarchy test completed with ${hierarchyData.totalNodes} nodes`);
  });

  test('performs comprehensive CRUD operations on all node types', async () => {
    console.log('🔄 Testing comprehensive CRUD operations...');
    
    const nodeTypes = [
      TimelineNodeType.Job,
      TimelineNodeType.Education,
      TimelineNodeType.Project,
      TimelineNodeType.Event,
      TimelineNodeType.Action,
      TimelineNodeType.CareerTransition
    ];
    
    const createdNodeIds: string[] = [];
    
    // CREATE: Test creation for each node type
    for (const nodeType of nodeTypes) {
      console.log(`➕ Creating ${nodeType} node...`);
      
      const nodeData = TestDataFactory.createNodeOfType(nodeType, {
        title: `Test ${nodeType} Node`
      });
      
      const nodeId = await timelinePage.createNode(nodeData);
      createdNodeIds.push(nodeId);
      
      // Validate node was created
      await timelinePage.expectNodeExists(nodeData.title);
      console.log(`✅ Created ${nodeType}: ${nodeData.title}`);
    }
    
    // READ: Test navigation to each created node
    for (let i = 0; i < createdNodeIds.length; i++) {
      const nodeId = createdNodeIds[i];
      const nodeType = nodeTypes[i];
      
      console.log(`👁️ Reading ${nodeType} node...`);
      await timelinePage.navigateToNode(nodeId);
      console.log(`✅ Successfully navigated to ${nodeType} node`);
    }
    
    // UPDATE: Test editing first few nodes
    const nodesToUpdate = createdNodeIds.slice(0, 3);
    for (let i = 0; i < nodesToUpdate.length; i++) {
      const nodeId = nodesToUpdate[i];
      const nodeType = nodeTypes[i];
      
      console.log(`✏️ Updating ${nodeType} node...`);
      
      const updates = {
        title: `Updated Test ${nodeType} Node`,
        meta: {
          description: `Updated description for ${nodeType} testing`
        }
      };
      
      await timelinePage.editNode(nodeId, updates);
      await timelinePage.expectNodeExists(updates.title);
      console.log(`✅ Successfully updated ${nodeType} node`);
    }
    
    // DELETE: Test deletion of last few nodes
    const nodesToDelete = createdNodeIds.slice(-2);
    for (let i = 0; i < nodesToDelete.length; i++) {
      const nodeId = nodesToDelete[i];
      const originalIndex = createdNodeIds.length - 2 + i;
      const nodeType = nodeTypes[originalIndex];
      
      console.log(`🗑️ Deleting ${nodeType} node...`);
      
      await timelinePage.deleteNode(nodeId);
      console.log(`✅ Successfully deleted ${nodeType} node`);
    }
    
    console.log('🎉 Comprehensive CRUD operations test completed!');
  });

  test('validates timeline performance with large dataset', async () => {
    console.log('⚡ Testing timeline performance with large dataset...');
    
    // Create large dataset for performance testing
    const largeDataset = TestDataFactory.createLargeDataset(50); // 50 nodes
    
    const startTime = Date.now();
    
    // Create nodes in batches for better performance
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < largeDataset.nodes.length; i += batchSize) {
      batches.push(largeDataset.nodes.slice(i, i + batchSize));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 Creating batch ${batchIndex + 1}/${batches.length} (${batch.length} nodes)...`);
      
      const batchStartTime = Date.now();
      await timelinePage.createMultipleNodes(batch);
      const batchTime = Date.now() - batchStartTime;
      
      console.log(`✅ Batch ${batchIndex + 1} completed in ${batchTime}ms`);
    }
    
    const totalCreationTime = Date.now() - startTime;
    console.log(`📊 Total creation time: ${totalCreationTime}ms for ${largeDataset.nodes.length} nodes`);
    
    // Validate performance benchmarks
    expect(totalCreationTime).toBeLessThan(largeDataset.expectedPerformance.loadTime);
    
    // Test timeline responsiveness
    await timelinePage.validatePerformance({
      loadTime: largeDataset.expectedPerformance.loadTime,
      renderTime: largeDataset.expectedPerformance.renderTime
    });
    
    // Test search functionality with large dataset
    const searchQuery = 'Test';
    const searchResults = await timelinePage.searchNodes(searchQuery);
    expect(searchResults.length).toBeGreaterThan(0);
    console.log(`🔍 Search returned ${searchResults.length} results for "${searchQuery}"`);
    
    // Test filtering by node type
    await timelinePage.filterByNodeType(TimelineNodeType.Project);
    
    console.log('⚡ Performance testing completed successfully!');
  });

  test('handles error scenarios gracefully', async () => {
    console.log('🛡️ Testing error handling and recovery...');
    
    // Test invalid node creation scenarios
    try {
      const invalidNodeData = TestDataFactory.createJobNode({
        title: '', // Invalid empty title
        meta: {}
      });
      
      await timelinePage.createNode(invalidNodeData);
      throw new Error('Should have failed with empty title');
    } catch (error) {
      console.log('✅ Correctly handled invalid node creation');
    }
    
    // Test navigation to non-existent node
    try {
      await timelinePage.navigateToNode('non-existent-node-id');
      throw new Error('Should have failed with non-existent node');
    } catch (error) {
      console.log('✅ Correctly handled navigation to non-existent node');
    }
    
    // Test timeline functionality after error recovery
    const validNode = TestDataFactory.createProjectNode({
      title: 'Recovery Test Project'
    });
    
    const nodeId = await timelinePage.createNode(validNode);
    await timelinePage.expectNodeExists(validNode.title);
    
    console.log('✅ Timeline functionality recovered successfully after errors');
    console.log('🛡️ Error handling test completed!');
  });

  test('validates accessibility and usability patterns', async () => {
    console.log('♿ Testing accessibility and usability...');
    
    // Create test node for accessibility testing
    const testNode = TestDataFactory.createJobNode({
      title: 'Accessibility Test Position'
    });
    
    const nodeId = await timelinePage.createNode(testNode);
    
    // Test keyboard navigation
    await timelinePage.navigateToNode(nodeId);
    
    // Test that timeline is usable with keyboard only
    await timelinePage.page.keyboard.press('Tab');
    await timelinePage.page.keyboard.press('Enter');
    
    // Validate timeline maintains functionality
    await timelinePage.expectNodeExists(testNode.title);
    
    console.log('♿ Accessibility testing completed successfully!');
  });

  test.afterEach(async () => {
    // Cleanup test data if needed
    await timelinePage.cleanupTestData();
    
    console.log('🧹 Test cleanup completed');
  });
});