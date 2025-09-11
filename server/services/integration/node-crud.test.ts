/**
 * Timeline Node CRUD Integration Tests
 *
 * Tests complete timeline node operations using real services and database:
 * 1. Node creation with hierarchy validation
 * 2. Node reading with parent-child relationships  
 * 3. Node updates with metadata validation
 * 4. Node deletion with cascade handling
 * 5. Batch operations and performance
 *
 * PATTERN: Enhanced AAA with Real Services
 * - ARRANGE: Use real hierarchy services to establish node state
 * - ACT: Execute specific CRUD operations being tested
 * - ASSERT: Verify complete node state including database verification
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

import { timelineNodes, timelineNodeClosure } from '@shared/schema';
import { TimelineNodeType, type CreateNodeDTO, type UpdateNodeDTO } from '@shared/schema';
import { setupIntegrationTestContext, createAAAHelper, TEST_TIMEOUTS, TestDataBuilders } from '../../setup/test-hooks.js';
import type { HierarchyService } from '../../../services/hierarchy.service.js';

describe('Timeline Node CRUD Integration Tests', () => {
  const testContext = setupIntegrationTestContext({ 
    suiteName: 'node-crud',
    withTestData: true
  });

  let hierarchyService: HierarchyService;
  let aaaHelper: ReturnType<typeof createAAAHelper>;
  let testUserId: number;

  beforeAll(() => {
    const { container, testData } = testContext.getContext();
    hierarchyService = container.resolve<HierarchyService>('hierarchyService');
    aaaHelper = createAAAHelper(container);
    testUserId = testData.users.owner.id;
  });

  describe('Node Creation with Hierarchy Validation', () => {
    it('should create job node with proper metadata validation', async () => {
      const { db } = testContext.getContext();
      const arrange = aaaHelper.arrange();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Prepare job node data
      const jobNodeData: CreateNodeDTO = {
        type: TimelineNodeType.Job,
        meta: {
          title: 'Senior Software Engineer',
          company: 'Tech Innovation Corp',
          startDate: '2023-06',
          endDate: '2024-06',
          description: 'Led development of scalable web applications',
          location: 'San Francisco, CA',
          employmentType: 'Full-time'
        }
      };

      // ⚡ ACT - Create job node
      const createdNode = await aaaHelper.act(async () => {
        return await hierarchyService.createNode(jobNodeData, testUserId);
      });

      // ✅ ASSERT - Node created successfully
      expect(createdNode).toHaveProperty('id');
      expect(createdNode.type).toBe(TimelineNodeType.Job);
      expect(createdNode.userId).toBe(testUserId);
      expect(createdNode.parentId).toBeNull();
      expect(createdNode.meta.title).toBe('Senior Software Engineer');
      expect(createdNode.meta.company).toBe('Tech Innovation Corp');

      // Verify in database
      const dbNode = await db.select().from(timelineNodes).where(eq(timelineNodes.id, createdNode.id));
      expect(dbNode).toHaveLength(1);
      expect(dbNode[0].type).toBe(TimelineNodeType.Job);
      expect(dbNode[0].userId).toBe(testUserId);
      expect(dbNode[0].meta).toMatchObject(jobNodeData.meta);

      // Verify hierarchy closure (self-reference for root node)
      const dbClosure = await db.select().from(timelineNodeClosure).where(eq(timelineNodeClosure.descendantId, createdNode.id));
      expect(dbClosure).toHaveLength(1);
      expect(dbClosure[0].ancestorId).toBe(createdNode.id);
      expect(dbClosure[0].depth).toBe(0);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should create project node under job with hierarchy validation', async () => {
      const { db } = testContext.getContext();
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create parent job node first
      const parentJob = await arrange.createNode(
        TimelineNodeType.Job,
        {
          title: 'Product Manager',
          company: 'Innovation Labs',
          startDate: '2023-01'
        },
        testUserId
      );

      const projectNodeData: CreateNodeDTO = {
        type: TimelineNodeType.Project,
        parentId: parentJob.id,
        meta: {
          title: 'Customer Analytics Platform',
          description: 'Built comprehensive analytics dashboard for customer insights',
          technologies: ['React', 'TypeScript', 'PostgreSQL', 'Node.js'],
          achievements: ['Increased user engagement by 40%', 'Reduced load time by 60%'],
          startDate: '2023-03',
          endDate: '2023-09'
        }
      };

      // ⚡ ACT - Create project node under job
      const createdProject = await aaaHelper.act(async () => {
        return await hierarchyService.createNode(projectNodeData, testUserId);
      });

      // ✅ ASSERT - Project created with proper hierarchy
      expect(createdProject).toHaveProperty('id');
      expect(createdProject.type).toBe(TimelineNodeType.Project);
      expect(createdProject.parentId).toBe(parentJob.id);
      expect(createdProject.userId).toBe(testUserId);
      expect(createdProject.meta.title).toBe('Customer Analytics Platform');
      expect(createdProject.meta.technologies).toEqual(['React', 'TypeScript', 'PostgreSQL', 'Node.js']);

      // Verify in database
      const dbProject = await db.select().from(timelineNodes).where(eq(timelineNodes.id, createdProject.id));
      expect(dbProject[0].parentId).toBe(parentJob.id);

      // Verify hierarchy closure (should have 2 entries: self + parent)
      const dbClosure = await db.select().from(timelineNodeClosure).where(eq(timelineNodeClosure.descendantId, createdProject.id));
      expect(dbClosure).toHaveLength(2);
      
      const selfClosure = dbClosure.find(c => c.ancestorId === createdProject.id);
      const parentClosure = dbClosure.find(c => c.ancestorId === parentJob.id);
      
      expect(selfClosure?.depth).toBe(0);
      expect(parentClosure?.depth).toBe(1);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should validate hierarchy rules and reject invalid parent-child relationships', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create project node (leaf node)
      const projectNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Test Project' },
        testUserId
      );

      // ⚡ ACT & ✅ ASSERT - Cannot create child under project (violates hierarchy rules)
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.createNode({
          type: TimelineNodeType.Project,
          parentId: projectNode.id,
          meta: { title: 'Child Project' }
        }, testUserId);
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('Node Reading with Relationships', () => {
    it('should retrieve node with complete metadata and parent information', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create parent-child relationship
      const jobNode = await arrange.createNode(
        TimelineNodeType.Job,
        {
          title: 'Data Scientist',
          company: 'Analytics Corp',
          startDate: '2022-08'
        },
        testUserId
      );

      const projectNode = await arrange.createNode(
        TimelineNodeType.Project,
        {
          title: 'ML Recommendation Engine',
          description: 'Built machine learning recommendation system'
        },
        testUserId,
        jobNode.id
      );

      // ⚡ ACT - Retrieve project node
      const retrievedNode = await aaaHelper.act(async () => {
        return await hierarchyService.getNode(projectNode.id);
      });

      // ✅ ASSERT - Node retrieved with complete information
      expect(retrievedNode).not.toBeNull();
      expect(retrievedNode!.id).toBe(projectNode.id);
      expect(retrievedNode!.type).toBe(TimelineNodeType.Project);
      expect(retrievedNode!.parentId).toBe(jobNode.id);
      expect(retrievedNode!.meta.title).toBe('ML Recommendation Engine');

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should list user nodes with proper filtering and ordering', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create multiple nodes for user
      const nodes = await Promise.all([
        arrange.createNode(TimelineNodeType.Job, { title: 'Job A', startDate: '2023-01' }, testUserId),
        arrange.createNode(TimelineNodeType.Job, { title: 'Job B', startDate: '2023-06' }, testUserId),
        arrange.createNode(TimelineNodeType.Education, { title: 'Education A', startDate: '2022-09' }, testUserId),
      ]);

      // ⚡ ACT - List all user nodes
      const userNodes = await aaaHelper.act(async () => {
        return await hierarchyService.getUserNodes(testUserId);
      });

      // ✅ ASSERT - All user nodes returned
      expect(userNodes.length).toBeGreaterThanOrEqual(3);
      
      // Check that our created nodes are included
      const nodeIds = userNodes.map(n => n.id);
      nodes.forEach(node => {
        expect(nodeIds).toContain(node.id);
      });

      // Verify all returned nodes belong to the user
      userNodes.forEach(node => {
        expect(node.userId).toBe(testUserId);
      });

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should retrieve node hierarchy with children', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create hierarchy: Job -> Project -> Action
      const jobNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Engineering Manager' },
        testUserId
      );

      const projectNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Platform Migration' },
        testUserId,
        jobNode.id
      );

      // ⚡ ACT - Get children of job node
      const children = await aaaHelper.act(async () => {
        return await hierarchyService.getNodeChildren(jobNode.id);
      });

      // ✅ ASSERT - Children returned correctly
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe(projectNode.id);
      expect(children[0].parentId).toBe(jobNode.id);

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('Node Updates with Validation', () => {
    it('should update node metadata while preserving hierarchy', async () => {
      const { db } = testContext.getContext();
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create node to update
      const originalNode = await arrange.createNode(
        TimelineNodeType.Job,
        {
          title: 'Software Engineer',
          company: 'Old Company',
          startDate: '2023-01'
        },
        testUserId
      );

      const updateData: UpdateNodeDTO = {
        meta: {
          title: 'Senior Software Engineer',
          company: 'New Company Inc',
          startDate: '2023-01',
          endDate: '2024-01',
          description: 'Promoted to senior role with increased responsibilities'
        }
      };

      // ⚡ ACT - Update node
      const updatedNode = await aaaHelper.act(async () => {
        return await hierarchyService.updateNode(originalNode.id, updateData, testUserId);
      });

      // ✅ ASSERT - Node updated correctly
      expect(updatedNode.id).toBe(originalNode.id);
      expect(updatedNode.type).toBe(TimelineNodeType.Job); // Type unchanged
      expect(updatedNode.userId).toBe(testUserId); // User unchanged
      expect(updatedNode.parentId).toBe(originalNode.parentId); // Hierarchy unchanged
      expect(updatedNode.meta.title).toBe('Senior Software Engineer');
      expect(updatedNode.meta.company).toBe('New Company Inc');
      expect(updatedNode.meta.endDate).toBe('2024-01');

      // Verify in database
      const dbNode = await db.select().from(timelineNodes).where(eq(timelineNodes.id, originalNode.id));
      expect(dbNode[0].meta.title).toBe('Senior Software Engineer');
      expect(dbNode[0].meta.company).toBe('New Company Inc');

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should validate metadata schema during updates', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create job node
      const jobNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Test Job' },
        testUserId
      );

      // ⚡ ACT & ✅ ASSERT - Invalid metadata should be rejected
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.updateNode(jobNode.id, {
          meta: {
            title: '', // Empty title should be invalid
            company: 'Valid Company'
          }
        }, testUserId);
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should prevent unauthorized updates', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create another user and node
      const otherUser = await arrange.createUser('other.user@example.com');
      const otherUserNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Other User Job' },
        otherUser.user.id
      );

      // ⚡ ACT & ✅ ASSERT - User cannot update another user's node
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.updateNode(otherUserNode.id, {
          meta: { title: 'Hacked Title' }
        }, testUserId);
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('Node Deletion with Cascade Handling', () => {
    it('should delete leaf node without affecting hierarchy', async () => {
      const { db } = testContext.getContext();
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create job with project
      const jobNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Test Job for Deletion' },
        testUserId
      );

      const projectNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Test Project for Deletion' },
        testUserId,
        jobNode.id
      );

      // ⚡ ACT - Delete project node (leaf)
      await aaaHelper.act(async () => {
        return await hierarchyService.deleteNode(projectNode.id, testUserId);
      });

      // ✅ ASSERT - Project deleted, job remains
      const deletedProject = await hierarchyService.getNode(projectNode.id);
      expect(deletedProject).toBeNull();

      const remainingJob = await hierarchyService.getNode(jobNode.id);
      expect(remainingJob).not.toBeNull();
      expect(remainingJob!.id).toBe(jobNode.id);

      // Verify in database
      const dbProject = await db.select().from(timelineNodes).where(eq(timelineNodes.id, projectNode.id));
      expect(dbProject).toHaveLength(0);

      const dbJob = await db.select().from(timelineNodes).where(eq(timelineNodes.id, jobNode.id));
      expect(dbJob).toHaveLength(1);

      // Verify closure table cleaned up
      const dbClosure = await db.select().from(timelineNodeClosure).where(eq(timelineNodeClosure.descendantId, projectNode.id));
      expect(dbClosure).toHaveLength(0);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle cascade deletion of parent with children', async () => {
      const { db } = testContext.getContext();
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create hierarchy: Job -> Project
      const jobNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Job with Children' },
        testUserId
      );

      const projectNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Child Project' },
        testUserId,
        jobNode.id
      );

      // ⚡ ACT - Delete parent job node
      await aaaHelper.act(async () => {
        return await hierarchyService.deleteNode(jobNode.id, testUserId);
      });

      // ✅ ASSERT - Both parent and children deleted
      const deletedJob = await hierarchyService.getNode(jobNode.id);
      expect(deletedJob).toBeNull();

      const deletedProject = await hierarchyService.getNode(projectNode.id);
      expect(deletedProject).toBeNull();

      // Verify in database
      const dbNodes = await db.select().from(timelineNodes).where(inArray(timelineNodes.id, [jobNode.id, projectNode.id]));
      expect(dbNodes).toHaveLength(0);

      // Verify closure table cleaned up
      const dbClosure = await db.select().from(timelineNodeClosure).where(inArray(timelineNodeClosure.descendantId, [jobNode.id, projectNode.id]));
      expect(dbClosure).toHaveLength(0);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should prevent unauthorized deletion', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create another user and their node
      const otherUser = await arrange.createUser('delete.test@example.com');
      const otherUserNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Protected Node' },
        otherUser.user.id
      );

      // ⚡ ACT & ✅ ASSERT - User cannot delete another user's node
      await expect(aaaHelper.act(async () => {
        return await hierarchyService.deleteNode(otherUserNode.id, testUserId);
      })).rejects.toThrow();

      // Verify node still exists
      const stillExists = await hierarchyService.getNode(otherUserNode.id);
      expect(stillExists).not.toBeNull();

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('Batch Operations and Performance', () => {
    it('should handle batch node creation efficiently', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Prepare batch node data
      const parentJob = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Batch Test Job' },
        testUserId
      );

      const batchProjects = Array.from({ length: 5 }, (_, i) => ({
        type: TimelineNodeType.Project,
        parentId: parentJob.id,
        meta: {
          title: `Batch Project ${i + 1}`,
          description: `Project created in batch operation ${i + 1}`
        }
      }));

      // ⚡ ACT - Create multiple projects
      const startTime = Date.now();
      const createdProjects = await Promise.all(
        batchProjects.map(projectData => 
          hierarchyService.createNode(projectData, testUserId)
        )
      );
      const endTime = Date.now();

      // ✅ ASSERT - All projects created successfully
      expect(createdProjects).toHaveLength(5);
      createdProjects.forEach((project, index) => {
        expect(project.type).toBe(TimelineNodeType.Project);
        expect(project.parentId).toBe(parentJob.id);
        expect(project.meta.title).toBe(`Batch Project ${index + 1}`);
      });

      // Performance check: should complete in reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Less than 5 seconds

      // Verify all are children of parent job
      const children = await hierarchyService.getNodeChildren(parentJob.id);
      expect(children).toHaveLength(5);

    }, TEST_TIMEOUTS.INTEGRATION);
  });
});