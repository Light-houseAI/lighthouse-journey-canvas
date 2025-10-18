/**
 * Unit Tests for Career Transition Target Resolution (LIG-207)
 *
 * Tests the service's ability to resolve target role and company
 * from career transition children (job application nodes).
 */

import type { TimelineNode } from '@journey/schema';
import { TimelineNodeType } from '@journey/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type { IHierarchyRepository } from '../../repositories/interfaces/hierarchy.repository.interface';
import type {
  GraphRAGSearchResponse,
  IPgVectorGraphRAGService,
} from '../../types/graphrag.types';
import {
  ExperienceMatchesService,
  type IUpdatesService,
} from '../experience-matches.service';
import type { IHybridJobApplicationMatchingService } from '../interfaces/hybrid-job-application-matching.interface';

describe('ExperienceMatchesService - Career Transition Target Resolution (LIG-207)', () => {
  let service: ExperienceMatchesService;
  let mockLogger: MockProxy<Logger>;
  let mockHierarchyRepository: MockProxy<IHierarchyRepository>;
  let mockPgVectorGraphRAGService: MockProxy<IPgVectorGraphRAGService>;
  let mockUpdatesService: MockProxy<IUpdatesService>;
  let mockHybridMatchingService: MockProxy<IHybridJobApplicationMatchingService>;

  const TEST_CAREER_TRANSITION_ID = '123e4567-e89b-12d3-a456-426614174000';
  const TEST_JOB_APP_ID = '223e4567-e89b-12d3-a456-426614174001';
  const TEST_USER_ID = 1;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    mockHierarchyRepository = mock<IHierarchyRepository>();
    mockPgVectorGraphRAGService = mock<IPgVectorGraphRAGService>();
    mockUpdatesService = mock<IUpdatesService>();
    mockHybridMatchingService = mock<IHybridJobApplicationMatchingService>();

    service = new ExperienceMatchesService({
      logger: mockLogger,
      hierarchyRepository: mockHierarchyRepository,
      pgVectorGraphRAGService: mockPgVectorGraphRAGService,
      updatesService: mockUpdatesService,
      hybridJobApplicationMatchingService: mockHybridMatchingService,
    });

    // Clear all mocks
    mockClear(mockLogger);
    mockClear(mockHierarchyRepository);
    mockClear(mockPgVectorGraphRAGService);
    mockClear(mockHybridMatchingService);
  });

  describe('getCareerTransitionChildren - Private Method Behavior', () => {
    it('should fetch and filter job application children correctly', async () => {
      // Create parent career transition
      const careerTransition: TimelineNode = {
        id: TEST_CAREER_TRANSITION_ID,
        type: TimelineNodeType.CareerTransition,
        meta: {
          title: 'Software Engineer',
          description: 'Transitioning to tech',
          startDate: '2025-01',
        },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      // Create child job application
      const jobApplication: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Senior Software Engineer',
          company: 'Google',
          companyId: 1,
          applicationStatus: 'applied',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
      };

      // Create non-job-application child (should be filtered out)
      const projectChild: TimelineNode = {
        id: '323e4567-e89b-12d3-a456-426614174002',
        type: TimelineNodeType.Project,
        meta: {
          title: 'Portfolio Website',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-03'),
      };

      // Mock repository responses
      mockHierarchyRepository.getById.mockResolvedValue(jobApplication);
      mockHierarchyRepository.getAllNodes.mockResolvedValue([
        careerTransition,
        jobApplication,
        projectChild,
      ]);

      // Mock hybrid service to verify it receives correct targets
      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test query',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      // Act
      await service.getExperienceMatches(TEST_JOB_APP_ID, TEST_USER_ID);

      // Assert - verify hybrid matching was called with resolved targets
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalledWith(
        TEST_JOB_APP_ID,
        TEST_USER_ID,
        expect.arrayContaining([
          expect.objectContaining({ id: careerTransition.id }),
          expect.objectContaining({ id: jobApplication.id }),
          expect.objectContaining({ id: projectChild.id }),
        ]),
        'Senior Software Engineer', // Resolved from first child
        'Google' // Resolved from first child
      );
    });

    it('should handle multiple job application children - use first child', async () => {
      const careerTransition: TimelineNode = {
        id: TEST_CAREER_TRANSITION_ID,
        type: TimelineNodeType.CareerTransition,
        meta: { title: 'Engineer', startDate: '2025-01' },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      const jobApp1: TimelineNode = {
        id: 'job-app-1',
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Software Engineer',
          company: 'Google',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
      };

      const jobApp2: TimelineNode = {
        id: 'job-app-2',
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Backend Engineer',
          company: 'Meta',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-03'),
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(jobApp1) // First call: get the current node
        .mockResolvedValueOnce(careerTransition); // Second call: get the parent
      mockHierarchyRepository.getAllNodes.mockResolvedValue([
        careerTransition,
        jobApp1,
        jobApp2,
      ]);

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      await service.getExperienceMatches('job-app-1', TEST_USER_ID);

      // Should use first child's data (Google, Software Engineer)
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalledWith(
        'job-app-1',
        TEST_USER_ID,
        expect.any(Array),
        'Software Engineer',
        'Google'
      );

      // Verify logging mentions multiple children
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Resolved targets from career transition children',
        expect.objectContaining({
          childCount: 2,
          resolvedRole: 'Software Engineer',
          resolvedCompany: 'Google',
        })
      );
    });

    it('should filter out non-job-application children', async () => {
      const careerTransition: TimelineNode = {
        id: TEST_CAREER_TRANSITION_ID,
        type: TimelineNodeType.CareerTransition,
        meta: { title: 'Engineer', startDate: '2025-01' },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const jobApp: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Engineer',
          company: 'Google',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Non-job-application children (should be filtered)
      const interviewEvent: TimelineNode = {
        id: 'interview-1',
        type: 'event',
        meta: { eventType: 'interview' }, // Different event type
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const project: TimelineNode = {
        id: 'project-1',
        type: TimelineNodeType.Project,
        meta: { title: 'Project' },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(jobApp) // First call: get the current node
        .mockResolvedValueOnce(careerTransition); // Second call: get the parent
      mockHierarchyRepository.getAllNodes.mockResolvedValue([
        careerTransition,
        jobApp,
        interviewEvent,
        project,
      ]);

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      await service.getExperienceMatches(TEST_JOB_APP_ID, TEST_USER_ID);

      // Should only count job application child (childCount: 1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Resolved targets from career transition children',
        expect.objectContaining({
          childCount: 1,
        })
      );
    });

    it('should handle career transition with no job application children', async () => {
      const careerTransition: TimelineNode = {
        id: TEST_CAREER_TRANSITION_ID,
        type: TimelineNodeType.CareerTransition,
        meta: { title: 'Engineer', startDate: '2025-01' },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const jobApp: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Original Role',
          company: 'Original Company',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(jobApp) // First call: get the current node
        .mockResolvedValueOnce(careerTransition); // Second call: get the parent
      // Only one child (the current node itself) - should use node's own targets
      mockHierarchyRepository.getAllNodes.mockResolvedValue([
        careerTransition,
        jobApp,
      ]);

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      await service.getExperienceMatches(TEST_JOB_APP_ID, TEST_USER_ID);

      // Should use node's own targets when no other children
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalledWith(
        TEST_JOB_APP_ID,
        TEST_USER_ID,
        expect.any(Array),
        'Original Role', // From node itself, not resolved
        'Original Company' // From node itself, not resolved
      );
    });
  });

  describe('Error Handling and Graceful Degradation', () => {
    it('should gracefully handle getAllNodes failure', async () => {
      const jobApp: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Engineer',
          company: 'Google',
          applicationStatus: 'applied',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const parent: TimelineNode = {
        id: TEST_CAREER_TRANSITION_ID,
        type: TimelineNodeType.CareerTransition,
        meta: { title: 'Engineer' },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(jobApp) // First call for node
        .mockResolvedValueOnce(parent); // Second call for parent

      // getAllNodes: first call (user timeline) succeeds, second call (children fetch) fails
      mockHierarchyRepository.getAllNodes
        .mockResolvedValueOnce([jobApp]) // First call: user timeline succeeds
        .mockRejectedValueOnce(new Error('Database connection failed')); // Second call: children fetch fails

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      await service.getExperienceMatches(TEST_JOB_APP_ID, TEST_USER_ID);

      // Should log warning but continue with node's own targets
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch career transition children',
        expect.objectContaining({
          parentNodeId: TEST_CAREER_TRANSITION_ID,
          userId: TEST_USER_ID,
        })
      );

      // Should still call hybrid matching with node's own data
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalledWith(
        TEST_JOB_APP_ID,
        TEST_USER_ID,
        expect.any(Array),
        'Engineer',
        'Google'
      );
    });

    it('should handle parent fetch failure gracefully', async () => {
      const jobApp: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Engineer',
          company: 'Google',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(jobApp) // First call succeeds
        .mockRejectedValueOnce(new Error('Parent not found')); // Second call fails

      mockHierarchyRepository.getAllNodes.mockResolvedValue([jobApp]);

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      await service.getExperienceMatches(TEST_JOB_APP_ID, TEST_USER_ID);

      // Should log warning about parent resolution failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to resolve targets from parent, using node targets',
        expect.objectContaining({
          parentId: TEST_CAREER_TRANSITION_ID,
        })
      );

      // Should continue with node's own targets
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalled();
    });

    it('should handle parent not being career transition', async () => {
      const jobApp: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Engineer',
          company: 'Google',
        },
        userId: TEST_USER_ID,
        parentId: 'some-job-parent',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const jobParent: TimelineNode = {
        id: 'some-job-parent',
        type: TimelineNodeType.Job, // Not a career transition
        meta: { role: 'Manager' },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(jobApp)
        .mockResolvedValueOnce(jobParent);

      mockHierarchyRepository.getAllNodes.mockResolvedValue([
        jobParent,
        jobApp,
      ]);

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      await service.getExperienceMatches(TEST_JOB_APP_ID, TEST_USER_ID);

      // Should NOT attempt to resolve children since parent is not career transition
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Resolved targets from career transition children',
        expect.any(Object)
      );

      // Should use node's own targets
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalledWith(
        TEST_JOB_APP_ID,
        TEST_USER_ID,
        expect.any(Array),
        'Engineer',
        'Google'
      );
    });
  });

  describe('Partial Data Scenarios', () => {
    it('should handle child with missing jobTitle - fallback to node', async () => {
      const careerTransition: TimelineNode = {
        id: TEST_CAREER_TRANSITION_ID,
        type: TimelineNodeType.CareerTransition,
        meta: { title: 'Engineer' },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const jobApp: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Original Role',
          company: 'Original Company',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const childWithoutTitle: TimelineNode = {
        id: 'child-1',
        type: 'event',
        meta: {
          eventType: 'job-application',
          // jobTitle missing
          company: 'Google',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(jobApp)
        .mockResolvedValueOnce(careerTransition);

      mockHierarchyRepository.getAllNodes.mockResolvedValue([
        careerTransition,
        jobApp,
        childWithoutTitle,
      ]);

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      await service.getExperienceMatches(TEST_JOB_APP_ID, TEST_USER_ID);

      // Should fallback to node's jobTitle when child is missing it
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalledWith(
        TEST_JOB_APP_ID,
        TEST_USER_ID,
        expect.any(Array),
        'Original Role', // Fallback to node's own jobTitle
        'Google' // From child
      );
    });

    it('should handle child with missing company - fallback to node', async () => {
      const careerTransition: TimelineNode = {
        id: TEST_CAREER_TRANSITION_ID,
        type: TimelineNodeType.CareerTransition,
        meta: { title: 'Engineer' },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const jobApp: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Original Role',
          company: 'Original Company',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const childWithoutCompany: TimelineNode = {
        id: 'child-1',
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Software Engineer',
          // company missing
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(jobApp)
        .mockResolvedValueOnce(careerTransition);

      mockHierarchyRepository.getAllNodes.mockResolvedValue([
        careerTransition,
        jobApp,
        childWithoutCompany,
      ]);

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      await service.getExperienceMatches(TEST_JOB_APP_ID, TEST_USER_ID);

      // Should fallback to node's company when child is missing it
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalledWith(
        TEST_JOB_APP_ID,
        TEST_USER_ID,
        expect.any(Array),
        'Software Engineer', // From child
        'Original Company' // Fallback to node's own company
      );
    });
  });

  describe('Integration with Hybrid Matching Service', () => {
    it('should pass resolved targets to hybrid matching service', async () => {
      const careerTransition: TimelineNode = {
        id: TEST_CAREER_TRANSITION_ID,
        type: TimelineNodeType.CareerTransition,
        meta: { title: 'Engineer' },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const jobApp: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Node Role',
          company: 'Node Company',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const childJobApp: TimelineNode = {
        id: 'child-1',
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Senior Software Engineer',
          company: 'Google',
          companyId: 123,
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(jobApp)
        .mockResolvedValueOnce(careerTransition);

      mockHierarchyRepository.getAllNodes.mockResolvedValue([
        careerTransition,
        jobApp,
        childJobApp,
      ]);

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'Google Senior Software Engineer career trajectory',
        totalResults: 3,
        profiles: [
          {
            userId: 2,
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            profilePictureUrl: null,
            whyMatched: 'Similar career path to Google',
            skills: ['JavaScript', 'React'],
            matchedNodes: [],
          },
        ],
        timestamp: new Date().toISOString(),
      };

      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      const result = await service.getExperienceMatches(
        TEST_JOB_APP_ID,
        TEST_USER_ID
      );

      // Verify hybrid matching was called with resolved targets
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalledWith(
        TEST_JOB_APP_ID,
        TEST_USER_ID,
        expect.any(Array),
        'Senior Software Engineer', // Resolved from child
        'Google' // Resolved from child
      );

      // Verify result is returned correctly
      expect(result).toEqual(mockHybridResponse);
      expect(result?.totalResults).toBe(3);
    });
  });

  describe('Sorting Edge Cases', () => {
    it('should handle identical timestamps - prefer sibling over current node', async () => {
      const careerTransition: TimelineNode = {
        id: TEST_CAREER_TRANSITION_ID,
        type: TimelineNodeType.CareerTransition,
        meta: { title: 'Engineer' },
        userId: TEST_USER_ID,
        parentId: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      const sameTimestamp = new Date('2025-01-02T10:00:00Z');

      const currentJobApp: TimelineNode = {
        id: TEST_JOB_APP_ID,
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Current Node Title',
          company: 'Current Node Company',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: sameTimestamp, // Identical timestamp
        updatedAt: sameTimestamp,
      };

      const siblingJobApp: TimelineNode = {
        id: 'sibling-1',
        type: 'event',
        meta: {
          eventType: 'job-application',
          jobTitle: 'Sibling Title',
          company: 'Sibling Company',
        },
        userId: TEST_USER_ID,
        parentId: TEST_CAREER_TRANSITION_ID,
        createdAt: sameTimestamp, // Identical timestamp
        updatedAt: sameTimestamp,
      };

      mockHierarchyRepository.getById
        .mockResolvedValueOnce(currentJobApp)
        .mockResolvedValueOnce(careerTransition);

      // Return in this order: current, sibling (both with same timestamp)
      mockHierarchyRepository.getAllNodes.mockResolvedValue([
        careerTransition,
        currentJobApp,
        siblingJobApp,
      ]);

      const mockHybridResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockHybridMatchingService.findMatchesForJobApplication.mockResolvedValue(
        mockHybridResponse
      );

      await service.getExperienceMatches(TEST_JOB_APP_ID, TEST_USER_ID);

      // When timestamps are identical, tie-breaker should prefer sibling
      expect(
        mockHybridMatchingService.findMatchesForJobApplication
      ).toHaveBeenCalledWith(
        TEST_JOB_APP_ID,
        TEST_USER_ID,
        expect.any(Array),
        'Sibling Title', // Should use sibling, not current node
        'Sibling Company' // Should use sibling, not current node
      );

      // Verify logging shows resolution happened
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Resolved targets from career transition children',
        expect.objectContaining({
          childCount: 2,
          resolvedRole: 'Sibling Title',
          resolvedCompany: 'Sibling Company',
        })
      );
    });
  });
});
