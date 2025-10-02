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
import { ExperienceMatchesService } from '../experience-matches.service';

describe('ExperienceMatchesService', () => {
  let service: ExperienceMatchesService;
  let mockLogger: MockProxy<Logger>;
  let mockHierarchyRepository: MockProxy<IHierarchyRepository>;
  let mockPgVectorGraphRAGService: MockProxy<IPgVectorGraphRAGService>;

  const TEST_NODE_ID = '123e4567-e89b-12d3-a456-426614174000';
  const TEST_USER_ID = 1;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    mockHierarchyRepository = mock<IHierarchyRepository>();
    mockPgVectorGraphRAGService = mock<IPgVectorGraphRAGService>();

    service = new ExperienceMatchesService({
      logger: mockLogger,
      hierarchyRepository: mockHierarchyRepository,
      pgVectorGraphRAGService: mockPgVectorGraphRAGService,
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
        expect(mockLogger.info).toHaveBeenCalledWith('Node is not an experience type', { 
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
});