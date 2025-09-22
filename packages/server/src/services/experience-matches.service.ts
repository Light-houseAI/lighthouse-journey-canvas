/**
 * Experience Matches Service (LIG-179)
 *
 * Service for detecting and fetching matches for current experience nodes.
 * Integrates with GraphRAG search to find relevant profiles and opportunities.
 */

import type { TimelineNode } from '@journey/schema';
import type { Logger } from '../core/interfaces';
import type { IHierarchyRepository } from '../repositories/interfaces/hierarchy.repository.interface';
import type { IPgVectorGraphRAGService, GraphRAGSearchResponse } from '../types/graphrag.types';
import { isCurrentExperience, buildSearchQuery } from '../utils/experience-utils';

export interface ExperienceMatchesServiceDependencies {
  logger: Logger;
  hierarchyRepository: IHierarchyRepository;
  pgVectorGraphRAGService: IPgVectorGraphRAGService;
}

export class ExperienceMatchesService {
  private readonly logger: Logger;
  private readonly hierarchyRepository: IHierarchyRepository;
  private readonly pgVectorGraphRAGService: IPgVectorGraphRAGService;

  // Cache configuration
  private readonly CACHE_TTL_SECONDS = 300; // 5 minutes
  private readonly DEFAULT_MATCH_LIMIT = 3;
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7;

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
    forceRefresh = false
  ): Promise<GraphRAGSearchResponse | null> {
    try {
      // Fetch the node
      const node = await this.hierarchyRepository.getById(nodeId, userId);

      if (!node) {
        this.logger.warn('Node not found', { nodeId });
        return null;
      }

      // User access already verified by getById method

      // Check if it's an experience node (job or education)
      if (node.type !== 'job' && node.type !== 'education') {
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
      });

      // Return the GraphRAG response directly
      // This ensures consistency with /api/v2/graphrag/search
      return searchResults;
    } catch (error) {
      this.logger.error('Failed to get experience matches', { nodeId, error });
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
      return (node.type === 'job' || node.type === 'education') && isCurrentExperience(node);
    } catch (error) {
      this.logger.error('Failed to check if should show matches', { nodeId, error });
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

  /**
   * Get search query for a node
   * Useful for navigation to search page
   */
  async getSearchQuery(nodeId: string, userId: number): Promise<string | null> {
    try {
      const node = await this.hierarchyRepository.getById(nodeId, userId);

      if (!node) {
        return null;
      }

      if (!isCurrentExperience(node)) {
        return null;
      }

      return buildSearchQuery(node);
    } catch (error) {
      this.logger.error('Failed to get search query', { nodeId, error });
      return null;
    }
  }
}
