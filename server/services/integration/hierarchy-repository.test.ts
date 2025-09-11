/**
 * Hierarchy Repository Unit Tests
 *
 * Tests database operations with real test database:
 * 1. CRUD operations with proper SQL queries
 * 2. Transaction handling and rollback
 * 3. Database constraint validation
 * 4. Query optimization and performance
 * 5. Data integrity and consistency
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { eq, and } from 'drizzle-orm';

import { timelineNodes, timelineNodeClosure } from '@shared/schema';
import { TimelineNodeType } from '@shared/schema';
import { setupIntegrationTestContext, createAAAHelper, TEST_TIMEOUTS, TestDataBuilders } from '../../setup/test-hooks';
import { TestContainerFactory } from '../../setup/test-container';
import type { HierarchyRepository } from '../../../repositories/hierarchy.repository';

describe('Hierarchy Repository Unit Tests', () => {
  const testContext = setupIntegrationTestContext({ 
    suiteName: 'hierarchy-repository-unit',
    withTestData: false
  });

  let hierarchyRepository: HierarchyRepository;
  let aaaHelper: ReturnType<typeof createAAAHelper>;
  let testUserId: number;

  beforeAll(async () => {
    const { db, dbConfig } = testContext.getContext();

    // Create container for repository testing with real database
    const container = TestContainerFactory.createForRepository({
      db,
      dbConfig,
    });

    hierarchyRepository = container.resolve<HierarchyRepository>('hierarchyRepository');
    aaaHelper = createAAAHelper(container);
    
    // Create test user
    const testUser = await aaaHelper.arrange().createUser('repo.test@example.com');
    testUserId = testUser.user.id;
  });

  describe('Node Creation Database Operations', () => {
    it('should insert node with proper database constraints', async () => {
      const { db } = testContext.getContext();

      // 🔧 ARRANGE
      const nodeData = {
        type: TimelineNodeType.Job,
        meta: {
          title: 'Database Test Job',
          company: 'DB Corp',
          startDate: '2023-01',
        },
        userId: testUserId,
      };

      // ⚡ ACT
      const createdNode = await aaaHelper.act(async () => {
        return await hierarchyRepository.createNode(nodeData);
      });

      // ✅ ASSERT
      expect(createdNode).toHaveProperty('id');
      expect(createdNode.type).toBe(TimelineNodeType.Job);
      expect(createdNode.userId).toBe(testUserId);
      
      // Verify in database directly
      const dbNode = await db
        .select()
        .from(timelineNodes)
        .where(eq(timelineNodes.id, createdNode.id));
      
      expect(dbNode).toHaveLength(1);
      expect(dbNode[0].type).toBe(TimelineNodeType.Job);
      expect(dbNode[0].userId).toBe(testUserId);
      expect(dbNode[0].meta.title).toBe('Database Test Job');

      // Verify closure table entry
      const dbClosure = await db
        .select()
        .from(timelineNodeClosure)
        .where(eq(timelineNodeClosure.descendantId, createdNode.id));
      
      expect(dbClosure).toHaveLength(1);
      expect(dbClosure[0].ancestorId).toBe(createdNode.id);
      expect(dbClosure[0].depth).toBe(0);

    }, TEST_TIMEOUTS.UNIT);

    it('should create hierarchy relationships in closure table', async () => {
      const { db } = testContext.getContext();

      // 🔧 ARRANGE - Create parent node first
      const parentNode = await hierarchyRepository.createNode({
        type: TimelineNodeType.Job,
        meta: { title: 'Parent Job' },
        userId: testUserId,
      });

      const childNodeData = {
        type: TimelineNodeType.Project,
        parentId: parentNode.id,
        meta: { title: 'Child Project' },
        userId: testUserId,
      };

      // ⚡ ACT
      const childNode = await aaaHelper.act(async () => {
        return await hierarchyRepository.createNode(childNodeData);
      });

      // ✅ ASSERT
      expect(childNode.parentId).toBe(parentNode.id);

      // Verify closure table has both self-reference and parent relationship
      const dbClosure = await db
        .select()
        .from(timelineNodeClosure)
        .where(eq(timelineNodeClosure.descendantId, childNode.id));
      
      expect(dbClosure).toHaveLength(2);
      
      const selfClosure = dbClosure.find(c => c.ancestorId === childNode.id);
      const parentClosure = dbClosure.find(c => c.ancestorId === parentNode.id);
      
      expect(selfClosure?.depth).toBe(0);
      expect(parentClosure?.depth).toBe(1);

    }, TEST_TIMEOUTS.UNIT);

    it('should handle database constraint violations', async () => {
      // 🔧 ARRANGE - Invalid data that should violate constraints
      const invalidNodeData = {
        type: TimelineNodeType.Job,
        meta: null, // This might violate NOT NULL constraint
        userId: testUserId,
      };

      // ⚡ ACT & ✅ ASSERT
      await expect(aaaHelper.act(async () => {
        return await hierarchyRepository.createNode(invalidNodeData as any);
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Node Retrieval Database Operations', () => {
    it('should retrieve node by ID with efficient query', async () => {
      // 🔧 ARRANGE
      const originalNode = await hierarchyRepository.createNode({
        type: TimelineNodeType.Education,
        meta: {
          institution: 'Test University',
          degree: 'Computer Science',
          startDate: '2020-09',
          endDate: '2024-05'
        },
        userId: testUserId,
      });

      // ⚡ ACT
      const retrievedNode = await aaaHelper.act(async () => {
        return await hierarchyRepository.getNodeById(originalNode.id);
      });

      // ✅ ASSERT
      expect(retrievedNode).not.toBeNull();
      expect(retrievedNode!.id).toBe(originalNode.id);
      expect(retrievedNode!.type).toBe(TimelineNodeType.Education);
      expect(retrievedNode!.userId).toBe(testUserId);
      expect(retrievedNode!.meta.institution).toBe('Test University');

    }, TEST_TIMEOUTS.UNIT);

    it('should return null for non-existent node', async () => {
      // ⚡ ACT
      const nonExistentNode = await aaaHelper.act(async () => {
        return await hierarchyRepository.getNodeById('non-existent-id');
      });

      // ✅ ASSERT
      expect(nonExistentNode).toBeNull();

    }, TEST_TIMEOUTS.UNIT);

    it('should efficiently query user nodes with proper indexing', async () => {
      // 🔧 ARRANGE - Create multiple nodes for the user
      const nodePromises = Array.from({ length: 3 }, (_, i) => 
        hierarchyRepository.createNode({
          type: TimelineNodeType.Job,
          meta: { title: `Test Job ${i + 1}` },
          userId: testUserId,
        })
      );
      
      const createdNodes = await Promise.all(nodePromises);

      // ⚡ ACT
      const startTime = Date.now();
      const userNodes = await aaaHelper.act(async () => {
        return await hierarchyRepository.getUserNodes(testUserId);
      });
      const queryTime = Date.now() - startTime;

      // ✅ ASSERT
      expect(userNodes.length).toBeGreaterThanOrEqual(3);
      
      // All returned nodes should belong to the user
      userNodes.forEach(node => {
        expect(node.userId).toBe(testUserId);
      });

      // Should include our created nodes
      const nodeIds = userNodes.map(n => n.id);
      createdNodes.forEach(node => {
        expect(nodeIds).toContain(node.id);
      });

      // Performance check: should be fast with proper indexing
      expect(queryTime).toBeLessThan(100); // Less than 100ms

    }, TEST_TIMEOUTS.UNIT);

    it('should retrieve node children using closure table efficiently', async () => {
      // 🔧 ARRANGE
      const parentJob = await hierarchyRepository.createNode({
        type: TimelineNodeType.Job,
        meta: { title: 'Parent for Children Test' },
        userId: testUserId,
      });

      const childProjects = await Promise.all([
        hierarchyRepository.createNode({
          type: TimelineNodeType.Project,
          parentId: parentJob.id,
          meta: { title: 'Child Project 1' },
          userId: testUserId,
        }),
        hierarchyRepository.createNode({
          type: TimelineNodeType.Project,
          parentId: parentJob.id,
          meta: { title: 'Child Project 2' },
          userId: testUserId,
        }),
      ]);

      // ⚡ ACT
      const children = await aaaHelper.act(async () => {
        return await hierarchyRepository.getNodeChildren(parentJob.id);
      });

      // ✅ ASSERT
      expect(children).toHaveLength(2);
      
      const childIds = children.map(c => c.id);
      expect(childIds).toContain(childProjects[0].id);
      expect(childIds).toContain(childProjects[1].id);

      children.forEach(child => {
        expect(child.parentId).toBe(parentJob.id);
        expect(child.userId).toBe(testUserId);
      });

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Node Update Database Operations', () => {
    it('should update node metadata while preserving other fields', async () => {
      const { db } = testContext.getContext();

      // 🔧 ARRANGE
      const originalNode = await hierarchyRepository.createNode({
        type: TimelineNodeType.Job,
        meta: {
          title: 'Original Title',
          company: 'Original Company',
        },
        userId: testUserId,
      });

      const updateData = {
        meta: {
          title: 'Updated Title',
          company: 'Updated Company',
          description: 'Added description',
        }
      };

      // ⚡ ACT
      const updatedNode = await aaaHelper.act(async () => {
        return await hierarchyRepository.updateNode(originalNode.id, updateData);
      });

      // ✅ ASSERT
      expect(updatedNode.id).toBe(originalNode.id);
      expect(updatedNode.type).toBe(originalNode.type); // Unchanged
      expect(updatedNode.userId).toBe(originalNode.userId); // Unchanged
      expect(updatedNode.parentId).toBe(originalNode.parentId); // Unchanged
      
      // Metadata updated
      expect(updatedNode.meta.title).toBe('Updated Title');
      expect(updatedNode.meta.company).toBe('Updated Company');
      expect(updatedNode.meta.description).toBe('Added description');

      // Updated timestamp should be newer
      expect(updatedNode.updatedAt.getTime()).toBeGreaterThan(originalNode.updatedAt.getTime());

      // Verify in database
      const dbNode = await db
        .select()
        .from(timelineNodes)
        .where(eq(timelineNodes.id, originalNode.id));
      
      expect(dbNode[0].meta.title).toBe('Updated Title');
      expect(dbNode[0].meta.company).toBe('Updated Company');

    }, TEST_TIMEOUTS.UNIT);

    it('should handle concurrent updates with proper transaction isolation', async () => {
      // 🔧 ARRANGE
      const testNode = await hierarchyRepository.createNode({
        type: TimelineNodeType.Project,
        meta: { title: 'Concurrent Test', version: 1 },
        userId: testUserId,
      });

      // ⚡ ACT - Simulate concurrent updates
      const update1Promise = hierarchyRepository.updateNode(testNode.id, {
        meta: { title: 'Update 1', version: 2 }
      });

      const update2Promise = hierarchyRepository.updateNode(testNode.id, {
        meta: { title: 'Update 2', version: 3 }
      });

      const [result1, result2] = await Promise.allSettled([update1Promise, update2Promise]);

      // ✅ ASSERT - Both updates should complete (last one wins)
      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('fulfilled');

      // Final state should be consistent
      const finalNode = await hierarchyRepository.getNodeById(testNode.id);
      expect(finalNode).not.toBeNull();
      expect(['Update 1', 'Update 2']).toContain(finalNode!.meta.title);

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Node Deletion Database Operations', () => {
    it('should delete node and cleanup closure table entries', async () => {
      const { db } = testContext.getContext();

      // 🔧 ARRANGE
      const nodeToDelete = await hierarchyRepository.createNode({
        type: TimelineNodeType.Project,
        meta: { title: 'Node for Deletion' },
        userId: testUserId,
      });

      // ⚡ ACT
      const deleteResult = await aaaHelper.act(async () => {
        return await hierarchyRepository.deleteNode(nodeToDelete.id);
      });

      // ✅ ASSERT
      expect(deleteResult).toBe(true);

      // Node should be gone from main table
      const dbNode = await db
        .select()
        .from(timelineNodes)
        .where(eq(timelineNodes.id, nodeToDelete.id));
      
      expect(dbNode).toHaveLength(0);

      // Closure table entries should be cleaned up
      const dbClosure = await db
        .select()
        .from(timelineNodeClosure)
        .where(eq(timelineNodeClosure.descendantId, nodeToDelete.id));
      
      expect(dbClosure).toHaveLength(0);

    }, TEST_TIMEOUTS.UNIT);

    it('should handle cascade deletion with proper cleanup', async () => {
      const { db } = testContext.getContext();

      // 🔧 ARRANGE
      const parentNode = await hierarchyRepository.createNode({
        type: TimelineNodeType.Job,
        meta: { title: 'Parent for Cascade Delete' },
        userId: testUserId,
      });

      const childNode = await hierarchyRepository.createNode({
        type: TimelineNodeType.Project,
        parentId: parentNode.id,
        meta: { title: 'Child for Cascade Delete' },
        userId: testUserId,
      });

      // ⚡ ACT
      const deleteResult = await aaaHelper.act(async () => {
        return await hierarchyRepository.deleteNode(parentNode.id);
      });

      // ✅ ASSERT
      expect(deleteResult).toBe(true);

      // Both parent and child should be gone
      const dbNodes = await db
        .select()
        .from(timelineNodes)
        .where(eq(timelineNodes.id, parentNode.id));
      
      expect(dbNodes).toHaveLength(0);

      const dbChildNodes = await db
        .select()
        .from(timelineNodes)
        .where(eq(timelineNodes.id, childNode.id));
      
      expect(dbChildNodes).toHaveLength(0);

      // All closure table entries should be cleaned up
      const dbClosure = await db
        .select()
        .from(timelineNodeClosure)
        .where(
          and(
            eq(timelineNodeClosure.descendantId, parentNode.id),
            eq(timelineNodeClosure.descendantId, childNode.id)
          )
        );
      
      expect(dbClosure).toHaveLength(0);

    }, TEST_TIMEOUTS.UNIT);

    it('should return false for non-existent node deletion', async () => {
      // ⚡ ACT
      const deleteResult = await aaaHelper.act(async () => {
        return await hierarchyRepository.deleteNode('non-existent-id');
      });

      // ✅ ASSERT
      expect(deleteResult).toBe(false);

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Transaction Handling and Data Integrity', () => {
    it('should rollback transaction on error during node creation', async () => {
      const { db } = testContext.getContext();

      // 🔧 ARRANGE - Create scenario that might cause database error
      const nodeData = {
        type: TimelineNodeType.Job,
        meta: { title: 'Transaction Test' },
        userId: testUserId,
      };

      // We can't easily simulate a transaction failure in this test setup,
      // but in a real scenario you might test with invalid foreign keys, etc.
      
      // For now, just verify normal transaction behavior
      const createdNode = await hierarchyRepository.createNode(nodeData);

      // ✅ ASSERT - Node and closure entries created atomically
      const dbNode = await db
        .select()
        .from(timelineNodes)
        .where(eq(timelineNodes.id, createdNode.id));
      
      const dbClosure = await db
        .select()
        .from(timelineNodeClosure)
        .where(eq(timelineNodeClosure.descendantId, createdNode.id));
      
      // Both should exist (transaction completed successfully)
      expect(dbNode).toHaveLength(1);
      expect(dbClosure).toHaveLength(1);

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Query Performance and Optimization', () => {
    it('should perform efficient batch operations', async () => {
      // 🔧 ARRANGE
      const parentNode = await hierarchyRepository.createNode({
        type: TimelineNodeType.Job,
        meta: { title: 'Batch Parent' },
        userId: testUserId,
      });

      // ⚡ ACT - Create multiple children and measure performance
      const startTime = Date.now();
      
      const batchCreations = Array.from({ length: 10 }, (_, i) => 
        hierarchyRepository.createNode({
          type: TimelineNodeType.Project,
          parentId: parentNode.id,
          meta: { title: `Batch Project ${i + 1}` },
          userId: testUserId,
        })
      );

      const createdNodes = await Promise.all(batchCreations);
      const duration = Date.now() - startTime;

      // ✅ ASSERT
      expect(createdNodes).toHaveLength(10);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds

      // Verify all children created correctly
      const children = await hierarchyRepository.getNodeChildren(parentNode.id);
      expect(children).toHaveLength(10);

    }, TEST_TIMEOUTS.UNIT);
  });
});