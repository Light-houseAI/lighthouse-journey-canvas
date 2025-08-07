/**
 * ActionRepository Unit Tests
 * 
 * Comprehensive tests for ActionRepository class covering:
 * - CRUD operations for action nodes
 * - Action-specific queries (achievements, milestones, certifications)
 * - Category-based filtering (professional, personal, academic, volunteer)
 * - Impact and outcome tracking
 * - Priority and status management
 * - Skill development tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ActionRepository, calculateActionImpactScore, formatActionCategory, isHighPriorityAction } from '../action-repository';
import type { Action } from '../../types/node-types';
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

describe('ActionRepository', () => {
  let mockDb: any;
  let repository: ActionRepository;

  const sampleActions: Action[] = [
    {
      id: 'action-1',
      type: NodeType.Action,
      title: 'AWS Solutions Architect Certification',
      description: 'Earned AWS Solutions Architect Associate certification to enhance cloud computing skills',
      startDate: '2024-01-15',
      endDate: '2024-03-10',
      category: 'certification',
      subcategory: 'professional-development',
      priority: 'high',
      status: 'completed',
      impactLevel: 'high',
      outcomes: [
        'Passed AWS SAA exam with 850/1000 score',
        'Gained comprehensive cloud architecture knowledge',
        'Qualified for senior cloud engineer roles'
      ],
      skills: ['AWS', 'Cloud Architecture', 'DevOps', 'Solutions Design'],
      evidence: [
        'https://aws.amazon.com/certification/verify/ABC123',
        'https://linkedin.com/in/user/certifications'
      ],
      effort: {
        hoursInvested: 120,
        costInvested: 150,
        difficulty: 'medium'
      },
      mentor: 'John Smith, Senior Cloud Architect',
      resources: [
        'AWS Official Documentation',
        'A Cloud Guru Course',
        'Practice Labs'
      ],
      tags: ['aws', 'certification', 'cloud', 'career-growth'],
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-03-10T00:00:00Z',
    },
    {
      id: 'action-2',
      type: NodeType.Action,
      title: 'Open Source Contribution to React Library',
      description: 'Contributed bug fixes and feature enhancements to popular React component library',
      startDate: '2023-11-01',
      endDate: '2024-01-30',
      category: 'contribution',
      subcategory: 'open-source',
      priority: 'medium',
      status: 'completed',
      impactLevel: 'medium',
      outcomes: [
        '3 pull requests merged successfully',
        'Fixed critical accessibility issues',
        'Added TypeScript support for 2 components'
      ],
      skills: ['React', 'TypeScript', 'Open Source', 'Git', 'Testing'],
      evidence: [
        'https://github.com/popular-react-lib/pull/456',
        'https://github.com/popular-react-lib/pull/789',
        'https://github.com/popular-react-lib/pull/321'
      ],
      effort: {
        hoursInvested: 40,
        difficulty: 'low'
      },
      repositoryUrl: 'https://github.com/popular-react-lib',
      tags: ['react', 'open-source', 'typescript', 'accessibility'],
      createdAt: '2023-11-01T00:00:00Z',
      updatedAt: '2024-01-30T00:00:00Z',
    },
    {
      id: 'action-3',
      type: NodeType.Action,
      title: 'Led Team Building Workshop',
      description: 'Organized and facilitated team building workshop for 25 engineering team members',
      startDate: '2024-02-15',
      endDate: '2024-02-15',
      category: 'leadership',
      subcategory: 'team-development',
      priority: 'medium',
      status: 'completed',
      impactLevel: 'high',
      outcomes: [
        'Improved team collaboration scores by 30%',
        'Identified and resolved 5 communication bottlenecks',
        'Established new team communication protocols'
      ],
      skills: ['Leadership', 'Communication', 'Team Building', 'Facilitation'],
      evidence: [
        'Team feedback survey results',
        'Workshop materials and slides'
      ],
      effort: {
        hoursInvested: 20,
        costInvested: 500,
        difficulty: 'medium'
      },
      teamSize: 25,
      tags: ['leadership', 'team-building', 'communication', 'workshop'],
      createdAt: '2024-02-10T00:00:00Z',
      updatedAt: '2024-02-15T00:00:00Z',
    },
    {
      id: 'action-4',
      type: NodeType.Action,
      title: 'Volunteer Coding Bootcamp Mentorship',
      description: 'Mentored 5 students through 12-week coding bootcamp program',
      startDate: '2023-09-01',
      endDate: '2023-12-15',
      category: 'mentorship',
      subcategory: 'volunteer',
      priority: 'low',
      status: 'completed',
      impactLevel: 'high',
      outcomes: [
        '4 out of 5 students successfully graduated',
        '3 students secured entry-level developer positions',
        'Developed structured mentorship curriculum'
      ],
      skills: ['Mentoring', 'Teaching', 'JavaScript', 'Career Guidance'],
      effort: {
        hoursInvested: 60,
        difficulty: 'low'
      },
      organization: 'Code for Good Foundation',
      studentsSupported: 5,
      tags: ['mentorship', 'volunteer', 'education', 'giving-back'],
      createdAt: '2023-09-01T00:00:00Z',
      updatedAt: '2023-12-15T00:00:00Z',
    },
    {
      id: 'action-5',
      type: NodeType.Action,
      title: 'Research Paper Publication',
      description: 'Co-authored and published research paper on machine learning optimization techniques',
      startDate: '2024-01-01',
      endDate: '2024-04-30',
      category: 'research',
      subcategory: 'academic',
      priority: 'high',
      status: 'in-progress',
      impactLevel: 'high',
      outcomes: [
        'Paper accepted for peer review',
        'Presented preliminary findings at ML conference'
      ],
      skills: ['Machine Learning', 'Research', 'Academic Writing', 'Data Analysis'],
      evidence: [
        'https://arxiv.org/abs/2024.12345',
        'Conference presentation slides'
      ],
      effort: {
        hoursInvested: 200,
        difficulty: 'high'
      },
      collaborators: ['Dr. Jane Smith', 'Prof. Robert Johnson'],
      journal: 'Journal of Machine Learning Research',
      tags: ['research', 'machine-learning', 'academic', 'publication'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-04-15T00:00:00Z',
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
      actions: sampleActions,
      careerTransitions: [],
    },
    rawData: {},
    projects: [],
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new ActionRepository(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('domain-specific queries', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('findByCategory', () => {
      it('should find actions by category', async () => {
        const result = await repository.findByCategory(1, 'certification');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('AWS Solutions Architect Certification');
        expect(result[0].category).toBe('certification');
      });

      it('should find leadership actions', async () => {
        const result = await repository.findByCategory(1, 'leadership');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Led Team Building Workshop');
        expect(result[0].category).toBe('leadership');
      });

      it('should return empty array for non-existent category', async () => {
        const result = await repository.findByCategory(1, 'non-existent');

        expect(result).toHaveLength(0);
      });
    });

    describe('findBySubcategory', () => {
      it('should find professional development actions', async () => {
        const result = await repository.findBySubcategory(1, 'professional-development');

        expect(result).toHaveLength(1);
        expect(result[0].subcategory).toBe('professional-development');
      });

      it('should find volunteer actions', async () => {
        const result = await repository.findBySubcategory(1, 'volunteer');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Volunteer Coding Bootcamp Mentorship');
      });
    });

    describe('findByStatus', () => {
      it('should find completed actions', async () => {
        const result = await repository.findByStatus(1, 'completed');

        expect(result).toHaveLength(4);
        expect(result.every(action => action.status === 'completed')).toBe(true);
      });

      it('should find in-progress actions', async () => {
        const result = await repository.findByStatus(1, 'in-progress');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Research Paper Publication');
        expect(result[0].status).toBe('in-progress');
      });

      it('should find planned actions', async () => {
        // Add a planned action to test data
        const plannedAction = {
          ...sampleActions[0],
          id: 'action-planned',
          title: 'Planned Action',
          status: 'planned' as const,
        };

        const profileWithPlanned = {
          ...mockProfile,
          filteredData: {
            ...mockProfile.filteredData,
            actions: [...sampleActions, plannedAction],
          },
        };

        mockDb.__setQueryResult([profileWithPlanned]);

        const result = await repository.findByStatus(1, 'planned');

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('planned');
      });
    });

    describe('findByPriority', () => {
      it('should find high priority actions', async () => {
        const result = await repository.findByPriority(1, 'high');

        expect(result).toHaveLength(2);
        expect(result.every(action => action.priority === 'high')).toBe(true);
      });

      it('should find medium priority actions', async () => {
        const result = await repository.findByPriority(1, 'medium');

        expect(result).toHaveLength(2);
        expect(result.every(action => action.priority === 'medium')).toBe(true);
      });

      it('should find low priority actions', async () => {
        const result = await repository.findByPriority(1, 'low');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Volunteer Coding Bootcamp Mentorship');
      });
    });

    describe('findByImpactLevel', () => {
      it('should find high impact actions', async () => {
        const result = await repository.findByImpactLevel(1, 'high');

        expect(result).toHaveLength(3);
        expect(result.every(action => action.impactLevel === 'high')).toBe(true);
      });

      it('should find medium impact actions', async () => {
        const result = await repository.findByImpactLevel(1, 'medium');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Open Source Contribution to React Library');
      });
    });

    describe('findWithEvidence', () => {
      it('should find actions with evidence', async () => {
        const result = await repository.findWithEvidence(1);

        expect(result).toHaveLength(4); // All except one have evidence
        expect(result.every(action => action.evidence && action.evidence.length > 0)).toBe(true);
      });
    });

    describe('findBySkill', () => {
      it('should find actions by skill developed', async () => {
        const result = await repository.findBySkill(1, 'React');

        expect(result).toHaveLength(1);
        expect(result[0].skills).toContain('React');
      });

      it('should find actions by leadership skill', async () => {
        const result = await repository.findBySkill(1, 'Leadership');

        expect(result).toHaveLength(1);
        expect(result[0].skills).toContain('Leadership');
      });
    });

    describe('findByEffortRange', () => {
      it('should find actions by hours invested range', async () => {
        const result = await repository.findByEffortRange(1, 50, 150);

        expect(result).toHaveLength(2); // AWS cert (120 hours) and Research (200 hours partial)
        expect(result.every(action => 
          action.effort?.hoursInvested && 
          action.effort.hoursInvested >= 50 && 
          action.effort.hoursInvested <= 200
        )).toBe(true);
      });
    });

    describe('findByDateRange', () => {
      it('should find actions within date range', async () => {
        const result = await repository.findByDateRange(1, '2024-01-01', '2024-03-31');

        expect(result).toHaveLength(3); // AWS cert, Team building, Research paper
      });

      it('should find actions that overlap with date range', async () => {
        const result = await repository.findByDateRange(1, '2023-12-01', '2024-02-01');

        expect(result).toHaveLength(2); // Open source contribution and AWS cert
      });
    });

    describe('findAllSorted', () => {
      it('should return actions sorted by start date (most recent first)', async () => {
        const result = await repository.findAllSorted(1);

        expect(result).toHaveLength(5);
        expect(result[0].title).toBe('Led Team Building Workshop'); // 2024-02-15
        expect(result[1].title).toBe('AWS Solutions Architect Certification'); // 2024-01-15
        expect(result[2].title).toBe('Research Paper Publication'); // 2024-01-01
      });

      it('should sort by priority when dates are similar', async () => {
        const result = await repository.findAllSortedByPriority(1);

        const highPriorityCount = result.filter(action => action.priority === 'high').length;
        expect(highPriorityCount).toBe(2);
        
        // High priority actions should come first
        expect(result[0].priority).toBe('high');
      });
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([mockProfile]);
    });

    describe('create', () => {
      it('should create action with valid data', async () => {
        const validData = {
          type: NodeType.Action,
          title: 'Complete Docker Certification',
          description: 'Obtain Docker Certified Associate certification',
          category: 'certification',
          subcategory: 'professional-development',
          priority: 'medium',
          status: 'planned',
          impactLevel: 'medium',
        };

        const result = await repository.create(1, validData);

        expect(result).toBeDefined();
        expect(result.title).toBe('Complete Docker Certification');
        expect(result.category).toBe('certification');
      });

      it('should throw error with invalid action data', async () => {
        const invalidData = {
          type: NodeType.Action,
          title: '', // Empty title
          category: 'certification',
        } as any;

        await expect(repository.create(1, invalidData))
          .rejects.toThrow('Invalid action data');
      });

      it('should validate category enum', async () => {
        const invalidCategoryData = {
          type: NodeType.Action,
          title: 'Test Action',
          category: 'invalid-category', // Invalid category
        } as any;

        await expect(repository.create(1, invalidCategoryData))
          .rejects.toThrow('Invalid action data');
      });

      it('should validate priority enum', async () => {
        const invalidPriorityData = {
          type: NodeType.Action,
          title: 'Test Action',
          category: 'certification',
          priority: 'super-high', // Invalid priority
        } as any;

        await expect(repository.create(1, invalidPriorityData))
          .rejects.toThrow('Invalid action data');
      });

      it('should validate status enum', async () => {
        const invalidStatusData = {
          type: NodeType.Action,
          title: 'Test Action',
          category: 'certification',
          status: 'maybe-completed', // Invalid status
        } as any;

        await expect(repository.create(1, invalidStatusData))
          .rejects.toThrow('Invalid action data');
      });
    });

    describe('update', () => {
      it('should update action with valid partial data', async () => {
        const updates = {
          status: 'completed' as const,
          outcomes: ['Successfully completed the action'],
          effort: {
            hoursInvested: 25,
            difficulty: 'easy' as const,
          },
        };

        const result = await repository.update(1, 'action-1', updates);

        expect(result).not.toBeNull();
      });

      it('should handle empty updates', async () => {
        const result = await repository.update(1, 'action-1', {});

        expect(result).not.toBeNull();
      });

      it('should validate enum values in updates', async () => {
        const invalidUpdates = {
          priority: 'super-urgent', // Invalid priority
        };

        await expect(repository.update(1, 'action-1', invalidUpdates))
          .rejects.toThrow('Invalid action data');
      });
    });

    describe('isValidNode', () => {
      it('should validate action nodes correctly', () => {
        const validNode = {
          id: 'test-id',
          type: NodeType.Action,
          title: 'Test Action',
          category: 'certification',
          priority: 'medium',
          status: 'planned',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const invalidNode = {
          id: 'test-id',
          type: NodeType.Action,
          title: '', // Empty title
          category: 'certification',
        };

        expect(repository['isValidNode'](validNode)).toBe(true);
        expect(repository['isValidNode'](invalidNode)).toBe(false);
      });
    });
  });

  describe('utility functions', () => {
    describe('calculateActionImpactScore', () => {
      it('should calculate impact score based on multiple factors', () => {
        const action = sampleActions[0]; // AWS Certification
        const score = calculateActionImpactScore(action);

        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(100);
      });

      it('should give higher scores to high-impact actions', () => {
        const highImpactAction = sampleActions[0]; // AWS Certification - high impact
        const mediumImpactAction = sampleActions[1]; // Open Source - medium impact

        const highScore = calculateActionImpactScore(highImpactAction);
        const mediumScore = calculateActionImpactScore(mediumImpactAction);

        expect(highScore).toBeGreaterThan(mediumScore);
      });

      it('should handle actions without effort data', () => {
        const actionWithoutEffort = {
          ...sampleActions[0],
          effort: undefined,
        };

        const score = calculateActionImpactScore(actionWithoutEffort);
        expect(score).toBeGreaterThan(0);
      });
    });

    describe('formatActionCategory', () => {
      it('should format action categories correctly', () => {
        expect(formatActionCategory('certification')).toBe('Certification');
        expect(formatActionCategory('leadership')).toBe('Leadership');
        expect(formatActionCategory('contribution')).toBe('Contribution');
        expect(formatActionCategory('mentorship')).toBe('Mentorship');
        expect(formatActionCategory('research')).toBe('Research');
        expect(formatActionCategory('volunteer')).toBe('Volunteer Work');
      });

      it('should handle unknown categories', () => {
        expect(formatActionCategory('unknown')).toBe('Other');
        expect(formatActionCategory(undefined)).toBe('Uncategorized');
      });
    });

    describe('isHighPriorityAction', () => {
      it('should identify high priority actions', () => {
        expect(isHighPriorityAction('high')).toBe(true);
        expect(isHighPriorityAction('medium')).toBe(false);
        expect(isHighPriorityAction('low')).toBe(false);
      });

      it('should handle undefined priority', () => {
        expect(isHighPriorityAction(undefined)).toBe(false);
      });
    });
  });

  describe('analytics and insights', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('getActionStatistics', () => {
      it('should calculate comprehensive action statistics', async () => {
        const stats = await repository.getActionStatistics(1);

        expect(stats).toEqual(expect.objectContaining({
          totalActions: 5,
          completedActions: 4,
          inProgressActions: 1,
          plannedActions: 0,
          highPriorityActions: 2,
          highImpactActions: 3,
          totalHoursInvested: expect.any(Number),
          averageImpactScore: expect.any(Number),
        }));
      });
    });

    describe('getSkillsFromActions', () => {
      it('should extract unique skills from all actions', async () => {
        const skills = await repository.getSkillsFromActions(1);

        expect(skills).toContain('AWS');
        expect(skills).toContain('React');
        expect(skills).toContain('Leadership');
        expect(skills).toContain('Machine Learning');
        expect(skills).toContain('Teaching');
      });
    });

    describe('getCategoryBreakdown', () => {
      it('should provide breakdown by category', async () => {
        const breakdown = await repository.getCategoryBreakdown(1);

        expect(breakdown).toEqual(expect.objectContaining({
          certification: 1,
          leadership: 1,
          contribution: 1,
          mentorship: 1,
          research: 1,
        }));
      });
    });

    describe('getCompletionRate', () => {
      it('should calculate completion rate', async () => {
        const rate = await repository.getCompletionRate(1);

        expect(rate).toBe(0.8); // 4 out of 5 completed
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

      await expect(repository.findByCategory(1, 'certification'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle malformed action data', async () => {
      const malformedProfile = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          actions: null, // Malformed data
        },
      };
      
      mockDb.__setQueryResult([malformedProfile]);

      const result = await repository.findAll(1);
      expect(result).toEqual([]);
    });

    it('should handle missing required fields gracefully', async () => {
      const actionWithMissingFields = {
        id: 'action-incomplete',
        type: NodeType.Action,
        title: 'Incomplete Action',
        // Missing other required fields
      };

      const profileWithIncomplete = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          actions: [actionWithMissingFields],
        },
      };

      mockDb.__setQueryResult([profileWithIncomplete]);

      const result = await repository.findAll(1);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Incomplete Action');
    });
  });

  describe('performance and optimization', () => {
    beforeEach(() => {
      // Create a large dataset for performance testing
      const manyActions = Array.from({ length: 50 }, (_, i) => ({
        ...sampleActions[0],
        id: `action-${i}`,
        title: `Action ${i}`,
        category: i % 2 === 0 ? 'certification' : 'leadership',
        priority: ['high', 'medium', 'low'][i % 3] as const,
      }));

      const profileWithManyActions = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          actions: manyActions,
        },
      };

      mockDb.__setQueryResult([profileWithManyActions]);
    });

    describe('findAllPaginated', () => {
      it('should support pagination for large datasets', async () => {
        const result = await repository.findAllPaginated(1, 1, 10);

        expect(result.data).toHaveLength(10);
        expect(result.total).toBe(50);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
        expect(result.totalPages).toBe(5);
      });

      it('should handle filtering with pagination', async () => {
        const result = await repository.findByCategoryPaginated(1, 'certification', 1, 10);

        expect(result.data).toHaveLength(10);
        expect(result.data.every(action => action.category === 'certification')).toBe(true);
      });
    });
  });
});

// Export utility functions for testing
export { calculateActionImpactScore, formatActionCategory, isHighPriorityAction };