/**
 * BaseRepository Unit Tests (Clean Version)
 * 
 * Tests the abstract BaseRepository class with properly mocked database operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from '../base-repository';
import type { WorkExperience } from '../../types/node-types';
import { NodeType } from '../../core/interfaces/base-node.interface';

// Create a simple mock database that properly handles thenable queries
function createMockDatabase() {
  let queryResult: any[] = [];

  const mockQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    // Make query thenable for awaiting
    then: (resolve: any) => resolve(queryResult),
  };

  const mockDb = {
    select: vi.fn(() => mockQuery),
    update: vi.fn(() => mockQuery),
    // Helper to set what the query should return
    __setQueryResult: (result: any[]) => {
      queryResult = result;
    },
    // Helper to setup update responses
    __setUpdateResult: (result: any[]) => {
      mockQuery.returning.mockResolvedValue(result);
    },
  } as any;

  return mockDb;
}

// Test repository implementation
class TestWorkExperienceRepository extends BaseRepository<WorkExperience> {
  constructor(db: NodePgDatabase<any>) {
    super(db, 'workExperiences', NodeType.WorkExperience);
  }
}

describe('BaseRepository', () => {
  let mockDb: any;
  let repository: TestWorkExperienceRepository;

  const sampleWorkExperience: Omit<WorkExperience, 'id' | 'createdAt' | 'updatedAt'> = {
    type: NodeType.WorkExperience,
    title: 'Senior Developer',
    description: 'Led development team',
    startDate: '2023-01-01',
    endDate: '2024-01-01',
    company: 'Tech Corp',
    position: 'Senior Developer',
    location: 'San Francisco',
  };

  const mockProfile = {
    id: 1,
    userId: 1,
    username: 'testuser',
    filteredData: {
      workExperiences: [
        {
          id: 'work-1',
          type: NodeType.WorkExperience,
          title: 'Developer',
          company: 'Old Corp',
          position: 'Developer',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'work-2',
          type: NodeType.WorkExperience,
          title: 'Senior Developer',
          company: 'New Corp',
          position: 'Senior Developer',
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: '2024-02-01T00:00:00Z',
        }
      ],
      education: [],
      projects: [],
      events: [],
      actions: [],
      careerTransitions: [],
    },
    rawData: {},
    projects: [],
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new TestWorkExperienceRepository(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findAll', () => {
    it('should return all nodes for a profile', async () => {
      // Arrange
      mockDb.__setQueryResult([mockProfile]);

      // Act
      const result = await repository.findAll(1);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'work-1',
        title: 'Developer',
        company: 'Old Corp',
      });
      expect(result[1]).toMatchObject({
        id: 'work-2',
        title: 'Senior Developer',
        company: 'New Corp',
      });
    });

    it('should return empty array if profile has no nodes of this type', async () => {
      // Arrange
      const profileWithoutNodes = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          workExperiences: [],
        },
      };
      mockDb.__setQueryResult([profileWithoutNodes]);

      // Act
      const result = await repository.findAll(1);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should return empty array if profile not found', async () => {
      // Arrange
      mockDb.__setQueryResult([]);

      // Act
      const result = await repository.findAll(999);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should handle profiles with null filteredData', async () => {
      // Arrange
      const profileWithNullData = {
        ...mockProfile,
        filteredData: null,
      };
      mockDb.__setQueryResult([profileWithNullData]);

      // Act
      const result = await repository.findAll(1);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should handle malformed filteredData gracefully', async () => {
      // Arrange
      const profileWithBadData = {
        ...mockProfile,
        filteredData: {
          workExperiences: 'invalid-data', // Should be array
        },
      };
      mockDb.__setQueryResult([profileWithBadData]);

      // Act
      const result = await repository.findAll(1);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return the node with matching ID', async () => {
      // Arrange
      mockDb.__setQueryResult([mockProfile]);

      // Act
      const result = await repository.findById(1, 'work-2');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe('work-2');
      expect(result?.title).toBe('Senior Developer');
      expect(result?.company).toBe('New Corp');
    });

    it('should return null if node not found', async () => {
      // Arrange
      mockDb.__setQueryResult([mockProfile]);

      // Act
      const result = await repository.findById(1, 'nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null if profile not found', async () => {
      // Arrange
      mockDb.__setQueryResult([]);

      // Act
      const result = await repository.findById(999, 'work-1');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new node with generated ID and timestamps', async () => {
      // Arrange
      const updatedProfile = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          workExperiences: [
            ...mockProfile.filteredData.workExperiences,
            expect.objectContaining({
              id: expect.stringMatching(/^[0-9a-f-]{36}$/), // UUID format
              ...sampleWorkExperience,
              createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
              updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            }),
          ],
        },
      };

      // Setup the mock to return profile for reads
      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([updatedProfile]);

      // Act
      const result = await repository.create(1, sampleWorkExperience);

      // Assert
      expect(result).toMatchObject({
        id: expect.any(String),
        ...sampleWorkExperience,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should throw error if profile not found', async () => {
      // Arrange
      mockDb.__setQueryResult([]);

      // Act & Assert
      await expect(repository.create(999, sampleWorkExperience))
        .rejects.toThrow('Profile with ID 999 not found');
    });

    it('should initialize filteredData if null', async () => {
      // Arrange
      const profileWithNullData = {
        ...mockProfile,
        filteredData: null,
      };
      mockDb.__setQueryResult([profileWithNullData]);

      const updatedProfile = {
        ...profileWithNullData,
        filteredData: {
          workExperiences: [expect.objectContaining(sampleWorkExperience)],
          education: [],
          projects: [],
          events: [],
          actions: [],
          careerTransitions: [],
        },
      };
      mockDb.__setUpdateResult([updatedProfile]);

      // Act
      const result = await repository.create(1, sampleWorkExperience);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('update', () => {
    it('should update an existing node', async () => {
      // Arrange
      const updates = {
        title: 'Updated Title',
        company: 'Updated Corp',
      };

      const updatedProfile = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          workExperiences: [
            mockProfile.filteredData.workExperiences[0], // unchanged
            {
              ...mockProfile.filteredData.workExperiences[1],
              ...updates,
              updatedAt: '2024-03-01T00:00:00Z',
            },
          ],
        },
      };

      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([updatedProfile]);

      // Act
      const result = await repository.update(1, 'work-2', updates);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Updated Title');
      expect(result?.company).toBe('Updated Corp');
    });

    it('should return null if node not found', async () => {
      // Arrange
      mockDb.__setQueryResult([mockProfile]);

      // Act
      const result = await repository.update(1, 'nonexistent', { title: 'New Title' });

      // Assert
      expect(result).toBeNull();
    });

    it('should return null if profile not found', async () => {
      // Arrange
      mockDb.__setQueryResult([]);

      // Act
      const result = await repository.update(999, 'work-1', { title: 'New Title' });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing node', async () => {
      // Arrange
      const updatedProfile = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          workExperiences: [mockProfile.filteredData.workExperiences[0]], // Only first item remains
        },
      };

      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([updatedProfile]);

      // Act
      const result = await repository.delete(1, 'work-2');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if node not found', async () => {
      // Arrange
      mockDb.__setQueryResult([mockProfile]);

      // Act
      const result = await repository.delete(1, 'nonexistent');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false if profile not found', async () => {
      // Arrange
      mockDb.__setQueryResult([]);

      // Act
      const result = await repository.delete(999, 'work-1');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('protected methods', () => {
    it('should return correct field name', () => {
      expect(repository['getNodeFieldName']()).toBe('workExperiences');
    });

    it('should validate nodes correctly', () => {
      const validNode = {
        id: 'test-id',
        type: NodeType.WorkExperience,
        title: 'Test Title',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const invalidNode = {
        id: 'test-id',
        type: 'invalid-type',
        title: 'Test Title',
      };

      expect(repository['isValidNode'](validNode)).toBe(true);
      expect(repository['isValidNode'](invalidNode)).toBe(false);
      expect(repository['isValidNode'](null)).toBe(false);
    });

    it('should generate valid UUID', () => {
      const id = repository['generateNodeId']();
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange - simulate database error by making query throw
      const errorQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: () => {
          throw new Error('Database connection failed');
        },
      };
      mockDb.select = vi.fn(() => errorQuery);

      // Act & Assert
      await expect(repository.findAll(1))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('concurrent modifications', () => {
    it('should handle concurrent modifications', async () => {
      // Arrange
      const updates1 = { title: 'First Update' };
      const updates2 = { company: 'Second Update' };

      mockDb.__setQueryResult([mockProfile]);

      // Act - simulate concurrent updates (both should work)
      const [result1, result2] = await Promise.all([
        repository.update(1, 'work-1', updates1),
        repository.update(1, 'work-1', updates2),
      ]);

      // Assert - both operations should complete
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
    });
  });
});