/**
 * Hybrid Job Application Matching Service (LIG-207)
 *
 * Combines GraphRAG semantic search with trajectory-based structural matching
 * to find candidates with similar career paths leading to target roles.
 *
 * Architecture: Clean separation of concerns with dedicated services for
 * timeline fetching, score merging, and explanation generation.
 */

import type { TimelineNode } from '@journey/schema';

import type { Logger } from '../core/logger';
import type {
  GraphRAGSearchResponse,
  IPgVectorGraphRAGService,
  MatchedNode,
} from '../types/graphrag.types';
import type { ICandidateTimelineFetcher } from './interfaces/candidate-timeline-fetcher.interface';
import type { IExplanationMergingService } from './interfaces/explanation-merging.interface';
import type { IHybridJobApplicationMatchingService } from './interfaces/hybrid-job-application-matching.interface';
import type { IScoreMergingService } from './interfaces/score-merging.interface';
import type { JobApplicationTrajectoryMatcherService } from './job-application-trajectory-matcher.service';

export interface HybridJobApplicationMatchingServiceDependencies {
  logger: Logger;
  pgVectorGraphRAGService: IPgVectorGraphRAGService;
  jobApplicationTrajectoryMatcherService: JobApplicationTrajectoryMatcherService;
  candidateTimelineFetcher: ICandidateTimelineFetcher;
  scoreMergingService: IScoreMergingService;
  explanationMergingService: IExplanationMergingService;
}

