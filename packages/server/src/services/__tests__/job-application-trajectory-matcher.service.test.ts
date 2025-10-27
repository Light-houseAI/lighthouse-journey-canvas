import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockLogger } from '../../../tests/utils';
import { JobApplicationTrajectoryMatcherService } from '../job-application-trajectory-matcher.service';
import { AnchoredAlignmentEngine } from '../job-application-trajectory-matcher/anchored-alignment-engine';
import { CareerSequenceExtractor } from '../job-application-trajectory-matcher/career-sequence-extractor';
import { TrajectoryScorer } from '../job-application-trajectory-matcher/trajectory-scorer';

// Mock logger
const mockLogger = createMockLogger();

describe('JobApplicationTrajectoryMatcherService', () => {
  let service: JobApplicationTrajectoryMatcherService;
  let mockSequenceExtractor: CareerSequenceExtractor;
  let mockAlignmentEngine: AnchoredAlignmentEngine;
  let mockScorer: TrajectoryScorer;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create real instances for integration testing
    mockScorer = new TrajectoryScorer();
    mockAlignmentEngine = new AnchoredAlignmentEngine(
      undefined,
      undefined,
      mockScorer
    );
    mockSequenceExtractor = new CareerSequenceExtractor(7, mockLogger as any);

    service = new JobApplicationTrajectoryMatcherService({
      logger: mockLogger as any,
      anchoredAlignmentEngine: mockAlignmentEngine,
      careerSequenceExtractor: mockSequenceExtractor,
      trajectoryScorer: mockScorer,
    });
  });

  describe('matchTrajectories', () => {
    it('should match candidates with similar career trajectories', async () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);

      const userTimeline = [
        {
          type: 'job',
          title: 'Software Engineer',
          company: 'Google',
          startDate: recentDate.toISOString(),
        },
        {
          type: 'job',
          title: 'Senior Software Engineer',
          company: 'Google',
          startDate: new Date().toISOString(),
        },
      ];

      const candidateTimelines = [
        {
          userId: 1,
          timeline: [
            {
              type: 'job',
              title: 'Software Engineer',
              company: 'Google',
              startDate: recentDate.toISOString(),
            },
            {
              type: 'job',
              title: 'Senior Software Engineer',
              company: 'Google',
              startDate: new Date().toISOString(),
            },
          ],
        },
        {
          userId: 2,
          timeline: [
            {
              type: 'job',
              title: 'Data Scientist',
              company: 'Meta',
              startDate: recentDate.toISOString(),
            },
          ],
        },
      ];

      const matches = await service.matchTrajectories(
        userTimeline,
        candidateTimelines,
        'Senior Software Engineer',
        'Google'
      );

      expect(matches).toBeDefined();
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]).toHaveProperty('userId');
      expect(matches[0]).toHaveProperty('score');
      expect(matches[0]).toHaveProperty('subscores');
      expect(matches[0]).toHaveProperty('explanation');
    });

    it('should return empty array for insufficient user history', async () => {
      const userTimeline = [
        {
          type: 'job',
          title: 'Engineer',
          company: 'Company',
          // No startDate - will be filtered out
        },
      ];

      const candidateTimelines = [
        {
          userId: 1,
          timeline: [
            {
              type: 'job',
              title: 'Engineer',
              company: 'Company',
              startDate: new Date().toISOString(),
            },
          ],
        },
      ];

      const matches = await service.matchTrajectories(
        userTimeline,
        candidateTimelines
      );

      expect(matches).toEqual([]);
    });

    it('should skip candidates with insufficient history', async () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);

      const userTimeline = [
        {
          type: 'job',
          title: 'Engineer 1',
          company: 'Company',
          startDate: recentDate.toISOString(),
        },
        {
          type: 'job',
          title: 'Engineer 2',
          company: 'Company',
          startDate: new Date().toISOString(),
        },
      ];

      const candidateTimelines = [
        {
          userId: 1,
          timeline: [], // Empty timeline
        },
        {
          userId: 2,
          timeline: [
            {
              type: 'job',
              title: 'Engineer',
              company: 'Company',
              startDate: recentDate.toISOString(),
            },
            {
              type: 'job',
              title: 'Senior Engineer',
              company: 'Company',
              startDate: new Date().toISOString(),
            },
          ],
        },
      ];

      const matches = await service.matchTrajectories(
        userTimeline,
        candidateTimelines
      );

      // Should only have candidate 2
      expect(matches.length).toBe(1);
      expect(matches[0].userId).toBe(2);
    });

    it('should sort matches by score descending', async () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);

      const userTimeline = [
        {
          type: 'job',
          title: 'Software Engineer',
          company: 'Google',
          startDate: recentDate.toISOString(),
        },
        {
          type: 'job',
          title: 'Senior Software Engineer',
          company: 'Google',
          startDate: new Date().toISOString(),
        },
      ];

      const candidateTimelines = [
        {
          userId: 1,
          timeline: [
            {
              type: 'job',
              title: 'Different Role',
              company: 'Different Company',
              startDate: recentDate.toISOString(),
            },
            {
              type: 'job',
              title: 'Another Role',
              company: 'Another Company',
              startDate: new Date().toISOString(),
            },
          ],
        },
        {
          userId: 2,
          timeline: [
            {
              type: 'job',
              title: 'Software Engineer',
              company: 'Google',
              startDate: recentDate.toISOString(),
            },
            {
              type: 'job',
              title: 'Senior Software Engineer',
              company: 'Google',
              startDate: new Date().toISOString(),
            },
          ],
        },
      ];

      const matches = await service.matchTrajectories(
        userTimeline,
        candidateTimelines
      );

      expect(matches.length).toBe(2);
      // User 2 should score higher (better match)
      expect(matches[0].userId).toBe(2);
      expect(matches[0].score).toBeGreaterThan(matches[1].score);
    });

    it('should handle errors gracefully', async () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);

      const userTimeline = [
        {
          type: 'job',
          title: 'Engineer',
          company: 'Company',
          startDate: recentDate.toISOString(),
        },
        {
          type: 'job',
          title: 'Senior Engineer',
          company: 'Company',
          startDate: new Date().toISOString(),
        },
      ];

      const candidateTimelines = [
        {
          userId: 1,
          timeline: [
            {
              type: 'job',
              title: 'Engineer',
              company: 'Company',
              startDate: recentDate.toISOString(),
            },
            {
              type: 'job',
              title: 'Senior Engineer',
              company: 'Company',
              startDate: new Date().toISOString(),
            },
          ],
        },
        {
          userId: 2,
          timeline: null as any, // Invalid timeline
        },
      ];

      // Should not throw, just log warning
      const matches = await service.matchTrajectories(
        userTimeline,
        candidateTimelines
      );

      expect(matches).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle sequence extraction failure gracefully', async () => {
      // Create a spy to mock extraction failure
      const extractSpy = vi
        .spyOn(mockSequenceExtractor, 'extractTrajectory')
        .mockImplementation(() => {
          throw new Error('Invalid date format in timeline');
        });

      const userTimeline = [
        {
          type: 'job',
          title: 'Engineer',
          company: 'Company',
          startDate: 'invalid-date', // Malformed date
        },
      ];

      const candidateTimelines = [
        {
          userId: 1,
          timeline: [
            {
              type: 'job',
              title: 'Engineer',
              company: 'Company',
              startDate: new Date().toISOString(),
            },
          ],
        },
      ];

      const matches = await service.matchTrajectories(
        userTimeline as any,
        candidateTimelines
      );

      // Should return empty array on extraction failure
      expect(matches).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract user trajectory'),
        expect.any(Object)
      );

      extractSpy.mockRestore();
    });
  });

  describe('canMatchTrajectory', () => {
    it('should return true for sufficient history', () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);

      const timeline = [
        {
          type: 'job',
          title: 'Engineer 1',
          company: 'Company',
          startDate: recentDate.toISOString(),
        },
        {
          type: 'job',
          title: 'Engineer 2',
          company: 'Company',
          startDate: new Date().toISOString(),
        },
      ];

      const result = service.canMatchTrajectory(timeline);
      expect(result).toBe(true);
    });

    it('should return false for insufficient history', () => {
      const timeline = [
        {
          type: 'job',
          title: 'Engineer',
          company: 'Company',
          startDate: new Date().toISOString(),
        },
      ];

      const result = service.canMatchTrajectory(timeline);
      expect(result).toBe(false);
    });

    it('should return false for empty timeline', () => {
      const result = service.canMatchTrajectory([]);
      expect(result).toBe(false);
    });
  });

  describe('subscores', () => {
    it('should include role, level, company, and recency subscores', async () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);

      const userTimeline = [
        {
          type: 'job',
          title: 'Software Engineer',
          company: 'Google',
          startDate: recentDate.toISOString(),
        },
        {
          type: 'job',
          title: 'Senior Software Engineer',
          company: 'Google',
          startDate: new Date().toISOString(),
        },
      ];

      const candidateTimelines = [
        {
          userId: 1,
          timeline: userTimeline,
        },
      ];

      const matches = await service.matchTrajectories(
        userTimeline,
        candidateTimelines
      );

      expect(matches[0].subscores).toHaveProperty('roleAlignment');
      expect(matches[0].subscores).toHaveProperty('levelProgression');
      expect(matches[0].subscores).toHaveProperty('companyMatch');
      expect(matches[0].subscores).toHaveProperty('recency');

      // All subscores should be between 0 and 1
      expect(matches[0].subscores.roleAlignment).toBeGreaterThanOrEqual(0);
      expect(matches[0].subscores.roleAlignment).toBeLessThanOrEqual(1);
    });
  });

  describe('explanation', () => {
    it('should provide human-readable explanation', async () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);

      const userTimeline = [
        {
          type: 'job',
          title: 'Software Engineer',
          company: 'Google',
          startDate: recentDate.toISOString(),
        },
        {
          type: 'job',
          title: 'Senior Software Engineer',
          company: 'Google',
          startDate: new Date().toISOString(),
        },
      ];

      const candidateTimelines = [
        {
          userId: 1,
          timeline: userTimeline,
        },
      ];

      const matches = await service.matchTrajectories(
        userTimeline,
        candidateTimelines
      );

      expect(matches[0].explanation).toBeDefined();
      expect(Array.isArray(matches[0].explanation)).toBe(true);
      expect(matches[0].explanation.length).toBeGreaterThan(0);
      expect(typeof matches[0].explanation[0]).toBe('string');
    });
  });
});
