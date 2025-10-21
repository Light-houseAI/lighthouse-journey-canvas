/**
 * Unit Tests for ScoreMergingService (LIG-207)
 *
 * Tests 70/30 score weighting between GraphRAG and trajectory matching.
 * Critical for validating score merging algorithm correctness.
 */

import type { ExperienceMatch as ProfileResult } from '@journey/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type { TrajectoryMatchResult } from '../job-application-trajectory-matcher/types';
import { ScoreMergingService } from '../score-merging.service';

describe('ScoreMergingService', () => {
  let service: ScoreMergingService;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    service = new ScoreMergingService({ logger: mockLogger });
    mockClear(mockLogger);
  });

  describe('mergeScores', () => {
    it('should merge scores with default 70/30 weighting', () => {
      const graphRAGScore = '85.0'; // 85% = 0.85
      const trajectoryScore = 0.6;

      const result = service.mergeScores(graphRAGScore, trajectoryScore);

      // Expected: 0.7 * 0.85 + 0.3 * 0.6 = 0.595 + 0.18 = 0.775
      expect(result).toBeCloseTo(0.775, 3);
    });

    it('should handle numeric GraphRAG scores (0-1 range)', () => {
      const graphRAGScore = 0.85; // Already normalized
      const trajectoryScore = 0.6;

      const result = service.mergeScores(graphRAGScore, trajectoryScore);

      // Same calculation as above
      expect(result).toBeCloseTo(0.775, 3);
    });

    it('should handle percentage string GraphRAG scores', () => {
      const graphRAGScore = '95.0'; // 95% = 0.95
      const trajectoryScore = 0.8;

      const result = service.mergeScores(graphRAGScore, trajectoryScore);

      // Expected: 0.7 * 0.95 + 0.3 * 0.8 = 0.665 + 0.24 = 0.905
      expect(result).toBeCloseTo(0.905, 3);
    });

    it('should use custom weights when provided', () => {
      const graphRAGScore = 0.8;
      const trajectoryScore = 0.6;
      const customWeights = { graphRAG: 0.5, trajectory: 0.5 }; // Equal weighting

      const result = service.mergeScores(
        graphRAGScore,
        trajectoryScore,
        customWeights
      );

      // Expected: 0.5 * 0.8 + 0.5 * 0.6 = 0.4 + 0.3 = 0.7
      expect(result).toBeCloseTo(0.7, 3);
    });

    it('should normalize weights that do not sum to 1.0', () => {
      const graphRAGScore = 0.8;
      const trajectoryScore = 0.6;
      const invalidWeights = { graphRAG: 0.8, trajectory: 0.4 }; // Sum = 1.2

      const result = service.mergeScores(
        graphRAGScore,
        trajectoryScore,
        invalidWeights
      );

      // Weights should be normalized: 0.8/1.2 = 0.667, 0.4/1.2 = 0.333
      // Expected: 0.667 * 0.8 + 0.333 * 0.6 = 0.5336 + 0.1998 = 0.7334
      expect(result).toBeCloseTo(0.7334, 3);

      // Should log warning (floating point may cause slight variations)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Weights do not sum to 1.0, normalizing',
        expect.objectContaining({
          sum: expect.closeTo(1.2, 1), // Close to 1.2 within 1 decimal
        })
      );
    });

    it('should handle invalid GraphRAG score - fallback to trajectory only', () => {
      const graphRAGScore = 'invalid'; // NaN after parsing
      const trajectoryScore = 0.7;

      const result = service.mergeScores(graphRAGScore, trajectoryScore);

      // Should fallback to trajectory score only
      expect(result).toBe(0.7);

      // Should log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid GraphRAG score, using 0',
        { graphRAGScore: 'invalid' }
      );
    });

    it('should handle invalid trajectory score - fallback to GraphRAG only', () => {
      const graphRAGScore = '80.0';
      const trajectoryScore = NaN;

      const result = service.mergeScores(graphRAGScore, trajectoryScore);

      // Should fallback to GraphRAG score only (80% = 0.8)
      expect(result).toBe(0.8);

      // Should log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid trajectory score, using 0',
        { trajectoryScore: NaN }
      );
    });

    it('should clamp result to [0, 1] range', () => {
      const graphRAGScore = 1.5; // Out of range (should be <= 1.0)
      const trajectoryScore = 1.0;

      // Even with invalid input, output should be clamped
      const result = service.mergeScores(graphRAGScore, trajectoryScore);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should handle edge case: both scores are 0', () => {
      const result = service.mergeScores(0, 0);
      expect(result).toBe(0);
    });

    it('should handle edge case: both scores are 1', () => {
      const result = service.mergeScores(1, 1);
      expect(result).toBe(1);
    });
  });

  describe('enrichProfiles', () => {
    it('should enrich profiles with merged scores and re-sort', () => {
      const graphRAGProfiles: ProfileResult[] = [
        {
          id: '1',
          userId: 1,
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          profilePictureUrl: null,
          whyMatched: 'Similar background',
          skills: ['JavaScript'],
          matchedNodes: [],
          matchScore: '80.0', // 0.8
        },
        {
          id: '2',
          userId: 2,
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@example.com',
          profilePictureUrl: null,
          whyMatched: 'Relevant experience',
          skills: ['Python'],
          matchedNodes: [],
          matchScore: '70.0', // 0.7
        },
      ];

      const trajectoryMatches: TrajectoryMatchResult[] = [
        {
          userId: 1,
          score: 0.6, // Lower trajectory score
          subscores: {
            roleAlignment: 0.6,
            levelProgression: 0.6,
            companyMatch: 0.6,
            recency: 0.6,
          },
          explanation: ['Good career path'],
        },
        {
          userId: 2,
          score: 0.9, // Higher trajectory score
          subscores: {
            roleAlignment: 0.9,
            levelProgression: 0.9,
            companyMatch: 0.9,
            recency: 0.9,
          },
          explanation: ['Excellent career path'],
        },
      ];

      const result = service.enrichProfiles(
        graphRAGProfiles,
        trajectoryMatches
      );

      // User 1: 0.7 * 0.8 + 0.3 * 0.6 = 0.56 + 0.18 = 0.74 = 74.0%
      // User 2: 0.7 * 0.7 + 0.3 * 0.9 = 0.49 + 0.27 = 0.76 = 76.0%

      // After merging, user 2 should be first (higher merged score)
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2'); // Bob now first
      expect(result[0].matchScore).toBe('76.0');
      expect(result[1].id).toBe('1'); // Alice now second
      expect(result[1].matchScore).toBe('74.0');
    });

    it('should keep original GraphRAG score when no trajectory match', () => {
      const graphRAGProfiles: ProfileResult[] = [
        {
          id: '1',
          userId: 1,
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          profilePictureUrl: null,
          whyMatched: 'Similar background',
          skills: ['JavaScript'],
          matchedNodes: [],
          matchScore: '85.0',
        },
      ];

      const trajectoryMatches: TrajectoryMatchResult[] = [
        // No match for user 1
      ];

      const result = service.enrichProfiles(
        graphRAGProfiles,
        trajectoryMatches
      );

      // Should keep original score
      expect(result[0].matchScore).toBe('85.0');

      // Should log no trajectory match
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No trajectory match for profile',
        { userId: 1 }
      );
    });

    it('should handle empty profiles list', () => {
      const result = service.enrichProfiles([], []);
      expect(result).toEqual([]);
    });

    it('should handle empty trajectory matches list', () => {
      const graphRAGProfiles: ProfileResult[] = [
        {
          id: '1',
          userId: 1,
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          profilePictureUrl: null,
          whyMatched: 'Similar background',
          skills: [],
          matchedNodes: [],
          matchScore: '85.0',
        },
      ];

      const result = service.enrichProfiles(graphRAGProfiles, []);

      // Should keep original profiles unchanged
      expect(result).toEqual(graphRAGProfiles);
    });

    it('should log enrichment summary', () => {
      const graphRAGProfiles: ProfileResult[] = [
        {
          id: '1',
          userId: 1,
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          profilePictureUrl: null,
          whyMatched: 'Similar background',
          skills: [],
          matchedNodes: [],
          matchScore: '80.0',
        },
      ];

      const trajectoryMatches: TrajectoryMatchResult[] = [
        {
          userId: 1,
          score: 0.6,
          subscores: {
            roleAlignment: 0.6,
            levelProgression: 0.6,
            companyMatch: 0.6,
            recency: 0.6,
          },
          explanation: ['Good match'],
        },
      ];

      service.enrichProfiles(graphRAGProfiles, trajectoryMatches);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Enriched profiles with trajectory scores',
        {
          totalProfiles: 1,
          profilesWithTrajectory: 1,
        }
      );
    });

    it('should log debug info for each merged score', () => {
      const graphRAGProfiles: ProfileResult[] = [
        {
          id: '1',
          userId: 1,
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          profilePictureUrl: null,
          whyMatched: 'Similar background',
          skills: [],
          matchedNodes: [],
          matchScore: '80.0',
        },
      ];

      const trajectoryMatches: TrajectoryMatchResult[] = [
        {
          userId: 1,
          score: 0.6,
          subscores: {
            roleAlignment: 0.6,
            levelProgression: 0.6,
            companyMatch: 0.6,
            recency: 0.6,
          },
          explanation: ['Good match'],
        },
      ];

      service.enrichProfiles(graphRAGProfiles, trajectoryMatches);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Merged scores for profile',
        expect.objectContaining({
          userId: 1,
          originalScore: '80.0',
          trajectoryScore: 0.6,
          mergedScore: '74.0',
        })
      );
    });
  });
});
