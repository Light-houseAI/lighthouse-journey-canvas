/**
 * Unit Tests for CandidateTimelineFetcher Service (LIG-207)
 *
 * Tests permission-filtered timeline fetching for candidate users.
 * Critical for ensuring proper cross-user data access control.
 */

import type { TimelineNode } from '@journey/schema';
import { TimelineNodeType } from '@journey/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type { IHierarchyRepository } from '../../repositories/interfaces/hierarchy.repository.interface';
import type { MatchedNode } from '../../types/graphrag.types';
import { CandidateTimelineFetcher } from '../candidate-timeline-fetcher.service';

describe('CandidateTimelineFetcher', () => {
  let service: CandidateTimelineFetcher;
  let mockLogger: MockProxy<Logger>;
  let mockHierarchyRepository: MockProxy<IHierarchyRepository>;

  const REQUESTING_USER_ID = 1;
  const CANDIDATE_USER_ID_1 = 2;
  const CANDIDATE_USER_ID_2 = 3;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    mockHierarchyRepository = mock<IHierarchyRepository>();

    service = new CandidateTimelineFetcher({
      logger: mockLogger,
      hierarchyRepository: mockHierarchyRepository,
    });

    mockClear(mockLogger);
    mockClear(mockHierarchyRepository);
  });

  describe('fetchTimelinesForCandidates', () => {
    it('should fetch timelines using matchedNodes from GraphRAG (preferred path)', async () => {
      const matchedNodes: MatchedNode[] = [
        {
          id: 'node-1',
          type: 'job',
          meta: {
            role: 'Software Engineer',
            company: 'Google',
          },
        },
        {
          id: 'node-2',
          type: 'education',
          meta: {
            school: 'MIT',
            degree: 'BS Computer Science',
          },
        },
      ];

      const matchedNodesByUser = new Map<number, MatchedNode[]>([
        [CANDIDATE_USER_ID_1, matchedNodes],
      ]);

      const result = await service.fetchTimelinesForCandidates(
        [CANDIDATE_USER_ID_1],
        REQUESTING_USER_ID,
        matchedNodesByUser
      );

      // Should use pre-filtered matchedNodes, not call getAllNodes
      expect(mockHierarchyRepository.getAllNodes).not.toHaveBeenCalled();

      // Should return timeline with transformed nodes
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(CANDIDATE_USER_ID_1);
      expect(result[0].timeline).toHaveLength(2);
      expect(result[0].timeline[0]).toMatchObject({
        id: 'node-1',
        type: 'job',
        userId: CANDIDATE_USER_ID_1,
      });

      // Should log using matchedNodes
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Using matchedNodes from GraphRAG',
        {
          candidateUserId: CANDIDATE_USER_ID_1,
          nodeCount: 2,
        }
      );
    });

    it('should fetch full timeline when matchedNodes not provided (fallback path)', async () => {
      const fullTimeline: TimelineNode[] = [
        {
          id: 'node-1',
          type: TimelineNodeType.Job,
          meta: {
            role: 'Engineer',
            company: 'Company',
          },
          userId: CANDIDATE_USER_ID_1,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'node-2',
          type: TimelineNodeType.Education,
          meta: {
            school: 'University',
          },
          userId: CANDIDATE_USER_ID_1,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockHierarchyRepository.getAllNodes.mockResolvedValue(fullTimeline);

      const result = await service.fetchTimelinesForCandidates(
        [CANDIDATE_USER_ID_1],
        REQUESTING_USER_ID
        // No matchedNodesByUser provided - fallback to full timeline
      );

      // Should call getAllNodes with proper permission filter
      // NodeFilter has properties: currentUserId, targetUserId, action, level
      const callArg = mockHierarchyRepository.getAllNodes.mock.calls[0][0];
      expect(callArg.currentUserId).toBe(REQUESTING_USER_ID);
      expect(callArg.targetUserId).toBe(CANDIDATE_USER_ID_1);

      // Should return full timeline
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(CANDIDATE_USER_ID_1);
      expect(result[0].timeline).toEqual(fullTimeline);

      // Should log fetched full timeline
      expect(mockLogger.debug).toHaveBeenCalledWith('Fetched full timeline', {
        candidateUserId: CANDIDATE_USER_ID_1,
        nodeCount: 2,
      });
    });

    it('should handle multiple candidates correctly', async () => {
      const matchedNodes1: MatchedNode[] = [
        { id: 'node-1', type: 'job', meta: { role: 'Engineer' } },
      ];

      const matchedNodes2: MatchedNode[] = [
        { id: 'node-2', type: 'job', meta: { role: 'Designer' } },
      ];

      const matchedNodesByUser = new Map<number, MatchedNode[]>([
        [CANDIDATE_USER_ID_1, matchedNodes1],
        [CANDIDATE_USER_ID_2, matchedNodes2],
      ]);

      const result = await service.fetchTimelinesForCandidates(
        [CANDIDATE_USER_ID_1, CANDIDATE_USER_ID_2],
        REQUESTING_USER_ID,
        matchedNodesByUser
      );

      // Should return timelines for both candidates
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(CANDIDATE_USER_ID_1);
      expect(result[1].userId).toBe(CANDIDATE_USER_ID_2);
      expect(result[0].timeline).toHaveLength(1);
      expect(result[1].timeline).toHaveLength(1);
    });

    it('should skip candidates with empty timelines', async () => {
      const matchedNodes1: MatchedNode[] = [
        { id: 'node-1', type: 'job', meta: { role: 'Engineer' } },
      ];

      const matchedNodes2: MatchedNode[] = []; // Empty timeline

      const matchedNodesByUser = new Map<number, MatchedNode[]>([
        [CANDIDATE_USER_ID_1, matchedNodes1],
        [CANDIDATE_USER_ID_2, matchedNodes2],
      ]);

      const result = await service.fetchTimelinesForCandidates(
        [CANDIDATE_USER_ID_1, CANDIDATE_USER_ID_2],
        REQUESTING_USER_ID,
        matchedNodesByUser
      );

      // Should only return candidate 1 (candidate 2 has empty timeline)
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(CANDIDATE_USER_ID_1);

      // Should log skipping candidate 2
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping candidate with empty timeline',
        {
          candidateUserId: CANDIDATE_USER_ID_2,
        }
      );
    });

    it('should handle fetch failures gracefully - continue with other candidates', async () => {
      const matchedNodes1: MatchedNode[] = [
        { id: 'node-1', type: 'job', meta: { role: 'Engineer' } },
      ];

      const matchedNodesByUser = new Map<number, MatchedNode[]>([
        [CANDIDATE_USER_ID_1, matchedNodes1],
        // Candidate 2 not in map - will attempt getAllNodes which will fail
      ]);

      // Mock getAllNodes to fail for candidate 2
      mockHierarchyRepository.getAllNodes.mockRejectedValue(
        new Error('Permission denied')
      );

      const result = await service.fetchTimelinesForCandidates(
        [CANDIDATE_USER_ID_1, CANDIDATE_USER_ID_2],
        REQUESTING_USER_ID,
        matchedNodesByUser
      );

      // Should only return candidate 1 (candidate 2 failed)
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(CANDIDATE_USER_ID_1);

      // Should log warning for candidate 2 failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch timeline for candidate',
        expect.objectContaining({
          candidateUserId: CANDIDATE_USER_ID_2,
          error: 'Permission denied',
        })
      );

      // Should log final summary with correct counts
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Fetched candidate timelines',
        {
          requested: 2,
          fetched: 1,
        }
      );
    });

    it('should handle empty candidate list', async () => {
      const result = await service.fetchTimelinesForCandidates(
        [],
        REQUESTING_USER_ID
      );

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Fetched candidate timelines',
        {
          requested: 0,
          fetched: 0,
        }
      );
    });

    it('should transform matchedNodes to TimelineNode format correctly', async () => {
      const matchedNodes: MatchedNode[] = [
        {
          id: 'node-1',
          type: 'job',
          meta: {
            role: 'Software Engineer',
            company: 'Google',
            startDate: '2020-01-01',
          },
        },
      ];

      const matchedNodesByUser = new Map<number, MatchedNode[]>([
        [CANDIDATE_USER_ID_1, matchedNodes],
      ]);

      const result = await service.fetchTimelinesForCandidates(
        [CANDIDATE_USER_ID_1],
        REQUESTING_USER_ID,
        matchedNodesByUser
      );

      // Verify transformed TimelineNode has all required fields
      const timelineNode = result[0].timeline[0];
      expect(timelineNode).toMatchObject({
        id: 'node-1',
        type: 'job',
        meta: {
          role: 'Software Engineer',
          company: 'Google',
          startDate: '2020-01-01',
        },
        userId: CANDIDATE_USER_ID_1,
      });

      // Should have createdAt and updatedAt (added by transformer)
      expect(timelineNode.createdAt).toBeInstanceOf(Date);
      expect(timelineNode.updatedAt).toBeInstanceOf(Date);
    });

    it('should respect permission boundaries when fetching full timeline', async () => {
      const fullTimeline: TimelineNode[] = [
        {
          id: 'visible-node',
          type: TimelineNodeType.Job,
          meta: { role: 'Engineer' },
          userId: CANDIDATE_USER_ID_1,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Repository should filter based on permissions
      mockHierarchyRepository.getAllNodes.mockResolvedValue(fullTimeline);

      const result = await service.fetchTimelinesForCandidates(
        [CANDIDATE_USER_ID_1],
        REQUESTING_USER_ID
      );

      // Verify getAllNodes was called with correct permission context
      // NodeFilter has properties: currentUserId, targetUserId, action, level
      const callArg = mockHierarchyRepository.getAllNodes.mock.calls[0][0];
      expect(callArg.currentUserId).toBe(REQUESTING_USER_ID); // Requesting user
      expect(callArg.targetUserId).toBe(CANDIDATE_USER_ID_1); // Target user to fetch

      // Should only return nodes that passed permission filter
      expect(result[0].timeline).toEqual(fullTimeline);
    });
  });
});
