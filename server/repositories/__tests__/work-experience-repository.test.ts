/**
 * JobRepository Unit Tests
 * 
 * Tests the JobRepository class that extends BaseRepository
 * with job-specific functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { JobRepository, calculateDurationInMonths, formatDuration, hasDateOverlap } from '../job-repository';
import type { Job } from '@shared/schema';

// Mock database setup (similar to BaseRepository tests)
function createMockDatabase() {
  let queryResult: any[] = [];

  const mockQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    then: (resolve: any) => resolve(queryResult),
  };

  const mockDb = {
    select: vi.fn(() => mockQuery),
    update: vi.fn(() => mockQuery),
    __setQueryResult: (result: any[]) => {
      queryResult = result;
    },
    __setUpdateResult: (result: any[]) => {
      mockQuery.returning.mockResolvedValue(result);
    },
  } as any;

  return mockDb;
}

describe('JobRepository', () => {
  let mockDb: any;
  let repository: JobRepository;

  const sampleJobs: Job[] = [
    {
      id: 'job-1',
      type: 'job' as const,
      title: 'Senior Developer',
      company: 'Tech Corp',
      position: 'Senior Developer',
      startDate: '2022-01-01',
      endDate: '2023-12-31',
      employmentType: 'full-time',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'job-2',
      type: 'job' as const,
      title: 'Frontend Developer',
      company: 'Design Inc',
      position: 'Frontend Developer',
      startDate: '2021-06-01',
      endDate: '2021-12-31',
      employmentType: 'contract',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'job-3',
      type: 'job' as const,
      title: 'Lead Engineer',
      company: 'Innovation Labs',
      position: 'Lead Engineer',
      startDate: '2024-01-01',
      // No end date - current position
      employmentType: 'full-time',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
  ];

  const mockProfile = {
    id: 1,
    userId: 1,
    username: 'testuser',
    filteredData: {
      jobs: sampleJobs,
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
    repository = new JobRepository(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('domain-specific queries', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('findByCompany', () => {
      it('should find jobs by company name', async () => {
        // Act
        const result = await repository.findByCompany(1, 'Tech Corp');

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].company).toBe('Tech Corp');
        expect(result[0].position).toBe('Senior Developer');
      });

      it('should perform case-insensitive search', async () => {
        // Act
        const result = await repository.findByCompany(1, 'tech corp');

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].company).toBe('Tech Corp');
      });

      it('should find partial matches', async () => {
        // Act
        const result = await repository.findByCompany(1, 'Tech');

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].company).toBe('Tech Corp');
      });

      it('should return empty array when no matches found', async () => {
        // Act
        const result = await repository.findByCompany(1, 'Nonexistent Company');

        // Assert
        expect(result).toHaveLength(0);
      });
    });

    describe('findByEmploymentType', () => {
      it('should find full-time jobs', async () => {
        // Act
        const result = await repository.findByEmploymentType(1, 'full-time');

        // Assert
        expect(result).toHaveLength(2);
        expect(result.every(exp => exp.employmentType === 'full-time')).toBe(true);
      });

      it('should find contract jobs', async () => {
        // Act
        const result = await repository.findByEmploymentType(1, 'contract');

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].company).toBe('Design Inc');
      });

      it('should return empty array for unmatched employment type', async () => {
        // Act
        const result = await repository.findByEmploymentType(1, 'internship');

        // Assert
        expect(result).toHaveLength(0);
      });
    });

    describe('findCurrent', () => {
      it('should find current jobs (no end date)', async () => {
        // Act
        const result = await repository.findCurrent(1);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].company).toBe('Innovation Labs');
        expect(result[0].endDate).toBeUndefined();
      });

      it('should include jobs with future end dates', async () => {
        // Arrange - modify mock to have a future end date
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        
        const modifiedJobs = [
          ...sampleJobs,
          {
            ...sampleJobs[0],
            id: 'work-future',
            endDate: futureDate.toISOString(),
            company: 'Future Corp',
          }
        ];
        
        const modifiedProfile = {
          ...mockProfile,
          filteredData: {
            ...mockProfile.filteredData,
            workExperiences: modifiedJobs,
          },
        };
        
        mockDb.__setQueryResult([modifiedProfile]);

        // Act
        const result = await repository.findCurrent(1);

        // Assert
        expect(result).toHaveLength(2);
        expect(result.some(exp => exp.company === 'Innovation Labs')).toBe(true);
        expect(result.some(exp => exp.company === 'Future Corp')).toBe(true);
      });
    });

    describe('findAllSorted', () => {
      it('should return jobs sorted by start date (most recent first)', async () => {
        // Act
        const result = await repository.findAllSorted(1);

        // Assert
        expect(result).toHaveLength(3);
        expect(result[0].company).toBe('Innovation Labs'); // 2024-01-01 (most recent)
        expect(result[1].company).toBe('Tech Corp'); // 2022-01-01
        expect(result[2].company).toBe('Design Inc'); // 2021-06-01
      });

      it('should handle jobs without start dates', async () => {
        // Arrange - modify one job to have no start date
        const modifiedJobs = [
          { ...sampleJobs[0], startDate: undefined },
          sampleJobs[1],
          sampleJobs[2],
        ];
        
        const modifiedProfile = {
          ...mockProfile,
          filteredData: {
            ...mockProfile.filteredData,
            jobs: modifiedJobs,
          },
        };
        
        mockDb.__setQueryResult([modifiedProfile]);

        // Act
        const result = await repository.findAllSorted(1);

        // Assert
        expect(result).toHaveLength(3);
        // Job without start date should be at the end
        expect(result[result.length - 1].company).toBe('Tech Corp');
      });
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([mockProfile]);
    });

    describe('create', () => {
      it('should create job with valid data', async () => {
        // Arrange
        const validData = {
          type: 'job' as const,
          title: 'Software Engineer',
          company: 'New Tech',
          position: 'Software Engineer',
          startDate: '2024-01-01',
          employmentType: 'full-time' as const,
        };

        // Act
        const result = await repository.create(1, validData);

        // Assert
        expect(result).toBeDefined();
        expect(result.company).toBe('New Tech');
        expect(result.position).toBe('Software Engineer');
      });

      it('should throw error with invalid data', async () => {
        // Arrange
        const invalidData = {
          type: 'job' as const,
          title: 'Software Engineer',
          // Missing required company field
          position: 'Software Engineer',
        } as any;

        // Act & Assert
        await expect(repository.create(1, invalidData))
          .rejects.toThrow('Invalid job data');
      });
    });

    describe('update', () => {
      it('should update job with valid partial data', async () => {
        // Arrange
        const updates = {
          title: 'Updated Title',
          position: 'Updated Position',
        };

        // Act
        const result = await repository.update(1, 'job-1', updates);

        // Assert
        expect(result).not.toBeNull();
      });

      it('should handle empty updates', async () => {
        // Act
        const result = await repository.update(1, 'job-1', {});

        // Assert
        expect(result).not.toBeNull();
      });
    });

    describe('isValidNode', () => {
      it('should validate job nodes correctly', () => {
        const validNode = {
          id: 'test-id',
          type: 'job' as const,
          title: 'Test Title',
          company: 'Test Company',
          position: 'Test Position',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const invalidNode = {
          id: 'test-id',
          type: 'job' as const,
          title: 'Test Title',
          company: '', // Empty company
          position: 'Test Position',
        };

        expect(repository['isValidNode'](validNode)).toBe(true);
        expect(repository['isValidNode'](invalidNode)).toBe(false);
      });
    });
  });

  describe('utility functions', () => {
    describe('calculateDurationInMonths', () => {
      it('should calculate duration between dates correctly', () => {
        // Act
        const duration = calculateDurationInMonths('2022-01-01', '2023-01-01');

        // Assert
        expect(duration).toBe(12); // Exactly 1 year
      });

      it('should calculate duration to current date when no end date', () => {
        // Arrange
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Act
        const duration = calculateDurationInMonths(oneYearAgo.toISOString());

        // Assert
        expect(duration).toBe(12); // Approximately 1 year
      });

      it('should return null for invalid dates', () => {
        // Act
        const duration = calculateDurationInMonths('invalid-date');

        // Assert
        expect(duration).toBeNull();
      });

      it('should return null when no start date', () => {
        // Act
        const duration = calculateDurationInMonths();

        // Assert
        expect(duration).toBeNull();
      });
    });

    describe('formatDuration', () => {
      it('should format duration correctly for various periods', () => {
        // Test cases
        expect(formatDuration('2023-01-01', '2023-01-01')).toBe('Less than 1 month');
        expect(formatDuration('2023-01-01', '2023-02-01')).toBe('1 month');
        expect(formatDuration('2023-01-01', '2023-06-01')).toBe('5 months');
        expect(formatDuration('2022-01-01', '2023-01-01')).toBe('1 year');
        expect(formatDuration('2021-01-01', '2023-01-01')).toBe('2 years');
        expect(formatDuration('2021-01-01', '2023-07-01')).toBe('2 years 6 months');
      });

      it('should handle missing start date', () => {
        // Act
        const result = formatDuration();

        // Assert
        expect(result).toBe('Duration unknown');
      });
    });

    describe('hasDateOverlap', () => {
      it('should detect overlap between jobs', () => {
        // Arrange
        const exp1: Job = {
          ...sampleJobs[0],
          startDate: '2022-01-01',
          endDate: '2023-12-31',
        };
        
        const exp2: Job = {
          ...sampleJobs[1],
          startDate: '2023-06-01',
          endDate: '2024-06-01',
        };

        // Act
        const hasOverlap = hasDateOverlap(exp1, exp2);

        // Assert
        expect(hasOverlap).toBe(true);
      });

      it('should not detect overlap for non-overlapping jobs', () => {
        // Arrange
        const exp1: Job = {
          ...sampleJobs[0],
          startDate: '2022-01-01',
          endDate: '2022-12-31',
        };
        
        const exp2: Job = {
          ...sampleJobs[1],
          startDate: '2023-01-01',
          endDate: '2023-12-31',
        };

        // Act
        const hasOverlap = hasDateOverlap(exp1, exp2);

        // Assert
        expect(hasOverlap).toBe(false);
      });

      it('should handle missing dates gracefully', () => {
        // Arrange
        const exp1: Job = {
          ...sampleJobs[0],
          // No start date
        };
        
        const exp2: Job = {
          ...sampleJobs[1],
          startDate: '2023-01-01',
        };

        // Act
        const hasOverlap = hasDateOverlap(exp1, exp2);

        // Assert
        expect(hasOverlap).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange - simulate database error
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
      await expect(repository.findByCompany(1, 'Test'))
        .rejects.toThrow('Database connection failed');
    });
  });
});