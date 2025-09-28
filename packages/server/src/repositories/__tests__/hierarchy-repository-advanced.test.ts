/**
 * Advanced Hierarchy Repository Tests
 *
 * Unit tests for closure table operations, metadata validation,
 * and enhanced permission filtering in the hierarchy repository
 */

import type { TimelineNode } from '@journey/schema';
import { TimelineNodeType } from '@journey/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NodeFilter } from '../filters/node-filter.js';
import { HierarchyRepository } from '../hierarchy-repository.js';

describe('Advanced Hierarchy Repository Tests', () => {
  let repository: HierarchyRepository;
  let mockDb: any;
  let mockLogger: any;
  let mockTransactionManager: any;

  // Helper function to create test nodes
  const createTestNode = (
    overrides: Partial<TimelineNode> = {}
  ): TimelineNode => ({
    id: 'test-id',
    type: TimelineNodeType.Job,
    parentId: null,
    meta: { role: 'Engineer', orgId: 'org-1' },
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    // Simple mock database with controllable results
    let mockSelectResult: any[] = [];
    let mockInsertResult: any[] = [];
    let mockUpdateResult: any[] = [];
    let mockDeleteResult: any = { rowCount: 1 };
    let mockExecuteResult: any[] = [];

    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi
        .fn()
        .mockImplementation(() => Promise.resolve(mockSelectResult)), // orderBy is the final method in getAllNodes
      limit: vi
        .fn()
        .mockImplementation(() => Promise.resolve(mockSelectResult)),
      execute: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ rows: mockExecuteResult })),
    };

    const mockInsertQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockImplementation(() => Promise.resolve(mockInsertResult)),
    };

    const mockUpdateQuery = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi
        .fn()
        .mockImplementation(() => Promise.resolve(mockUpdateResult)),
    };

    const mockDeleteQuery = {
      where: vi
        .fn()
        .mockImplementation(() => Promise.resolve(mockDeleteResult)),
    };

    const mockTransaction = {
      select: vi.fn(() => mockQuery),
      insert: vi.fn(() => mockInsertQuery),
      update: vi.fn(() => mockUpdateQuery),
      delete: vi.fn(() => mockDeleteQuery),
      execute: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ rows: mockExecuteResult })),
      __setExecuteResult: (result: any[]) => {
        mockExecuteResult = result;
      },
    };

    mockDb = {
      select: vi.fn(() => mockQuery),
      insert: vi.fn(() => mockInsertQuery),
      update: vi.fn(() => mockUpdateQuery),
      delete: vi.fn(() => mockDeleteQuery),
      execute: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ rows: mockExecuteResult })),
      transaction: vi.fn().mockImplementation(async (callback: any) => {
        return callback(mockTransaction);
      }),

      // Test helper methods
      __setSelectResult: (result: any[]) => {
        mockSelectResult = result;
      },
      __setInsertResult: (result: any[]) => {
        mockInsertResult = result;
      },
      __setUpdateResult: (result: any[]) => {
        mockUpdateResult = result;
      },
      __setDeleteResult: (result: any) => {
        mockDeleteResult = result;
      },
      __setExecuteResult: (result: any[]) => {
        mockExecuteResult = result;
      },
    };

    // Create mock TransactionManager
    mockTransactionManager = {
      withTransaction: vi.fn().mockImplementation(async (callback: any) => {
        return callback(mockTransaction);
      }),
    };

    repository = new HierarchyRepository({
      database: mockDb as any,
      logger: mockLogger as any,
      transactionManager: mockTransactionManager as any,
    });

    // Mock the validateNodeMeta method to avoid schema dependencies
    // This will be overridden in specific tests that need different behavior
    vi.spyOn(repository as any, 'validateNodeMeta').mockResolvedValue(
      undefined
    );
  });

  describe('Closure Table Operations', () => {
    it('should insert closure entries when creating a node with parent', async () => {
      const newNodeData = {
        type: TimelineNodeType.Project,
        parentId: 'parent-node',
        meta: { title: 'Test Project' },
        userId: 1,
      };

      const expectedNode = createTestNode({
        type: TimelineNodeType.Project,
        parentId: 'parent-node',
        meta: { title: 'Test Project' },
      });

      mockDb.__setInsertResult([expectedNode]);

      const result = await repository.createNode(newNodeData);

      expect(result).toEqual(expectedNode);
      expect(mockTransactionManager.withTransaction).toHaveBeenCalled();
    });

    it('should skip closure table insertNodeClosure when parentId is null (LIG-185)', async () => {
      const newNodeData = {
        type: TimelineNodeType.Job,
        parentId: null,
        meta: { role: 'Engineer', orgId: 'org-1' },
        userId: 1,
      };

      const expectedNode = createTestNode({
        id: 'root-node',
        type: TimelineNodeType.Job,
        parentId: null,
        meta: { role: 'Engineer', orgId: 'org-1' },
      });

      mockDb.__setInsertResult([expectedNode]);

      const insertNodeClosureSpy = vi.spyOn(
        repository as any,
        'insertNodeClosure'
      );

      const result = await repository.createNode(newNodeData);

      expect(result).toEqual(expectedNode);
      expect(result.parentId).toBeNull();
      expect(insertNodeClosureSpy).not.toHaveBeenCalled();
    });

    it('should update node metadata without parentId changes (LIG-185)', async () => {
      const existingNode = createTestNode({
        id: 'update-node',
        userId: 1,
        parentId: 'parent-id',
        meta: { role: 'Engineer', orgId: 'org-1' },
      });

      mockDb.__setSelectResult([existingNode]);

      const updatedNode = {
        ...existingNode,
        meta: { role: 'Senior Engineer', orgId: 'org-1' },
      };
      mockDb.__setUpdateResult([updatedNode]);

      const updateRequest = {
        id: 'update-node',
        meta: { role: 'Senior Engineer', orgId: 'org-1' },
        userId: 1,
      };

      const result = await repository.updateNode(updateRequest);

      expect(result).toEqual(updatedNode);
      expect(result.parentId).toBe('parent-id');
      expect(mockTransactionManager.withTransaction).toHaveBeenCalled();
    });

    it('should delete closure entries when deleting a node', async () => {
      // Mock descendants query result in transaction
      mockDb.__setExecuteResult([
        { descendant_id: 'deleted-node' },
        { descendant_id: 'child-node-1' },
      ]);

      mockDb.__setDeleteResult({ rowCount: 1 });

      const result = await repository.deleteNode('deleted-node', 1);

      expect(result).toBe(true);
      expect(mockTransactionManager.withTransaction).toHaveBeenCalled();
    });

    it('should handle closure table errors during node creation', async () => {
      const nodeData = {
        type: TimelineNodeType.Project,
        parentId: 'parent-id',
        meta: { title: 'Test Project' },
        userId: 1,
      };

      // Mock transaction manager to throw error
      mockTransactionManager.withTransaction.mockRejectedValueOnce(
        new Error('Closure table error')
      );

      await expect(repository.createNode(nodeData)).rejects.toThrow(
        'Closure table error'
      );

      // Verify transaction was attempted
      expect(mockTransactionManager.withTransaction).toHaveBeenCalled();
    });
  });

  describe('Metadata Validation', () => {
    it('should validate node metadata against schema', async () => {
      const validJobMeta = {
        role: 'Senior Engineer',
        orgId: 'org-123',
      };

      const nodeData = {
        type: TimelineNodeType.Job,
        parentId: null,
        meta: validJobMeta,
        userId: 1,
      };

      const expectedNode = createTestNode({
        type: TimelineNodeType.Job,
        meta: validJobMeta,
      });

      mockDb.__setInsertResult([expectedNode]);

      const result = await repository.createNode(nodeData);

      expect(result).toEqual(expectedNode);
      expect(repository['validateNodeMeta']).toHaveBeenCalledWith(
        TimelineNodeType.Job,
        validJobMeta
      );
    });

    it('should handle metadata validation errors gracefully', async () => {
      const invalidMeta = {
        role: 123, // Invalid type, should be string
        orgId: 'org-1',
      };

      const nodeData = {
        type: TimelineNodeType.Job,
        parentId: null,
        meta: invalidMeta,
        userId: 1,
      };

      // Mock validation to throw error before any database operations
      const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
      validateSpy.mockImplementationOnce(() => {
        throw new Error('Validation failed');
      });

      await expect(repository.createNode(nodeData)).rejects.toThrow(
        'Validation failed'
      );

      // Verify validation was called
      expect(validateSpy).toHaveBeenCalledWith(
        TimelineNodeType.Job,
        invalidMeta
      );
    });

    it('should validate education metadata correctly', async () => {
      const validEducationMeta = {
        degree: 'Bachelor of Science',
        field: 'Computer Science',
      };

      const nodeData = {
        type: TimelineNodeType.Education,
        parentId: null,
        meta: validEducationMeta,
        userId: 1,
      };

      const expectedNode = createTestNode({
        type: TimelineNodeType.Education,
        meta: validEducationMeta,
      });

      mockDb.__setInsertResult([expectedNode]);

      const result = await repository.createNode(nodeData);

      expect(result).toEqual(expectedNode);
      expect(repository['validateNodeMeta']).toHaveBeenCalledWith(
        TimelineNodeType.Education,
        validEducationMeta
      );
    });
  });

  describe('Enhanced Permission Filtering', () => {
    it('should use permission CTE for cross-user access', async () => {
      const userNodes = [createTestNode({ id: 'allowed-node', userId: 2 })];

      // Mock the execute method for permission CTE query
      mockDb.__setExecuteResult(userNodes);

      const filter = NodeFilter.Of(2).For(1).build(); // User 1 viewing user 2's nodes
      const result = await repository.getAllNodes(filter);

      expect(result).toEqual(userNodes);
    });

    it('should skip CTE when same user views own nodes', async () => {
      const userNodes = [createTestNode({ id: 'own-node', userId: 1 })];

      // Mock the limit method for regular query (no CTE)
      mockDb.__setSelectResult(userNodes);

      const filter = NodeFilter.Of(1).For(1).build(); // Same user
      const result = await repository.getAllNodes(filter);

      expect(result).toEqual(userNodes);

      // Verify regular select was used, not execute (CTE)
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('Transaction Handling', () => {
    it('should handle concurrent updates in updateNode transaction', async () => {
      const existingNode = createTestNode({ id: 'concurrent-node', userId: 1 });
      mockDb.__setSelectResult([existingNode]);

      const updatedNode = {
        ...existingNode,
        meta: { role: 'Updated Role', orgId: 'org-1' },
      };
      mockDb.__setUpdateResult([updatedNode]);

      const updateRequest = {
        id: 'concurrent-node',
        meta: { role: 'Updated Role', orgId: 'org-1' },
        userId: 1,
      };

      const result = await repository.updateNode(updateRequest);

      expect(result).toEqual(updatedNode);
      expect(mockTransactionManager.withTransaction).toHaveBeenCalled();
    });

    it('should handle transaction rollback on closure table errors', async () => {
      // Mock descendants query result
      mockDb.__setExecuteResult([{ descendant_id: 'parent-node' }]);
      mockDb.__setDeleteResult({ rowCount: 1 });

      const result = await repository.deleteNode('parent-node', 1);

      expect(result).toBe(true);
      expect(mockTransactionManager.withTransaction).toHaveBeenCalled();
    });
  });
});
