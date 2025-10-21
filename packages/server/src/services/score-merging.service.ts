/**
 * Service for merging GraphRAG and trajectory-based scores
 * Part of LIG-207 Career Trajectory Matching
 */

import type { ExperienceMatch as ProfileResult } from '@journey/schema';

import type { Logger } from '../core/logger';
import type { IScoreMergingService } from './interfaces/score-merging.interface';
import type { TrajectoryMatchResult } from './job-application-trajectory-matcher/types';

export interface ScoreMergingServiceDependencies {
  logger: Logger;
}

export class ScoreMergingService implements IScoreMergingService {
  private readonly logger: Logger;
  private readonly DEFAULT_WEIGHTS = {
    graphRAG: 0.7, // 70% weight on semantic similarity
    trajectory: 0.3, // 30% weight on structural similarity
  };

  constructor({ logger }: ScoreMergingServiceDependencies) {
    this.logger = logger;
  }

  /**
   * Merge GraphRAG and trajectory scores with configurable weights
   */
  mergeScores(
    graphRAGScore: string | number,
    trajectoryScore: number,
    weights?: { graphRAG: number; trajectory: number }
  ): number {
    // Normalize GraphRAG score (might be percentage string like "95.0" or number 0-1)
    const graphRAGNormalized =
      typeof graphRAGScore === 'string'
        ? parseFloat(graphRAGScore) / 100
        : graphRAGScore;

    // Validate inputs
    if (
      isNaN(graphRAGNormalized) ||
      graphRAGNormalized < 0 ||
      graphRAGNormalized > 1
    ) {
      this.logger.warn('Invalid GraphRAG score, using 0', { graphRAGScore });
      return trajectoryScore; // Fallback to trajectory only
    }

    if (isNaN(trajectoryScore) || trajectoryScore < 0 || trajectoryScore > 1) {
      this.logger.warn('Invalid trajectory score, using 0', {
        trajectoryScore,
      });
      return graphRAGNormalized; // Fallback to GraphRAG only
    }

    // Use provided weights or defaults (create copy to avoid mutation)
    const w = weights ? { ...weights } : { ...this.DEFAULT_WEIGHTS };

    // Validate weights sum to 1.0
    const weightSum = w.graphRAG + w.trajectory;
    if (Math.abs(weightSum - 1.0) > 0.001) {
      this.logger.warn('Weights do not sum to 1.0, normalizing', {
        weights: w,
        sum: weightSum,
      });
      w.graphRAG = w.graphRAG / weightSum;
      w.trajectory = w.trajectory / weightSum;
    }

    // Calculate weighted score
    const mergedScore =
      w.graphRAG * graphRAGNormalized + w.trajectory * trajectoryScore;

    // Clamp to [0, 1] for safety
    return Math.max(0, Math.min(1, mergedScore));
  }

  /**
   * Enrich GraphRAG profiles with trajectory matching scores
   */
  enrichProfiles(
    graphRAGProfiles: ProfileResult[],
    trajectoryMatches: TrajectoryMatchResult[]
  ): ProfileResult[] {
    // Create lookup map for trajectory matches by userId
    const trajectoryMap = new Map<number, TrajectoryMatchResult>();
    for (const match of trajectoryMatches) {
      trajectoryMap.set(match.userId, match);
    }

    // Enrich each profile
    const enrichedProfiles = graphRAGProfiles.map((profile) => {
      const userId = parseInt(profile.id, 10);
      const trajectoryMatch = trajectoryMap.get(userId);

      if (!trajectoryMatch) {
        // No trajectory match - keep original GraphRAG score
        this.logger.debug('No trajectory match for profile', { userId });
        return profile;
      }

      // Merge scores
      const originalScore = profile.matchScore;
      const mergedScore = this.mergeScores(
        originalScore,
        trajectoryMatch.score
      );

      // Format as percentage string to match GraphRAG format
      const mergedScoreStr = (mergedScore * 100).toFixed(1);

      this.logger.debug('Merged scores for profile', {
        userId,
        originalScore,
        trajectoryScore: trajectoryMatch.score,
        mergedScore: mergedScoreStr,
      });

      // Return enriched profile with merged score
      return {
        ...profile,
        matchScore: mergedScoreStr,
      };
    });

    // Re-sort by merged score (descending)
    const sortedProfiles = enrichedProfiles.sort((a, b) => {
      const scoreA = parseFloat(a.matchScore);
      const scoreB = parseFloat(b.matchScore);
      return scoreB - scoreA;
    });

    this.logger.info('Enriched profiles with trajectory scores', {
      totalProfiles: graphRAGProfiles.length,
      profilesWithTrajectory: trajectoryMatches.length,
    });

    return sortedProfiles;
  }
}