export class HybridJobApplicationMatchingService
  implements IHybridJobApplicationMatchingService
{
  private readonly logger: Logger;
  private readonly pgVectorGraphRAGService: IPgVectorGraphRAGService;
  private readonly trajectoryMatcherService: JobApplicationTrajectoryMatcherService;
  private readonly candidateTimelineFetcher: ICandidateTimelineFetcher;
  private readonly scoreMergingService: IScoreMergingService;
  private readonly explanationMergingService: IExplanationMergingService;

  // Configuration (from clarifying questions)
  private readonly GRAPHRAG_LIMIT = 20; // Fetch top 20 from GraphRAG
  private readonly FINAL_LIMIT = 3; // Return top 3 after trajectory matching

  constructor(deps: HybridJobApplicationMatchingServiceDependencies) {
    this.logger = deps.logger;
    this.pgVectorGraphRAGService = deps.pgVectorGraphRAGService;
    this.trajectoryMatcherService = deps.jobApplicationTrajectoryMatcherService;
    this.candidateTimelineFetcher = deps.candidateTimelineFetcher;
    this.scoreMergingService = deps.scoreMergingService;
    this.explanationMergingService = deps.explanationMergingService;
  }

  /**
   * Find matches for a job application using hybrid approach
   *
   * Flow:
   * 1. GraphRAG search (semantic similarity) - get top 20
   * 2. Fetch candidate timelines from matchedNodes (permission-filtered)
   * 3. Run trajectory matching on all candidates
   * 4. Merge scores (70% GraphRAG, 30% Trajectory)
   * 5. Merge explanations (trajectory + GraphRAG)
   * 6. Return top 3 enriched profiles
   */
  async findMatchesForJobApplication(
    nodeId: string,
    userId: number,
    userTimeline: TimelineNode[],
    targetRole?: string,
    targetCompany?: string
  ): Promise<GraphRAGSearchResponse> {
    try {
      // Step 1: GraphRAG semantic search
      const searchQuery = this.buildSearchQuery(targetRole, targetCompany);
      this.logger.info('Running GraphRAG search for job application', {
        nodeId,
        userId,
        searchQuery,
        limit: this.GRAPHRAG_LIMIT,
      });

      const graphRAGResults = await this.pgVectorGraphRAGService.searchProfiles(
        {
          query: searchQuery,
          limit: this.GRAPHRAG_LIMIT,
          excludeUserId: userId,
          requestingUserId: userId,
        }
      );

      // Handle no GraphRAG results (early return)
      if (!graphRAGResults.profiles || graphRAGResults.profiles.length === 0) {
        this.logger.info('No GraphRAG results found', { nodeId, userId });
        return {
          query: searchQuery,
          totalResults: 0,
          profiles: [],
          timestamp: new Date().toISOString(),
        };
      }

      // Step 2: Extract candidate user IDs and matchedNodes
      const candidateUserIds = graphRAGResults.profiles.map((p) =>
        parseInt(p.id, 10)
      );
      const matchedNodesByUser = this.buildMatchedNodesMap(
        graphRAGResults.profiles
      );

      this.logger.info('Fetching candidate timelines', {
        candidateCount: candidateUserIds.length,
      });

      // Step 3: Fetch timelines using matchedNodes (already permission-filtered)
      const candidateTimelines =
        await this.candidateTimelineFetcher.fetchTimelinesForCandidates(
          candidateUserIds,
          userId,
          matchedNodesByUser
        );

      if (candidateTimelines.length === 0) {
        this.logger.warn('No valid candidate timelines fetched', {
          nodeId,
          userId,
        });
        // Return GraphRAG-only results (graceful degradation)
        return graphRAGResults;
      }

      // Step 4: Run trajectory matching
      this.logger.info('Running trajectory matching', {
        userTimelineLength: userTimeline.length,
        candidateCount: candidateTimelines.length,
        targetRole,
        targetCompany,
      });

      const trajectoryMatches =
        await this.trajectoryMatcherService.matchTrajectories(
          userTimeline,
          candidateTimelines,
          targetRole,
          targetCompany
        );

      if (trajectoryMatches.length === 0) {
        this.logger.info('No trajectory matches found', { nodeId, userId });
        // Return GraphRAG-only results (graceful degradation)
        return graphRAGResults;
      }

      // Step 5: Merge scores
      this.logger.info('Merging scores', {
        trajectoryMatchCount: trajectoryMatches.length,
      });

      const enrichedProfiles = this.scoreMergingService.enrichProfiles(
        graphRAGResults.profiles,
        trajectoryMatches
      );

      // Step 6: Merge explanations (with LLM enhancement)
      const trajectoryMatchMap = new Map(
        trajectoryMatches.map((m) => [m.userId, m])
      );

      const finalProfiles = await Promise.all(
        enrichedProfiles.map(async (profile) => {
          const userId = parseInt(profile.id, 10);
          const trajectoryMatch = trajectoryMatchMap.get(userId);

          if (trajectoryMatch) {
            // Merge explanations with LLM enhancement
            const mergedWhyMatched =
              await this.explanationMergingService.mergeExplanations(
                profile.whyMatched,
                trajectoryMatch,
                targetRole, // Pass target context for LLM
                targetCompany
              );

            return {
              ...profile,
              whyMatched: mergedWhyMatched,
            };
          }

          return profile;
        })
      );

      // Step 7: Return top N (default: 3)
      const topProfiles = finalProfiles.slice(0, this.FINAL_LIMIT);

      this.logger.info('Hybrid matching completed', {
        nodeId,
        userId,
        graphRAGCount: graphRAGResults.profiles.length,
        trajectoryCount: trajectoryMatches.length,
        finalCount: topProfiles.length,
      });

      return {
        query: searchQuery,
        totalResults: topProfiles.length,
        profiles: topProfiles,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error in hybrid job application matching', {
        nodeId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Fail-soft: return empty results instead of throwing
      // This prevents breaking the entire experience matching flow
      return {
        query: targetRole || targetCompany || '',
        totalResults: 0,
        profiles: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Build search query from job application fields
   */
  private buildSearchQuery(
    targetRole?: string,
    targetCompany?: string
  ): string {
    const parts: string[] = [];

    if (targetCompany) {
      parts.push(targetCompany);
    }

    if (targetRole) {
      parts.push(targetRole);
    }

    // Add generic context for job applications
    parts.push('career trajectory interview preparation');

    return parts.join(' ').trim();
  }

  /**
   * Build map of matched nodes by user ID
   */
  private buildMatchedNodesMap(
    profiles: Array<{ id: string; matchedNodes: MatchedNode[] }>
  ): Map<number, MatchedNode[]> {
    const map = new Map<number, MatchedNode[]>();

    for (const profile of profiles) {
      const userId = parseInt(profile.id, 10);
      map.set(userId, profile.matchedNodes || []);
    }

    return map;
  }
}
