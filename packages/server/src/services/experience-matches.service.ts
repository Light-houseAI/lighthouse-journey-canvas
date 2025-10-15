/**
 * Experience Matches Service (LIG-182, LIG-193)
 *
 * Service for detecting and fetching matches for current experience nodes (jobs, education, and career transitions).
 * Integrates with GraphRAG search to find relevant profiles and opportunities.
 *
 * LIG-193: Enhanced to include recent update notes for CareerTransition nodes in search queries.
 */

import type { TimelineNode, UpdatesListResponse } from '@journey/schema';
import { TimelineNodeType } from '@journey/schema';

import type { Logger } from '../core/logger';
import type { IHierarchyRepository } from '../repositories/interfaces/hierarchy.repository.interface';
import type {
  GraphRAGSearchResponse,
  IPgVectorGraphRAGService,
} from '../types/graphrag.types';
import {
  buildSearchQuery,
  isCurrentExperience,
} from '../utils/experience-utils';
import type { IExperienceMatchesService } from './interfaces';

/**
 * Minimal interface for UpdatesService dependency (LIG-193)
 * Only includes the method needed by ExperienceMatchesService
 */
export interface IUpdatesService {
  getUpdatesByNodeId(
    userId: number,
    nodeId: string,
    options: { page: number; limit: number }
  ): Promise<UpdatesListResponse>;
}

export interface ExperienceMatchesServiceDependencies {
  logger: Logger;
  hierarchyRepository: IHierarchyRepository;
  pgVectorGraphRAGService: IPgVectorGraphRAGService;
  updatesService: IUpdatesService; // LIG-193: For fetching career transition updates
}

export class ExperienceMatchesService implements IExperienceMatchesService {
  private readonly logger: Logger;
  private readonly hierarchyRepository: IHierarchyRepository;
  private readonly pgVectorGraphRAGService: IPgVectorGraphRAGService;
  private readonly updatesService: IUpdatesService; // LIG-193

  // Cache configuration
  private readonly DEFAULT_MATCH_LIMIT = 3;

  // LIG-193: Update fetching configuration
  private readonly UPDATE_WINDOW_DAYS = 30; // Only include updates from last 30 days
  private readonly PAGINATION_LIMIT = 100; // Updates per page when fetching
  private readonly QUERY_LENGTH_WARNING_THRESHOLD = 2000; // Warn if query exceeds this length

  constructor({
    logger,
    hierarchyRepository,
    pgVectorGraphRAGService,
    updatesService,
  }: ExperienceMatchesServiceDependencies) {
    this.logger = logger;
    this.hierarchyRepository = hierarchyRepository;
    this.pgVectorGraphRAGService = pgVectorGraphRAGService;
    this.updatesService = updatesService; // LIG-193
  }

  /**
   * Check if node is a job application (LIG-206 Phase 6)
   */
  private isJobApplication(node: TimelineNode): boolean {
    return node.type === 'event' && node.meta?.eventType === 'job-application';
  }

  /**
   * Build search query from job application fields (LIG-206 Phase 6)
   */
  private buildJobApplicationQuery(node: TimelineNode): string {
    const company = node.meta?.company || '';
    const jobTitle = node.meta?.jobTitle || '';
    const interviewContext =
      node.meta?.llmInterviewContext || node.meta?.interviewContext || '';
    const status = node.meta?.applicationStatus;

    // Base query: company + job title + general context
    let query = `${company} ${jobTitle} interview preparation`;

    // Enrich with status-specific LLM summary if available
    if (status && node.meta?.statusData?.[status]?.llmSummary) {
      query += ` ${node.meta.statusData[status].llmSummary}`;
    }
    // Fallback to general interview context
    else if (interviewContext) {
      query += ` ${interviewContext}`;
    }

    return query.trim();
  }

