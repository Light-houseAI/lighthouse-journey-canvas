/**
 * Unit Tests for Experience Matches Service (LIG-182)
 *
 * Tests the service for detecting and fetching matches for current experience nodes.
 */

import type { TimelineNode } from '@journey/schema';
import { TimelineNodeType } from '@journey/schema';
import { beforeEach,describe, expect, it } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type { IHierarchyRepository } from '../../repositories/interfaces/hierarchy.repository.interface';
import type { GraphRAGSearchResponse,IPgVectorGraphRAGService } from '../../types/graphrag.types';
import { ExperienceMatchesService, IUpdatesService } from '../experience-matches.service';

describe('ExperienceMatchesService', () => {
  let service: ExperienceMatchesService;
  let mockLogger: MockProxy<Logger>;
  let mockHierarchyRepository: MockProxy<IHierarchyRepository>;
  let mockPgVectorGraphRAGService: MockProxy<IPgVectorGraphRAGService>;
  let mockUpdatesService: MockProxy<IUpdatesService>;

  const TEST_NODE_ID = '123e4567-e89b-12d3-a456-426614174000';
  const TEST_USER_ID = 1;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    mockHierarchyRepository = mock<IHierarchyRepository>();
    mockPgVectorGraphRAGService = mock<IPgVectorGraphRAGService>();
    mockUpdatesService = mock<IUpdatesService>();

    service = new ExperienceMatchesService({
      logger: mockLogger,
      hierarchyRepository: mockHierarchyRepository,
      pgVectorGraphRAGService: mockPgVectorGraphRAGService,
      updatesService: mockUpdatesService,
    });

    // Clear all mocks
    mockClear(mockLogger);
    mockClear(mockHierarchyRepository);
    mockClear(mockPgVectorGraphRAGService);
  });

  describe('getExperienceMatches', () => {
    const createTestNode = (overrides: Partial<TimelineNode> = {}): TimelineNode => ({
      id: TEST_NODE_ID,
      type: TimelineNodeType.Job,
      meta: {
        orgId: 123,
        role: 'Senior Software Engineer',
        description: 'Building scalable React applications',
        startDate: '2024-01',
        endDate: null, // Current experience
      },
      userId: TEST_USER_ID,
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      position: 0,
      ...overrides,
    });

    const mockGraphRAGResponse: GraphRAGSearchResponse = {
      query: 'Building scalable React applications',
      totalResults: 2,
      profiles: [
        {
          userId: 2,
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice@example.com',
          profilePictureUrl: null,
          whyMatched: 'Expert in React and TypeScript development',
          skills: ['React', 'TypeScript', 'Node.js'],
          matchedNodes: [
            {
              id: 'node-2',
              type: TimelineNodeType.Job,
              meta: { role: 'Frontend Engineer', company: 'TechCorp' },
              score: 0.92,
            },
          ],
        },
      ],
      timestamp: new Date().toISOString(),
    };

    describe('Success Cases', () => {
      it('should return matches for current job experience', async () => {
        const testNode = createTestNode();
        mockHierarchyRepository.getById.mockResolvedValue(testNode);
        mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

        const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

        expect(result).toEqual(mockGraphRAGResponse);
        expect(mockHierarchyRepository.getById).toHaveBeenCalledWith(TEST_NODE_ID, TEST_USER_ID);
        expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith({
          query: 'Building scalable React applications',
          limit: 3,
          excludeUserId: TEST_USER_ID,
          requestingUserId: TEST_USER_ID,
        });
      });

      it('should return matches for current education experience', async () => {
        const testNode = createTestNode({
          type: TimelineNodeType.Education,
          meta: {
            orgId: 456,
            degree: 'Computer Science',
            description: 'Machine learning and AI coursework',
            startDate: '2020-09',
            endDate: null,
          },
        });
        mockHierarchyRepository.getById.mockResolvedValue(testNode);
        mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

        const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

        expect(result).toEqual(mockGraphRAGResponse);
        expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith({
          query: 'Machine learning and AI coursework',
          limit: 3,
          excludeUserId: TEST_USER_ID,
          requestingUserId: TEST_USER_ID,
        });
      });

      it('should return matches for current career transition', async () => {
        const testNode = createTestNode({
          type: TimelineNodeType.CareerTransition,
          meta: {
            title: 'Career Change to Tech',
            description: 'Transitioning from finance to software development',
            startDate: '2024-01',
            endDate: null,
          },
        });
        mockHierarchyRepository.getById.mockResolvedValue(testNode);
        mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

        const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

        expect(result).toEqual(mockGraphRAGResponse);
        expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith({
          query: 'Transitioning from finance to software development',
          limit: 3,
          excludeUserId: TEST_USER_ID,
          requestingUserId: TEST_USER_ID,
        });
      });

      it('should handle force refresh parameter', async () => {
        const testNode = createTestNode();
        mockHierarchyRepository.getById.mockResolvedValue(testNode);
        mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

        const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID, true);

        expect(result).toEqual(mockGraphRAGResponse);
        // Force refresh is handled by caller (TanStack Query), service just processes normally
        expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalled();
      });
    });

    describe('Empty Results Cases', () => {
      it('should return null when node not found', async () => {
        mockHierarchyRepository.getById.mockResolvedValue(null);

        const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith('Node not found', { nodeId: TEST_NODE_ID });
        expect(mockPgVectorGraphRAGService.searchProfiles).not.toHaveBeenCalled();
      });

      it('should return null for non-experience node types', async () => {
        const projectNode = createTestNode({
          type: TimelineNodeType.Project,
          meta: {
            title: 'Portfolio Website',
            description: 'Personal portfolio built with React',
          },
        });
        mockHierarchyRepository.getById.mockResolvedValue(projectNode);

        const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

        expect(result).toBeNull();
        expect(mockLogger.info).toHaveBeenCalledWith('Node is not an experience type or job application', {
          nodeId: TEST_NODE_ID,
          type: TimelineNodeType.Project
        });
        expect(mockPgVectorGraphRAGService.searchProfiles).not.toHaveBeenCalled();
      });

      it('should return empty response for past experiences', async () => {
        const pastJobNode = createTestNode({
          meta: {
            orgId: 123,
            role: 'Software Engineer',
            description: 'Built web applications',
            startDate: '2020-01',
            endDate: '2022-12', // Past experience
          },
        });
        mockHierarchyRepository.getById.mockResolvedValue(pastJobNode);

        const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

        expect(result).toEqual({
          query: '',
          totalResults: 0,
          profiles: [],
          timestamp: expect.any(String),
        });
        expect(mockLogger.info).toHaveBeenCalledWith('Experience is not current', { nodeId: TEST_NODE_ID });
        expect(mockPgVectorGraphRAGService.searchProfiles).not.toHaveBeenCalled();
      });

      it('should return empty response when unable to build search query', async () => {
        const nodeWithoutSearchableContent = createTestNode({
          meta: {
            orgId: 123,
            // No description, role, title, or degree
            startDate: '2024-01',
            endDate: null,
          },
        });
        mockHierarchyRepository.getById.mockResolvedValue(nodeWithoutSearchableContent);

        const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

        expect(result).toEqual({
          query: '',
          totalResults: 0,
          profiles: [],
          timestamp: expect.any(String),
        });
        expect(mockLogger.warn).toHaveBeenCalledWith('Unable to build search query from node', { nodeId: TEST_NODE_ID });
        expect(mockPgVectorGraphRAGService.searchProfiles).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should throw error when hierarchy repository fails', async () => {
        const repositoryError = new Error('Database connection failed');
        mockHierarchyRepository.getById.mockRejectedValue(repositoryError);

        await expect(service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID)).rejects.toThrow(repositoryError);
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to get experience matches', repositoryError, { nodeId: TEST_NODE_ID });
      });

      it('should throw error when GraphRAG service fails', async () => {
        const testNode = createTestNode();
        mockHierarchyRepository.getById.mockResolvedValue(testNode);

        const graphragError = new Error('GraphRAG service unavailable');
        mockPgVectorGraphRAGService.searchProfiles.mockRejectedValue(graphragError);

        await expect(service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID)).rejects.toThrow(graphragError);
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to get experience matches', graphragError, { nodeId: TEST_NODE_ID });
      });
    });

    describe('Search Query Building', () => {
      it('should prioritize description over role', async () => {
        const testNode = createTestNode({
          meta: {
            orgId: 123,
            role: 'Engineer',
            description: 'Building scalable applications',
            startDate: '2024-01',
            endDate: null,
          },
        });
        mockHierarchyRepository.getById.mockResolvedValue(testNode);
        mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

        await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

        expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith({
          query: 'Building scalable applications', // Description, not role
          limit: 3,
          excludeUserId: TEST_USER_ID,
          requestingUserId: TEST_USER_ID,
        });
      });

      it('should fallback to role when description is missing', async () => {
        const testNode = createTestNode({
          meta: {
            orgId: 123,
            role: 'Senior Software Engineer',
            // No description
            startDate: '2024-01',
            endDate: null,
          },
        });
        mockHierarchyRepository.getById.mockResolvedValue(testNode);
        mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

        await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

        expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith({
          query: 'Senior Software Engineer', // Fallback to role
          limit: 3,
          excludeUserId: TEST_USER_ID,
          requestingUserId: TEST_USER_ID,
        });
      });
    });
  });

  describe('shouldShowMatches', () => {
    const createTestNode = (overrides: Partial<TimelineNode> = {}): TimelineNode => ({
      id: TEST_NODE_ID,
      type: TimelineNodeType.Job,
      meta: {
        orgId: 123,
        role: 'Engineer',
        startDate: '2024-01',
        endDate: null, // Current experience
      },
      userId: TEST_USER_ID,
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      position: 0,
      ...overrides,
    });

    it('should return true for current job experiences', async () => {
      const testNode = createTestNode();
      mockHierarchyRepository.getById.mockResolvedValue(testNode);

      const result = await service.shouldShowMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toBe(true);
    });

    it('should return true for current education experiences', async () => {
      const testNode = createTestNode({
        type: TimelineNodeType.Education,
        meta: {
          orgId: 456,
          degree: 'Computer Science',
          startDate: '2020-09',
          endDate: null,
        },
      });
      mockHierarchyRepository.getById.mockResolvedValue(testNode);

      const result = await service.shouldShowMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toBe(true);
    });

    it('should return true for current career transitions', async () => {
      const testNode = createTestNode({
        type: TimelineNodeType.CareerTransition,
        meta: {
          title: 'Career Change',
          startDate: '2024-01',
          endDate: null,
        },
      });
      mockHierarchyRepository.getById.mockResolvedValue(testNode);

      const result = await service.shouldShowMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toBe(true);
    });

    it('should return false for past experiences', async () => {
      const pastJobNode = createTestNode({
        meta: {
          orgId: 123,
          role: 'Engineer',
          startDate: '2020-01',
          endDate: '2022-12', // Past experience
        },
      });
      mockHierarchyRepository.getById.mockResolvedValue(pastJobNode);

      const result = await service.shouldShowMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toBe(false);
    });

    it('should return false for non-experience node types', async () => {
      const projectNode = createTestNode({
        type: TimelineNodeType.Project,
      });
      mockHierarchyRepository.getById.mockResolvedValue(projectNode);

      const result = await service.shouldShowMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toBe(false);
    });

    it('should return false when node not found', async () => {
      mockHierarchyRepository.getById.mockResolvedValue(null);

      const result = await service.shouldShowMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toBe(false);
    });

    it('should return false and log error when repository fails', async () => {
      const repositoryError = new Error('Database error');
      mockHierarchyRepository.getById.mockRejectedValue(repositoryError);

      const result = await service.shouldShowMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to check if should show matches', repositoryError, { nodeId: TEST_NODE_ID });
    });
  });

  describe('invalidateCache', () => {
    it('should log cache invalidation', async () => {
      await service.invalidateCache(TEST_NODE_ID);

      expect(mockLogger.info).toHaveBeenCalledWith('Cache invalidated for node', { nodeId: TEST_NODE_ID });
    });
  });

  /**
   * LIG-193: Career Transition Updates in Matching
   * Tests for including update notes in GraphRAG search queries
   */
  describe('LIG-193: Career Transition Updates in Matching', () => {
    let mockUpdatesService: MockProxy<any>;

    beforeEach(() => {
      // Create mock UpdatesService
      mockUpdatesService = mock<any>();

      // Recreate service with UpdatesService dependency
      service = new ExperienceMatchesService({
        logger: mockLogger,
        hierarchyRepository: mockHierarchyRepository,
        pgVectorGraphRAGService: mockPgVectorGraphRAGService,
        updatesService: mockUpdatesService,
      });

      // Clear all mocks
      mockClear(mockLogger);
      mockClear(mockHierarchyRepository);
      mockClear(mockPgVectorGraphRAGService);
      mockClear(mockUpdatesService);
    });

    it('should include recent updates in search query for career transitions', async () => {
      // Setup: CareerTransition node with description
      const careerTransitionNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          title: 'Career Change',
          description: 'Looking for backend roles at tech companies',
          startDate: '2025-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock 2 recent updates within 30 days
      const recentDate1 = new Date();
      const recentDate2 = new Date();
      recentDate2.setDate(recentDate2.getDate() - 10);

      mockHierarchyRepository.getById.mockResolvedValue(careerTransitionNode);
      mockUpdatesService.getUpdatesByNodeId.mockResolvedValue({
        updates: [
          {
            id: 'update-1',
            nodeId: TEST_NODE_ID,
            notes: 'Applied to 5 companies this week',
            meta: { appliedToJobs: true },
            createdAt: recentDate1.toISOString(),
            updatedAt: recentDate1.toISOString(),
          },
          {
            id: 'update-2',
            nodeId: TEST_NODE_ID,
            notes: 'Completed Kafka certification course',
            meta: { developedSkills: true },
            createdAt: recentDate2.toISOString(),
            updatedAt: recentDate2.toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 100,
          total: 2,
          hasNext: false,
          hasPrev: false,
        },
      });

      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'enhanced query with updates',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      // Act
      const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toEqual(mockGraphRAGResponse);
      expect(mockUpdatesService.getUpdatesByNodeId).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_NODE_ID,
        { page: 1, limit: 100 }
      );

      // Verify the search query includes update notes
      expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith({
        query: expect.stringContaining('Looking for backend roles at tech companies'),
        limit: 3,
        excludeUserId: TEST_USER_ID,
        requestingUserId: TEST_USER_ID,
      });

      const actualQuery = mockPgVectorGraphRAGService.searchProfiles.mock.calls[0][0].query;
      expect(actualQuery).toContain('Recent updates:');
      expect(actualQuery).toContain('Applied to 5 companies this week');
      expect(actualQuery).toContain('Completed Kafka certification course');
    });

    it('should handle career transition with no updates', async () => {
      const careerTransitionNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          description: 'Software Engineer search',
          startDate: '2025-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById.mockResolvedValue(careerTransitionNode);
      mockUpdatesService.getUpdatesByNodeId.mockResolvedValue({
        updates: [],
        pagination: { page: 1, limit: 100, total: 0, hasNext: false, hasPrev: false },
      });

      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'Software Engineer search',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toEqual(mockGraphRAGResponse);
      expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith({
        query: 'Software Engineer search',
        limit: 3,
        excludeUserId: TEST_USER_ID,
        requestingUserId: TEST_USER_ID,
      });
    });

    it('should filter out updates older than 30 days', async () => {
      const careerTransitionNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          description: 'Product Manager roles',
          startDate: '2024-12',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);

      mockHierarchyRepository.getById.mockResolvedValue(careerTransitionNode);
      mockUpdatesService.getUpdatesByNodeId.mockResolvedValue({
        updates: [
          {
            id: 'old-update',
            nodeId: TEST_NODE_ID,
            notes: 'Old note from 45 days ago',
            meta: {},
            createdAt: oldDate.toISOString(),
            updatedAt: oldDate.toISOString(),
          },
        ],
        pagination: { page: 1, limit: 100, total: 1, hasNext: false, hasPrev: false },
      });

      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'Product Manager roles',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toEqual(mockGraphRAGResponse);
      expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith({
        query: 'Product Manager roles',
        limit: 3,
        excludeUserId: TEST_USER_ID,
        requestingUserId: TEST_USER_ID,
      });
    });

    it('should include only recent updates when mixed with old ones', async () => {
      const careerTransitionNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          description: 'DevOps transition',
          startDate: '2025-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const recentDate = new Date();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);

      mockHierarchyRepository.getById.mockResolvedValue(careerTransitionNode);
      mockUpdatesService.getUpdatesByNodeId.mockResolvedValue({
        updates: [
          {
            id: 'recent',
            nodeId: TEST_NODE_ID,
            notes: 'Recent certification',
            meta: {},
            createdAt: recentDate.toISOString(),
            updatedAt: recentDate.toISOString(),
          },
          {
            id: 'old',
            nodeId: TEST_NODE_ID,
            notes: 'Old note',
            meta: {},
            createdAt: oldDate.toISOString(),
            updatedAt: oldDate.toISOString(),
          },
        ],
        pagination: { page: 1, limit: 100, total: 2, hasNext: false, hasPrev: false },
      });

      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'enhanced',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      const actualQuery = mockPgVectorGraphRAGService.searchProfiles.mock.calls[0][0].query;
      expect(actualQuery).toContain('Recent certification');
      expect(actualQuery).not.toContain('Old note');
    });

    it('should gracefully handle UpdatesService failure', async () => {
      const careerTransitionNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          description: 'Backend roles',
          startDate: '2025-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById.mockResolvedValue(careerTransitionNode);
      mockUpdatesService.getUpdatesByNodeId.mockRejectedValue(new Error('Database error'));

      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'Backend roles',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      const result = await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(result).toEqual(mockGraphRAGResponse);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch updates, continuing with node-only matching',
        expect.objectContaining({ nodeId: TEST_NODE_ID })
      );
    });

    it('should filter out empty update notes', async () => {
      const careerTransitionNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          description: 'Data Science roles',
          startDate: '2025-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const recentDate = new Date();

      mockHierarchyRepository.getById.mockResolvedValue(careerTransitionNode);
      mockUpdatesService.getUpdatesByNodeId.mockResolvedValue({
        updates: [
          {
            id: 'valid',
            nodeId: TEST_NODE_ID,
            notes: 'Valid note',
            meta: {},
            createdAt: recentDate.toISOString(),
            updatedAt: recentDate.toISOString(),
          },
          {
            id: 'empty',
            nodeId: TEST_NODE_ID,
            notes: '',
            meta: {},
            createdAt: recentDate.toISOString(),
            updatedAt: recentDate.toISOString(),
          },
          {
            id: 'whitespace',
            nodeId: TEST_NODE_ID,
            notes: '   ',
            meta: {},
            createdAt: recentDate.toISOString(),
            updatedAt: recentDate.toISOString(),
          },
        ],
        pagination: { page: 1, limit: 100, total: 3, hasNext: false, hasPrev: false },
      });

      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'enhanced',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      const actualQuery = mockPgVectorGraphRAGService.searchProfiles.mock.calls[0][0].query;
      expect(actualQuery).toContain('Valid note');
      expect(actualQuery).not.toMatch(/Recent updates:\s*\n\s*\n/); // No empty lines
    });

    it('should NOT call UpdatesService for Job nodes', async () => {
      const jobNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.Job,
        parentId: null,
        meta: {
          role: 'Engineer',
          startDate: '2025-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById.mockResolvedValue(jobNode);
      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'Engineer',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(mockUpdatesService.getUpdatesByNodeId).not.toHaveBeenCalled();
    });

    it('should NOT call UpdatesService for Education nodes', async () => {
      const educationNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.Education,
        parentId: null,
        meta: {
          degree: 'Computer Science',
          startDate: '2020-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockHierarchyRepository.getById.mockResolvedValue(educationNode);
      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'Computer Science',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      expect(mockUpdatesService.getUpdatesByNodeId).not.toHaveBeenCalled();
    });

    it('should handle pagination with >100 updates', async () => {
      const careerTransitionNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          description: 'Engineering roles',
          startDate: '2025-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const recentDate = new Date();

      // Generate 150 mock updates
      const generateUpdates = (count: number, idPrefix: string) =>
        Array.from({ length: count }, (_, i) => ({
          id: `${idPrefix}-${i}`,
          nodeId: TEST_NODE_ID,
          notes: `Note ${idPrefix} ${i}`,
          meta: {},
          createdAt: recentDate.toISOString(),
          updatedAt: recentDate.toISOString(),
        }));

      mockHierarchyRepository.getById.mockResolvedValue(careerTransitionNode);

      // First page: 100 updates
      mockUpdatesService.getUpdatesByNodeId
        .mockResolvedValueOnce({
          updates: generateUpdates(100, 'page1'),
          pagination: { page: 1, limit: 100, total: 150, hasNext: true, hasPrev: false },
        })
        // Second page: 50 updates
        .mockResolvedValueOnce({
          updates: generateUpdates(50, 'page2'),
          pagination: { page: 2, limit: 100, total: 150, hasNext: false, hasPrev: true },
        });

      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'enhanced',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      // Verify pagination called twice
      expect(mockUpdatesService.getUpdatesByNodeId).toHaveBeenCalledTimes(2);
      expect(mockUpdatesService.getUpdatesByNodeId).toHaveBeenNthCalledWith(1, TEST_USER_ID, TEST_NODE_ID, { page: 1, limit: 100 });
      expect(mockUpdatesService.getUpdatesByNodeId).toHaveBeenNthCalledWith(2, TEST_USER_ID, TEST_NODE_ID, { page: 2, limit: 100 });

      // Verify logging includes pagination info
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Including updates in query',
        expect.objectContaining({
          nodeId: TEST_NODE_ID,
          updateCount: 150,
          paginationCalls: 2,
        })
      );
    });

    it('should log warning when query length exceeds 2000 chars', async () => {
      const careerTransitionNode: TimelineNode = {
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          description: 'X'.repeat(500), // 500 char description
          startDate: '2025-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const recentDate = new Date();

      // Create 20 updates with 100-char notes each = 2000 chars of updates
      const updates = Array.from({ length: 20 }, (_, i) => ({
        id: `update-${i}`,
        nodeId: TEST_NODE_ID,
        notes: 'Y'.repeat(100),
        meta: {},
        createdAt: recentDate.toISOString(),
        updatedAt: recentDate.toISOString(),
      }));

      mockHierarchyRepository.getById.mockResolvedValue(careerTransitionNode);
      mockUpdatesService.getUpdatesByNodeId.mockResolvedValue({
        updates,
        pagination: { page: 1, limit: 100, total: 20, hasNext: false, hasPrev: false },
      });

      const mockGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'enhanced',
        totalResults: 1,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockGraphRAGResponse);

      await service.getExperienceMatches(TEST_NODE_ID, TEST_USER_ID);

      // Verify warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Query length exceeds recommended limit',
        expect.objectContaining({
          nodeId: TEST_NODE_ID,
          totalLength: expect.any(Number),
          baseLength: expect.any(Number),
          updatesLength: expect.any(Number),
          updateCount: 20,
        })
      );
    });
  });
});
