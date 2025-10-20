/**
 * Integration Tests for HybridJobApplicationMatchingService (LIG-207)
 *
 * Tests end-to-end flow of hybrid matching combining GraphRAG + Trajectory.
 * Validates service orchestration and data flow between components.
 */

import type { TimelineNode } from '@journey/schema';
import { TimelineNodeType } from '@journey/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type {
  GraphRAGSearchResponse,
  IPgVectorGraphRAGService,
} from '../../types/graphrag.types';
import { HybridJobApplicationMatchingService } from '../hybrid-job-application-matching.service';
import type { ICandidateTimelineFetcher } from '../interfaces/candidate-timeline-fetcher.interface';
import type { IExplanationMergingService } from '../interfaces/explanation-merging.interface';
import type { IScoreMergingService } from '../interfaces/score-merging.interface';
import type { JobApplicationTrajectoryMatcherService } from '../job-application-trajectory-matcher.service';

describe('HybridJobApplicationMatchingService - Integration', () => {
  let service: HybridJobApplicationMatchingService;
  let mockLogger: MockProxy<Logger>;
  let mockGraphRAGService: MockProxy<IPgVectorGraphRAGService>;
  let mockTrajectoryMatcher: MockProxy<JobApplicationTrajectoryMatcherService>;
  let mockCandidateFetcher: MockProxy<ICandidateTimelineFetcher>;
  let mockScoreMerging: MockProxy<IScoreMergingService>;
  let mockExplanationMerging: MockProxy<IExplanationMergingService>;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    mockGraphRAGService = mock<IPgVectorGraphRAGService>();
    mockTrajectoryMatcher = mock<JobApplicationTrajectoryMatcherService>();
    mockCandidateFetcher = mock<ICandidateTimelineFetcher>();
    mockScoreMerging = mock<IScoreMergingService>();
    mockExplanationMerging = mock<IExplanationMergingService>();

    service = new HybridJobApplicationMatchingService({
      logger: mockLogger,
      pgVectorGraphRAGService: mockGraphRAGService,
      jobApplicationTrajectoryMatcherService: mockTrajectoryMatcher,
      candidateTimelineFetcher: mockCandidateFetcher,
      scoreMergingService: mockScoreMerging,
      explanationMergingService: mockExplanationMerging,
    });

    mockClear(mockLogger);
    mockClear(mockGraphRAGService);
    mockClear(mockTrajectoryMatcher);
    mockClear(mockCandidateFetcher);
    mockClear(mockScoreMerging);
    mockClear(mockExplanationMerging);
  });

  describe('findMatchesForJobApplication', () => {
    it('should orchestrate full hybrid matching flow end-to-end', async () => {
      // Setup user timeline (needs MIN_CAREER_STEPS = 2 for trajectory matching)
      const userTimeline: TimelineNode[] = [
        {
          id: 'user-job-1',
          type: TimelineNodeType.Job,
          meta: {
            role: 'Engineer',
            company: 'StartupCo',
            startDate: '2020-01-01',
            endDate: '2022-01-01',
          },
          userId: 1,
          parentId: null,
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
        },
        {
          id: 'user-job-2',
          type: TimelineNodeType.Job,
          meta: {
            role: 'Senior Engineer',
            company: 'MidCo',
            startDate: '2022-01-01',
          },
          userId: 1,
          parentId: null,
          createdAt: new Date('2022-01-01'),
          updatedAt: new Date('2022-01-01'),
        },
      ];

      // Step 1: GraphRAG returns top 20 candidates
      const graphRAGResponse: GraphRAGSearchResponse = {
        query: 'Google Senior Software Engineer career trajectory',
        totalResults: 2,
        profiles: [
          {
            id: '2',
            userId: 2,
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@example.com',
            profilePictureUrl: null,
            whyMatched: 'Similar background',
            skills: ['JavaScript'],
            matchedNodes: [
              { id: 'alice-job-1', type: 'job', meta: { role: 'Engineer' } },
            ],
            matchScore: '80.0',
          },
          {
            id: '3',
            userId: 3,
            firstName: 'Bob',
            lastName: 'Jones',
            email: 'bob@example.com',
            profilePictureUrl: null,
            whyMatched: 'Relevant experience',
            skills: ['Python'],
            matchedNodes: [
              { id: 'bob-job-1', type: 'job', meta: { role: 'Designer' } },
            ],
            matchScore: '70.0',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      mockGraphRAGService.searchProfiles.mockResolvedValue(graphRAGResponse);

      // Step 2: Fetch candidate timelines (needs MIN_CAREER_STEPS = 2 for trajectory matching)
      const candidateTimelines = [
        {
          userId: 2,
          timeline: [
            {
              id: 'alice-job-1',
              type: TimelineNodeType.Job,
              meta: {
                role: 'Junior Engineer',
                company: 'StartupCo',
                startDate: '2019-01-01',
                endDate: '2021-01-01',
              },
              userId: 2,
              parentId: null,
              createdAt: new Date('2019-01-01'),
              updatedAt: new Date('2019-01-01'),
            },
            {
              id: 'alice-job-2',
              type: TimelineNodeType.Job,
              meta: {
                role: 'Engineer',
                company: 'TechCorp',
                startDate: '2021-01-01',
              },
              userId: 2,
              parentId: null,
              createdAt: new Date('2021-01-01'),
              updatedAt: new Date('2021-01-01'),
            },
          ],
        },
        {
          userId: 3,
          timeline: [
            {
              id: 'bob-job-1',
              type: TimelineNodeType.Job,
              meta: {
                role: 'Junior Designer',
                company: 'AgencyCo',
                startDate: '2018-01-01',
                endDate: '2020-01-01',
              },
              userId: 3,
              parentId: null,
              createdAt: new Date('2018-01-01'),
              updatedAt: new Date('2018-01-01'),
            },
            {
              id: 'bob-job-2',
              type: TimelineNodeType.Job,
              meta: {
                role: 'Designer',
                company: 'DesignCo',
                startDate: '2020-01-01',
              },
              userId: 3,
              parentId: null,
              createdAt: new Date('2020-01-01'),
              updatedAt: new Date('2020-01-01'),
            },
          ],
        },
      ];

      mockCandidateFetcher.fetchTimelinesForCandidates.mockResolvedValue(
        candidateTimelines
      );

      // Step 3: Trajectory matching
      const trajectoryMatches = [
        {
          userId: 2,
          score: 0.9,
          subscores: {
            roleAlignment: 0.9,
            levelProgression: 0.9,
            companyMatch: 0.9,
            recency: 0.9,
          },
          explanation: ['Strong career progression'],
        },
        {
          userId: 3,
          score: 0.5,
          subscores: {
            roleAlignment: 0.5,
            levelProgression: 0.5,
            companyMatch: 0.5,
            recency: 0.5,
          },
          explanation: ['Moderate fit'],
        },
      ];

      mockTrajectoryMatcher.matchTrajectories.mockResolvedValue(
        trajectoryMatches
      );

      // Step 4: Score merging (Alice's score increases, Bob's stays same)
      const enrichedProfiles = [
        { ...graphRAGResponse.profiles[0], matchScore: '85.0' }, // Alice boosted
        { ...graphRAGResponse.profiles[1], matchScore: '68.0' }, // Bob lowered
      ];

      mockScoreMerging.enrichProfiles.mockReturnValue(enrichedProfiles);

      // Step 5: Explanation merging
      mockExplanationMerging.mergeExplanations
        .mockReturnValueOnce([
          'Career path: Strong career progression',
          'Similar background',
        ])
        .mockReturnValueOnce([
          'Career path: Moderate fit',
          'Relevant experience',
        ]);

      // Execute
      const result = await service.findMatchesForJobApplication(
        'job-app-1',
        1,
        userTimeline,
        'Senior Software Engineer',
        'Google'
      );

      // Verify GraphRAG was called with correct query (LIG-207: Now uses "experience feedback" instead of "preparation")
      expect(mockGraphRAGService.searchProfiles).toHaveBeenCalledWith({
        query:
          'Google Senior Software Engineer career trajectory interview experience feedback',
        limit: 20,
        excludeUserId: 1,
        requestingUserId: 1,
      });

      // Verify trajectory matching was called
      expect(mockTrajectoryMatcher.matchTrajectories).toHaveBeenCalledWith(
        userTimeline,
        candidateTimelines,
        'Senior Software Engineer',
        'Google'
      );

      // Verify score merging was called
      expect(mockScoreMerging.enrichProfiles).toHaveBeenCalledWith(
        graphRAGResponse.profiles,
        trajectoryMatches
      );

      // Verify explanation merging was called for both profiles
      expect(mockExplanationMerging.mergeExplanations).toHaveBeenCalledTimes(2);

      // Verify final result structure
      expect(result.profiles).toHaveLength(2);
      expect(result.profiles[0].id).toBe('2'); // Alice
      expect(result.profiles[0].matchScore).toBe('85.0'); // Merged score
      // whyMatched is an array, check if any element contains 'Career path:'
      expect(
        result.profiles[0].whyMatched.some((msg: string) =>
          msg.includes('Career path:')
        )
      ).toBe(true);
    });

    it('should handle no GraphRAG results - early return', async () => {
      const userTimeline: TimelineNode[] = [];

      const emptyGraphRAGResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockGraphRAGService.searchProfiles.mockResolvedValue(
        emptyGraphRAGResponse
      );

      const result = await service.findMatchesForJobApplication(
        'job-app-1',
        1,
        userTimeline
      );

      // Should return empty result early
      expect(result.profiles).toEqual([]);
      expect(result.totalResults).toBe(0);

      // Should NOT call trajectory matching or enrichment
      expect(mockTrajectoryMatcher.matchTrajectories).not.toHaveBeenCalled();
      expect(mockScoreMerging.enrichProfiles).not.toHaveBeenCalled();
    });

    it('should gracefully degrade to GraphRAG-only on trajectory failure', async () => {
      const userTimeline: TimelineNode[] = [];

      const graphRAGResponse: GraphRAGSearchResponse = {
        query: 'test',
        totalResults: 1,
        profiles: [
          {
            id: '2',
            userId: 2,
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@example.com',
            profilePictureUrl: null,
            whyMatched: 'Similar background',
            skills: [],
            matchedNodes: [],
            matchScore: '80.0',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      mockGraphRAGService.searchProfiles.mockResolvedValue(graphRAGResponse);
      mockCandidateFetcher.fetchTimelinesForCandidates.mockResolvedValue([]);

      const result = await service.findMatchesForJobApplication(
        'job-app-1',
        1,
        userTimeline
      );

      // Should return GraphRAG results unchanged
      expect(result).toEqual(graphRAGResponse);
    });
  });
});
