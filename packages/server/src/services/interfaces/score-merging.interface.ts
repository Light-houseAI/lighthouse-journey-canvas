/**
 * Interface for merging GraphRAG and trajectory-based scores
 * Part of LIG-207 Career Trajectory Matching
 */

import type { ProfileResult } from '../../types/graphrag.types';
import type { TrajectoryMatchResult } from '../job-application-trajectory-matcher/types';

export interface IScoreMergingService {
  /**
   * Merge GraphRAG and trajectory scores with configurable weights
   *
   * @param graphRAGScore - Semantic similarity score from GraphRAG (0-1 or percentage string)
   * @param trajectoryScore - Structural similarity score from trajectory matching (0-1)
   * @param weights - Optional custom weights (default: 70% GraphRAG, 30% Trajectory)
   * @returns Merged score (0-1)
   */
  mergeScores(
    graphRAGScore: string | number,
    trajectoryScore: number,
    weights?: { graphRAG: number; trajectory: number }
  ): number;

  /**
   * Enrich GraphRAG profiles with trajectory matching scores
   *
   * @param graphRAGProfiles - Profiles from GraphRAG search
   * @param trajectoryMatches - Matches from trajectory matching service
   * @returns Enriched profiles with merged scores, sorted by new score
   */
  enrichProfiles(
    graphRAGProfiles: ProfileResult[],
    trajectoryMatches: TrajectoryMatchResult[]
  ): ProfileResult[];
}
