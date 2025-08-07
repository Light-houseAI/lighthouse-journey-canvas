/**
 * ProfileRepository Unit Tests
 * 
 * Tests the ProfileRepository class with comprehensive profile data management,
 * aggregation queries, and JSON field handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ProfileRepository } from '../profile-repository';
import type { WorkExperience, Education, Project } from '../../types/node-types';
import { NodeType } from '../../core/interfaces/base-node.interface';

// Mock database setup
function createMockDatabase() {
  let queryResult: any[] = [];

  const mockQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    then: (resolve: any) => resolve(queryResult),
  };

  const mockDb = {
    select: vi.fn(() => mockQuery),
    update: vi.fn(() => mockQuery),
    insert: vi.fn(() => mockQuery),
    delete: vi.fn(() => mockQuery),
    __setQueryResult: (result: any[]) => {
      queryResult = result;
    },
    __setUpdateResult: (result: any[]) => {
      mockQuery.returning.mockResolvedValue(result);
    },
  } as any;

  return mockDb;
}

describe('ProfileRepository', () => {
  let mockDb: any;
  let repository: ProfileRepository;

  const sampleWorkExperiences: WorkExperience[] = [
    {
      id: 'work-1',
      type: NodeType.WorkExperience,
      title: 'Senior Software Engineer',
      company: 'Google',
      position: 'Senior Software Engineer',
      startDate: '2022-01-01',
      endDate: '2024-01-01',
      employmentType: 'full-time',
      location: 'Mountain View, CA',
      description: 'Led development of search infrastructure',
      technologies: ['Python', 'Java', 'Kubernetes'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'work-2',
      type: NodeType.WorkExperience,
      title: 'Software Engineer',
      company: 'Meta',
      position: 'Software Engineer',
      startDate: '2024-02-01',
      // Current position - no end date
      employmentType: 'full-time',
      location: 'Menlo Park, CA',
      description: 'Building social media features',
      technologies: ['React', 'GraphQL', 'Node.js'],
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-02-01T00:00:00Z',
    },
  ];

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
      honors: ['Cum Laude'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const sampleProjects: Project[] = [
    {
      id: 'proj-1',
      type: NodeType.Project,
      title: 'Search Optimization Engine',
      description: 'Improved search performance by 40%',
      technologies: ['Python', 'Elasticsearch', 'Redis'],
      startDate: '2022-06-01',
      endDate: '2023-01-01',
      status: 'completed',
      parentExperienceId: 'work-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockProfile = {
    id: 1,
    userId: 1,
    username: 'testuser',
    filteredData: {
      workExperiences: sampleWorkExperiences,
      education: sampleEducation,
      projects: sampleProjects,
      events: [],
      actions: [],
      careerTransitions: [],
    },
    rawData: {
      linkedinProfile: {
        name: 'Test User',
        headline: 'Software Engineer',
      },
      resumeData: {
        summary: 'Experienced software engineer with 5+ years',
      },
    },
    projects: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new ProfileRepository(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic CRUD operations', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([mockProfile]);
    });

    describe('findById', () => {
      it('should find profile by ID', async () => {
        const result = await repository.findById(1);

        expect(result).toEqual(mockProfile);
        expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return null when profile not found', async () => {
        mockDb.__setQueryResult([]);

        const result = await repository.findById(999);

        expect(result).toBeNull();
      });
    });

    describe('findByUserId', () => {
      it('should find profile by user ID', async () => {
        const result = await repository.findByUserId(1);

        expect(result).toEqual(mockProfile);
        expect(result?.userId).toBe(1);
      });
    });

    describe('create', () => {
      it('should create new profile', async () => {
        const profileData = {
          userId: 2,
          username: 'newuser',
          filteredData: {
            workExperiences: [],
            education: [],
            projects: [],
            events: [],
            actions: [],
            careerTransitions: [],
          },
          rawData: {},
          projects: [],
        };

        const result = await repository.create(profileData);

        expect(result).toBeDefined();
        expect(mockDb.insert).toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('should update existing profile', async () => {
        const updates = {
          username: 'updateduser',
          filteredData: {
            ...mockProfile.filteredData,
            workExperiences: [...sampleWorkExperiences, {
              id: 'work-3',
              type: NodeType.WorkExperience,
              title: 'New Role',
              company: 'New Company',
              position: 'New Position',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            }],
          },
        };

        const result = await repository.update(1, updates);

        expect(result).toBeDefined();
        expect(mockDb.update).toHaveBeenCalled();
      });
    });

    describe('delete', () => {
      it('should delete profile', async () => {
        mockDb.__setQueryResult([{ count: 1 }]);

        const result = await repository.delete(1);

        expect(result).toBe(true);
        expect(mockDb.delete).toHaveBeenCalled();
      });
    });
  });

  describe('aggregation queries', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('getProfileSummary', () => {
      it('should return comprehensive profile summary', async () => {
        const result = await repository.getProfileSummary(1);

        expect(result).toEqual({
          totalExperiences: 2,
          totalEducation: 1,
          totalProjects: 1,
          currentPosition: {
            title: 'Software Engineer',
            company: 'Meta',
            startDate: '2024-02-01',
          },
          totalYearsExperience: 2, // Calculated from work experiences
          skillsCount: 6, // Unique technologies across all experiences/projects
          topSkills: ['Python', 'Java', 'Kubernetes', 'React', 'GraphQL'],
          lastUpdated: mockProfile.updatedAt,
        });
      });
    });

    describe('getCareerProgression', () => {
      it('should return career progression timeline', async () => {
        const result = await repository.getCareerProgression(1);

        expect(result).toHaveLength(3); // 2 work experiences + 1 education
        expect(result[0]).toEqual({
          type: 'education',
          id: 'edu-1',
          title: 'Bachelor of Science in Computer Science',
          organization: 'Stanford University',
          startDate: '2016-09-01',
          endDate: '2020-05-31',
          duration: expect.any(Number),
        });
        expect(result[1]).toEqual({
          type: 'workExperience',
          id: 'work-1',
          title: 'Senior Software Engineer',
          organization: 'Google',
          startDate: '2022-01-01',
          endDate: '2024-01-01',
          duration: expect.any(Number),
        });
        expect(result[2]).toEqual({
          type: 'workExperience',
          id: 'work-2',
          title: 'Software Engineer',
          organization: 'Meta',
          startDate: '2024-02-01',
          endDate: null,
          duration: expect.any(Number),
        });
      });
    });

    describe('getTechnologyExperience', () => {
      it('should return technology usage statistics', async () => {
        const result = await repository.getTechnologyExperience(1);

        expect(result).toEqual({
          'Python': {
            count: 2,
            totalMonths: expect.any(Number),
            firstUsed: '2022-01-01',
            lastUsed: '2024-01-01',
            contexts: ['Google - Senior Software Engineer', 'Search Optimization Engine'],
          },
          'Java': {
            count: 1,
            totalMonths: expect.any(Number),
            firstUsed: '2022-01-01',
            lastUsed: '2024-01-01',
            contexts: ['Google - Senior Software Engineer'],
          },
          'React': {
            count: 1,
            totalMonths: expect.any(Number),
            firstUsed: '2024-02-01',
            lastUsed: null,
            contexts: ['Meta - Software Engineer'],
          },
        });
      });
    });

    describe('getEducationSummary', () => {
      it('should return education summary', async () => {
        const result = await repository.getEducationSummary(1);

        expect(result).toEqual({
          totalDegrees: 1,
          highestDegree: 'Bachelor of Science',
          institutions: ['Stanford University'],
          fields: ['Computer Science'],
          averageGPA: 3.8,
          totalHonors: 1,
          isCurrentStudent: false,
        });
      });
    });

    describe('getProjectSummary', () => {
      it('should return project summary', async () => {
        const result = await repository.getProjectSummary(1);

        expect(result).toEqual({
          totalProjects: 1,
          completedProjects: 1,
          inProgressProjects: 0,
          personalProjects: 0,
          workProjects: 1,
          topTechnologies: ['Python', 'Elasticsearch', 'Redis'],
          projectsByExperience: {
            'work-1': 1,
          },
        });
      });
    });
  });

  describe('search and filtering', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('searchProfiles', () => {
      it('should search profiles by keyword', async () => {
        const result = await repository.searchProfiles('software engineer');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
        expect(mockDb.select).toHaveBeenCalled();
      });

      it('should search with pagination', async () => {
        const result = await repository.searchProfiles('engineer', 1, 10);

        expect(result).toHaveLength(1);
        expect(mockDb.select).toHaveBeenCalled();
      });
    });

    describe('findByTechnology', () => {
      it('should find profiles using specific technology', async () => {
        const result = await repository.findByTechnology('Python');

        expect(result).toHaveLength(1);
        expect(result[0].filteredData.workExperiences[0].technologies).toContain('Python');
      });
    });

    describe('findByCompany', () => {
      it('should find profiles with experience at company', async () => {
        const result = await repository.findByCompany('Google');

        expect(result).toHaveLength(1);
        expect(result[0].filteredData.workExperiences[0].company).toBe('Google');
      });
    });

    describe('findByEducation', () => {
      it('should find profiles from specific school', async () => {
        const result = await repository.findByEducation('Stanford University');

        expect(result).toHaveLength(1);
        expect(result[0].filteredData.education[0].school).toBe('Stanford University');
      });
    });

    describe('findByExperienceLevel', () => {
      it('should find profiles by experience level', async () => {
        const result = await repository.findByExperienceLevel('senior', 2, 5);

        expect(result).toHaveLength(1);
        expect(result[0].filteredData.workExperiences.some(exp => 
          exp.title?.toLowerCase().includes('senior')
        )).toBe(true);
      });
    });
  });

  describe('data validation and integrity', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('validateProfileData', () => {
      it('should validate complete profile data', async () => {
        const result = await repository.validateProfileData(1);

        expect(result).toEqual({
          isValid: true,
          errors: [],
          warnings: [],
          completeness: expect.any(Number),
          issues: {
            missingFields: [],
            invalidDates: [],
            duplicateEntries: [],
            inconsistencies: [],
          },
        });
      });

      it('should detect missing required fields', async () => {
        const incompleteProfile = {
          ...mockProfile,
          filteredData: {
            ...mockProfile.filteredData,
            workExperiences: [{
              ...sampleWorkExperiences[0],
              title: '', // Missing title
            }],
          },
        };

        mockDb.__setQueryResult([incompleteProfile]);

        const result = await repository.validateProfileData(1);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Work experience missing title');
      });

      it('should detect invalid date ranges', async () => {
        const invalidDateProfile = {
          ...mockProfile,
          filteredData: {
            ...mockProfile.filteredData,
            workExperiences: [{
              ...sampleWorkExperiences[0],
              startDate: '2024-01-01',
              endDate: '2022-01-01', // End before start
            }],
          },
        };

        mockDb.__setQueryResult([invalidDateProfile]);

        const result = await repository.validateProfileData(1);

        expect(result.isValid).toBe(false);
        expect(result.issues.invalidDates).toHaveLength(1);
      });
    });

    describe('checkDataConsistency', () => {
      it('should check for data consistency across profile', async () => {
        const result = await repository.checkDataConsistency(1);

        expect(result).toEqual({
          consistent: true,
          issues: [],
          suggestions: expect.any(Array),
        });
      });
    });

    describe('detectDuplicates', () => {
      it('should detect duplicate entries', async () => {
        const duplicateProfile = {
          ...mockProfile,
          filteredData: {
            ...mockProfile.filteredData,
            workExperiences: [
              sampleWorkExperiences[0],
              { ...sampleWorkExperiences[0], id: 'work-duplicate' }, // Duplicate
            ],
          },
        };

        mockDb.__setQueryResult([duplicateProfile]);

        const result = await repository.detectDuplicates(1);

        expect(result.duplicates).toHaveLength(1);
        expect(result.duplicates[0].type).toBe('workExperience');
      });
    });
  });

  describe('JSON field operations', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([mockProfile]);
    });

    describe('updateFilteredData', () => {
      it('should update specific section of filtered data', async () => {
        const newWorkExperience = {
          id: 'work-3',
          type: NodeType.WorkExperience,
          title: 'New Position',
          company: 'New Company',
          position: 'New Position',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const result = await repository.updateFilteredData(1, 'workExperiences', [...sampleWorkExperiences, newWorkExperience]);

        expect(result).toBeDefined();
        expect(mockDb.update).toHaveBeenCalled();
      });
    });

    describe('addToFilteredData', () => {
      it('should add item to filtered data array', async () => {
        const newProject = {
          id: 'proj-2',
          type: NodeType.Project,
          title: 'New Project',
          description: 'A new project',
          technologies: ['Vue.js'],
          status: 'in-progress' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const result = await repository.addToFilteredData(1, 'projects', newProject);

        expect(result).toBeDefined();
        expect(mockDb.update).toHaveBeenCalled();
      });
    });

    describe('removeFromFilteredData', () => {
      it('should remove item from filtered data array', async () => {
        const result = await repository.removeFromFilteredData(1, 'workExperiences', 'work-1');

        expect(result).toBeDefined();
        expect(mockDb.update).toHaveBeenCalled();
      });
    });

    describe('updateRawData', () => {
      it('should update raw data section', async () => {
        const newRawData = {
          ...mockProfile.rawData,
          githubProfile: {
            username: 'testuser',
            repositories: 25,
          },
        };

        const result = await repository.updateRawData(1, newRawData);

        expect(result).toBeDefined();
        expect(mockDb.update).toHaveBeenCalled();
      });
    });
  });

  describe('performance optimization', () => {
    describe('getProfileMetrics', () => {
      it('should return performance metrics', async () => {
        const startTime = Date.now();
        
        mockDb.__setQueryResult([mockProfile]);
        await repository.getProfileSummary(1);
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        // Should complete within performance requirements
        expect(executionTime).toBeLessThan(200); // < 200ms for single operations
      });
    });

    describe('bulkOperations', () => {
      it('should handle bulk profile updates efficiently', async () => {
        const startTime = Date.now();
        
        const profiles = Array.from({ length: 100 }, (_, i) => ({
          ...mockProfile,
          id: i + 1,
          userId: i + 1,
        }));
        
        mockDb.__setQueryResult(profiles);
        
        const result = await repository.searchProfiles('engineer');
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        // Should complete within performance requirements for aggregation
        expect(executionTime).toBeLessThan(500); // < 500ms for aggregation operations
        expect(result).toHaveLength(100);
      });
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      const errorQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: () => {
          throw new Error('Database connection failed');
        },
      };
      mockDb.select = vi.fn(() => errorQuery);

      await expect(repository.findById(1))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle JSON parsing errors in filtered data', async () => {
      const malformedProfile = {
        ...mockProfile,
        filteredData: 'invalid-json', // Invalid JSON
      };

      mockDb.__setQueryResult([malformedProfile]);

      const result = await repository.findById(1);

      // Should handle gracefully and return null or default structure
      expect(result?.filteredData).toBeDefined();
    });

    it('should validate input parameters', async () => {
      await expect(repository.findById(-1))
        .rejects.toThrow('Invalid profile ID');

      await expect(repository.findByUserId(0))
        .rejects.toThrow('Invalid user ID');
    });
  });

  describe('caching and optimization', () => {
    describe('cached queries', () => {
      it('should implement query caching for frequently accessed data', async () => {
        mockDb.__setQueryResult([mockProfile]);

        // First call
        const result1 = await repository.getProfileSummary(1);
        
        // Second call - should use cache
        const result2 = await repository.getProfileSummary(1);

        expect(result1).toEqual(result2);
        // Database should only be called once due to caching
        expect(mockDb.select).toHaveBeenCalledTimes(1);
      });
    });
  });
});