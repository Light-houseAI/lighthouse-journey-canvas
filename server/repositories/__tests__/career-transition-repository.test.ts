/**
 * CareerTransitionRepository Unit Tests
 * 
 * Comprehensive tests for CareerTransitionRepository class covering:
 * - CRUD operations for career transition nodes
 * - Transition-specific queries (job changes, career pivots, industry switches)
 * - Timeline and duration tracking
 * - Motivation and outcome analysis
 * - Skills gap identification and bridging
 * - Financial impact tracking
 * - Success metrics and lessons learned
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CareerTransitionRepository, calculateTransitionDuration, analyzeTransitionSuccess, categorizeTransitionType } from '../career-transition-repository';
import type { CareerTransition } from '../../types/node-types';
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

describe('CareerTransitionRepository', () => {
  let mockDb: any;
  let repository: CareerTransitionRepository;

  const sampleTransitions: CareerTransition[] = [
    {
      id: 'transition-1',
      type: NodeType.CareerTransition,
      title: 'Software Engineer to Engineering Manager',
      description: 'Transitioned from individual contributor role to engineering management position',
      startDate: '2023-06-01',
      endDate: '2023-09-15',
      transitionType: 'role-change',
      category: 'promotion',
      industry: 'technology',
      fromRole: {
        title: 'Senior Software Engineer',
        company: 'TechCorp Inc',
        level: 'senior',
        responsibilities: ['Code development', 'Technical design', 'Code reviews'],
        skills: ['React', 'Node.js', 'Python', 'System Design'],
        salary: 120000,
      },
      toRole: {
        title: 'Engineering Manager',
        company: 'TechCorp Inc',
        level: 'manager',
        responsibilities: ['Team management', 'Strategic planning', 'Performance reviews', 'Technical oversight'],
        skills: ['Leadership', 'Management', 'Strategic Planning', 'People Development'],
        salary: 145000,
      },
      motivation: [
        'Desire for greater impact and influence',
        'Interest in people management and team building',
        'Career growth and increased compensation',
      ],
      challenges: [
        'Learning people management skills',
        'Balancing technical and management responsibilities',
        'Adapting to less hands-on coding',
      ],
      skillsGained: ['Team Leadership', 'Performance Management', 'Strategic Thinking', 'Conflict Resolution'],
      skillsLost: ['Deep Technical Implementation', 'Daily Coding Practice'],
      preparation: [
        'Completed management training course',
        'Mentored junior developers',
        'Led cross-functional projects',
        'Read leadership and management books',
      ],
      outcomes: [
        'Successfully leading team of 8 engineers',
        '20% salary increase',
        'Improved team velocity by 30%',
        'Developed strong management skills',
      ],
      lessonsLearned: [
        'Importance of communication in leadership',
        'Managing people requires different skills than coding',
        'Need to maintain some technical involvement',
      ],
      successMetrics: {
        salaryIncrease: 25000,
        satisfactionRating: 8,
        careerProgressionScore: 9,
        skillDevelopmentScore: 8,
      },
      duration: 105, // days
      status: 'completed',
      createdAt: '2023-06-01T00:00:00Z',
      updatedAt: '2023-09-15T00:00:00Z',
    },
    {
      id: 'transition-2',
      type: NodeType.CareerTransition,
      title: 'Finance to Technology Career Pivot',
      description: 'Complete career change from financial analyst to software developer',
      startDate: '2022-01-01',
      endDate: '2023-03-01',
      transitionType: 'career-pivot',
      category: 'industry-change',
      industry: 'technology',
      fromRole: {
        title: 'Financial Analyst',
        company: 'Investment Bank Corp',
        level: 'analyst',
        industry: 'finance',
        responsibilities: ['Financial modeling', 'Market analysis', 'Report generation'],
        skills: ['Excel', 'Financial Analysis', 'SQL', 'Bloomberg Terminal'],
        salary: 85000,
      },
      toRole: {
        title: 'Junior Software Developer',
        company: 'StartupTech',
        level: 'junior',
        industry: 'technology',
        responsibilities: ['Web development', 'Bug fixes', 'Feature implementation'],
        skills: ['JavaScript', 'React', 'Python', 'Git'],
        salary: 75000,
      },
      motivation: [
        'Passion for technology and programming',
        'Desire for more creative and technical work',
        'Better long-term career prospects in tech',
        'Dissatisfaction with finance industry culture',
      ],
      challenges: [
        'Learning programming from scratch',
        'Significant salary reduction initially',
        'Overcoming impostor syndrome',
        'Competing with CS graduates',
        'Explaining career change to employers',
      ],
      skillsGained: ['Programming', 'Web Development', 'Problem Solving', 'Technical Communication'],
      preparation: [
        'Completed 6-month coding bootcamp',
        'Built personal portfolio projects',
        'Contributed to open source projects',
        'Networked with tech professionals',
        'Practiced coding interview questions',
      ],
      outcomes: [
        'Successfully transitioned to tech career',
        'Developed strong programming skills',
        'Built professional network in tech',
        'Gained confidence in technical abilities',
      ],
      lessonsLearned: [
        'Career transitions require significant time investment',
        'Networking is crucial for career changes',
        'Initial salary reduction can be worthwhile for long-term growth',
        'Persistence and continuous learning are essential',
      ],
      successMetrics: {
        salaryIncrease: -10000, // Initial decrease
        satisfactionRating: 9,
        careerProgressionScore: 8,
        skillDevelopmentScore: 10,
      },
      duration: 424, // days
      status: 'completed',
      createdAt: '2022-01-01T00:00:00Z',
      updatedAt: '2023-03-01T00:00:00Z',
    },
    {
      id: 'transition-3',
      type: NodeType.CareerTransition,
      title: 'Startup to Enterprise Technology Transition',
      description: 'Moved from startup environment to large enterprise technology company',
      startDate: '2023-10-01',
      endDate: '2024-01-15',
      transitionType: 'company-change',
      category: 'environment-change',
      industry: 'technology',
      fromRole: {
        title: 'Full Stack Developer',
        company: 'StartupTech (50 employees)',
        level: 'mid-level',
        environment: 'startup',
        responsibilities: ['Full-stack development', 'Product decisions', 'Direct customer interaction'],
        skills: ['React', 'Node.js', 'MongoDB', 'DevOps'],
        salary: 110000,
      },
      toRole: {
        title: 'Senior Software Engineer',
        company: 'MegaCorp (50,000 employees)',
        level: 'senior',
        environment: 'enterprise',
        responsibilities: ['Backend development', 'System architecture', 'Code reviews', 'Mentoring'],
        skills: ['Java', 'Spring Boot', 'Microservices', 'Kubernetes'],
        salary: 135000,
      },
      motivation: [
        'Better work-life balance',
        'More structured career development',
        'Access to larger-scale systems',
        'Better benefits and job security',
      ],
      challenges: [
        'Adapting to enterprise bureaucracy',
        'Learning new technology stack',
        'Navigating larger organization politics',
        'Less direct impact on product decisions',
      ],
      skillsGained: ['Enterprise Architecture', 'Java Ecosystem', 'Large-scale Systems', 'Corporate Navigation'],
      preparation: [
        'Studied enterprise development patterns',
        'Learned Java and Spring Boot',
        'Researched company culture and values',
        'Prepared for behavioral interviews',
      ],
      outcomes: [
        'Successful adaptation to enterprise environment',
        '23% salary increase',
        'Better work-life balance achieved',
        'Access to world-class engineering practices',
      ],
      successMetrics: {
        salaryIncrease: 25000,
        satisfactionRating: 7,
        careerProgressionScore: 7,
        skillDevelopmentScore: 8,
      },
      duration: 106, // days
      status: 'completed',
      createdAt: '2023-10-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },
    {
      id: 'transition-4',
      type: NodeType.CareerTransition,
      title: 'Pursuing Entrepreneurship',
      description: 'Leaving corporate job to start own technology consulting company',
      startDate: '2024-02-01',
      endDate: '2024-12-31',
      transitionType: 'entrepreneurship',
      category: 'self-employment',
      industry: 'technology',
      fromRole: {
        title: 'Senior Software Engineer',
        company: 'MegaCorp',
        level: 'senior',
        employment: 'full-time',
        responsibilities: ['Backend development', 'System architecture'],
        skills: ['Java', 'Spring Boot', 'Microservices'],
        salary: 135000,
      },
      toRole: {
        title: 'Founder & CTO',
        company: 'TechConsult Solutions',
        level: 'executive',
        employment: 'self-employed',
        responsibilities: ['Business development', 'Technical consulting', 'Team building'],
        skills: ['Entrepreneurship', 'Sales', 'Business Development', 'Leadership'],
        projectedIncome: 200000,
      },
      motivation: [
        'Desire for complete autonomy',
        'Higher income potential',
        'Building something from scratch',
        'Flexible work arrangements',
      ],
      challenges: [
        'Income uncertainty and financial risk',
        'Learning business and sales skills',
        'Building client base from zero',
        'Managing all aspects of business',
      ],
      skillsGained: ['Business Development', 'Sales', 'Marketing', 'Financial Management'],
      preparation: [
        'Built emergency fund for 12 months expenses',
        'Completed business and sales courses',
        'Developed business plan and financial projections',
        'Established initial client relationships',
        'Set up legal and financial infrastructure',
      ],
      outcomes: [
        'Successfully launched consulting business',
        'Acquired 5 initial clients',
        'Generated $50k revenue in first 6 months',
      ],
      successMetrics: {
        satisfactionRating: 9,
        careerProgressionScore: 10,
        skillDevelopmentScore: 9,
        revenueGenerated: 50000,
      },
      duration: 334, // days
      status: 'in-progress',
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-08-01T00:00:00Z',
    },
  ];

  const mockProfile = {
    id: 1,
    userId: 1,
    username: 'testuser',
    filteredData: {
      workExperiences: [],
      education: [],
      projects: [],
      events: [],
      actions: [],
      careerTransitions: sampleTransitions,
    },
    rawData: {},
    projects: [],
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new CareerTransitionRepository(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('domain-specific queries', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('findByTransitionType', () => {
      it('should find role change transitions', async () => {
        const result = await repository.findByTransitionType(1, 'role-change');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Software Engineer to Engineering Manager');
        expect(result[0].transitionType).toBe('role-change');
      });

      it('should find career pivot transitions', async () => {
        const result = await repository.findByTransitionType(1, 'career-pivot');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Finance to Technology Career Pivot');
        expect(result[0].transitionType).toBe('career-pivot');
      });

      it('should find entrepreneurship transitions', async () => {
        const result = await repository.findByTransitionType(1, 'entrepreneurship');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Pursuing Entrepreneurship');
      });
    });

    describe('findByCategory', () => {
      it('should find promotion transitions', async () => {
        const result = await repository.findByCategory(1, 'promotion');

        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('promotion');
      });

      it('should find industry change transitions', async () => {
        const result = await repository.findByCategory(1, 'industry-change');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Finance to Technology Career Pivot');
      });

      it('should find self-employment transitions', async () => {
        const result = await repository.findByCategory(1, 'self-employment');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Pursuing Entrepreneurship');
      });
    });

    describe('findByIndustry', () => {
      it('should find technology industry transitions', async () => {
        const result = await repository.findByIndustry(1, 'technology');

        expect(result).toHaveLength(4); // All transitions are to/from technology
        expect(result.every(t => t.industry === 'technology')).toBe(true);
      });
    });

    describe('findByStatus', () => {
      it('should find completed transitions', async () => {
        const result = await repository.findByStatus(1, 'completed');

        expect(result).toHaveLength(3);
        expect(result.every(t => t.status === 'completed')).toBe(true);
      });

      it('should find in-progress transitions', async () => {
        const result = await repository.findByStatus(1, 'in-progress');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Pursuing Entrepreneurship');
      });
    });

    describe('findBySalaryIncrease', () => {
      it('should find transitions with positive salary increase', async () => {
        const result = await repository.findBySalaryIncrease(1, true);

        expect(result).toHaveLength(2); // Manager role and enterprise move
        expect(result.every(t => 
          t.successMetrics?.salaryIncrease && t.successMetrics.salaryIncrease > 0
        )).toBe(true);
      });

      it('should find transitions with salary decrease', async () => {
        const result = await repository.findBySalaryIncrease(1, false);

        expect(result).toHaveLength(1); // Finance to tech career pivot
        expect(result[0].successMetrics?.salaryIncrease).toBeLessThan(0);
      });
    });

    describe('findByDurationRange', () => {
      it('should find transitions within duration range', async () => {
        const result = await repository.findByDurationRange(1, 100, 200);

        expect(result).toHaveLength(2); // Manager transition (105 days) and enterprise move (106 days)
        expect(result.every(t => 
          t.duration && t.duration >= 100 && t.duration <= 200
        )).toBe(true);
      });

      it('should find long-term transitions', async () => {
        const result = await repository.findByDurationRange(1, 300, 500);

        expect(result).toHaveLength(2); // Career pivot (424 days) and entrepreneurship (334 days)
      });
    });

    describe('findBySatisfactionRating', () => {
      it('should find highly satisfying transitions', async () => {
        const result = await repository.findBySatisfactionRating(1, 8, 10);

        expect(result).toHaveLength(3);
        expect(result.every(t => 
          t.successMetrics?.satisfactionRating && 
          t.successMetrics.satisfactionRating >= 8
        )).toBe(true);
      });

      it('should find moderately satisfying transitions', async () => {
        const result = await repository.findBySatisfactionRating(1, 6, 7);

        expect(result).toHaveLength(1); // Enterprise transition with rating 7
      });
    });

    describe('findWithSkillsGained', () => {
      it('should find transitions with significant skill development', async () => {
        const result = await repository.findWithSkillsGained(1);

        expect(result).toHaveLength(4); // All transitions gained skills
        expect(result.every(t => t.skillsGained && t.skillsGained.length > 0)).toBe(true);
      });
    });

    describe('findBySkillGained', () => {
      it('should find transitions where specific skill was gained', async () => {
        const result = await repository.findBySkillGained(1, 'Leadership');

        expect(result).toHaveLength(1);
        expect(result[0].skillsGained).toContain('Team Leadership');
      });

      it('should find programming skill gains', async () => {
        const result = await repository.findBySkillGained(1, 'Programming');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Finance to Technology Career Pivot');
      });
    });

    describe('findByDateRange', () => {
      it('should find transitions within date range', async () => {
        const result = await repository.findByDateRange(1, '2023-01-01', '2023-12-31');

        expect(result).toHaveLength(3); // All 2023 transitions
      });

      it('should find transitions that overlap with date range', async () => {
        const result = await repository.findByDateRange(1, '2023-08-01', '2024-02-01');

        expect(result).toHaveLength(2); // Enterprise transition and entrepreneurship start
      });
    });

    describe('findAllSorted', () => {
      it('should return transitions sorted by start date (most recent first)', async () => {
        const result = await repository.findAllSorted(1);

        expect(result).toHaveLength(4);
        expect(result[0].title).toBe('Pursuing Entrepreneurship'); // 2024-02-01
        expect(result[1].title).toBe('Startup to Enterprise Technology Transition'); // 2023-10-01
        expect(result[2].title).toBe('Software Engineer to Engineering Manager'); // 2023-06-01
        expect(result[3].title).toBe('Finance to Technology Career Pivot'); // 2022-01-01
      });
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([mockProfile]);
    });

    describe('create', () => {
      it('should create transition with valid data', async () => {
        const validData = {
          type: NodeType.CareerTransition,
          title: 'Developer to Product Manager',
          description: 'Transitioning from development to product management',
          transitionType: 'role-change',
          category: 'lateral-move',
          industry: 'technology',
          fromRole: {
            title: 'Software Developer',
            company: 'TechCorp',
            level: 'mid-level',
          },
          toRole: {
            title: 'Product Manager',
            company: 'TechCorp',
            level: 'manager',
          },
          status: 'planned',
        };

        const result = await repository.create(1, validData);

        expect(result).toBeDefined();
        expect(result.title).toBe('Developer to Product Manager');
        expect(result.transitionType).toBe('role-change');
      });

      it('should throw error with invalid transition data', async () => {
        const invalidData = {
          type: NodeType.CareerTransition,
          title: '', // Empty title
          transitionType: 'role-change',
        } as any;

        await expect(repository.create(1, invalidData))
          .rejects.toThrow('Invalid career transition data');
      });

      it('should validate transition type enum', async () => {
        const invalidTypeData = {
          type: NodeType.CareerTransition,
          title: 'Test Transition',
          transitionType: 'invalid-type', // Invalid transition type
        } as any;

        await expect(repository.create(1, invalidTypeData))
          .rejects.toThrow('Invalid career transition data');
      });

      it('should validate role data structure', async () => {
        const invalidRoleData = {
          type: NodeType.CareerTransition,
          title: 'Test Transition',
          transitionType: 'role-change',
          fromRole: {
            // Missing required title field
            company: 'Test Company',
          },
        } as any;

        await expect(repository.create(1, invalidRoleData))
          .rejects.toThrow('Invalid career transition data');
      });
    });

    describe('update', () => {
      it('should update transition with valid partial data', async () => {
        const updates = {\n          status: 'completed' as const,\n          outcomes: ['Successfully completed transition'],\n          lessonsLearned: ['Key lesson from the transition'],\n        };\n\n        const result = await repository.update(1, 'transition-1', updates);\n\n        expect(result).not.toBeNull();\n      });\n\n      it('should handle empty updates', async () => {\n        const result = await repository.update(1, 'transition-1', {});\n\n        expect(result).not.toBeNull();\n      });\n\n      it('should validate enum values in updates', async () => {\n        const invalidUpdates = {\n          status: 'maybe-completed', // Invalid status\n        };\n\n        await expect(repository.update(1, 'transition-1', invalidUpdates))\n          .rejects.toThrow('Invalid career transition data');\n      });\n    });\n\n    describe('isValidNode', () => {\n      it('should validate career transition nodes correctly', () => {\n        const validNode = {\n          id: 'test-id',\n          type: NodeType.CareerTransition,\n          title: 'Test Transition',\n          transitionType: 'role-change',\n          status: 'planned',\n          createdAt: '2024-01-01T00:00:00Z',\n          updatedAt: '2024-01-01T00:00:00Z',\n        };\n\n        const invalidNode = {\n          id: 'test-id',\n          type: NodeType.CareerTransition,\n          title: '', // Empty title\n          transitionType: 'role-change',\n        };\n\n        expect(repository['isValidNode'](validNode)).toBe(true);\n        expect(repository['isValidNode'](invalidNode)).toBe(false);\n      });\n    });\n  });\n\n  describe('utility functions', () => {\n    describe('calculateTransitionDuration', () => {\n      it('should calculate transition duration in days', () => {\n        const duration = calculateTransitionDuration('2023-06-01', '2023-09-15');\n\n        expect(duration).toBe(106); // Days between dates\n      });\n\n      it('should handle ongoing transitions', () => {\n        const twoMonthsAgo = new Date();\n        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);\n\n        const duration = calculateTransitionDuration(twoMonthsAgo.toISOString());\n\n        expect(duration).toBeGreaterThan(50); // At least ~60 days\n      });\n\n      it('should return null for invalid dates', () => {\n        const duration = calculateTransitionDuration('invalid-date', '2023-09-15');\n\n        expect(duration).toBeNull();\n      });\n    });\n\n    describe('analyzeTransitionSuccess', () => {\n      it('should analyze highly successful transition', () => {\n        const transition = sampleTransitions[0]; // Engineering manager transition\n        const analysis = analyzeTransitionSuccess(transition);\n\n        expect(analysis.overallScore).toBeGreaterThan(7);\n        expect(analysis.strengths).toContain('salary increase');\n        expect(analysis.strengths).toContain('high satisfaction');\n      });\n\n      it('should analyze challenging but successful transition', () => {\n        const transition = sampleTransitions[1]; // Finance to tech pivot\n        const analysis = analyzeTransitionSuccess(transition);\n\n        expect(analysis.overallScore).toBeGreaterThan(7);\n        expect(analysis.challenges).toContain('salary decrease');\n        expect(analysis.strengths).toContain('high skill development');\n      });\n\n      it('should handle transitions without success metrics', () => {\n        const transitionWithoutMetrics = {\n          ...sampleTransitions[0],\n          successMetrics: undefined,\n        };\n\n        const analysis = analyzeTransitionSuccess(transitionWithoutMetrics);\n        expect(analysis.overallScore).toBe(5); // Neutral score\n      });\n    });\n\n    describe('categorizeTransitionType', () => {\n      it('should categorize transition types correctly', () => {\n        expect(categorizeTransitionType('role-change')).toBe('Role Change');\n        expect(categorizeTransitionType('career-pivot')).toBe('Career Pivot');\n        expect(categorizeTransitionType('company-change')).toBe('Company Change');\n        expect(categorizeTransitionType('industry-change')).toBe('Industry Change');\n        expect(categorizeTransitionType('entrepreneurship')).toBe('Entrepreneurship');\n      });\n\n      it('should handle unknown transition types', () => {\n        expect(categorizeTransitionType('unknown')).toBe('Other');\n        expect(categorizeTransitionType(undefined)).toBe('Unspecified');\n      });\n    });\n  });\n\n  describe('analytics and insights', () => {\n    beforeEach(() => {\n      mockDb.__setQueryResult([mockProfile]);\n    });\n\n    describe('getTransitionStatistics', () => {\n      it('should calculate comprehensive transition statistics', async () => {\n        const stats = await repository.getTransitionStatistics(1);\n\n        expect(stats).toEqual(expect.objectContaining({\n          totalTransitions: 4,\n          completedTransitions: 3,\n          inProgressTransitions: 1,\n          averageDuration: expect.any(Number),\n          averageSatisfactionRating: expect.any(Number),\n          successfulTransitions: expect.any(Number),\n          totalSalaryIncrease: expect.any(Number),\n        }));\n      });\n    });\n\n    describe('getSkillsGainedAnalysis', () => {\n      it('should analyze skills gained across all transitions', async () => {\n        const analysis = await repository.getSkillsGainedAnalysis(1);\n\n        expect(analysis).toEqual(expect.objectContaining({\n          totalSkillsGained: expect.any(Number),\n          topSkillCategories: expect.any(Array),\n          skillFrequency: expect.any(Object),\n        }));\n\n        expect(analysis.skillFrequency).toHaveProperty('Leadership');\n        expect(analysis.skillFrequency).toHaveProperty('Programming');\n      });\n    });\n\n    describe('getTransitionTypeBreakdown', () => {\n      it('should provide breakdown by transition type', async () => {\n        const breakdown = await repository.getTransitionTypeBreakdown(1);\n\n        expect(breakdown).toEqual(expect.objectContaining({\n          'role-change': 1,\n          'career-pivot': 1,\n          'company-change': 1,\n          'entrepreneurship': 1,\n        }));\n      });\n    });\n\n    describe('getSuccessFactors', () => {\n      it('should identify common success factors', async () => {\n        const factors = await repository.getSuccessFactors(1);\n\n        expect(factors).toEqual(expect.objectContaining({\n          preparationStrategies: expect.any(Array),\n          commonChallenges: expect.any(Array),\n          keyLessonsLearned: expect.any(Array),\n        }));\n\n        expect(factors.preparationStrategies).toContain('Completed management training course');\n        expect(factors.commonChallenges).toContain('Learning people management skills');\n      });\n    });\n  });\n\n  describe('performance and error handling', () => {\n    it('should handle database errors gracefully', async () => {\n      const errorQuery = {\n        from: vi.fn().mockReturnThis(),\n        where: vi.fn().mockReturnThis(),\n        limit: vi.fn().mockReturnThis(),\n        then: () => {\n          throw new Error('Database connection failed');\n        },\n      };\n      mockDb.select = vi.fn(() => errorQuery);\n\n      await expect(repository.findByTransitionType(1, 'role-change'))\n        .rejects.toThrow('Database connection failed');\n    });\n\n    it('should handle malformed transition data', async () => {\n      const malformedProfile = {\n        ...mockProfile,\n        filteredData: {\n          ...mockProfile.filteredData,\n          careerTransitions: null, // Malformed data\n        },\n      };\n      \n      mockDb.__setQueryResult([malformedProfile]);\n\n      const result = await repository.findAll(1);\n      expect(result).toEqual([]);\n    });\n\n    it('should handle transitions with missing role data', async () => {\n      const transitionWithMissingData = {\n        ...sampleTransitions[0],\n        fromRole: null, // Missing role data\n      };\n\n      const profileWithIncomplete = {\n        ...mockProfile,\n        filteredData: {\n          ...mockProfile.filteredData,\n          careerTransitions: [transitionWithMissingData],\n        },\n      };\n\n      mockDb.__setQueryResult([profileWithIncomplete]);\n\n      const result = await repository.findAll(1);\n      expect(result).toHaveLength(1);\n      expect(result[0].fromRole).toBeNull();\n    });\n  });\n\n  describe('complex queries and filtering', () => {\n    beforeEach(() => {\n      mockDb.__setQueryResult([mockProfile]);\n    });\n\n    describe('findHighImpactTransitions', () => {\n      it('should identify high-impact transitions', async () => {\n        const result = await repository.findHighImpactTransitions(1);\n\n        expect(result).toHaveLength(2); // Transitions with significant salary/satisfaction improvements\n        expect(result.every(t => \n          (t.successMetrics?.salaryIncrease && t.successMetrics.salaryIncrease > 20000) ||\n          (t.successMetrics?.satisfactionRating && t.successMetrics.satisfactionRating >= 9)\n        )).toBe(true);\n      });\n    });\n\n    describe('findSimilarTransitions', () => {\n      it('should find transitions similar to a given one', async () => {\n        const result = await repository.findSimilarTransitions(1, 'transition-1');\n\n        expect(result).toHaveLength(1); // Other tech industry role change\n        expect(result.every(t => \n          t.industry === 'technology' && \n          t.transitionType === 'role-change'\n        )).toBe(true);\n      });\n    });\n\n    describe('findTransitionsByCareerStage', () => {\n      it('should categorize transitions by career stage', async () => {\n        const earlyCareer = await repository.findTransitionsByCareerStage(1, 'early-career');\n        const midCareer = await repository.findTransitionsByCareerStage(1, 'mid-career');\n        const senior = await repository.findTransitionsByCareerStage(1, 'senior');\n\n        expect(earlyCareer).toHaveLength(1); // Finance to tech pivot\n        expect(midCareer).toHaveLength(2); // Manager and enterprise transitions\n        expect(senior).toHaveLength(1); // Entrepreneurship\n      });\n    });\n  });\n});\n\n// Export utility functions for testing\nexport { calculateTransitionDuration, analyzeTransitionSuccess, categorizeTransitionType };