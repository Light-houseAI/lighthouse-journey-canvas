/**
 * Interface for merging GraphRAG and trajectory-based explanations
 * Part of LIG-207 Career Trajectory Matching
 *
 * Enhanced with LLM-based explanation generation
 */

import type { TrajectoryMatchResult } from '../job-application-trajectory-matcher/types';

export interface IExplanationMergingService {
  /**
   * Merge GraphRAG "whyMatched" with trajectory explanations
   * Uses LLM to generate contextual, synthesized explanations
   *
   * @param graphRAGWhyMatched - Original semantic matching reasons
   * @param trajectoryMatch - Trajectory match result with explanations
   * @param targetRole - Target job role (optional, improves context)
   * @param targetCompany - Target company (optional, improves context)
   * @returns Promise resolving to merged explanation array
   */
  mergeExplanations(
    graphRAGWhyMatched: string[],
    trajectoryMatch: TrajectoryMatchResult,
    targetRole?: string,
    targetCompany?: string
  ): Promise<string[]>;
}
