/**
 * Service for fetching candidate timelines with permission checks
 * Part of LIG-207 Career Trajectory Matching
 */

import type { TimelineNode } from '@journey/schema';

import type { Logger } from '../core/logger';
import { NodeFilter } from '../repositories/filters/node-filter';
import type { IHierarchyRepository } from '../repositories/interfaces/hierarchy.repository.interface';
import type { MatchedNode } from '../types/graphrag.types';
import type { ICandidateTimelineFetcher } from './interfaces/candidate-timeline-fetcher.interface';

export interface CandidateTimelineFetcherDependencies {
  logger: Logger;
  hierarchyRepository: IHierarchyRepository;
}

export class CandidateTimelineFetcher implements ICandidateTimelineFetcher {
  private readonly logger: Logger;
  private readonly hierarchyRepository: IHierarchyRepository;

  constructor({
    logger,
    hierarchyRepository,
  }: CandidateTimelineFetcherDependencies) {
    this.logger = logger;
    this.hierarchyRepository = hierarchyRepository;
  }

  /**
   * Fetch timelines for candidate users with permission filtering
   *
   * Uses GraphRAG matchedNodes which are already permission-filtered.
   * This avoids redundant permission checks and respects GraphRAG's
   * existing permission boundaries.
   */
  async fetchTimelinesForCandidates(
    candidateUserIds: number[],
    requestingUserId: number,
    matchedNodesByUser?: Map<number, MatchedNode[]>
  ): Promise<Array<{ userId: number; timeline: TimelineNode[] }>> {
    const timelines: Array<{ userId: number; timeline: TimelineNode[] }> = [];

    for (const candidateUserId of candidateUserIds) {
      try {
        let timeline: TimelineNode[];

        // Option A: Use pre-filtered matchedNodes from GraphRAG (preferred)
        if (matchedNodesByUser && matchedNodesByUser.has(candidateUserId)) {
          const matchedNodes = matchedNodesByUser.get(candidateUserId) || [];
          timeline = matchedNodes.map((mn) => ({
            id: mn.id,
            type: mn.type,
            meta: mn.meta,
            // Add minimal required fields for TimelineNode
            userId: candidateUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })) as TimelineNode[];

          this.logger.debug('Using matchedNodes from GraphRAG', {
            candidateUserId,
            nodeCount: timeline.length,
          });
        }
        // Option B: Fetch full timeline (fallback)
        else {
          const nodeFilter = NodeFilter.Of(requestingUserId)
            .For(candidateUserId)
            .build();
          const fullTimeline =
            await this.hierarchyRepository.getAllNodes(nodeFilter);
          timeline = fullTimeline;

          this.logger.debug('Fetched full timeline', {
            candidateUserId,
            nodeCount: timeline.length,
          });
        }

        // Skip candidates with insufficient timeline data
        if (timeline.length === 0) {
          this.logger.debug('Skipping candidate with empty timeline', {
            candidateUserId,
          });
          continue;
        }

        timelines.push({
          userId: candidateUserId,
          timeline,
        });
      } catch (error) {
        // Log but don't fail entire operation if one candidate fails
        this.logger.warn('Failed to fetch timeline for candidate', {
          candidateUserId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other candidates
      }
    }

    this.logger.info('Fetched candidate timelines', {
      requested: candidateUserIds.length,
      fetched: timelines.length,
    });

    return timelines;
  }
}
