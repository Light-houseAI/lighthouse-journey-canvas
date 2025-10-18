/**
 * Interface for hybrid job application matching
 * Combines GraphRAG semantic search with trajectory-based structural matching
 * Part of LIG-207 Career Trajectory Matching
 */

import type { TimelineNode } from '@journey/schema';

import type { GraphRAGSearchResponse } from '../../types/graphrag.types';

export interface IHybridJobApplicationMatchingService {
  /**
   * Find matches for a job application using hybrid approach
   *
   * @param nodeId - Job application node ID
   * @param userId - User ID making the request
   * @param userTimeline - User's complete timeline for trajectory matching
   * @param targetRole - Target job role from application
   * @param targetCompany - Target company from application
   * @returns GraphRAG response with enriched profiles (merged scores + explanations)
   */
  findMatchesForJobApplication(
    nodeId: string,
    userId: number,
    userTimeline: TimelineNode[],
    targetRole?: string,
    targetCompany?: string
  ): Promise<GraphRAGSearchResponse>;
}