  /**
   * Get matches for an experience node
   * Returns GraphRAG search response format for consistency
   */
  async getExperienceMatches(
    nodeId: string,
    userId: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _forceRefresh = false // Reserved for future cache implementation
  ): Promise<GraphRAGSearchResponse | null> {
    try {
      // Fetch the node
      const node = await this.hierarchyRepository.getById(nodeId, userId);

      if (!node) {
        this.logger.warn('Node not found', { nodeId });
        return null;
      }

      // User access already verified by getById method

      // LIG-206 Phase 6: Check if it's a job application or experience node
      const isJobApp = this.isJobApplication(node);
      const isExperienceNode =
        node.type === TimelineNodeType.Job ||
        node.type === TimelineNodeType.Education ||
        node.type === TimelineNodeType.CareerTransition;

      if (!isJobApp && !isExperienceNode) {
        this.logger.info('Node is not an experience type or job application', {
          nodeId,
          type: node.type,
        });
        return null;
      }

      // Check if it's a current experience (only for experience nodes, not job applications)
      if (isExperienceNode && !isCurrentExperience(node)) {
        this.logger.info('Experience is not current', { nodeId });
        // Return empty GraphRAG response
        return {
          query: '',
          totalResults: 0,
          profiles: [],
          timestamp: new Date().toISOString(),
        };
      }

      // LIG-193: Fetch updates for CareerTransition nodes
      // This enhances the search query with recent activity notes to provide
      // more context to the GraphRAG matching system
      let updateNotes: string[] | undefined;

      if (node.type === TimelineNodeType.CareerTransition) {
        try {
          // Fetch ALL updates using pagination
          // Important: We loop through all pages to ensure we don't miss any updates
          const allUpdates: any[] = [];
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const result = await this.updatesService.getUpdatesByNodeId(
              userId,
              nodeId,
              { page, limit: this.PAGINATION_LIMIT }
            );
            allUpdates.push(...result.updates);
            hasMore = result.pagination.hasNext;
            page++;
          }

          // Filter to last N days to keep queries relevant and focused
          // Older updates are less relevant for current matching
          const windowStartDate = new Date();
          windowStartDate.setDate(
            windowStartDate.getDate() - this.UPDATE_WINDOW_DAYS
          );

          const recentUpdates = allUpdates.filter(
            (update) => new Date(update.createdAt) >= windowStartDate
          );

          // Extract notes from UpdateResponse objects
          // Sort reverse chronological (most recent first) for better context
          updateNotes = recentUpdates
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .map((u) => u.notes)
            .filter((note): note is string => !!note && note.trim().length > 0);

          // Enhanced logging for monitoring and debugging
          this.logger.info('Including updates in query', {
            nodeId,
            updateCount: updateNotes.length,
            paginationCalls: page - 1,
            dateRange:
              recentUpdates.length > 0
                ? {
                    oldest: recentUpdates[recentUpdates.length - 1].createdAt,
                    newest: recentUpdates[0].createdAt,
                  }
                : null,
          });
        } catch (error) {
          // Graceful degradation: if we can't fetch updates, continue with node-only matching
          // This ensures the feature doesn't break existing functionality
          this.logger.warn(
            'Failed to fetch updates, continuing with node-only matching',
            {
              nodeId,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }

      // LIG-206 Phase 6: Build search query based on node type
      let searchQuery: string;
      if (isJobApp) {
        searchQuery = this.buildJobApplicationQuery(node);
        this.logger.debug('Built job application query', {
          nodeId,
          queryLength: searchQuery.length,
        });
      } else {
        searchQuery = buildSearchQuery(node, updateNotes);
        this.logger.debug('Built experience query', {
          nodeId,
          queryLength: searchQuery.length,
        });
      }

      // Query length monitoring to prevent potential GraphRAG performance issues
      // The 2000-character threshold is a soft limit based on typical GraphRAG performance
      if (searchQuery.length > this.QUERY_LENGTH_WARNING_THRESHOLD) {
        const baseQuery = buildSearchQuery(node);
        this.logger.warn('Query length exceeds recommended limit', {
          nodeId,
          totalLength: searchQuery.length,
          baseLength: baseQuery.length,
          updatesLength: searchQuery.length - baseQuery.length,
          updateCount: updateNotes?.length || 0,
        });
      }

      this.logger.debug('Search query built', {
        nodeId,
        queryLength: searchQuery.length,
      });

      if (!searchQuery) {
        this.logger.warn('Unable to build search query from node', { nodeId });
        // Return empty GraphRAG response
        return {
          query: '',
          totalResults: 0,
          profiles: [],
          timestamp: new Date().toISOString(),
        };
      }

      // Call GraphRAG service to find matches
      // This returns the full ProfileResult with whyMatched, skills, matchedNodes, etc.
      const searchResults = await this.pgVectorGraphRAGService.searchProfiles({
        query: searchQuery,
        limit: this.DEFAULT_MATCH_LIMIT,
        excludeUserId: userId, // Exclude the user's own profile
        requestingUserId: userId, // Pass requesting user for permission checks
      });

      // Return the GraphRAG response directly
      // This ensures consistency with /api/v2/graphrag/search
      return searchResults;
    } catch (error) {
      this.logger.error('Failed to get experience matches', error as Error, {
        nodeId,
      });
      throw error;
    }
  }

  /**
   * Validate if a node should show matches (LIG-206 Phase 6: Updated to support job applications)
   */
  async shouldShowMatches(nodeId: string, userId: number): Promise<boolean> {
    try {
      const node = await this.hierarchyRepository.getById(nodeId, userId);

      if (!node) {
        return false;
      }

      // LIG-206 Phase 6: Show matches for job applications and current experience nodes
      if (this.isJobApplication(node)) {
        return true;
      }

      // Only show for current experience nodes
      const isExperienceNode =
        node.type === TimelineNodeType.Job ||
        node.type === TimelineNodeType.Education ||
        node.type === TimelineNodeType.CareerTransition;

      return isExperienceNode && isCurrentExperience(node);
    } catch (error) {
      this.logger.error(
        'Failed to check if should show matches',
        error as Error,
        { nodeId }
      );
      return false;
    }
  }

  /**
   * Invalidate cache for a specific node
   * Called when a node is updated
   */
  async invalidateCache(nodeId: string): Promise<void> {
    // In a real implementation, this would invalidate Redis/cache layer
    // For now, we rely on TanStack Query's cache invalidation on the frontend
    this.logger.info('Cache invalidated for node', { nodeId });
  }
}
