/**
 * Hierarchy Service Unit Tests
 *
 * Tests business logic with test database:
 * 1. Node creation with validation
 * 2. Hierarchy relationship management
 * 3. Authorization and ownership checks
 * 4. Business rule enforcement
 * 5. Error handling and edge cases
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { TimelineNodeType } from '@shared/schema';
import { setupIntegrationTestContext, createAAAHelper, TEST_TIMEOUTS, TestDataBuilders } from '../../setup/test-hooks.js';
import { TestContainerFactory } from '../../setup/test-container.js';
import type { HierarchyService } from '../../../services/hierarchy.service.js';

describe('Hierarchy Service Unit Tests', () => {
  const testContext = setupIntegrationTestContext({ 
    suiteName: 'hierarchy-service-unit',
    withTestData: false
  });

  let hierarchyService: HierarchyService;
  let aaaHelper: ReturnType<typeof createAAAHelper>;
  let testUserId: number;

  beforeAll(async () => {
    const { db, dbConfig } = testContext.getContext();

    // Create container for service testing with real database
    const container = TestContainerFactory.createForUnit({
      db,
      dbConfig,
      mockDependencies: ['aiService', 'emailService'], // Mock external services
    });

    hierarchyService = container.resolve<HierarchyService>('hierarchyService');
    aaaHelper = createAAAHelper(container);
    
    // Create test user
    const testUser = await aaaHelper.arrange().createUser('service.test@example.com');
    testUserId = testUser.user.id;
  });

  describe('Node Creation Business Logic', () => {
    it('should create job node with proper validation', async () => {
      // 🔧 ARRANGE
      const jobData = TestDataBuilders.jobNode({
        meta: {
          title: 'Senior Software Engineer',
          company: 'Tech Innovations Inc',
          startDate: '2023-06',
          endDate: '2024-06',
          description: 'Led development of scalable web applications',
          location: 'San Francisco, CA'
        }
      });

      // ⚡ ACT
      const createdNode = await aaaHelper.act(async () => {
        return await hierarchyService.createNode(jobData, testUserId);
      });

      // ✅ ASSERT
      expect(createdNode).toHaveProperty('id');
      expect(createdNode.type).toBe(TimelineNodeType.Job);
      expect(createdNode.userId).toBe(testUserId);
      expect(createdNode.parentId).toBeNull();
      expect(createdNode.meta.title).toBe('Senior Software Engineer');
      expect(createdNode.meta.company).toBe('Tech Innovations Inc');
      
      // Verify timestamps
      expect(createdNode.createdAt).toBeInstanceOf(Date);
      expect(createdNode.updatedAt).toBeInstanceOf(Date);

    }, TEST_TIMEOUTS.UNIT);

    it('should validate required metadata fields', async () => {
      // 🔧 ARRANGE
      const invalidJobData = {
        type: TimelineNodeType.Job,
        meta: {
          title: '', // Empty title should be invalid
          company: 'Valid Company'
        }
      };

      // ⚡ ACT & ✅ ASSERT
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.createNode(invalidJobData, testUserId);
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.UNIT);

    it('should enforce hierarchy rules for parent-child relationships', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create project node (leaf node)
      const projectNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Test Project' },
        testUserId
      );

      // ⚡ ACT & ✅ ASSERT - Should not allow children under project
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.createNode({
          type: TimelineNodeType.Project,
          parentId: projectNode.id,
          meta: { title: 'Child Project' }
        }, testUserId);
      })).rejects.toThrow(/hierarchy rule/i);

    }, TEST_TIMEOUTS.UNIT);

    it('should validate parent node exists and belongs to user', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create another user and their node
      const otherUser = await arrange.createUser('other.service.test@example.com');
      const otherUserJob = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Other User Job' },
        otherUser.user.id
      );

      // ⚡ ACT & ✅ ASSERT - Cannot create child under another user's node
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.createNode({
          type: TimelineNodeType.Project,
          parentId: otherUserJob.id,
          meta: { title: 'Unauthorized Child' }
        }, testUserId);
      })).rejects.toThrow(/unauthorized/i);

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Node Retrieval Logic', () => {
    it('should retrieve node with complete metadata', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE
      const jobNode = await arrange.createNode(
        TimelineNodeType.Job,
        {
          title: 'Product Manager',
          company: 'Innovation Labs',
          startDate: '2023-01',
          description: 'Led product development initiatives'
        },
        testUserId
      );

      // ⚡ ACT
      const retrievedNode = await aaaHelper.act(async () => {
        return await hierarchyService.getNode(jobNode.id);
      });

      // ✅ ASSERT
      expect(retrievedNode).not.toBeNull();
      expect(retrievedNode!.id).toBe(jobNode.id);
      expect(retrievedNode!.type).toBe(TimelineNodeType.Job);
      expect(retrievedNode!.userId).toBe(testUserId);
      expect(retrievedNode!.meta.title).toBe('Product Manager');
      expect(retrievedNode!.meta.company).toBe('Innovation Labs');

    }, TEST_TIMEOUTS.UNIT);

    it('should return null for non-existent node', async () => {
      // ⚡ ACT
      const nonExistentNode = await aaaHelper.act(async () => {
        return await hierarchyService.getNode('non-existent-id');
      });

      // ✅ ASSERT
      expect(nonExistentNode).toBeNull();

    }, TEST_TIMEOUTS.UNIT);

    it('should filter user nodes correctly', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create multiple nodes for user and others
      await arrange.createNode(TimelineNodeType.Job, { title: 'User Job 1' }, testUserId);
      await arrange.createNode(TimelineNodeType.Job, { title: 'User Job 2' }, testUserId);
      
      const otherUser = await arrange.createUser('filter.test@example.com');
      await arrange.createNode(TimelineNodeType.Job, { title: 'Other User Job' }, otherUser.user.id);

      // ⚡ ACT
      const userNodes = await aaaHelper.act(async () => {
        return await hierarchyService.getUserNodes(testUserId);
      });

      // ✅ ASSERT
      expect(userNodes.length).toBeGreaterThanOrEqual(2);
      userNodes.forEach(node => {
        expect(node.userId).toBe(testUserId);
      });

      // Should not include other user's nodes
      const otherUserTitles = userNodes.map(n => n.meta.title);
      expect(otherUserTitles).not.toContain('Other User Job');

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Node Update Business Logic', () => {
    it('should update node metadata while preserving core properties', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE
      const originalNode = await arrange.createNode(
        TimelineNodeType.Job,
        {
          title: 'Software Engineer',
          company: 'Old Company',
          startDate: '2023-01'
        },
        testUserId
      );

      const updateData = {
        meta: {
          title: 'Senior Software Engineer',
          company: 'New Company Inc',
          startDate: '2023-01',
          endDate: '2024-01',
          description: 'Promoted with increased responsibilities'
        }
      };

      // ⚡ ACT
      const updatedNode = await aaaHelper.act(async () => {
        return await hierarchyService.updateNode(originalNode.id, updateData, testUserId);
      });

      // ✅ ASSERT
      expect(updatedNode.id).toBe(originalNode.id);
      expect(updatedNode.type).toBe(originalNode.type); // Type unchanged
      expect(updatedNode.userId).toBe(testUserId); // User unchanged
      expect(updatedNode.parentId).toBe(originalNode.parentId); // Hierarchy unchanged
      
      // Metadata updated
      expect(updatedNode.meta.title).toBe('Senior Software Engineer');
      expect(updatedNode.meta.company).toBe('New Company Inc');
      expect(updatedNode.meta.endDate).toBe('2024-01');
      expect(updatedNode.meta.description).toBe('Promoted with increased responsibilities');

      // Updated timestamp changed
      expect(updatedNode.updatedAt.getTime()).toBeGreaterThan(originalNode.updatedAt.getTime());

    }, TEST_TIMEOUTS.UNIT);

    it('should prevent unauthorized updates', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create node for another user
      const otherUser = await arrange.createUser('update.unauthorized@example.com');
      const protectedNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Protected Job' },
        otherUser.user.id
      );

      // ⚡ ACT & ✅ ASSERT
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.updateNode(protectedNode.id, {
          meta: { title: 'Hacked Title' }
        }, testUserId);
      })).rejects.toThrow(/unauthorized/i);

    }, TEST_TIMEOUTS.UNIT);

    it('should validate update data schema', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE
      const nodeToUpdate = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Valid Job' },
        testUserId
      );

      // ⚡ ACT & ✅ ASSERT - Invalid metadata should be rejected
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.updateNode(nodeToUpdate.id, {
          meta: {
            title: '', // Empty title invalid
            company: 'Valid Company'
          }
        }, testUserId);
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Node Deletion Business Logic', () => {
    it('should delete leaf node without affecting hierarchy', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE
      const jobNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Job for Deletion Test' },
        testUserId
      );

      const projectNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Project for Deletion' },
        testUserId,
        jobNode.id
      );

      // ⚡ ACT - Delete project (leaf node)
      const deleteResult = await aaaHelper.act(async () => {
        return await hierarchyService.deleteNode(projectNode.id, testUserId);
      });

      // ✅ ASSERT
      expect(deleteResult).toBe(true);

      // Project should be gone
      const deletedProject = await hierarchyService.getNode(projectNode.id);
      expect(deletedProject).toBeNull();

      // Parent job should remain
      const remainingJob = await hierarchyService.getNode(jobNode.id);
      expect(remainingJob).not.toBeNull();

    }, TEST_TIMEOUTS.UNIT);

    it('should handle cascade deletion of parent with children', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE
      const parentJob = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Parent Job for Cascade' },
        testUserId
      );

      const childProject = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Child Project' },
        testUserId,
        parentJob.id
      );

      // ⚡ ACT - Delete parent job
      const deleteResult = await aaaHelper.act(async () => {
        return await hierarchyService.deleteNode(parentJob.id, testUserId);
      });

      // ✅ ASSERT
      expect(deleteResult).toBe(true);

      // Both parent and child should be deleted
      const deletedParent = await hierarchyService.getNode(parentJob.id);
      expect(deletedParent).toBeNull();

      const deletedChild = await hierarchyService.getNode(childProject.id);
      expect(deletedChild).toBeNull();

    }, TEST_TIMEOUTS.UNIT);

    it('should prevent unauthorized deletion', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE
      const otherUser = await arrange.createUser('delete.unauthorized@example.com');
      const protectedNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Protected from Deletion' },
        otherUser.user.id
      );

      // ⚡ ACT & ✅ ASSERT
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.deleteNode(protectedNode.id, testUserId);
      })).rejects.toThrow(/unauthorized/i);

      // Node should still exist
      const stillExists = await hierarchyService.getNode(protectedNode.id);
      expect(stillExists).not.toBeNull();

    }, TEST_TIMEOUTS.UNIT);

    it('should handle deletion of non-existent node', async () => {
      // ⚡ ACT & ✅ ASSERT
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.deleteNode('non-existent-id', testUserId);
      })).rejects.toThrow(/not found/i);

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Hierarchy Relationship Management', () => {
    it('should retrieve node children correctly', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE
      const parentJob = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Parent Job' },
        testUserId
      );

      const project1 = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Project 1' },
        testUserId,
        parentJob.id
      );

      const project2 = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Project 2' },
        testUserId,
        parentJob.id
      );

      // ⚡ ACT
      const children = await aaaHelper.act(async () => {
        return await hierarchyService.getNodeChildren(parentJob.id);
      });

      // ✅ ASSERT
      expect(children).toHaveLength(2);
      
      const childIds = children.map(c => c.id);
      expect(childIds).toContain(project1.id);
      expect(childIds).toContain(project2.id);

      children.forEach(child => {
        expect(child.parentId).toBe(parentJob.id);
        expect(child.userId).toBe(testUserId);
      });

    }, TEST_TIMEOUTS.UNIT);

    it('should return empty array for leaf nodes', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE
      const leafProject = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Leaf Project' },
        testUserId
      );

      // ⚡ ACT
      const children = await aaaHelper.act(async () => {
        return await hierarchyService.getNodeChildren(leafProject.id);
      });

      // ✅ ASSERT
      expect(children).toHaveLength(0);

    }, TEST_TIMEOUTS.UNIT);
  });
});