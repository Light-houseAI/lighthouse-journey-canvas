/**
 * Experience Matches Service (LIG-182)
 *
 * Service for detecting and fetching matches for current experience nodes (jobs, education, and career transitions).
 * Integrates with GraphRAG search to find relevant profiles and opportunities.
 */

import { TimelineNodeType } from '@journey/schema';

import type { Logger } from '../core/logger';
import type { IHierarchyRepository } from '../repositories/interfaces/hierarchy.repository.interface';
import type { GraphRAGSearchResponse,IPgVectorGraphRAGService } from '../types/graphrag.types';
import { buildSearchQuery,isCurrentExperience } from '../utils/experience-utils';
import type { IExperienceMatchesService } from './interfaces';

export interface ExperienceMatchesServiceDependencies {
  logger: Logger;
  hierarchyRepository: IHierarchyRepository;
  pgVectorGraphRAGService: IPgVectorGraphRAGService;
}

export class ExperienceMatchesService implements IExperienceMatchesService {
  private readonly logger: Logger;
  private readonly hierarchyRepository: IHierarchyRepository;
  private readonly pgVectorGraphRAGService: IPgVectorGraphRAGService;

  // Cache configuration
  private readonly DEFAULT_MATCH_LIMIT = 3;

  constructor({ logger, hierarchyRepository, pgVectorGraphRAGService }: ExperienceMatchesServiceDependencies) {
    this.logger = logger;
    this.hierarchyRepository = hierarchyRepository;
    this.pgVectorGraphRAGService = pgVectorGraphRAGService;
  }

  /**
   * Get matches for an experience node
   * Returns GraphRAG search response format for consistency
   */
  async getExperienceMatches(
    nodeId: string,
    userId: number,
    forceRefresh = false // Reserved for future cache implementation
  ): Promise<GraphRAGSearchResponse | null> {
    try {
      // Fetch the node
      const node = await this.hierarchyRepository.getById(nodeId, userId);

      if (!node) {
        this.logger.warn('Node not found', { nodeId });
        return null;
      }

      // User access already verified by getById method

      // Check if it's an experience node (job, education, or career transition)
      switch (node.type) {
        case TimelineNodeType.Job:
        case TimelineNodeType.Education:
        case TimelineNodeType.CareerTransition:
          break;
        default:
          this.logger.info('Node is not an experience type', { nodeId, type: node.type });
          return null;
      }

      // Check if it's a current experience
      if (!isCurrentExperience(node)) {
        this.logger.info('Experience is not current', { nodeId });
        // Return empty GraphRAG response
        return {
          query: '',
          totalResults: 0,
          profiles: [],
          timestamp: new Date().toISOString(),
        };
      }

      // Build search query from node metadata
      const searchQuery = buildSearchQuery(node);

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
      this.logger.error('Failed to get experience matches', error as Error, { nodeId });
      throw error;
    }
  }

  /**
   * Validate if a node should show matches
   */
  async shouldShowMatches(nodeId: string, userId: number): Promise<boolean> {
    try {
      const node = await this.hierarchyRepository.getById(nodeId, userId);

      if (!node) {
        return false;
      }

      // Only show for current experience nodes
      const isExperienceNode =
        node.type === TimelineNodeType.Job ||
        node.type === TimelineNodeType.Education ||
        node.type === TimelineNodeType.CareerTransition;

      return isExperienceNode && isCurrentExperience(node);
    } catch (error) {
      this.logger.error('Failed to check if should show matches', error as Error, { nodeId });
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
