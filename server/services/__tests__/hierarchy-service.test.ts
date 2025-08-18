/**
 * HierarchyService Integration Tests
 * 
 * Testing the service with real in-memory repositories instead of mocks.
 * This provides better test coverage and eliminates DRY violations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import types and service
import type { CreateNodeDTO, UpdateNodeDTO } from '../hierarchy-service';
import { HierarchyService } from '../hierarchy-service';
import { TestContainer } from '../../core/test-container-setup';

// Test constants
const TEST_USER_ID = 123;

describe('HierarchyService', () => {
  let container: any;
  let hierarchyService: HierarchyService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up test container with in-memory repositories
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    container = TestContainer.configure(mockLogger);
    hierarchyService = container.resolve('hierarchyService');
  });

  afterEach(() => {
    vi.resetAllMocks();
    TestContainer.reset();
  });

  describe('createNode', () => {
    it('should create node successfully', async () => {
      // Arrange
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Test Project' }
      };

      // Act
      const result = await hierarchyService.createNode(createDTO, TEST_USER_ID);

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe('project');
      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.meta).toEqual({ title: 'Test Project' });
      expect(result.parent).toBeNull(); // No parent specified
      expect(result.id).toBeDefined(); // Should have generated UUID
    });

    it('should create node with parent relationship', async () => {
      // Arrange - First create a parent node
      const parentDTO: CreateNodeDTO = {
        type: 'job',
        meta: { title: 'Parent Job' }
      };
      const parentNode = await hierarchyService.createNode(parentDTO, TEST_USER_ID);

      // Create child node
      const childDTO: CreateNodeDTO = {
        type: 'project',
        parentId: parentNode.id,
        meta: { title: 'Child Project' }
      };

      // Act
      const result = await hierarchyService.createNode(childDTO, TEST_USER_ID);

      // Assert
      expect(result.parentId).toBe(parentNode.id);
      expect(result.parent).toEqual({
        id: parentNode.id,
        type: parentNode.type,
        title: 'Parent Job'
      });
    });
  });

  describe('getNodeById', () => {
    it('should retrieve existing node with parent info', async () => {
      // Arrange - Create a node first
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Test Project' }
      };
      const createdNode = await hierarchyService.createNode(createDTO, TEST_USER_ID);

      // Act
      const result = await hierarchyService.getNodeById(createdNode.id, TEST_USER_ID);

      // Assert
      expect(result).toBeDefined();
      expect(result!.id).toBe(createdNode.id);
      expect(result!.type).toBe('project');
      expect(result!.meta).toEqual({ title: 'Test Project' });
    });

    it('should return null for non-existent node', async () => {
      // Act
      const result = await hierarchyService.getNodeById('non-existent-id', TEST_USER_ID);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for node owned by different user', async () => {
      // Arrange - Create node with one user
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Other User Project' }
      };
      const createdNode = await hierarchyService.createNode(createDTO, TEST_USER_ID);

      // Act - Try to access with different user
      const result = await hierarchyService.getNodeById(createdNode.id, TEST_USER_ID + 1);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateNode', () => {
    it('should update node successfully', async () => {
      // Arrange - Create a node first
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Original Title' }
      };
      const createdNode = await hierarchyService.createNode(createDTO, TEST_USER_ID);

      const updateDTO: UpdateNodeDTO = {
        meta: { title: 'Updated Title', description: 'New description' }
      };

      // Act
      const result = await hierarchyService.updateNode(createdNode.id, updateDTO, TEST_USER_ID);

      // Assert
      expect(result).toBeDefined();
      expect(result!.meta).toEqual({ title: 'Updated Title', description: 'New description' });
      expect(result!.id).toBe(createdNode.id);
    });

    it('should return null when updating non-existent node', async () => {
      // Arrange
      const updateDTO: UpdateNodeDTO = {
        meta: { title: 'Updated Title' }
      };

      // Act
      const result = await hierarchyService.updateNode('non-existent-id', updateDTO, TEST_USER_ID);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('deleteNode', () => {
    it('should delete node successfully', async () => {
      // Arrange - Create a node first
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'To Be Deleted' }
      };
      const createdNode = await hierarchyService.createNode(createDTO, TEST_USER_ID);

      // Act
      const result = await hierarchyService.deleteNode(createdNode.id, TEST_USER_ID);

      // Assert
      expect(result).toBe(true);

      // Verify node is deleted
      const deletedNode = await hierarchyService.getNodeById(createdNode.id, TEST_USER_ID);
      expect(deletedNode).toBeNull();
    });

    it('should return false when deleting non-existent node', async () => {
      // Act
      const result = await hierarchyService.deleteNode('non-existent-id', TEST_USER_ID);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getAllNodes', () => {
    it('should return all nodes for user', async () => {
      // Arrange - Create multiple nodes
      const node1DTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Project 1' }
      };
      const node2DTO: CreateNodeDTO = {
        type: 'job',
        meta: { title: 'Job 1' }
      };

      await hierarchyService.createNode(node1DTO, TEST_USER_ID);
      await hierarchyService.createNode(node2DTO, TEST_USER_ID);

      // Act
      const result = await hierarchyService.getAllNodes(TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map(n => n.meta?.title)).toContain('Project 1');
      expect(result.map(n => n.meta?.title)).toContain('Job 1');
    });

    it('should return empty array for user with no nodes', async () => {
      // Act
      const result = await hierarchyService.getAllNodes(TEST_USER_ID);

      // Assert
      expect(result).toEqual([]);
    });

    it('should only return nodes for specific user', async () => {
      // Arrange - Create nodes for different users
      const node1DTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'User 1 Project' }
      };
      const node2DTO: CreateNodeDTO = {
        type: 'project', 
        meta: { title: 'User 2 Project' }
      };

      await hierarchyService.createNode(node1DTO, TEST_USER_ID);
      await hierarchyService.createNode(node2DTO, TEST_USER_ID + 1);

      // Act
      const result = await hierarchyService.getAllNodes(TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].meta?.title).toBe('User 1 Project');
      expect(result[0].userId).toBe(TEST_USER_ID);
    });
  });

  describe('Node Insights Integration', () => {
    it('should create insight for node', async () => {
      // Arrange - Create a node first
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Project with Insight' }
      };
      const createdNode = await hierarchyService.createNode(createDTO, TEST_USER_ID);

      // Act - Create insight
      const insightData = {
        description: 'This project demonstrates advanced skills',
        resources: ['https://github.com/example/project']
      };
      const insight = await hierarchyService.createInsight(createdNode.id, insightData, TEST_USER_ID);

      // Assert
      expect(insight).toBeDefined();
      expect(insight.nodeId).toBe(createdNode.id);
      expect(insight.description).toBe('This project demonstrates advanced skills');
      expect(insight.resources).toEqual(['https://github.com/example/project']);
    });

    it('should get insights for node', async () => {
      // Arrange - Create node and insight
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Project with Insights' }
      };
      const createdNode = await hierarchyService.createNode(createDTO, TEST_USER_ID);
      
      const insightData = {
        description: 'Test insight',
        resources: ['https://example.com']
      };
      await hierarchyService.createInsight(createdNode.id, insightData, TEST_USER_ID);

      // Act
      const insights = await hierarchyService.getNodeInsights(createdNode.id, TEST_USER_ID);

      // Assert
      expect(insights).toHaveLength(1);
      expect(insights[0].description).toBe('Test insight');
      expect(insights[0].nodeId).toBe(createdNode.id);
    });
  });
});