/**
 * EducationRepository Unit Tests
 * 
 * Tests the EducationRepository class that extends BaseRepository
 * with education-specific functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { EducationRepository } from '../education-repository';
import type { Education } from '../../types/node-types';
import { NodeType } from '../../core/interfaces/base-node.interface';

// Mock database setup
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

describe('EducationRepository', () => {
  let mockDb: any;
  let repository: EducationRepository;

  const sampleEducation: Education[] = [
    {
      id: 'edu-1',
      type: NodeType.Education,
      title: 'Bachelor of Science in Computer Science',
      school: 'Stanford University',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      startDate: '2016-09-01',
      endDate: '2020-05-31',
      gpa: '3.8',
      description: 'Focus on machine learning and software engineering',
      location: 'Stanford, CA',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'edu-2',
      type: NodeType.Education,
      title: 'Master of Science in Artificial Intelligence',
      school: 'MIT',
      degree: 'Master of Science',
      field: 'Artificial Intelligence',
      startDate: '2020-09-01',
      endDate: '2022-05-31',
      gpa: '3.9',
      honors: ['Magna Cum Laude', 'Dean\'s List'],
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'edu-3',
      type: NodeType.Education,
      title: 'PhD in Machine Learning',
      school: 'Carnegie Mellon University',
      degree: 'PhD',
      field: 'Machine Learning',
      startDate: '2024-01-01',
      // No end date - current student
      expectedGraduation: '2028-05-31',
      advisor: 'Dr. Jane Smith',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
  ];

  const mockProfile = {
    id: 1,
    userId: 1,
    username: 'testuser',
    filteredData: {
      workExperiences: [],
      education: sampleEducation,
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
    repository = new EducationRepository(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('domain-specific queries', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('findBySchool', () => {
      it('should find education entries by school name', async () => {
        const result = await repository.findBySchool(1, 'Stanford University');

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('Stanford University');
        expect(result[0].degree).toBe('Bachelor of Science');
      });

      it('should perform case-insensitive search', async () => {
        const result = await repository.findBySchool(1, 'stanford university');

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('Stanford University');
      });

      it('should find partial matches', async () => {
        const result = await repository.findBySchool(1, 'Stanford');

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('Stanford University');
      });

      it('should return empty array when no matches found', async () => {
        const result = await repository.findBySchool(1, 'Nonexistent University');

        expect(result).toHaveLength(0);
      });
    });

    describe('findByDegree', () => {
      it('should find education by degree type', async () => {
        const result = await repository.findByDegree(1, 'Bachelor of Science');

        expect(result).toHaveLength(1);
        expect(result[0].degree).toBe('Bachelor of Science');
        expect(result[0].field).toBe('Computer Science');
      });

      it('should find master\'s degrees', async () => {
        const result = await repository.findByDegree(1, 'Master of Science');

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('MIT');
      });

      it('should find doctoral degrees', async () => {
        const result = await repository.findByDegree(1, 'PhD');

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('Carnegie Mellon University');
      });
    });

    describe('findByField', () => {
      it('should find education by field of study', async () => {
        const result = await repository.findByField(1, 'Computer Science');

        expect(result).toHaveLength(1);
        expect(result[0].field).toBe('Computer Science');
        expect(result[0].school).toBe('Stanford University');
      });

      it('should perform case-insensitive field search', async () => {
        const result = await repository.findByField(1, 'computer science');

        expect(result).toHaveLength(1);
        expect(result[0].field).toBe('Computer Science');
      });

      it('should find AI-related fields', async () => {
        const result = await repository.findByField(1, 'Artificial Intelligence');

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('MIT');
      });
    });

    describe('findCurrent', () => {
      it('should find current education entries (no end date)', async () => {
        const result = await repository.findCurrent(1);

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('Carnegie Mellon University');
        expect(result[0].endDate).toBeUndefined();
      });

      it('should include education with future end dates', async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        
        const modifiedEducation = [
          ...sampleEducation,
          {
            ...sampleEducation[0],
            id: 'edu-future',
            endDate: futureDate.toISOString(),
            school: 'Future University',
          }
        ];
        
        const modifiedProfile = {
          ...mockProfile,
          filteredData: {
            ...mockProfile.filteredData,
            education: modifiedEducation,
          },
        };
        
        mockDb.__setQueryResult([modifiedProfile]);

        const result = await repository.findCurrent(1);

        expect(result).toHaveLength(2);
        expect(result.some(edu => edu.school === 'Carnegie Mellon University')).toBe(true);
        expect(result.some(edu => edu.school === 'Future University')).toBe(true);
      });
    });

    describe('findByDateRange', () => {
      it('should find education that overlaps with date range', async () => {
        const result = await repository.findByDateRange(1, '2018-01-01', '2019-12-31');

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('Stanford University');
      });

      it('should find education that starts within range', async () => {
        const result = await repository.findByDateRange(1, '2024-01-01', '2024-12-31');

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('Carnegie Mellon University');
      });

      it('should return empty array when no education overlaps', async () => {
        const result = await repository.findByDateRange(1, '2010-01-01', '2015-12-31');

        expect(result).toHaveLength(0);
      });
    });

    describe('findAllSorted', () => {
      it('should return education sorted by start date (most recent first)', async () => {
        const result = await repository.findAllSorted(1);

        expect(result).toHaveLength(3);
        expect(result[0].school).toBe('Carnegie Mellon University'); // 2024
        expect(result[1].school).toBe('MIT'); // 2020
        expect(result[2].school).toBe('Stanford University'); // 2016
      });
    });

    describe('findByGPA', () => {
      it('should find education above minimum GPA', async () => {
        const result = await repository.findByGPA(1, 3.85);

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('MIT');
        expect(parseFloat(result[0].gpa!)).toBeGreaterThanOrEqual(3.85);
      });

      it('should handle education without GPA', async () => {
        const result = await repository.findByGPA(1, 3.0);

        expect(result).toHaveLength(2); // Only those with GPA >= 3.0
        expect(result.every(edu => edu.gpa && parseFloat(edu.gpa) >= 3.0)).toBe(true);
      });
    });

    describe('findWithHonors', () => {
      it('should find education entries with honors', async () => {
        const result = await repository.findWithHonors(1);

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('MIT');
        expect(result[0].honors).toContain('Magna Cum Laude');
      });

      it('should return empty array when no honors found', async () => {
        const modifiedProfile = {
          ...mockProfile,
          filteredData: {
            ...mockProfile.filteredData,
            education: sampleEducation.map(edu => ({ ...edu, honors: undefined })),
          },
        };
        
        mockDb.__setQueryResult([modifiedProfile]);

        const result = await repository.findWithHonors(1);

        expect(result).toHaveLength(0);
      });
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([mockProfile]);
    });

    describe('create', () => {
      it('should create education with valid data', async () => {
        const validData = {
          type: NodeType.Education,
          title: 'Bachelor of Arts in Psychology',
          school: 'Harvard University',
          degree: 'Bachelor of Arts',
          field: 'Psychology',
          startDate: '2024-01-01',
          gpa: '3.7',
        };

        const result = await repository.create(1, validData);

        expect(result).toBeDefined();
        expect(result.school).toBe('Harvard University');
        expect(result.degree).toBe('Bachelor of Arts');
      });

      it('should throw error with invalid data', async () => {
        const invalidData = {
          type: NodeType.Education,
          title: 'Degree',
          // Missing required school field
          degree: 'Bachelor',
        } as any;

        await expect(repository.create(1, invalidData))
          .rejects.toThrow('Invalid education data');
      });

      it('should validate GPA format', async () => {
        const invalidGPAData = {
          type: NodeType.Education,
          title: 'Test Degree',
          school: 'Test University',
          degree: 'Bachelor',
          field: 'Test',
          gpa: 'invalid-gpa',
        };

        await expect(repository.create(1, invalidGPAData))
          .rejects.toThrow('Invalid education data');
      });
    });

    describe('update', () => {
      it('should update education with valid partial data', async () => {
        const updates = {
          title: 'Updated Title',
          gpa: '4.0',
        };

        const result = await repository.update(1, 'edu-1', updates);

        expect(result).not.toBeNull();
      });

      it('should handle empty updates', async () => {
        const result = await repository.update(1, 'edu-1', {});

        expect(result).not.toBeNull();
      });
    });

    describe('isValidNode', () => {
      it('should validate education nodes correctly', () => {
        const validNode = {
          id: 'test-id',
          type: NodeType.Education,
          title: 'Test Degree',
          school: 'Test University',
          degree: 'Bachelor',
          field: 'Computer Science',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const invalidNode = {
          id: 'test-id',
          type: NodeType.Education,
          title: 'Test Degree',
          school: '', // Empty school
          degree: 'Bachelor',
        };

        expect(repository['isValidNode'](validNode)).toBe(true);
        expect(repository['isValidNode'](invalidNode)).toBe(false);
      });

      it('should validate GPA when present', () => {
        const validGPANode = {
          id: 'test-id',
          type: NodeType.Education,
          title: 'Test Degree',
          school: 'Test University',
          degree: 'Bachelor',
          field: 'Test',
          gpa: '3.5',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const invalidGPANode = {
          ...validGPANode,
          gpa: '5.0', // Invalid GPA > 4.0
        };

        expect(repository['isValidNode'](validGPANode)).toBe(true);
        expect(repository['isValidNode'](invalidGPANode)).toBe(false);
      });
    });
  });

  describe('utility functions', () => {
    describe('calculateEducationDuration', () => {
      it('should calculate duration between dates correctly', () => {
        const duration = repository.calculateEducationDuration('2016-09-01', '2020-05-31');

        expect(duration).toBe(44); // Approximately 44 months
      });

      it('should calculate duration to current date when no end date', () => {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const duration = repository.calculateEducationDuration(oneYearAgo.toISOString());

        expect(duration).toBeCloseTo(12, 1); // Approximately 1 year
      });

      it('should return null for invalid dates', () => {
        const duration = repository.calculateEducationDuration('invalid-date');

        expect(duration).toBeNull();
      });
    });

    describe('isCurrentlyEnrolled', () => {
      it('should identify currently enrolled students', () => {
        const currentStudent = sampleEducation[2]; // No end date
        const result = repository.isCurrentlyEnrolled(currentStudent);

        expect(result).toBe(true);
      });

      it('should identify graduated students', () => {
        const graduate = sampleEducation[0]; // Has end date
        const result = repository.isCurrentlyEnrolled(graduate);

        expect(result).toBe(false);
      });

      it('should handle future graduation dates', () => {
        const futureGraduate = {
          ...sampleEducation[0],
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year in future
        };
        
        const result = repository.isCurrentlyEnrolled(futureGraduate);

        expect(result).toBe(true);
      });
    });

    describe('getEducationLevel', () => {
      it('should determine education level from degree', () => {
        expect(repository.getEducationLevel('Bachelor of Science')).toBe('undergraduate');
        expect(repository.getEducationLevel('Bachelor of Arts')).toBe('undergraduate');
        expect(repository.getEducationLevel('Master of Science')).toBe('graduate');
        expect(repository.getEducationLevel('Master of Business Administration')).toBe('graduate');
        expect(repository.getEducationLevel('PhD')).toBe('doctoral');
        expect(repository.getEducationLevel('Doctor of Philosophy')).toBe('doctoral');
        expect(repository.getEducationLevel('Associate Degree')).toBe('associate');
        expect(repository.getEducationLevel('Certificate')).toBe('certificate');
        expect(repository.getEducationLevel('Unknown Degree')).toBe('other');
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const errorQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: () => {
          throw new Error('Database connection failed');
        },
      };
      mockDb.select = vi.fn(() => errorQuery);

      await expect(repository.findBySchool(1, 'Test'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle malformed education data', async () => {
      const malformedProfile = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          education: [{ invalid: 'data' }], // Malformed education entry
        },
      };

      mockDb.__setQueryResult([malformedProfile]);

      const result = await repository.findAll(1);

      // Should filter out malformed entries
      expect(result).toHaveLength(0);
    });
  });

  describe('advanced queries', () => {
    describe('findByMultipleCriteria', () => {
      it('should find education by multiple criteria', async () => {
        const result = await repository.findByMultipleCriteria(1, {
          school: 'MIT',
          degree: 'Master of Science',
          field: 'Artificial Intelligence',
        });

        expect(result).toHaveLength(1);
        expect(result[0].school).toBe('MIT');
        expect(result[0].degree).toBe('Master of Science');
        expect(result[0].field).toBe('Artificial Intelligence');
      });
    });

    describe('findSTEMEducation', () => {
      it('should find STEM-related education', async () => {
        const result = await repository.findSTEMEducation(1);

        expect(result).toHaveLength(3);
        expect(result.every(edu => 
          ['Computer Science', 'Artificial Intelligence', 'Machine Learning']
            .includes(edu.field!)
        )).toBe(true);
      });
    });
  });
});