/**
 * ProjectRepository Unit Tests
 * 
 * Tests the ProjectRepository class that extends BaseRepository
 * with project-specific functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ProjectRepository } from '../project-repository';
import type { Project } from '../../types/node-types';
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

describe('ProjectRepository', () => {
  let mockDb: any;
  let repository: ProjectRepository;

  const sampleProjects: Project[] = [
    {
      id: 'proj-1',
      type: NodeType.Project,
      title: 'E-commerce Platform',
      description: 'Built a scalable e-commerce platform using React and Node.js',
      technologies: ['React', 'Node.js', 'PostgreSQL', 'Redux'],
      startDate: '2022-01-01',
      endDate: '2022-06-30',
      status: 'completed',
      repositoryUrl: 'https://github.com/user/ecommerce-platform',
      deploymentUrl: 'https://ecommerce-demo.com',
      parentExperienceId: 'work-1',
      teamSize: 5,
      role: 'Frontend Lead',
      achievements: ['Increased conversion rate by 25%', 'Reduced load time by 40%'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'proj-2',
      type: NodeType.Project,
      title: 'AI Chatbot',
      description: 'Developed an intelligent chatbot using OpenAI API',
      technologies: ['Python', 'FastAPI', 'OpenAI', 'Docker'],
      startDate: '2023-03-01',
      endDate: '2023-05-15',
      status: 'completed',
      repositoryUrl: 'https://github.com/user/ai-chatbot',
      parentExperienceId: 'work-2',
      teamSize: 3,
      role: 'Full Stack Developer',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'proj-3',
      type: NodeType.Project,
      title: 'Mobile App',
      description: 'Cross-platform mobile application using React Native',
      technologies: ['React Native', 'TypeScript', 'Firebase'],
      startDate: '2024-01-01',
      // No end date - currently working
      status: 'in-progress',
      parentExperienceId: 'work-3',
      teamSize: 2,
      role: 'Mobile Developer',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
    {
      id: 'proj-4',
      type: NodeType.Project,
      title: 'Personal Portfolio',
      description: 'Personal website built with Next.js and Tailwind CSS',
      technologies: ['Next.js', 'Tailwind CSS', 'Vercel'],
      startDate: '2023-12-01',
      endDate: '2024-01-15',
      status: 'completed',
      repositoryUrl: 'https://github.com/user/portfolio',
      deploymentUrl: 'https://myportfolio.com',
      // No parent experience - personal project
      teamSize: 1,
      role: 'Solo Developer',
      createdAt: '2024-01-04T00:00:00Z',
      updatedAt: '2024-01-04T00:00:00Z',
    },
  ];

  const mockProfile = {
    id: 1,
    userId: 1,
    username: 'testuser',
    filteredData: {
      workExperiences: [],
      education: [],
      projects: sampleProjects,
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
    repository = new ProjectRepository(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('domain-specific queries', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('findByTechnology', () => {
      it('should find projects using specific technology', async () => {
        const result = await repository.findByTechnology(1, 'React');

        expect(result).toHaveLength(2);
        expect(result.every(proj => proj.technologies?.includes('React'))).toBe(true);
      });

      it('should perform case-insensitive search', async () => {
        const result = await repository.findByTechnology(1, 'react');

        expect(result).toHaveLength(2);
        expect(result.every(proj => 
          proj.technologies?.some(tech => tech.toLowerCase().includes('react'))
        )).toBe(true);
      });

      it('should return empty array when technology not found', async () => {
        const result = await repository.findByTechnology(1, 'NonexistentTech');

        expect(result).toHaveLength(0);
      });
    });

    describe('findByParentExperience', () => {
      it('should find projects under specific work experience', async () => {
        const result = await repository.findByParentExperience(1, 'work-1');

        expect(result).toHaveLength(1);
        expect(result[0].parentExperienceId).toBe('work-1');
        expect(result[0].title).toBe('E-commerce Platform');
      });

      it('should return empty array for non-existent parent', async () => {
        const result = await repository.findByParentExperience(1, 'nonexistent');

        expect(result).toHaveLength(0);
      });
    });

    describe('findPersonalProjects', () => {
      it('should find projects without parent experience', async () => {
        const result = await repository.findPersonalProjects(1);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Personal Portfolio');
        expect(result[0].parentExperienceId).toBeUndefined();
      });
    });

    describe('findByStatus', () => {
      it('should find completed projects', async () => {
        const result = await repository.findByStatus(1, 'completed');

        expect(result).toHaveLength(3);
        expect(result.every(proj => proj.status === 'completed')).toBe(true);
      });

      it('should find in-progress projects', async () => {
        const result = await repository.findByStatus(1, 'in-progress');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Mobile App');
        expect(result[0].status).toBe('in-progress');
      });
    });

    describe('findByDateRange', () => {
      it('should find projects that overlap with date range', async () => {
        const result = await repository.findByDateRange(1, '2022-03-01', '2022-05-01');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('E-commerce Platform');
      });

      it('should find projects that start within range', async () => {
        const result = await repository.findByDateRange(1, '2024-01-01', '2024-03-01');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Mobile App');
      });

      it('should return empty array when no projects overlap', async () => {
        const result = await repository.findByDateRange(1, '2021-01-01', '2021-12-31');

        expect(result).toHaveLength(0);
      });
    });

    describe('findAllSorted', () => {
      it('should return projects sorted by start date (most recent first)', async () => {
        const result = await repository.findAllSorted(1);

        expect(result).toHaveLength(4);
        expect(result[0].title).toBe('Mobile App'); // 2024-01-01
        expect(result[1].title).toBe('Personal Portfolio'); // 2023-12-01
        expect(result[2].title).toBe('AI Chatbot'); // 2023-03-01
        expect(result[3].title).toBe('E-commerce Platform'); // 2022-01-01
      });
    });

    describe('findByRole', () => {
      it('should find projects by developer role', async () => {
        const result = await repository.findByRole(1, 'Frontend Lead');

        expect(result).toHaveLength(1);
        expect(result[0].role).toBe('Frontend Lead');
        expect(result[0].title).toBe('E-commerce Platform');
      });

      it('should find full stack development projects', async () => {
        const result = await repository.findByRole(1, 'Full Stack Developer');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('AI Chatbot');
      });
    });

    describe('findByTeamSize', () => {
      it('should find solo projects', async () => {
        const result = await repository.findByTeamSize(1, 1, 1);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Personal Portfolio');
        expect(result[0].teamSize).toBe(1);
      });

      it('should find team projects', async () => {
        const result = await repository.findByTeamSize(1, 2, 5);

        expect(result).toHaveLength(3);
        expect(result.every(proj => proj.teamSize && proj.teamSize >= 2 && proj.teamSize <= 5)).toBe(true);
      });
    });

    describe('findWithDeployment', () => {
      it('should find projects with deployment URLs', async () => {
        const result = await repository.findWithDeployment(1);

        expect(result).toHaveLength(2);
        expect(result.every(proj => proj.deploymentUrl)).toBe(true);
      });
    });

    describe('findWithRepository', () => {
      it('should find projects with repository URLs', async () => {
        const result = await repository.findWithRepository(1);

        expect(result).toHaveLength(3);
        expect(result.every(proj => proj.repositoryUrl)).toBe(true);
      });
    });
  });

  describe('technology analysis', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('getTechnologyUsage', () => {
      it('should count technology usage across projects', async () => {
        const result = await repository.getTechnologyUsage(1);

        expect(result).toEqual({
          'React': 2,
          'Node.js': 2,
          'PostgreSQL': 1,
          'Redux': 1,
          'Python': 1,
          'FastAPI': 1,
          'OpenAI': 1,
          'Docker': 1,
          'React Native': 1,
          'TypeScript': 1,
          'Firebase': 1,
          'Next.js': 1,
          'Tailwind CSS': 1,
          'Vercel': 1,
        });
      });
    });

    describe('getMostUsedTechnologies', () => {
      it('should return most frequently used technologies', async () => {
        const result = await repository.getMostUsedTechnologies(1, 3);

        expect(result).toHaveLength(3);
        expect(result[0].technology).toBe('React');
        expect(result[0].count).toBe(2);
        expect(result[1].technology).toBe('Node.js');
        expect(result[1].count).toBe(2);
      });
    });

    describe('findByTechnologyStack', () => {
      it('should find projects using multiple technologies', async () => {
        const result = await repository.findByTechnologyStack(1, ['React', 'Node.js']);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('E-commerce Platform');
        expect(result[0].technologies).toContain('React');
        expect(result[0].technologies).toContain('Node.js');
      });

      it('should return empty when no projects match all technologies', async () => {
        const result = await repository.findByTechnologyStack(1, ['React', 'Python']);

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
      it('should create project with valid data', async () => {
        const validData = {
          type: NodeType.Project,
          title: 'New Project',
          description: 'A new project for testing',
          technologies: ['Vue.js', 'Express'],
          startDate: '2024-01-01',
          status: 'in-progress' as const,
        };

        const result = await repository.create(1, validData);

        expect(result).toBeDefined();
        expect(result.title).toBe('New Project');
        expect(result.technologies).toEqual(['Vue.js', 'Express']);
      });

      it('should throw error with invalid data', async () => {
        const invalidData = {
          type: NodeType.Project,
          // Missing required title
          description: 'Test project',
        } as any;

        await expect(repository.create(1, invalidData))
          .rejects.toThrow('Invalid project data');
      });

      it('should validate technology array', async () => {
        const invalidTechData = {
          type: NodeType.Project,
          title: 'Test Project',
          description: 'Test',
          technologies: 'not-an-array', // Invalid technologies format
        };

        await expect(repository.create(1, invalidTechData))
          .rejects.toThrow('Invalid project data');
      });

      it('should validate URL formats', async () => {
        const invalidUrlData = {
          type: NodeType.Project,
          title: 'Test Project',
          description: 'Test',
          repositoryUrl: 'not-a-valid-url',
        };

        await expect(repository.create(1, invalidUrlData))
          .rejects.toThrow('Invalid project data');
      });
    });

    describe('update', () => {
      it('should update project with valid partial data', async () => {
        const updates = {
          title: 'Updated Project Title',
          status: 'completed' as const,
        };

        const result = await repository.update(1, 'proj-1', updates);

        expect(result).not.toBeNull();
      });

      it('should handle empty updates', async () => {
        const result = await repository.update(1, 'proj-1', {});

        expect(result).not.toBeNull();
      });
    });

    describe('isValidNode', () => {
      it('should validate project nodes correctly', () => {
        const validNode = {
          id: 'test-id',
          type: NodeType.Project,
          title: 'Test Project',
          description: 'A test project',
          technologies: ['JavaScript'],
          status: 'completed',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const invalidNode = {
          id: 'test-id',
          type: NodeType.Project,
          title: '', // Empty title
          description: 'Test',
        };

        expect(repository['isValidNode'](validNode)).toBe(true);
        expect(repository['isValidNode'](invalidNode)).toBe(false);
      });
    });
  });

  describe('utility functions', () => {
    describe('calculateProjectDuration', () => {
      it('should calculate duration between dates correctly', () => {
        const duration = repository.calculateProjectDuration('2022-01-01', '2022-06-30');

        expect(duration).toBeCloseTo(5.97, 1); // About 6 months
      });

      it('should calculate duration to current date when no end date', () => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const duration = repository.calculateProjectDuration(oneMonthAgo.toISOString());

        expect(duration).toBeCloseTo(1, 0.5); // About 1 month
      });

      it('should return null for invalid dates', () => {
        const duration = repository.calculateProjectDuration('invalid-date');

        expect(duration).toBeNull();
      });
    });

    describe('isActive', () => {
      it('should identify active projects', () => {
        const activeProject = sampleProjects[2]; // In progress, no end date
        const result = repository.isActive(activeProject);

        expect(result).toBe(true);
      });

      it('should identify completed projects', () => {
        const completedProject = sampleProjects[0]; // Has end date
        const result = repository.isActive(completedProject);

        expect(result).toBe(false);
      });
    });

    describe('getProjectComplexity', () => {
      it('should determine project complexity based on various factors', () => {
        const simpleProject = sampleProjects[3]; // Personal portfolio
        const complexProject = sampleProjects[0]; // E-commerce platform

        expect(repository.getProjectComplexity(simpleProject)).toBe('simple');
        expect(repository.getProjectComplexity(complexProject)).toBe('complex');
      });
    });

    describe('extractSkillsFromProject', () => {
      it('should extract skills from project technologies and description', () => {
        const skills = repository.extractSkillsFromProject(sampleProjects[0]);

        expect(skills).toContain('react');
        expect(skills).toContain('node.js');
        expect(skills).toContain('postgresql');
        expect(skills).toContain('redux');
        expect(skills).toContain('scalable');
        expect(skills).toContain('frontend');
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

      await expect(repository.findByTechnology(1, 'React'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle malformed project data', async () => {
      const malformedProfile = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          projects: [{ invalid: 'data' }], // Malformed project entry
        },
      };

      mockDb.__setQueryResult([malformedProfile]);

      const result = await repository.findAll(1);

      // Should filter out malformed entries
      expect(result).toHaveLength(0);
    });
  });

  describe('advanced queries', () => {
    describe('findSimilarProjects', () => {
      it('should find projects with similar technologies', async () => {
        const result = await repository.findSimilarProjects(1, 'proj-1');

        expect(result.length).toBeGreaterThan(0);
        expect(result.every(proj => proj.id !== 'proj-1')).toBe(true); // Exclude the reference project
      });
    });

    describe('getProjectStats', () => {
      it('should return comprehensive project statistics', async () => {
        const result = await repository.getProjectStats(1);

        expect(result).toEqual({
          totalProjects: 4,
          completedProjects: 3,
          inProgressProjects: 1,
          personalProjects: 1,
          workProjects: 3,
          averageTeamSize: 2.75,
          totalTechnologies: 14,
          mostUsedTechnology: 'React',
        });
      });
    });

    describe('findProjectsByExperienceHierarchy', () => {
      it('should organize projects by their parent experiences', async () => {
        const result = await repository.findProjectsByExperienceHierarchy(1);

        expect(result).toHaveProperty('work-1');
        expect(result).toHaveProperty('work-2');
        expect(result).toHaveProperty('work-3');
        expect(result).toHaveProperty('personal');
        expect(result['work-1']).toHaveLength(1);
        expect(result['personal']).toHaveLength(1);
      });
    });
  });
});