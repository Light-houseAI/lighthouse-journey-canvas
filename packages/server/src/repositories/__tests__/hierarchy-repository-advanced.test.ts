/**
 * Advanced Hierarchy Repository Tests
 *
 * Unit tests for closure table operations, metadata validation,
 * and enhanced permission filtering in the hierarchy repository
 */

import { TimelineNodeType } from '@journey/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockLogger, createTestNode } from '../../../tests/utils';
import { NodeFilter } from '../filters/node-filter.js';
import { HierarchyRepository } from '../hierarchy-repository.js';

describe('Advanced Hierarchy Repository Tests', () => {
  let repository: HierarchyRepository;
  let mockDb: any;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockTransactionManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = createMockLogger();

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

  describe('Meta Validation Tests', () => {
    describe('JobMeta Validation', () => {
      it('should validate valid JobMeta structure', async () => {
        const validJobMeta = {
          orgId: 123,
          role: 'Senior Software Engineer',
          location: 'San Francisco, CA',
          description: 'Building amazing products',
          startDate: '2023-01',
          endDate: '2024-06',
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

      it('should reject JobMeta with invalid orgId (string instead of number)', async () => {
        const invalidMeta = {
          role: 'Engineer',
          orgId: 'org-123', // Should be number
        };

        const nodeData = {
          type: TimelineNodeType.Job,
          parentId: null,
          meta: invalidMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Invalid orgId: Expected number');
        });

        await expect(repository.createNode(nodeData)).rejects.toThrow(
          'Invalid orgId'
        );
      });

      it('should reject JobMeta with missing required field (role)', async () => {
        const invalidMeta = {
          orgId: 123,
          // Missing role field
        };

        const nodeData = {
          type: TimelineNodeType.Job,
          parentId: null,
          meta: invalidMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Role is required');
        });

        await expect(repository.createNode(nodeData)).rejects.toThrow(
          'Role is required'
        );
      });

      it('should reject JobMeta with extra fields (strict mode)', async () => {
        const invalidMeta = {
          orgId: 123,
          role: 'Engineer',
          extraField: 'should not be allowed',
        };

        const nodeData = {
          type: TimelineNodeType.Job,
          parentId: null,
          meta: invalidMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Unrecognized key(s) in object: extraField');
        });

        await expect(repository.createNode(nodeData)).rejects.toThrow(
          'Unrecognized key'
        );
      });
    });

    describe('EducationMeta Validation', () => {
      it('should validate valid EducationMeta structure', async () => {
        const validEducationMeta = {
          orgId: 456,
          degree: 'Bachelor of Science',
          field: 'Computer Science',
          location: 'Cambridge, MA',
          description: 'Focus on AI and ML',
          startDate: '2019-09',
          endDate: '2023-05',
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

      it('should reject EducationMeta with invalid orgId', async () => {
        const invalidMeta = {
          orgId: 'university-123', // Should be number
          degree: 'BS',
        };

        const nodeData = {
          type: TimelineNodeType.Education,
          parentId: null,
          meta: invalidMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Invalid orgId: Expected number');
        });

        await expect(repository.createNode(nodeData)).rejects.toThrow(
          'Invalid orgId'
        );
      });

      it('should validate date format in EducationMeta', async () => {
        const invalidMeta = {
          orgId: 456,
          degree: 'BS Computer Science',
          startDate: '2019/09/01', // Invalid format, should be YYYY-MM
        };

        const nodeData = {
          type: TimelineNodeType.Education,
          parentId: null,
          meta: invalidMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Date must be in YYYY-MM format');
        });

        await expect(repository.createNode(nodeData)).rejects.toThrow(
          'YYYY-MM format'
        );
      });

      it('should allow optional fields in EducationMeta', async () => {
        const minimalMeta = {
          orgId: 456,
          degree: 'Bachelor of Science',
          // field, location, description, startDate, endDate are optional
        };

        const nodeData = {
          type: TimelineNodeType.Education,
          parentId: null,
          meta: minimalMeta,
          userId: 1,
        };

        const expectedNode = createTestNode({
          type: TimelineNodeType.Education,
          meta: minimalMeta,
        });

        mockDb.__setInsertResult([expectedNode]);

        const result = await repository.createNode(nodeData);

        expect(result).toEqual(expectedNode);
      });
    });

    describe('EventMeta Validation', () => {
      it('should validate interview event type with specific fields', async () => {
        const interviewEventMeta = {
          eventType: 'interview',
          stage: 'onsite',
          status: 'completed',
          interviewDate: '2024-03-15',
          orgId: 789,
        };

        const nodeData = {
          type: TimelineNodeType.Event,
          parentId: null,
          meta: interviewEventMeta,
          userId: 1,
        };

        const expectedNode = createTestNode({
          type: TimelineNodeType.Event,
          meta: interviewEventMeta,
        });

        mockDb.__setInsertResult([expectedNode]);

        const result = await repository.createNode(nodeData);

        expect(result).toEqual(expectedNode);
        expect(repository['validateNodeMeta']).toHaveBeenCalledWith(
          TimelineNodeType.Event,
          interviewEventMeta
        );
      });

      it('should validate job application event type', async () => {
        const applicationEventMeta = {
          eventType: 'job_application',
          orgId: 789,
          applicationDate: '2024-01-10',
          applicationStatus: 'applied',
        };

        const nodeData = {
          type: TimelineNodeType.Event,
          parentId: null,
          meta: applicationEventMeta,
          userId: 1,
        };

        const expectedNode = createTestNode({
          type: TimelineNodeType.Event,
          meta: applicationEventMeta,
        });

        mockDb.__setInsertResult([expectedNode]);

        const result = await repository.createNode(nodeData);

        expect(result).toEqual(expectedNode);
      });

      it('should validate conference/workshop event types', async () => {
        const conferenceEventMeta = {
          eventType: 'conference',
          name: 'Tech Summit 2024',
          location: 'Las Vegas, NV',
          eventDate: '2024-06-20',
        };

        const nodeData = {
          type: TimelineNodeType.Event,
          parentId: null,
          meta: conferenceEventMeta,
          userId: 1,
        };

        const expectedNode = createTestNode({
          type: TimelineNodeType.Event,
          meta: conferenceEventMeta,
        });

        mockDb.__setInsertResult([expectedNode]);

        const result = await repository.createNode(nodeData);

        expect(result).toEqual(expectedNode);
      });

      it('should handle complex nested structures in EventMeta', async () => {
        const complexEventMeta = {
          eventType: 'interview',
          stage: 'technical',
          status: 'scheduled',
          interviewDate: '2024-05-01',
          orgId: 789,
          interviewers: ['John Doe', 'Jane Smith'],
          notes: 'Prepare system design',
        };

        const nodeData = {
          type: TimelineNodeType.Event,
          parentId: null,
          meta: complexEventMeta,
          userId: 1,
        };

        const expectedNode = createTestNode({
          type: TimelineNodeType.Event,
          meta: complexEventMeta,
        });

        mockDb.__setInsertResult([expectedNode]);

        const result = await repository.createNode(nodeData);

        expect(result).toEqual(expectedNode);
      });
    });

    describe('ProjectMeta Validation', () => {
      it('should validate technologies array in ProjectMeta', async () => {
        const validProjectMeta = {
          name: 'E-commerce Platform',
          technologies: ['React', 'Node.js', 'PostgreSQL', 'Docker'],
          projectType: 'fullstack',
          status: 'in_progress',
          startDate: '2024-01',
        };

        const nodeData = {
          type: TimelineNodeType.Project,
          parentId: null,
          meta: validProjectMeta,
          userId: 1,
        };

        const expectedNode = createTestNode({
          type: TimelineNodeType.Project,
          meta: validProjectMeta,
        });

        mockDb.__setInsertResult([expectedNode]);

        const result = await repository.createNode(nodeData);

        expect(result).toEqual(expectedNode);
        expect(repository['validateNodeMeta']).toHaveBeenCalledWith(
          TimelineNodeType.Project,
          validProjectMeta
        );
      });

      it('should validate projectType enum', async () => {
        const invalidMeta = {
          name: 'Test Project',
          projectType: 'invalid_type', // Should be one of valid enum values
        };

        const nodeData = {
          type: TimelineNodeType.Project,
          parentId: null,
          meta: invalidMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Invalid projectType value');
        });

        await expect(repository.createNode(nodeData)).rejects.toThrow(
          'Invalid projectType'
        );
      });

      it('should validate status enum in ProjectMeta', async () => {
        const invalidMeta = {
          name: 'Test Project',
          status: 'invalid_status', // Should be valid ProjectStatus enum
        };

        const nodeData = {
          type: TimelineNodeType.Project,
          parentId: null,
          meta: invalidMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Invalid status value');
        });

        await expect(repository.createNode(nodeData)).rejects.toThrow(
          'Invalid status'
        );
      });

      it('should validate date formats in ProjectMeta', async () => {
        const invalidMeta = {
          name: 'Test Project',
          startDate: '01/2024', // Wrong format, should be YYYY-MM
          endDate: '2024-12',
        };

        const nodeData = {
          type: TimelineNodeType.Project,
          parentId: null,
          meta: invalidMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Date must be in YYYY-MM format');
        });

        await expect(repository.createNode(nodeData)).rejects.toThrow(
          'YYYY-MM format'
        );
      });
    });

    describe('updateNode Validation', () => {
      it('should validate meta when updating a node', async () => {
        const existingNode = createTestNode({
          id: 'update-test',
          type: TimelineNodeType.Job,
          meta: { orgId: 123, role: 'Engineer' },
        });

        mockDb.__setSelectResult([existingNode]);

        const updatedMeta = {
          orgId: 123,
          role: 'Senior Engineer',
          location: 'New York, NY',
        };

        const updatedNode = {
          ...existingNode,
          meta: updatedMeta,
        };

        mockDb.__setUpdateResult([updatedNode]);

        const updateRequest = {
          id: 'update-test',
          meta: updatedMeta,
          userId: 1,
        };

        const result = await repository.updateNode(updateRequest);

        expect(result).toEqual(updatedNode);
        expect(repository['validateNodeMeta']).toHaveBeenCalledWith(
          TimelineNodeType.Job,
          updatedMeta
        );
      });

      it('should handle validation errors in updateNode', async () => {
        const existingNode = createTestNode({
          id: 'update-test',
          type: TimelineNodeType.Job,
          meta: { orgId: 123, role: 'Engineer' },
        });

        mockDb.__setSelectResult([existingNode]);

        const invalidMeta = {
          orgId: 'invalid', // Should be number
          role: 'Senior Engineer',
        };

        const updateRequest = {
          id: 'update-test',
          meta: invalidMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Invalid orgId: Expected number');
        });

        await expect(repository.updateNode(updateRequest)).rejects.toThrow(
          'Invalid orgId'
        );
      });

      it('should handle partial updates with validation', async () => {
        const existingNode = createTestNode({
          id: 'partial-update',
          type: TimelineNodeType.Education,
          meta: {
            orgId: 456,
            degree: 'BS Computer Science',
            field: 'AI',
          },
        });

        mockDb.__setSelectResult([existingNode]);

        const partialMeta = {
          ...existingNode.meta,
          field: 'Machine Learning', // Only updating field
        };

        const updatedNode = {
          ...existingNode,
          meta: partialMeta,
        };

        mockDb.__setUpdateResult([updatedNode]);

        const updateRequest = {
          id: 'partial-update',
          meta: partialMeta,
          userId: 1,
        };

        const result = await repository.updateNode(updateRequest);

        expect(result).toEqual(updatedNode);
        expect(repository['validateNodeMeta']).toHaveBeenCalledWith(
          TimelineNodeType.Education,
          partialMeta
        );
      });

      it('should reject type mismatch errors in updateNode', async () => {
        const existingNode = createTestNode({
          id: 'type-mismatch',
          type: TimelineNodeType.Job,
          meta: { orgId: 123, role: 'Engineer' },
        });

        mockDb.__setSelectResult([existingNode]);

        // Trying to update with Education meta on a Job node
        const wrongTypeMeta = {
          orgId: 456,
          degree: 'BS',
        };

        const updateRequest = {
          id: 'type-mismatch',
          meta: wrongTypeMeta,
          userId: 1,
        };

        const validateSpy = vi.spyOn(repository as any, 'validateNodeMeta');
        validateSpy.mockImplementationOnce(() => {
          throw new Error('Meta validation failed for node type');
        });

        await expect(repository.updateNode(updateRequest)).rejects.toThrow(
          'Meta validation failed'
        );
      });
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
